"""EvaluationService — classification and RAG evaluation, persisted as `EvaluationRun` rows.

Classification evaluation runs the real `VLMInferencePipeline.classify()`
directly against sampled images from the dataset's own labeled folders
(`app.datasets.loader.DatasetLoader`), comparing predictions to the folder's
ground-truth label via `scikit-learn` — no `UploadedImage`/`Prediction` rows
are created, keeping evaluation side-effect-free and fast. RAG evaluation
aggregates over already-persisted `ChatMessage` rows' `retrieved_sources`/
`retrieval_ms` (see `app.services.evaluation.rag_metrics` for the pure
aggregation formulas), so it reflects real production traffic rather than a
synthetic benchmark.
"""

import asyncio
import time
import uuid
from datetime import datetime

from loguru import logger
from PIL import Image
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, get_settings
from app.core.exceptions import LeafMindError
from app.datasets.loader import DatasetLoader, get_dataset_loader
from app.inference.vlm.pipeline import InferenceError, VLMInferencePipeline
from app.models.chat_message import ChatMessage, ChatRole
from app.models.evaluation_run import EvaluationRun, EvaluationRunType
from app.models.user import User
from app.services.evaluation import rag_metrics


class EvaluationError(LeafMindError):
    """Base class for evaluation failures."""


class EvaluationRunNotFoundError(EvaluationError):
    def __init__(self) -> None:
        super().__init__("Evaluation run not found.", status_code=404)


class NoEvaluableClassesError(EvaluationError):
    def __init__(self) -> None:
        super().__init__(
            "No verified dataset classes with sample images are available to evaluate.",
            status_code=422,
        )


