# LeafMind Backend

Backend for **LeafMind**, an IEEE research-grade AI system for medicinal
plant identification using Vision-Language Models (VLM) and Retrieval-Augmented
Generation (RAG).

> **Sprint 1** delivered the backend *architecture*: project structure,
> configuration, logging, middleware, database connectivity, DI scaffolding,
> and versioned health/status endpoints.
>
> **Sprint 2** delivered **Authentication & Authorization**: user/role/refresh-token
> models, registration, login/logout, JWT access + refresh tokens with
> rotation, Role-Based Access Control (User, Developer, Admin), and password
> management.
>
> **Sprint 3** (this sprint) delivers the **Image Analysis Pipeline**: a
> configurable dataset loader over the medicinal leaf dataset, a modular image
> preprocessing pipeline, a from-scratch Qwen2.5-VL inference pipeline
> (model loading, prompt construction, prediction, confidence extraction), the
> `/upload`, `/predict`, `/history` endpoints, and a temporary VLM-only chat
> feature. ChromaDB-backed RAG remains out of scope and lands in Sprint 4.

## Architecture

```
backend/
├── app/
│   ├── main.py                  # FastAPI application factory (create_application)
│   ├── core/
│   │   ├── config.py            # Pydantic Settings — env-driven configuration
│   │   ├── logging.py           # Loguru configuration (console + rotating file sinks)
│   │   ├── exceptions.py        # Domain exceptions + global exception handlers
│   │   └── security.py          # Password hashing (bcrypt) + JWT encode/decode
│   ├── middleware/
│   │   ├── logging.py           # RequestLoggingMiddleware (request ID, method/path/status/latency)
│   │   └── timing.py            # ResponseTimingMiddleware (Server-Timing header)
│   ├── db/
│   │   ├── session.py           # Async SQLAlchemy engine/session + connectivity probe
│   │   ├── base.py              # Shared DeclarativeBase for ORM models
│   │   └── seed.py              # Idempotent startup seed (default RBAC roles)
│   ├── models/
│   │   ├── mixins.py            # UUIDPrimaryKeyMixin, TimestampMixin, portable GUID type
│   │   ├── role.py               # Role + RoleName (user/developer/admin)
│   │   ├── user.py               # User
│   │   ├── refresh_token.py     # RefreshToken (hashed, revocable, rotatable)
│   │   ├── uploaded_image.py    # UploadedImage — uploaded file metadata
│   │   ├── prediction.py         # Prediction — structured classification result
│   │   └── chat_message.py      # ChatMessage — persisted chat turns
│   ├── datasets/
│   │   └── loader.py             # DatasetLoader — configurable taxonomy + raw image access
│   ├── images/
│   │   ├── preprocessing/
│   │   │   ├── steps.py          # 8 independent preprocessing steps (pure functions)
│   │   │   └── pipeline.py       # ImagePreprocessingPipeline — orchestrates + times each step
│   │   └── storage.py            # ImageStorage — on-disk persistence for uploaded files
│   ├── inference/
│   │   └── vlm/
│   │       ├── backend.py        # VLMBackend protocol + HFQwenVLBackend (real Qwen2.5-VL)
│   │       ├── prompts.py        # Prompt construction (classification + chat)
│   │       ├── pipeline.py       # VLMInferencePipeline — predict/chat, response parsing
│   │       └── schemas.py        # ClassificationResult, ChatTurn dataclasses
│   ├── chat/
│   │   └── service.py             # ChatService — VLM-only conversation (no RAG)
│   ├── schemas/
│   │   ├── health.py             # Health/status response models
│   │   ├── auth.py               # Register/login/refresh/change-password request+response models
│   │   ├── images.py             # Upload/predict/history request+response models
│   │   └── chat.py               # Chat request+response models
│   ├── services/
│   │   ├── auth/service.py      # AuthService — all auth business logic lives here
│   │   └── image_analysis/
│   │       └── service.py       # ImageAnalysisService — orchestrates upload/preprocess/infer
│   ├── api/
│   │   ├── deps.py               # DI seams: Settings, DB session, AuthService,
│   │   │                         #   get_current_user, require_role() RBAC factory,
│   │   │                         #   ImageAnalysisService, ChatService, and a RAG placeholder
│   │   └── v1/
│   │       ├── router.py         # Aggregates all v1 routers
│   │       └── endpoints/
│   │           ├── health.py     # /health, /status
│   │           ├── auth.py       # /auth/register, /login, /logout, /refresh, /me, /change-password
│   │           ├── images.py    # /upload, /predict, /history
│   │           └── chat.py       # /chat
├── alembic/                      # Migrations (roles/users/refresh_tokens, then image-analysis tables)
├── tests/                        # pytest suite (SQLite in-memory + fake VLM backend, no external services needed)
└── requirements.txt
```

