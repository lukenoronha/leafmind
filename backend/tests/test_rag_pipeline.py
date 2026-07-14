"""Unit tests for the RAG package's pure modules: chunking, retrieval, prompt building."""

import pytest

from app.rag.chunking import chunk_pages
from app.rag.prompt_builder import build_context_block, build_rag_messages
from app.rag.retriever import Retriever
from app.rag.schemas import ExtractedPage, RetrievedChunk
from tests.fakes import FakeEmbeddingBackend, FakeVectorStore


def test_chunk_pages_splits_on_paragraphs_within_page():
    pages = [
        ExtractedPage(page_number=1, text="Para one.\n\nPara two.\n\nPara three.", chapter="Intro"),
    ]
    chunks = chunk_pages(pages, document_name="doc.pdf", chunk_size_chars=15, overlap_chars=0)

    assert len(chunks) >= 2
    assert all(c.page_number == 1 for c in chunks)
    assert all(c.chapter == "Intro" for c in chunks)
    assert all(c.document_name == "doc.pdf" for c in chunks)


def test_chunk_pages_never_spans_page_boundary():
    pages = [
        ExtractedPage(page_number=1, text="Short page one text.", chapter=None),
        ExtractedPage(page_number=2, text="Short page two text.", chapter=None),
    ]
    chunks = chunk_pages(pages, document_name="doc.pdf", chunk_size_chars=1000, overlap_chars=0)

    assert len(chunks) == 2
    assert chunks[0].page_number == 1
    assert chunks[1].page_number == 2


def test_chunk_pages_skips_blank_pages():
    pages = [
        ExtractedPage(page_number=1, text="   ", chapter=None),
        ExtractedPage(page_number=2, text="Real content here.", chapter=None),
    ]
    chunks = chunk_pages(pages, document_name="doc.pdf", chunk_size_chars=1000, overlap_chars=0)

    assert len(chunks) == 1
    assert chunks[0].page_number == 2


def test_retriever_applies_similarity_threshold():
    embedding_backend = FakeEmbeddingBackend()
    vector_store = FakeVectorStore()
    from app.rag.vectorstore import VectorRecord

    vector_store.upsert(
        [
            VectorRecord(
                id="chunk-1",
                vector=embedding_backend.embed(["neem medicinal plant leaves"])[0],
                text="Neem is used in traditional medicine.",
                metadata={"document_id": "doc-1", "document_name": "neem.pdf", "page_number": 1, "chapter": ""},
            ),
            VectorRecord(
                id="chunk-2",
                vector=embedding_backend.embed(["unrelated cooking recipe"])[0],
                text="This is a recipe for soup.",
                metadata={"document_id": "doc-2", "document_name": "recipes.pdf", "page_number": 3, "chapter": ""},
            ),
        ]
    )

    retriever = Retriever(embedding_backend=embedding_backend, vector_store=vector_store)
    result = retriever.retrieve("neem medicinal plant leaves", top_k=5, similarity_threshold=0.99)

    assert len(result.chunks) == 1
    assert result.chunks[0].chunk_id == "chunk-1"
    assert result.chunks[0].document_name == "neem.pdf"


def test_retriever_respects_max_context_chars():
    embedding_backend = FakeEmbeddingBackend()
    vector_store = FakeVectorStore()
    from app.rag.vectorstore import VectorRecord

    long_text = "leaf " * 500
    vector_store.upsert(
        [
            VectorRecord(
                id="chunk-1",
                vector=embedding_backend.embed(["leaf"])[0],
                text=long_text,
                metadata={"document_id": "doc-1", "document_name": "big.pdf", "page_number": 1, "chapter": ""},
            ),
            VectorRecord(
                id="chunk-2",
                vector=embedding_backend.embed(["leaf"])[0],
                text=long_text,
                metadata={"document_id": "doc-1", "document_name": "big.pdf", "page_number": 2, "chapter": ""},
            ),
        ]
    )

    retriever = Retriever(embedding_backend=embedding_backend, vector_store=vector_store)
    # Budget is smaller than a single chunk, so only the first (already
    # consumed >= budget afterward) chunk is included; the second is dropped.
    result = retriever.retrieve("leaf", top_k=5, similarity_threshold=0.0, max_context_chars=len(long_text) - 1)

    assert len(result.chunks) == 1
    assert result.chunks[0].chunk_id == "chunk-1"


def test_build_context_block_empty_when_no_chunks():
    assert "No relevant context" in build_context_block([])


def test_build_context_block_includes_source_and_page():
    chunk = RetrievedChunk(
        chunk_id="c1", text="Neem is antibacterial.", score=0.9,
        document_id="d1", document_name="Neem Handbook", page_number=12, chapter="Uses",
    )
    block = build_context_block([chunk])
    assert "Neem Handbook" in block
    assert "p. 12" in block
    assert "Uses" in block


def test_build_rag_messages_includes_predicted_plant_and_context():
    chunk = RetrievedChunk(
        chunk_id="c1", text="Neem is antibacterial.", score=0.9,
        document_id="d1", document_name="Neem Handbook", page_number=12, chapter=None,
    )
    messages = build_rag_messages(
        user_message="Is this plant medicinal?",
        retrieved_chunks=[chunk],
        history=[],
        predicted_plant="Azadirachta indica (confidence 0.91)",
    )

    combined = " ".join(str(m["content"]) for m in messages)
    assert "Azadirachta indica" in combined
    assert "Neem Handbook" in combined
    assert messages[-1]["content"] == "Is this plant medicinal?"
