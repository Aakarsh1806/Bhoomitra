# Bhoomitra Implementation Interview Guide

> **Source-of-truth rule used in this document**
>
> This guide describes the repository as it exists in the current working tree. A statement is called **verified** only when it is supported by executable source, a checked-in runtime artifact, or directly inspectable model metadata. README text, marketing copy, UI copy, and comments are identified as claims when they are not backed by implementation. If a requested feature is absent, this guide says **Not implemented.** Plausible alternatives are discussed only as interview trade-offs; they are not presented as technologies the team actually evaluated.
>
> The project name in `package.json` is `bhoomitra`. The requested guide filename is `BHOOMITRA_INTERVIEW_GUIDE.md`.

# 1. Project Overview

## 1.1 Purpose

Bhoomitra is a local-first precision-farming demonstration that joins four executable systems:

1. A Next.js 14 web application supplies the farmer-facing pages and the primary HTTP API.
2. A Flask/TensorFlow microservice classifies leaf images with a bundled MobileNetV2 model.
3. A Python serial bridge moves telemetry and commands between the Next.js API and a USB-connected controller.
4. JSON files and process-global memory retain detections, application records, users, weather snapshots, settings, command queues, and current zone state.

The central implemented workflow is:

```text
farmer chooses zone/crop/image
    -> Next POST /api/hardwareDetect
    -> Flask POST /predict
    -> MobileNetV2 inference
    -> Next crop-consistency + confidence + treatment safety gates
    -> detection persisted in app/data/db.json
    -> recommendation shown
    -> farmer separately confirms an irrigation or spray action
    -> command queued in memory
    -> hardware_bridge.py receives sensor JSON and polls POST /api/sensor
    -> Next returns one queued command
    -> bridge writes COMMAND:ZONE over serial
    -> controller feedback closes the application lifecycle
```

Disease prediction does **not** automatically spray. The `hardwareDetect` route explicitly stops after recording a detection and recommendation. The separate `/api/spray` route requires a farmer-confirmed tank plan for chemical use, validates the physical pilot zone, applies weather/VPD gates, and records the operation as only `queued` until controller feedback reports a closed pulse.

## 1.2 Problem statement

The executable code addresses these concrete problems:

- A farmer needs a quick classification of a photographed leaf without uploading the image to a hosted ML vendor.
- A raw class probability is not enough for a safe treatment decision. Crop mismatch, low confidence, product-label details, pre-harvest interval, weather, wind, and live VPD must be considered.
- Blanket irrigation wastes water. The application uses per-zone soil moisture to select A1-A4 pilot zones and offers bounded three-second pulse plans.
- A queued command is not proof that a pump ran. The code distinguishes `queued` records from controller-confirmed `completed` records.
- Disease in one plot can affect neighboring plots. A deterministic Monte Carlo model projects orthogonal-grid spread and compares a no-protection scenario with greedy protection of a limited number of bottleneck zones.
- A venue or farm may have intermittent internet. Inference, treatment lookup, users, command state, and core persistence are local; weather degrades to a clearly labeled fallback.

What the code does **not** solve:

- It is not a production multi-tenant farm platform.
- It has no ESP32 firmware in this repository.
- It has no model-training pipeline, dataset download pipeline, MLflow integration, model evaluation report, or reproducible training environment.
- It has no complete offline web app/PWA, service worker, background synchronization, or conflict-resolution engine.
- It has no relational database, transactional queue, message broker, or durable hardware-command delivery.

## 1.3 Executable architecture

```text
Browser / React client
  |
  | same-origin fetch
  v
Next.js 14 App Router, port 3000
  |-- pages and layouts
  |-- Route Handlers under app/api/**
  |-- auth cookies and middleware
  |-- synchronous JSON repositories
  |-- in-memory/global farm state and queues
  |-- Open-Meteo weather/geocoding client
  |
  | multipart proxy, ML_SERVICE_URL
  v
Flask development server, port 5000
  |-- registry resolution
  |-- lazy TensorFlow/Keras model cache
  |-- Pillow/NumPy preprocessing
  `-- JSON classification response

USB controller telemetry
  |
  | serial JSON, 115200 baud, COM5 by default
  v
hardware_bridge.py
  |
  | HTTP POST /api/sensor
  v
Next in-memory command queue
  |
  | response command -> serial "WATER:A1\n", etc.
  v
