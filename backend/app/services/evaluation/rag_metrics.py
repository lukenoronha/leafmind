"""Pure aggregation functions for RAG evaluation metrics.

Kept free of DB/SQLAlchemy concerns so these formulas are unit-testable
against hand-built data, independent of `EvaluationService`'s query layer.
Each function operates over a list of plain dicts shaped like
`ChatMessage.retrieved_sources` entries (`chunk_id`/`document_id`/
`document_name`/`page_number`/`chapter`/`score`), plus the assistant turn's
`content` text for citation coverage.
"""

import statistics


def mean_or_zero(values: list[float]) -> float:
    return round(statistics.mean(values), 4) if values else 0.0


def median_or_zero(values: list[float]) -> float:
    return round(statistics.median(values), 4) if values else 0.0


def percentile(values: list[float], pct: float) -> float:
    """Nearest-rank percentile (e.g. `pct=95` for p95). Returns 0.0 if empty."""
    if not values:
        return 0.0
    sorted_values = sorted(values)
    index = min(int(len(sorted_values) * (pct / 100)), len(sorted_values) - 1)
    return round(sorted_values[index], 4)


def context_relevance(turns_scores: list[list[float]], *, similarity_threshold: float) -> float:
    """Mean, across turns with >=1 retrieved chunk, of that turn's mean score
    among chunks meeting `similarity_threshold`.

    Uses the same threshold the retriever itself applies to decide what's
    "relevant" (i.e. what actually made it into the prompt), so this reflects
    the quality of context the model was actually given, not just raw
    similarity across all candidates considered.
    """
    per_turn_relevance = []
    for scores in turns_scores:
        if not scores:
            continue
        passing = [s for s in scores if s >= similarity_threshold]
        if passing:
            per_turn_relevance.append(statistics.mean(passing))

    return mean_or_zero(per_turn_relevance)


def citation_coverage(turns: list[tuple[str, list[str]]]) -> float:
    """Fraction of turns (with >=1 retrieved chunk) whose answer text cites at
    least one retrieved document by name.

    `turns` is a list of (assistant_content, retrieved_document_names) pairs,
    restricted to turns that had at least one retrieved chunk. Matching is a
    case-insensitive substring check against each document's name, which
    matches the RAG system prompt's own citation convention
    (`app.rag.prompt_builder`'s `(Source: <document_name>, p. <page>)`
    instruction) without requiring an exact-format parse.
    """
    eligible = [(content, names) for content, names in turns if names]
    if not eligible:
        return 0.0

    cited_count = 0
    for content, document_names in eligible:
        content_lower = content.lower()
        if any(name.lower() in content_lower for name in document_names if name):
            cited_count += 1

    return round(cited_count / len(eligible), 4)


def zero_hit_rate(retrieved_chunk_counts: list[int]) -> float:
    """Fraction of turns that retrieved zero chunks."""
    if not retrieved_chunk_counts:
        return 0.0
    zero_count = sum(1 for c in retrieved_chunk_counts if c == 0)
    return round(zero_count / len(retrieved_chunk_counts), 4)
