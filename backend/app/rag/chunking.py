"""Configurable text chunking — turns extracted pages into overlapping `TextChunk`s.

Chunk size/overlap are character-based and configurable (see
`Settings.RAG_CHUNK_SIZE_CHARS` / `RAG_CHUNK_OVERLAP_CHARS`) rather than
hardcoded, so ingestion behavior can be tuned/swept for evaluation without
code changes. Chunking is paragraph-aware: it prefers to break on paragraph
boundaries and only falls back to a hard character cut when a single
paragraph exceeds the configured chunk size.
"""

from app.rag.schemas import ExtractedPage, TextChunk


def chunk_pages(
    pages: list[ExtractedPage],
    *,
    document_name: str,
    chunk_size_chars: int,
    overlap_chars: int,
) -> list[TextChunk]:
    """Chunk a document's extracted pages into overlapping, metadata-tagged chunks.

    Chunks never span a page boundary — each chunk keeps a single
    `page_number`/`chapter` pair, which keeps retrieval metadata precise (the
    requirement is page-level attribution, not just document-level).
    """
    chunks: list[TextChunk] = []
    chunk_index = 0

    for page in pages:
        if not page.text.strip():
            continue

        pieces = _chunk_text(
            page.text, chunk_size_chars=chunk_size_chars, overlap_chars=overlap_chars
        )
        for piece in pieces:
            chunks.append(
                TextChunk(
                    text=piece,
                    chunk_index=chunk_index,
                    document_name=document_name,
                    page_number=page.page_number,
                    chapter=page.chapter,
                )
            )
            chunk_index += 1

    return chunks


def _chunk_text(text: str, *, chunk_size_chars: int, overlap_chars: int) -> list[str]:
    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
    if not paragraphs:
        return []

    pieces: list[str] = []
    current = ""

    for paragraph in paragraphs:
        candidate = f"{current}\n\n{paragraph}" if current else paragraph

        if len(candidate) <= chunk_size_chars:
            current = candidate
            continue

        if current:
            pieces.append(current)
            current = _overlap_tail(current, overlap_chars)
            candidate = f"{current}\n\n{paragraph}" if current else paragraph

        if len(candidate) <= chunk_size_chars:
            current = candidate
        else:
            # Single paragraph (plus any carried-over overlap) still exceeds
            # the limit — hard-split it on character boundaries.
            for hard_piece in _hard_split(candidate, chunk_size_chars, overlap_chars):
                pieces.append(hard_piece)
            current = ""

    if current:
        pieces.append(current)

    return pieces


def _overlap_tail(text: str, overlap_chars: int) -> str:
    if overlap_chars <= 0 or len(text) <= overlap_chars:
        return ""
    return text[-overlap_chars:]


def _hard_split(text: str, chunk_size_chars: int, overlap_chars: int) -> list[str]:
    pieces = []
    start = 0
    step = max(chunk_size_chars - overlap_chars, 1)
    while start < len(text):
        pieces.append(text[start : start + chunk_size_chars])
        start += step
    return pieces
