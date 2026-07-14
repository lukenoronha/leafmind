"""Vector store abstraction + a persistent ChromaDB implementation.

`VectorStore` is the seam that keeps the retriever/ingestion pipeline
decoupled from ChromaDB specifically — a future alternative backend (e.g.
pgvector, Qdrant, Pinecone) only needs to implement this protocol, following
the same pattern as `app.inference.vlm.backend.VLMBackend` and
`app.rag.embedding.EmbeddingBackend`. `chromadb` is imported lazily inside
`ChromaVectorStore` so importing this module never requires it to be
installed unless a real vector store is actually used.
"""

import threading
from dataclasses import dataclass
from typing import Protocol

from loguru import logger

from app.core.config import Settings, get_settings


class VectorStoreError(Exception):
    """Raised when the vector store fails to initialize, write, or query."""


@dataclass
class VectorRecord:
    """One embedded chunk ready to upsert into the vector store."""

    id: str
    vector: list[float]
    text: str
    metadata: dict


@dataclass
class VectorMatch:
    """One similarity-search hit. `distance` is backend-native (e.g. cosine distance).

    `vector` is only populated by `get_all()` (a full collection dump for
    offline training); `query()` leaves it `None` since callers doing
    similarity search only need the score, not the raw embedding.
    """

    id: str
    text: str
    distance: float
    metadata: dict
    vector: list[float] | None = None


class VectorStore(Protocol):
    """Minimal interface the RAG retriever/ingestion pipeline depends on."""

    def upsert(self, records: list[VectorRecord]) -> None: ...

    def query(self, vector: list[float], *, top_k: int) -> list[VectorMatch]: ...

    def get_all(self) -> list[VectorMatch]: ...

    def delete_by_document(self, document_id: str) -> None: ...

    def count(self) -> int: ...

    def clear_all(self) -> None: ...

    def get_collection_info(self) -> dict: ...


