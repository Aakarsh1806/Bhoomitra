# Bhoomitra — AI Crop Intelligence for Smallholder Farms

Bhoomitra helps smallholder farmers detect crop diseases from a leaf photo, get a safe treatment recommendation, and act on it — down to physically running pumps on a real farm rig. Built for the national-level MSME hackathon.

## What it does

1. **AI disease detection** — upload a leaf photo; a MobileNetV2 model (trained on the 38-class PlantVillage dataset) identifies the crop and disease with a confidence score.
2. **Pest classification and prevention** — a separate MobileNetV3 TorchScript model identifies the dominant pest class from 19 trained categories and returns top-three probabilities. Each category has distinct damage signs, scouting steps, prevention, lower-impact controls, and cautious crop-aware pesticide guidance. Predictions below 60% are explicitly marked uncertain.
3. **Severity scoring + IPM recommendation** — confidence is mapped to a severity level, and the system looks up a treatment: active ingredient, dosage, spray interval, pre-harvest interval, resistance group, and an organic alternative. Low-confidence predictions deliberately get *no* pesticide recommendation — the farmer is told to retake the photo and consult local extension.
4. **Farm map & zone monitoring** — the farm is divided into grid zones with live soil moisture, temperature, and humidity. Zones are color-coded by moisture thresholds, and a VPD (vapor pressure deficit) calculation gates spraying to the optimal weather window.
5. **Smart irrigation** — per-zone timed hydration cycles (10 min on / 50 min off), auto-stop on wet threshold, stuck-sensor detection, ripening-mode lockout, and a global "Hydrate" that targets only dry zones.
6. **Spread Control AI** — simulates disease spread across plots (BFS over the farm grid) and computes the best treatment plan under a budget (greedy optimization). See `SPREAD_CONTROL_GUIDE.md`.
7. **Multilingual UI** — English, Hindi, Marathi, Tamil, Telugu. See `MULTILINGUAL.md`.
8. **Safety first** — spraying is never an automatic ML side effect. Every spray requires explicit farmer confirmation, and a hardware kill switch blocks all commands.

## Architecture

```
Next.js 14 app (frontend + API routes, port 3000)
  ├── JSON-file database (app/data/db.json) — detections, sprays, activity log
  ├── Flask disease ML service (ml_service/, port 5000) — crop-disease classification
  ├── Flask pest ML service (pest_ml_service/, port 5001) — 19-class pest classification
  └── /api/sensor  ←→  hardware_bridge.py  ←→  ESP32 over USB serial
```

## Hardware rig (live demo)

The dashboard is wired to a physical rig:

- **ESP32** with a soil-moisture sensor and DHT11 (temperature/humidity)
- **Two relay-driven pumps** — one for irrigation, one for spraying
- **A servo** that aims the outlet: each grid zone has a fixed angle; on "Hydrate", the servo rotates to that zone, the pump runs for a few seconds, then the servo returns home

Data flow: the ESP32 prints sensor JSON over serial → `hardware_bridge.py` forwards it to `POST /api/sensor` → the server updates the zone and replies with any queued command (`WATER:A1`, `SPRAY:A1`, `STOP:A1`) → the bridge writes it back to the ESP32, which drives the servo and relays. When real sensor data arrives, the server automatically switches off simulation mode.

## Running it

```bash
# 1. Frontend
npm install
npm run dev              # http://localhost:3000

# 2. ML service (separate terminal)
python -m venv ml_service/venv
ml_service/venv/Scripts/pip install -r ml_service/requirements.txt
ml_service/venv/Scripts/python ml_service/main.py    # port 5000

# 3. Pest classifier service (separate terminal)
python3 -m venv pest_ml_service/.venv
pest_ml_service/.venv/bin/pip install -r pest_ml_service/requirements.txt
pest_ml_service/.venv/bin/python pest_ml_service/main.py    # port 5001

# 4. (Optional) Hardware bridge — set your COM port in hardware_bridge.py
python hardware_bridge.py
```

Or use the one-click launcher (starts ML service + frontend, opens the browser):

```powershell
scripts/start-demo.ps1
```

Log in with any account or use **Continue as Guest**. Sample leaf images for testing are in `ml_service/` (`leaf.jpg`, `corn.jpg`, `fire blight.jpg`, ...).

## Suggested demo walkthrough

1. Log in as guest → dashboard overview
2. **Detection**: upload a diseased leaf → show confidence, severity, and the IPM treatment card
3. **Farm map**: point out live sensor zones, VPD spray window, then click **Hydrate** on a dry zone → the servo physically aims at that zone and the pump runs
4. **Spread Control**: simulate an outbreak and show the budget-optimized treatment plan
5. Flip the language selector to Telugu/Hindi to show farmer accessibility
