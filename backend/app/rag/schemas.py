"""Plain dataclasses for the RAG pipeline — mirrors `app.inference.vlm.schemas`.

Kept dependency-light (no Pydantic/FastAPI coupling) so `app/rag/*` stays
reusable outside the web app (e.g. an offline reindex script or an IEEE
evaluation harness) and is trivially testable with fakes.
"""

from dataclasses import dataclass, field


@dataclass
class ExtractedPage:
    """Raw text extracted from a single PDF page, before cleaning/chunking."""

    page_number: int
    text: str
    chapter: str | None = None


@dataclass
class TextChunk:
    """One chunk of cleaned text ready for embedding, with source metadata."""

    text: str
    chunk_index: int
    document_name: str
    page_number: int | None = None
    chapter: str | None = None


@dataclass
class EmbeddedChunk:
    """A `TextChunk` paired with its embedding vector."""

    chunk: TextChunk
    vector: list[float]


@dataclass
class RetrievedChunk:
    """One retrieval hit: chunk text/metadata plus its similarity score.

    `chunk_id` is the `DocumentChunk.id` (also the Chroma document id), so
    callers can join back to the relational table if needed. `score` is a
    similarity in [0, 1] (higher is more similar) — see
    `app.rag.vectorstore.ChromaVectorStore` for the distance-to-similarity
    conversion, which keeps this contract backend-agnostic.
    """

    chunk_id: str
    text: str
    score: float
    document_id: str
    document_name: str
    page_number: int | None = None
    chapter: str | None = None


@dataclass
class RetrievalResult:
    """Full result of a single retrieval call, with timing for observability."""

    query: str
    chunks: list[RetrievedChunk]
    retrieval_ms: float
    top_k: int
    similarity_threshold: float


@dataclass
class RAGAnswer:
    """Full structured output of a single grounded-generation call."""

    response_text: str
    model_name: str
    inference_ms: float
    retrieval: RetrievalResult
    prompt_tokens: int | None = None
    completion_tokens: int | None = None


@dataclass
class IngestionResult:
    """Outcome of ingesting one document into the vector store."""

    document_id: str
    chunk_count: int
    page_count: int
    errors: list[str] = field(default_factory=list)
