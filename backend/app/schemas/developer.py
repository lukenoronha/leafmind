"""Request/response schemas for the developer API layer (Sprint 5: observability)."""

import uuid
from datetime import datetime

from pydantic import BaseModel


class PredictionMetadata(BaseModel):
    prediction_id: uuid.UUID
    image_id: uuid.UUID
    plant_name: str
    scientific_name: str
    confidence: float
    model_version: str
    timestamp: datetime
    candidates: list[dict]


class PredictionMetadataListResponse(BaseModel):
    items: list[PredictionMetadata]
    total: int
    limit: int
    offset: int


class PredictionTimingResponse(BaseModel):
    prediction_id: uuid.UUID
    preprocessing_ms: float
    inference_ms: float
    retrieval_ms: float | None
    total_ms: float


class ChatMessageTimingResponse(BaseModel):
    chat_message_id: uuid.UUID
    retrieval_ms: float | None
    prompt_construction_ms: float | None
    response_generation_ms: float | None
    total_ms: float


class AverageTimingsResponse(BaseModel):
    prediction_count: int
    avg_preprocessing_ms: float | None
    avg_prediction_inference_ms: float | None
    chat_turn_count: int
    avg_retrieval_ms: float | None
    avg_chat_inference_ms: float | None


class RAGMetadataSource(BaseModel):
    chunk_id: str
    document_id: str
    document_name: str
    page_number: int | None
    chapter: str | None
    score: float


class RAGMetadataResponse(BaseModel):
    chat_message_id: uuid.UUID
    retrieval_ms: float | None
    retrieved_chunk_count: int | None
    embedding_model: str
    retrieved_sources: list[RAGMetadataSource]


class PromptInspectorContextExcerpt(BaseModel):
    document_name: str
    page_number: int | None
    chapter: str | None
    score: float
    excerpt: str


class PromptInspectorMessage(BaseModel):
    role: str
    content: str


class PromptInspectorResponse(BaseModel):
    chat_message_id: uuid.UUID
    conversation_id: uuid.UUID
    user_question: str
    predicted_plant: str | None
    retrieved_context_excerpts: list[PromptInspectorContextExcerpt]
    prompt_template: str
    rendered_messages: list[PromptInspectorMessage]
    generated_response: str


class SystemStatusResponse(BaseModel):
    backend_healthy: bool
    database_healthy: bool
    chromadb_healthy: bool
    vector_count: int
    vlm_model_importable: bool
    vlm_model_loaded: bool
    embedding_model_importable: bool
    embedding_model_loaded: bool
    gpu_available: bool
    gpu_device_count: int
    gpu_device_names: list[str]
    cpu_percent: float
    memory_total_mb: float
    memory_used_mb: float
    memory_percent: float
    disk_total_gb: float
    disk_used_gb: float
    disk_percent: float


class LogEntryResponse(BaseModel):
    timestamp: datetime
    level: str
    message: str
    module: str
    function: str
    line: int
    extra: dict


class LogListResponse(BaseModel):
    items: list[LogEntryResponse]
    total: int
    limit: int
    offset: int
    query_ms: float


class AnalyticsResponse(BaseModel):
    total_uploads: int
    prediction_count: int
    avg_confidence: float | None
    avg_inference_ms: float | None
    avg_retrieval_ms: float | None
    indexed_documents: int
    total_chunks: int
    vector_count: int
