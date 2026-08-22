from flask import Flask, request, jsonify
from flask_cors import CORS
import tensorflow as tf
import numpy as np
from tensorflow.keras.applications.mobilenet_v2 import preprocess_input
from PIL import Image

import os
import json

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "mobilenetv2_best.keras")
MODEL_REGISTRY_PATH = os.path.join(BASE_DIR, "model_registry.json")
DEFAULT_MODEL_ID = "plant_disease_mobilenet_v2"

class_names = [
    'Apple___Apple_scab', 'Apple___Black_rot', 'Apple___Cedar_apple_rust', 'Apple___healthy',
    'Blueberry___healthy', 'Cherry_(including_sour)___Powdery_mildew', 'Cherry_(including_sour)___healthy',
    'Corn_(maize)___Cercospora_leaf_spot Gray_leaf_spot', 'Corn_(maize)___Common_rust_',
    'Corn_(maize)___Northern_Leaf_Blight', 'Corn_(maize)___healthy', 'Grape___Black_rot',
    'Grape___Esca_(Black_Measles)', 'Grape___Leaf_blight_(Isariopsis_Leaf_Spot)', 'Grape___healthy',
    'Orange___Haunglongbing_(Citrus_greening)', 'Peach___Bacterial_spot', 'Peach___healthy',
    'Pepper,_bell___Bacterial_spot', 'Pepper,_bell___healthy', 'Potato___Early_blight',
    'Potato___Late_blight', 'Potato___healthy', 'Raspberry___healthy', 'Soybean___healthy',
    'Squash___Powdery_mildew', 'Strawberry___Leaf_scorch', 'Strawberry___healthy',
    'Tomato___Bacterial_spot', 'Tomato___Early_blight', 'Tomato___Late_blight', 'Tomato___Leaf_Mold',
    'Tomato___Septoria_leaf_spot', 'Tomato___Spider_mites Two-spotted_spider_mite', 'Tomato___Target_Spot',
    'Tomato___Tomato_Yellow_Leaf_Curl_Virus', 'Tomato___Tomato_mosaic_virus', 'Tomato___healthy'
]

