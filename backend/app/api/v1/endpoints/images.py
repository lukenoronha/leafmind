"""Image upload, prediction, and history endpoints — the Sprint 3 analysis pipeline.

Thin HTTP layer over `ImageAnalysisService`; all preprocessing/inference/
storage orchestration and structured latency logging live there.
"""

from fastapi import APIRouter, File, UploadFile, status

from app.api.deps import CurrentUserDep, ImageAnalysisServiceDep
from app.schemas.images import (
    CandidateResponse,
    HistoryItem,
    HistoryResponse,
    PredictRequest,
    PredictResponse,
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
    return PredictResponse(
        prediction_id=prediction.id,
        image_id=prediction.image_id,
        predicted_label=prediction.predicted_label,
        confidence=prediction.confidence,
        candidates=[CandidateResponse(**c) for c in prediction.candidates],
        model_name=prediction.model_name,
        preprocessing_ms=prediction.preprocessing_ms,
        inference_ms=prediction.inference_ms,
        created_at=prediction.created_at,
    )


@router.get(
    "/history",
    response_model=HistoryResponse,
    summary="List past predictions for the current user",
    description="Paginated history of this user's prior classification results, "
    "most recent first.",
)
async def get_history(
    current_user: CurrentUserDep,
    service: ImageAnalysisServiceDep,
    limit: int = 20,
    offset: int = 0,
) -> HistoryResponse:
    rows, total = await service.get_history(
        user=current_user, limit=min(limit, 100), offset=max(offset, 0)
    )
    items = [
        HistoryItem(
            prediction_id=prediction.id,
            image_id=image.id,
            original_filename=image.original_filename,
            predicted_label=prediction.predicted_label,
            confidence=prediction.confidence,
            model_name=prediction.model_name,
            created_at=prediction.created_at,
        )
        for prediction, image in rows
    ]
    return HistoryResponse(items=items, total=total, limit=limit, offset=offset)