class EvaluationService:
    """Runs and persists classification/RAG evaluation metrics."""

    def __init__(
        self,
        db: AsyncSession,
        *,
        settings: Settings | None = None,
        dataset_loader: DatasetLoader | None = None,
        inference: VLMInferencePipeline | None = None,
    ):
        self.db = db
        self._settings = settings or get_settings()
        self._dataset_loader = dataset_loader or get_dataset_loader()
        self._inference = inference

    # --- Classification evaluation ---------------------------------------------------

    async def run_classification_evaluation(
        self,
        *,
        actor: User,
        sample_size_per_class: int | None = None,
        classes: list[str] | None = None,
    ) -> EvaluationRun:
        from sklearn.metrics import (
            accuracy_score,
            classification_report,
            confusion_matrix,
            precision_recall_fscore_support,
        )

        sample_size_per_class = min(
            sample_size_per_class or self._settings.EVAL_DEFAULT_SAMPLE_SIZE_PER_CLASS,
            self._settings.EVAL_MAX_SAMPLE_SIZE_PER_CLASS,
        )

        class_names = classes or self._dataset_loader.get_verified_class_names()
        if not class_names:
            raise NoEvaluableClassesError()

        inference_pipeline = self._inference or VLMInferencePipeline()

        start = time.perf_counter()
        y_true: list[str] = []
        y_pred: list[str] = []
        errors_count = 0

        for dataset_class in self._dataset_loader.load_classes():
            if dataset_class.display_name not in class_names:
                continue

            image_paths = self._dataset_loader.sample_image_paths(
                dataset_class, limit=sample_size_per_class
            )
            for image_path in image_paths:
                try:
                    pil_image = Image.open(image_path).convert("RGB")
                    # classify() blocks on CPU-bound model loading/generation;
                    # running it in a worker thread keeps the event loop free
                    # to serve other requests during a (potentially long)
                    # multi-image evaluation run.
                    result = await asyncio.to_thread(
                        inference_pipeline.classify,
                        pil_image,
                        candidate_labels=class_names,
                        top_k=1,
                    )
                except (InferenceError, OSError) as exc:
                    errors_count += 1
                    logger.warning(
                        "Evaluation image {} failed classification: {}", image_path, exc
                    )
                    continue

                y_true.append(dataset_class.display_name)
                y_pred.append(result.top_prediction.label)

        if not y_true:
            raise NoEvaluableClassesError()

        accuracy = accuracy_score(y_true, y_pred)
        precision, recall, f1, _ = precision_recall_fscore_support(
            y_true, y_pred, average="macro", zero_division=0, labels=class_names
        )
        cm = confusion_matrix(y_true, y_pred, labels=class_names)
        report = classification_report(
            y_true, y_pred, labels=class_names, output_dict=True, zero_division=0
        )

        duration_ms = (time.perf_counter() - start) * 1000

        run = EvaluationRun(
            run_type=EvaluationRunType.CLASSIFICATION,
            triggered_by_id=actor.id,
            sample_size_per_class=sample_size_per_class,
            metrics={
                "accuracy": round(float(accuracy), 4),
                "precision_macro": round(float(precision), 4),
                "recall_macro": round(float(recall), 4),
                "f1_macro": round(float(f1), 4),
                "confusion_matrix": cm.tolist(),
                "errors_count": errors_count,
            },
            per_class_report=report,
            class_labels=class_names,
            sample_count=len(y_true),
            duration_ms=duration_ms,
        )
        self.db.add(run)
        await self.db.commit()
        await self.db.refresh(run)

        logger.bind(
            run_id=str(run.id),
            accuracy=run.metrics["accuracy"],
            f1_macro=run.metrics["f1_macro"],
            sample_count=run.sample_count,
            duration_ms=round(duration_ms, 2),
        ).info("Classification evaluation completed")

        return run

    # --- RAG evaluation ---------------------------------------------------------------

    async def compute_rag_evaluation_metrics(
        self, *, actor: User, since: datetime | None = None
    ) -> EvaluationRun:
        start = time.perf_counter()

        query = select(ChatMessage).where(
            ChatMessage.role == ChatRole.ASSISTANT, ChatMessage.retrieved_sources.is_not(None)
        )
        if since is not None:
            query = query.where(ChatMessage.created_at >= since)

        result = await self.db.execute(query)
        messages = list(result.scalars().all())

        retrieval_times = [m.retrieval_ms for m in messages if m.retrieval_ms is not None]
        chunk_counts = [m.retrieved_chunk_count or 0 for m in messages]
        all_scores = [
            source.get("score", 0.0)
            for m in messages
            for source in (m.retrieved_sources or [])
        ]
        turns_scores = [
            [source.get("score", 0.0) for source in (m.retrieved_sources or [])] for m in messages
        ]
        citation_turns = [
            (
                m.content,
                [source.get("document_name", "") for source in (m.retrieved_sources or [])],
            )
            for m in messages
        ]

        metrics = {
            "avg_retrieval_ms": rag_metrics.mean_or_zero(retrieval_times),
            "median_retrieval_ms": rag_metrics.median_or_zero(retrieval_times),
            "p95_retrieval_ms": rag_metrics.percentile(retrieval_times, 95),
            "avg_similarity_score": rag_metrics.mean_or_zero(all_scores),
            "avg_retrieved_chunks": rag_metrics.mean_or_zero([float(c) for c in chunk_counts]),
            "zero_hit_rate": rag_metrics.zero_hit_rate(chunk_counts),
            "context_relevance": rag_metrics.context_relevance(
                turns_scores, similarity_threshold=self._settings.RAG_SIMILARITY_THRESHOLD
            ),
            "citation_coverage": rag_metrics.citation_coverage(citation_turns),
        }

        duration_ms = (time.perf_counter() - start) * 1000

        run = EvaluationRun(
            run_type=EvaluationRunType.RAG,
            triggered_by_id=actor.id,
            metrics=metrics,
            sample_count=len(messages),
            duration_ms=duration_ms,
        )
        self.db.add(run)
        await self.db.commit()
        await self.db.refresh(run)

        logger.bind(
            run_id=str(run.id),
            sample_count=run.sample_count,
            context_relevance=metrics["context_relevance"],
            citation_coverage=metrics["citation_coverage"],
            duration_ms=round(duration_ms, 2),
        ).info("RAG evaluation completed")

        return run

    # --- Listing / retrieval ------------------------------------------------------

    async def list_runs(
        self, *, run_type: EvaluationRunType | None = None, limit: int = 20, offset: int = 0
    ) -> tuple[list[EvaluationRun], int]:
        query = select(EvaluationRun)
        count_query = select(func.count(EvaluationRun.id))
        if run_type is not None:
            query = query.where(EvaluationRun.run_type == run_type)
            count_query = count_query.where(EvaluationRun.run_type == run_type)

        total = (await self.db.execute(count_query)).scalar_one()
        result = await self.db.execute(
            query.order_by(EvaluationRun.created_at.desc()).limit(limit).offset(offset)
        )
        return list(result.scalars().all()), total

    async def get_run(self, *, run_id: uuid.UUID) -> EvaluationRun:
        run = await self.db.get(EvaluationRun, run_id)
        if run is None:
            raise EvaluationRunNotFoundError()
        return run
