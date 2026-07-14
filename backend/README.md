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
> **Sprint 3** delivered the **Image Analysis Pipeline**: a configurable
> dataset loader over the medicinal leaf dataset, a modular image
> preprocessing pipeline, a from-scratch Qwen2.5-VL inference pipeline
> (model loading, prompt construction, prediction, confidence extraction), the
> `/upload`, `/predict`, `/history` endpoints, and a temporary VLM-only chat
> feature.
>
> **Sprint 4** delivered **Retrieval-Augmented Generation**: a
> ChromaDB-backed document knowledge base (PDF ingestion via PyMuPDF,
> configurable chunking, sentence embeddings, persistent vector storage,
> configurable Top-K/similarity-threshold/max-context retrieval), a prompt
> builder combining predicted plant + question + retrieved context +
> conversation history, and the `/rag/query`, `/rag/reindex`, `/rag/status`,
> `/documents/*` endpoints. The temporary Sprint 3 chat feature is fully
> replaced by grounded RAG generation.
>
> **Sprint 5** (this sprint) delivers the **Developer API + Observability
> layer**: pipeline timing metrics, prediction/RAG metadata, a sanitized
> Prompt Inspector, a System Status endpoint (DB/ChromaDB/model/GPU/CPU/
> memory/disk), filterable/paginated log retrieval, and aggregate analytics —
> all under `/developer/*`, gated to the `developer`/`admin` roles. Entirely
> read-only: no change to inference or retrieval behavior, only to what's
> exposed about it.

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
│   ├── rag/
│   │   ├── schemas.py             # Plain dataclasses: TextChunk, RetrievedChunk, RAGAnswer, ...
│   │   ├── ingestion.py           # PyMuPDF text extraction + cleaning + chapter-heading detection
│   │   ├── chunking.py            # Configurable, paragraph-aware, page-scoped chunking
│   │   ├── embedding.py           # EmbeddingBackend protocol + SentenceTransformerBackend
│   │   ├── vectorstore.py         # VectorStore protocol + ChromaVectorStore (persistent, on-disk)
│   │   ├── retriever.py           # Retriever — Top-K + similarity threshold + max-context policy
│   │   ├── prompt_builder.py      # Combines plant + question + context + history into messages
│   │   └── pipeline.py            # RAGIngestionPipeline — PDF bytes in, indexed chunks out
│   ├── documents/
│   │   └── storage.py             # DocumentStorage — on-disk persistence for uploaded PDFs
│   ├── schemas/
│   │   ├── health.py             # Health/status response models
│   │   ├── auth.py               # Register/login/refresh/change-password request+response models
│   │   ├── images.py             # Upload/predict/history request+response models
│   │   ├── rag.py                 # RAG query/reindex/status request+response models
│   │   ├── documents.py           # Document upload/list request+response models
│   │   └── developer.py           # Metrics/status/logs/analytics request+response models
│   ├── services/
│   │   ├── auth/service.py      # AuthService — all auth business logic lives here
│   │   ├── image_analysis/
│   │   │   └── service.py       # ImageAnalysisService — orchestrates upload/preprocess/infer
│   │   ├── rag/
│   │   │   └── service.py        # RAGService — grounded chat + document lifecycle (replaces ChatService)
│   │   └── developer/
│   │       ├── service.py        # DeveloperService — read-only metrics/status/logs/analytics aggregation
│   │       ├── system_metrics.py # psutil/GPU/model-availability introspection (no model loading)
│   │       └── log_reader.py     # Filters/paginates the structured.jsonl log sink
│   ├── api/
│   │   ├── deps.py               # DI seams: Settings, DB session, AuthService,
│   │   │                         #   get_current_user, require_role() RBAC factory,
│   │   │                         #   ImageAnalysisService, RAGService, DeveloperService
│   │   └── v1/
│   │       ├── router.py         # Aggregates all v1 routers
│   │       └── endpoints/
│   │           ├── health.py     # /health, /status
│   │           ├── auth.py       # /auth/register, /login, /logout, /refresh, /me, /change-password
│   │           ├── images.py    # /upload, /predict, /history
│   │           ├── rag.py        # /rag/query, /rag/reindex, /rag/status
│   │           ├── documents.py  # /documents/upload, /documents, /documents/{id}
│   │           └── developer.py  # /developer/* — metrics, system status, logs, analytics
├── alembic/                      # Migrations (roles/users/refresh_tokens, image-analysis, then RAG tables)
├── tests/                        # pytest suite (SQLite in-memory + fake VLM/embedding/vector backends)
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
- **DI scaffolding for future features.** `app/api/deps.py` provides real
  `ImageAnalysisServiceDep` (Sprint 3) and `RAGServiceDep` (Sprint 4, replacing
  the Sprint 3 `ChatServiceDep` placeholder).
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