# Multilingual translations (English, Hindi, Marathi, Tamil, Telugu) - 100% Offline
translations = {
    'Apple_scab': {'en': 'Apple Scab', 'hi': 'सेब स्काब', 'mr': 'सोवा स्कॅब', 'ta': 'ஆப்பிள் ஸ்கேப்', 'te': 'యాపిల్ స్కాబ్'},
    'Black_rot': {'en': 'Black Rot', 'hi': 'काला विगलन', 'mr': 'काळा विणन', 'ta': 'கருப்பு சிதைவு', 'te': 'నల్ల క్షయం'},
    'Cedar_apple_rust': {'en': 'Cedar Apple Rust', 'hi': 'सीडर सेब जंग', 'mr': 'सीडर सेब गंज', 'ta': 'சிடார் ஆப்பிள் துரு', 'te': 'సీడర్ యాపిల్ నిబ్బర్'},
    'healthy': {'en': 'Healthy', 'hi': 'स्वस्थ', 'mr': 'निरोगी', 'ta': 'ஆரோக்கியமான', 'te': 'ఆరోగ్యకరమైన'},
    'Powdery_mildew': {'en': 'Powdery Mildew', 'hi': 'पाउडरी मिल्ड्यू', 'mr': 'पावडरी मिल्ड्यू', 'ta': 'தூள் பூஞ்சை', 'te': 'పొడి పుండ్రం'},
    'Cercospora_leaf_spot': {'en': 'Cercospora Leaf Spot', 'hi': 'सरकोस्पोरा पत्ती धब्बा', 'mr': 'सरकोस्पोरा पान डाग', 'ta': 'சர்கோஸ்போரா இலை புள்ளி', 'te': 'సర్కోస్పోరా ఆకు మచ్చ'},
    'Common_rust': {'en': 'Common Rust', 'hi': 'साधारण जंग', 'mr': 'साधारण गंज', 'ta': 'பொதுவான துரு', 'te': 'సాధారణ నిబ్బర్'},
    'Northern_Leaf_Blight': {'en': 'Northern Leaf Blight', 'hi': 'उत्तरी पत्ती झुलसा', 'mr': 'उत्तरी पान झुलसा', 'ta': 'வடக்கு இலை கத்தி', 'te': 'ఉత్తర ఆకు కాలిక'},
    'Esca_Black_Measles': {'en': 'Black Measles (Esca)', 'hi': 'काली खसरा', 'mr': 'काळे मिझल्स', 'ta': 'கருப்பு தட்டம்பு', 'te': 'నల్ల పసుపు'},
    'Leaf_blight': {'en': 'Leaf Blight', 'hi': 'पत्ती झुलसा', 'mr': 'पान झुलसा', 'ta': 'இலை கத்தி', 'te': 'ఆకు కాలిక'},
    'Haunglongbing': {'en': 'Citrus Greening', 'hi': 'साइट्रस हरित रोग', 'mr': 'साइट्रस हरितरोग', 'ta': 'சிட்రஸ் பச்சை நோய்', 'te': 'సిట్రస్ ఆకతాలు'},
    'Bacterial_spot': {'en': 'Bacterial Spot', 'hi': 'बैक्टीरियल धब्बा', 'mr': 'बॅक्टेरियल डाग', 'ta': 'பாக்டீரியல் புள்ளி', 'te': 'బాక్టీరియల్ మచ్చ'},
    'Early_blight': {'en': 'Early Blight', 'hi': 'प्रारंभिक झुलसा', 'mr': 'आगाऊ झुलसा', 'ta': 'ஆரம்ப கத்தி', 'te': 'ప్రారంభ కాలిక'},
    'Late_blight': {'en': 'Late Blight', 'hi': 'देर से झुलसा', 'mr': 'उशिरा झुलसा', 'ta': 'தாமத கத்தி', 'te': 'ఆలస్య కాలిక'},
    'Leaf_Mold': {'en': 'Leaf Mold', 'hi': 'पत्ती सड़न', 'mr': 'पान चिंब', 'ta': 'இலை பூஞ்சை', 'te': 'ఆకు పుండ్రం'},
    'Septoria_leaf_spot': {'en': 'Septoria Leaf Spot', 'hi': 'सेप्टोरिया पत्ती धब्बा', 'mr': 'सेप्टोरिया पान डाग', 'ta': 'செப்டோரியா இலை புள்ளி', 'te': 'సెప్టోరియా ఆకు మచ్చ'},
    'Spider_mites': {'en': 'Spider Mites', 'hi': 'मकड़ी घुन', 'mr': 'मकडी पडळ', 'ta': 'சிலந்தி பூச்சி', 'te': 'చిలుక గుబ్బ'},
    'Target_Spot': {'en': 'Target Spot', 'hi': 'लक्ष्य धब्बा', 'mr': 'लक्ष्य डाग', 'ta': 'இலக்கு புள்ளி', 'te': 'లక్ష్య మచ్చ'},
    'Tomato_Yellow_Leaf_Curl_Virus': {'en': 'Tomato Yellow Leaf Curl', 'hi': 'टमाटर पीला पत्ती कर्ल', 'mr': 'टमाटर पिवळ पान वक्र', 'ta': 'தக்காளி மஞ்சள் இலை வளைத', 'te': 'టమోటా పసుపు ఆకు సవ్వింపు'},
    'Tomato_mosaic_virus': {'en': 'Tomato Mosaic Virus', 'hi': 'टमाटर मोजैक वायरस', 'mr': 'टमाटर मोजॅक व्हायरस', 'ta': 'தக்காளி பதுமை வைரஸ்', 'te': 'టమోటా చిత్ర వైరస్'},
}

DEFAULT_MODEL_REGISTRY = {
    "default_model_id": DEFAULT_MODEL_ID,
    "models": [
        {
            "model_id": DEFAULT_MODEL_ID,
            "display_name": "Plant Disease MobileNetV2",
            "model_path": "mobilenetv2_best.keras",
            "model_version": "1.0.0",
            "enabled": True,
            "input_size": 224,
            "preprocess": "mobilenet_v2",
            "crop_tags": ["general", "plant", "leaf"],
            "class_names_source": "default"
        },
        {
            "model_id": "tomato_disease_v1",
            "display_name": "Tomato Disease Detector",
            "model_path": "models/tomato_disease_v1.keras",
            "model_version": "0.1.0",
            "enabled": False,
            "input_size": 224,
            "preprocess": "mobilenet_v2",
            "crop_tags": ["tomato"],
            "class_names_path": "models/tomato_disease_labels.json"
        },
        {
            "model_id": "corn_disease_v1",
            "display_name": "Corn Disease Detector",
            "model_path": "models/corn_disease_v1.keras",
            "model_version": "0.1.0",
            "enabled": False,
            "input_size": 224,
            "preprocess": "mobilenet_v2",
            "crop_tags": ["corn", "maize"],
            "class_names_path": "models/corn_disease_labels.json"
        }
    ]
}


def load_model_registry():
    if os.path.exists(MODEL_REGISTRY_PATH):
        try:
            with open(MODEL_REGISTRY_PATH, "r", encoding="utf-8") as handle:
                parsed = json.load(handle)
                if isinstance(parsed, dict) and isinstance(parsed.get("models"), list):
                    return parsed
        except Exception:
            pass

    return DEFAULT_MODEL_REGISTRY


