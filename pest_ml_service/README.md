# Bhoomitra pest-detection service

This local Flask service runs Bhoomitra's trained YOLO26 pest detector on CPU and exposes it to the Next.js dashboard. It returns real bounding boxes, visible counts and an image-level pest-pressure cue. It has no random or sample-result fallback.

## Runtime artifacts

- `models/pest_detector_yolo26_v1.pt` — trained Ultralytics YOLO26 checkpoint
- `models/pest_detector_yolo26_v1.classes.json` — the exact 10-class output order

The older 19-class TorchScript files are retained only as historical artifacts and are not loaded by the active registry.

## Run

```bash
python3 -m venv pest_ml_service/.venv
pest_ml_service/.venv/bin/pip install -r pest_ml_service/requirements.txt
pest_ml_service/.venv/bin/python pest_ml_service/main.py
```

The service listens on `127.0.0.1:5001`. Set `PEST_ML_SERVICE_URL` only when using another address.

In another terminal, run `npm run dev`, then open `http://localhost:3000/dashboard/pests`.

## API

- `GET /health` — loads and validates the YOLO checkpoint and class order
- `GET /models` — shows the active model configuration
- `POST /predict` — accepts multipart field `file` and returns pest detections

Counts and bounding-box coverage describe only the uploaded photo. They are not estimates of whole-field infestation severity.

## Empty-scan retry and follow-up handling

- Inference starts at `640`. Only if it returns no boxes, the same image is retried once at `1280` with the same confidence threshold (`0.35` by default).
- A successful first pass is kept unchanged. Boxes from different passes are never merged or double-counted. The response includes `inference.inputSize`, `retryUsed`, and `attemptedSizes` for auditing.
- If both passes are empty, the dashboard reports that it could not confidently identify a pest. This does not mean the plant is pest-free.
- An empty follow-up is stored as `needs_recheck`, never automatically `resolved`. The previous detected observation stays available as the comparison baseline, and another photo is requested.
- This retry improves some small-pest images but does not guarantee full colony counts.

Regression checks (no real history records are written):

```bash
pest_ml_service/.venv/bin/python -m unittest discover -s pest_ml_service -p 'test_*.py'
node scripts/test-pest-followups.cjs
```