### Grounded chat via RAGService (replaces the Sprint 3 temporary chat)

`app.services.rag.RAGService` is a **separate** service from
`ImageAnalysisService`, mirroring the isolation the Sprint 3 `ChatService` was
built with — retrieval is layered in as a step feeding
`VLMInferencePipeline.generate_from_messages()` ahead of generation, without
touching `ImageAnalysisService` or the `/upload`/`/predict`/`/history`
endpoints. Conversations are still grouped by a plain `conversation_id` UUID
(not yet a full `Conversation` table). Each turn optionally grounds itself in
an uploaded image's most recent `Prediction` (the "predicted plant" in the
prompt) *and* in the top retrieved chunks from the document knowledge base.

`RAGService` also owns the document lifecycle (`upload_document`, `reindex`,
`delete_document`, `list_documents`, `get_status`) since both concerns share
the same embedding/vector-store collaborators.

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

## Retrieval-Augmented Generation (Sprint 4)

### Pipeline overview

```
PDF bytes --> ingestion.extract_pages()  --> chunking.chunk_pages()  --> embedding.embed()  --> vectorstore.upsert()
              (PyMuPDF text + chapter          (configurable, paragraph-      (sentence-           (persistent
               heading detection)               aware, page-scoped)           transformers)         ChromaDB)

query      --> retriever.retrieve()  --> prompt_builder.build_rag_messages()  --> VLMInferencePipeline.generate_from_messages()
               (embed query, search              (plant + question +                     (Qwen2.5-VL)
                vector store, filter by           context + history)
                threshold, cap by max chars)
```

Every stage is its own module under `app/rag/`, each depending only on a
`Protocol` for the stage before it — none of them talk to the DB or FastAPI
directly. `app.services.rag.RAGService` is the only DB-aware layer, persisting
`Document`/`DocumentChunk` rows and `ChatMessage` turns around calls into
these pure modules — the same separation `VLMInferencePipeline` has from
`ImageAnalysisService`.

### PDF ingestion & chunking

`app.rag.ingestion.extract_pages()` uses PyMuPDF (lazily imported, like
`torch`/`transformers` in `HFQwenVLBackend`) to pull per-page text, normalize
PDF line-wrap artifacts (hyphenation joins, mid-paragraph newline collapsing),
and best-effort detect chapter/section headings from relative font size. Text
is chunked by `app.rag.chunking.chunk_pages()`: paragraph-aware, with
configurable `RAG_CHUNK_SIZE_CHARS`/`RAG_CHUNK_OVERLAP_CHARS`, and chunks
never span a page boundary so page-level source attribution stays exact.

### Embeddings & vector storage

`app.rag.embedding.SentenceTransformerBackend` (default model
`sentence-transformers/all-MiniLM-L6-v2`, configurable via
`RAG_EMBEDDING_MODEL_NAME`) is lazily loaded as a process-wide singleton,
exactly like `HFQwenVLBackend`. `app.rag.vectorstore.ChromaVectorStore` wraps
a **persistent, on-disk ChromaDB collection** (`CHROMADB_PERSIST_DIR`) using
cosine similarity — no separate ChromaDB server process is required to run
the whole pipeline. Both `EmbeddingBackend` and `VectorStore` are `Protocol`s,
so the retriever/ingestion pipeline are decoupled from ChromaDB and
sentence-transformers specifically: a future alternative vector DB (pgvector,
Qdrant, Pinecone) or embedding model only needs to implement the same
protocol, with no change to `Retriever` or `RAGIngestionPipeline`.

### Retrieval policy