### Design principles

- **Clean separation of concerns.** Routers ([app/api/v1/endpoints/auth.py](app/api/v1/endpoints/auth.py))
  only parse requests and shape responses. All business logic — password
  checks, token issuance/rotation, revocation — lives in
  [AuthService](app/services/auth/service.py). Routers never touch the DB
  session directly for auth; they inject `AuthServiceDep`.
- **Config via environment.** `app.core.config.Settings` is the single source
  of truth, loaded from `.env` via Pydantic Settings.
- **Structured logging.** Loguru replaces stdlib logging everywhere (including
  intercepting uvicorn/SQLAlchemy logs) and writes to rotating, compressed log
  files (`logs/leafmind.log`, `logs/errors.log`) as well as the console.
  Auth events (registration, login success/failure, logout, token rotation,
  password changes) are logged with `logger.info`/`warning` at the service layer.
- **Consistent error contract.** All errors — domain (`LeafMindError`/`AuthError`),
  HTTP, validation, and unhandled — resolve to the same JSON envelope:
  `{"success": false, "error": {status_code, message, path, details}}`.
- **DI scaffolding for future features.** `app/api/deps.py` now provides real
  `ImageAnalysisServiceDep` / `ChatServiceDep` (Sprint 3) alongside a
  `RAGServiceDep` placeholder seam for Sprint 4.
- **Authentication middleware, DI-style.** FastAPI has no single "auth
  middleware" hook the way Express does; the idiomatic equivalent is a
  dependency. `get_current_user` (in `app/api/deps.py`) decodes and validates
  the bearer access token and loads the user — any route that depends on it,
  directly or via `require_role(...)`, is implicitly protected. This keeps
  auth enforcement declarative and visible in each route's signature/OpenAPI
  schema, rather than hidden in a blanket middleware that every route must
  remember to opt out of.

## Authentication & Authorization (Sprint 2)

### Data model

- **`roles`** — a small, seeded table (`user`, `developer`, `admin`) rather
  than a hardcoded enum column, so new roles can be added operationally
  without a migration. `RoleName` (in `app/models/role.py`) gives routers a
  typed reference to the roles this sprint ships with.
- **`users`** — email (unique, case-normalized), full name, bcrypt password
  hash, active/verified flags, and a `role_id` FK.
- **`refresh_tokens`** — one row per issued refresh token. Only a SHA-256
  hash of the token is stored (never the raw value), alongside expiry and
  revocation state. Storing refresh tokens server-side (instead of relying on
  stateless JWTs alone) is what makes logout, single-session revocation, and
  rotation-on-refresh possible.

### Token strategy

- **Access tokens** are short-lived (default 60 min), signed with
  `JWT_SECRET_KEY`, and carry `sub` (user id), `role`, `type=access`, `jti`,
  `iat`/`exp`, and `iss`. They are never persisted server-side — validity is
  purely cryptographic + expiry, checked on every request via
  `get_current_user`.
- **Refresh tokens** are long-lived (default 30 days), signed with a
  *separate* `JWT_REFRESH_SECRET_KEY`, and are additionally tracked in the
  `refresh_tokens` table so they can be revoked.
- **Rotation on refresh.** `POST /auth/refresh` revokes the presented refresh
  token and issues a brand-new access/refresh pair. Reusing an
  already-rotated (or logged-out, or expired) refresh token is rejected with
  401 — this caps the damage from a leaked refresh token to one use.
- **Password change revokes all sessions.** `PUT /auth/change-password`
  invalidates every refresh token belonging to that user, so a changed
  password can't coexist with a session established under the old one.

### Password policy

Enforced identically at registration and password-change time via
`app.core.security.validate_password_strength`, driven by config
(`PASSWORD_MIN_LENGTH`, `PASSWORD_REQUIRE_UPPERCASE/LOWERCASE/DIGIT/SPECIAL`).
Passwords are hashed with **bcrypt** via `passlib` before storage; plaintext
passwords are never logged or persisted.

### Role-Based Access Control (RBAC)

Three roles ship in this sprint: `user`, `developer`, `admin`. New
registrations default to `user` (`DEFAULT_USER_ROLE` in config). To protect a
route by role:

```python
from app.api.deps import require_role
from app.models.role import RoleName

@router.get("/admin-only")
async def admin_only(user: Annotated[User, Depends(require_role(RoleName.ADMIN))]):
    ...
```

