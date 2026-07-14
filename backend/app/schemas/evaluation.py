"""Request/response schemas for the Evaluation API (Sprint 7)."""

import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class ClassificationEvaluationRequest(BaseModel):
    sample_size_per_class: int | None = Field(
        default=None,
        ge=1,
        description="Images sampled per verified class. Defaults to "
        "Settings.EVAL_DEFAULT_SAMPLE_SIZE_PER_CLASS, capped at "
        "Settings.EVAL_MAX_SAMPLE_SIZE_PER_CLASS.",
    )
    classes: list[str] | None = Field(
        default=None, description="Restrict evaluation to these class display names; omit for all verified classes."
    )


class ClassificationEvaluationResponse(BaseModel):
    run_id: uuid.UUID
    accuracy: float
    precision_macro: float
    recall_macro: float
    f1_macro: float
    confusion_matrix: list[list[int]]
    class_labels: list[str]
    sample_count: int
    errors_count: int
    duration_ms: float
    created_at: datetime


class RAGEvaluationRequest(BaseModel):
    since: datetime | None = Field(
        default=None, description="Only aggregate chat turns created at/after this timestamp."
    )


class RAGEvaluationResponse(BaseModel):
    run_id: uuid.UUID
    avg_retrieval_ms: float
    median_retrieval_ms: float
    p95_retrieval_ms: float
    avg_similarity_score: float
    avg_retrieved_chunks: float
    zero_hit_rate: float
    context_relevance: float
    citation_coverage: float
    sample_count: int
    duration_ms: float
    created_at: datetime


class EvaluationRunSummary(BaseModel):
    run_id: uuid.UUID
    run_type: str
    sample_count: int
    duration_ms: float
    created_at: datetime


class EvaluationRunListResponse(BaseModel):
    items: list[EvaluationRunSummary]
    total: int
    limit: int
    offset: int


class EvaluationRunDetailResponse(BaseModel):
    """Superset schema covering both run types; fields not applicable to a
    given `run_type` are omitted from `metrics` (as persisted) but the
    envelope itself is uniform so `GET /evaluation/runs/{id}` has one
    response shape regardless of which kind of run it is."""

    run_id: uuid.UUID
    run_type: str
    metrics: dict
    per_class_report: dict | None
    class_labels: list[str] | None
    sample_size_per_class: int | None
    sample_count: int
    duration_ms: float
    created_at: datetime