`app.rag.retriever.Retriever.retrieve()` embeds the query, searches the
vector store for the top `RAG_TOP_K` matches, converts ChromaDB's cosine
distance to a `[0, 1]` similarity score, drops anything below
`RAG_SIMILARITY_THRESHOLD`, and then greedily accumulates chunks up to
`RAG_MAX_CONTEXT_CHARS` so a handful of long chunks can't silently blow past
the generation prompt's context budget. All three knobs are overridable
per-request via `POST /rag/query`'s `top_k`/`similarity_threshold`/
`max_context_chars` fields, in addition to their global `.env` defaults —
useful for IEEE evaluation sweeps without redeploying.

### Prompt construction

`app.rag.prompt_builder.build_rag_messages()` combines, in order: a system
prompt instructing the model to answer only from retrieved context and cite
sources; the predicted plant species for the conversation (if an image/
prediction is attached); the retrieved context block (source-attributed,
numbered); prior conversation history; and the user's question — in the same
Qwen2.5-VL chat-message format `app.inference.vlm.prompts` uses, so it flows
into the existing `VLMInferencePipeline` unchanged (via the new
`generate_from_messages()` method, which factors out `chat()`'s
generation/timing/logging so both prompt builders share one code path).

### Retrieval metadata & observability

Every `POST /rag/query` response includes a `retrieval` block: retrieval
timing (`retrieval_ms`), the effective `top_k`/`similarity_threshold`, and
each retrieved chunk's id, source document, page number, chapter, similarity
score, and text — enough to visualize *what* grounded an answer without a
second request. The same metadata (`retrieval_ms`, `retrieved_chunk_count`,
`retrieved_sources`) is persisted on the assistant's `ChatMessage` row for
later analysis. `GET /rag/status` reports vector-store health plus
document/chunk counts for dashboards.

### Document lifecycle

`POST /documents/upload` validates and stores a PDF (mirroring
`ImageStorage`'s content-addressed on-disk pattern), then immediately runs
the full ingestion pipeline, persisting a `Document` row (status: `pending` →
`indexing` → `indexed`/`failed`) and one `DocumentChunk` row per chunk.
`POST /rag/reindex` clears a document's (or every document's) existing chunks
and vectors and re-runs ingestion — useful after changing chunking/embedding
configuration. `DELETE /documents/{id}` removes the stored file, relational
chunk rows (cascade), and the corresponding ChromaDB vectors together.

### Testing without ChromaDB, sentence-transformers, or a GPU

`tests/fakes.py` adds `FakeEmbeddingBackend` (deterministic hash-based
vectors) and `FakeVectorStore` (in-memory cosine search), implementing the
same `EmbeddingBackend`/`VectorStore` protocols the real classes do — so
`Retriever`, `RAGIngestionPipeline`, and `RAGService` all run through their
real code paths in tests (chunking, prompt building, retrieval ranking,
threshold/context-length filtering) without ChromaDB, `sentence-transformers`,
or network access. `tests/test_rag_pipeline.py` covers the pure `app/rag/`
modules directly; `tests/test_rag_api.py` covers the full HTTP surface
end-to-end, including real PyMuPDF-generated PDF fixtures.

## Developer API & Observability (Sprint 5)

### Design

Every endpoint under `/developer/*` is read-only and additive: `DeveloperService`
(`app/services/developer/service.py`) only queries already-persisted
`Prediction`/`ChatMessage`/`Document`/`DocumentChunk` rows, calls
`check_database_connection()` and `ChromaVectorStore.count()` (both already
used by `/status` and `/rag/status`), and introspects the process via
`psutil`/`torch.cuda` — it never constructs or invokes `VLMInferencePipeline`,
`Retriever`, or `RAGIngestionPipeline`, so nothing about inference or
retrieval *behavior* changes. All routes are gated to the `developer`/`admin`
roles via `Depends(require_role(RoleName.DEVELOPER, RoleName.ADMIN))` applied
at the router level (`app/api/v1/endpoints/developer.py`), the same
`require_role` factory Sprint 2 introduced.

### Timing metrics & prediction/RAG metadata

- `GET /developer/predictions/{id}/metadata` — plant name, scientific name,
  confidence, model version, and timestamp. `plant_name`/`scientific_name`
  both map onto `Prediction.predicted_label` (the dataset's scientific-name
  label — there is no separate common-name field) and `model_version` maps
  onto `Prediction.model_name` (the tracked HF model identifier string) —
  no new columns were needed.
