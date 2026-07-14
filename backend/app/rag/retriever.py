"""Semantic retrieval — embeds a query, searches the vector store, and applies
configurable Top-K / similarity-threshold / max-context-length policy.

This is the module layer referenced by the "modular retriever" requirement:
it depends only on the `EmbeddingBackend` and `VectorStore` protocols, so
swapping either (a different embedding model, or a non-Chroma vector DB)
requires no change here.
"""

import time

from loguru import logger

from app.core.config import Settings, get_settings
from app.rag.embedding import EmbeddingBackend, get_embedding_backend
from app.rag.schemas import RetrievalResult, RetrievedChunk
from app.rag.vectorstore import VectorStore, get_vector_store


class Retriever:
    """Turns a natural-language query into a ranked, filtered list of `RetrievedChunk`s."""

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

    def retrieve(
        self,
        query: str,
        *,
        top_k: int | None = None,
        similarity_threshold: float | None = None,
        max_context_chars: int | None = None,
    ) -> RetrievalResult:
        """Retrieve the most relevant chunks for `query`.

        Chunks are ranked by similarity, filtered to those meeting
        `similarity_threshold`, and then greedily accumulated up to
        `max_context_chars` (so a handful of long chunks can't silently blow
        past the generation prompt's context budget).
        """
        top_k = top_k if top_k is not None else self._settings.RAG_TOP_K
        if similarity_threshold is None:
            similarity_threshold = self._settings.RAG_SIMILARITY_THRESHOLD
        if max_context_chars is None:
            max_context_chars = self._settings.RAG_MAX_CONTEXT_CHARS

        start = time.perf_counter()

        [query_vector] = self._embedding_backend.embed([query])
        matches = self._vector_store.query(query_vector, top_k=top_k)

        chunks: list[RetrievedChunk] = []
        consumed_chars = 0

        for match in matches:
            # Cosine distance in [0, 2] -> similarity in [0, 1].
            similarity = 1.0 - (match.distance / 2.0)
            if similarity < similarity_threshold:
                continue
            if consumed_chars >= max_context_chars:
                break

            metadata = match.metadata
            chunks.append(
                RetrievedChunk(
                    chunk_id=match.id,
                    text=match.text,
                    score=round(similarity, 4),
                    document_id=str(metadata.get("document_id", "")),
                    document_name=str(metadata.get("document_name", "")),
                    page_number=metadata.get("page_number"),
                    chapter=metadata.get("chapter"),
                )
            )
            consumed_chars += len(match.text)

        retrieval_ms = (time.perf_counter() - start) * 1000

        logger.bind(
            retrieval_ms=round(retrieval_ms, 2),
            chunks_returned=len(chunks),
            top_k=top_k,
            similarity_threshold=similarity_threshold,
        ).info("Retrieval completed for query")

        return RetrievalResult(
            query=query,
            chunks=chunks,
            retrieval_ms=retrieval_ms,
            top_k=top_k,
            similarity_threshold=similarity_threshold,
        )