`require_role` composes on top of `get_current_user`, so a route using it
gets both authentication *and* authorization from a single dependency.

## Image Analysis Pipeline (Sprint 3)

### Dataset integration

`app.datasets.loader.DatasetLoader` reads the taxonomy from
`datasets/metadata/classes.json` (repository root) and resolves it against
`datasets/raw/medicinal_leaf_images/`. Both paths are configurable
(`DATASET_ROOT`, `DATASET_RAW_SUBDIR`, `DATASET_METADATA_SUBDIR`) so the
loader works regardless of where the dataset lives relative to the backend.
It exposes `get_verified_class_names()` — the closed set of species with an
approved scientific-name label — which is what seeds the classification
prompt's candidate list; the 5 classes still pending manual taxonomy
verification are excluded from that list but not from the raw dataset itself.

### Preprocessing pipeline

`app.images.preprocessing` is a strict pipeline of independent, pure
functions (`app/images/preprocessing/steps.py`), each operating on an RGB
`uint8` array and unit-testable in isolation:

1. **decode** — Pillow, with EXIF-orientation correction.
2. **validate (input)** — rejects too-small/too-large/blank/corrupt images early.
3. **resize** — letterboxed (padded) to a square, never stretched, so leaf
   shape/proportions aren't distorted.
4. **normalize_color** — gray-world white balance, dampened to 50% strength
   so true leaf coloration isn't overcorrected away.