- `GET /developer/predictions/{id}/timing` — `preprocessing_ms`/`inference_ms`
  (already columns on `Prediction`) plus a computed `total_ms`.
- `GET /developer/chat-messages/{id}/timing` — `retrieval_ms`/
  `response_generation_ms` (already columns on `ChatMessage`, populated by
  `RAGService.send_message`) plus a computed `total_ms`. `prompt_construction_ms`
  is not separately timed by the pipeline (prompt building is sub-millisecond
  string formatting, not worth instrumenting) and is reported as `null`.
- `GET /developer/metrics/timings` — average preprocessing/inference/retrieval
  time across every persisted prediction and chat turn, computed with plain
  SQL `AVG()`/`COUNT()` aggregates.
- `GET /developer/chat-messages/{id}/rag-metadata` — retrieved chunk ids,
  document ids/names, page numbers, chapters, similarity scores (all already
  in `ChatMessage.retrieved_sources`, populated at generation time), plus
  `retrieval_ms` and the configured `RAG_EMBEDDING_MODEL_NAME`.

### Prompt Inspector

`GET /developer/chat-messages/{id}/prompt-inspector` reconstructs a sanitized
view of the prompt behind one assistant chat turn **without re-invoking the
model**: raw prompt text is not persisted (only the final response is), so
`DeveloperService.inspect_prompt()` re-derives the user's question (the prior
`ChatMessage` in the same conversation), the predicted plant (the linked
image's latest `Prediction`), and the retrieved context (chunk text refetched
from `DocumentChunk` by the ids already stored in `retrieved_sources`) — then
calls the *real* `app.rag.prompt_builder.build_rag_messages()` to render the
exact same message structure the pipeline used, purely for display.
`_sanitize_messages()` strips any non-text content (e.g. an embedded PIL
image) before the response ever leaves the service, so no binary payload or
raw tensor is exposed — only the text prompt structure, question, context
excerpts (truncated to 500 chars each), and response.

### System Status

`GET /developer/system-status` aggregates:

- **Backend**: always `true` if the request completed.
- **Database**: `check_database_connection()` (same probe `/status` uses).
- **ChromaDB**: `ChromaVectorStore.count()` succeeding/failing.
- **Model availability**: whether `transformers`/`torch` (VLM) and
  `sentence_transformers` (embeddings) are importable, and whether their
  process-wide singletons have already been loaded — all via
  `app/services/developer/system_metrics.py`, which never triggers a model
  load itself (loading only happens lazily on the first real `/predict` or
  `/rag/query`/`/documents/upload` call, per the existing Sprint 3/4
  convention).
- **GPU**: `torch.cuda.is_available()`/`device_count()`/`get_device_name()`,
  wrapped in try/except so a missing `torch` or no-GPU environment reports
  `gpu_available: false` rather than erroring.
- **CPU/memory/disk**: `psutil.cpu_percent()`, `psutil.virtual_memory()`,
  `psutil.disk_usage()` — a new lightweight dependency (Sprint 5 is the first
  to need system-resource introspection).

### Log retrieval

Loguru's existing sinks (`logs/leafmind.log`, `logs/errors.log`) are
human-readable text by default (`LOG_SERIALIZE_JSON=False`), which isn't a
stable format to filter/paginate against. `app.core.logging.configure_logging()`
gained one new, purely additive sink — `logs/structured.jsonl` (`serialize=True`,
same rotation/retention as the others) — so `GET /developer/logs` has a stable
machine-readable source. `app/services/developer/log_reader.py::LogReader`
reads and parses that file, filtering by `level` and/or free-text `search`
across the message, then paginates newest-first. Structured context already
attached via `logger.bind(...)` throughout `RAGService`/`ImageAnalysisService`
(e.g. `user_id`, `inference_ms`, `retrieval_ms`) surfaces as the `extra` field
on each log entry.

### Analytics

`GET /developer/analytics` aggregates, via plain SQL: total uploads,
prediction count, average confidence, average inference time, average
retrieval time, indexed document count, total chunk count, and the live
ChromaDB vector count (`ChromaVectorStore.count()`).

### Testing

