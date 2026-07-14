"""Request/response schemas for the admin API layer (Sprint 6)."""

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, EmailStr, Field

from app.schemas.auth import UserResponse

# --- User management ---


class AdminUserListResponse(BaseModel):
    items: list[UserResponse]
    total: int
    limit: int
    offset: int


class AdminUpdateUserRequest(BaseModel):
    full_name: str | None = Field(default=None, min_length=1, max_length=150)
    role: str | None = Field(default=None, description="One of: user, developer, admin.")


class AdminSetActiveRequest(BaseModel):
    is_active: bool


class AdminResetPasswordRequest(BaseModel):
    new_password: str = Field(..., min_length=1, max_length=128)


# --- Dataset management ---


class DatasetClassResponse(BaseModel):
    class_id: int
    training_label: str | None
    folder_name: str
    status: str
    display_name: str
    is_verified: bool


class DatasetClassListResponse(BaseModel):
    items: list[DatasetClassResponse]


class DatasetStatisticsResponse(BaseModel):
    total_classes: int
    verified_classes: int
    raw_dir_exists: bool
    raw_dir: str


# --- Knowledge base admin ---


class AdminDocumentResponse(BaseModel):
    document_id: uuid.UUID
    original_filename: str
    size_bytes: int
    status: str
    status_message: str | None
    page_count: int | None
    chunk_count: int
    created_at: datetime


class AdminDocumentListResponse(BaseModel):
    items: list[AdminDocumentResponse]
    total: int
    limit: int
    offset: int


class DocumentChunkResponse(BaseModel):
    chunk_id: uuid.UUID
    chunk_index: int
    content: str
    page_number: int | None
    chapter: str | None


class AdminDocumentDetailResponse(BaseModel):
    document: AdminDocumentResponse
    chunks: list[DocumentChunkResponse]


class AdminReindexRequest(BaseModel):
    document_id: uuid.UUID | None = None


class AdminReindexResponse(BaseModel):
    reindexed_count: int
    documents: list[AdminDocumentResponse]


class KnowledgeBaseStatusResponse(BaseModel):
    vector_store_ready: bool
    total_documents: int
    indexed_documents: int
    failed_documents: int
    total_chunks: int
    vector_count: int
    embedding_model: str
    collection_name: str


# --- Embedding management ---


class EmbeddingStatisticsResponse(BaseModel):
    name: str
    vector_count: int
    persist_dir: str
    distance_metric: str


class EmbeddingRebuildResponse(BaseModel):
    reindexed_documents: int
    vector_count: int


class EmbeddingClearResponse(BaseModel):
    vector_count: int


# --- Settings management ---


class AdminSettingResponse(BaseModel):
    key: str
    value: Any
    default_value: Any
    is_overridden: bool
    description: str
    updated_by: str | None
    updated_at: datetime | None


class AdminSettingListResponse(BaseModel):
    items: list[AdminSettingResponse]


class AdminUpdateSettingRequest(BaseModel):
    value: str = Field(
        ..., description="New value, serialized as a string and parsed per the setting's type."
    )


# --- System monitoring ---


class ChromaCollectionInfo(BaseModel):
    name: str | None
    vector_count: int
    persist_dir: str | None
    distance_metric: str | None


class AdminSystemStatusResponse(BaseModel):
    backend_healthy: bool
    uptime_seconds: float
    database_healthy: bool
    chromadb_healthy: bool
    chromadb_collection: ChromaCollectionInfo
    vlm_model_loaded: bool
    embedding_model_loaded: bool
    cpu_percent: float
    memory_total_mb: float
    memory_used_mb: float
    memory_percent: float
    disk_total_gb: float
    disk_used_gb: float
    disk_percent: float


# --- Activity log ---


class AdminActivityLogEntry(BaseModel):
    id: uuid.UUID
    actor_email: EmailStr
    action: str
    target_type: str | None
    target_id: str | None
    details: dict | None
    created_at: datetime


class AdminActivityLogListResponse(BaseModel):
    items: list[AdminActivityLogEntry]
    total: int
    limit: int
    offset: int