class ChromaVectorStore:
    """Persistent, on-disk ChromaDB collection.

    Uses `PersistentClient` (local on-disk storage under
    `Settings.CHROMADB_PERSIST_DIR`) rather than a client/server connection so
    the whole RAG pipeline runs without standing up a separate ChromaDB
    server; `CHROMADB_HOST`/`CHROMADB_PORT` remain available in settings for a
    future switch to `HttpClient` without changing this class's public
    interface.
    """

    def __init__(self, settings: Settings | None = None, *, collection_name: str | None = None):
        self._settings = settings or get_settings()
        self._collection_name = collection_name or self._settings.CHROMADB_COLLECTION_NAME
        self._client = None
        self._collection = None
        self._lock = threading.Lock()

    def warm_up(self) -> None:
        """Eagerly open the Chroma client/collection now rather than on first use.

        Used by `app.main`'s startup path when
        `Settings.CHROMADB_LOAD_ON_STARTUP` is enabled. Idempotent.
        """
        self._ensure_loaded()

    def _ensure_loaded(self) -> None:
        if self._collection is not None:
            return

        with self._lock:
            if self._collection is not None:
                return

            try:
                import chromadb
            except ImportError as exc:
                raise VectorStoreError(
                    "chromadb is not installed. Install the RAG extras "
                    "(`pip install -r requirements.txt`) to enable retrieval."
                ) from exc

            try:
                self._client = chromadb.PersistentClient(path=self._settings.CHROMADB_PERSIST_DIR)
                self._collection = self._client.get_or_create_collection(
                    name=self._collection_name,
                    metadata={"hnsw:space": "cosine"},
                )
            except Exception as exc:
                raise VectorStoreError(f"Failed to initialize ChromaDB: {exc}") from exc

            logger.info(
                "ChromaDB collection '{}' ready at '{}'",
                self._collection_name,
                self._settings.CHROMADB_PERSIST_DIR,
            )

    def upsert(self, records: list[VectorRecord]) -> None:
        if not records:
            return

        self._ensure_loaded()
        try:
            self._collection.upsert(
                ids=[r.id for r in records],
                embeddings=[r.vector for r in records],
                documents=[r.text for r in records],
                metadatas=[r.metadata for r in records],
            )
        except Exception as exc:
            raise VectorStoreError(f"Failed to upsert into ChromaDB: {exc}") from exc

    def query(self, vector: list[float], *, top_k: int) -> list[VectorMatch]:
        self._ensure_loaded()

        if self.count() == 0:
            return []

        try:
            result = self._collection.query(
                query_embeddings=[vector],
                n_results=top_k,
                include=["documents", "distances", "metadatas"],
            )
        except Exception as exc:
            raise VectorStoreError(f"Failed to query ChromaDB: {exc}") from exc

        ids = result.get("ids", [[]])[0]
        documents = result.get("documents", [[]])[0]
        distances = result.get("distances", [[]])[0]
        metadatas = result.get("metadatas", [[]])[0]

        return [
            VectorMatch(id=id_, text=doc, distance=dist, metadata=meta or {})
            for id_, doc, dist, meta in zip(ids, documents, distances, metadatas, strict=False)
        ]

    def get_all(self) -> list[VectorMatch]:
        """Dump every vector in the collection (e.g. for offline classifier training).

        `distance` is meaningless outside a similarity query, so it is set to
        0.0 for every returned `VectorMatch` — callers that need distances
        should use `query()` instead.
        """
        self._ensure_loaded()
        try:
            result = self._collection.get(include=["documents", "embeddings", "metadatas"])
        except Exception as exc:
            raise VectorStoreError(f"Failed to read all vectors from ChromaDB: {exc}") from exc

        ids = result.get("ids", [])
        documents = result.get("documents", [])
        embeddings = result.get("embeddings", [])
        metadatas = result.get("metadatas", [])

        return [
            VectorMatch(id=id_, text=doc, distance=0.0, metadata=meta or {}, vector=list(vec))
            for id_, doc, vec, meta in zip(ids, documents, embeddings, metadatas, strict=False)
        ]

    def delete_by_document(self, document_id: str) -> None:
        self._ensure_loaded()
        try:
            self._collection.delete(where={"document_id": document_id})
        except Exception as exc:
            raise VectorStoreError(
                f"Failed to delete document {document_id} from ChromaDB: {exc}"
            ) from exc

    def count(self) -> int:
        self._ensure_loaded()
        try:
            return self._collection.count()
        except Exception as exc:
            raise VectorStoreError(f"Failed to count ChromaDB collection: {exc}") from exc

    def clear_all(self) -> None:
        """Deletes every vector in the collection (admin "clear embeddings" action).

        Recreates the collection rather than deleting-by-empty-filter, since
        Chroma's `delete()` requires a `where`/`ids` filter to be non-empty —
        dropping and re-creating is the documented way to empty a collection.
        Distinct from `delete_by_document()`, which only removes one
        document's vectors; this is a full-collection wipe.
        """
        self._ensure_loaded()
        try:
            self._client.delete_collection(name=self._collection_name)
            self._collection = self._client.get_or_create_collection(
                name=self._collection_name,
                metadata={"hnsw:space": "cosine"},
            )
        except Exception as exc:
            raise VectorStoreError(f"Failed to clear ChromaDB collection: {exc}") from exc

    def get_collection_info(self) -> dict:
        """Read-only collection metadata for the admin Embedding Management view."""
        self._ensure_loaded()
        try:
            return {
                "name": self._collection.name,
                "vector_count": self._collection.count(),
                "persist_dir": self._settings.CHROMADB_PERSIST_DIR,
                "distance_metric": (self._collection.metadata or {}).get("hnsw:space", "unknown"),
            }
        except Exception as exc:
            raise VectorStoreError(f"Failed to read ChromaDB collection info: {exc}") from exc


_store_lock = threading.Lock()
_store_instance: ChromaVectorStore | None = None


def get_vector_store() -> ChromaVectorStore:
    """Process-wide lazy singleton, mirroring `get_vlm_backend()`/`get_embedding_backend()`."""
    global _store_instance
    if _store_instance is None:
        with _store_lock:
            if _store_instance is None:
                _store_instance = ChromaVectorStore(get_settings())
    return _store_instance


_image_store_lock = threading.Lock()
_image_store_instance: ChromaVectorStore | None = None


def get_image_vector_store() -> ChromaVectorStore:
    """Process-wide lazy singleton for the CLIP reference-image collection.

    A separate collection (`Settings.CLIP_COLLECTION_NAME`) from
    `get_vector_store()`'s text-chunk collection — same persistent Chroma
    client/on-disk store, different embedding space (CLIP image vectors vs.
    sentence-transformers text vectors), so they must not share a collection.
    """
    global _image_store_instance
    if _image_store_instance is None:
        with _image_store_lock:
            if _image_store_instance is None:
                settings = get_settings()
                _image_store_instance = ChromaVectorStore(
                    settings, collection_name=settings.CLIP_COLLECTION_NAME
                )
    return _image_store_instance
