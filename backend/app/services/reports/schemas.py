"""Plain dataclasses for report content — mirrors `app.rag.schemas`'s
dependency-light style so `ReportService` and `pdf_builder` share one
in-process representation that both `render_json`/`render_pdf` consume,
independent of the HTTP-facing Pydantic schemas in `app.schemas.reports`.
"""

import uuid
from dataclasses import dataclass, field
from datetime import datetime

from app.rag.schemas import RetrievedChunk


@dataclass
class CandidateReportRow:
    label: str
    confidence: float
    reasoning: str = ""


@dataclass
class PredictionReportData:
    """Everything needed to render one prediction's report (PDF or JSON)."""

    prediction_id: uuid.UUID
    image_id: uuid.UUID
    original_filename: str
    predicted_label: str
    confidence: float
    candidates: list[CandidateReportRow]
    model_name: str
    preprocessing_ms: float
    inference_ms: float
    created_at: datetime
    user_email: str
    disclaimer: str
    # None (no RAG chunks found for this species) vs [] (no documents at all
    # in the knowledge base) are both possible and rendered as an explicit
    # "not available" message — never fabricated content.
    related_knowledge: list[RetrievedChunk] = field(default_factory=list)
    knowledge_available: bool = False


@dataclass
class EvaluationReportData:
    """Everything needed to render one evaluation run's report (PDF or JSON)."""

    run_id: uuid.UUID
    run_type: str
    metrics: dict
    per_class_report: dict | None
    class_labels: list[str] | None
    sample_count: int
    duration_ms: float
    created_at: datetime
    disclaimer: str
