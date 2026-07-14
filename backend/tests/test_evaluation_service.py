"""Unit tests for `EvaluationService` and the pure `rag_metrics` aggregation functions."""

import io
import json
import uuid
from datetime import UTC, datetime

import numpy as np
import pytest
from PIL import Image
from sqlalchemy import select

from app.core.config import Settings
from app.core.security import hash_password
from app.datasets.loader import DatasetLoader
from app.inference.vlm.pipeline import VLMInferencePipeline
from app.models.chat_message import ChatMessage, ChatRole
from app.models.role import Role, RoleName
from app.models.user import User
from app.services.evaluation import rag_metrics
from app.services.evaluation.service import EvaluationService
from tests.fakes import FakeVLMBackend

_CLASSES_PAYLOAD = {
    "classes": [
        {"class_id": 0, "training_label": "Species_A", "folder_name": "Species_A", "status": "active"},
        {"class_id": 1, "training_label": "Species_B", "folder_name": "Species_B", "status": "active"},
    ]
}


def _make_jpeg_bytes(color: tuple[int, int, int]) -> bytes:
    image = np.full((64, 64, 3), color, dtype=np.uint8)
    buffer = io.BytesIO()
    Image.fromarray(image, mode="RGB").save(buffer, format="JPEG")
    return buffer.getvalue()


def _seed_fixture_dataset(tmp_path) -> DatasetLoader:
    metadata_dir = tmp_path / "metadata"
    metadata_dir.mkdir()
    (metadata_dir / "classes.json").write_text(json.dumps(_CLASSES_PAYLOAD), encoding="utf-8")

    raw_dir = tmp_path / "raw" / "medicinal_leaf_images"
    for folder, color in [("Species_A", (10, 200, 10)), ("Species_B", (200, 10, 10))]:
        class_dir = raw_dir / folder
        class_dir.mkdir(parents=True)
        (class_dir / "img1.jpg").write_bytes(_make_jpeg_bytes(color))
        (class_dir / "img2.jpg").write_bytes(_make_jpeg_bytes(color))

    settings = Settings(
        DATASET_ROOT=str(tmp_path),
        DATASET_RAW_SUBDIR="raw/medicinal_leaf_images",
        DATASET_METADATA_SUBDIR="metadata",
    )
    return DatasetLoader(settings)


async def _make_user(db_session_factory) -> User:
    """`_seed_roles` (autouse, conftest.py) already seeds every `RoleName` role,
    so this only needs to look one up, not create it."""
    async with db_session_factory() as session:
        role = (
            await session.execute(select(Role).where(Role.name == RoleName.USER.value))
        ).scalar_one()

        user = User(
            email="eval_tester@example.com",
            hashed_password=hash_password("Str0ng!Pass"),
            full_name="Eval Tester",
            role_id=role.id,
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)
        return user


async def test_classification_evaluation_computes_exact_metrics(db_session_factory, tmp_path):
    loader = _seed_fixture_dataset(tmp_path)
    user = await _make_user(db_session_factory)

    # Scripted: 2 correct predictions for Species_A's 2 images, then 1 correct
    # + 1 wrong for Species_B's 2 images -> 3/4 accuracy overall.
    fake_backend = FakeVLMBackend(label_sequence=["Species_A", "Species_A", "Species_B", "Species_A"])
    inference = VLMInferencePipeline(backend=fake_backend)

    async with db_session_factory() as session:
        service = EvaluationService(session, dataset_loader=loader, inference=inference)
        run = await service.run_classification_evaluation(actor=user, sample_size_per_class=2)

    assert run.sample_count == 4
    assert run.metrics["accuracy"] == pytest.approx(0.75)
    assert run.metrics["errors_count"] == 0
    assert run.class_labels == ["Species_A", "Species_B"]
    assert len(run.metrics["confusion_matrix"]) == 2


async def test_classification_evaluation_persists_run(db_session_factory, tmp_path):
    loader = _seed_fixture_dataset(tmp_path)
    user = await _make_user(db_session_factory)
    fake_backend = FakeVLMBackend(label_sequence=["Species_A", "Species_A", "Species_B", "Species_B"])
    inference = VLMInferencePipeline(backend=fake_backend)

    async with db_session_factory() as session:
        service = EvaluationService(session, dataset_loader=loader, inference=inference)
        run = await service.run_classification_evaluation(actor=user, sample_size_per_class=2)

        fetched = await service.get_run(run_id=run.id)
        assert fetched.id == run.id
        assert fetched.metrics["accuracy"] == 1.0


async def test_rag_evaluation_aggregates_persisted_chat_messages(db_session_factory):
    user = await _make_user(db_session_factory)

    async with db_session_factory() as session:
        session.add(
            ChatMessage(
                conversation_id=uuid.uuid4(),
                user_id=user.id,
                role=ChatRole.ASSISTANT,
                content="Neem is documented in (Source: Neem Handbook, p. 3).",
                retrieval_ms=50.0,
                retrieved_chunk_count=1,
                retrieved_sources=[
                    {
                        "chunk_id": "c1",
                        "document_id": "d1",
                        "document_name": "Neem Handbook",
                        "page_number": 3,
                        "chapter": None,
                        "score": 0.8,
                    }
                ],
            )
        )
        session.add(
            ChatMessage(
                conversation_id=uuid.uuid4(),
                user_id=user.id,
                role=ChatRole.ASSISTANT,
                content="I don't have information on that.",
                retrieval_ms=30.0,
                retrieved_chunk_count=0,
                retrieved_sources=[],
            )
        )
        await session.commit()

        service = EvaluationService(session)
        run = await service.compute_rag_evaluation_metrics(actor=user)

    assert run.sample_count == 2
    assert run.metrics["avg_retrieval_ms"] == pytest.approx(40.0)
    assert run.metrics["zero_hit_rate"] == pytest.approx(0.5)
    assert run.metrics["citation_coverage"] == pytest.approx(1.0)  # the 1 turn with chunks cited its source


# --- Pure rag_metrics functions ---


def test_context_relevance_only_counts_passing_scores():
    turns_scores = [[0.9, 0.1], [0.05]]
    relevance = rag_metrics.context_relevance(turns_scores, similarity_threshold=0.3)
    # First turn: mean(0.9) = 0.9 (0.1 excluded). Second turn: no passing scores, excluded entirely.
    assert relevance == pytest.approx(0.9)


def test_citation_coverage_case_insensitive_substring_match():
    turns = [
        ("See (Source: Neem Handbook, p. 1).", ["Neem Handbook"]),
        ("No citation here.", ["Aloe Vera Guide"]),
        ("Uncited turn with no retrieval.", []),
    ]
    coverage = rag_metrics.citation_coverage(turns)
    # Only 2 turns have retrieved document names; 1 of those cites it -> 0.5.
    assert coverage == pytest.approx(0.5)


def test_zero_hit_rate():
    assert rag_metrics.zero_hit_rate([0, 1, 0, 2]) == pytest.approx(0.5)
    assert rag_metrics.zero_hit_rate([]) == 0.0


def test_mean_median_percentile_empty_inputs_return_zero():
    assert rag_metrics.mean_or_zero([]) == 0.0
    assert rag_metrics.median_or_zero([]) == 0.0
    assert rag_metrics.percentile([], 95) == 0.0
