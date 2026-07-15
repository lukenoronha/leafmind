"""VLM backend abstraction + the real Qwen2.5-VL (Hugging Face) implementation.

`VLMBackend` is the seam: `VLMInferencePipeline` (pipeline.py) only talks to
this protocol, never to `transformers`/`torch` directly. That keeps the
pipeline's prompt/parsing logic testable with a fake backend (no multi-GB
model download, no GPU) while `HFQwenVLBackend` remains the real, complete
implementation used in any environment where the model and hardware are
actually available — nothing about it is a stub.

`transformers`/`torch`/`qwen_vl_utils` are imported lazily, inside
`HFQwenVLBackend`, specifically so that importing this module (and therefore
the rest of the app) never requires those heavy dependencies to be installed
or a GPU to be present unless/until a real prediction is actually requested.
"""

import threading
import time
from typing import Protocol

from loguru import logger

from app.core.config import Settings, get_settings


class VLMBackendError(Exception):
    """Raised when the VLM backend fails to load or generate."""


class VLMBackend(Protocol):
    """Minimal interface the inference pipeline depends on."""

    def generate(self, messages: list[dict], *, max_new_tokens: int) -> tuple[str, int, int]:
        """Run one generation turn.

        `messages` is Qwen2.5-VL chat-format (see `app.inference.vlm.prompts`).
        Returns (response_text, prompt_tokens, completion_tokens).
        """
        ...

    @property
    def model_name(self) -> str:
        ...


class HFQwenVLBackend:
    """Loads Qwen2.5-VL via Hugging Face `transformers` and runs generation.

    Model/processor loading is expensive (multi-GB download + GPU/CPU
    placement), so this class is meant to be instantiated once and reused —
    see `get_vlm_backend()` below for the process-wide lazy singleton.
    """

    def __init__(self, settings: Settings):
        self._settings = settings
        self._model = None
        self._processor = None
        self._lock = threading.Lock()

    @property
    def model_name(self) -> str:
        return self._settings.VLM_MODEL_NAME

    def warm_up(self) -> None:
        """Eagerly load the model now rather than on first `generate()` call.

        Used by `app.main`'s startup path when `Settings.VLM_LOAD_ON_STARTUP`
        is enabled, so the first real request doesn't pay the multi-second
        cold-load cost. Idempotent and safe to call even if already loaded.
        """
        self._ensure_loaded()

    def _ensure_loaded(self) -> None:
        if self._model is not None:
            return

        with self._lock:
            if self._model is not None:  # re-check after acquiring the lock
                return

            logger.info("Loading Qwen2.5-VL model '{}' — this may take a while...", self.model_name)
            start = time.perf_counter()

            try:
                import torch
                from transformers import AutoProcessor, Qwen2_5_VLForConditionalGeneration
            except ImportError as exc:
                raise VLMBackendError(
                    "transformers/torch are not installed. Install the ML extras "
                    "(`pip install -r requirements.txt`) to enable real inference."
                ) from exc

            if self._settings.VLM_TORCH_NUM_THREADS > 0:
                previous = torch.get_num_threads()
                torch.set_num_threads(self._settings.VLM_TORCH_NUM_THREADS)
                logger.info(
                    "torch.set_num_threads({}) applied (default was {})",
                    self._settings.VLM_TORCH_NUM_THREADS,
                    previous,
                )

            dtype = "auto" if self._settings.VLM_DTYPE == "auto" else getattr(torch, self._settings.VLM_DTYPE)

            try:
                self._model = Qwen2_5_VLForConditionalGeneration.from_pretrained(
                    self.model_name,
                    torch_dtype=dtype,
                    device_map=self._settings.VLM_DEVICE,
                )
                self._processor = AutoProcessor.from_pretrained(
                    self.model_name,
                    min_pixels=self._settings.VLM_MIN_PIXELS,
                    max_pixels=self._settings.VLM_MAX_PIXELS,
                )
            except Exception as exc:
                raise VLMBackendError(f"Failed to load model '{self.model_name}': {exc}") from exc

            elapsed = time.perf_counter() - start
            logger.info("Qwen2.5-VL model loaded in {:.1f}s", elapsed)

    def generate(self, messages: list[dict], *, max_new_tokens: int) -> tuple[str, int, int]:
        self._ensure_loaded()

        try:
            from qwen_vl_utils import process_vision_info
        except ImportError as exc:
            raise VLMBackendError(
                "qwen-vl-utils is not installed. Install the ML extras to enable real inference."
            ) from exc

        text_prompt = self._processor.apply_chat_template(
            messages, tokenize=False, add_generation_prompt=True
        )
        image_inputs, video_inputs = process_vision_info(messages)

        inputs = self._processor(
            text=[text_prompt],
            images=image_inputs,
            videos=video_inputs,
            padding=True,
            return_tensors="pt",
        )
        inputs = inputs.to(self._model.device)

        generated_ids = self._model.generate(
            **inputs,
            max_new_tokens=max_new_tokens,
            temperature=self._settings.VLM_TEMPERATURE,
            top_p=self._settings.VLM_TOP_P,
            do_sample=self._settings.VLM_TEMPERATURE > 0,
        )

        prompt_token_count = inputs.input_ids.shape[1]
        trimmed_ids = [
            output_ids[prompt_token_count:] for output_ids in generated_ids
        ]
        response_text = self._processor.batch_decode(
            trimmed_ids, skip_special_tokens=True, clean_up_tokenization_spaces=False
        )[0]

        completion_token_count = trimmed_ids[0].shape[0]
        return response_text.strip(), prompt_token_count, completion_token_count


_backend_lock = threading.Lock()
_backend_instance: HFQwenVLBackend | None = None


def get_vlm_backend() -> HFQwenVLBackend:
    """Process-wide lazy singleton — the model is loaded at most once, on first use."""
    global _backend_instance
    if _backend_instance is None:
        with _backend_lock:
            if _backend_instance is None:
                _backend_instance = HFQwenVLBackend(get_settings())
    return _backend_instance
