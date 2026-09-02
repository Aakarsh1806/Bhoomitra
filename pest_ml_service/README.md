# Bhoomitra pest-classifier service

This Flask service runs Bhoomitra's trained TorchScript pest image classifier on CPU and exposes it to the Next.js dashboard.

## Required artifacts

Place these files in `pest_ml_service/models/`:

- `pest_detector.pt` — standalone TorchScript model loaded with `torch.jit.load` (included with the project)
- `class_names.json` — class names in the exact order used by the model logits
- `best_state_dict.pt` — optional training checkpoint retained locally for future training/resume work; runtime inference does not load it

The service deliberately has no demo or random-result fallback. If an artifact is missing or incompatible, `/health` reports `ready: false` and `/predict` returns an explicit error.

## Run

```bash
python3 -m venv pest_ml_service/.venv
pest_ml_service/.venv/bin/pip install -r pest_ml_service/requirements.txt
pest_ml_service/.venv/bin/python pest_ml_service/main.py
```

The service listens on `127.0.0.1:5001`. Set `PEST_ML_SERVICE_URL` in the Next.js environment only when using a different address.

In another terminal, run the Next.js app with `npm run dev`, then open `http://localhost:3000/dashboard/pests`.

## API

- `GET /health` — validates the TorchScript file and class-name file
- `GET /models` — shows the active model configuration
- `POST /predict` — accepts multipart field `file` and returns the top three pest classes

This is an image classifier, not an object detector. It identifies the dominant pest class in an image, but it cannot produce bounding boxes, count individual insects, or estimate whole-field infestation severity.