`tests/test_developer_api.py` covers the full `/developer/*` HTTP surface,
including RBAC enforcement (a plain `user`-role token gets `403`). A new
`developer_headers` fixture in `tests/conftest.py` registers a user and
promotes their role directly in the test DB (registration always assigns
`DEFAULT_USER_ROLE`), since no endpoint currently exposes role assignment.
`DeveloperService`'s `vector_store` dependency reuses the same
`FakeVectorStore` Sprint 4 introduced; no new fakes were needed for the
timing/metadata/analytics endpoints since they're plain SQL over the test
SQLite DB.

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
| POST   | `/api/v1/rag/query`         | Yes (bearer)   | Grounded RAG chat turn — retrieval + Qwen2.5-VL generation. |
| POST   | `/api/v1/rag/reindex`       | Yes (bearer)   | Re-run ingestion for one document or the whole knowledge base. |
| GET    | `/api/v1/rag/status`        | Yes (bearer)   | Vector store health + document/chunk counts.                |
| POST   | `/api/v1/documents/upload`  | Yes (bearer)   | Upload + parse/chunk/embed/index a PDF source document.     |
| GET    | `/api/v1/documents`         | Yes (bearer)   | Paginated list of ingested documents.                        |
| DELETE | `/api/v1/documents/{id}`    | Yes (bearer)   | Delete a document, its chunks, and its vectors.              |
| GET    | `/api/v1/developer/predictions/{id}/metadata` | Dev/Admin | Plant name, scientific name, confidence, model version, timestamp. |
| GET    | `/api/v1/developer/predictions`     | Dev/Admin | Paginated prediction metadata across all users.        |
| GET    | `/api/v1/developer/predictions/{id}/timing` | Dev/Admin | Preprocessing/inference/total latency for one prediction. |
| GET    | `/api/v1/developer/chat-messages/{id}/timing` | Dev/Admin | Retrieval/generation/total latency for one chat turn. |
| GET    | `/api/v1/developer/metrics/timings` | Dev/Admin | Average timings across all persisted predictions/chat turns. |
| GET    | `/api/v1/developer/chat-messages/{id}/rag-metadata` | Dev/Admin | Retrieved chunks, scores, sources, embedding model for one chat turn. |
| GET    | `/api/v1/developer/chat-messages/{id}/prompt-inspector` | Dev/Admin | Sanitized question/context/prompt/response for one chat turn. |
| GET    | `/api/v1/developer/system-status`   | Dev/Admin | DB/ChromaDB/model/GPU/CPU/memory/disk status.          |
| GET    | `/api/v1/developer/logs`            | Dev/Admin | Filterable, paginated structured log entries.          |
| GET    | `/api/v1/developer/analytics`       | Dev/Admin | Aggregate prediction/RAG statistics.                    |

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
3. `9c3d21a7e9f4_add_rag_tables.py` (Sprint 4) — `documents`, `document_chunks`,
   plus additive nullable `retrieval_ms`/`retrieved_chunk_count`/
   `retrieved_sources` columns on `chat_messages` so grounded assistant turns
   can record retrieval metadata. The corresponding vector embeddings live in
   a separate ChromaDB persistent collection (`app/rag/vectorstore.py`), keyed
   by `document_chunks.id` — not in PostgreSQL.

Sprint 5 introduced no new tables or columns — the developer API is a purely
read-only aggregation layer over data Sprints 3–4 already persist.

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

The full suite (86 tests as of Sprint 5) runs against an in-memory SQLite
database via a `get_db_session` dependency override (`tests/conftest.py`), so
it requires **no external PostgreSQL/ChromaDB instance and no VLM/embedding
model weights or GPU**:

- Models use a portable `GUID` type (`app/models/mixins.py`) mapping to native
  `UUID` on PostgreSQL and `CHAR(36)` on SQLite, so the same ORM code runs
  against both.
- VLM inference is tested through `tests/fakes.py::FakeVLMBackend` (see
  "Qwen2.5-VL inference pipeline" above); retrieval is tested through
  `FakeEmbeddingBackend` (deterministic hash-based vectors) and
  `FakeVectorStore` (in-memory cosine search) — all injected via a
  `get_image_analysis_service` / `get_rag_service` dependency override in
  `tests/conftest.py`. Every layer above the actual model/embedding/vector-db
  calls (prompts, chunking, retrieval ranking, persistence, endpoints,
  authorization) is exercised for real.
