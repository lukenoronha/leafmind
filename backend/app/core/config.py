"""Application configuration loaded from environment variables."""

from functools import lru_cache
from typing import Annotated, Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    """Central application settings, sourced from environment / .env file."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # --- Application metadata ---
    APP_NAME: str = "LeafMind"
    APP_DESCRIPTION: str = (
        "IEEE research-grade AI system for medicinal plant identification "
        "using Vision-Language Models and Retrieval-Augmented Generation."
    )
    APP_VERSION: str = "0.1.0"
    ENVIRONMENT: Literal["development", "staging", "production", "testing"] = "development"
    DEBUG: bool = True

    # --- API ---
    API_V1_PREFIX: str = "/api/v1"

    # --- CORS ---
    CORS_ORIGINS: Annotated[list[str], NoDecode] = ["http://localhost:3000", "http://localhost:8080"]

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def split_cors_origins(cls, value: str | list[str]) -> list[str]:
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value

    # --- Database ---
    DATABASE_URL: str = Field(
        default="postgresql+asyncpg://leafmind:leafmind@localhost:5432/leafmind",
        description="SQLAlchemy async connection string for PostgreSQL.",
    )
    DATABASE_ECHO: bool = False
    DATABASE_POOL_SIZE: int = 5
    DATABASE_MAX_OVERFLOW: int = 10

    # --- Logging ---
    LOG_LEVEL: str = "INFO"
    LOG_DIR: str = "logs"
    LOG_ROTATION: str = "10 MB"
    LOG_RETENTION: str = "14 days"
    LOG_SERIALIZE_JSON: bool = False

    # --- Security / JWT (Sprint 2: Authentication) ---
    JWT_SECRET_KEY: str = "changeme-not-for-production"
    JWT_REFRESH_SECRET_KEY: str = "changeme-refresh-not-for-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 30
    JWT_ISSUER: str = "leafmind-api"

    # --- Password policy ---
    PASSWORD_MIN_LENGTH: int = 8
    PASSWORD_REQUIRE_UPPERCASE: bool = True
    PASSWORD_REQUIRE_LOWERCASE: bool = True
    PASSWORD_REQUIRE_DIGIT: bool = True
    PASSWORD_REQUIRE_SPECIAL: bool = True

    # --- Default RBAC role assigned to new self-registrations ---
    DEFAULT_USER_ROLE: str = "user"

    # --- ChromaDB / RAG (Sprint 4: Retrieval-Augmented Generation) ---
    CHROMADB_HOST: str = "localhost"
    CHROMADB_PORT: int = 8001
    # Local, on-disk persistent client is the default so the whole pipeline is
    # runnable without a separate ChromaDB server; CHROMADB_HOST/PORT are kept
    # above for an optional future switch to a client/server deployment.
    CHROMADB_PERSIST_DIR: str = "chroma_data"
    CHROMADB_COLLECTION_NAME: str = "leafmind_documents"

    # Document ingestion storage (mirrors UPLOAD_DIR for images)
    DOCUMENT_UPLOAD_DIR: str = "documents"
    MAX_DOCUMENT_UPLOAD_SIZE_MB: int = 50
    ALLOWED_DOCUMENT_CONTENT_TYPES: Annotated[list[str], NoDecode] = ["application/pdf"]

    @field_validator("ALLOWED_DOCUMENT_CONTENT_TYPES", mode="before")
    @classmethod
    def split_document_content_types(cls, value: str | list[str]) -> list[str]:
        if isinstance(value, str):
            return [item.strip() for item in value.split(",") if item.strip()]
        return value

    # Chunking (configurable so evaluation runs can sweep these for IEEE writeup)
    RAG_CHUNK_SIZE_CHARS: int = 1200
    RAG_CHUNK_OVERLAP_CHARS: int = 200

    # Embedding model (sentence-transformers, lazily loaded — see app/rag/embedding.py)
    RAG_EMBEDDING_MODEL_NAME: str = "sentence-transformers/all-MiniLM-L6-v2"
    RAG_EMBEDDING_DEVICE: str = "auto"
    RAG_EMBEDDING_BATCH_SIZE: int = 32

    # Retrieval
    RAG_TOP_K: int = 5
    RAG_SIMILARITY_THRESHOLD: float = 0.25
    RAG_MAX_CONTEXT_CHARS: int = 6000

    # Generation (feeds into VLMInferencePipeline.chat via the prompt builder)
    RAG_MAX_NEW_TOKENS: int = 500

    # --- Dataset (Sprint 3: Image Analysis) ---
    DATASET_ROOT: str = "../datasets"
    DATASET_RAW_SUBDIR: str = "raw/medicinal_leaf_images"
    DATASET_METADATA_SUBDIR: str = "metadata"

    # --- Upload storage ---
    UPLOAD_DIR: str = "uploads"
    MAX_UPLOAD_SIZE_MB: int = 15
    ALLOWED_UPLOAD_CONTENT_TYPES: Annotated[list[str], NoDecode] = [
        "image/jpeg",
        "image/png",
        "image/webp",
    ]

    @field_validator("ALLOWED_UPLOAD_CONTENT_TYPES", mode="before")
    @classmethod
    def split_upload_content_types(cls, value: str | list[str]) -> list[str]:
        if isinstance(value, str):
            return [item.strip() for item in value.split(",") if item.strip()]
        return value

    # --- Image preprocessing pipeline ---
    PREPROCESS_TARGET_SIZE: int = 448
    PREPROCESS_DENOISE_STRENGTH: int = 5
    PREPROCESS_CONTRAST_CLIP_LIMIT: float = 2.0
    PREPROCESS_SAVE_INTERMEDIATE: bool = False

    # --- Vision-Language Model (Qwen2.5-VL) ---
    VLM_MODEL_NAME: str = "Qwen/Qwen2.5-VL-3B-Instruct"
    VLM_DEVICE: str = "auto"
    VLM_DTYPE: str = "auto"
    VLM_MAX_NEW_TOKENS: int = 512
    VLM_TEMPERATURE: float = 0.2
    VLM_TOP_P: float = 0.9
    VLM_MIN_PIXELS: int = 256 * 28 * 28
    VLM_MAX_PIXELS: int = 1280 * 28 * 28
    VLM_TOP_K_CANDIDATES: int = 3
    VLM_LOAD_ON_STARTUP: bool = False

    # --- Chat (VLM-only, pre-RAG) ---
    CHAT_MAX_HISTORY_MESSAGES: int = 10
    CHAT_MAX_NEW_TOKENS: int = 400

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT == "production"


@lru_cache
def get_settings() -> Settings:
    """Cached settings accessor — safe to call repeatedly (e.g. as a FastAPI dependency)."""
    return Settings()


settings = get_settings()
