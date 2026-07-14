"""RAG package: PDF ingestion, chunking, embedding, vector storage, retrieval, and prompt building.

`RAGService` (app.services.rag.service) is the DB-aware orchestration layer on
top of these modules — this package itself stays free of DB/HTTP concerns so
each piece (ingestion, chunking, embedding, vector store, retriever, prompt
builder) is independently testable and reusable, mirroring `app.inference.vlm`.
"""

from app.rag.retriever import Retriever
from app.rag.schemas import (
    EmbeddedChunk,
    ExtractedPage,
    IngestionResult,
    RAGAnswer,
    RetrievalResult,
    RetrievedChunk,
    TextChunk,
)

__all__ = [
    "Retriever",
    "ExtractedPage",
    "TextChunk",
    "EmbeddedChunk",
    "RetrievedChunk",
    "RetrievalResult",
    "RAGAnswer",
    "IngestionResult",
]
