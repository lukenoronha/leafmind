"""LeafMind FastAPI application factory."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.exceptions import (
    LeafMindError,
    http_exception_handler,
    leafmind_exception_handler,
    unhandled_exception_handler,
    validation_exception_handler,
)
from app.core.logging import configure_logging
from app.db.seed import seed_roles
from app.db.session import check_database_connection
from app.middleware import RequestLoggingMiddleware, ResponseTimingMiddleware


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    configure_logging()
    logger.info("Starting {} v{} [{}]", settings.APP_NAME, settings.APP_VERSION, settings.ENVIRONMENT)

    if await check_database_connection():
        logger.info("Database connectivity check passed")
        try:
            await seed_roles()
        except Exception:
            logger.exception("Role seeding failed — has `alembic upgrade head` been run?")
    else:
        logger.warning("Database connectivity check failed — continuing startup in degraded mode")

    _warm_up_lazy_singletons()

    yield

    logger.info("Shutting down {}", settings.APP_NAME)


def _warm_up_lazy_singletons() -> None:
    """Opt-in eager load of the three heavy lazy singletons (VLM, embedding,
    ChromaDB), each gated by its own `Settings.*_LOAD_ON_STARTUP` flag
    (Sprint 7). All default to `False` — fully lazy, unchanged startup
    behavior unless explicitly opted into via `.env`. Failures are logged,
    not fatal: a warm-up failure (e.g. missing GPU/weights in this
    environment) should degrade to lazy-on-first-request, not crash startup.
    """
    if settings.VLM_LOAD_ON_STARTUP:
        try:
            from app.inference.vlm.backend import get_vlm_backend

            get_vlm_backend().warm_up()
        except Exception:
            logger.exception("VLM warm-up failed — will retry lazily on first request")

    if settings.RAG_EMBEDDING_LOAD_ON_STARTUP:
        try:
            from app.rag.embedding import get_embedding_backend

            get_embedding_backend().warm_up()
        except Exception:
            logger.exception("Embedding model warm-up failed — will retry lazily on first request")

    if settings.CHROMADB_LOAD_ON_STARTUP:
        try:
            from app.rag.vectorstore import get_vector_store

            get_vector_store().warm_up()
        except Exception:
            logger.exception("ChromaDB warm-up failed — will retry lazily on first request")


def create_application() -> FastAPI:
    app = FastAPI(
        title=settings.APP_NAME,
        description=settings.APP_DESCRIPTION,
        version=settings.APP_VERSION,
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
        lifespan=lifespan,
    )

    # Middleware order matters: outermost added last is evaluated first on request.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.add_middleware(ResponseTimingMiddleware)
    app.add_middleware(RequestLoggingMiddleware)

    app.add_exception_handler(LeafMindError, leafmind_exception_handler)
    app.add_exception_handler(StarletteHTTPException, http_exception_handler)
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    app.add_exception_handler(Exception, unhandled_exception_handler)

    app.include_router(api_router, prefix=settings.API_V1_PREFIX)

    return app


app = create_application()