5. **enhance_contrast** — CLAHE on the LAB *L* channel only, leaving color
   (*a*/*b*) untouched.
6. **reduce_noise** — edge-preserving `fastNlMeansDenoisingColored`, chosen
   over a Gaussian blur specifically so venation/margin edges (identification
   features) aren't blurred away.
7. **normalize_background** — HSV vegetation-mask-based soft background
   lightening (never hard cropping/masking, to avoid ever clipping the leaf).
8. **enhance_leaf_features** — unsharp masking to sharpen venation/texture,
   applied last so it doesn't amplify pre-existing noise/artifacts.
9. **to_tensor** — canonical `[0, 1]`-scaled CHW float32 array.
10. **validate (output)** — re-validates after all transformations.

`ImagePreprocessingPipeline.run()` (`app/images/preprocessing/pipeline.py`)
composes these in order and records **per-stage wall-clock timing**, logged
structurally alongside the total. In local testing against a real dataset
image, `reduce_noise` dominates latency (~850ms of a ~1.05s total on a 448px
image on CPU) — `PREPROCESS_DENOISE_STRENGTH` and `PREPROCESS_TARGET_SIZE` are
the two knobs to tune if preprocessing latency matters for your deployment.

### Qwen2.5-VL inference pipeline

Rebuilt from scratch in `app/inference/vlm/`:

- **`backend.py`** — `VLMBackend` is the seam (a `Protocol`); `HFQwenVLBackend`
  is the real, complete Hugging Face implementation (`Qwen2_5_VLForConditionalGeneration`
  + `AutoProcessor`, lazily loaded as a process-wide singleton on first use via
  `get_vlm_backend()`). `transformers`/`torch`/`qwen_vl_utils` are imported
  *inside* this class, not at module load time, so importing the rest of the
  app never requires those (multi-GB) dependencies or a GPU unless a real
  prediction is actually requested.
- **`prompts.py`** — builds the Qwen2.5-VL chat-format message list for both
  classification (with the dataset's candidate species list embedded) and
  chat turns.
- **`pipeline.py`** — `VLMInferencePipeline.classify()` / `.chat()`: prompt
  construction → `backend.generate()` → structured-output parsing (tolerant of
  markdown-fenced JSON) → confidence extraction/clamping → `ClassificationResult`
  / `ChatTurn`. Never imports `transformers`/`torch` itself and never touches
  the DB — pure "image/messages in, structured result out".
- **`schemas.py`** — plain dataclasses (not Pydantic) for the internal
  structured output, kept free of any FastAPI/Pydantic coupling.

**Testing without a GPU or model weights:** the entire inference pipeline is
tested via `tests/fakes.py::FakeVLMBackend`, a scripted stand-in implementing
the same `VLMBackend` protocol as `HFQwenVLBackend`. This exercises every real
code path above the model call (prompt construction, JSON parsing, confidence
clamping, error translation) without downloading `Qwen/Qwen2.5-VL-3B-Instruct`
or requiring a GPU. On a machine with the model and hardware available,
`get_vlm_backend()` transparently returns the real backend instead — no code
changes needed.

### Image analysis service & storage

`app.services.image_analysis.ImageAnalysisService` (mirroring the
`AuthService` pattern) orchestrates `ImageStorage` (on-disk persistence,
content-type/size validation), `ImagePreprocessingPipeline`, and
`VLMInferencePipeline`, and persists `UploadedImage` / `Prediction` rows. Each
collaborator can be swapped independently — e.g. `ImageStorage` could later
back onto S3 without `ImageAnalysisService` changing.

### Temporary chat service (pre-RAG)

`app.chat.ChatService` is a **separate** service from `ImageAnalysisService`
specifically so that Sprint 4's ChromaDB-backed retrieval can be layered in as
a step feeding `VLMInferencePipeline.chat()` (e.g. injected into
`prediction_context` or prepended to the message history) without touching
`ImageAnalysisService`, the `/upload`/`/predict`/`/history` endpoints, or the
chat persistence model. Conversations are grouped by a plain `conversation_id`
UUID (not yet a full `Conversation` table — a natural, additive extension once
RAG needs conversation-level metadata). Each turn optionally grounds itself in
an uploaded image and/or that image's most recent `Prediction`.

### Structured logging

Every stage relevant to the pipeline logs structured context via Loguru's
`.bind(...)`:

- **Upload**: `upload_ms`, `image_id`, `user_id`, file size.
- **Preprocessing**: per-stage `stage_timings_ms` dict plus `total_ms`.
- **Inference**: `inference_ms`, `model_name`, `top_label`, `top_confidence`
  (classification) or just `inference_ms`/`model_name` (chat).
- **Errors**: preprocessing/inference failures are logged with context before
  being translated into `ImagePreprocessingFailedError` (422) /
  `InferenceFailedError` (502) and surfacing through the standard error
  envelope.

## Requirements

- Python 3.12
- PostgreSQL (running locally or reachable via `DATABASE_URL`)

## Setup

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # macOS/Linux

pip install -r requirements-dev.txt
copy .env.example .env        # then edit values as needed, especially
                               # JWT_SECRET_KEY / JWT_REFRESH_SECRET_KEY in production
```

## Running

```bash
alembic upgrade head           # creates roles/users/refresh_tokens tables
uvicorn app.main:app --reload --port 8000
```

On startup, the app connects to PostgreSQL and seeds the three default roles
if they don't already exist (`app/db/seed.py`) — safe to run every time.

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc
- OpenAPI schema: http://localhost:8000/openapi.json

## Endpoints (v1)

| Method | Path                        | Auth required | Purpose                                                  |
|--------|-----------------------------|:--------------:|-----------------------------------------------------------|
| GET    | `/api/v1/health`            | No             | Liveness probe — process is up.                          |
| GET    | `/api/v1/status`            | No             | App metadata, environment, timestamp, DB connectivity.    |
| POST   | `/api/v1/auth/register`     | No             | Create a new user account (default role: `user`).        |
| POST   | `/api/v1/auth/login`        | No             | Exchange credentials for an access + refresh token pair.  |
| POST   | `/api/v1/auth/logout`       | No¹            | Revoke a refresh token.                                   |
| POST   | `/api/v1/auth/refresh`      | No¹            | Rotate a refresh token for a new token pair.               |
| GET    | `/api/v1/auth/me`           | Yes (bearer)   | Return the authenticated user's profile.                  |
| PUT    | `/api/v1/auth/change-password` | Yes (bearer) | Change password; revokes all existing sessions.         |
| POST   | `/api/v1/upload`            | Yes (bearer)   | Upload a leaf image; returns an `image_id`.                |
| POST   | `/api/v1/predict`           | Yes (bearer)   | Preprocess + classify an uploaded image via Qwen2.5-VL.    |
| GET    | `/api/v1/history`           | Yes (bearer)   | Paginated list of the user's past predictions.             |
| POST   | `/api/v1/chat`              | Yes (bearer)   | Temporary VLM-only chat turn (no RAG).                     |

¹ These take the refresh token in the request body rather than the
`Authorization` header, so they don't depend on a still-valid access token.

## Database migrations (Alembic)

Two hand-written migrations exist (both matching `app/models/` exactly; no
local PostgreSQL/Docker was available in the authoring environment to run
`--autogenerate` against — each was instead validated with
`alembic upgrade head --sql`, which generates the DDL offline without a live
DB connection):

1. `14f959a026f2_add_auth_tables.py` (Sprint 2) — `roles`, `users`, `refresh_tokens`.
2. `76d15bc5420c_add_image_analysis_tables.py` (Sprint 3) — `uploaded_images`,
   `predictions` (with a JSON `candidates` column for the full ranked list),
   `chat_messages`.

Going forward, once a real PostgreSQL instance is reachable, subsequent
migrations can be generated normally:

```bash
alembic revision --autogenerate -m "add <feature> tables"
alembic upgrade head
```

## Testing

```bash
pytest
```

The full suite (57 tests as of Sprint 3) runs against an in-memory SQLite
database via a `get_db_session` dependency override (`tests/conftest.py`), so
it requires **no external PostgreSQL instance and no VLM model weights/GPU**:

- Models use a portable `GUID` type (`app/models/mixins.py`) mapping to native
  `UUID` on PostgreSQL and `CHAR(36)` on SQLite, so the same ORM code runs
  against both.
- VLM inference is tested through `tests/fakes.py::FakeVLMBackend` (see
  "Qwen2.5-VL inference pipeline" above) via a `get_image_analysis_service` /
  `get_chat_service` dependency override in `tests/conftest.py` — every layer
  above the actual model call (prompts, parsing, persistence, endpoints,
  authorization) is exercised for real.
- `tests/test_preprocessing.py` and `tests/test_dataset_loader.py` run against
  synthetic images and a temp-directory taxonomy respectively, so they don't
  depend on the real `datasets/` tree being present, though the pipeline was
  also manually verified end-to-end against a real image from
  `datasets/raw/medicinal_leaf_images/`.

## Configuration reference

All settings are defined in `app/core/config.py` and overridable via `.env`.

**Sprint 2**: `JWT_SECRET_KEY`, `JWT_REFRESH_SECRET_KEY`,
`JWT_ACCESS_TOKEN_EXPIRE_MINUTES`, `JWT_REFRESH_TOKEN_EXPIRE_DAYS`,
`JWT_ISSUER`, `PASSWORD_MIN_LENGTH` and related complexity flags, and
`DEFAULT_USER_ROLE`.

**Sprint 3**: `DATASET_ROOT` / `DATASET_RAW_SUBDIR` / `DATASET_METADATA_SUBDIR`
(dataset location), `UPLOAD_DIR` / `MAX_UPLOAD_SIZE_MB` /
`ALLOWED_UPLOAD_CONTENT_TYPES` (upload storage), `PREPROCESS_TARGET_SIZE` /
`PREPROCESS_DENOISE_STRENGTH` / `PREPROCESS_CONTRAST_CLIP_LIMIT`
(preprocessing tuning), `VLM_MODEL_NAME` / `VLM_DEVICE` / `VLM_DTYPE` /
`VLM_MAX_NEW_TOKENS` / `VLM_TEMPERATURE` / `VLM_TOP_P` / `VLM_MIN_PIXELS` /
`VLM_MAX_PIXELS` / `VLM_TOP_K_CANDIDATES` (Qwen2.5-VL), and
`CHAT_MAX_HISTORY_MESSAGES` / `CHAT_MAX_NEW_TOKENS` (chat). See `.env.example`
for the full list.

**Rotate the JWT secrets before deploying to any shared or production
environment** — the checked-in defaults are placeholders only.

## Running real Qwen2.5-VL inference

This repository's dev/test environment has no GPU and does not download the
~3B-parameter model weights (multi-GB, would need `pip install torch
transformers accelerate qwen-vl-utils` from `requirements.txt`, which are
listed but were deliberately not installed here — see `HFQwenVLBackend` in
`app/inference/vlm/backend.py`). To run real inference:

1. `pip install -r requirements.txt` on a machine with a GPU (or accept slow
   CPU inference) and enough disk space for the model.
2. Set `VLM_MODEL_NAME` (defaults to `Qwen/Qwen2.5-VL-3B-Instruct`) and
   `VLM_DEVICE` (`auto`, `cuda`, `cpu`, ...) in `.env`.
3. Call `/predict` or `/chat` as normal — `get_vlm_backend()` lazily loads the
   model into a process-wide singleton on first use (set
   `VLM_LOAD_ON_STARTUP=true` to instead load it eagerly during app startup,
   trading a slower boot for a fast first request).

No code changes are needed to go from the fake-backend test suite to real
inference — `VLMInferencePipeline` only ever depends on the `VLMBackend`
protocol.

## Roadmap (future sprints)

1. ~~Authentication (JWT)~~ — done (Sprint 2).
2. ~~Image preprocessing pipeline~~ — done (Sprint 3).
3. ~~Vision-Language Model inference~~ — done (Sprint 3, `app/inference/vlm/`).
4. Retrieval-Augmented Generation (ChromaDB) — fills `RAGServicePlaceholder`
   in `app/api/deps.py`; will layer into `ChatService` and `VLMInferencePipeline.chat()`
   ahead of generation, per the isolation noted above.
5. Reporting.
