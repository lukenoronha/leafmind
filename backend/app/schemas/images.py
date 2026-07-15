"""Request/response schemas for the image upload, prediction, and history API."""

import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class UploadResponse(BaseModel):
    image_id: uuid.UUID
    original_filename: str
    content_type: str
    size_bytes: int
    checksum_sha256: str
    created_at: datetime


class PredictRequest(BaseModel):
    image_id: uuid.UUID
    top_k: int = Field(default=3, ge=1, le=5)


class CandidateResponse(BaseModel):
    label: str
    confidence: float
    reasoning: str = ""


class PredictResponse(BaseModel):
    prediction_id: uuid.UUID
    image_id: uuid.UUID
    predicted_label: str
    confidence: float
    candidates: list[CandidateResponse]
    model_name: str
    preprocessing_ms: float
    inference_ms: float
    created_at: datetime


class HistoryItem(BaseModel):
    prediction_id: uuid.UUID
    image_id: uuid.UUID
    original_filename: str
    predicted_label: str
    confidence: float
    model_name: str
    is_saved: bool
    created_at: datetime


class HistoryResponse(BaseModel):
    items: list[HistoryItem]
    total: int
    limit: int
    offset: int


class UpdatePredictionSaveRequest(BaseModel):
    is_saved: bool
