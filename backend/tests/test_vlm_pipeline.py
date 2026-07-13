"""Tests for VLMInferencePipeline — prompt construction, parsing, and confidence
extraction — exercised entirely through the fake backend (no real model weights)."""

import json

import pytest
from PIL import Image

from app.inference.vlm.pipeline import InferenceError, VLMInferencePipeline
from tests.fakes import FakeVLMBackend


def _dummy_pil_image() -> Image.Image:
    return Image.new("RGB", (64, 64), color=(50, 120, 60))


def test_classify_returns_ranked_candidates():
    backend = FakeVLMBackend()
    pipeline = VLMInferencePipeline(backend=backend)

    result = pipeline.classify(
        _dummy_pil_image(), candidate_labels=["Pongamia_pinnata", "Santalum_album"], top_k=2
    )

    assert result.top_prediction.label == "Pongamia_pinnata"
    assert result.top_prediction.confidence == pytest.approx(0.87)
    assert len(result.candidates) == 2
    assert result.model_name == "fake-qwen2.5-vl"
    assert result.inference_ms >= 0


def test_classify_sends_candidate_labels_in_prompt():
    backend = FakeVLMBackend()
    pipeline = VLMInferencePipeline(backend=backend)

    pipeline.classify(_dummy_pil_image(), candidate_labels=["Terminalia_arjuna"], top_k=1)

    assert len(backend.calls) == 1
    user_message = backend.calls[0][-1]
    text_parts = [p["text"] for p in user_message["content"] if p.get("type") == "text"]
    assert any("Terminalia_arjuna" in text for text in text_parts)


def test_classify_parses_markdown_fenced_json():
    fenced = "Here is my analysis:\n```json\n" + json.dumps(
        {"candidates": [{"label": "Saraca_indica", "confidence": 0.6}]}
    ) + "\n```"
    backend = FakeVLMBackend(response_text=fenced)
    pipeline = VLMInferencePipeline(backend=backend)

    result = pipeline.classify(_dummy_pil_image(), candidate_labels=[], top_k=1)
    assert result.top_prediction.label == "Saraca_indica"


def test_classify_clamps_out_of_range_confidence():
    backend = FakeVLMBackend(
        response_text=json.dumps({"candidates": [{"label": "X", "confidence": 5.0}]})
    )
    pipeline = VLMInferencePipeline(backend=backend)
    result = pipeline.classify(_dummy_pil_image(), candidate_labels=[], top_k=1)
    assert result.top_prediction.confidence == 1.0


def test_classify_raises_on_unparseable_response():
    backend = FakeVLMBackend(response_text="I cannot help with that.")
    pipeline = VLMInferencePipeline(backend=backend)
    with pytest.raises(InferenceError):
        pipeline.classify(_dummy_pil_image(), candidate_labels=[], top_k=1)


def test_classify_propagates_backend_errors_as_inference_error():
    from app.inference.vlm.backend import VLMBackendError

    backend = FakeVLMBackend(raise_error=VLMBackendError("model OOM"))
    pipeline = VLMInferencePipeline(backend=backend)
    with pytest.raises(InferenceError):
        pipeline.classify(_dummy_pil_image(), candidate_labels=[], top_k=1)


def test_chat_returns_response_text():
    backend = FakeVLMBackend()
    pipeline = VLMInferencePipeline(backend=backend)

    turn = pipeline.chat(user_message="What is this plant used for?", history=[])
    assert turn.response_text
    assert turn.model_name == "fake-qwen2.5-vl"


def test_chat_includes_prediction_context_in_messages():
    backend = FakeVLMBackend()
    pipeline = VLMInferencePipeline(backend=backend)

    pipeline.chat(
        user_message="Tell me more.",
        history=[("user", "hi"), ("assistant", "hello")],
        prediction_context="Predicted species 'Saraca_indica' with confidence 0.90.",
    )

    sent_messages = backend.calls[0]
    assert any(
        isinstance(m["content"], str) and "Saraca_indica" in m["content"] for m in sent_messages
    )