def normalize_entry(entry):
    normalized = dict(entry)
    normalized["model_id"] = str(normalized.get("model_id", "")).strip()
    normalized["display_name"] = str(normalized.get("display_name", normalized["model_id"]))
    normalized["model_path"] = str(normalized.get("model_path", "")).strip()
    normalized["model_version"] = str(normalized.get("model_version", "1.0.0"))
    normalized["enabled"] = bool(normalized.get("enabled", True))
    normalized["input_size"] = int(normalized.get("input_size", 224))
    normalized["preprocess"] = str(normalized.get("preprocess", "mobilenet_v2"))
    normalized["crop_tags"] = [
        str(tag).lower().strip()
        for tag in normalized.get("crop_tags", [])
        if str(tag).strip()
    ]

    if isinstance(normalized.get("class_names"), list):
        normalized["class_names"] = [str(item) for item in normalized["class_names"] if str(item).strip()]

    if normalized.get("class_names_path"):
        normalized["class_names_path"] = str(normalized["class_names_path"])

    return normalized


def resolve_path(relative_or_absolute_path):
    if not relative_or_absolute_path:
        return None
    if os.path.isabs(relative_or_absolute_path):
        return relative_or_absolute_path
    return os.path.join(BASE_DIR, relative_or_absolute_path)


def load_class_names_for_model(config):
    if isinstance(config.get("class_names"), list) and config["class_names"]:
        return config["class_names"]

    if config.get("class_names_source") == "default" or config.get("model_id") == DEFAULT_MODEL_ID:
        return class_names

    class_names_path = resolve_path(config.get("class_names_path"))
    if class_names_path and os.path.exists(class_names_path):
        try:
            with open(class_names_path, "r", encoding="utf-8") as handle:
                parsed = json.load(handle)
                if isinstance(parsed, list) and parsed:
                    return [str(item) for item in parsed if str(item).strip()]
        except Exception:
            pass

    raise ValueError(
        f'Model "{config.get("model_id")}" does not define class names. Add class_names or class_names_path to the registry.'
    )


def apply_preprocess(img_array, preprocess_name):
    if preprocess_name == "mobilenet_v2":
        return preprocess_input(img_array)
    if preprocess_name == "rescale_1_255":
        return img_array.astype("float32") / 255.0
    return img_array


def load_model_registry_index():
    registry = load_model_registry()
    models = {}

    for entry in registry.get("models", []):
        normalized = normalize_entry(entry)
        model_id = normalized.get("model_id")
        if model_id:
            models[model_id] = normalized

    return registry, models


MODEL_REGISTRY, MODEL_INDEX = load_model_registry_index()
MODEL_CACHE = {}

app = Flask(__name__)
CORS(app)


def get_default_model_id():
    default_model_id = MODEL_REGISTRY.get("default_model_id")
    if default_model_id in MODEL_INDEX:
        return default_model_id

    for model_id, config in MODEL_INDEX.items():
        if config.get("enabled", True):
            return model_id

    return next(iter(MODEL_INDEX), None)


def resolve_model_config(requested_model_id=None, crop_hint=None):
    requested_model_id = str(requested_model_id).strip() if requested_model_id else ""
    crop_hint = str(crop_hint).strip().lower() if crop_hint else ""

    if requested_model_id:
        if requested_model_id not in MODEL_INDEX:
            available_models = [model_id for model_id, config in MODEL_INDEX.items() if config.get("enabled", True)]
            raise KeyError(f'Model "{requested_model_id}" is not registered. Available models: {", ".join(available_models) or "none"}')

        selected_model = MODEL_INDEX[requested_model_id]
        if not selected_model.get("enabled", True):
            raise ValueError(f'Model "{requested_model_id}" is registered but disabled.')

        return selected_model

    if crop_hint:
        for config in MODEL_INDEX.values():
            if not config.get("enabled", True):
                continue

            crop_tags = config.get("crop_tags", [])
            if crop_hint in crop_tags or any(crop_hint in tag or tag in crop_hint for tag in crop_tags):
                return config

    default_model_id = get_default_model_id()
    if default_model_id:
        selected_model = MODEL_INDEX.get(default_model_id)
        if selected_model and selected_model.get("enabled", True):
            return selected_model

    for config in MODEL_INDEX.values():
        if config.get("enabled", True):
            return config

    raise RuntimeError("No enabled ML models are available in the registry.")


def load_model_for_config(config):
    model_id = config["model_id"]
    if model_id in MODEL_CACHE:
        return MODEL_CACHE[model_id]

    model_path = resolve_path(config.get("model_path"))
    if not model_path or not os.path.exists(model_path):
        raise FileNotFoundError(f'Model file not found for "{model_id}": {model_path}')

    loaded_model = tf.keras.models.load_model(model_path)
    MODEL_CACHE[model_id] = loaded_model
    return loaded_model


