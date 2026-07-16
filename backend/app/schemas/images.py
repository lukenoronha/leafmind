"""Request/response schemas for the image upload, prediction, and history API."""

import uuid
from datetime import datetime

from pydantic import BaseModel, Field

_LOW_CONFIDENCE_MESSAGE = (
    "Unable to confidently identify this plant. It may not belong to the "
    "supported medicinal plant dataset or the image quality may be insufficient."
)


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
    # Additive fields (Input Validation Layer): existing clients that only
    # read the fields above are unaffected.
    status: str = "confident"
    message: str | None = Field(
        default=None,
        description="Set when status is 'low_confidence' — a user-facing "
        "explanation the frontend can show instead of treating this as a "
        "confident species identification.",
    )

    @classmethod
    def from_prediction(cls, prediction) -> "PredictResponse":
        is_low_confidence = prediction.status.value == "low_confidence"
        return cls(
            prediction_id=prediction.id,
            image_id=prediction.image_id,
            predicted_label=prediction.predicted_label,
            confidence=prediction.confidence,
            candidates=[CandidateResponse(**c) for c in prediction.candidates],
            model_name=prediction.model_name,
            preprocessing_ms=prediction.preprocessing_ms,
            inference_ms=prediction.inference_ms,
            created_at=prediction.created_at,
            status=prediction.status.value,
            message=_LOW_CONFIDENCE_MESSAGE if is_low_confidence else None,
        )


class HistoryItem(BaseModel):
    prediction_id: uuid.UUID
    image_id: uuid.UUID
    original_filename: str
    predicted_label: str
    confidence: float
    model_name: str
    is_saved: bool
    created_at: datetime
    status: str = "confident"


class HistoryResponse(BaseModel):
    items: list[HistoryItem]
    total: int
    limit: int
    offset: int


class UpdatePredictionSaveRequest(BaseModel):
    is_saved: bool


class PredictionDetailResponse(BaseModel):
    """Full single-prediction detail — used to reopen a past analysis session
    from History/Saved Reports. Unlike `HistoryItem` (a slim list row), this
    includes the same fields `PredictResponse` returns at creation time
    (candidates, timing, token counts), so a reopened session can render the
    same prediction card as a live one.
    """

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
    is_saved: bool
    status: str = "confident"
    message: str | None = None