- `tests/test_rag_pipeline.py` unit-tests the pure `app/rag/` modules
  (chunking, retrieval threshold/context-length filtering, prompt building)
  directly; `tests/test_rag_api.py` covers the full `/rag/*` and
  `/documents/*` HTTP surface end-to-end, including real PyMuPDF-generated
  PDF fixtures (PyMuPDF itself is a real, lightweight dependency — only the
  embedding model and vector DB are faked).
- `tests/test_preprocessing.py` and `tests/test_dataset_loader.py` run against
  synthetic images and a temp-directory taxonomy respectively, so they don't
  depend on the real `datasets/` tree being present, though the pipeline was
  also manually verified end-to-end against a real image from
  `datasets/raw/medicinal_leaf_images/`.
- `tests/test_developer_api.py` covers the full `/developer/*` HTTP surface,
  including RBAC enforcement via a `developer_headers` fixture that promotes
  a freshly registered user's role directly in the test DB.

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
`CHAT_MAX_HISTORY_MESSAGES` (conversation history window, shared with RAG chat).

**Sprint 4**: `CHROMADB_PERSIST_DIR` / `CHROMADB_COLLECTION_NAME` (vector
store; `CHROMADB_HOST` / `CHROMADB_PORT` are reserved for a future
client/server switch), `DOCUMENT_UPLOAD_DIR` / `MAX_DOCUMENT_UPLOAD_SIZE_MB` /
`ALLOWED_DOCUMENT_CONTENT_TYPES` (document storage), `RAG_CHUNK_SIZE_CHARS` /
`RAG_CHUNK_OVERLAP_CHARS` (chunking), `RAG_EMBEDDING_MODEL_NAME` /
`RAG_EMBEDDING_DEVICE` / `RAG_EMBEDDING_BATCH_SIZE` (embeddings),
`RAG_TOP_K` / `RAG_SIMILARITY_THRESHOLD` / `RAG_MAX_CONTEXT_CHARS`
(retrieval — also overridable per-request), and `RAG_MAX_NEW_TOKENS`
(generation). See `.env.example` for the full list.

**Sprint 5**: no new settings — the developer API reuses `LOG_DIR` (for the
new `structured.jsonl` sink) and existing DB/ChromaDB/model settings for
introspection.

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

## Running real RAG retrieval (ChromaDB + sentence-transformers)

Like the VLM backend, `chromadb` and `sentence-transformers` are listed in
`requirements.txt` but not required just to boot the app or run the test
suite (which use `FakeVectorStore`/`FakeEmbeddingBackend`). To index and
retrieve against real documents:

1. `pip install -r requirements.txt` (downloads the small
   `all-MiniLM-L6-v2` embedding model on first use — no GPU required, though
   one will be used automatically if available).
2. Set `RAG_EMBEDDING_MODEL_NAME` / `RAG_EMBEDDING_DEVICE` and
   `CHROMADB_PERSIST_DIR` in `.env` if you want non-default values.
3. Call `POST /documents/upload` with a PDF — `get_embedding_backend()` and
   `get_vector_store()` lazily initialize process-wide singletons on first
   use, mirroring `get_vlm_backend()`.
4. Call `POST /rag/query` as normal.

No code changes are needed to go from the fake-backend test suite to real
retrieval — `Retriever` and `RAGIngestionPipeline` only ever depend on the
`EmbeddingBackend` and `VectorStore` protocols.

## Roadmap (future sprints)

1. ~~Authentication (JWT)~~ — done (Sprint 2).
2. ~~Image preprocessing pipeline~~ — done (Sprint 3).
3. ~~Vision-Language Model inference~~ — done (Sprint 3, `app/inference/vlm/`).
4. ~~Retrieval-Augmented Generation (ChromaDB)~~ — done (Sprint 4, `app/rag/` +
   `app.services.rag.RAGService`, replacing the Sprint 3 `ChatService`).
5. ~~Developer API + Observability~~ — done (Sprint 5, `app/services/developer/`
   + `/developer/*`, gated to `developer`/`admin` roles).
6. Reporting.