Controller firmware (Not implemented in this repository)
```

### Boundaries

- **Browser-to-Next boundary:** JSON or multipart HTTP. The browser never needs to know the Flask URL in the active detection workflow.
- **Next-to-Flask boundary:** multipart HTTP. The Next route acts as a backend-for-frontend and adds domain safety logic after raw inference.
- **Next-to-disk boundary:** synchronous `fs` reads/writes to JSON files.
- **Next-to-weather boundary:** Open-Meteo HTTPS with a five-second timeout, shared memory/disk cache, and deterministic fallback.
- **Next-to-controller boundary:** indirect. The Next server exposes `/api/sensor`; the Python bridge converts between HTTP and serial.
- **Command persistence boundary:** commands are process memory only. Spray intentions are persisted, but the pending command queue itself is not.

## 1.4 Technology stack

| Layer | Actual technology | Verified role |
|---|---|---|
| Web framework | Next.js `14.2.25`, App Router | React pages, layouts, middleware, and 34 API route files |
| UI runtime | React/React DOM `18.3.1` | Client component state/effects and server-rendered route shells |
| Language | TypeScript 5, strict mode | Most frontend and Next backend source |
| Styling | Tailwind CSS 4, PostCSS, CSS variables | Global theme, responsive layouts, utility styling |
| Component primitives | shadcn-style wrappers over Radix UI | Dialogs, tabs, forms, switches, cards, alerts, menus, etc. |
| Client state | React context and Zustand with `persist` | Language/navigation/legacy automation context and browser-local farm records |
| Notifications/icons | Sonner and Lucide React | Toasts and iconography |
| Charts | Recharts wrappers | Installed and exposed through `components/ui/chart.tsx`; current analytics page mostly uses custom bars/cards |
| Authentication helper | `bcryptjs` | Hashing, verifying, and migrating passwords |
| ML HTTP service | Flask and Flask-CORS | `/predict`, `/models`, and `/languages` |
| ML runtime | TensorFlow/Keras | Loads and executes `mobilenetv2_best.keras` |
| Image/numeric processing | Pillow and NumPy | Decode/convert/resize image, array/batch construction |
| Model | MobileNetV2 transfer-learning classifier | 224×224 RGB to 38-class softmax |
| Persistence | JSON files plus process-global memory | Users, detections, sprays, activity, water ledger, profile, settings, climate/weather caches |
| External data | Open-Meteo forecast and geocoding APIs | Regional weather and farm-location search |
| Hardware bridge | Python, PySerial, Requests | USB serial to HTTP translation |
| Build/runtime tooling | npm, Next CLI, PowerShell launcher | Development/build/start orchestration |

## 1.5 Design decisions visible in code

### Next.js as both UI and application backend

The App Router co-locates pages and route handlers. This makes browser calls same-origin and lets the Next layer own domain rules—crop matching, lifecycle transitions, weather checks, JSON persistence—rather than placing those rules in the model server. The reason was not documented in an ADR; this is an inference from the boundaries in the code.

### Flask kept as a narrow inference service

Flask performs registry resolution, image preprocessing, model inference, label translation, and response serialization. It does not know about farm zones, treatment records, pumps, users, or weather. This reduces ML service coupling but leaves two processes to deploy.

### Backend-for-frontend proxy for prediction

`app/api/hardwareDetect/route.ts` proxies the file to Flask instead of letting the browser call Flask directly. The active benefits are:

- Flask remains hidden behind `ML_SERVICE_URL`.
- The browser has one API origin.
- Raw model output cannot directly trigger a pesticide recommendation.
- Crop and zone context are attached before persistence.

### Registry-backed model selection

`ml_service/model_registry.json` describes model ID, version, file path, input size, preprocessing, crop tags, and class-label source. Only the general MobileNetV2 entry is enabled. Tomato and corn specialized entries are placeholders with missing model/label files and `enabled: false`.

### Lazy model loading and process-local cache

`MODEL_CACHE` starts empty. The first request for a model calls `tf.keras.models.load_model`; later requests in that Python process reuse it. This lowers Flask startup time but makes the first prediction slower and provides no cross-worker sharing or thread-safe single-flight loading.

### Fixed farm geometry and explicitly limited hardware

The executable zone layout is always 12 zones: A1-A6 and B1-B6. Acreage changes plant-density calculations but not zone count. Only A1-A4 are accepted by spray/irrigation control. The bridge actually maps only `zone1`, `zone2`, and `zone3` to A1-A3, leaving an implementation gap for A4.

### One shared DHT11 climate station

Soil moisture is zone-specific. Temperature and humidity are treated as one farm-wide DHT11 reading, median-smoothed over five samples and mirrored into zone compatibility fields. A 28°C/69% reference is presentation-only; automation requires a fresh real reading no more than 15 minutes old.

### Safety-oriented separation of intent and completion

`/api/spray` creates a queued spray and water-ledger entry. `recordControllerFeedback` marks the latest queued spray completed only when a `closed` feedback event matches the active `spray:zone` command. Linked detections then move from `active` to `treated`. This is a sound design intention, although command and ledger inconsistencies are discussed later.

### Synchronous JSON storage for a local demo

The project avoids a database server. This makes the demo portable, readable, and easy to reset, but introduces blocking I/O, race conditions, corruption recovery that can erase data, no transactions, and incompatibility with read-only/serverless deployments.

### Shared `globalThis`/`global` memory for development-route coherence

Zones, weather cache, command queues, OTPs, hardware state, and other state are placed on the Node global object. This survives Next development module reloads within one process. It is not durable and is not coherent across multiple instances or workers.

### Weather freshness and honest fallback labels

Live Open-Meteo results are cached for 30 minutes. A last-good snapshot may be used after TTL on fetch failure. A deterministic fallback is labeled `fallback` and cannot clear a real spray decision. This is stronger than silently presenting synthetic data as live, but it is not offline synchronization.

### Deterministic Monte Carlo spread simulation

The current spread engine uses a seeded pseudo-random simulation with 350 runs by default, not the BFS algorithm described by the stale `SPREAD_CONTROL_GUIDE.md`. The deterministic seed lets equivalent input snapshots reproduce the same result. A greedy loop chooses protection targets.

### Hybrid localization

Typed translation keys handle selected UI labels. A `MutationObserver` also replaces known English phrases in DOM text nodes at runtime. Flask separately translates a subset of disease names. These systems are independent; UI language is not automatically sent by the detection page.

## 1.6 Why each technology was chosen

No architecture decision record states why any technology was selected. The following are **code-supported suitability explanations, not recorded team decisions**:

- **Next.js:** one repository supplies UI, middleware, and server routes; route handlers can use Node `fs` and server-only environment variables.
- **React:** the dashboard has highly interactive polling, dialogs, image previews, maps, and form state.
- **TypeScript:** shared zone/detection types and strict compilation catch shape errors across UI and APIs. The current tree passes `tsc --noEmit`.
- **Tailwind/Radix:** rapidly assembles accessible primitives and a consistent dashboard without a custom component framework.
- **Zustand:** persists small browser-only records with little boilerplate.
- **Flask:** a small Python boundary fits TensorFlow/Pillow inference and exposes simple multipart endpoints.
- **TensorFlow/Keras:** the bundled artifact is a Keras `.keras` model, so this runtime loads it directly.
- **MobileNetV2:** its frozen compact backbone and small trainable head are suitable for a local inference demo. The repository does not contain a written model-selection study.
- **Pillow/NumPy:** minimal image decode/resize and TensorFlow-compatible array creation.
- **JSON storage:** zero external database setup for a hackathon/local demo.
- **Open-Meteo:** no API key is required, and both forecast and geocoding endpoints are used.
- **PySerial/Requests:** straightforward serial and HTTP adapters for a local bridge.

## 1.7 Alternative technologies considered

**No alternatives are documented as having been considered.** In an interview, make the distinction explicit. Reasonable comparisons—without claiming the team evaluated them—are:

- FastAPI instead of Flask for typed request models and ASGI serving.
- ONNX Runtime, TensorFlow Lite, or TensorFlow.js for smaller/edge inference.
- EfficientNet, ResNet, ConvNeXt, or Vision Transformers as classifier backbones. **EfficientNet is not implemented or referenced.**
- PostgreSQL/SQLite instead of JSON for transactions and concurrent access.
- Redis/BullMQ/MQTT instead of in-memory arrays and sensor-response polling for durable hardware commands.
- NextAuth/Auth.js or signed JWT/session storage instead of unsigned base64 cookies.
- i18next/FormatJS instead of DOM mutation for localization.
- A service worker/IndexedDB queue instead of localStorage plus server JSON for true offline operation.
- Docker Compose/Kubernetes/process managers for deployment. **No Docker configuration exists.**

# 2. Folder Structure

## 2.1 Generated, dependency, and repository-control directories

| Path | Responsibility |
|---|---|
| `.git/` | Git metadata. Not application code. |
| `.next/` | Generated Next.js development/build output. It must not be treated as authored source and is ignored by Git. |
| `node_modules/` | Installed npm dependency tree. Authored behavior should be traced from `package.json` and imports, not from vendored files. |
| `.venv/` | Workspace-local Python environment. Generated, not application source. |
| `ml_service/.venv/` or `ml_service/venv/` | Possible ML virtual environments searched by the launcher. Generated and ignored when named `venv`; the checked workspace may contain `.venv`. |
| `.agents/` | Present but empty in the audited workspace. No project instructions or runtime role. |
| `.claude/` | Local agent/development configuration and ignored by Git. `launch.json` defines Next and ML launches; `settings.local.json` contains local tool permissions. |
| `.vscode/` | Editor launch configuration. The checked launch points Chrome at port 8080, which conflicts with the actual documented Next port 3000. |

Generated files at the root:

- `next-env.d.ts`: Next-generated TypeScript declarations; ignored by Git even though present.
- `tsconfig.tsbuildinfo`: TypeScript incremental compilation cache; ignored through `*.tsbuildinfo`.

## 2.2 Root files

| File | Exact responsibility |
|---|---|
| `.gitignore` | Ignores dependencies, Next/build outputs, logs, `.env*`, Vercel files, TypeScript caches, `ml_service/venv`, live `farm_climate.json`, and `.claude`. It does not ignore the current `weather_cache.json`. |
| `README.md` | Human-oriented demo overview and run commands. Several descriptions are stale: 10/50-minute irrigation, global hydrate, and BFS spread are not the current executable flow. Treat it as documentation, not source truth. |
| `MULTILINGUAL.md` | Usage guide for five languages and localStorage persistence. Its sample “add a key to all languages” structure does not exactly match every current translation count, but the broad architecture is real. |
| `SPREAD_CONTROL_GUIDE.md` | Legacy guide for deleted `/simulate` and `/optimize` endpoints and deleted component files. The current code uses one `/api/spread-control` route and a Monte Carlo engine. |
| `package.json` | npm scripts and top-level JavaScript dependencies. |
| `package-lock.json` | npm lockfile pinning the complete dependency graph; `lockfileVersion` is generated by npm and enables reproducible `npm ci`. An optional Playwright reference comes from dependencies; there are no authored Playwright tests. |
| `next.config.mjs` | Keeps build output in `.next` and disables Next image optimization. |
| `postcss.config.mjs` | Enables only `@tailwindcss/postcss`. Although `autoprefixer` is installed, it is not explicitly configured here. |
| `tsconfig.json` | Strict, no-emit TypeScript; ES6 target; bundler resolution; Next plugin; `@/*` maps to the repository root; incremental compilation. |
| `components.json` | shadcn configuration: New York style, React Server Components, TSX, neutral base, CSS variables, Lucide icons, and aliases. |
| `middleware.ts` | Page-route auth/unlock redirects. It does not protect API routes. |
| `hardware_bridge.py` | Long-running serial-to-HTTP bridge, hard-coded to COM5/115200 and `/api/sensor`. |
| `BHOOMITRA_INTERVIEW_GUIDE.md` | This generated source-audited interview reference. |

## 2.3 `app/`: Next.js App Router

### Global pages and layout

| File | Responsibility |
|---|---|
| `app/layout.tsx` | Root metadata, Geist fonts, global CSS, language/navigation/legacy automation providers, global language selector, runtime DOM translator, Sonner toaster, and Vercel Analytics. Metadata points at `/favicon.ico`, but that file is absent. |
| `app/globals.css` | Active Tailwind import, theme tokens, brand colors, animations, splash styles, scrollbar styles, and global visual rules. |
| `app/page.tsx` | Landing/onboarding implementation. It shows a 1.4-second splash, checks `/api/farmer-profile`, renders onboarding if absent, and calls `/api/auth/unlock-dashboard` before navigating into dashboard pages. Some marketing text mentions logarithmic optimization that is not implemented. |
| `app/home/page.tsx` | Re-exports `app/page.tsx`; middleware makes `/home` the authenticated landing route. |
| `app/login/page.tsx` | Email/password login, guest session, OTP request/verify, demo OTP display, form state, and navigation to `/home`. |
| `app/clinical/page.tsx` | Static technical marketing page. Claims about ~175,000 augmented images, 92–95% validation accuracy, augmentation, hold-out validation, and feature-analysis methods are not backed by training code or artifacts. |

### Dashboard pages

| File | Responsibility |
|---|---|
| `app/dashboard/layout.tsx` | Client sidebar, live `/api/auth/me` role/block check, admin-only Users link filtering, prefetching, logout, and navigation loading state. It does not enforce permission arrays. |
| `app/dashboard/page.tsx` | Farm overview. Polls zones/recommendations/farm impact/water every 12 seconds and renders the live verdict, priority, weather, controller queue, water, risk, and recent activity. |
| `app/dashboard/map/page.tsx` | Thin page rendering `FarmMap`. |
| `app/dashboard/detection/page.tsx` | Image picker/preview, zone and crop loading, multipart scan request, diagnosis interpretation, crop-review warning, knowledge/treatment display, and links to Smart Spray or spread control. |
| `app/dashboard/autospray/page.tsx` | Thin page rendering the current `SmartSprayWorkbench`. |
| `app/dashboard/recommendations/page.tsx` | Thin page rendering `Recommendations`. |
| `app/dashboard/analytics/page.tsx` | Thin page rendering `AnalyticsReports`. |
| `app/dashboard/spread-control/page.tsx` | Renders `LivingFarmHero`, not the older workbench. |
| `app/dashboard/history/page.tsx` | Fetches `/api/history` once and renders combined detection/application/activity records. It has no retry or error state. |
| `app/dashboard/users/page.tsx` | Thin page rendering `UserManagement`; client and server both check admin role, but the server check trusts the unsigned cookie role. |
| `app/dashboard/account/page.tsx` | Loads `/api/auth/me`, edits safe profile fields, changes passwords, changes language, and logs out. |
| `app/dashboard/about/page.tsx` | Static mission/technology/benefit page. Its “50,000+ samples” claim conflicts with the clinical page and has no training artifact support. |

## 2.4 `app/api/`: Next.js Route Handlers

There are 34 current `route.ts` files. Their complete contracts are in section 4.

### Authentication and account

- `app/api/auth/login/route.ts`: password login, plaintext-to-bcrypt migration, cookie creation.
- `app/api/auth/guest/route.ts`: creates an unsigned viewer guest session.
- `app/api/auth/logout/route.ts`: deletes both cookies.
- `app/api/auth/me/route.ts`: resolves the live stored user behind the cookie and invalidates blocked/deleted accounts.
- `app/api/auth/unlock-dashboard/route.ts`: sets a one-day unlock cookie if any auth cookie exists.
- `app/api/auth/otp/request/route.ts`: validates Indian phone/name/password, creates in-memory OTP, returns it to the client in demo mode.
- `app/api/auth/otp/verify/route.ts`: verifies OTP, creates or updates a user, and sets cookies.
- `app/api/account/route.ts`: current-user safe-field update.
- `app/api/account/password/route.ts`: current-user password change.
- `app/api/users/route.ts`: admin user CRUD.

### Farm, sensor, and hardware

- `app/api/zones/data.ts`: central farm state module: fixed zone generation, settings, climate, VPD, simulation, queues, cycles, feedback, and reset logic.
- `app/api/zones/types.ts`: TypeScript types for zones, sensors, cycles, detections, and history.
- `app/api/zones/route.ts`: composite live farm snapshot and decisions.
- `app/api/zones/profile/route.ts`: separate, in-memory acreage/zone-size profile API; it is not the onboarding profile API.
- `app/api/zones/queue/route.ts`: exposes pending in-memory commands.
- `app/api/sensor/route.ts`: receives one zone reading, updates shared climate, validates values, returns one pending command.
- `app/api/hardware/status/route.ts`: reads/mutates controller state and accepts nozzle feedback.
- `app/api/hydrate/route.ts`: weather-gated A1-A4 irrigation queue and water ledger entry.
- `app/api/hydrate-global/route.ts`: retired endpoint that always returns HTTP 410.
- `app/api/irrigation-settings/route.ts`: reads/updates moisture/ripening/single-pump settings.
- `app/api/simulation/route.ts`: toggles process-memory sensor simulation.
- `app/api/spray/route.ts`: reads sprays or validates and queues a spray/water-validation pulse.
- `app/api/detections/reset/route.ts`: clears disease-related persisted/in-memory state.

### ML, recommendations, analytics, weather

- `app/api/hardwareDetect/route.ts`: active Next-to-Flask prediction orchestration and detection persistence.
- `app/api/ml/predict`: extensionless static JSON example. It is **not** a Next route because it is not `route.ts`.
- `app/api/recommendations/route.ts`: fuses active detections, treatments, weather, VPD, irrigation, and spread leverage.
- `app/api/analytics/route.ts`: operational risk, severity, zone, disease, cost, timing, PHI, and crop-context analytics.
- `app/api/analytics/trends/route.ts`: average moisture time series from in-memory zone history.
- `app/api/analytics/loading.tsx`: a three-line loading component inside an API segment; route handlers return JSON, so it is not a useful loading UI for current consumers.
- `app/api/farm-impact/route.ts`: weather pressure, spread infections avoided, yield projection, and coverage.
- `app/api/water-summary/route.ts`: farm-scoped ledger totals and targeted-vs-broadcast estimate.
- `app/api/spread-control/route.ts`: current GET/POST spread plan endpoint.
- `app/api/spray-window/route.ts`: 48-hour rain/wind classification.
- `app/api/weather/forecast/route.ts`: cached/fallback Open-Meteo forecast; `force=1` bypasses fresh-cache reuse.
- `app/api/location/search/route.ts`: Open-Meteo geocoding search.
- `app/api/history/route.ts`: combined history.
- `app/api/activity/route.ts`: raw persisted activity log.
- `app/api/farmer-profile/route.ts`: persistent onboarding/profile/location CRUD.

## 2.5 `app/lib/`: server/domain modules

| File | Responsibility |
|---|---|
| `database.ts` | Synchronous JSON repository, shape normalization, 5,000-record retention, overflow archives, and destructive empty-DB recovery on any read/parse error. |
| `usersStore.ts` | Primary/legacy user-file selection, sync reads/writes, bcrypt-format detection, password removal from responses. |
| `session.ts` | Unsigned cookie decode, live user lookup, blocked status logic, and admin role check. |
| `otpStore.ts` | Process-global five-minute OTPs, five-attempt cap, Indian phone normalization. |
| `mlProcessor.ts` | ML client helper, label normalization, confidence-only severity, and treatment lookup. `runMLPrediction` is not used by the current detection route; that route implements its own proxy. |
| `pesticideEngine.ts` | Exact/crop/type/organic fallback engine. No current route imports it; current treatment lookup comes from `mlProcessor.ts`. |
| `farmLocation.ts` | Farm-location types, validation, Hyderabad-coordinate unconfigured fallback, and forecast conversion. |
| `weatherService.ts` | Open-Meteo client, derived signals, cache, disk snapshot, last-good behavior, fallback weather. |
| `farmDecisionService.ts` | Climate validation, VPD, weather freshness/context, irrigation decision, and spray decision. |
| `demoHardware.ts` | A1-A4 pilot boundary, three-second pulses, eight-pulse planning cap, and explicit `PUMP_CALIBRATED=false`. |
| `flowModel.ts` | Conservative 30 L/min reference model, crop application rates, and estimated volume/runtime helpers. It labels the reference model calibrated even though the physical pump module says it is not calibrated. |
| `waterLedger.ts` | Farm-stamped unified water entry construction and aggregation by kind/zone/status. |
| `farmContext.ts` | Uses current session ID as `farmId`, else `default-farm`; this is only a future multi-tenant seam, not isolation. |
| `spreadEngine.ts` | Deterministic seeded Monte Carlo spread, graph building, Tarjan articulation points, greedy target selection, urgency. |
| `yieldModel.ts` | Research-range-based yield-loss/protection projection for active detections. The source citations themselves are not stored in the repository. |
| `diseaseLanguage.ts` | Farmer-language diagnosis tone based on health, crop mismatch, and confidence. |
| `mlEventBus.ts` | Simple module-local publish/subscribe array. Unused. |
| `mlLogStore.ts` | Simple module-local detection log. Unused. |

## 2.6 `app/data/`: domain catalogs and persisted state

| File | Responsibility/current facts |
|---|---|
| `db.json` | Active JSON database. At audit time: 12 detections (10 resolved, 2 active), 1 queued spray, 2 activities, 4 queued water-ledger entries, no `zoneHistory`. Counts are runtime data and can change. |
| `archive/db-pretest-backup-2026-07-17.json` | Historical snapshot: 96 detections, 131 sprays, 13 activities, no water ledger. It includes older schemas/behavior and is not read by runtime code. |
| `detections.json` | Empty legacy file; not read by current code. |
| `sprays.json` | Empty legacy file; not read by current code. |
| `farmer_profile.json` | Persistent onboarding profile: farmer/location/crop/acreage, 12 zone names, and three sensor assignments. Runtime content can change. |
| `irrigation_settings.json` | Persisted dry/wet thresholds, ripening flag, three-second timing, and stuck-sensor settings. Missing `singlePumpMode` is filled by defaults on read. |
| `weather_cache.json` | Best-effort runtime cache written by `weatherService.ts`; currently untracked and one-line JSON. |
| `farm_climate.json` | Created at runtime by live DHT11 updates and deliberately ignored by Git; absent until written. |
| `users.json` | Legacy user database with plaintext demo passwords. Used only if primary `data/users.json` does not exist. |
| `diseaseKnowledge.ts` | Detailed knowledge for six exact labels: squash powdery mildew, tomato late/early blight, potato late blight, corn common rust, grape black rot. Detection UI falls back when a label is absent. |
| `pesticideDatabase.ts` | 23 chemical/organic records with approved labels, doses, intervals, safety, PHI, and coverage metadata. |
| `telanganaPesticideCatalog.ts` | 26 offline advisories covering the non-healthy bundled classes, generic label-dose text, resistance group, safety, cultural alternative, and mandatory verification notice. |

## 2.7 `components/`: feature components

| File | Responsibility and reachability |
|---|---|
| `farm-map.tsx` | Active 12-zone map. Polls queues every 2s, zones every 15s, analytics/recommendations every 30s; writes sensor snapshots to Zustand; handles profile location, reset, zone analysis, and per-zone hydrate requests. |
| `farmer-onboarding.tsx` | Active four-step fixed-grid onboarding and location/sensor assignment. |
| `farm-location-picker.tsx` | Debounced location search and browser geolocation UI; returns validated location-shaped state to parents. |
| `hardware-safety-panel.tsx` | Active controller status/kill-switch panel, polling every 3s. |
| `smart-spray-workbench.tsx` | Active Smart Spray UI; polls five endpoints every 4s, defaults to water-only validation, computes a tank recipe only from farmer-entered label values, and posts `/api/spray`. |
| `recommendations.tsx` | Active recommendations UI, five-second sessionStorage fallback, treatment navigation, irrigation action, local “implemented” records, and spray-window component. |
| `analytics-reports.tsx` | Active analytics/farm-impact/water dashboard. |
| `living-farm-hero.tsx` | Active spread page, fixed GET query `days=5&budget=2`, baseline/protected toggle and timeline animation. |
| `spread-control-workbench.tsx` | More configurable current-API client, but no page imports it. Unused. |
| `spray-window-timeline.tsx` | Active child of Recommendations; fetches hourly spray-window classification. |
| `weather-strip.tsx` | Active dashboard child; fetches current forecast. |
| `user-management.tsx` | Active admin CRUD UI with a client-side `/auth/me` check. |
| `language-selector.tsx` | Active global/account language dropdown. |
| `global-runtime-translator.tsx` | Active text-node replacement observer. |
| `navigation-loading-indicator.tsx` | Active top loading bar driven by navigation context. |
| `command-confirmation-dialog.tsx` | Confirmation UI used only by unused `ZoneDetails`. |
| `ZoneDetails.tsx` | Legacy zone control panel using browser-local detections/activities. No current page imports it. |
| `spraying-controls.tsx` | Legacy in-memory automation UI. No current page imports it. |
| `multilingual-example.tsx` | Translation example. Unused. |
| `theme-provider.tsx` | `next-themes` wrapper. Unused by root layout. |

## 2.8 `components/ui/`: shadcn/Radix primitives

These files are reusable UI wrappers, not domain logic:

- `accordion.tsx`, `collapsible.tsx`: expandable disclosure primitives.
- `alert.tsx`, `alert-dialog.tsx`: status panel and modal confirmation.
- `aspect-ratio.tsx`: fixed aspect wrapper.
- `avatar.tsx`: image/fallback avatar.
- `badge.tsx`, `button.tsx`, `toggle.tsx`, `toggle-group.tsx`: variant-driven controls using class-variance-authority.
- `breadcrumb.tsx`, `pagination.tsx`, `navigation-menu.tsx`, `menubar.tsx`, `sidebar.tsx`: navigation primitives.
- `calendar.tsx`: `react-day-picker` wrapper.
- `carousel.tsx`: Embla carousel wrapper.
- `chart.tsx`: Recharts context, tooltip, legend, and color configuration.
- `checkbox.tsx`, `radio-group.tsx`, `select.tsx`, `slider.tsx`, `switch.tsx`: form controls.
- `command.tsx`: `cmdk` command palette wrapper.
- `context-menu.tsx`, `dropdown-menu.tsx`, `hover-card.tsx`, `popover.tsx`, `tooltip.tsx`: floating Radix surfaces.
- `dialog.tsx`, `drawer.tsx`, `sheet.tsx`: modal/side/bottom surfaces; drawer uses Vaul.
- `form.tsx`: React Hook Form context and validation-message bindings.
- `input.tsx`, `input-otp.tsx`, `label.tsx`, `textarea.tsx`: text/OTP form elements.
- `progress.tsx`: progress bar.
- `resizable.tsx`: resizable panel wrapper.
- `scroll-area.tsx`: styled scroll container.
- `separator.tsx`: visual separator.
- `skeleton.tsx`: loading placeholder.
- `table.tsx`: table element wrappers.
- `tabs.tsx`: tabs primitive.
- `toast.tsx`, `toaster.tsx`, `use-toast.ts`: older Radix toast implementation/store.
- `sonner.tsx`: Sonner toaster wrapper used by root layout.
- `use-mobile.tsx`: media-query hook duplicated by `hooks/use-mobile.ts`.

Many primitives are scaffolded but not reached by current feature pages. Their presence explains installed Radix dependencies; it does not mean every primitive is actively rendered.

## 2.9 `lib/`, `services/`, `store/`, `hooks/`, `styles/`

### Root `lib/`

- `language-context.tsx`: active five-language context and localStorage persistence.
- `translations.ts`: typed dictionaries. English has 168 keys; other languages have fewer and fall back to English.
- `runtime-phrase-map.ts`: phrase dictionaries for DOM replacement; language coverage is uneven.
- `use-translation.ts`: active typed translation lookup hook.
- `navigation-context.tsx`: active loading boolean reset on pathname changes.
- `automation-context.tsx`: mounted globally but only consumed by unused `spraying-controls.tsx`; initializes a stale A1-D6 24-zone model that conflicts with the live 12-zone model.
- `utils.ts`: active `clsx` + `tailwind-merge` class combiner.
- `ai-engine.ts`: unused rule-based water/nutrient recommendation.
- `fusion-engine.ts`: unused confidence/humidity/temperature severity formula.

### `services/`

- `sprayAutomation.ts`: unused disease-type inference and generic spray recommendation. Current application logic does not import it.

### `store/`

- `farmStore.ts`: Zustand `persist` store under localStorage key `smart-farm-storage`. Active code updates `sensorData` and local recommendation implementation records. Its detection/activity structures are legacy and are not populated by the current server-backed scan/spray flow.

### `hooks/`

- `use-mobile.ts`: viewport hook.
- `use-toast.ts`: duplicate older toast store. Current feature code primarily uses Sonner.

### `styles/`

- `styles/globals.css`: older global token sheet. No source imports it; `app/globals.css` is active.

## 2.10 `ml_service/`

| File | Responsibility |
|---|---|
| `main.py` | Complete Flask app, registry, labels, translations, preprocessing, lazy loading, prediction, and three routes. There is no `app.py`. |
| `model_registry.json` | Three model descriptors; one enabled general model and two disabled/missing specialized placeholders. |
| `mobilenetv2_best.keras` | Bundled Keras model, 13,674,944 bytes, SHA-256 `5BC025CCEFF25E5FC8017A95531077EC5627F14F2C7A5B0D5F48889E48EA6966`. |
| `requirements.txt` | Unpinned Flask, Flask-CORS, TensorFlow, NumPy, Pillow. |
| `abcd.jpg`, `apple.webp`, `banana.jpg`, `banana2.jpg`, `corn.jpg`, `fire blight.jpg`, `leaf.jpg` | Manual sample images. No source imports them. Banana is not a class in the bundled model, so those samples are useful as out-of-distribution tests rather than supported labels. |
| `__pycache__/main.cpython-310.pyc`, `main.cpython-312.pyc` | Tracked Python bytecode caches for two interpreter versions; generated artifacts that normally should not be committed. |

The `.keras` archive contains:

- `metadata.json` (Keras 3.10.0; save timestamp `2026-02-20@07:03:28`)
- `config.json` (159-layer Functional model configuration)
- `model.weights.h5`

## 2.11 `public/`

- `Bhoomitra-removebg-preview.png` (344×112): active splash/login wordmark.
- `bhoomitra-logo.svg`: active fallback wordmark with sprout.
- `diverse-farmers-harvest.png` (1024×680): About-page photograph.
- `apple-icon.png` (180×180): root metadata Apple icon.
- `Bhoomitra.jpeg`, `logo.png`, `icon-dark-32x32.png`, `icon-light-32x32.png`, `icon.svg`, `placeholder-logo.png`, `placeholder-logo.svg`, `placeholder-user.jpg`, `placeholder.jpg`, `placeholder.svg`: currently unreferenced assets. `icon.svg` also contains malformed extra content after an early closing `</svg>`.
- A referenced `/favicon.ico` is **not present**.

## 2.12 `scripts/`

- `start-demo.ps1`: Windows launcher. Resolves Python from `BHOOMITRA_BACKEND_PYTHON` or five candidate paths, starts Flask on 5000 and Next on 3000 if not already listening, waits up to 45 seconds per service, optionally opens the browser, and hides child windows.

# 3. Complete Backend Flow

## 3.1 Prediction request lifecycle

### Step 1: request enters the Next.js application

`app/dashboard/detection/page.tsx` constructs browser `FormData`:

- `zoneId`
- `crop`
- `file`

It sends `POST /api/hardwareDetect`. It does not currently include UI language or an explicit model ID.

Next App Router resolves the URL to `app/api/hardwareDetect/route.ts` and calls its exported `POST(req)`. Flask is not the browser entry point in the active UI.

### Step 2: Next route parses and validates context

`await req.formData()` parses multipart data. The route extracts:

- required `zoneId`
- required `file`
- optional `modelId`
- optional `crop` or `cropType`
- optional `language`

Validation is intentionally minimal:

- missing zone or file -> 400
- zone not in the live in-memory `zones` array -> 404
- no MIME, extension, byte-size, dimensions, file magic, decode test, or upload count validation

### Step 3: Next proxies to Flask

The route creates a new `FormData`, appends the image, and conditionally appends model/crop/language. It posts to:

```text
${process.env.ML_SERVICE_URL ?? "http://127.0.0.1:5000"}/predict
```

If Flask returns any non-2xx code, the Next layer discards Flask’s detailed body/status and returns generic HTTP 500 `{ "error": "ML prediction failed" }`.

### Step 4: request enters Flask

Flask was initialized by `app = Flask(__name__)`; `CORS(app)` applies default permissive CORS. The route decorator selects `predict()` for POST `/predict`.

`request.files.get("file")` must exist. Flask reads optional form fields:

- `language`, default `en`
- `modelId` or `model_id`
- `crop`, `cropType`, or `cropHint`

Invalid language codes silently become English.

### Step 5: registry routing

`resolve_model_config` follows this order:

1. If an explicit model ID is present, require it to exist and be enabled.
2. Else, if a crop hint is present, return the first enabled model whose crop tag is equal to or a substring/superstring of the hint.
3. Else, try the configured default model.
4. Else, use the first enabled model.
5. Else, raise `RuntimeError`.

In the checked registry only `plant_disease_mobilenet_v2` is enabled, so tomato/corn hints still resolve to the general model.

### Step 6: model and labels load

`load_model_for_config` checks `MODEL_CACHE` by model ID. On a miss:

1. resolve an absolute/relative path against `ml_service/`
2. require the file
3. call `tf.keras.models.load_model`
4. cache the model in the current Flask process

`load_class_names_for_model` uses inline labels, the hard-coded default list, or a JSON label path in that order.

### Step 7: image preprocessing

Flask performs:

1. `Image.open(file.stream)` – image decode
2. `.convert("RGB")` – force three channels and discard alpha
3. `.resize((224, 224))` – square distortion; default Pillow resampling because no method is passed
4. `np.array(img)` – shape `(224,224,3)`, normally `uint8`
5. `np.expand_dims(..., axis=0)` – shape `(1,224,224,3)`
6. MobileNetV2 `preprocess_input` – converts to floating values scaled approximately to `[-1,1]`

There is no crop, aspect-ratio preservation, EXIF-orientation normalization, leaf segmentation, background removal, augmentation, or quality assessment at inference time.

### Step 8: model prediction

`model.predict(img_array)[0]` yields the 38-class probability vector. `np.argmax` selects the highest index. The code checks only that the winning index is less than the label-list length; it does not require output length to exactly equal label length.

The winning class is `Crop___Disease`. Flask:

- extracts crop from the prefix
- extracts canonical disease from the suffix
- translates a subset of disease suffixes
- returns confidence as the winning floating probability
- sorts and returns up to three predictions

### Step 9: Next post-processing and safety gates

The Next layer takes translated `disease`, canonical/English disease, confidence, model metadata, and model crop.

It computes:

- `healthy`: canonical normalized label includes `healthy`
- `lowConfidence`: non-healthy and confidence `< 0.65`
- crop match: normalized selected crop equals normalized model crop
- severity: healthy -> score 0/low; otherwise `>0.75` high/3, `>0.45` moderate/2, else low/1
- treatment: Telangana catalog first, broader pesticide database second

If crop mismatch or low confidence, the primary chemical recommendation is suppressed. Crop mismatch also prevents the new scan from replacing a prior active diagnosis.

### Step 10: persistence and in-memory update

The route creates a UUID `DetectionEvent`. Healthy results start `resolved`; all other results, including low-confidence results and crop-review results, start `active`.

For a conclusive scan, prior non-treated/non-resolved detections in the same zone are marked resolved. The new detection is appended and `writeDB` persists the JSON file.

The in-memory zone is updated only for conclusive scans. Its disease, confidence, severity, canonical label, model metadata, status, and treatment history change.

Important defect: `recordActivity` performs its own read/write after the route has already read `db`. The route then writes its older `db` object, which can overwrite the newly inserted alert activity. This is a lost-update race even in one process.

### Step 11: response generation

Next returns HTTP 200:

```json
{
  "success": true,
  "detection": { "...DetectionEvent fields..." },
  "recommendation": { "...or null..." },
  "recommendationNotice": "safety/catalog explanation",
  "modelId": "plant_disease_mobilenet_v2",
  "modelVersion": "1.0.0"
}
```

The detection UI saves the result only in React component state. The authoritative record is server-side `db.json`.

## 3.2 Hardware request/command lifecycle

1. The controller prints a JSON line over serial. Firmware format is not implemented here; the bridge expects keys `zone1`, `zone2`, `zone3`, `temperature`, `humidity`.
2. `hardware_bridge.py` reads currently available bytes, splits on newline, extracts the first `{` through last `}`, and parses JSON.
3. It emits one HTTP POST per present zone key to `/api/sensor`.
4. The sensor route disables simulation, validates zone and numeric ranges, updates the shared farm climate and one zone’s moisture/status/history, and computes weather-aware decisions.
5. The route removes at most one command from that zone’s in-memory queue.
6. It calls `markCommandDispatched`, updating zone/hardware state, and returns the command in JSON.
7. The bridge handles the response only when status is exactly 200, uppercases the command, and writes `COMMAND:ZONE\n`.
8. Later controller status can arrive as `nozzleStatus` in a sensor request or through `/api/hardware/status`. `recordControllerFeedback` finalizes matched work.

There is no independent command poll. If sensor telemetry stops, commands remain queued.

## 3.3 General Next request lifecycle

For page paths matched by `middleware.ts`, middleware checks cookie presence/unlock state before routing. API routes are outside its matcher and proceed without middleware authentication.

Route handlers generally:

1. parse `req.json()`, multipart, or URL search parameters
2. read globals/JSON files
3. perform domain checks
4. mutate globals and/or sync-write JSON
5. return `NextResponse.json`

There is no shared validation schema, API middleware stack, dependency-injection container, request ID, transaction boundary, centralized logger, or centralized exception mapper.

## 3.4 Error handling through the prediction chain

- Browser network/JSON error -> detection page catches, logs, shows Sonner error.
- Next multipart parse or unexpected exception -> caught by `hardwareDetect`, logs to console, returns generic 500.
- Missing file/zone -> explicit 400/404.
- Flask missing file -> explicit 400.
- Unknown model -> Flask 404, but proxied as Next 500.
- Disabled model -> Flask 409, but proxied as Next 500.
- Missing model/labels -> Flask 500 JSON, but proxied as Next 500 generic.
- Corrupt/non-image/Pillow decode error -> unhandled in Flask `predict`; Flask debug server produces 500.
- TensorFlow load/predict error other than missing path -> unhandled Flask 500.
- No enabled models -> `RuntimeError` is not caught by `predict`.
- JSON database read/parse failure -> `readDB` overwrites the database with empty arrays and continues; this can hide corruption and lose records.

# 4. Every API Endpoint

## 4.1 Contract conventions

- Unless stated otherwise, responses are JSON.
- “No auth” means the route does not call a session helper and is not covered by the middleware matcher.
- Types shown are runtime expectations, not Zod/JSON Schema; Zod is installed but not used for these routes.
- Current method count is larger than the 34 route-file count because several files export multiple methods.

## 4.2 Flask endpoints

### GET `/models`

- **Purpose:** enumerate registry metadata, including disabled entries.
- **Request:** no body.
- **Response 200:**

```json
{
  "defaultModelId": "plant_disease_mobilenet_v2",
  "models": [
    {
      "modelId": "plant_disease_mobilenet_v2",
      "displayName": "Plant Disease MobileNetV2",
      "modelVersion": "1.0.0",
      "enabled": true,
      "inputSize": 224,
      "preprocess": "mobilenet_v2",
      "cropTags": ["general", "plant", "leaf"]
    }
  ]
}
```

- **Validation:** registry is normalized at module import. No request validation.
- **Errors:** registry parse errors silently use defaults. An empty registry returns `defaultModelId: null`.
- **Internal calls:** `get_default_model_id`.
- **Files:** `ml_service/main.py`, `model_registry.json`.
- **Interview questions:** Why expose disabled models? When is the registry reloaded? Answer: disabled entries aid discoverability/planning; it is loaded once per process, so edits require restart.

### GET `/languages`

- **Purpose:** return five supported disease-translation languages.
- **Response 200:** `{ "supported_languages": { "en":"English", "hi":"…", "mr":"…", "ta":"…", "te":"…" } }`.
- **Validation/errors:** none expected.
- **Files:** `ml_service/main.py`.
- **Interview question:** Does this control the UI language? No. Flask disease translation and React UI language are independent.

### POST `/predict`

- **Purpose:** raw leaf-image classification.
- **Content type:** `multipart/form-data`, **not JSON**.
- **Fields:** required `file`; optional `language`; optional `modelId`/`model_id`; optional `crop`/`cropType`/`cropHint`.
- **Response 200:** model ID/version/name, translated disease, English/canonical disease suffix, crop prefix, confidence, normalized language, and top-three array.
- **Errors/status:**
  - 400 missing file
  - 404 unknown explicit model plus `availableModels`
  - 409 explicit disabled model
  - 500 missing model file, missing labels, or winner index outside label list
  - unhandled 500 for decode/load/inference/runtime errors
- **Validation:** language allowlist only; no file controls.
- **Internal calls:** `resolve_model_config`, `load_model_for_config`, `load_class_names_for_model`, `apply_preprocess`, `extract_disease_key`, `get_translated_name`, `extract_top_predictions`.
- **Files:** `main.py`, registry, `.keras`, optional future label JSON.
- **Interview questions:** Why use multipart? How is preprocessing coupled to registry metadata? Why does crop hint not select tomato model? How would you validate uploads and output dimensions?

## 4.3 Prediction and profile endpoints

### POST `/api/hardwareDetect`

- **Purpose:** authoritative scan orchestration, farm safety post-processing, and persistence.
- **Body:** multipart fields `zoneId`, `file`, optional `modelId`, `crop`/`cropType`, `language`.
- **Response 200:** `{success,detection,recommendation,recommendationNotice,modelId,modelVersion}`.
- **Errors:** 400 missing zone/file; 404 unknown zone; 500 any Flask non-OK or caught exception.
- **Validation:** zone membership only; no file checks.
- **Internal calls:** Flask `/predict`, `calculateSeverity`, `getTreatmentOptions`, `normalizeDiseaseLabel`, `readDB`, `recordActivity`, `writeDB`.
- **Files:** route, `mlProcessor.ts`, treatment catalogs, zones data/types, JSON DB, Flask files.
- **Interview questions:** Why is this a BFF route? Why suppress chemicals below 0.65? What happens on crop mismatch? Identify the alert-activity lost update.

### GET `/api/farmer-profile`

- **Purpose:** read persistent onboarding profile.
- **Response 200:** `{exists:false}` or `{exists:true,profile}`.
- **Error:** 500 `{exists:false,message}` on read/parse failure.
- **Auth:** none.
- **Files:** route, `app/data/farmer_profile.json`.
- **Interview question:** Why is a read error distinguishable from absence only by status?

### POST `/api/farmer-profile`

- **Purpose:** create/overwrite onboarding profile.
- **Request JSON:** requires `farmerName,village,district,acres,totalFarmAreaAcres,primaryCrop,zones,zoneCount,zoneNames,sensorAssignments,farmLocation`.
- **Response 200:** `{success:true,profile}` with created/updated timestamps.
- **Errors:** 400 first missing field or invalid location; 500 parse/write error.
- **Validation:** field presence only for most fields; full range/type validation exists only for `farmLocation`.
- **Side effect:** overwrites the JSON file.
- **Interview question:** Can a caller save a negative acreage or non-12 zone count? Yes; this endpoint only checks presence. Live zone generation still forces 12.

### PATCH `/api/farmer-profile`

- **Purpose:** update only farm location.
- **Request:** `{farmLocation}`.
- **Errors:** 404 no profile; 400 invalid location; 500 failure.
- **Response 200:** updated profile.
- **Interview question:** Why retain other fields by spread? It creates a narrow update but remains non-transactional.

### DELETE `/api/farmer-profile`

- **Purpose:** remove onboarding profile.
- **Response 200:** success even if absent.
- **Error:** 500 unlink failure.
- **Security:** no auth/confirmation at API layer; UI uses `window.confirm`.
- **Interview question:** Why is UI confirmation not an authorization control?

### GET `/api/location/search?q=...`

- **Purpose:** proxy Open-Meteo geocoding.
- **Validation:** trimmed query length 2–120.
- **Response 200:** `{results:[{id,label,latitude,longitude,timezone}]}`; filters invalid coordinates and limits provider request to six.
- **Errors:** 400 invalid query; 502 provider non-OK, abort, network, or parse failure.
- **Timeout:** five seconds.
- **Interview question:** Why use an abort controller? What rate limiting/privacy controls are missing?

## 4.4 Authentication and account endpoints

### POST `/api/auth/login`

- **Request:** `{email?,phone?,password}`.
- **Lookup:** exact case-sensitive email, or normalized Indian phone.
- **Response 200:** `{success:true,user:{id,name,email,role}}`; sets `auth_token` and locked `dashboard_unlocked`.
- **Errors:** 401 invalid credentials; 403 blocked; 500 any exception.
- **Password behavior:** bcrypt compare when hash prefix matches; legacy plaintext equality otherwise, followed by bcrypt cost-10 migration.
- **Interview questions:** Why is email case handling inconsistent with create/update? Why is the cookie not secure authentication? What happens when password is missing?

### POST `/api/auth/guest`

- **Request:** ignored.
- **Response 200:** random five-character guest ID, viewer role, three permissions; sets cookies.
- **Error:** 500 catch-all.
- **Interview question:** Are guest permissions enforced? No; most APIs have no auth and the middleware checks only cookie presence.

### POST `/api/auth/otp/request`

- **Request:** `{phone,name?,password?}`.
- **Validation:** Indian 10-digit mobile starting 6–9, optional `91` prefix; new users require name and six-character password.
- **Response 200:** `{success,isNewUser,demoOtp,message}`.
- **Errors:** 400 validation; 500 catch-all.
- **Security:** OTP uses `Math.random`, is returned to the caller, and has no request rate limit.
- **Interview question:** Why is this acceptable only as demo mode?

### POST `/api/auth/otp/verify`

- **Request:** `{phone,otp,password?}`.
- **Response 200:** creates/updates user, sets cookies, returns `{success,isNewUser,user}`.
- **Errors:** 400 missing fields/new-user password; 401 OTP reason; 403 blocked; 500 catch-all.
- **State:** OTP is deleted after success, expiration, or too-many-attempts; mismatch increments attempts.
- **Interview question:** Can an existing account log in without its password? Yes, possession of the demo OTP is a login method.

### GET `/api/auth/me`

- **Purpose:** resolve unsigned session then live user file.
- **Response 200:** safe merged account/session fields.
- **Errors:** 401 absent/invalid; 403 blocked/deleted and cookies deleted.
- **Interview question:** Which stale claims are corrected? Name/role/status/permissions are reread from disk, but admin endpoints do not use this live-user helper.

### POST `/api/auth/unlock-dashboard`

- **Validation:** only presence of `auth_token`.
- **Response:** 200 and a one-day `dashboard_unlocked=1`; 401 no token.
- **Interview question:** Is this authorization? No; it is a navigation gate and accepts a forged token.

### POST `/api/auth/logout`

- **Response 200:** deletes both cookies.
- **Interview question:** Is there server-side session revocation? No; sessions are stateless unsigned cookie data.

### PUT `/api/account`

- **Request:** optional `name,location,language,email`.
- **Auth:** `getCurrentUser`; rejects guest.
- **Validation:** non-empty name; string location/language; email only if account currently has none.
- **Responses:** 200 safe user; 401 unauthenticated/blocked; 403 guest; 404 missing user; 500.
- **Interview question:** Can it change role/status? No, fields are explicitly selected.

### POST `/api/account/password`

- **Request:** `{currentPassword,newPassword}`.
- **Validation:** new password length ≥6, current password match.
- **Responses:** 200; 400 short/new or account without password; 401 unauthenticated/bad current password; 404 user; 500.
- **Interview question:** How are legacy plaintext passwords handled? They can be compared here, but successful change always stores bcrypt.

### GET `/api/users`

- **Purpose:** admin list without passwords.
- **Response:** raw array of sanitized users.
- **Error:** 403 non-admin.
- **Interview question:** Why can an attacker forge admin? `requireAdmin` trusts role from unsigned base64 cookie rather than the live user record.

### POST `/api/users`

- **Request:** arbitrary user object with required string password.
- **Behavior:** case-insensitive email duplicate check, bcrypt unless already hash-looking, random ID, forces active/date.
- **Responses:** 200 safe user; 400 missing password/duplicate; 403; 500.
- **Weak validation:** role, permissions, phone, email shape, password length, and extra fields are not schema-checked.
- **Interview question:** Why is accepting a client-supplied bcrypt-looking string dangerous?

### PUT `/api/users`

- **Request:** arbitrary fields including required existing `id`.
- **Behavior:** arbitrary spread update; hashes supplied password; protects current session from self-demotion/block.
- **Responses:** 200 safe user; 400 self-lockout; 403; 404; 500.
- **Interview question:** What mass-assignment risk exists? Any unprotected user property can be written.

### DELETE `/api/users?id=...`

- **Responses:** 200 even when ID did not exist; 400 missing ID/self-delete; 403; 500.
- **Interview question:** Why should nonexistent deletion return 404 or an affected-count signal?

## 4.5 Farm state and telemetry endpoints

### GET `/api/zones`

- **Purpose:** composite current farm read model.
- **Response:** zones plus farm climate, presentation climate, weather context, controller/queue count, six activities, and irrigation metadata.
- **Processing:** optional simulation mutation; weather fetch; persisted active detection overlay; per-zone decision.
- **Errors:** no catch; weather service normally falls back, but unexpected errors produce 500.
- **Auth:** none.
- **Interview questions:** Why overlay persisted detections? Why can globals diverge across workers? Why is it `force-dynamic`?

### GET `/api/zones/profile`

- **Purpose:** read the separate computed in-memory `farmProfile`.
- **Response:** `{acres,zoneSizeAcres,totalZones,rows,cols}`.
- **Interview question:** How does it differ from `/api/farmer-profile`? It is a legacy runtime geometry model and is not the persistent onboarding record.

### POST `/api/zones/profile`

- **Request:** `{acres,zoneSizeAcres?}`.
- **Validation:** acres 2–10, positive zone size.
- **Response:** 200 `{success,profile}`; 400 invalid/catch.
- **Side effect:** rebuilds in-memory zones/history but fixed generator still returns 12; does not write onboarding JSON.
- **Interview question:** Why can returned `totalZones` disagree with actual `zones.length`?

### GET `/api/zones/queue`

- **Response:** raw `{zoneId:["spray"|"water"|"stop"]}` process-memory object.
- **Auth/errors:** none.
- **Interview question:** What happens after restart? Queue is lost.

### POST `/api/sensor`

- **Request:** `{zoneId,soilMoisture,temperature,humidity,nozzleStatus?,currentPath?,feedbackMessage?}`.
- **Validation:** zone; moisture 0–100; temperature −20–70; humidity 0–100.
- **Response 200:** update message, one command or null, target, remaining queue, farm climate, decision.
- **Errors:** 404 zone; 422 invalid reading with `command:"stop"`; unhandled JSON/weather errors -> 500.
- **Side effects:** disables simulation before validation, may process feedback before numeric validation, updates DHT median, zone status/history/sensor runtime, shifts a command.
- **Interview questions:** Why does the bridge fail to transmit the 422 safety stop? Why is command polling coupled to telemetry? What happens to fragmented serial JSON?

### GET `/api/hardware/status`

- **Response:** raw hardware state.
- **Auth:** none.

### POST `/api/hardware/status`

- **Request:** optional `killSwitchEngaged,currentPath,nozzleStatus,zoneId,feedbackMessage`.
- **Response:** 200 `{success,hardwareState}`; 500 catch-all.
- **Validation:** enumerated nozzle status and boolean kill switch; otherwise loose.
- **Side effect:** can finalize an application through feedback.
- **Interview question:** Why is an unauthenticated public kill-switch/controller mutation critical?

### GET `/api/irrigation-settings`

- **Response:** current settings.

### POST `/api/irrigation-settings`

- **Request:** optional `dryThreshold,wetThreshold,ripeningMode,singlePumpMode`.
- **Response:** 200 settings.
- **Validation:** numeric thresholds are coerced/clamped 5–95; wet is pushed at least five above dry when possible; booleans checked for two flags. No catch for bad JSON/write.
- **Interview question:** Is `singlePumpMode` enforced? No; it is persisted state only.

### GET `/api/simulation`

- **Response:** `{simulationEnabled}`.

### POST `/api/simulation`

- **Request:** `{enabled}`; no boolean validation.
- **Response:** message based on truthiness.
- **Interview question:** Why can a string corrupt the state contract?

### POST `/api/hydrate`

- **Request:** `{zoneId,pulses?}`.
- **Validation/status:** 423 kill switch; 400 missing ID; 404 unknown; 409 zone/pilot/ripening/sensor/green/weather rejection.
- **Response 200:** message, full decision, estimated pulses, max 8, pulse 3000ms, `estimatedLitres` usually null because physical `PUMP_CALIBRATED=false`.
- **Side effects:** queues exactly one `water`, records a queued water ledger entry.
- **Interview questions:** Why is `pulses` an estimate, not queue length? Why is the estimate not clamped in `queueIrrigationPulses`? Why does controller completion not update this ledger entry?

### POST `/api/hydrate-global`

- **Response:** always 410 `{message,retired:true}`.
- **Purpose:** safe compatibility for old clients.
- **Interview question:** Why keep a retired endpoint? To fail explicitly rather than silently approximate unsupported hardware.

### GET `/api/spray`

- **Response:** complete `db.sprays` array, including water tests and queued/legacy records.
- **Auth:** none.

### POST `/api/spray`

- **Request:** `zoneId,disease,chemical,dosage,detectionId,weatherOverride,tankPrepared,demoWaterOnly,preHarvestIntervalDays,inputCostInr,waterPh,labelRate,rateUnit,carrierWaterLiters,tankCapacityLiters`.
- **Water-validation branch:** bypasses chemical/tank/PHI/weather checks but still requires kill switch off, valid zone, A1-A4, and no duplicate queued spray.
- **Chemical branch validation:** tank confirmation; product/dosage/unit/positive rate; positive carrier/tank; nonnegative PHI; weather or narrow explicit override; linked active non-review detection.
- **Statuses:** 200 queued; 404 zone/detection; 409 pilot/tank/weather/detection lifecycle/duplicate; 422 label/tank/PHI; 423 kill switch.
- **Important bug:** because `linkedDetection?.status !== "active"` is true when no detection is supplied, the advertised `manualWithoutDetection` branch cannot actually pass.
- **Side effects:** persists queued spray and water entry, appends `spray` command, marks hardware pending.
- **Interview questions:** Why separate tank-plan carrier liters from three-second pulse estimate? Why not mark completed on POST? How should weather overrides be audited?

### POST `/api/detections/reset`

- **Response:** 200 reset timestamp and zone count.
- **Side effects:** deletes all detections, all non-water-validation sprays, and non-water activities; clears zone ML fields/history. It leaves water ledger entries, even chemical spray ledger entries, untouched.
- **Auth:** none.
- **Interview question:** What referential/orphan records remain after reset?

## 4.6 Weather, spread, recommendations, and reporting endpoints

### GET `/api/weather/forecast?force=1`

- **Response 200:** full `WeatherForecast` with source/location/current/hourly/derived.
- **Force:** only exact `force=1`.
- **Error:** 500 only if `getForecast` unexpectedly throws; normal network failure becomes cached/fallback 200.
- **Interview question:** Why can a cached snapshot older than TTL still be returned? It is last-good behavior on provider failure; the decision engine separately rejects data older than 90 minutes.

### GET `/api/spray-window`

- **Response:** source, safe-now verdict, next three-hour window, thresholds, live VPD metadata, and 48 hourly classifications.
- **Rules:** rain probability ≥40%, precipitation ≥0.2mm, wind ≥15km/h.
- **Mismatch:** `safeNow` does not include VPD freshness/band even though VPD is returned. `/api/spray` uses the stricter unified decision.
- **Interview question:** Why can this endpoint say “Spray now” while the action endpoint blocks?

### GET `/api/spread-control?days=&budget=`

- **Validation:** days rounded/clamped 1–14 default 5; budget 1–4 default 2.
- **Response:** full `SpreadPlan`.
- **Errors:** no catch.
- **POST variant:** same result with `{days,budget}` JSON; malformed JSON becomes `{}`.
- **Interview questions:** Why deterministic randomness? What does protection mean in this model? Why is this not BFS?

### GET `/api/recommendations`

- **Request:** none.
- **Response:** `generatedAt,recommendations,insights,context`.
- **Inputs:** DB, weather, DHT, zone moisture, treatment catalog, spread plan.
- **Recommendation kinds:** treatment, preventive/cultural/crop-review, irrigation.
- **Errors:** no catch.
- **Notable edge:** low-confidence active detections recorded with “No chemical required” can be re-expanded into an organic/treatment recommendation here because this route performs a fresh treatment lookup; the original no-pesticide safety intention is not fully preserved.
- **Interview questions:** How are recommendations sorted? How is weather gating shared with hardware? Why can crop-review suppress an irrigation recommendation in the same zone?

### GET `/api/analytics`

- **Response:** detection/application counts, current combined risk, severity, per-zone analytics, disease groups, water-model note, financials, response timing, PHI holds, crop context.
- **Risk:** `1 - product(1-individualRisk)` with severity/confidence/freshness; active high severity has a 55% floor.
- **Errors:** no catch; profile read failure falls back to unspecified crop.
- **Interview questions:** Why combine risks multiplicatively? Why exclude review and queued work? Why does the response say pump calibration is required while `flowModel.ts` reports calibrated?

### GET `/api/analytics/trends`

- **Response:** `[{index,avgMoisture}]` across positions in each in-memory history array.
- **Persistence:** not backed by `db.zoneHistory`; process restart resets it.
- **Interview question:** Are samples aligned by timestamp? No; arrays are averaged by index.

### GET `/api/farm-impact`

- **Response:** weather fungal pressure, day-five projected infections avoided, yield projection, farm coverage.
- **Inputs:** weather, climate, DB, fixed zones, spread/yield models.
- **Interview question:** Which values are measured vs projected? Pressure and spread/yield are model-derived; zone/acre coverage comes from configured state.

### GET `/api/water-summary`

- **Response:** current farm ID, flow-model label, farm-scoped ledger total, and live targeted-vs-fixed-three-pulse-broadcast comparison for A1-A4.
- **Projection:** 30 L/min × three seconds = 1.5 L per pulse.
- **Edge:** session ID is treated as farm ID; guests get random farm IDs, and unauthenticated calls use `default-farm`.
- **Interview question:** Why is this not true multi-tenancy? There is no access filter on stored records beyond this aggregate’s farmId comparison.

### GET `/api/history`

- **Response:** combined sorted history plus raw detections/sprays and status summary.
- **Transformation:** every detection becomes `type:"alert"` and every spray `type:"spray"`, then persisted activity is appended, creating duplicate conceptual events.
- **Potential error:** `(d.confidence * 100).toFixed(1)` can throw for malformed legacy detection confidence.
- **Interview question:** Why should normalized event projections have stable IDs instead of array-index rendering?

### GET `/api/activity`

- **Response:** raw `activityLog` array.
- **Interview question:** Why can it miss scan alerts? The hardwareDetect lost-update sequence can overwrite `recordActivity`.

# 5. Flask Architecture

## 5.1 `app.py`

**Not implemented.** There is no `app.py`. The Flask application lives entirely in `ml_service/main.py`.

## 5.2 Application initialization

Module import performs significant work:

1. imports Flask, CORS, TensorFlow, NumPy, MobileNet preprocessing, Pillow, OS/JSON
2. resolves paths relative to `main.py`
3. declares 38 labels and 21 translation keys
4. declares a fallback registry
5. loads/normalizes registry into `MODEL_REGISTRY` and `MODEL_INDEX`
6. creates empty `MODEL_CACHE`
7. creates `Flask(__name__)`
8. applies `CORS(app)`
9. registers routes through decorators

When executed directly, `app.run(port=5000, debug=True)` starts Werkzeug’s development server on the default loopback host.

## 5.3 Blueprint usage

**Not implemented.** All routes are on one `app` object. There are no Blueprints, application factory, package modules, or route groups.

## 5.4 Configuration

Configuration consists of module constants and JSON:

- `BASE_DIR`
- `MODEL_PATH` (declared but the registry path is what loading actually uses)
- `MODEL_REGISTRY_PATH`
- `DEFAULT_MODEL_ID`
- hard-coded port 5000/debug mode
- `model_registry.json`

There is no Flask config class, `app.config` setup, config-per-environment, maximum content length, secret key, testing config, or environment-based host/port/debug switch.

## 5.5 CORS

`CORS(app)` applies Flask-CORS defaults to the whole app. No origin, method, header, or credential allowlist is supplied. The active browser workflow does not need direct Flask CORS because Next proxies the call.

## 5.6 Middleware

**Not implemented.** Flask has no `before_request`, `after_request`, request ID, timing, authentication, upload-size middleware, or centralized error handler.

## 5.7 Logging

Only Flask/Werkzeug default debug logs and uncaught tracebacks exist. The Flask source contains no configured Python logger, structured fields, rotation, redaction, model latency measurement, or audit stream.

## 5.8 Environment variables

The Flask service reads **no environment variables**. The Next server chooses its Flask URL with `ML_SERVICE_URL`. A separate unused helper reads `NEXT_PUBLIC_ML_SERVICE_URL`, which would expose the URL to browser bundles if used.

## 5.9 Dependency injection

**Not implemented.** Registry dictionaries, cache, Flask app, label list, and TensorFlow module are globals. Tests cannot swap them through an injection boundary without monkey-patching.

## 5.10 Consequences

- Simple to understand and run locally.
- Importing the module also imports the heavy TensorFlow runtime.
- Registry changes require restart.
- Each WSGI worker would load its own model and cache.
- First inference is cold.
- Debug server is not production-safe.
- Lack of central error handling leaks inconsistent HTML/JSON 500 responses.

# 6. Machine Learning Pipeline

## 6.1 What is actually present

The repository contains an **inference pipeline and a saved compiled model**, not a training pipeline.

Verified artifacts:

- one enabled Keras model
- its architecture/compile metadata and weights
- 38 hard-coded output labels
- registry-driven input size and preprocessing
- seven manual sample images
- Flask inference code

Missing artifacts:

- raw or processed dataset
- download/source manifest
- train/validation/test split files
- training script or notebook
- augmentation pipeline
- class-balancing logic
- random seeds for training
- training history
- confusion matrix/class report
- checkpoint callback code
- experiment tracker
- dataset/model license records

## 6.2 Dataset

**Dataset implementation: Not implemented.**

What can be said safely:

- The 38 label names in `main.py` are PlantVillage-style labels.
- The README says the model was trained on a “38-class PlantVillage dataset.”
- `app/clinical/page.tsx` says “Kaggle Plant Disease Dataset” and approximately 175,000 augmented images.
- `app/dashboard/about/page.tsx` says 50,000+ labeled samples.

Those numbers conflict, and no dataset/training artifact can verify either one. In an interview, say:

> “The inference label schema matches the common 38-class PlantVillage taxonomy and the README claims PlantVillage training, but this repository does not contain the dataset or training provenance, so I cannot substantiate sample counts, split methodology, or field-domain coverage from source.”

## 6.3 The exact 38 output classes

The output index order is an inference contract and must match the Dense layer:

1. `Apple___Apple_scab`
2. `Apple___Black_rot`
3. `Apple___Cedar_apple_rust`
4. `Apple___healthy`
5. `Blueberry___healthy`
6. `Cherry_(including_sour)___Powdery_mildew`
7. `Cherry_(including_sour)___healthy`
8. `Corn_(maize)___Cercospora_leaf_spot Gray_leaf_spot`
9. `Corn_(maize)___Common_rust_`
10. `Corn_(maize)___Northern_Leaf_Blight`
11. `Corn_(maize)___healthy`
12. `Grape___Black_rot`
13. `Grape___Esca_(Black_Measles)`
14. `Grape___Leaf_blight_(Isariopsis_Leaf_Spot)`
15. `Grape___healthy`
16. `Orange___Haunglongbing_(Citrus_greening)`
17. `Peach___Bacterial_spot`
18. `Peach___healthy`
19. `Pepper,_bell___Bacterial_spot`
20. `Pepper,_bell___healthy`
21. `Potato___Early_blight`
22. `Potato___Late_blight`
23. `Potato___healthy`
24. `Raspberry___healthy`
25. `Soybean___healthy`
26. `Squash___Powdery_mildew`
27. `Strawberry___Leaf_scorch`
28. `Strawberry___healthy`
29. `Tomato___Bacterial_spot`
30. `Tomato___Early_blight`
31. `Tomato___Late_blight`
32. `Tomato___Leaf_Mold`
33. `Tomato___Septoria_leaf_spot`
34. `Tomato___Spider_mites Two-spotted_spider_mite`
35. `Tomato___Target_Spot`
36. `Tomato___Tomato_Yellow_Leaf_Curl_Virus`
37. `Tomato___Tomato_mosaic_virus`
38. `Tomato___healthy`

Label order is hard-coded instead of stored inside a versioned model card. A reordered list would silently relabel predictions unless the winning index exceeded its length.

## 6.4 Dataset preprocessing

Training-time preprocessing is **not implemented or recoverable from the repository**.

Inference-time preprocessing is verified:

```python
img = Image.open(file.stream).convert("RGB")
img = img.resize((img_size, img_size))
img_array = np.array(img)
img_array = np.expand_dims(img_array, axis=0)
img_array = preprocess_input(img_array)
```

For the enabled registry entry:

- `img_size = 224`
- input shape becomes `(1, 224, 224, 3)`
- MobileNetV2 `preprocess_input` converts channels from the 0–255 domain to approximately −1–1
- Pillow supplies RGB order, matching TensorFlow/Keras expectations

There is no input mean/std configuration beyond the named preprocessing function.

## 6.5 Image transformations

Implemented:

- arbitrary decodable image -> RGB
- resize to a square
- NumPy conversion
- batch dimension
- model-specific normalization

Not implemented:

- EXIF orientation correction
- center/random crop
- aspect-ratio preservation or letterbox
- segmentation or leaf/background isolation
- blur/brightness/occlusion quality rejection
- color-space calibration
- maximum image dimensions/pixel count
- channel-order configuration

The square resize can distort a non-square leaf. Pillow’s default resize resampling is used because no explicit `resample` parameter is passed.

## 6.6 Data augmentation

**Not implemented in source.** The clinical page lists rotation, zoom, horizontal flips, and lighting/contrast shifts, but no training pipeline supports the claim. Do not say those transformations were used as a verified fact.

## 6.7 Saved model architecture

Direct inspection of `config.json` inside the `.keras` archive verifies:

- Keras Functional model named `functional`
- 159 serialized layers
- input: `(None, 224, 224, 3)`
- output: `(None, 38)`
- MobileNetV2 convolution/depthwise/inverted-residual backbone
- backbone layers marked non-trainable in the saved config
- `GlobalAveragePooling2D`
- `Dropout(rate=0.35)`
- `Dense(256, activation="relu")`
- `Dropout(rate=0.25)`
- `Dense(38, activation="softmax")`

Parameter counts from model inspection:

- model parameters: 2,595,686
- trainable: 337,702
- non-trainable: 2,257,984
- saved optimizer-slot parameters: 675,406
- total including optimizer state: 3,271,092

The head math is consistent:

- pooled MobileNetV2 vector has 1,280 features
- 1,280×256 + 256 = 327,936 parameters
- 256×38 + 38 = 9,766 parameters
- head trainable total = 337,702

The model uses global average pooling rather than flattening a spatial tensor, which substantially reduces head parameters.

## 6.8 Why MobileNetV2

The repository does not contain a documented benchmark or selection rationale. The defensible implementation-based answer is:

- the backbone is relatively compact
- depthwise separable convolutions reduce compute compared with conventional convolutions
- inverted residual/linear bottleneck blocks preserve useful representations efficiently
- a frozen backbone limits trainable parameters to about 338k
- 224×224 input is practical for local CPU/GPU inference
- the model file is only about 13.7 MB

Do not claim that MobileNetV2 beat another architecture in this project; no comparison exists.

## 6.9 Why EfficientNet

**Not implemented.** No source, dependency, registry record, model file, or documentation references EfficientNet. If asked to compare it:

- EfficientNet could offer stronger accuracy/parameter scaling through compound depth/width/resolution scaling.
- It would require retraining, a matching preprocessing function, latency/memory evaluation on the target machine, and a new registry entry.
- None of that work is present.

## 6.10 Hyperparameters recoverable from the saved artifact

| Setting | Verified value |
|---|---|
| Input | 224×224×3 RGB |
| Classes | 38 |
| Head dropout 1 | 0.35 |
| Hidden units | 256 |
| Hidden activation | ReLU |
| Head dropout 2 | 0.25 |
| Output | 38-way softmax |
| Loss | categorical crossentropy |
| Optimizer | Adam |
| Learning rate | approximately `1e-4` |
| Adam beta 1 | 0.9 |
| Adam beta 2 | 0.999 |
| Adam epsilon | `1e-7` |
| AMSGrad | false |
| Weight decay | null |
| Gradient clipping | none |
| EMA | false |
| Gradient accumulation | none |
| Saved metric | accuracy |
| `jit_compile` | true |
| `run_eagerly` | false |
| `steps_per_execution` | 1 |

## 6.11 Hyperparameters that are not present

- Batch size: **Not implemented/documented.**
- Epoch count: **Not implemented/documented.**
- Training scheduler: **Not implemented.**
- Warmup: **Not implemented.**
- Early stopping: **Not implemented.**
- Checkpoint policy: **Not implemented.**
- Class weights or focal loss: **Not implemented.**
- Random seed: **Not implemented.**
- Fine-tuning/unfreezing schedule: the saved backbone is frozen, but earlier training phases cannot be inferred.

## 6.12 Loss function

The saved compile config says `categorical_crossentropy`, which implies one-hot targets during the saved compile phase. The source does not show label encoding, label smoothing, or whether the final model was recompiled after training.

## 6.13 Optimizer

The saved optimizer is Adam at approximately `0.0001`. Optimizer slot variables are stored in the artifact. Inference calls `load_model` without `compile=False`, so TensorFlow restores compilation state even though prediction does not need loss/optimizer state. Loading with `compile=False` could reduce some overhead and avoid custom compile dependencies if retraining is not needed.

## 6.14 Scheduler

**Not implemented.** No scheduler configuration is serialized as a learning-rate schedule; the saved learning rate is a scalar.

## 6.15 Validation strategy and metrics

Validation split/hold-out/cross-validation strategy: **Not implemented/documented.**

The artifact records only the metric name `accuracy`; it does not contain a validation accuracy result. The clinical page’s 92–95% is an unsupported UI claim. There is no:

- precision/recall/F1 by class
- confusion matrix
- ROC/PR analysis
- calibration/error analysis
- field-vs-lab benchmark
- out-of-distribution rejection threshold

The application treats the softmax maximum as “confidence,” but no calibration method such as temperature scaling is implemented.

## 6.16 Model selection and versioning

Selection logic is registry-based. An explicit enabled model wins, then crop tags, then default, then first enabled. Current reality:

- `plant_disease_mobilenet_v2`, version 1.0.0: enabled and present
- `tomato_disease_v1`, version 0.1.0: disabled; model/labels absent
- `corn_disease_v1`, version 0.1.0: disabled; model/labels absent

Model version is metadata supplied by JSON, not read from the artifact and not tied to its SHA-256.

## 6.17 Saved weights and loading

Keras’s single-file format contains config, weights, and optimizer state. `tf.keras.models.load_model(model_path)` restores the full model. There is no separate `load_weights`, checksum verification at runtime, download, registry signature, warmup request, or rollback mechanism.

# 7. MLflow

## 7.1 Implementation status

**MLflow is not implemented.**

Repository-wide source search finds no:

- `mlflow` dependency
- experiment name
- tracking URI
- `start_run`
- parameter or metric log
- artifact log
- model registry call
- `MLmodel` file
- MLflow server or volume

## 7.2 Experiment tracking

**Not implemented.** The Keras file’s compile metadata is not experiment tracking; it has no run lineage, dataset version, Git commit, or training history.

## 7.3 Metrics logged

**Not implemented.** No metrics are logged. `accuracy` in the Keras compile config is only a metric definition.

## 7.4 Parameters logged

**Not implemented.** Some final hyperparameters are inspectable in the model configuration, but they were not logged through MLflow.

## 7.5 Artifacts and model versioning

The `.keras` file and `model_registry.json` are ordinary repository artifacts. The `model_version` string is manually maintained. There is no MLflow registry stage, alias, promotion, lineage, or artifact store.

## 7.6 Why MLflow

The repository gives no reason because it does not use MLflow. A proposed improvement would use it to retain:

- dataset hash/source/license
- split seed
- augmentation/hyperparameters
- per-class metrics and calibration
- confusion matrix and sample errors
- Keras artifact checksum
- deployment version/status

This is an improvement proposal, not current behavior.

# 8. Prediction Pipeline

## 8.1 Requested step-by-step pipeline

```text
Image Upload
  DetectionPage creates multipart FormData with zoneId, crop, file
        |
        v
Validation (Next)
  required zoneId/file; zone must exist
  no content/type/size validation
        |
        v
Proxy to Flask
  forwards file + optional model/crop/language
        |
        v
Validation (Flask)
  file presence; language allowlist; enabled registered model
        |
        v
Pillow Decode + RGB Conversion
        |
        v
Resize
  registry input_size -> 224×224
        |
        v
Tensor Conversion
  np.array -> expand_dims -> (1,224,224,3)
        |
        v
Normalization
  MobileNetV2 preprocess_input -> approximately [-1,1]
        |
        v
Model Prediction
  model.predict(batch)[0] -> 38 probabilities
        |
        v
Confidence Score
  argmax probability, no calibration
        |
        v
Disease Name
  class index -> Crop___Disease -> suffix + optional translation
        |
        v
Flask JSON
  model metadata, disease/canonical/crop/confidence/top3
        |
        v
Next Post-processing
  healthy, <0.65 confidence gate, crop consistency,
  severity thresholds, treatment catalog, detection lifecycle
        |
        v
Persistence
  app/data/db.json + live zone state
        |
        v
Browser Response JSON
  detection, recommendation/null, notice, model metadata
```

## 8.2 Exact shapes and types

| Stage | Shape/type |
|---|---|
| Browser file | Web `File` |
| Flask stream | Werkzeug `FileStorage.stream` |
| Pillow after RGB/resize | `PIL.Image`, 224×224, 3 channels |
| NumPy before batch | `(224,224,3)`, typically `uint8` |
| Batched | `(1,224,224,3)` |
| Preprocessed | floating array around −1..1 |
| Network output | `(1,38)` softmax |
| Selected prediction | Python `float`, class index |

## 8.3 Translation caveat

Flask translations cover 21 keys, not all 38 unique full labels. Suffix/partial matching handles many cases. `Esca_(Black_Measles)` does not exactly match the declared `Esca_Black_Measles` key because of parentheses, so it may fall back to the canonical English token. The translated `disease` is persisted, while `canonicalDisease` retains the stable suffix.

## 8.4 Severity is not lesion severity

Severity is derived only from confidence:

- healthy -> low, score 0
- non-healthy confidence >0.75 -> high, score 3
- >0.45 -> moderate, score 2
- otherwise -> low, score 1

No leaf-area segmentation or lesion percentage is used. Therefore “severity” is a business heuristic based on classifier certainty, not measured disease extent.

# 9. Docker

## 9.1 Dockerfile

**Not implemented.** No `Dockerfile` exists at the root or under `ml_service`.

## 9.2 Base image

**Not implemented.**

## 9.3 Dependencies/build/runtime/ports

No container build steps, health checks, non-root user, volumes, entrypoint, or exposed ports are declared. Source code conventionally uses:

- Next on 3000
- Flask on 5000

Those are application defaults, not Docker `EXPOSE` instructions.

## 9.4 Docker Compose

**Not implemented.** No `docker-compose.yml`, `compose.yml`, or environment/volume wiring exists.

## 9.5 Containerization constraints an interviewer should notice

A correct future container design would have to address:

- TensorFlow-compatible Python/base image
- separate Next and Flask processes/services
- writable persistent volumes for `app/data` and climate/weather state
- `ML_SERVICE_URL=http://ml:5000` between services
- model-file size and image-layer caching
- hardware serial device pass-through on the host
- the fact that process-global queues do not survive recreation

These are requirements for a future implementation, not current Docker behavior.

# 10. Database

## 10.1 Database technology

A database is used in the broad application sense, but it is a synchronous JSON-file store, not a database server.

- Main path: `app/data/db.json`
- User path: `data/users.json`
- Profile/settings/cache use additional JSON files
- ORM: **Not implemented**
- Raw SQL: **Not implemented**
- Transactions: **Not implemented**
- Migrations: **Not implemented**

## 10.2 Main logical schema

`normalizeDB` guarantees five arrays:

```ts
{
  detections: any[],
  sprays: any[],
  zoneHistory: any[],
  activityLog: any[],
  waterLog: any[]
}
```

### Detection record

Current-created fields:

| Field | Meaning |
|---|---|
| `id` | UUID |
| `zoneId` | logical zone |
| `disease` | possibly translated label |
| `canonicalDisease` | stable English/model suffix |
| `confidence` | winning softmax probability |
| `severityLevel` / `severityScore` | confidence-based heuristic |
| `recommendedChemical` | catalog output or safety placeholder |
| `organicAlternative` | catalog/fallback guidance |
| `dosage` | catalog/verification text |
| `timestamp` | scan ISO time |
| `status` | active, treated, resolved |
| `treatedAt` | controller-confirmed treatment time |
| `postSeverityScore` | reserved but never set by current code |
| `linkedSprayId` | treatment application link |
| `scanCrop`, `modelCrop`, `cropMatch` | crop consistency |
| `modelId`, `modelVersion` | inference metadata |

### Spray/application record

| Field group | Fields |
|---|---|
| Identity/link | `id,farmId,zoneId,detectionId,manualWithoutDetection` |
| Agronomy | `disease,chemical,dosage,preHarvestIntervalDays` |
| Lifecycle | `timestamp,queuedAt,completedAt,applicationStatus` |
| Safety/source | `applicationMode,tankPrepared,triggeredBy` |
| Farmer input | `inputCostInr,waterPh,labelRate,rateUnit,carrierWaterLiters,tankCapacityLiters` |
| Pump estimate | `estimatedLitres,volumeSource` |

Legacy records may omit current fields; there is no migration.

### Water ledger record

`WaterLogEntry` contains:

- UUID
- `farmId`
- `zoneId`
- kind `spray|irrigation`
- mode string
- pulse count and pulse seconds
- nullable estimated liters
- source label
- status `queued|completed`
- timestamp

Current code never updates irrigation entries to completed. Spray feedback completes the spray record but also does not update the matching water-ledger record, so `byStatus` can remain queued indefinitely.

### Activity record

Minimal `{type:"spray"|"alert"|"water",zoneId,timestamp}`. No ID, actor, farm ID, command ID, or detail payload.

### `zoneHistory`

The DB shape reserves it, but live histories use the `zoneHistory` process-global array in `zones/data.ts`. Current `db.json` has no entries and no route persists new in-memory history there.

## 10.3 Relationships

Logical, unenforced relationships:

```text
detection.zoneId -> zone.id
spray.zoneId -> zone.id
spray.detectionId -> detection.id
detection.linkedSprayId -> spray.id
waterLog.zoneId -> zone.id
waterLog.farmId -> session/user-derived identifier
activityLog.zoneId -> zone.id
```

There are no foreign keys. Reset and legacy data can leave orphan references.

## 10.4 Queries

Queries are ordinary in-memory array operations after reading the entire file:

- `find` for IDs
- `filter` for status/zone/mode
- `map` for view projections
- `sort` for chronology
- `reduce` for totals/combined risk
- `Set` for unique zones

Every read parses the whole JSON document; every write serializes and replaces the whole document.

## 10.5 Retention and archives

On `writeDB`, detections, sprays, activities, and water entries are capped at 5,000 each. Oldest array elements are removed and written to timestamped per-type files under `app/data/archive/`. `zoneHistory` is uncapped. Archive writes and main writes are not atomic as a unit.

## 10.6 Concurrency and recovery

Weaknesses:

- sync filesystem calls block the event loop
- no file lock
- read-modify-write races lose updates
- no temporary-file + atomic rename
- any read/JSON parse error causes `readDB` to overwrite the database with empty arrays
- two server processes can diverge
- serverless/read-only filesystems break writes

# 11. ESP32 Integration

## 11.1 What is actually implemented

The repository contains the PC-side bridge and server-side protocol. **ESP32/Arduino firmware is not implemented.**

README claims about two relays, a servo, fixed angles, returning home, and exact pump driving cannot be verified from source. Treat them as hardware documentation claims.

## 11.2 Communication protocol

### Serial input expected by bridge

A newline-delimited JSON object containing some of:

```json
{
  "zone1": 38,
  "zone2": 22,
  "zone3": 72,
  "temperature": 28,
  "humidity": 69
}
```

Hard-coded mapping:

- `zone1` -> A1
- `zone2` -> A2
- `zone3` -> A3

No A4 mapping exists.

### HTTP bridge

For each zone key, the bridge posts:

```json
{
  "zoneId": "A1",
  "soilMoisture": 38,
  "temperature": 28,
  "humidity": 69
}
```

to `http://localhost:3000/api/sensor` with a two-second timeout.

### Serial output

When the HTTP status is 200 and `command` is non-null:

```text
WATER:A1\n
SPRAY:A1\n
STOP:A1\n
```

The bridge uppercases the server’s lower-case command.

## 11.3 Sensor readings

Server validation:

- soil moisture 0–100
- temperature −20°C to 70°C
- humidity 0–100%

The DHT reading is farm-wide. The median of up to five samples is used. Moisture stays per-zone.

Sensor-stuck detection considers change `<=0.5` percentage point unchanged and raises error after 30 minutes. Because the server receives readings only on bridge posts and state is process/disk mixed, detection timing depends on continued telemetry.

## 11.4 Pump automation

The Next app queues one command. For irrigation, the requested pulse count is described as an estimate; server comments say the hardware owns the closed loop:

```text
3-second pulse -> read soil -> repeat -> target or maximum eight pulses
```

That loop is **not visible in firmware**, so the repository cannot verify it. The server does not enqueue eight discrete commands.

There are older `startIrrigationCycle` and `tickIrrigationCycle` functions that can alternate phases, but no scheduler calls `tickIrrigationCycle`; they are effectively dormant.

## 11.5 Relay and servo control

**Not implemented in repository source.** The bridge only emits text commands. Relay pins, active-high/low behavior, servo angles, movement timing, interlocks, and electrical failure modes are firmware responsibilities absent here.

## 11.6 Timing

- serial baud: 115200
- serial read timeout: 0.1s
- serial reconnect delay: 2s
- HTTP timeout: 2s
- pump pulse constant: 3,000ms
- estimated safety cap: 8 pulses / approximately 24 seconds
- launcher port wait: up to 45s

## 11.7 Feedback flow

The Next API supports `nozzleStatus` values `idle,pending,open,closed,clogged` through `/api/sensor` and `/api/hardware/status`.

However, `hardware_bridge.py` drops all controller fields except zone moisture, temperature, and humidity. Even if firmware emitted `nozzleStatus`, the bridge would not include it in the HTTP payload. Therefore the current bridge cannot complete a queued application through feedback. A separate caller would have to post `/api/hardware/status`, or the bridge must be extended.

## 11.8 Failure handling

Implemented:

- retry serial open forever every two seconds
- reconnect on `serial.SerialException`
- two-second HTTP timeout
- ignore invalid UTF-8 bytes
- log malformed JSON/debug serial lines
- server invalid readings enqueue/return stop and mark sensor error
- kill switch blocks new spray/hydrate API calls

Critical gaps:

- fragmented JSON across serial reads is not buffered; partial lines can be lost
- multiple JSON objects in an imperfect chunk can be mis-extracted
- bridge processes server commands only for HTTP 200
- sensor validation returns stop with HTTP 422, so the bridge logs an error and does **not** transmit the stop
- no command ACK, ID, retry, deduplication, checksum, sequence number, or durable queue
- no independent command poll when telemetry stops
- no TLS/authentication
- no graceful explicit serial close
- no A4 telemetry mapping
- no feedback forwarding

# 12. Offline Architecture

## 12.1 Why offline/local-first

Code comments target a hackathon/farm environment where Wi-Fi may fail. Local capabilities include:

- bundled model inference
- offline treatment catalogs
- local JSON persistence
- local user/password/OTP demo
- USB serial bridge
- deterministic spread/yield models
- localStorage language and Zustand state

## 12.2 What still requires network

- Open-Meteo live forecast
- Open-Meteo location search
- initial npm install and `npx kill-port` if not cached
- Vercel Analytics delivery
- any remote client reaching the host, naturally

Weather failures fall back, but location search returns 502 and suggests device location. Browser geolocation itself does not need the geocoding service but may require a secure context outside localhost.

## 12.3 Synchronization

**Server/cloud synchronization: Not implemented.**

There is no:

- remote source of truth
- sync queue
- revision/vector clock
- merge/conflict policy
- background sync
- service worker
- reconnect upload

“Shared” state means one Node process/global object plus local disk, not multi-device synchronization.

## 12.4 Local storage

| Store | Data |
|---|---|
| `app/data/db.json` | detections, sprays, activity, water |
| `data/users.json` | users |
| `app/data/farmer_profile.json` | farm onboarding/location |
| `app/data/irrigation_settings.json` | thresholds/modes |
| `app/data/farm_climate.json` | latest DHT window |
| `app/data/weather_cache.json` | last forecast |
| browser `bhoomitra_language` | language code |
| browser `smart-farm-storage` | Zustand sensor/local implementation state |
| browser sessionStorage recommendation key | five-second UI response fallback |
| process globals | OTPs, queues, current hardware/zone/simulation state |

## 12.5 Failure recovery

- Weather: fresh cache -> last-good same-location cache -> deterministic fallback.
- Flask registry: invalid/missing JSON -> hard-coded default.
- Irrigation settings: parse failure -> defaults.
- Climate cache: parse failure -> empty station.
- Users: parse failure -> empty list, not automatic repair.
- Main DB: any failure -> overwrite with empty DB, a dangerous recovery policy.
- Commands/OTP/hardware globals: lost on restart with no recovery.
- Browser state: persists until site data is cleared, but is not reconciled with server records.

## 12.6 True offline web status

**Not implemented as a PWA.** There is no manifest/service worker/cache strategy, so the web UI still needs a running Next server and previously available static assets.

# 13. Security

## 13.1 Input validation

Strengths:

- sensor numeric ranges
- farm-location coordinate/range/source validation
- phone normalization
- password minimum in OTP/new password paths
- explicit crop mismatch gate
- explicit positive label/tank values and nonnegative PHI
- enumerated feedback values
- A1-A4 actuator boundary
- kill switch

Weaknesses:

- validation is handwritten and inconsistent
- installed Zod is unused
- profile/user endpoints accept loosely typed/mass-assigned fields
- no request-size limits
- no API-wide content-type checks
- simulation flag accepts any type
- `pulses` is not capped inside `queueIrrigationPulses`
- water pH outside 0–14 becomes null instead of a validation error

## 13.2 File validation

For uploaded images:

- required presence only
- Pillow will eventually decode, but decode errors are unhandled
- no extension/MIME/magic allowlist
- no byte-size/pixel-count cap
- no decompression-bomb defense configured
- no antivirus scanning
- no filename persistence, so path traversal through filename is not present

## 13.3 Authentication

Passwords can be bcrypt cost 10, which is the strongest implemented auth element. The session is a base64-encoded JSON object with no signature, encryption, server session, expiry enforcement, issuer, or audience. Anyone able to set a cookie can forge ID/role/permissions.

Middleware checks only cookie presence and unlock value, not token integrity or live account state. `/api/auth/me` does reread live status, but most APIs never call it.

## 13.4 Authorization

- Dashboard page routes: cookie/unlock navigation gate.
- Users API: role from forgeable cookie.
- Most farm, ML, profile, reset, hardware, spray, sensor, and reporting endpoints: **no auth**.
- Permission arrays: displayed/stored but not enforced.
- Farm ID: session ID stamping, not access control.

## 13.5 OTP

Demo-only weaknesses:

- `Math.random`, not cryptographic RNG
- OTP returned in response
- no per-phone/IP rate limiting
- in-memory and single-process
- no SMS provider
- five attempts and five-minute TTL are implemented

## 13.6 CSRF and cookies

Cookies are `httpOnly`; `secure` only in production. Auth uses `sameSite:"strict"` and unlock uses `lax`. There is no explicit CSRF token or Origin validation. SameSite helps browser cross-site requests, but unauthenticated mutation endpoints make CSRF only part of the problem.

The auth cookie has no `maxAge`/`expires`, so it is a browser-session cookie. The embedded `iat` is not validated.

## 13.7 CORS and transport

- Flask CORS is globally permissive.
- HTTP defaults are plaintext.
- serial protocol is unauthenticated.
- no mTLS/API token between Next and Flask.
- no auth between bridge and Next.

## 13.8 Rate limiting

**Not implemented** for login, OTP, image prediction, location search, weather force refresh, reset, hardware, or any other endpoint.

## 13.9 Secret management

No live API key is required for Open-Meteo. `.env*` is ignored, but the code has no schema/loader. Risks:

- legacy `app/data/users.json` contains plaintext demo passwords
- primary users and farm PII are repository/workspace JSON
- model and app have no secret rotation design
- no secret-scanning setup is present

## 13.10 Logging/privacy

The sensor route logs zone and measurements. The bridge logs all raw controller JSON. Flask debug mode can show tracebacks. There is no structured redaction or retention policy.

## 13.11 Security headers and dependency safety

No explicit CSP, HSTS, Permissions-Policy, frame policy, or security middleware is configured. Python requirements are unpinned. npm has a lockfile, but no audit/enforcement workflow is in source.

## 13.12 Highest-priority fixes

1. Sign/encrypt or server-store sessions and authorize every mutation/read by live user/farm.
2. Protect hardware/reset/profile APIs and enforce roles/permissions.
3. Validate uploads and set maximum request/image sizes.
4. Disable Flask debug and restrict CORS.
5. Use cryptographic OTP plus real delivery/rate limits.
6. Add CSRF/origin protection and TLS.
7. Replace JSON/global queues with transactional storage and a durable command broker.

# 14. Performance

## 14.1 Main bottlenecks

### TensorFlow cold start

First prediction loads a 13.7 MB model and initializes TensorFlow. TensorFlow runtime memory is much larger than file size. No startup warmup exists.

### Synchronous JSON I/O

Nearly every route reads and parses full files; mutations serialize and rewrite them. Sync I/O blocks the Node event loop. Retention allows large 5,000-record arrays.

### Spread simulation

One simulation costs roughly:

```text
runs × days × infected nodes × neighbor checks
```

Defaults are 350 runs and five days. Greedy selection runs simulations for every remaining candidate for each budget slot. With only 12 zones this is acceptable, but recommendations, farm-impact, and spread endpoints independently recompute it.

### Redundant client polling

- Farm map queue: 2s
- Smart Spray five-endpoint batch: 4s
- Dashboard four endpoints: 12s
- Farm map zones: 15s
- Farm map analytics and recommendations: 30s
- Hardware safety: 3s

Multiple open pages/users multiply full JSON reads, weather decisions, and simulations.

### Weather calls

The 30-minute cache avoids most provider requests. The disk/global cache is an effective optimization, but `force=1` and location search have no rate limits.

## 14.2 Implemented optimizations

- lazy model cache by model ID
- frozen compact MobileNetV2
- 224×224 inference
- weather cache on globalThis and disk
- five-sample DHT median bounded in memory
- activity display capped at 200 in process
- DB retention at 5,000 for four arrays
- fixed small 12-node graph
- seeded reproducibility prevents UI jitter for identical snapshots
- parallel `Promise.all` in several composite pages/routes
- Next route declared force-dynamic where live data must not be prerendered
- dashboard page prefetching

## 14.3 Caching

| Item | Cache |
|---|---|
| Keras models | Python process dictionary, no expiry |
| Registry | Python module globals, no reload |
| Weather | Node global + JSON disk, 30-minute TTL/last-good |
| Farm climate | Node global + disk, five samples |
| Recommendations UI | sessionStorage fallback, five-second freshness |
| Zustand | localStorage persistent |
| Next images | optimization disabled |
| Prediction results | **Not cached** |
| Spread results | **Not cached** |

## 14.4 Memory usage

- Each Flask worker would hold a TensorFlow runtime and its own model.
- Node globals retain zones, queues, OTPs, histories, and caches.
- `MODEL_CACHE` has no eviction if future registry models are used.
- JSON read operations allocate complete object graphs.
- Browser polling creates repeated response allocations.

## 14.5 Model-loading optimization

Current: lazy and cached.

Potential improvements:

- `load_model(..., compile=False)` for inference
- explicit startup warmup/readiness
- single-flight lock around first load
- one carefully sized inference worker pool
- TensorFlow Lite/ONNX benchmark
- reject oversized images before decode
- `verbose=0` on predict

None of those improvements is implemented.

## 14.6 Consistency vs performance

Moving state to `globalThis` reduces dev bundle divergence but does not solve multi-process consistency. Caching stale data can be safe only because the decision engine checks age/fallback source. JSON sync storage favors demo simplicity over throughput.

# 15. Error Handling

## 15.1 Centralized error layer

**Not implemented.** Each route handles errors independently.

## 15.2 Flask handled exceptions

| Location | Handled condition | Result |
|---|---|---|
| `load_model_registry` | any file/JSON/schema exception | silent default registry |
| `load_class_names_for_model` | label-file read/parse exception | eventually `ValueError` |
| `/predict` | missing file | 400 JSON |
| `/predict` | unknown model `KeyError` | 404 JSON |
| `/predict` | disabled model `ValueError` | 409 JSON |
| `/predict` | model path/label config errors | 500 JSON |
| `/predict` | output winner outside labels | 500 JSON |

Uncaught Flask exceptions include Pillow decode/decompression errors, TensorFlow load/predict errors, bad registry `input_size` during module import, no enabled models `RuntimeError`, unexpected array shapes, and serialization failures. With debug mode, these become Werkzeug 500 behavior rather than the API’s JSON schema.

## 15.3 Next storage/config catches

| Module | Behavior |
|---|---|
| `database.readDB` | catches everything, overwrites empty DB |
| `usersStore.readUsers` | catches everything, returns empty users |
| farmer profile helpers | route catches read/parse/write/unlink |
| irrigation settings read | catches and returns defaults |
| farm climate read | catches and returns null |
| weather location/cache read | catches and returns default/null |
| weather cache write | catches and ignores disk failure |
| session decode | catches and returns null |
| farm ID outside request | catches cookie-context error, uses default |

## 15.4 Route-level catches

Routes with broad try/catch and generic results:

- hardware detection
- farmer-profile CRUD
- location search
- auth login/guest/OTP/me
- account updates
- users CRUD
- hardware status POST
- zones profile POST
- weather forecast

Routes without a surrounding catch:

- zones
- sensor
- hydrate
- irrigation settings
- simulation
- spray
- recommendations
- analytics
- trends
- activity
- history
- farm impact
- water summary
- spray window
- spread control
- reset

In uncaught routes, malformed JSON, filesystem failure, or unexpected downstream errors produce framework 500 responses.

## 15.5 Hardware-specific errors

- Invalid telemetry marks the sensor error and returns 422/stop.
- Stuck sensor can enqueue stop.
- Kill switch returns 423 for new hydrate/spray actions.
- Crop/pilot/weather/lifecycle conflicts generally return 409.
- Clogged feedback puts cycle state in `error`.
- The bridge retries serial connection.

But the current bridge ignores non-200 response bodies, so the 422 stop does not reach the board.

## 15.6 Client error handling

- Detection: catch + toast + error message.
- Smart Spray: toast, retains page.
- Map: logs fetch failures; many states remain stale.
- Dashboard: shows reconnect notice while retaining previous state.
- Recommendations: abort timeout/sessionStorage fallback.
- History: no catch; can remain loading indefinitely.
- Weather strip/spray timeline: local fallback/error UI.
- User/account: display toast/messages and redirect on auth errors.

## 15.7 Error-response consistency

There is no common envelope:

- `{error: "..."}`
- `{message: "..."}`
- `{success:false,message:"..."}`
- raw arrays
- full decision objects

Status semantics are also collapsed by the Next-to-Flask proxy. A production design should preserve safe upstream error codes and attach a request/correlation ID.

# 16. Deployment

## 16.1 Supported local development deployment

### Prerequisites

- Windows is assumed by scripts (`cmd`, `start`, `COM5`, PowerShell paths).
- Node/npm compatible with Next 14. No Node engine is pinned.
- Python version supported by the chosen TensorFlow build.

### Install frontend

```powershell
npm ci
```

`npm ci` uses lockfile version 3. `npm run dev` first runs `npx kill-port 3000`; `kill-port` is not a declared dependency, so `npx` may require network/cache.

### Install ML service

```powershell
python -m venv ml_service\venv
ml_service\venv\Scripts\python -m pip install -r ml_service\requirements.txt
```

### Start processes manually

Terminal 1:

```powershell
ml_service\venv\Scripts\python ml_service\main.py
```

Terminal 2:

```powershell
npm run dev
```

Then open `http://localhost:3000`. Middleware redirects `/` to `/login`.

### One-click launcher

```powershell
.\scripts\start-demo.ps1
```

Use `-NoBrowser` to suppress opening the browser. Set `BHOOMITRA_BACKEND_PYTHON` if Python is elsewhere.

## 16.2 Optional hardware bridge

The root has no bridge requirements file. Install undeclared runtime packages:

```powershell
python -m pip install pyserial requests
```

Edit `PORT = "COM5"` in `hardware_bridge.py` if necessary, start Next first, then:

```powershell
python hardware_bridge.py
```

## 16.3 Next production build

The source-supported commands are:

```powershell
npm ci
npm run build
npm start
```

The current tree passes `tsc --noEmit`. A production Next start still requires the separate Flask service and writable data paths.

## 16.4 Production readiness

There is no complete production deployment implementation. Before real deployment:

- replace Flask debug server with a production WSGI/ASGI setup
- bind/configure host safely
- sign sessions and secure APIs
- use a transactional database/durable queue
- store mutable state on a persistent volume
- add health/readiness probes
- configure TLS/reverse proxy
- pin Python dependencies
- centralize logs/monitoring
- handle multiple workers correctly

Vercel/serverless is a poor direct fit because:

- Flask is a separate long-lived service
- JSON files need durable writable storage
- process globals/queues need continuity
- USB serial hardware must run near the device

## 16.5 Docker deployment

**Not implemented**, so there is no exact repository-supported Docker command.

# 17. Every Dependency

## 17.1 JavaScript runtime dependencies

### Core

| Dependency | Actual use |
|---|---|
| `next` | App Router pages, route handlers, middleware, navigation, cookies, metadata |
| `react`, `react-dom` | UI runtime |
| `geist` | Root Geist Sans/Mono font variables |
| `typescript` (dev) | Strict static checking |

### Styling/build

| Dependency | Actual use/status |
|---|---|
| `tailwindcss`, `@tailwindcss/postcss`, `postcss` | Tailwind 4 compilation |
| `tw-animate-css` | Imported by active global CSS |
| `tailwind-merge` + `clsx` | `cn()` class conflict/conditional merge |
| `class-variance-authority` | variant classes for controls |
| `autoprefixer` | installed, not explicitly present in PostCSS plugins |
| `tailwindcss-animate` | installed; active CSS uses `tw-animate-css` instead |

### UI primitives

Each installed `@radix-ui/react-*` package backs its same-named wrapper:

- accordion
- alert-dialog
- aspect-ratio
- avatar
- checkbox
- collapsible
- context-menu
- dialog
- dropdown-menu
- hover-card
- label
- menubar
- navigation-menu
- popover
- progress
- radio-group
- scroll-area
- select
- separator
- slider
- slot
- switch
- tabs
- toast
- toggle
- toggle-group
- tooltip

Not every wrapper is rendered by a current page, but the wrapper source imports the corresponding package.

Other UI dependencies:

| Dependency | Use |
|---|---|
| `lucide-react` | icons throughout |
| `sonner` | active toast notifications/root toaster |
| `cmdk` | command palette wrapper |
| `vaul` | drawer wrapper |
| `embla-carousel-react` | carousel wrapper |
| `react-resizable-panels` | resizable wrapper |
| `react-day-picker`, `date-fns` | calendar wrapper |
| `input-otp` | OTP input wrapper |
| `recharts` | chart wrapper; limited current direct feature use |
| `next-themes` | theme and Sonner wrapper support; custom ThemeProvider is not mounted |

### Forms/validation

| Dependency | Use/status |
|---|---|
| `react-hook-form` | generic form wrapper |
| `@hookform/resolvers` | installed but no current import found |
| `zod` | installed but no current import found; APIs do not use schema validation |

### State/auth/analytics

| Dependency | Use |
|---|---|
| `zustand` | persisted browser farm store |
| `bcryptjs` | password hashing/comparison/migration |
| `@vercel/analytics` | root analytics component |

### Type packages

`@types/node`, `@types/react`, and `@types/react-dom` provide development-time declarations only.

## 17.2 Python ML dependencies

| Package | Why installed |
|---|---|
| `flask` | HTTP server, request parsing, JSON responses, routing |
| `flask-cors` | global CORS |
| `tensorflow` | Keras model load/inference and MobileNet preprocessing |
| `numpy` | image array and prediction operations |
| `pillow` | image decoding/conversion/resize |

All are unpinned, reducing reproducibility.

## 17.3 Hardware bridge dependencies

| Import | Source |
|---|---|
| `serial` | PySerial, third-party, not declared in requirements |
| `requests` | third-party, not declared in requirements |
| `json`, `time` | Python standard library |

## 17.4 Node/Python standard libraries

- Node `fs`: sync JSON persistence
- Node `path`: process-relative file paths
- Node/Next `crypto.randomUUID`: record IDs through the runtime global
- Python `os`: model paths
- Python `json`: registry/serial JSON

## 17.5 Missing production dependencies

- WSGI server: **Not installed**
- database client/ORM: **Not installed**
- queue/MQTT client: **Not installed**
- rate limiter: **Not installed**
- signed-session/JWT framework: **Not installed**
- test runner: no authored test framework/config despite optional transitive references

# 18. Interview Questions

## Architecture and design

### 1. What is Bhoomitra’s actual architecture?

- **Question:** Describe the executable architecture and its boundaries.
- **Ideal answer:** It is a Next.js 14 App Router application that also owns the domain APIs, a separate Flask/TensorFlow inference service on port 5000, synchronous JSON persistence plus Node process globals, Open-Meteo clients, and a Python serial bridge between `/api/sensor` and a USB controller. The active prediction path is browser -> Next `/api/hardwareDetect` -> Flask `/predict` -> Next safety/persistence -> browser.
- **Why interviewer asks it:** Tests whether the candidate can distinguish architecture from marketing copy.
- **Possible follow-ups:** Why not call Flask from the browser? Which state is durable? Which components cannot scale horizontally?

### 2. Why is `/api/hardwareDetect` more than a proxy?

- **Question:** What domain work happens after Flask responds?
- **Ideal answer:** It stabilizes the canonical label, checks healthy/low-confidence status, compares selected crop with model crop, derives confidence-based severity, selects offline treatment, suppresses unsafe recommendations, resolves prior diagnoses, persists a detection, updates live zone state, and returns a farmer-facing notice.
- **Why interviewer asks it:** Identifies the backend-for-frontend safety boundary.
- **Possible follow-ups:** Which operations belong in Flask? How would you split this into services without duplicating rules?

### 3. What state is stored in process globals?

- **Question:** Name the major volatile globals and their consequence.
- **Ideal answer:** Zones, zone histories, command queues, simulation flag, hardware state, OTP store, weather cache, irrigation settings reference, climate samples, and activity mirror are global. They survive some development reloads in one process but disappear on restart and diverge across workers/instances.
- **Why interviewer asks it:** Evaluates deployment and consistency awareness.
- **Possible follow-ups:** What would move to Redis? What must be transactional?

### 4. Why are there two farm-profile APIs?

- **Question:** Contrast `/api/farmer-profile` and `/api/zones/profile`.
- **Ideal answer:** The first is the persistent onboarding profile with farmer, crop, zone names, sensor assignments, and validated location. The second is a legacy in-memory computed acreage/zone-size geometry object. Its calculated `totalZones` can disagree with the hard-coded 12 live zones.
- **Why interviewer asks it:** Tests codebase archaeology and duplicated-domain detection.
- **Possible follow-ups:** How would you consolidate them? Which endpoint does the map use?

### 5. Why is the map fixed to 12 zones?

- **Question:** How do acreage and zone count interact?
- **Ideal answer:** Current product/hardware code hard-codes A1-A6/B1-B6. Acreage affects plant-density estimates but not zone IDs/count. `buildFarmProfile` still calculates a dynamic total, but `generateZones` ignores it and returns 12.
- **Why interviewer asks it:** Looks for hidden contradictory logic.
- **Possible follow-ups:** Why only A1-A4 for control? Why does the bridge still support only A1-A3?

### 6. Is the system really multi-tenant?

- **Question:** Explain `farmId` and isolation.
- **Ideal answer:** No. `getCurrentFarmId` stamps session ID or `default-farm` on newer water/spray records, and water aggregation filters by that ID. Other records and APIs are global, most endpoints are unauthenticated, and a session ID is not a farm entity or access boundary.
- **Why interviewer asks it:** Prevents overclaiming a future seam.
- **Possible follow-ups:** What tables and authorization checks would real multi-tenancy require?

### 7. What is the role of `globalThis` in weather/state code?

- **Question:** Why not use simple module variables?
- **Ideal answer:** Next development can create multiple module instances/bundles. Storing selected state on the global object makes routes in one Node process see the same cache/state and survive hot reload. It does not share across OS processes.
- **Why interviewer asks it:** Tests framework runtime understanding.
- **Possible follow-ups:** How does serverless change this? What is a durable alternative?

### 8. Which documentation is stale?

- **Question:** Give concrete source/document mismatches.
- **Ideal answer:** README describes 10m-on/50m-off cycles and global hydrate, while current timing is one 3s command and global hydrate returns 410. Spread guide describes deleted simulate/optimize BFS endpoints; current route is Monte Carlo. Clinical/about pages claim conflicting dataset counts and unsupported accuracy.
- **Why interviewer asks it:** Measures evidence discipline.
- **Possible follow-ups:** How would you keep docs executable? Would you add contract tests or generated API docs?

### 9. What architectural safety principle prevents auto-spraying?

- **Question:** Trace the separation between diagnosis and actuation.
- **Ideal answer:** A prediction only writes a detection/recommendation. Chemical actuation requires a separate `/api/spray` request with an active linked detection, crop match, product/rate/water/tank/PHI confirmation, weather/VPD clearance, A1-A4 zone, kill switch off, and later controller-closed feedback.
- **Why interviewer asks it:** Evaluates safety-critical workflow design.
- **Possible follow-ups:** Which checks are client-only versus server-enforced? Where does the flow still fail?

### 10. What does “queued” mean?

- **Question:** Why not count a successful POST as delivered?
- **Ideal answer:** It records intent and puts a command in an in-memory queue. A spray is completed only when matched controller feedback says `closed`; then the linked detection can become treated. This avoids reporting a request as a physical action.
- **Why interviewer asks it:** Tests distributed-systems lifecycle thinking.
- **Possible follow-ups:** How would you represent dispatched/acknowledged/failed/time-out states?

### 11. What is the active frontend composition?

- **Question:** Which old components are no longer active?
- **Ideal answer:** Current pages use `FarmMap`, `SmartSprayWorkbench`, `LivingFarmHero`, `Recommendations`, and `AnalyticsReports`. `ZoneDetails`, `SprayingControls`, `SpreadControlWorkbench`, `MultilingualExample`, and `ThemeProvider` are not imported by active pages. Legacy automation state is still mounted.
- **Why interviewer asks it:** Checks ability to identify dead code rather than infer features from filenames.
- **Possible follow-ups:** What risks does dead code create? How would bundle analysis confirm reachability?

### 12. Why does the project use a Next BFF plus Flask?

- **Question:** State benefits and costs.
- **Ideal answer:** Python owns TensorFlow/Pillow inference; Next owns farm context, persistence, treatment and safety logic, giving the browser a same-origin API. Costs are two deployments, an extra image hop, duplicated configuration, upstream error collapse, and service availability coupling.
- **Why interviewer asks it:** Tests boundary trade-offs.
- **Possible follow-ups:** When would FastAPI replace both? How would object storage or streaming change uploads?

## Flask and ML

### 13. Is there an `app.py` or application factory?

- **Question:** Describe Flask initialization.
- **Ideal answer:** No `app.py` and no factory. `main.py` creates globals, loads registry metadata at import, constructs `Flask(__name__)`, applies global CORS, registers three decorator routes, and runs debug port 5000 when executed.
- **Why interviewer asks it:** Verifies the candidate actually inspected the service.
- **Possible follow-ups:** How would an app factory help testing/config?

### 14. How is the model selected?

- **Question:** Give the exact precedence.
- **Ideal answer:** Explicit model ID must be registered/enabled; otherwise first enabled crop-tag match; otherwise configured enabled default; otherwise first enabled; otherwise runtime error. Only the general model is enabled now.
- **Why interviewer asks it:** Tests registry and error-path understanding.
- **Possible follow-ups:** Is matching exact? When does a substring cause an unintended selection?

### 15. When is the model loaded?

- **Question:** Explain cold start and cache.
- **Ideal answer:** Registry loads at module import, but the TensorFlow model loads lazily on first request through `load_model_for_config`. It is cached by model ID in a process dictionary. Each worker would load its own copy.
- **Why interviewer asks it:** Evaluates latency/memory reasoning.
- **Possible follow-ups:** How would you warm it? Is the first-load cache thread-safe?

### 16. What exactly happens to an image before inference?

- **Question:** List transformations and shapes.
- **Ideal answer:** Pillow opens stream, converts RGB, resizes directly to 224×224, NumPy creates `(224,224,3)`, batch expansion creates `(1,224,224,3)`, MobileNetV2 preprocessing scales to roughly −1..1.
- **Why interviewer asks it:** Checks precise ML serving knowledge.
- **Possible follow-ups:** What happens to aspect ratio? What about EXIF and alpha?

### 17. Why can arbitrary files be dangerous here?

- **Question:** What upload defenses are missing?
- **Ideal answer:** No byte/pixel/MIME/magic limit exists. Pillow is the first real decoder and its errors are unhandled. Oversized/decompression-bomb images can consume memory/CPU; invalid data produces inconsistent 500 responses.
- **Why interviewer asks it:** Connects ML endpoints to security.
- **Possible follow-ups:** Where would `MAX_CONTENT_LENGTH` go? How would you validate magic and dimensions?

### 18. What is the model architecture?

- **Question:** State it from inspected metadata.
- **Ideal answer:** Keras Functional MobileNetV2-style frozen backbone, 224×224×3 input, global average pool, dropout .35, Dense 256 ReLU, dropout .25, Dense 38 softmax. About 2.596M model parameters, 337,702 trainable.
- **Why interviewer asks it:** Requires artifact-backed rather than generic explanation.
- **Possible follow-ups:** Why global pooling? Calculate head parameters.

### 19. Why MobileNetV2?

- **Question:** What can and cannot be claimed?
- **Ideal answer:** Code supports a compact frozen depthwise/inverted-residual backbone and small artifact suited to local inference. No benchmark or architecture comparison exists, so I cannot claim it was empirically best.
- **Why interviewer asks it:** Tests technical judgment and honesty.
- **Possible follow-ups:** How would you benchmark against EfficientNet/TFLite?

### 20. Where is EfficientNet?

- **Question:** Explain its project status.
- **Ideal answer:** Not implemented or referenced. Adding it needs a model artifact, preprocessing entry, labels, registry entry, and target-hardware evaluation.
- **Why interviewer asks it:** Detects invented implementation details.
- **Possible follow-ups:** How does EfficientNet’s scaling differ? How would registry design accommodate it?

### 21. What training information is verifiable?

- **Question:** Separate artifact facts from claims.
- **Ideal answer:** Verifiable: final architecture, frozen/trainable flags, categorical crossentropy, Adam around 1e-4, accuracy metric definition, and optimizer config. Batch size, epochs, splits, augmentation, scheduler, and achieved metrics are absent.
- **Why interviewer asks it:** Assesses ML reproducibility literacy.
- **Possible follow-ups:** What model card fields are missing?

### 22. Is 92–95% validation accuracy verified?

- **Question:** Can the clinical-page number be cited?
- **Ideal answer:** No. It is static UI copy with no run history/evaluation artifact. The compile config naming `accuracy` is not a measured result.
- **Why interviewer asks it:** Tests whether candidate confuses metric configuration with metric value.
- **Possible follow-ups:** What evaluation would be needed for field images?

### 23. Is the dataset 50,000 or 175,000 images?

- **Question:** Resolve conflicting UI claims.
- **Ideal answer:** Source cannot resolve it. Two pages conflict and no dataset manifest exists. The labels are PlantVillage-style and README claims PlantVillage, but exact counts/provenance are unverified.
- **Why interviewer asks it:** Tests source-of-truth discipline.
- **Possible follow-ups:** How would DVC or a data manifest help?

### 24. How is “confidence” computed?

- **Question:** Is it calibrated?
- **Ideal answer:** It is the maximum softmax probability. No calibration, entropy/OOD test, ensemble, or uncertainty method exists. The app applies a 0.65 business gate.
- **Why interviewer asks it:** Tests understanding that softmax is not guaranteed probability calibration.
- **Possible follow-ups:** Temperature scaling? Expected calibration error? OOD detection?

### 25. How is severity calculated?

- **Question:** Is lesion severity measured?
- **Ideal answer:** No. Healthy maps to score 0; otherwise confidence >.75 high/3, >.45 moderate/2, else low/1. It is a confidence heuristic, not lesion-area disease severity.
- **Why interviewer asks it:** Prevents misleading agronomic claims.
- **Possible follow-ups:** How would segmentation estimate lesion severity? Should confidence and severity be separate?

### 26. What if output dimension and labels differ?

- **Question:** Evaluate current validation.
- **Ideal answer:** Code only checks whether the winning index is below label length. A longer output with a winner in range or extra labels could pass. It should require `predictions.shape[-1] == len(class_names)`.
- **Why interviewer asks it:** Looks for subtle inference-contract bugs.
- **Possible follow-ups:** Where should the check happen—startup or request?

### 27. How are top-three predictions formed?

- **Question:** Describe ordering and limits.
- **Ideal answer:** `argsort`, last `min(3, prediction length, label length)` indices, reversed descending; each returns translated disease, English/canonical suffix, and float probability.
- **Why interviewer asks it:** Tests array handling and response semantics.
- **Possible follow-ups:** How do ties behave? Should probabilities sum to one after truncation?

### 28. What is wrong with some disease translations?

- **Question:** Explain translation matching.
- **Ideal answer:** Only 21 suffix keys exist. Exact then bidirectional substring matching is used. Punctuation differences such as `Esca_(Black_Measles)` versus `Esca_Black_Measles` can miss and fall back to canonical English.
- **Why interviewer asks it:** Tests string-normalization and localization edge cases.
- **Possible follow-ups:** How would you key translations by class ID?

### 29. Why might `compile=False` be useful on load?

- **Question:** What does current `load_model` restore unnecessarily?
- **Ideal answer:** It restores categorical loss, Adam, metric, and optimizer slots even though service only predicts. `compile=False` can reduce coupling/loading overhead; benchmark before changing.
- **Why interviewer asks it:** Tests Keras serving optimization.
- **Possible follow-ups:** When would compile state still be needed?

### 30. Is MLflow used?

- **Question:** What experiment lineage exists?
- **Ideal answer:** None. No dependency/API/artifact exists. Registry JSON is manually maintained and is not MLflow. Model metadata gives Keras version/date but not run/dataset lineage.
- **Why interviewer asks it:** Enforces the “do not invent” requirement.
- **Possible follow-ups:** What would you log? How would promotion/rollback work?

## Prediction, treatment, and API behavior

### 31. What happens on a crop mismatch?

- **Question:** Trace crop-review behavior.
- **Ideal answer:** Selected and model crop are normalized alphanumerically. Mismatch marks `cropMatch:"review"`, suppresses treatment, persists an active review record, does not resolve prior diagnosis, and does not overwrite live disease state. Recommendations demand confirmation/rescan.
- **Why interviewer asks it:** Tests safety gate details.
- **Possible follow-ups:** Can a review still affect irrigation? Yes, current active-detection filter can suppress it.

### 32. What happens below 0.65 confidence?

- **Question:** Is the scan discarded?
- **Ideal answer:** No. A nonhealthy detection is still persisted active with confidence-derived low/moderate severity, but immediate primary chemical/recommendation is suppressed and notice asks for rescan/extension confirmation.
- **Why interviewer asks it:** Tests lifecycle nuance.
- **Possible follow-ups:** Why can Recommendations later reintroduce a treatment? How would you preserve the gate?

### 33. How are prior detections superseded?

- **Question:** What statuses change on a new scan?
- **Ideal answer:** A conclusive scan marks same-zone detections resolved if they are neither resolved nor treated, then appends the new result. Crop-review scans intentionally skip supersession. Healthy results themselves start resolved.
- **Why interviewer asks it:** Evaluates domain lifecycle.
- **Possible follow-ups:** Should an active low-confidence scan supersede? Should status changes be audited?

### 34. Identify a lost-update bug in scan persistence.

- **Question:** Why can the alert activity disappear?
- **Ideal answer:** `hardwareDetect` reads `db`, appends detection, then `recordActivity` independently reads/writes a newer DB. Finally `hardwareDetect` writes its older object lacking the new activity, overwriting it.
- **Why interviewer asks it:** Tests read-modify-write concurrency reasoning.
- **Possible follow-ups:** Fix with one transaction/object mutation? Atomic DB?

### 35. Why does Next collapse Flask errors?

- **Question:** What is current behavior and downside?
- **Ideal answer:** Any non-OK Flask response becomes generic Next 500. Unknown model 404 and disabled model 409 lose semantics and details. This simplifies the client but harms diagnosability and correct status handling.
- **Why interviewer asks it:** Tests service-to-service error design.
- **Possible follow-ups:** Which upstream messages are safe to preserve? How use correlation IDs?

### 36. How is treatment selected?

- **Question:** State catalog precedence.
- **Ideal answer:** Healthy returns no chemical. For disease, the Telangana catalog exact/suffix match is preferred, with crop disambiguation. Otherwise broader pesticide DB matches normalized disease; organic alternatives/fallbacks are added.
- **Why interviewer asks it:** Tests domain data routing.
- **Possible follow-ups:** Why suffix match? How handle early blight on tomato vs potato?

### 37. What does the Telangana catalog guarantee?

- **Question:** Does it give a numeric dose?
- **Ideal answer:** It covers the bundled nonhealthy classes but deliberately says use the locally registered label dose/interval/PHI. It supplies active ingredient/category/resistance/safety/cultural alternative and a verification notice, not a fabricated exact application rate.
- **Why interviewer asks it:** Evaluates safe agronomic recommendations.
- **Possible follow-ups:** How does Smart Spray obtain a numeric rate? Farmer enters it from label.

### 38. Why can cultural-only conditions not open Smart Spray?

- **Question:** Give examples and code behavior.
- **Ideal answer:** Strings matching `no curative`, `not applicable`, or `no chemical` are treated as cultural/systemic responses. Detection UI and recommendations avoid a foliar cure funnel for Esca/viral/HLB-style entries.
- **Why interviewer asks it:** Tests medical/agronomic safety semantics.
- **Possible follow-ups:** Is string matching robust enough? What typed field would improve it?

### 39. Why is `manualWithoutDetection` effectively unreachable?

- **Question:** Explain the optional-chain condition.
- **Ideal answer:** With no detection ID, `linkedDetection` is null; `linkedDetection?.status` is undefined, and `undefined !== "active"` is true, so the chemical request returns 409 before creating the record.
- **Why interviewer asks it:** Tests JavaScript semantics and branch reachability.
- **Possible follow-ups:** Should manual application be allowed? How express the intended condition?

### 40. What is required for a chemical spray?

- **Question:** Enumerate server-side gates.
- **Ideal answer:** Kill switch off, valid A1-A4 zone, confirmed tank, product/dosage/rate unit, positive numeric label rate, positive carrier and tank volume, nonnegative PHI, allowed weather or narrow explicit override, active linked non-review detection, and no duplicate queued spray.
- **Why interviewer asks it:** Tests safety completeness.
- **Possible follow-ups:** Which fields are optional metadata? How is water pH handled?

### 41. How does weather override work?

- **Question:** Can it override rain/wind/VPD?
- **Ideal answer:** Only when unified decision returns `weather_unavailable` and fresh green VPD makes `requiresWeatherOverride=true`; request must set `weatherOverride:true`. Rain, wind, or bad/stale VPD do not permit override. Current Smart Spray UI does not send override.
- **Why interviewer asks it:** Tests precise policy rather than a generic bypass.
- **Possible follow-ups:** How should override actor/reason be audited?

### 42. How are queued sprays completed?

- **Question:** Explain match conditions.
- **Ideal answer:** Feedback must be `closed`, hardware `currentAction` must be `spray`, and `lastCommand` must equal `spray:zone` after dispatch. The newest queued spray is completed; a farmer-confirmed mix treats its linked active detection and records activity.
- **Why interviewer asks it:** Tests command lifecycle.
- **Possible follow-ups:** Why newest queued? What race exists with multiple commands?

### 43. What is wrong with the water ledger lifecycle?

- **Question:** Why are delivered totals misleading?
- **Ideal answer:** Hydrate/spray POSTs write queued ledger entries, but feedback does not find/update them to completed. Spray records can complete independently. `summarizeWater.byStatus.completed` can remain zero while activity says pulses completed.
- **Why interviewer asks it:** Tests cross-model consistency.
- **Possible follow-ups:** Add command ID/link? Update atomically with feedback?

### 44. Why can `/api/spray-window` disagree with `/api/spray`?

- **Question:** Compare the gates.
- **Ideal answer:** Spray-window classifies only regional rain/wind and returns VPD separately. The action endpoint uses `decideFarmActions`, which requires current usable weather and fresh green DHT VPD. So timeline may say safe while actuation holds.
- **Why interviewer asks it:** Tests duplicated-rule detection.
- **Possible follow-ups:** How make one decision source of truth?

### 45. What does HTTP 423 mean here?

- **Question:** Which requests return it?
- **Ideal answer:** “Locked” is used when the safety kill switch is engaged for hydrate or spray. It distinguishes a safety interlock from validation/conflict.
- **Why interviewer asks it:** Tests HTTP semantics.
- **Possible follow-ups:** Should queued commands also be flushed on kill? Current code does not necessarily do that.

### 46. Why is global hydrate retired?

- **Question:** What does endpoint return?
- **Ideal answer:** Hardware supports individual A1-A4 pilot commands, so whole-farm control would overstate capability. Endpoint remains for old clients and returns 410 Gone with guidance.
- **Why interviewer asks it:** Tests honest prototype boundaries.
- **Possible follow-ups:** Why is `globalHydrateRequest` still in state? Legacy seam remains unused.

### 47. How are recommendations prioritized?

- **Question:** State sort function.
- **Ideal answer:** First by type rank urgent, important, suggestion, optimization; then descending severity weight × confidence fraction × (1 + spread leverage); then confidence.
- **Why interviewer asks it:** Tests explainability and implementation detail.
- **Possible follow-ups:** Is leverage comparable across source/target zones? How would you validate ranking?

### 48. Why can low-confidence safety be violated later?

- **Question:** Explain the cross-route inconsistency.
- **Ideal answer:** Scan route stores “No chemical required” but keeps detection active. Recommendations performs a fresh catalog lookup and may choose the organic alternative when stored chemical is the no-chemical sentinel, producing a treatment recommendation.
- **Why interviewer asks it:** Tests end-to-end policy consistency.
- **Possible follow-ups:** Store `treatmentEligible`? Centralize gate?

### 49. What does detection reset remove?

- **Question:** Is it a full farm reset?
- **Ideal answer:** It clears detections, non-water-validation spray records, disease activity, zone ML fields and disease histories. It preserves moisture, profile, irrigation, water-test sprays, water activities, and the water ledger.
- **Why interviewer asks it:** Tests destructive-scope understanding.
- **Possible follow-ups:** Which ledger entries become orphaned? Why needs server auth/confirmation?

### 50. Why is `app/api/ml/predict` not an endpoint?

- **Question:** What is that file?
- **Ideal answer:** It is extensionless static example JSON. Next App Router requires `route.ts` exporting HTTP methods. The live ML paths are `/api/hardwareDetect` and Flask `/predict`.
- **Why interviewer asks it:** Detects filename-based assumptions.
- **Possible follow-ups:** How would Next treat an unknown `/api/ml/predict` request?

## Weather, decisions, and spread

### 51. How is VPD calculated?

- **Question:** Give the formula and bands.
- **Ideal answer:** Saturation vapor pressure is `0.61078*exp(17.27*T/(T+237.3))`; VPD multiplies by `(1-RH/100)`. Red below .4 or above 2.0 kPa, green .8–1.2, orange otherwise; unavailable for invalid/stale readings.
- **Why interviewer asks it:** Tests actual domain math.
- **Possible follow-ups:** Why round to three decimals? Why treat reference climate as presentation-only?

### 52. What makes climate fresh?

- **Question:** How are DHT values smoothed and aged?
- **Ideal answer:** Valid −20..70°C and 0..100% RH samples are stored in windows of five; medians are rounded to one decimal. The latest valid timestamp must be no more than 15 minutes old.
- **Why interviewer asks it:** Evaluates sensor robustness.
- **Possible follow-ups:** Why median over mean? What about timestamp order?

### 53. When does weather defer irrigation?

- **Question:** State the exact order.
- **Ideal answer:** If moisture is safe, no irrigation. If weather unusable, soil-only start is allowed. If critical ≤25%, irrigate despite rain. Otherwise current rain -> monitor, imminent rain -> defer, else irrigate.
- **Why interviewer asks it:** Tests policy precedence.
- **Possible follow-ups:** Why put unusable-weather before critical? It still allows start but labels soil-only.

### 54. When is weather usable?

- **Question:** What sources/age pass?
- **Ideal answer:** Source must not be `fallback`; `fetchedAt` must parse; age must be ≤90 minutes. Cached last-good older than that is displayed but cannot clear decisions.
- **Why interviewer asks it:** Tests stale-data safety.
- **Possible follow-ups:** What if client/system clocks differ?

### 55. How is “imminent rain” computed?

- **Question:** Give thresholds.
- **Ideal answer:** If not already raining, inspect next three hourly records. Imminent means max rain probability at least 60% or accumulated precipitation at least 2mm. Current rain is precipitation at least .1mm or rainy WMO code.
- **Why interviewer asks it:** Requires exact domain configuration.
- **Possible follow-ups:** How does spray-window use different thresholds?

### 56. How does weather fallback work?

- **Question:** Trace cache/fallback order.
- **Ideal answer:** If farm location is unconfigured, return deterministic fallback. Otherwise use same-location cache younger than 30 minutes unless forced; try live Open-Meteo; on failure use same-location last-good cache even if old; only then deterministic fallback.
- **Why interviewer asks it:** Tests graceful degradation.
- **Possible follow-ups:** Why preserve `fetchedAt` on stale cache? How does decision engine protect against it?

### 57. Is fallback weather random?

- **Question:** How is it generated?
- **Ideal answer:** It is deterministic from current hour/index formulas: a sinusoidal temperature/humidity cycle, afternoon shower window, deterministic probabilities/precipitation/wind. It is labeled advisory fallback and not usable for spray clearance.
- **Why interviewer asks it:** Tests honesty of demo data.
- **Possible follow-ups:** Is “deterministic” fully reproducible across start time? It changes with current time.

### 58. How does disease pressure score work?

- **Question:** Explain the 0–100 weather model.
- **Ideal answer:** Average 24h humidity contributes up to 50 points, total 24h rain up to 30, and temperature band up to 20. Score bands are high ≥65, moderate ≥35, else low; driver strings explain contributions.
- **Why interviewer asks it:** Tests model explainability.
- **Possible follow-ups:** Is this learned? No, it is a hand-coded heuristic.

### 59. Is spread simulation BFS?

- **Question:** Describe the current algorithm.
- **Ideal answer:** No. It is seeded Monte Carlo over orthogonal graph edges. Each day, infected sources probabilistically infect unprotected neighbors; results average 350 runs. The old guide’s deterministic multi-source BFS is stale.
- **Why interviewer asks it:** Tests source versus docs.
- **Possible follow-ups:** What advantage does Monte Carlo add? Probabilistic outputs and environmental factors.

### 60. How is per-edge spread probability calculated?

- **Question:** Name factors and bounds.
- **Ideal answer:** Severity base .12/.08/.045 × confidence factor `.55+.45c` × environmental factor `.45+.2 humidity+.15 target wet soil+.2 rain` × temperature factor; final clamp .01–.32.
- **Why interviewer asks it:** Requires exact implementation knowledge.
- **Possible follow-ups:** Why is the minimum .01 controversial? Even adverse conditions retain transmission.

### 61. Why does dry soil not increase fungal spread?

- **Question:** How is moisture used?
- **Ideal answer:** Receiver soil moisture contributes only above 40 via a clamped wet-soil factor. Dry soil makes that term zero; farm humidity/rain can still drive spread. Comments explicitly reject inventing a dry-soil fungal uplift.
- **Why interviewer asks it:** Tests domain-rule intent.
- **Possible follow-ups:** Is soil moisture a valid proxy for leaf wetness?

### 62. How is the random simulation reproducible?

- **Question:** Explain seed generation.
- **Ideal answer:** FNV-like hash covers sorted zone IDs/moisture, active seed severity/confidence, and current weather description/humidity. A Mulberry32-like generator uses seed plus run×7919. Candidate simulations reuse the same seed for fair comparison.
- **Why interviewer asks it:** Tests reproducible simulation design.
- **Possible follow-ups:** What input changes are missing from the hash? Some weather/climate variables are not explicit.

### 63. What are articulation points used for?

- **Question:** Does the optimizer only pick articulation points?
- **Ideal answer:** Tarjan’s algorithm marks graph articulation points for explanation. The greedy optimizer evaluates all noninfected candidates; articulation status only changes rationale, not candidacy or scoring.
- **Why interviewer asks it:** Tests graph algorithm integration.
- **Possible follow-ups:** Does a 2×6 grid have many articulation points? Usually no in its connected rectangular form.

### 64. How are protection zones chosen?

- **Question:** Explain greedy marginal selection.
- **Ideal answer:** Start with baseline. For each budget slot, simulate each unchosen nonseed candidate added to current chosen set, pick maximum reduction in final expected infected, record its marginal impact, repeat. Ties use lexicographic zone ID.
- **Why interviewer asks it:** Tests optimization detail.
- **Possible follow-ups:** Is greedy globally optimal? Not guaranteed. Complexity?

### 65. What does “protected” mean in the model?

- **Question:** Is treatment efficacy simulated?
- **Ideal answer:** A protected zone is blocked as a transmission target. Existing seed zones cannot be candidates and remain infected. No partial efficacy, treatment delay, resistance, dose, or reinfection is modeled.
- **Why interviewer asks it:** Prevents overinterpreting projections.
- **Possible follow-ups:** How would probabilistic treatment efficacy change simulation?

## Hardware and irrigation

### 66. How does a hardware command leave the queue?

- **Question:** What triggers dispatch?
- **Ideal answer:** Only an incoming `/api/sensor` request for that zone shifts one pending command. `markCommandDispatched` then updates active hardware and zone cycle state; simply posting hydrate/spray does not remove it.
- **Why interviewer asks it:** Tests polling architecture.
- **Possible follow-ups:** What happens with no sensor traffic? The command waits indefinitely.

### 67. Why is A4 a gap?

- **Question:** Compare server and bridge capabilities.
- **Ideal answer:** Server allows control on A1-A4, but bridge maps only `zone1..zone3` to A1-A3. Without another sensor/poll path, A4’s queued command cannot be retrieved by current bridge.
- **Why interviewer asks it:** Tests end-to-end integration, not isolated modules.
- **Possible follow-ups:** Add `zone4` mapping or a dedicated command poll?

### 68. Why is the 422 stop safety bug serious?

- **Question:** Trace invalid sensor data.
- **Ideal answer:** Server returns HTTP 422 with `command:"stop"`. Bridge only parses JSON/commands for status 200; on 422 it logs “Forward Error” and sends nothing. The intended safety stop never reaches firmware.
- **Why interviewer asks it:** Finds a cross-boundary status bug.
- **Possible follow-ups:** Return 200 with validation status, or parse command on any JSON response?

### 69. How can serial fragmentation lose data?

- **Question:** What framing state is missing?
- **Ideal answer:** Bridge reads currently available bytes and splits that chunk by newline without retaining an incomplete trailing fragment. If JSON arrives across reads, neither fragment may contain both braces and the message is lost.
- **Why interviewer asks it:** Tests streaming-protocol fundamentals.
- **Possible follow-ups:** Implement a persistent byte buffer and newline framing.

### 70. Does the bridge forward controller feedback?

- **Question:** Can `closed` complete a spray?
- **Ideal answer:** Not through current mapping. Bridge constructs payload with only zone, moisture, temperature, humidity. It ignores nozzle/path/message fields in raw JSON. Completion needs another caller or bridge changes.
- **Why interviewer asks it:** Tests lifecycle feasibility.
- **Possible follow-ups:** Add command IDs and feedback fields?

### 71. Where is relay/servo logic?

- **Question:** Can you name pins and angles?
- **Ideal answer:** No. Firmware is absent, so relay pins, servo angles, pulse loop, interlocks, and return-home behavior are not source-verifiable. README claims cannot substitute for firmware.
- **Why interviewer asks it:** Enforces non-invention.
- **Possible follow-ups:** What firmware state machine would you design?

### 72. What is the pulse volume?

- **Question:** Is 1.5 L measured?
- **Ideal answer:** Flow model computes 30 L/min × 3/60 min = 1.5 L, labeled conservative estimate. `PUMP_CALIBRATED=false` says actual rig delivery is not measured. It must not be represented as metered.
- **Why interviewer asks it:** Tests measurement honesty.
- **Possible follow-ups:** Why do modules disagree on `FLOW_CALIBRATED`? How calibrate with a jug/flow meter?

### 73. How are irrigation pulses estimated?

- **Question:** State the deficit formula.
- **Ideal answer:** `deficit=max(0,dryThreshold-moisture)`; zero gives 0, otherwise `ceil(deficit/7)` clamped 1–8. The API queues one command and reports this estimate.
- **Why interviewer asks it:** Tests exact control math.
- **Possible follow-ups:** Why does queue function itself not cap a caller-supplied estimate?

### 74. Is `singlePumpMode` enforced?

- **Question:** Can simultaneous zone commands be queued?
- **Ideal answer:** No enforcement uses the setting. Separate zone arrays can contain commands and APIs do not implement a global mutex, despite one physical-pump assumptions.
- **Why interviewer asks it:** Identifies configuration theater.
- **Possible follow-ups:** Where should a pump lease/lock live?

### 75. Are old timed-cycle functions active?

- **Question:** What calls `tickIrrigationCycle`?
- **Ideal answer:** Nothing. The functions remain from older on/off cycle design, but no interval/scheduler invokes them. Current queue path sends one water command and expects hardware loop ownership.
- **Why interviewer asks it:** Tests dead-path identification.
- **Possible follow-ups:** Remove or test them? Why README remained stale?

### 76. How is a stuck sensor detected?

- **Question:** Give threshold and timing.
- **Ideal answer:** If change from last value is no more than `minChangePercent=.5`, preserve `unchangedSince`; after 30 minutes mark error and stop cycle. A larger change resets the timer.
- **Why interviewer asks it:** Tests sensor reliability logic.
- **Possible follow-ups:** False positives on stable wet soil? Need noise/model context.

### 77. What does the kill switch actually do?

- **Question:** Does engaging it stop hardware immediately?
- **Ideal answer:** It makes future hydrate/spray POSTs return 423 and sets current action idle through hardware-status update. It does not authenticate the caller, clear all pending queues, or independently send an immediate stop to firmware.
- **Why interviewer asks it:** Distinguishes UI state from physical fail-safe.
- **Possible follow-ups:** Why a real emergency stop should be hardware-wired?

## Persistence and consistency

### 78. Why is JSON storage unsafe under concurrency?

- **Question:** Give a concrete failure mode.
- **Ideal answer:** Two requests read the same snapshot, mutate different arrays, and each rewrites the whole file; last writer loses the other update. There is no lock/version/transaction/atomic rename.
- **Why interviewer asks it:** Tests basic data consistency.
- **Possible follow-ups:** Would SQLite be enough? How use optimistic concurrency?

### 79. What happens if `db.json` is malformed?

- **Question:** Describe recovery.
- **Ideal answer:** `readDB` catches any error, writes a brand-new empty shape to the same path, and returns it. It destroys evidence/data instead of quarantining the corrupt file.
- **Why interviewer asks it:** Tests failure-recovery risk.
- **Possible follow-ups:** Backup/rename and fail closed? Validate schema?

### 80. What is archived?

- **Question:** Explain retention.
- **Ideal answer:** When detections, sprays, activity, or water exceed 5,000 during write, oldest entries are spliced and written to timestamped per-type archive JSON. Zone history has no retention and no current persistence.
- **Why interviewer asks it:** Checks data lifecycle.
- **Possible follow-ups:** Can archive/main writes partially fail? Yes.

### 81. Are user files migrated safely?

- **Question:** How does primary/legacy selection work?
- **Ideal answer:** If `data/users.json` exists—even empty—it is authoritative. Otherwise legacy `app/data/users.json` can be read and copied. Plaintext passwords migrate to bcrypt only on successful login.
- **Why interviewer asks it:** Tests migration logic and security.
- **Possible follow-ups:** What if legacy parse fails? Empty user list.

### 82. Why can activity history duplicate events?

- **Question:** Explain `/api/history`.
- **Ideal answer:** It synthesizes an alert for every detection and spray event for every spray, then concatenates persisted activity entries that may represent the same operations. There is no event ID/deduplication.
- **Why interviewer asks it:** Tests read-model design.
- **Possible follow-ups:** Build normalized event table or projection?

### 83. Why is zone history not a true time series?

- **Question:** How are trends aligned?
- **Ideal answer:** Each zone has separate arrays capped at 20; trends average array element `i` across zones, not equal timestamps. State is in process memory and resets.
- **Why interviewer asks it:** Tests analytics validity.
- **Possible follow-ups:** Store timestamped samples and resample windows?

### 84. Why can current zone state disagree with DB?

- **Question:** How is consistency repaired?
- **Ideal answer:** Live zone globals are volatile; `/api/zones` overlays the most recent active persisted detection for display. But other mutable fields/queues/histories are not fully reconstructed, and multi-process globals can still diverge.
- **Why interviewer asks it:** Evaluates read-model hydration.
- **Possible follow-ups:** Event sourcing? Single authoritative database?

### 85. What schema migration exists for old sprays?

- **Question:** How are missing fields handled?
- **Ideal answer:** None. Code uses optional access/defaults and filters; current `db.json` can contain a queued record missing newer `farmId`/estimate fields. Schema evolution is implicit.
- **Why interviewer asks it:** Tests long-lived data compatibility.
- **Possible follow-ups:** Add versioned migration and validation?

## Authentication and security

### 86. Why is the auth token insecure?

- **Question:** What exactly is stored?
- **Ideal answer:** Base64 JSON containing ID/name/email/phone/role/permissions/iat. It is not signed, encrypted, expired, or server-validated. A caller can forge admin role.
- **Why interviewer asks it:** Core security assessment.
- **Possible follow-ups:** Signed opaque session versus JWT?

### 87. Does middleware protect APIs?

- **Question:** What paths does matcher include?
- **Ideal answer:** Only dashboard pages, login, root, and home. `/api/**` is absent, so APIs must authenticate themselves; most do not.
- **Why interviewer asks it:** Tests Next middleware scope.
- **Possible follow-ups:** Why still authorize inside route even if middleware matches?

### 88. Why is the Users API especially vulnerable?

- **Question:** How does admin gate differ from `/auth/me`?
- **Ideal answer:** It calls `getSession` and trusts cookie role instead of rereading the live user record. A forged or stale admin role passes. POST/PUT also accept broad mass-assigned fields.
- **Why interviewer asks it:** Tests authorization and mass assignment.
- **Possible follow-ups:** Use `getCurrentUser`, validate role, audit actions.

### 89. What is good about password handling?

- **Question:** Identify implemented strengths without overlooking gaps.
- **Ideal answer:** bcryptjs cost 10 hashes new/changed passwords; legacy plaintext is migrated on successful login; API responses sanitize password. Gaps include plaintext legacy file, inconsistent validation, no rate limit, and insecure sessions.
- **Why interviewer asks it:** Looks for balanced review.
- **Possible follow-ups:** Pepper? Argon2? Password policy?

### 90. Why is OTP demo-only?

- **Question:** List implementation properties.
- **Ideal answer:** Math.random code, returned as `demoOtp`, in-memory, no SMS and no rate limit. It does implement Indian phone normalization, five-minute TTL, and five attempts.
- **Why interviewer asks it:** Tests threat modeling.
- **Possible follow-ups:** Cryptographic generation, hashing OTP, provider, abuse limits?

### 91. What API can destructively erase data without auth?

- **Question:** Give examples.
- **Ideal answer:** Detection reset and farmer-profile DELETE are unauthenticated; hardware/status and irrigation/spray routes also mutate critical state. UI confirmation does not secure direct HTTP calls.
- **Why interviewer asks it:** Tests API boundary audit.
- **Possible follow-ups:** Role requirements and audit log?

### 92. Does CORS protect Flask?

- **Question:** What does `CORS(app)` do here?
- **Ideal answer:** It broadly allows cross-origin access under defaults; it is not authentication. Active Next proxy does not need that broad policy.
- **Why interviewer asks it:** Corrects common CORS misconception.
- **Possible follow-ups:** Restrict origin or bind Flask privately?

### 93. What secret management exists?

- **Question:** Are there API keys?
- **Ideal answer:** Open-Meteo needs none; `.env*` is ignored and server URLs use env variables. But there is no env schema/vault, and repository JSON contains user/farm data plus a legacy plaintext-password file.
- **Why interviewer asks it:** Tests practical configuration security.
- **Possible follow-ups:** How rotate session keys once introduced?

### 94. What rate limits exist?

- **Question:** Which endpoints are protected from abuse?
- **Ideal answer:** None—login, OTP, prediction, geocoding, force weather, reset, and hardware mutations are unlimited.
- **Why interviewer asks it:** Tests production hardening.
- **Possible follow-ups:** Per-IP/user/device policies? Distributed rate store?

### 95. What image-specific denial-of-service risks exist?

- **Question:** Explain beyond extension checks.
- **Ideal answer:** Unbounded multipart size and pixel dimensions, decompression bombs, heavy TensorFlow calls, concurrent cold loads, and no request queue/timeouts from Next to Flask.
- **Why interviewer asks it:** Tests ML API security.
- **Possible follow-ups:** Pixel limits, concurrency semaphore, reverse-proxy body cap.

## Analytics, frontend, performance, and deployment

### 96. How is current farm risk combined?

- **Question:** Explain individual and aggregate risk.
- **Ideal answer:** Individual base is .62/.38/.18 by severity, scaled by confidence and exponential 14-day freshness clamped .35–1; high has .55 floor. Aggregate is `1-product(1-risk)` and converted to percent.
- **Why interviewer asks it:** Tests exact analytics logic.
- **Possible follow-ups:** Independence assumption? Why high floor?

### 97. Which records are excluded from active risk?

- **Question:** State filters.
- **Ideal answer:** Must be status active, nonhealthy, and not crop review. Treated/resolved/healthy/review scans do not contribute.
- **Why interviewer asks it:** Tests lifecycle analytics consistency.
- **Possible follow-ups:** What about low confidence? It still contributes if active.

### 98. How is yield protected calculated?

- **Question:** Is it measured?
- **Ideal answer:** It is a labeled projection. Match a disease loss range, position within range by severity (.3/.55/.85), then for curable diseases take 75% recoverable. Noncurable entries report zero protected. Highest protectable threat becomes headline.
- **Why interviewer asks it:** Tests model/measurement distinction.
- **Possible follow-ups:** Where are cited sources? Not actually stored.

### 99. How is water saved calculated?

- **Question:** Describe targeted-vs-broadcast.
- **Ideal answer:** For live A1-A4, targeted pulses come from each moisture deficit; broadcast assumes three pulses to every pilot zone. Reference flow converts both to liters and reports difference/percent. It is a projection, not meter data.
- **Why interviewer asks it:** Tests business metric basis.
- **Possible follow-ups:** Why can targeted plan include zones weather would defer? Water summary does not call decisions.

### 100. What is the biggest spread performance cost?

- **Question:** Why does polling matter?
- **Ideal answer:** Each plan runs baseline plus many candidate Monte Carlo simulations. Recommendations, farm-impact, and spread endpoint recompute independently, while pages poll them. Small 12-zone size masks the inefficiency.
- **Why interviewer asks it:** Tests algorithm/system performance.
- **Possible follow-ups:** Snapshot-key cache, worker thread, precomputation?

### 101. What does TypeScript verification show?

- **Question:** Is the project currently type-correct?
- **Ideal answer:** In the audited working tree, local `tsc --noEmit` passes. That validates static types, not runtime contracts, concurrency, data validity, or Python.
- **Why interviewer asks it:** Tests appropriate interpretation of tooling.
- **Possible follow-ups:** What test suite exists? None.

### 102. How does localization work?

- **Question:** Explain both mechanisms.
- **Ideal answer:** Language context stores five-code choice in localStorage and typed lookup falls back to English. A MutationObserver replaces known English phrases in text nodes. Flask separately translates disease suffixes. UI and ML languages are independent.
- **Why interviewer asks it:** Tests cross-layer i18n.
- **Possible follow-ups:** Why is DOM mutation fragile? Attributes/placeholders/plurals/partial replacement.

### 103. What is risky about the runtime translator?

- **Question:** Describe algorithmic/semantic issues.
- **Ideal answer:** It stores original text in WeakMap, sorts phrases longest-first, regex-replaces exact substrings, and watches added nodes. It can translate unintended substrings, misses changed existing node values/attributes, has uneven dictionaries, and adds DOM traversal overhead.
- **Why interviewer asks it:** Tests frontend architecture.
- **Possible follow-ups:** Replace with component-level message IDs/i18next?

### 104. Why is Zustand not the system of record?

- **Question:** What does current store actually hold?
- **Ideal answer:** It persists browser sensor snapshots and local “implemented recommendation” records. Server detections/sprays are in JSON DB. Legacy detection/activity store actions are not called by the current flow.
- **Why interviewer asks it:** Tests state ownership.
- **Possible follow-ups:** How do local implemented records mislead across devices?

### 105. What is sessionStorage doing in Recommendations?

- **Question:** Is it durable offline data?
- **Ideal answer:** It stores a short-lived response fallback so UI can show recent recommendations if refresh fails; freshness is around five seconds. It is per-tab/session and not authoritative or synced.
- **Why interviewer asks it:** Tests caching semantics.
- **Possible follow-ups:** Why not stale-while-revalidate query cache?

### 106. What would fail on a multi-worker deployment?

- **Question:** Give concrete examples.
- **Ideal answer:** Commands queued on worker A may be polled on B and disappear; OTP requested on A may verify on B as not found; hardware/zone state diverges; each Flask worker loads a model; JSON writes race.
- **Why interviewer asks it:** Tests deployment reasoning.
- **Possible follow-ups:** Sticky sessions are enough? No, durable shared state is preferable.

### 107. Why is Vercel/serverless not a direct fit?

- **Question:** Despite Vercel Analytics, what breaks?
- **Ideal answer:** Route handlers synchronously mutate local files and rely on long-lived globals/queues; Flask/TensorFlow is separate; USB serial must be near hardware. Serverless instances are ephemeral and often read-only.
- **Why interviewer asks it:** Tests platform fit.
- **Possible follow-ups:** Split cloud dashboard from edge gateway?

### 108. How is the project deployed today?

- **Question:** Give only source-supported procedure.
- **Ideal answer:** Install npm and unpinned ML requirements, run Flask `main.py` on 5000 and Next dev/start on 3000, optionally use Windows `start-demo.ps1`, and separately install PySerial/Requests for bridge. No Docker/production WSGI config exists.
- **Why interviewer asks it:** Tests operational accuracy.
- **Possible follow-ups:** What does `BHOOMITRA_BACKEND_PYTHON` do? Why can `npx kill-port` hurt offline startup?

### 109. What tests exist?

- **Question:** What automated confidence is present?
- **Ideal answer:** No authored unit/integration/e2e/ML tests are present. TypeScript compilation passes, but no Python tests, endpoint contracts, model golden images, hardware simulator tests, or security tests exist.
- **Why interviewer asks it:** Tests quality assessment.
- **Possible follow-ups:** Name first five high-value tests.

### 110. What are the first three production changes you would make?

- **Question:** Prioritize rather than list everything.
- **Ideal answer:** First secure signed live-user/farm authorization on all APIs; second replace JSON/globals with transactional persistence and durable command IDs/queue; third harden inference/hardware boundaries with upload limits, production Flask serving, authenticated protocol, and reliable ACK/feedback. Then add tests/observability.
- **Why interviewer asks it:** Measures prioritization and risk judgment.
- **Possible follow-ups:** Which can be delivered without rewriting the UI? How stage data migration?

# 19. Weak Points

## 19.1 Critical correctness and safety weaknesses

### Hardware feedback cannot complete through the supplied bridge

The server supports feedback, but `hardware_bridge.py` does not forward it. Queued sprays remain queued unless another caller posts status. Improve by defining a versioned bidirectional protocol with command ID, state, error, pulse count, timestamps, and ACK.

### Invalid-sensor stop is dropped

The server returns stop in a 422 response; the bridge only processes commands on 200. Fix either side, and add an integration test proving invalid telemetry emits a physical STOP.

### Server allows A4 but bridge cannot poll A4

Add `zone4` mapping or decouple commands from zone telemetry with a controller-level queue endpoint/MQTT subscription.

### Kill switch is software state, not a physical fail-safe

Unauthenticated callers can change it; engaging it does not guarantee an immediate board stop or clear queues. A real emergency stop must fail safe in hardware, with the server state only reflecting it.

### Read-modify-write loses data

The alert activity overwrite is one concrete example. Replace sync JSON with SQLite/PostgreSQL transactions or at minimum one locked repository transaction and atomic rename.

### Water lifecycle is inconsistent

Queued ledger entries never transition to completed, so water status analytics disagree with controller activities. Give every command a durable ID and update command, application, detection, activity, and water ledger in one feedback transaction.

### Low-confidence policy is not end-to-end

Hardware detection suppresses chemicals, but Recommendations can regenerate one. Persist an explicit `diagnosisDisposition` or `treatmentEligible` field and make every downstream route honor it.

### Crop aliases force false review

Strict normalization does not map:

- `Maize` -> `Corn_(maize)`
- `Citrus` -> `Orange`
- `Pepper` -> `Pepper,_bell`

Paddy is offered but has no model class. Use a canonical crop taxonomy with aliases and restrict selections to model-supported families.

### Manual chemical branch is unreachable

Fix condition to check inactive status only when a linked detection exists, or remove `manualWithoutDetection` if policy requires a detection.

### Duplicated spray decisions disagree

`/api/spray-window` can say safe while unified action logic blocks on VPD. Generate all farmer-facing spray verdicts from `decideFarmActions`.

### Crop review can suppress irrigation

Irrigation candidate filtering checks all active detections, including review records. Use actionable detections only.

## 19.2 ML weaknesses

- No training code, dataset provenance, reproducible environment, metrics, or model card.
- Static accuracy/data claims are unsupported and contradictory.
- Softmax confidence is uncalibrated.
- No OOD/unsupported-crop rejection. Banana samples and unsupported onboarding crops demonstrate the need.
- Resize distorts aspect ratio.
- No image quality validation.
- No exact output-dimension startup assertion.
- Class-label list is hard-coded separately from artifact/version.
- No model checksum validation at load.
- Translation keys are incomplete and punctuation-sensitive.
- `model_version` is a manual JSON string, not artifact lineage.
- `load_model` restores compilation/optimizer state unnecessarily for serving.
- No warmup, readiness, inference timeout, concurrency limit, or GPU/CPU sizing.

Improvements:

- create a reproducible training/evaluation pipeline
- version data and label taxonomy
- add field-image test set and per-class metrics
- calibrate confidence and add unknown/OOD policy
- package labels/model card/checksum together
- validate image quality and dimensions
- benchmark TFLite/ONNX/other backbones on target hardware

## 19.3 Persistence/data weaknesses

- Full-file sync reads/writes block the event loop.
- Any main DB parse error destroys current DB content.
- No transactions, locks, constraints, indexes, migrations, backups, or verified restore.
- `zoneHistory` persistence field is unused.
- Archive and primary write are not atomic.
- Current/legacy spray shapes differ.
- Reset can leave water ledger records referencing deleted chemical applications/detections.
- Activity entries have no IDs and history can duplicate them.
- Session-derived farm ID is not a true farm relationship.
- Profile, runtime profile, zones, and user state are split across unrelated stores.

Improve with a versioned relational schema, migrations, foreign keys, command/event tables, transactional lifecycle updates, backups, and farm/user authorization.

## 19.4 Authentication/security weaknesses

- forgeable unsigned base64 sessions
- APIs mostly unauthenticated
- admin role trusted from stale/forgeable cookie
- permissions never enforced
- plaintext legacy credentials
- demo OTP returned to caller and generated with `Math.random`
- no rate limits
- no upload limits
- global Flask CORS
- Flask debug mode
- no TLS or service/device authentication
- no security headers/CSRF strategy
- no audit actor on hardware/data changes
- user CRUD mass assignment

## 19.5 Hardware/distributed-system weaknesses

- volatile pending queues
- telemetry-coupled command poll
- no independent delivery/ACK/retry/dead-letter/timeout
- no command ID or idempotency key
- no serial fragment buffer/checksum/protocol version
- no feedback through bridge
- no A4 mapping
- no explicit serial close
- no controller firmware
- `singlePumpMode` not enforced
- older irrigation state machine is dormant
- `lastIrrigated`/`lastSprayed` can update at dispatch rather than confirmed completion

## 19.6 Offline weaknesses

- no PWA/service worker
- no browser/API offline mutation queue
- no cloud/device synchronization
- no conflict resolution
- `npx kill-port` can require internet
- location search needs internet
- weather fallback is advisory, not a synchronized forecast
- browser-local “implemented” records can diverge from server truth

## 19.7 Performance weaknesses

- heavy first TensorFlow inference
- model duplicated per worker
- repeated Monte Carlo computation
- aggressive, overlapping polling
- no prediction/result cache
- no request backpressure
- no async DB
- Next image optimization disabled
- runtime translator walks DOM and observes additions
- 5,000-record whole-file rewrites

## 19.8 Maintainability weaknesses

- no tests
- many `any` types at persistence boundaries
- no shared runtime schema
- dead `ai-engine`, `fusion-engine`, ML log/event modules, old components, duplicate toast/mobile hooks, unused CSS
- globally mounted legacy 24-zone automation context conflicts with real 12 zones
- stale documentation and UI claims
- duplicated treatment/severity concepts
- extensionless fake API example
- missing favicon and malformed unused `icon.svg`
- VS Code launch uses wrong port 8080
- Python dependencies unpinned; bridge dependencies undeclared
- Windows-specific scripts and hard-coded COM5

## 19.9 Analytics weaknesses

- risk formula assumes independent detection risks
- severity is classifier confidence, not disease extent
- yield source citations are described but not checked in
- water “calibration” flags contradict each other
- targeted-vs-broadcast ignores live weather/ripening gates
- legacy records with undefined application status are treated as completed by `!== "queued"` filters
- time-series samples align by index, not time
- translated disease names can split grouping across languages
- projections can be rendered beside measured/configured values without a universal typed provenance system

# 20. Deep Technical Explanation

This section follows important functions in execution order. “Line by line” means each executable logical line/block is accounted for, including input, output, variables, branches, exceptions, and edge cases.

## 20.1 Flask registry functions

### `load_model_registry()`

- **Input:** none; reads module constant path.
- **Output:** dictionary with `default_model_id` and `models`.
- `os.path.exists` avoids an open attempt when absent.
- `open(..., encoding="utf-8")` and `json.load` parse the file.
- It accepts only a dictionary whose `models` value is a list.
- Every exception is swallowed.
- Invalid/absent input returns `DEFAULT_MODEL_REGISTRY`.
- **Edge:** a syntactically valid but empty model list is accepted and later causes no-enabled-model behavior.

### `normalize_entry(entry)`

- Copies the input so original registry object is not mutated.
- Stringifies/trims model ID and path.
- Defaults display name to ID and version to `1.0.0`.
- `bool(value)` controls enabled; a JSON string `"false"` would become true, although normal JSON uses boolean.
- `int(input_size)` can throw during module import and is not caught by index construction.
- Lowercases/trims nonempty crop tags.
- Normalizes inline class names and optional label path.
- Returns a loose dict, not a typed model object.

### `load_model_registry_index()`

- Loads registry.
- Iterates `models`.
- Normalizes each.
- Inserts nonempty IDs into a dictionary.
- Duplicate IDs are silently overwritten by later entries.
- Returns both raw registry and index.
- Called once at import, so runtime file edits do not reload.

## 20.2 Flask model resolution/loading

### `resolve_model_config(requested_model_id, crop_hint)`

- Normalizes optional strings.
- Explicit ID branch:
  - unknown -> `KeyError` including enabled IDs
  - disabled -> `ValueError`
  - enabled -> return immediately
- Crop branch iterates insertion order of registry.
- A model matches exact tag or either substring direction.
- It skips disabled entries.
- Default branch asks `get_default_model_id`, then verifies selected default enabled.
- Final branch returns first enabled.
- Otherwise raises `RuntimeError`.
- **Edge:** crop aliases are not normalized beyond lowercase.

### `load_model_for_config(config)`

- Reads `model_id`.
- Returns process cache hit.
- Resolves path against service directory.
- Missing path raises `FileNotFoundError`.
- `tf.keras.models.load_model` restores config/weights/compile state.
- Inserts into cache only after successful load.
- **Exceptions:** TensorFlow incompatibility/corruption errors are not converted by `/predict`.
- **Concurrency edge:** two simultaneous cold requests can both load.

### `load_class_names_for_model(config)`

- Uses nonempty inline list first.
- Uses hard-coded 38 classes for `class_names_source:"default"` or default model ID.
- Else resolves/reads JSON list.
- Label-file exceptions are swallowed.
- Missing/invalid labels raise `ValueError`.
- **Edge:** it does not compare full label count with model output at load.

## 20.3 Flask `predict()`

- `request.files.get("file")` retrieves multipart file.
- Missing -> JSON 400.
- Reads language and alias fields for model/crop.
- Language outside five codes becomes English.
- Resolves model:
  - `KeyError` -> 404
  - `ValueError` -> 409
- Loads model/labels:
  - missing file or labels -> 500 JSON
- `Image.open` decodes stream; no catch.
- `.convert("RGB")` normalizes channels.
- Registry `input_size` determines square resize.
- NumPy conversion/batch creation/preprocessing produce input tensor.
- `model.predict(...)[0]` obtains first sample vector.
- `np.argmax` selects winner.
- Only winning-index/label bound is validated.
- Class label splits on `___`; crop prefix is retained, disease suffix is canonical.
- Translation exact/partial matching creates display label.
- Confidence is winner probability.
- Top three are sorted descending.
- `jsonify` returns model metadata plus labels/crop/confidence/top3.
- **Edges:** empty/incorrect prediction shape, corrupt file, and no enabled model yield unhandled 500.

## 20.4 Next `POST /api/hardwareDetect`

- **Input:** multipart request.
- Parses form; parsing errors go to outer catch.
- Extracts required and optional values; crop is trimmed.
- Missing file/zone -> 400.
- Finds live zone; missing -> 404.
- Builds new Flask form; does not forward zone because Flask does not need it.
- Calls configured Flask URL with no explicit timeout.
- Non-OK -> generic 500; upstream body is not read.
- Parses Flask JSON.
- Defaults missing disease to `Unknown`, confidence to zero.
- Chooses canonical field before translated field.
- Healthy check normalizes canonical label.
- Low confidence is only nonhealthy `<.65`.
- Model crop comes from Flask prefix; fallback parsing canonical suffix is flawed because suffix normally lacks `___`.
- Strict crop normalization decides matched/review/not-applicable.
- Calls confidence-only severity.
- Calls treatment catalog.
- Suppresses primary chemical for low confidence/review.
- Builds a normalized recommendation object if eligible.
- Creates detection UUID and lifecycle fields.
- Reads DB.
- If conclusive, resolves older pending same-zone records.
- Appends detection.
- Calls `recordActivity`, causing a separate write.
- Writes older DB snapshot, potentially losing activity.
- Updates live zone only if conclusive.
- Always appends detection to in-memory treatment history, including reviews.
- Returns 200.
- Outer catch logs and returns generic 500.

## 20.5 `calculateSeverity` and `getTreatmentOptions`

### `calculateSeverity(confidence,disease)`

- Normalizes disease to lowercase underscores.
- Healthy substring -> low/0.
- Strict `>` .75 -> high/3.
- Strict `>` .45 -> moderate/2.
- Else low/1.
- **Boundary:** exactly .75 is moderate; exactly .45 is low.
- No clamp ensures confidence is 0–1.

### `getTreatmentOptions(disease,crop)`

- Normalizes label.
- Healthy -> empty chemicals, routine scouting text.
- Queries Telangana catalog.
- Catalog hit -> constructs one chemical-like object and one organic alternative.
- Cultural-only catalog entries still occupy `chemicals` with names like “No curative…”, so callers must detect them.
- No catalog -> filter pesticide DB nonorganic entries whose approved label contains disease suffix.
- Separately find organic matches.
- If none, returns three generic organic suggestions.
- Returns source notice.
- **Edge:** broad substring matching may match more than intended.

## 20.6 JSON repository

### `normalizeDB(data)`

- For each known key, keeps only arrays; otherwise empty.
- Drops unknown top-level properties on next write.
- Does not validate record fields.

### `readDB()`

- Reads entire UTF-8 file synchronously.
- Parses and normalizes.
- Catch covers absence, permissions, and corrupt JSON alike.
- Catch writes empty shape back synchronously.
- Returns empty shape.
- **Critical edge:** transient read failure can destroy recoverable data.

### `writeDB(data)`

- Normalizes input.
- Applies per-array retention.
- Overflow writes archive before main file.
- Main file is fully replaced with pretty JSON.
- No lock, fsync, temp file, or rename.

### `recordActivity(entry)`

- Creates type/zone/timestamp.
- Prepends to in-memory log, caps it at 200.
- Reads DB, prepends persisted item, writes.
- Updates global reference.
- **Edge:** separate transaction races callers.

## 20.7 Zone generation and climate

### `generateZones(profile,settings)`

- Reads persistent farmer profile.
- Uses its acres or runtime acres.
- Hard-codes count 12 and columns 6.
- Converts acres to square yards per zone.
- Chooses plant density divisor by crop.
- A1/A2 start warning at 38%; A3/A4 critical at 22%; remaining zones healthy at 72%.
- Sets temperature/humidity to zero until DHT data.
- Calculates initial health score using reference values, not those zero display fields.
- Creates sensor/cycle defaults and moisture grid color.
- Returns A1-A6/B1-B6.
- **Edge:** `lastSprayed` is synthesized as previous hours even without real spray; this is seed/demo state.

### `updateFarmClimate(temperature,humidity)`

- Invalid input returns current snapshot without mutation.
- Reloads disk if newer than memory.
- Pushes raw readings; trims each array to five.
- Calculates medians and one-decimal values.
- Stores raw/median/timestamp/sample count globally and on disk.
- Maps all zones to shared compatibility temperature/humidity and derived runtime.
- Returns fresh snapshot.
- **Edge:** disk write failure is not caught here and can fail sensor request.

### `getFarmClimatePresentation(climate)`

- Fresh valid DHT -> real values/source `dht11`.
- Else computes VPD from 28/69 reference and labels `reference`.
- Automation does not consume this reference.

## 20.8 `decideFarmActions`

- Builds weather context with source, age, rain, wind.
- Sets `critical` at moisture ≤25 and `needsIrrigation` below configured dry threshold.
- Irrigation branch order:
  1. no need -> block
  2. unusable weather -> allow soil-only
  3. critical -> allow despite rain
  4. raining -> monitor/block
  5. imminent -> defer/block
  6. otherwise allow
- Spray branch order:
  1. weather unusable -> block; override only if fresh green VPD
  2. rain -> block, no override
  3. wind ≥15 -> block
  4. stale/non-green VPD -> block
  5. otherwise allow
- Returns both decisions and full input context for explainability.
- **Edge:** missing/invalid current wind is converted to zero in weather context.

## 20.9 Weather service

### `fetchLive(location)`

- Builds Open-Meteo query for current and hourly variables, three forecast days, location timezone.
- Starts five-second abort timer.
- Non-OK throws.
- Always clears timer.
- Rounds current fields and maps WMO description.
- Iterates aligned hourly arrays.
- Drops more-than-one-hour past values and caps at 48.
- Computes derived values and returns source `live`.
- **Edges:** assumes provider arrays/current object exist; malformed schema throws.

### `computeDerived(current,hourly)`

- Slices first 24.
- Computes max/average humidity and total rain.
- Finds first ≥50% or ≥.2mm rain hour.
- Defines immediate spray safety from current rain, wind <15, and no next-three-hour ≥40%/.2mm.
- Searches first three-consecutive-safe window.
- Builds fungal pressure from humidity/rain/temp.
- Adds human-readable drivers.

### `getForecast(force)`

- Reads validated farm location.
- Uses coordinate key to isolate cache.
- Unconfigured -> fallback immediately.
- Fresh same-location cache -> clone and mark `cached`.
- Else fetch live, save global/disk.
- Fetch failure -> same-location last-good cache regardless age.
- No last-good -> fallback.
- **Edge:** fallback is never written as last-good, which avoids later presenting it as cached live.

## 20.10 Sensor and queue functions

### Sensor route `POST`

- Parses JSON; no outer catch.
- Logs incoming values.
- Disables simulation before zone/value validation.
- Finds zone; 404 if absent.
- Processes any nozzle feedback before numeric validation.
- Coerces three measurements with `Number`.
- Invalid -> `markSensorError` and 422 stop response.
- Valid -> updates farm climate.
- Derives moisture status and queries first active actionable disease.
- Picks worse moisture/disease status.
- Health score is `100-|60-moisture|`, clamped 40–95.
- Replaces zone fields.
- Updates stuck-sensor runtime.
- Gets forecast and decision.
- Appends/caps histories at 20.
- Shifts one queued command for this zone.
- Marks dispatch if command.
- Returns command and context.
- **Edges:** feedback can complete an operation even when accompanying sensor values are invalid.

### `queueIrrigationPulses`

- Finds zone and checks A1-A4.
- Rejects ripening, sensor error, green grid, or weather block.
- Converts requested estimate to at least one integer; no max clamp here.
- Appends exactly one `water` command, without dedup check.
- Marks zone cycle running/pump off and hardware pending.
- Returns estimate and 3s pulse.
- **Edge:** repeated API calls can stack water commands; hydrate route has no duplicate check.

### `markCommandDispatched`

- Creates timestamp.
- Water: sets `lastIrrigated`, pump on, running.
- Stop: pump off/done.
- Spray: sets `lastSprayed`.
- Updates hardware `lastCommand` to exact `command:zone`, which feedback matching expects.
- **Semantic edge:** “last irrigated/sprayed” records dispatch, not proof of closed pulse.

### `recordControllerFeedback`

- Defines terminal as closed/idle/clogged.
- On terminal, turns zone pump off and sets cycle error/cooldown/done based on remaining queued water.
- For matching closed spray:
  - loads DB
  - finds queued sprays for zone, chronological sort, selects newest
  - completes it
  - for chemical mode, treats linked active detection, increments history, computes remaining-active zone state
  - writes DB
  - records spray activity separately
- For matching closed hydrate, records water activity.
- Updates hardware feedback/active state.
- **Edges:** no command ID; a stale feedback can affect newest record. Zone with no remaining detection becomes `warning`, not healthy. Water ledger is not updated.

## 20.11 Hydrate and spray route functions

### Hydrate POST

- Parses `zoneId,pulses`.
- Kill switch -> 423.
- Missing/unknown -> 400/404.
- Gets weather and unified decision.
- Chooses supplied numeric pulses or planned estimate.
- Queues through zone function; failure -> 409 plus decision.
- Gets farm ID.
- Appends queued irrigation water entry and writes DB.
- Computes reference liters but hides them unless physical pump calibrated.
- Returns loop description.
- **Edge:** DB water entry can be created after queue mutation; if write fails, command exists without ledger.

### Spray POST

- Parses all fields and water-validation flag.
- Checks kill switch, zone, pilot.
- Gets weather decision.
- Allows explicit override only when decision explicitly requires it.
- Chemical path validates tank, product/rate, carrier/tank, PHI, weather.
- Reads DB and linked detection.
- Rejects missing explicit ID, review, nonactive.
- The nonactive check also rejects null linked detection.
- Checks queue/DB for duplicate.
- Creates queued record and one-pulse estimate.
- Appends spray and water entries, writes DB.
- Then appends command and changes hardware.
- **Consistency edge:** if command mutation fails after DB write, persisted intent has no queue; if DB write fails, no command is added.

## 20.12 Spread engine

### `activeSeedMap`

- Filters persisted detections to active/non-review.
- Chooses highest-confidence record per zone.
- Confidence clamps .2–1 with default .5.
- Only if DB yields no seed, uses zone `activeDetection`.
- **Edge:** healthy string is not explicitly filtered here; upstream detections normally set healthy resolved.

### `simulate`

- Clamps days 1–14, runs 50–1000.
- Creates protected set and lookup maps.
- Allocates day probability/count accumulators.
- For each run:
  - creates deterministic PRNG
  - seeds infected set
  - for each day records state
  - for each infected source examines neighbors
  - skips infected/protected targets
  - calculates probability and samples random
  - infections persist
- After runs, divides counts/probabilities, rounds, and returns final metrics.
- **Edge:** newly infected zones use their zone severity/confidence on later days, not the original transmitting disease identity.

### `buildSpreadPlan`

- Sorts zones and builds adjacency.
- Creates seeds.
- Generates explicit or hashed seed.
- Runs baseline.
- Finds articulation points.
- Makes nonseed candidates.
- Clamps budget, with minimum one even when candidate count is zero; loop simply breaks if none.
- Greedily evaluates marginal candidates using same random stream seed.
- Builds urgency and assumptions.
- Returns graph/baseline/protected/bottlenecks.

## 20.13 Analytics, yield, and water

### `detectionRisk` / `combinedRisk`

- Normalizes severity.
- Uses base .62/.38/.18.
- Clamps confidence .2–1, default .5.
- Multiplies confidence blend and exponential freshness.
- Applies .55 high floor and .9 cap.
- Combined risk multiplies all non-event probabilities and subtracts from one.
- **Edge:** many low records accumulate high combined risk under an independence assumption.

### `projectYieldImpact`

- Filters active, actionable, nonhealthy.
- Matches normalized disease substring to a loss range or default.
- Positions by severity.
- Multiplies curable loss by .75 to estimate protectable percentage.
- Sorts for largest protectable, then loss.
- Returns one headline plus basis.
- **Edge:** crop/region/stage are not inputs; source citations are not stored.

### `buildWaterLogEntry`

- Rounds pulses and forces minimum one.
- Generates UUID and timestamp.
- Uses global 3s and flow estimate.
- **Edge:** a legitimate zero-pulse record cannot be represented.

### `summarizeWater`

- Optionally filters exact farm ID.
- Treats null estimate as zero.
- Aggregates total/kind/zone/status.
- Undefined status falls into queued `else`.
- Returns calibration/source labels.

## 20.14 Auth functions

### `getSession`

- Reads `auth_token`.
- Base64-decodes and parses JSON.
- Requires only object and `id`.
- Returns caller-controlled session fields.
- Any error -> null.
- No signature/expiry.

### `getCurrentUser`

- Gets session.
- Guest returns no stored user and not blocked.
- Non-guest rereads users by ID.
- Missing/deleted or blocked/inactive/suspended -> blocked.
- This is safer than `getSession` alone but not used everywhere.

### Login POST

- Parses credentials.
- Reads users.
- Uses email if truthy; otherwise normalized phone.
- Finds exact email or phone.
- Missing user/password -> 401.
- Blocked -> 403.
- bcrypt compare or plaintext equality/migration.
- On success updates last login and writes.
- Builds unsigned token and locked dashboard cookie.
- Catch -> 500.
- **Edges:** missing password passed to bcrypt can throw and become 500; email is case-sensitive.

### OTP functions

- `normalizePhone` strips nondigits, removes leading 91 from 12 digits, requires Indian leading digit, returns `+91...`.
- `generateOtp` uses `Math.random`, stores name/expiry/attempts.
- `verifyOtp` handles not found, expiry, cap, mismatch increment, success delete.
- OTP request validates new-user password but does not store it; verify request must send it again.

## 20.15 Frontend detection and Smart Spray

### Detection `handleUpload`

- Returns if no file.
- Captures current zone to prevent dropdown race.
- Builds multipart zone/crop/file.
- Sets loading and clears error.
- Posts only to Next.
- On success maps server detection/recommendation into local state.
- On failure throws server error or generic.
- Catch logs/toasts; finally clears loading.
- **Edges:** no client file type/size check is visible in the handler; UI language/model ID are not sent.

### Smart Spray `load`

- Parallel-fetches zones, recommendations, queue, hardware, sprays.
- Parses zones as old array or current envelope.
- Sets all component state.
- Reads requested zone from URL.
- Polls every four seconds.
- **Edge:** no abort controller; overlapping slow polls and state update after unmount are possible.

### Smart Spray `sendPumpCommand`

- Requires selected/pilot.
- Chemical path requires verified numeric mix, tank confirmation, and client weather allowed.
- Uses `window.confirm`.
- Posts exact numeric plan and optional linked recommendation detection.
- Server revalidates.
- Toasts result and reloads.
- Defaults `waterValidation=true`, making water-only test the initial mode.

# 21. End-to-End Execution Trace

This trace uses a real persisted detection from the repository's current `data/db.json`:

- Detection ID: `2bf75597-1596-4fef-963e-d879f5659d56`
- Zone: `A3`
- Selected crop: `Tomato`
- Model crop: `Tomato`
- Raw winning class label: `Tomato___Septoria_leaf_spot`
- Persisted canonical disease suffix: `Septoria_leaf_spot`
- Display disease: `Septoria Leaf Spot`
- Confidence: `0.9706956148147583`
- Severity: `high`, score `3`
- Timestamp: `2026-07-27T15:58:40.108Z`
- Current status at audit time: `active`

The source upload is **not stored**, so the filename, bytes, dimensions, MIME header, and exact pixel tensor cannot be reconstructed. The trace below therefore starts with the observable persisted event and follows the code path that must produce that record. It does not invent unavailable image details or unpersisted top-three probabilities.

## 21.1 Page preparation

1. The browser opens the disease-detection page.
2. A `Promise.all` fetches `/api/zones` and `/api/farmer-profile`.
3. `app/api/zones/route.ts` calls `generateZones()`.
4. `generateZones()` reads the JSON database, overlays any persisted zone state on the fixed 12-zone layout, reads process-local hardware and simulator state, calls `updateClimateFromSources()`, and builds presentation fields.
5. The profile response can set the initial farm/scan crop, while failures leave the hard-coded 12 zone IDs and `Paddy` fallback usable.
6. The page receives the zone list and allows `A3` to be selected.
7. The crop selector supplies `Tomato`.
8. The user chooses an image. The component keeps that browser `File` only in local state; it does not persist a copy.

## 21.2 Browser upload

1. `DetectionPage.handleUpload` returns immediately if the file is missing.
2. It captures the currently selected zone so a later dropdown change cannot silently retarget the in-flight scan.
3. It constructs `FormData`.
4. It appends:
   - `zoneId=A3`
   - `crop=Tomato`
   - `file=<browser File>`
5. It sets the loading state, clears the previous error, and sends `POST /api/hardwareDetect`.
6. No model ID or UI language is appended by the current page even though the server route can read those fields.

## 21.3 Next.js route admission

1. Next.js App Router dispatches the request to `app/api/hardwareDetect/route.ts`.
2. The exported `POST` handler calls `request.formData()`.
3. It extracts `zoneId`, `crop`, `language`, `modelId`, and `file`.
4. It checks only that `zoneId` and the cast `file` value are truthy. It does not perform an `instanceof File`, MIME, extension, content, or size check.
5. An absent zone or file returns HTTP `400`; the Flask service is never called.
6. In this trace, the request passes because `A3` and the image file are present.

## 21.4 Proxy request to Flask

1. The route creates a second `FormData`.
2. It forwards the same file.
3. It includes the model ID only if one was supplied; otherwise Flask selects its default model.
4. It sends the multipart request to `${ML_SERVICE_URL}/predict`.
5. With no configured environment override, the code uses its local Flask service URL.
6. A network failure at this point enters the Next route's `catch` and returns HTTP `500`.

## 21.5 Flask routing and request validation

1. `ml_service/main.py` has already created `app = Flask(__name__)` and applied unrestricted `CORS(app)`.
2. Flask matches `POST /predict` to `predict()`.
3. `predict()` verifies that the multipart key `file` exists.
4. It reads the requested model ID, or uses `get_default_model_id()` to select the configured default and then the first enabled/indexed fallback.
5. `resolve_model_config()` checks the registry entry and rejects unknown or disabled model IDs.
6. The selected entry is `plant_disease_mobilenet_v2`, version `1.0.0`.
7. `load_class_names_for_model()` uses that entry's configured/default 38-class label array.
8. A missing file returns `400`; an unknown explicit model returns `404`; a disabled model returns `409`; and a missing artifact or label configuration returns `500`.

## 21.6 Lazy model loading

1. `load_model_for_config()` checks `MODEL_CACHE` using the selected model ID.
2. If this process has already handled a request for that model, the cached Keras model is reused.
3. On the first request in a process, it resolves the registry-relative file path.
4. It calls `tensorflow.keras.models.load_model(...)`.
5. The loaded model has:
   - Input shape `(None, 224, 224, 3)`
   - Output shape `(None, 38)`
   - A frozen MobileNetV2 feature extractor
   - Global average pooling
   - Dropout `0.35`
   - Dense `256` with ReLU
   - Dropout `0.25`
   - Dense `38` with softmax
6. The model object is placed in `MODEL_CACHE` for subsequent calls.
7. No preload, warm-up request, lock, eviction policy, or multi-process shared cache exists.

## 21.7 Image preprocessing

1. Pillow opens the uploaded file stream.
2. `.convert("RGB")` forces three channels and discards alpha if present.
3. The image is resized directly to `224 × 224`; aspect ratio is not preserved.
4. `np.array(...)` converts the resized image to a NumPy array.
5. `np.expand_dims(..., axis=0)` changes the shape from `(224, 224, 3)` to `(1, 224, 224, 3)`.
6. MobileNetV2 `preprocess_input` maps pixel values into the normalization domain expected by the backbone, approximately `[-1, 1]`.
7. There is no EXIF orientation correction, crop, letterbox, explicit dtype check, blur check, corruption preflight, or file-size cap.

## 21.8 Inference and class decoding

1. The Keras model receives the one-image tensor.
2. `model.predict(image_array)` returns a batch containing 38 class scores.
3. The code selects the first batch row.
4. `np.argmax(predictions)` returns the winning class index.
5. For this persisted result, the winning label was the 33rd label in the declared list, zero-based index `32`: `Tomato___Septoria_leaf_spot`.
6. The score at that index becomes the confidence: `0.9706956148147583`.
7. The code checks that the winning index is within the labels array.
8. It does not verify that the complete output vector length equals exactly 38.

## 21.9 Flask post-processing

1. `extract_disease_key()` splits the raw label around `___` and returns `Septoria_leaf_spot`.
2. The crop is obtained directly from the raw prefix, producing `Tomato`; Flask does not call a separate crop-normalization function.
3. `get_translated_name()` maps the disease suffix when a translation entry matches, otherwise it returns the suffix unchanged.
4. With no language forwarded by the current page, the default display behavior is used.
5. The response includes model metadata, the canonical English disease suffix, crop prefix, translated disease, confidence, and top predictions as implemented by Flask.
6. The exact top-three alternatives were not persisted in `db.json`, so they cannot be named from repository evidence.
7. Flask serializes the object with `jsonify()` and returns HTTP `200`.

## 21.10 Next.js classification checks

1. The Next route parses the Flask JSON.
2. It preserves `Septoria_leaf_spot` as `canonicalDisease`.
3. It obtains model crop `Tomato`.
4. The inline `normalizeDiseaseLabel(canonicalDisease).includes("healthy")` expression evaluates false.
5. The inline comparison of `normalizeCrop("Tomato")` values yields `cropMatch = "matched"`.
6. The confidence is above the low-confidence threshold of `0.65`, so this is a conclusive prediction rather than `crop-review`.

## 21.11 Severity calculation

1. `calculateSeverity()` receives the canonical disease suffix and confidence.
2. Healthy would force severity score `0`, but this result is diseased.
3. The confidence is greater than `0.75`.
4. The function therefore returns:
   - `level = "high"`
   - `score = 3`
5. The threshold comparisons are strict. A confidence of exactly `0.75` would not take the same branch.

## 21.12 Treatment lookup

1. `getTreatmentOptions()` is called with crop `Tomato` and disease `Septoria_leaf_spot`.
2. It searches the Telangana treatment catalog using normalized/suffix matching.
3. It finds the crop-specific Septoria entry.
4. The persisted recommendation fields are:
   - Chemical: `Chlorothalonil or another crop-registered protectant Extension-guided formulation`
   - Organic guidance: `Mulch soil, remove lower infected leaves and avoid splash irrigation.`
   - Dosage: `Use only at the dose on the locally registered product label`
5. The application does not calculate an authoritative label dose for the actual product because product concentration and registration data are not present.

## 21.13 Detection record construction

1. The route generates a UUID.
2. It captures an ISO timestamp.
3. It builds a detection with zone ID, canonical disease suffix, display disease, confidence, severity, treatments, crop metadata, model ID, and model version.
4. The status becomes `active`.
5. The route reads `app/data/db.json`.
6. For a conclusive result, older unresolved detections for the same zone are marked resolved.
7. The new record is appended.
8. `recordActivity()` separately reads and writes an alert activity.
9. `writeDB()` synchronously writes the route's database snapshot, caps detections at 5,000, and archives overflow under `app/data/archive`.
10. Only after that write does the route update the process-local zone object and append to its treatment history; those zone mutations are not persisted by this request.

The persisted record produced by this path is:

```json
{
  "id": "2bf75597-1596-4fef-963e-d879f5659d56",
  "zoneId": "A3",
  "disease": "Septoria Leaf Spot",
  "canonicalDisease": "Septoria_leaf_spot",
  "confidence": 0.9706956148147583,
  "severityLevel": "high",
  "severityScore": 3,
  "recommendedChemical": "Chlorothalonil or another crop-registered protectant Extension-guided formulation",
  "organicAlternative": "Mulch soil, remove lower infected leaves and avoid splash irrigation.",
  "dosage": "Use only at the dose on the locally registered product label",
  "timestamp": "2026-07-27T15:58:40.108Z",
  "status": "active",
  "treatedAt": null,
  "postSeverityScore": null,
  "linkedSprayId": null,
  "scanCrop": "Tomato",
  "modelCrop": "Tomato",
  "cropMatch": "matched",
  "modelId": "plant_disease_mobilenet_v2",
  "modelVersion": "1.0.0"
}
```

This is the complete checked-in object at audit time, not a reconstructed schema example.

## 21.14 Activity and write-order caveat

1. Every successful result calls `recordActivity()` with an alert event; the call is not conditional on severity.
2. `recordActivity()` performs its own read-modify-write cycle.
3. The prediction route still holds an earlier database object.
4. Its later `writeDB(db)` can overwrite the activity written by `recordActivity()`.
5. Therefore the absence of a matching alert activity does not prove that the alert branch never executed; it may expose the lost-update defect.

## 21.15 Response to the browser

1. The route returns the detection plus recommendation and model information as JSON.
2. `handleUpload` checks `response.ok`.
3. It maps the server fields into the page's result state.
4. It shows `Septoria Leaf Spot`, approximately `97.07%` confidence, the high-severity state, and treatment guidance.
5. The `finally` block clears the loading state.
6. The image itself remains only in browser memory and is not saved by either service.

## 21.16 What happens next—and what does not

- The new detection can appear in dashboard, recommendations, history, analytics, risk, and spread computations.
- It can be linked to a later chemical spray request.
- No automatic chemical actuation is triggered by this prediction.
- No image, tensor, full score vector, request ID, inference duration, or Flask log correlation ID is persisted.
- At audit time this record was still `active`, so no completed linked spray was established in current persisted data.

# 22. Hidden Knowledge

These are implementation details that are easy to overlook but are especially useful in an interview because they distinguish the actual repository from its README or intended design.

## 22.1 Architecture facts

1. The primary application backend is not Flask alone. Next.js route handlers own most domain logic, state, weather decisions, analytics, authentication, hardware queues, and persistence. Flask only owns model catalog and inference.
2. There is no `app.py`; Flask is defined in `ml_service/main.py`.
3. Flask blueprints, an app factory, dependency injection container, middleware stack, and structured logger are **Not implemented.**
4. The project is three cooperating runtimes when hardware is used: browser/Next.js, Flask/TensorFlow, and the Python serial bridge.
5. The browser never calls Flask directly during the normal detection workflow.
6. The checked-in `.env.example` files document local URLs, but the code still contains defaults; environment isolation is partial.
7. `README.md` contains intended behavior and setup notes that are not always synchronized with current source.

## 22.2 Model facts

1. The only enabled artifact is MobileNetV2-based. EfficientNet is **Not implemented.**
2. Tomato and corn specialist entries exist only as disabled registry placeholders and do not have usable checked-in label/artifact configurations.
3. The model artifact contains compile/training metadata, but the dataset construction and training program are absent; exact batch size, epochs, split, augmentation, scheduler, and final training history cannot be recovered.
4. The model has 38 outputs and the code declares 38 labels, but runtime code checks only the winning index, not complete output/label equality.
5. The backbone is frozen in the saved artifact; only the classification head is trainable.
6. The first prediction in each Flask process pays lazy loading cost. Multiple production workers each load their own copy.
7. `MODEL_PATH` exists but registry resolution is the active loading path.
8. Resizing distorts aspect ratio because it does not letterbox or center-crop.
9. `convert("RGB")` makes grayscale/RGBA inputs technically processable but does not validate agronomic image quality.
10. Top predictions are returned transiently but are not stored in the detection database.

## 22.3 Crop and disease identity facts

1. The canonical disease suffix is the stable internal disease identity; crop family is stored separately, and display disease can be translated.
2. Persisting translated display names means analytics groups can split the same disease across languages.
3. The UI crop vocabulary and model crop vocabulary are not normalized by one shared catalog.
4. `Maize` versus `Corn_(maize)`, `Citrus` versus `Orange`, and `Pepper` versus `Pepper,_bell` can yield false crop-review outcomes.
5. `Paddy` is selectable but no rice/paddy class exists in the 38-label model.
6. A crop mismatch deliberately does not overwrite a zone's conclusive disease state.
7. A low-confidence result is stored as review-oriented state, but recommendation fallbacks can later make it look actionable.
8. Healthy detections are persisted as resolved rather than active.

## 22.4 Persistence facts

1. The “database” is a single JSON file and synchronous filesystem helper, not an SQL or NoSQL server.
2. Detections, sprays, activity, water usage, users, profiles, and zone overlays share the same file.
3. Process-local queues, OTPs, simulator state, and recent hardware telemetry are not durable.
4. `readDB()` treats any read/parse problem as a reason to create a default database; a transient corruption can therefore cause broad logical data loss on the next write.
5. Writes are neither atomic nor locked.
6. Multiple read-modify-write sequences can lose changes even within one request.
7. `zoneHistory` is not persisted and has no database retention rule.
8. The main event arrays are capped at 5,000, not paginated at storage level.
9. Reset preserves water-ledger entries while clearing most disease/spray state.
10. Current checked-in data is mutable sample/runtime state, not a formal fixture contract.

## 22.5 Sensor and automation facts

1. There are 12 logical zones, but only A1-A4 are server-controllable.
2. The supplied bridge maps firmware zones only to A1-A3, leaving A4 unreachable through that path.
3. Temperature and humidity come from one shared DHT11 source and are reused across zones.
4. Moisture uses a rolling median of five samples.
5. Presentation fallback climate values can appear in the UI, but automation requires fresh real DHT telemetry.
6. The bridge handles a returned command only when sensor ingestion returns HTTP 200.
7. Invalid sensor input returns HTTP 422 with a stop command, so the supplied bridge never transmits that emergency stop.
8. The bridge discards command feedback fields such as nozzle status and path status, so the normal supplied loop cannot acknowledge completion.
9. Commands are delivered only as piggyback responses to telemetry posts; telemetry silence stops dispatch.
10. There is no durable delivery, acknowledgement ID, retry policy, idempotency key, or watchdog.
11. A queued water command has a record in the spray ledger and the water ledger; feedback can complete the former while leaving the latter queued.
12. One water pulse is estimated as 1.5 L from a generic 30 L/minute assumption and three-second pulse.
13. The code labels the flow estimate calibrated while separately marking the physical pump uncalibrated.
14. `singlePumpMode` is persisted as profile state but is not enforced by a global pump mutex.
15. Legacy `startIrrigation`/`tickIrrigation` logic exists but no scheduler calls it.

## 22.6 Safety-rule facts

1. Chemical spray requires pilot mode, kill switch off, an active linked detection, verified mix/tank confirmation, usable weather, and VPD gate.
2. Water test bypasses chemical and weather checks but still requires pilot mode and kill switch off.
3. The intended manual-without-detection exception is unreachable because optional chaining makes the preceding inactive-detection condition true when no detection exists.
4. Kill switch changes server state but does not directly clear queues or transmit a physical stop.
5. `lastSprayed` and `lastIrrigated` are dispatch timestamps, not confirmed completion timestamps.
6. `/api/spray-window` is less strict than the actual `/api/spray` gate because it omits DHT freshness/VPD.
7. Critical soil moisture can override rain in irrigation decisions.
8. Unusable/fallback weather does not necessarily block irrigation; the system can use soil-only logic.
9. Crop-review state can still affect zone status enough to suppress irrigation recommendations.
10. Treatment text is guidance; product-specific legally registered dose calculation is **Not implemented.**

## 22.7 Weather facts

1. Weather uses Open-Meteo and does not require an API key.
2. The cache is both process-local and persisted through the JSON database.
3. A failed refresh can use last-good stale weather; without that, it uses deterministic fallback weather.
4. The default location is Hyderabad when no farm coordinates exist, but the result is flagged unconfigured.
5. Spray safety requires weather no older than 90 minutes and not marked fallback.
6. Rain now means current precipitation at least 0.1 mm or a rain-associated WMO code.
7. Imminent rain examines roughly the next three forecast periods and uses either probability or accumulated precipitation.
8. VPD uses sensor temperature/humidity rather than remote forecast values.

## 22.8 Spread-engine facts

1. The active engine is a deterministic seeded Monte Carlo simulation, not the older BFS-style concept described elsewhere.
2. It uses only orthogonal grid neighbors.
3. Default computation is 350 runs for five days.
4. A seed derived from inputs makes repeated identical calls reproducible.
5. Protected zones are blocked as infection targets.
6. Tarjan articulation points are used for recommendation rationale, not as a biological model.
7. Multi-zone selection is greedy and sequential.
8. Newly infected zones do not carry a real disease-specific pathogen identity.
9. Spread results are recomputed by several APIs and are not centrally cached.

## 22.9 Authentication facts

1. `auth_token` and dashboard cookies are base64-encoded JSON, not cryptographically signed sessions.
2. Cookie flags do not prevent forgery if the payload has no signature.
3. Middleware protects dashboard pages, not the API surface.
4. Several APIs use no authentication; user administration relies on a caller-controlled session role in at least one path.
5. `getCurrentUser()` rereads current user status and can detect blocked/deleted users, but not every route uses it.
6. Email login comparison is case-sensitive.
7. Legacy plaintext password compatibility still exists.
8. OTP is generated with `Math.random`, kept in process memory, and returned in the API response for demo behavior.
9. OTP verification does not have distributed rate limiting or durable attempt storage.
10. CSRF tokens, signed sessions, API authorization, and centralized security headers are **Not implemented.**

## 22.10 Frontend facts

1. The current dashboard uses API-backed zone state, but a legacy automation context with 24 zones is still mounted globally.
2. That legacy context uses A-D rows with six columns, while the current backend defines A-B rows only.
3. Only a legacy spraying-controls component consumes that context.
4. The translation system combines a typed dictionary with DOM mutation observation; it is not a conventional server-side i18n pipeline.
5. Non-English dictionaries are incomplete.
6. The selected UI language is not forwarded by the active detection page.
7. Zustand is not the authoritative store for server farm state.
8. Several pages use polling; requests can overlap because cancellation is generally absent.
9. Recommendations are cached in `sessionStorage` for five seconds.
10. `app/api/ml/predict` is an extensionless example/static file, not an App Router endpoint.
11. `favicon.ico` is referenced but absent.
12. `public/icon.svg` is malformed/unused in the current source.
13. VS Code port metadata mentions 8080 while Next.js normally runs on 3000.
14. `predev` invokes `npx kill-port` even though `kill-port` is not declared as a local dependency, which is fragile in offline environments.

## 22.11 Analytics facts

1. Analytics are derived live from operational records; there is no separate warehouse or ETL pipeline.
2. Yield projection is heuristic and does not have a checked-in agronomic citation or trained yield model.
3. Water demand is partly estimated from zone count and heuristics rather than metered physical delivery.
4. Some historical records without `applicationStatus` are treated as completed by current filtering.
5. Sensor history arrays are aligned by index rather than independent sample timestamps.
6. Disease grouping by display name can be language-dependent.
7. The current analytics water summary can say calibration is required while the generic flow model says calibrated.
8. `/api/history` mixes stored activity with synthesized history events.

## 22.12 Operations and testing facts

1. No Dockerfile or Compose file exists.
2. No MLflow configuration or calls exist.
3. No automated unit, integration, browser, hardware-in-loop, or ML regression test suite exists.
4. TypeScript compilation passed during this audit with `tsc --noEmit`.
5. Passing type-checks do not validate Python, device protocol, model behavior, race conditions, or safety invariants.
6. Flask development mode is enabled in the direct script entry point.
7. There is no production WSGI server configuration in the repository.
8. There is no CI/CD pipeline, infrastructure-as-code, database migration tool, observability backend, or rollback automation.
9. Deployment requires separately managing Node, Python/TensorFlow, writable JSON state, and—when used—the serial bridge.
10. The firmware source is absent, so relay polarity, sensor ADC conversion, servo/nozzle mechanics, and physical failsafe behavior cannot be proven from this repository.
