"""Request/response schemas for the RAG-grounded chat/query API (Sprint 4)."""

import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class RAGQueryRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=4000)
    conversation_id: uuid.UUID | None = Field(
        default=None, description="Omit to start a new conversation."
    )
    image_id: uuid.UUID | None = Field(
        default=None,
        description="Optional uploaded image to ground this conversation in "
        "(its most recent prediction is added as context).",
    )
    top_k: int | None = Field(
        default=None, ge=1, le=20, description="Overrides RAG_TOP_K for this query."
    )
    similarity_threshold: float | None = Field(
        default=None,
        ge=0.0,
        le=1.0,
        description="Overrides RAG_SIMILARITY_THRESHOLD for this query.",
    )
    max_context_chars: int | None = Field(
        default=None, ge=200, description="Overrides RAG_MAX_CONTEXT_CHARS for this query."
    )


class RAGMessageResponse(BaseModel):
    id: uuid.UUID
    role: str
    content: str
    created_at: datetime

    model_config = {"from_attributes": True}


class RetrievedChunkResponse(BaseModel):
    chunk_id: str
    document_id: str
    document_name: str
    page_number: int | None
    chapter: str | None
    score: float
    text: str


class RetrievalMetadata(BaseModel):
    retrieval_ms: float
    top_k: int
    similarity_threshold: float
    retrieved_chunks: list[RetrievedChunkResponse]


class RAGQueryResponse(BaseModel):
    conversation_id: uuid.UUID
    message: RAGMessageResponse
    model_name: str
    inference_ms: float
    retrieval: RetrievalMetadata


class RAGReindexRequest(BaseModel):
    document_id: uuid.UUID | None = Field(
        default=None, description="Omit to reindex every document in the knowledge base."
    )


class RAGReindexedDocument(BaseModel):
    document_id: uuid.UUID
    original_filename: str
    status: str
    chunk_count: int
    page_count: int | None


class RAGReindexResponse(BaseModel):
    reindexed: list[RAGReindexedDocument]


class RAGStatusResponse(BaseModel):
    vector_store_ready: bool
    total_documents: int
    indexed_documents: int
    failed_documents: int
    total_chunks: int
    vector_count: int
    embedding_model: str
    collection_name: str
