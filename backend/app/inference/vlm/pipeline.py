"""VLMInferencePipeline — classification and chat generation on top of a VLMBackend.

This is the only module that knows how to turn a `VLMBackend.generate()` call
into structured, validated output (`ClassificationResult` / `ChatTurn`). It
never imports `transformers`/`torch` itself and never talks to the DB — it is
pure "image/messages in, structured result out", which is what makes it
trivially testable with a fake backend and reusable from both `/predict` and
the chat service.
"""

import json
import re
import time

from loguru import logger

from app.inference.clip.classifier import (
    CLIPClassifierUnavailableError,
    get_trained_clip_classifier,
)
from app.inference.vlm.backend import VLMBackend, VLMBackendError, get_vlm_backend
from app.inference.vlm.prompts import (
    build_chat_messages,
    build_classification_messages,
    build_leaf_assessment_messages,
)
from app.inference.vlm.schemas import (
    ChatTurn,
    ClassificationCandidate,
    ClassificationResult,
    LeafAssessment,
)
from app.rag.image_retriever import ImageRetriever


class InferenceError(Exception):
    """Raised when generation fails or the model's response cannot be parsed."""


class VLMInferencePipeline:
    """Model-loading, prompt construction, prediction, and confidence extraction.

    Accepts an injected `VLMBackend` (defaults to the real Hugging Face
    Qwen2.5-VL singleton) so tests can substitute a fake backend without
    touching model-loading code at all.
    """

    def __init__(
        self,
        backend: VLMBackend | None = None,
        *,
        max_new_tokens: int = 512,
        image_retriever: ImageRetriever | None = None,
    ):
        self._backend = backend or get_vlm_backend()
        self._default_max_new_tokens = max_new_tokens
        self._image_retriever = image_retriever or ImageRetriever()

    def classify(self, pil_image, *, candidate_labels: list[str], top_k: int = 3) -> ClassificationResult:
        few_shot_examples: list[tuple[object, str]] = []
        try:
            for match in self._image_retriever.retrieve(pil_image):
                if not match.image_path:
                    continue
                from PIL import Image

                few_shot_examples.append((Image.open(match.image_path).convert("RGB"), match.label))
        except Exception as exc:
            logger.warning("CLIP few-shot retrieval unavailable, falling back to zero-shot: {}", exc)
            few_shot_examples = []

        trained_classifier_hint: tuple[str, float] | None = None
        try:
            label, confidence = get_trained_clip_classifier().predict(pil_image)
            trained_classifier_hint = (label, confidence)
        except CLIPClassifierUnavailableError:
            pass  # not trained yet — safe to omit the hint entirely
        except Exception as exc:
            logger.warning("Trained CLIP classifier unavailable, omitting hint: {}", exc)

        messages = build_classification_messages(
            pil_image=pil_image,
            candidate_labels=candidate_labels,
            top_k=top_k,
            few_shot_examples=few_shot_examples,
            trained_classifier_hint=trained_classifier_hint,
        )

        start = time.perf_counter()
        try:
            raw_response, prompt_tokens, completion_tokens = self._backend.generate(
                messages, max_new_tokens=self._default_max_new_tokens
            )
        except VLMBackendError as exc:
            raise InferenceError(str(exc)) from exc
        inference_ms = (time.perf_counter() - start) * 1000

        candidates = self._parse_classification_response(raw_response, top_k=top_k)
        if not candidates:
            raise InferenceError(
                f"Model response could not be parsed into any candidates: {raw_response!r}"
            )

        result = ClassificationResult(
            top_prediction=candidates[0],
            candidates=candidates,
            raw_response=raw_response,
            model_name=self._backend.model_name,
            inference_ms=inference_ms,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
        )

        logger.bind(
            model=result.model_name,
            inference_ms=round(inference_ms, 2),
            top_label=result.top_prediction.label,
            top_confidence=result.top_prediction.confidence,
        ).info("Classification inference completed")

        return result

    def assess_leaf(self, pil_image) -> LeafAssessment:
        """Lightweight pre-classification content check: leaf presence, leaf
        count, and occlusion — in one generation call, reusing the same
        backend/model as classification rather than a second model.

        Deliberately conservative on parse failure: if the model's response
        can't be parsed, this assumes the image is a single, unoccluded leaf
        (i.e. defers to the classification step) rather than blocking a
        possibly-valid upload on a formatting hiccup in this cheaper check.
        """
        messages = build_leaf_assessment_messages(pil_image=pil_image)

        try:
            raw_response, _, _ = self._backend.generate(messages, max_new_tokens=200)
        except VLMBackendError as exc:
            raise InferenceError(str(exc)) from exc

        assessment = self._parse_leaf_assessment(raw_response)

        logger.bind(
            is_leaf=assessment.is_leaf,
            leaf_count=assessment.leaf_count,
            is_heavily_occluded=assessment.is_heavily_occluded,
        ).info("Leaf assessment completed")

        return assessment

    def chat(
        self,
        *,
        user_message: str,
        history: list[tuple[str, str]],
        pil_image=None,
        prediction_context: str | None = None,
        max_new_tokens: int | None = None,
    ) -> ChatTurn:
        messages = build_chat_messages(
            user_message=user_message,
            history=history,
            pil_image=pil_image,
            prediction_context=prediction_context,
        )
        return self.generate_from_messages(messages, max_new_tokens=max_new_tokens)

    def generate_from_messages(
        self, messages: list[dict], *, max_new_tokens: int | None = None
    ) -> ChatTurn:
        """Run one generation turn on already-built chat-format messages.

        Used directly by callers that build their own message list (e.g.
        `RAGService` via `app.rag.prompt_builder`), so retrieval-augmented
        prompts share the exact same generation/timing/logging path as
        `chat()` without duplicating it.
        """
        start = time.perf_counter()
        try:
            raw_response, prompt_tokens, completion_tokens = self._backend.generate(
                messages, max_new_tokens=max_new_tokens or self._default_max_new_tokens
            )
        except VLMBackendError as exc:
            raise InferenceError(str(exc)) from exc
        inference_ms = (time.perf_counter() - start) * 1000

        turn = ChatTurn(
            response_text=raw_response,
            model_name=self._backend.model_name,
            inference_ms=inference_ms,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
        )

        logger.bind(model=turn.model_name, inference_ms=round(inference_ms, 2)).info(
            "Chat inference completed"
        )
        return turn

    @staticmethod
    def _parse_classification_response(raw_response: str, *, top_k: int) -> list[ClassificationCandidate]:
        """Extract a ranked candidate list from the model's JSON response.

        Tolerant of the model wrapping JSON in markdown code fences or adding
        stray prose, since instruction-following on this is imperfect even
        with a strict prompt.
        """
        json_text = VLMInferencePipeline._extract_json_block(raw_response)
        if json_text is None:
            return []

        try:
            payload = json.loads(json_text)
        except json.JSONDecodeError:
            logger.warning("Failed to parse VLM JSON response: {}", raw_response[:500])
            return []

        raw_candidates = payload.get("candidates", []) if isinstance(payload, dict) else []
        candidates: list[ClassificationCandidate] = []
        for entry in raw_candidates[:top_k]:
            if not isinstance(entry, dict) or "label" not in entry:
                continue
            try:
                confidence = float(entry.get("confidence", 0.0))
            except (TypeError, ValueError):
                confidence = 0.0
            confidence = max(0.0, min(1.0, confidence))
            candidates.append(
                ClassificationCandidate(
                    label=str(entry["label"]).strip(),
                    confidence=confidence,
                    reasoning=str(entry.get("reasoning", "")).strip(),
                )
            )

        candidates.sort(key=lambda c: c.confidence, reverse=True)
        return candidates

    @staticmethod
    def _parse_leaf_assessment(raw_response: str) -> LeafAssessment:
        """Extract the leaf-assessment JSON, defaulting to a permissive
        (single, unoccluded leaf) result on any parse failure — see
        `assess_leaf`'s docstring for why this fails open rather than closed."""
        default = LeafAssessment(is_leaf=True, leaf_count=1, is_heavily_occluded=False)

        json_text = VLMInferencePipeline._extract_json_block(raw_response)
        if json_text is None:
            logger.warning("Leaf assessment response had no JSON block: {}", raw_response[:300])
            return default

        try:
            payload = json.loads(json_text)
        except json.JSONDecodeError:
            logger.warning("Failed to parse leaf assessment JSON: {}", raw_response[:300])
            return default

        if not isinstance(payload, dict):
            return default

        try:
            leaf_count = int(payload.get("leaf_count", 1))
        except (TypeError, ValueError):
            leaf_count = 1

        return LeafAssessment(
            is_leaf=bool(payload.get("is_leaf", True)),
            leaf_count=max(0, leaf_count),
            is_heavily_occluded=bool(payload.get("is_heavily_occluded", False)),
            reasoning=str(payload.get("reasoning", "")).strip(),
        )

    @staticmethod
    def _extract_json_block(text: str) -> str | None:
        fenced_match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
        if fenced_match:
            return fenced_match.group(1)

        brace_match = re.search(r"\{.*\}", text, re.DOTALL)
        if brace_match:
            return brace_match.group(0)

        return None
