"""ImageAnalysisService — orchestrates upload storage, preprocessing, inference, and history.

Mirrors the Sprint 2 pattern (`AuthService`): a single stateless-per-call
service class, constructed with a DB session, that routers depend on via
`app.api.deps`. All cross-cutting concerns (structured logging of latency at
each stage, DB persistence, error translation to `LeafMindError` subclasses)
live here — routers stay a thin HTTP shim.
"""

import asyncio
import time
import uuid

from loguru import logger
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import InputValidationError, LeafMindError
from app.datasets.loader import DatasetLoader
from app.images.preprocessing import ImagePreprocessingPipeline
from app.images.preprocessing.content_validation import ImageQualityError, assess_quality
from app.images.preprocessing.steps import PreprocessingError, load_image_rgb
from app.images.storage import ImageStorage, ImageTooLargeError, UnsupportedImageTypeError
from app.inference.vlm.pipeline import InferenceError, VLMInferencePipeline
from app.models.prediction import Prediction, PredictionStatus
from app.models.uploaded_image import UploadedImage
from app.models.user import User

_UNKNOWN_LABEL = "unknown"


class ImageAnalysisError(LeafMindError):
    """Base class for upload/preprocessing/inference failures (maps to 400/422/500)."""


class InvalidUploadError(ImageAnalysisError):
    def __init__(self, message: str) -> None:
        super().__init__(message, status_code=400)


class ImagePreprocessingFailedError(ImageAnalysisError):
    def __init__(self, message: str) -> None:
        super().__init__(f"Image preprocessing failed: {message}", status_code=422)


class InferenceFailedError(ImageAnalysisError):
    def __init__(self, message: str) -> None:
        super().__init__(f"Model inference failed: {message}", status_code=502)


class ImageNotFoundError(ImageAnalysisError):
    def __init__(self) -> None:
        super().__init__("Image not found.", status_code=404)


class PoorImageQualityError(InputValidationError):
    def __init__(self, message: str) -> None:
        super().__init__(
            "The uploaded image quality is insufficient for reliable identification. "
            "Please upload a clearer image.",
            validation_stage="poor_quality",
        )
        self.detail = message


class LeafNotDetectedError(InputValidationError):
    def __init__(self) -> None:
        super().__init__(
            "This image does not appear to contain a medicinal plant leaf. "
            "Please upload a clear image of a single leaf.",
            validation_stage="leaf_not_detected",
        )


class MultipleLeavesDetectedError(InputValidationError):
    def __init__(self, leaf_count: int) -> None:
        super().__init__(
            "Multiple leaves detected. Please upload a clear image containing one leaf.",
            validation_stage="multiple_leaves",
        )
        self.leaf_count = leaf_count


class LeafOccludedError(InputValidationError):
    def __init__(self) -> None:
        super().__init__(
            "The uploaded image quality is insufficient for reliable identification. "
            "Please upload a clearer image.",
            validation_stage="poor_quality",
        )


