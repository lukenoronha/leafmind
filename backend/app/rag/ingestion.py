"""PDF text extraction and cleaning — the first stage of the RAG ingestion pipeline.

Lazily imports `fitz` (PyMuPDF) inside function bodies, mirroring
`app.inference.vlm.backend`'s lazy-import pattern for heavy/optional
dependencies: importing `app.rag.ingestion` itself never requires PyMuPDF to
be installed, only actually calling `extract_pages()` does.
"""

import re

from app.rag.schemas import ExtractedPage


class PDFExtractionError(Exception):
    """Raised when a PDF cannot be opened or parsed."""


def extract_pages(pdf_bytes: bytes) -> list[ExtractedPage]:
    """Extract cleaned per-page text (with best-effort chapter headings) from a PDF.

    Returns one `ExtractedPage` per page, in document order. Pages with no
    extractable text (e.g. scanned images with no OCR layer) are still
    returned with an empty `text` field so the caller can report an accurate
    `page_count`; they simply yield no chunks downstream.
    """
    try:
        import fitz  # PyMuPDF
    except ImportError as exc:  # pragma: no cover - exercised only without the dep installed
        raise PDFExtractionError(
            "PyMuPDF (pymupdf) is not installed; cannot parse PDF documents."
        ) from exc

    try:
        document = fitz.open(stream=pdf_bytes, filetype="pdf")
    except Exception as exc:
        raise PDFExtractionError(f"Could not open PDF: {exc}") from exc

    pages: list[ExtractedPage] = []
    current_chapter: str | None = None

    try:
        for page_index in range(document.page_count):
            page = document.load_page(page_index)
            raw_text = page.get_text("text")
            heading = _detect_chapter_heading(page)
            if heading:
                current_chapter = heading

            pages.append(
                ExtractedPage(
                    page_number=page_index + 1,
                    text=clean_text(raw_text),
                    chapter=current_chapter,
                )
            )
    finally:
        document.close()

    return pages


def clean_text(raw_text: str) -> str:
    """Normalize whitespace/line-wrapping artifacts from PDF text extraction.

    PDF text extraction frequently hard-wraps lines mid-sentence and leaves
    irregular runs of whitespace; collapsing these keeps chunk boundaries
    (computed on character count) meaningful and keeps embeddings from being
    diluted by formatting noise.
    """
    text = raw_text.replace("\r\n", "\n").replace("\r", "\n")
    # Join hyphenated line-wrap breaks: "medi-\ncinal" -> "medicinal"
    text = re.sub(r"(\w)-\n(\w)", r"\1\2", text)
    # Collapse single newlines (mid-paragraph wraps) into spaces, but keep
    # paragraph breaks (2+ newlines) as a single blank line.
    text = re.sub(r"\n{2,}", " ", text)
    text = re.sub(r"\n", " ", text)
    text = text.replace(" ", "\n\n")
    text = re.sub(r"[ \t]{2,}", " ", text)
    return text.strip()


def _detect_chapter_heading(page) -> str | None:
    """Best-effort chapter/section heading detection from font-size metadata.

    PyMuPDF's `"dict"` text extraction exposes per-span font size; a short
    line set in a larger font than the page's body text is a reasonable
    heuristic for a heading in typical botanical/reference PDFs. This is
    deliberately conservative (returns `None` freely) — a missing chapter is
    harmless (metadata field stays null), while a wrong one is misleading.
    """
    try:
        page_dict = page.get_text("dict")
    except Exception:
        return None

    spans = [
        span
        for block in page_dict.get("blocks", [])
        for line in block.get("lines", [])
        for span in line.get("spans", [])
        if span.get("text", "").strip()
    ]
    if not spans:
        return None

    body_size = _most_common_size(spans)

    for block in page_dict.get("blocks", []):
        for line in block.get("lines", []):
            line_spans = [s for s in line.get("spans", []) if s.get("text", "").strip()]
            if not line_spans:
                continue
            line_text = "".join(s["text"] for s in line_spans).strip()
            max_size = max(s.get("size", 0) for s in line_spans)
            if max_size >= body_size + 2 and 3 <= len(line_text) <= 120:
                return line_text

    return None


def _most_common_size(spans: list[dict]) -> float:
    sizes: dict[float, int] = {}
    for span in spans:
        size = round(span.get("size", 0), 1)
        sizes[size] = sizes.get(size, 0) + 1
    return max(sizes, key=lambda s: sizes[s]) if sizes else 0.0
