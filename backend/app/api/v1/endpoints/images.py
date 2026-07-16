"""Image upload, prediction, and history endpoints — the Sprint 3 analysis pipeline.

Thin HTTP layer over `ImageAnalysisService`; all preprocessing/inference/
storage orchestration and structured latency logging live there.
"""

import uuid

from fastapi import APIRouter, File, UploadFile, status

from app.api.deps import CurrentUserDep, ImageAnalysisServiceDep
from app.schemas.auth import MessageResponse
from app.schemas.images import (
    _LOW_CONFIDENCE_MESSAGE,
    CandidateResponse,
    HistoryItem,
    HistoryResponse,
    PredictionDetailResponse,
    PredictRequest,
    PredictResponse,
    UpdatePredictionSaveRequest,
    UploadResponse,
)

router = APIRouter(tags=["Image Analysis"])


@router.post(
    "/upload",
    response_model=UploadResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload a leaf image",
    description="Validates and persists an uploaded leaf photo. Returns an "
    "`image_id` to use with `/predict`.",
)
async def upload_image(
    current_user: CurrentUserDep,
    service: ImageAnalysisServiceDep,
    file: UploadFile = File(..., description="JPEG/PNG/WebP leaf photo."),
) -> UploadResponse:
    raw_bytes = await file.read()
    image = await service.upload(
        user=current_user,
        raw_bytes=raw_bytes,
        original_filename=file.filename or "upload.jpg",
        content_type=file.content_type or "application/octet-stream",
    )
    return UploadResponse(
        image_id=image.id,
        original_filename=image.original_filename,
        content_type=image.content_type,
        size_bytes=image.size_bytes,
        checksum_sha256=image.checksum_sha256,
        created_at=image.created_at,
    )


@router.post(
    "/predict",
    response_model=PredictResponse,
    summary="Run species classification on an uploaded image",
    description="Runs the full preprocessing pipeline followed by Qwen2.5-VL "
    "classification, and persists the structured result.",
)
async def predict(
    payload: PredictRequest,
    current_user: CurrentUserDep,
    service: ImageAnalysisServiceDep,
) -> PredictResponse:
    prediction = await service.predict(
        user=current_user, image_id=payload.image_id, top_k=payload.top_k
    )
    return PredictResponse.from_prediction(prediction)


@router.get(
    "/history",
    response_model=HistoryResponse,
    summary="List past predictions for the current user",
    description="Paginated history of this user's prior classification results, "
    "most recent first. Pass `saved=true` to list only bookmarked reports "
    "(powers the Saved Reports page).",
)
async def get_history(
    current_user: CurrentUserDep,
    service: ImageAnalysisServiceDep,
    limit: int = 20,
    offset: int = 0,
    saved: bool = False,
) -> HistoryResponse:
    rows, total = await service.get_history(
        user=current_user, limit=min(limit, 100), offset=max(offset, 0), saved_only=saved
    )
    items = [
        HistoryItem(
            prediction_id=prediction.id,
            image_id=image.id,
            original_filename=image.original_filename,
            predicted_label=prediction.predicted_label,
            confidence=prediction.confidence,
            model_name=prediction.model_name,
            is_saved=prediction.is_saved,
            created_at=prediction.created_at,
            status=prediction.status.value,
        )
        for prediction, image in rows
    ]
    return HistoryResponse(items=items, total=total, limit=limit, offset=offset)


@router.patch(
    "/predictions/{prediction_id}/save",
    response_model=HistoryItem,
    summary="Bookmark or unbookmark a prediction",
    description="Marks a past prediction as saved (or unsaves it), for the "
    "Saved Reports page. Only the prediction's owner may change this.",
)
async def set_prediction_saved(
    prediction_id: uuid.UUID,
    payload: UpdatePredictionSaveRequest,
    current_user: CurrentUserDep,
    service: ImageAnalysisServiceDep,
) -> HistoryItem:
    prediction, image = await service.set_saved(
        user=current_user, prediction_id=prediction_id, is_saved=payload.is_saved
    )
    return HistoryItem(
        prediction_id=prediction.id,
        image_id=image.id,
        original_filename=image.original_filename,
        predicted_label=prediction.predicted_label,
        confidence=prediction.confidence,
        model_name=prediction.model_name,
        is_saved=prediction.is_saved,
        created_at=prediction.created_at,
        status=prediction.status.value,
    )


@router.get(
    "/predictions/{prediction_id}",
    response_model=PredictionDetailResponse,
    summary="Get full detail for one past prediction",
    description="Returns the same full detail `/predict` does (candidates, "
    "timing) for a single past prediction, so a History/Saved Reports entry "
    "can reopen its original analysis session. Only the prediction's owner "
    "may fetch it.",
)
async def get_prediction_detail(
    prediction_id: uuid.UUID,
    current_user: CurrentUserDep,
    service: ImageAnalysisServiceDep,
) -> PredictionDetailResponse:
    prediction, image = await service.get_prediction_detail(
        user=current_user, prediction_id=prediction_id
    )
    is_low_confidence = prediction.status.value == "low_confidence"
    return PredictionDetailResponse(
        prediction_id=prediction.id,
        image_id=image.id,
        original_filename=image.original_filename,
        predicted_label=prediction.predicted_label,
        confidence=prediction.confidence,
        candidates=[CandidateResponse(**c) for c in prediction.candidates],
        model_name=prediction.model_name,
        preprocessing_ms=prediction.preprocessing_ms,
        inference_ms=prediction.inference_ms,
        created_at=prediction.created_at,
        is_saved=prediction.is_saved,
        status=prediction.status.value,
        message=_LOW_CONFIDENCE_MESSAGE if is_low_confidence else None,
    )


@router.delete(
    "/predictions/{prediction_id}",
    response_model=MessageResponse,
    summary="Permanently delete a prediction",
    description="Removes a past prediction (and its chat sources/candidates) "
    "from history and Saved Reports. Only the prediction's owner may delete "
    "it. The underlying uploaded image is not deleted.",
)
async def delete_prediction(
    prediction_id: uuid.UUID,
    current_user: CurrentUserDep,
    service: ImageAnalysisServiceDep,
) -> MessageResponse:
    await service.delete_prediction(user=current_user, prediction_id=prediction_id)
    return MessageResponse(message="Prediction deleted.")