def extract_top_predictions(predictions, class_names_for_model, language):
    top_count = min(3, len(predictions), len(class_names_for_model))
    top_indices = predictions.argsort()[-top_count:][::-1]

    return [
        {
            "disease": get_translated_name(extract_disease_key(class_names_for_model[int(index)]), language),
            "englishDisease": extract_disease_key(class_names_for_model[int(index)]),
            "canonicalDisease": extract_disease_key(class_names_for_model[int(index)]),
            "probability": float(predictions[index])
        }
        for index in top_indices
    ]

def extract_disease_key(class_name):
    """Extract disease key from class name format 'Plant___Disease'"""
    if '___' in class_name:
        return class_name.split('___')[1]
    return class_name

def get_translated_name(english_disease, language='en'):
    """Get disease name in requested language (en, hi, mr, ta, te)"""
    language = language.lower() if language else 'en'
    if language not in ['en', 'hi', 'mr', 'ta', 'te']:
        language = 'en'
    
    # Try exact match first
    if english_disease in translations:
        return translations[english_disease][language]
    
    # Try partial match for complex disease names
    for key in translations.keys():
        if key in english_disease or english_disease in key:
            return translations[key][language]
    
    # Fallback: return English name
    return english_disease


@app.route("/models", methods=["GET"])
def get_models():
    models = [
        {
            "modelId": config.get("model_id"),
            "displayName": config.get("display_name"),
            "modelVersion": config.get("model_version"),
            "enabled": config.get("enabled", True),
            "inputSize": config.get("input_size", 224),
            "preprocess": config.get("preprocess", "mobilenet_v2"),
            "cropTags": config.get("crop_tags", []),
        }
        for config in MODEL_INDEX.values()
    ]

    return jsonify({
        "defaultModelId": get_default_model_id(),
        "models": models,
    })

@app.route("/predict", methods=["POST"])
def predict():
    file = request.files.get("file")
    if not file:
        return jsonify({"error": "Missing image file"}), 400

    language = request.form.get('language', 'en').lower()
    requested_model_id = request.form.get("modelId") or request.form.get("model_id")
    crop_hint = request.form.get("crop") or request.form.get("cropType") or request.form.get("cropHint")

    # Validate language
    if language not in ['en', 'hi', 'mr', 'ta', 'te']:
        language = 'en'

    try:
        selected_model = resolve_model_config(requested_model_id, crop_hint)
    except KeyError as err:
        return jsonify({"error": str(err), "availableModels": list(MODEL_INDEX.keys())}), 404
    except ValueError as err:
        return jsonify({"error": str(err)}), 409

    try:
        model = load_model_for_config(selected_model)
        class_names_for_model = load_class_names_for_model(selected_model)
    except (FileNotFoundError, ValueError) as err:
        return jsonify({"error": str(err), "modelId": selected_model.get("model_id")}), 500

    img = Image.open(file.stream).convert("RGB")
    img_size = int(selected_model.get("input_size", 224))
    img = img.resize((img_size, img_size))

    img_array = np.array(img)
    img_array = np.expand_dims(img_array, axis=0)
    img_array = apply_preprocess(img_array, selected_model.get("preprocess", "mobilenet_v2"))

    predictions = model.predict(img_array)[0]

    predicted_index = int(np.argmax(predictions))
    if predicted_index >= len(class_names_for_model):
        return jsonify({
            "error": "Model output size does not match the configured class names.",
            "modelId": selected_model.get("model_id")
        }), 500

    predicted_disease_raw = class_names_for_model[predicted_index]
    disease_key = extract_disease_key(predicted_disease_raw)
    predicted_disease = get_translated_name(disease_key, language)
    confidence = float(predictions[predicted_index])

    # The crop family lives in the "Crop___Disease" class label. Return it
    # explicitly so the backend can run the crop-consistency check — otherwise
    # it has to guess the crop from the disease name and flags every scan as a
    # mismatch.
    predicted_crop = predicted_disease_raw.split('___')[0] if '___' in predicted_disease_raw else None

    top3 = extract_top_predictions(predictions, class_names_for_model, language)

    return jsonify({
        "modelId": selected_model.get("model_id"),
        "modelVersion": selected_model.get("model_version"),
        "modelName": selected_model.get("display_name"),
        "disease": predicted_disease,
        "englishDisease": disease_key,
        "canonicalDisease": disease_key,
        "crop": predicted_crop,
        "confidence": confidence,
        "language": language,
        "top3": top3
    })

@app.route("/languages", methods=["GET"])
def get_languages():
    """Return supported languages"""
    return jsonify({
        "supported_languages": {
            "en": "English",
            "hi": "हिंदी (Hindi)",
            "mr": "मराठी (Marathi)",
            "ta": "தமிழ் (Tamil)",
            "te": "తెలుగు (Telugu)"
        }
    })

if __name__ == "__main__":
    app.run(port=5000, debug=True)