class ImageAnalysisService:
    """Coordinates `ImageStorage`, `ImagePreprocessingPipeline`, and `VLMInferencePipeline`.

    Each collaborator remains independently usable/testable — this class only
    wires them together and persists results, which is what keeps preprocessing,
    inference, and storage swappable (e.g. for Sprint 4 RAG-augmented inference)
    without touching each other's internals.
    """

    def __init__(
        self,
        db: AsyncSession,
        *,
        storage: ImageStorage | None = None,
        preprocessing: ImagePreprocessingPipeline | None = None,
        inference: VLMInferencePipeline | None = None,
        dataset_loader: DatasetLoader | None = None,
    ):
        self.db = db
        self._storage = storage or ImageStorage()
        self._preprocessing = preprocessing or ImagePreprocessingPipeline()
        self._inference = inference  # lazily resolved in predict() if not injected
        self._dataset_loader = dataset_loader

    async def upload(
        self, *, user: User, raw_bytes: bytes, original_filename: str, content_type: str
    ) -> UploadedImage:
        upload_start = time.perf_counter()

        try:
            self._storage.validate_upload(content_type=content_type, size_bytes=len(raw_bytes))
            stored_path, checksum = self._storage.save(
                raw_bytes=raw_bytes, original_filename=original_filename
            )
        except (UnsupportedImageTypeError, ImageTooLargeError) as exc:
            logger.warning("Upload rejected for user={}: {}", user.email, exc)
            raise InvalidUploadError(str(exc)) from exc

        image = UploadedImage(
            user_id=user.id,
            original_filename=original_filename,
            stored_path=str(stored_path),
            content_type=content_type,
            size_bytes=len(raw_bytes),
            checksum_sha256=checksum,
        )
        self.db.add(image)
        await self.db.commit()
        await self.db.refresh(image)

        upload_ms = (time.perf_counter() - upload_start) * 1000
        logger.bind(
            user_id=str(user.id), image_id=str(image.id), upload_ms=round(upload_ms, 2)
        ).info("Image uploaded: {} ({} bytes)", original_filename, len(raw_bytes))

        return image

    async def predict(self, *, user: User, image_id: uuid.UUID, top_k: int = 3) -> Prediction:
        image = await self._get_owned_image(user=user, image_id=image_id)

        raw_bytes = self._storage.read(image.stored_path)

        # Quality (blur/lighting) is assessed on the raw decoded image, before
        # the preprocessing pipeline's own enhancement steps (denoise,
        # sharpen, contrast) run — those steps would otherwise mask exactly
        # the defects this check exists to catch.
        try:
            decoded_image = load_image_rgb(raw_bytes)
        except PreprocessingError as exc:
            logger.error("Decoding failed for image_id={}: {}", image_id, exc)
            raise ImagePreprocessingFailedError(str(exc)) from exc
        self._validate_image_quality(user=user, image_id=image_id, image=decoded_image)

        try:
            preprocessing_result = self._preprocessing.run(raw_bytes)
        except PreprocessingError as exc:
            logger.error("Preprocessing failed for image_id={}: {}", image_id, exc)
            raise ImagePreprocessingFailedError(str(exc)) from exc

        inference_pipeline = self._inference or VLMInferencePipeline()

        await self._validate_leaf_content(
            user=user, image_id=image_id, inference_pipeline=inference_pipeline,
            pil_image=preprocessing_result.pil_image,
        )

        candidate_labels = self._get_candidate_labels()

        try:
            # classify() blocks on CPU-bound model loading/generation; running
            # it in a worker thread keeps the event loop free to serve other
            # requests (e.g. login) while this one is in progress.
            classification = await asyncio.to_thread(
                inference_pipeline.classify,
                preprocessing_result.pil_image,
                candidate_labels=candidate_labels,
                top_k=top_k,
            )
        except InferenceError as exc:
            logger.error("Inference failed for image_id={}: {}", image_id, exc)
            raise InferenceFailedError(str(exc)) from exc

        status = self._resolve_prediction_status(
            user=user,
            image_id=image_id,
            label=classification.top_prediction.label,
            confidence=classification.top_prediction.confidence,
        )

        prediction = Prediction(
            image_id=image.id,
            user_id=user.id,
            predicted_label=classification.top_prediction.label,
            confidence=classification.top_prediction.confidence,
            candidates=[
                {"label": c.label, "confidence": c.confidence, "reasoning": c.reasoning}
                for c in classification.candidates
            ],
            status=status,
            model_name=classification.model_name,
            raw_response=classification.raw_response,
            preprocessing_ms=preprocessing_result.total_ms,
            inference_ms=classification.inference_ms,
            prompt_tokens=classification.prompt_tokens,
            completion_tokens=classification.completion_tokens,
        )
        self.db.add(prediction)
        await self.db.commit()
        await self.db.refresh(prediction)

        logger.bind(
            user_id=str(user.id),
            image_id=str(image_id),
            prediction_id=str(prediction.id),
            preprocessing_ms=round(preprocessing_result.total_ms, 2),
            inference_ms=round(classification.inference_ms, 2),
            confidence=prediction.confidence,
            status=status.value,
        ).info("Prediction completed: {}", prediction.predicted_label)

        return prediction

    def _validate_image_quality(self, *, user: User, image_id: uuid.UUID, image) -> None:
        """Stage 1 of the input validation layer: cheap, model-free blur/lighting
        checks, run on the preprocessed (post-resize) array before any VLM call."""
        settings = self._preprocessing_settings()
        try:
            assess_quality(
                image,
                blur_threshold=settings.IMAGE_QUALITY_BLUR_THRESHOLD,
                min_brightness=settings.IMAGE_QUALITY_MIN_BRIGHTNESS,
                max_brightness=settings.IMAGE_QUALITY_MAX_BRIGHTNESS,
            )
        except ImageQualityError as exc:
            logger.bind(
                validation_event="poor_quality", user_id=str(user.id), image_id=str(image_id)
            ).warning("Prediction rejected — poor image quality: {}", exc)
            raise PoorImageQualityError(str(exc)) from exc

    async def _validate_leaf_content(
        self,
        *,
        user: User,
        image_id: uuid.UUID,
        inference_pipeline: VLMInferencePipeline,
        pil_image,
    ) -> None:
        """Stages 2-4 (leaf presence / multiple leaves / occlusion) folded into
        one lightweight VLM call ahead of the full classification call."""
        try:
            # assess_leaf() blocks on CPU-bound generation like classify() —
            # same worker-thread treatment to keep the event loop free.
            assessment = await asyncio.to_thread(inference_pipeline.assess_leaf, pil_image)
        except InferenceError as exc:
            # The lightweight content check failing to run is not itself a
            # reason to block the upload — fall through to full classification,
            # which will surface its own error if the image is truly unusable.
            logger.warning(
                "Leaf assessment call failed for image_id={}, proceeding: {}", image_id, exc
            )
            return

        if not assessment.is_leaf:
            logger.bind(
                validation_event="leaf_not_detected", user_id=str(user.id), image_id=str(image_id)
            ).warning("Prediction rejected — no leaf detected: {}", assessment.reasoning)
            raise LeafNotDetectedError()

        if assessment.leaf_count > 1:
            logger.bind(
                validation_event="multiple_leaves",
                user_id=str(user.id),
                image_id=str(image_id),
                leaf_count=assessment.leaf_count,
            ).warning("Prediction rejected — multiple leaves detected: {}", assessment.reasoning)
            raise MultipleLeavesDetectedError(assessment.leaf_count)

        if assessment.is_heavily_occluded:
            logger.bind(
                validation_event="poor_quality", user_id=str(user.id), image_id=str(image_id)
            ).warning("Prediction rejected — leaf heavily occluded: {}", assessment.reasoning)
            raise LeafOccludedError()

    def _resolve_prediction_status(
        self, *, user: User, image_id: uuid.UUID, label: str, confidence: float
    ) -> PredictionStatus:
        """Stage 5/8 (confidence + unknown-species gate): applied after
        classification, never blocking persistence — a low-confidence or
        "Unknown" result is still saved to history, just flagged."""
        settings = self._preprocessing_settings()
        is_below_threshold = confidence < settings.CONFIDENCE_THRESHOLD
        is_unknown_label = label.strip().lower() == _UNKNOWN_LABEL

        if is_below_threshold or is_unknown_label:
            validation_event = "unknown_species" if is_unknown_label else "low_confidence"
            logger.bind(
                validation_event=validation_event,
                user_id=str(user.id),
                image_id=str(image_id),
                predicted_label=label,
                confidence=confidence,
                threshold=settings.CONFIDENCE_THRESHOLD,
            ).warning("Prediction flagged low-confidence: {} ({:.2f})", label, confidence)
            return PredictionStatus.LOW_CONFIDENCE

        return PredictionStatus.CONFIDENT

    async def get_history(
        self, *, user: User, limit: int = 20, offset: int = 0
    ) -> tuple[list[tuple[Prediction, UploadedImage]], int]:
        count_result = await self.db.execute(
            select(func.count(Prediction.id)).where(Prediction.user_id == user.id)
        )
        total = count_result.scalar_one()

        result = await self.db.execute(
            select(Prediction, UploadedImage)
            .join(UploadedImage, Prediction.image_id == UploadedImage.id)
            .where(Prediction.user_id == user.id)
            .order_by(Prediction.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        rows = [(prediction, image) for prediction, image in result.all()]
        return rows, total

    async def _get_owned_image(self, *, user: User, image_id: uuid.UUID) -> UploadedImage:
        image = await self.db.get(UploadedImage, image_id)
        if image is None or image.user_id != user.id:
            raise ImageNotFoundError()
        return image

    def _get_candidate_labels(self) -> list[str]:
        loader = self._dataset_loader or DatasetLoader(self._preprocessing_settings())
        try:
            return loader.get_verified_class_names()
        except Exception as exc:  # dataset metadata missing/misconfigured
            logger.warning("Could not load dataset class labels, proceeding without them: {}", exc)
            return []

    @staticmethod
    def _preprocessing_settings():
        from app.core.config import get_settings

        return get_settings()
