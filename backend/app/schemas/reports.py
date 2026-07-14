"""Request/response schemas for the Reports API (Sprint 7) — JSON report bodies.

PDF responses return raw `application/pdf` bytes (see `endpoints/reports.py`)
and have no Pydantic schema; these schemas cover only `?format=json`, and
mirror the PDF's content field-for-field so both formats carry identical
information.
"""

import uuid
from datetime import datetime

from pydantic import BaseModel

from app.schemas.images import CandidateResponse


class RelatedKnowledgeChunk(BaseModel):
    document_name: str
    page_number: int | None
    chapter: str | None
    score: float
    text: str


class PredictionReportResponse(BaseModel):
    prediction_id: uuid.UUID
    image_id: uuid.UUID
    original_filename: str
    predicted_label: str
    confidence: float
    candidates: list[CandidateResponse]
    model_name: str
    preprocessing_ms: float
    inference_ms: float
    created_at: datetime
    user_email: str
    disclaimer: str
    knowledge_available: bool
    related_knowledge: list[RelatedKnowledgeChunk]


class EvaluationReportResponse(BaseModel):
    run_id: uuid.UUID
    run_type: str
    metrics: dict
    per_class_report: dict | None
    class_labels: list[str] | None
    sample_count: int
    duration_ms: float
    created_at: datetime
    disclaimer: str
