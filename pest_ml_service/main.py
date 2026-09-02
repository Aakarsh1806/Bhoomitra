import json
import os
from io import BytesIO
from typing import Any

from flask import Flask, jsonify, request
from PIL import Image, ImageOps


BASE_DIR = os.path.dirname(os.path.abspath(__file__))
REGISTRY_PATH = os.path.join(BASE_DIR, "model_registry.json")

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 12 * 1024 * 1024

_model_cache: dict[str, Any] = {}


def load_registry() -> dict[str, Any]:
    with open(REGISTRY_PATH, "r", encoding="utf-8") as handle:
        return json.load(handle)


def active_config() -> dict[str, Any]:
    registry = load_registry()
    model_id = registry.get("default_model_id")
    for entry in registry.get("models", []):
        if entry.get("model_id") == model_id and entry.get("enabled", True):
            return entry
    raise RuntimeError("No enabled pest classifier is configured.")


def resolve_path(config: dict[str, Any], key: str, env_key: str) -> str:
    configured = os.getenv(env_key) or str(config.get(key, ""))
    if not configured:
        return ""
    if os.path.isabs(configured):
        return configured
    return os.path.join(BASE_DIR, configured)


def load_labels(config: dict[str, Any]) -> list[str]:
    labels_path = resolve_path(config, "labels_path", "PEST_LABELS_PATH")
    if not labels_path or not os.path.exists(labels_path):
        raise FileNotFoundError(f"Pest class names are missing at {labels_path or 'the configured path'}.")

    with open(labels_path, "r", encoding="utf-8") as handle:
        labels = json.load(handle)

    if not isinstance(labels, list) or not labels or not all(isinstance(item, str) and item.strip() for item in labels):
        raise ValueError("class_names.json must contain a non-empty JSON list of class names.")
    return [item.strip() for item in labels]


def load_classifier(config: dict[str, Any]):
    model_id = str(config.get("model_id", "bhoomitra_pest_classifier_v1"))
    if model_id in _model_cache:
        return _model_cache[model_id]

    model_path = resolve_path(config, "model_path", "PEST_MODEL_PATH")
    if not model_path or not os.path.exists(model_path):
        raise FileNotFoundError(f"TorchScript pest classifier is missing at {model_path or 'the configured path'}.")

    try:
        import torch
    except ImportError as exc:
        raise RuntimeError("PyTorch is not installed. Install pest_ml_service/requirements.txt.") from exc

    labels = load_labels(config)
    model = torch.jit.load(model_path, map_location="cpu")
    model.eval()
    _model_cache[model_id] = (model, labels)
    return model, labels


