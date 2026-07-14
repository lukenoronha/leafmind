"""RAGIngestionPipeline — orchestrates PDF extraction, chunking, embedding, and
vector-store indexing for a single document.

Pure "PDF bytes in, `IngestionResult` + per-chunk records out" — no DB
session, no HTTP concerns. `RAGService` (app/rag/service.py) is the layer that
persists `Document`/`DocumentChunk` rows and calls this pipeline, following
the same separation `VLMInferencePipeline` has from `ImageAnalysisService`.
"""

import uuid

from loguru import logger

from app.core.config import Settings, get_settings
from app.rag.chunking import chunk_pages
from app.rag.embedding import EmbeddingBackend, get_embedding_backend
from app.rag.ingestion import PDFExtractionError, extract_pages
from app.rag.schemas import TextChunk
from app.rag.vectorstore import VectorRecord, VectorStore, get_vector_store


class IngestionError(Exception):
    """Raised when a document cannot be extracted, embedded, or indexed."""


class RAGIngestionPipeline:
    """Parses a PDF, chunks it, embeds each chunk, and upserts into the vector store."""

    def __init__(
        self,
        *,
        embedding_backend: EmbeddingBackend | None = None,
        vector_store: VectorStore | None = None,
        settings: Settings | None = None,
    ):
        self._settings = settings or get_settings()
        self._embedding_backend = embedding_backend or get_embedding_backend()
        self._vector_store = vector_store or get_vector_store()

    def ingest(
        self, pdf_bytes: bytes, *, document_id: uuid.UUID, document_name: str
    ) -> tuple[list[TextChunk], list[str], int]:
        """Ingest one PDF. Returns (chunks, chunk_ids, page_count).

        `chunk_ids` are freshly generated UUIDs used both as the Chroma
        vector id and as the intended `DocumentChunk.id` — the caller
        persists rows with these same ids so the two stores stay joined.
        """
        try:
            pages = extract_pages(pdf_bytes)
        except PDFExtractionError as exc:
            raise IngestionError(str(exc)) from exc

        chunks = chunk_pages(
            pages,
            document_name=document_name,
            chunk_size_chars=self._settings.RAG_CHUNK_SIZE_CHARS,
            overlap_chars=self._settings.RAG_CHUNK_OVERLAP_CHARS,
        )

        if not chunks:
            logger.warning("Document '{}' produced no indexable text chunks", document_name)
            return [], [], len(pages)

        chunk_ids = [str(uuid.uuid4()) for _ in chunks]
        vectors = self._embedding_backend.embed([c.text for c in chunks])

        records = [
            VectorRecord(
                id=chunk_id,
                vector=vector,
                text=chunk.text,
                metadata={
                    "document_id": str(document_id),
                    "document_name": chunk.document_name,
                    "page_number": chunk.page_number,
                    "chapter": chunk.chapter or "",
                    "chunk_index": chunk.chunk_index,
                },
            )
            for chunk_id, chunk, vector in zip(chunk_ids, chunks, vectors, strict=False)
        ]

        self._vector_store.upsert(records)

        logger.bind(
            document_id=str(document_id), chunk_count=len(chunks), page_count=len(pages)
        ).info("Document ingested: {}", document_name)

        return chunks, chunk_ids, len(pages)