def prepare_image(image: Image.Image, config: dict[str, Any]):
    import numpy as np
    import torch

    size = int(config.get("input_size", 224))
    mean = np.asarray(config.get("normalization_mean", [0.485, 0.456, 0.406]), dtype=np.float32)
    std = np.asarray(config.get("normalization_std", [0.229, 0.224, 0.225]), dtype=np.float32)

    image = ImageOps.exif_transpose(image).convert("RGB")
    if config.get("resize_mode", "stretch") == "center_crop":
        width, height = image.size
        scale = size / min(width, height)
        resized = image.resize((round(width * scale), round(height * scale)), Image.Resampling.BILINEAR)
        left = max(0, (resized.width - size) // 2)
        top = max(0, (resized.height - size) // 2)
        image = resized.crop((left, top, left + size, top + size))
    else:
        image = image.resize((size, size), Image.Resampling.BILINEAR)

    array = np.asarray(image, dtype=np.float32) / 255.0
    array = (array - mean) / std
    array = np.transpose(array, (2, 0, 1)).copy()
    return torch.from_numpy(array).unsqueeze(0)


def extract_logits(output: Any):
    import torch

    if isinstance(output, dict):
        for key in ("logits", "output", "predictions"):
            if key in output:
                output = output[key]
                break
    if isinstance(output, (tuple, list)):
        output = output[0]
    if not isinstance(output, torch.Tensor):
        raise TypeError("The TorchScript model did not return a tensor of class logits.")
    if output.ndim == 1:
        output = output.unsqueeze(0)
    if output.ndim != 2 or output.shape[0] != 1:
        raise ValueError(f"Expected classifier output [1, classes], received {list(output.shape)}.")
    return output


def model_status() -> dict[str, Any]:
    config = active_config()
    model_path = resolve_path(config, "model_path", "PEST_MODEL_PATH")
    labels_path = resolve_path(config, "labels_path", "PEST_LABELS_PATH")
    try:
        model, labels = load_classifier(config)
        del model
        return {
            "ready": True,
            "classCount": len(labels),
            "modelPath": model_path,
            "labelsPath": labels_path,
            "message": f"TorchScript pest classifier is ready with {len(labels)} classes.",
        }
    except Exception as exc:
        return {
            "ready": False,
            "classCount": 0,
            "modelPath": model_path,
            "labelsPath": labels_path,
            "message": str(exc),
        }


@app.get("/")
@app.get("/health")
def health():
    config = active_config()
    status = model_status()
    return jsonify(
        {
            "service": "bhoomitra-pest-classifier",
            **status,
            "modelId": config.get("model_id", "bhoomitra_pest_classifier_v1"),
            "modelVersion": config.get("model_version", "1.0.0"),
            "task": "image-classification",
        }
    )


@app.get("/models")
def models():
    registry = load_registry()
    output = []
    for entry in registry.get("models", []):
        model_path = resolve_path(entry, "model_path", "PEST_MODEL_PATH")
        labels_path = resolve_path(entry, "labels_path", "PEST_LABELS_PATH")
        output.append(
            {
                **entry,
                "ready": bool(model_path and labels_path and os.path.exists(model_path) and os.path.exists(labels_path)),
            }
        )
    return jsonify({"defaultModelId": registry.get("default_model_id"), "models": output})


@app.post("/predict")
def predict():
    if "file" not in request.files:
        return jsonify({"error": "Missing image file."}), 400

    config = active_config()
    try:
        model, labels = load_classifier(config)
    except Exception as exc:
        return jsonify({"error": str(exc), "ready": False}), 503

    image_file = request.files["file"]
    try:
        raw = image_file.read()
        if not raw:
            raise ValueError("The uploaded image is empty.")
        image = Image.open(BytesIO(raw))
        source_width, source_height = image.size
        tensor = prepare_image(image, config)
    except Exception:
        return jsonify({"error": "The uploaded file is not a readable image."}), 400

    try:
        import torch

        with torch.inference_mode():
            logits = extract_logits(model(tensor))
            if logits.shape[1] != len(labels):
                raise ValueError(
                    f"Model returns {logits.shape[1]} classes but class_names.json contains {len(labels)} names."
                )
            probabilities = torch.softmax(logits, dim=1)[0]
            top_k = min(int(config.get("top_k", 3)), len(labels))
            values, indices = torch.topk(probabilities, k=top_k)
    except Exception as exc:
        app.logger.exception("Pest classifier inference failed")
        return jsonify({"error": f"Pest classifier inference failed: {exc}"}), 500

    predictions = [
        {
            "classId": int(class_id),
            "label": labels[int(class_id)],
            "confidence": float(confidence),
        }
        for confidence, class_id in zip(values.tolist(), indices.tolist())
    ]

    return jsonify(
        {
            "modelId": config.get("model_id"),
            "modelVersion": config.get("model_version"),
            "task": "image-classification",
            "image": {"width": source_width, "height": source_height},
            "primaryPrediction": predictions[0],
            "predictions": predictions,
            "limitations": "This classifier identifies the dominant pest category in one image; it does not count pests or locate them with bounding boxes.",
        }
    )


@app.errorhandler(413)
def image_too_large(_error):
    return jsonify({"error": "Image is too large. Choose an image below 12 MB."}), 413


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=int(os.getenv("PEST_ML_PORT", "5001")), debug=False)
