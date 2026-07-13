"""Test doubles for the VLM backend — no real model weights or GPU required.

`FakeVLMBackend` implements the same `VLMBackend` protocol
(`app.inference.vlm.backend.VLMBackend`) that `HFQwenVLBackend` implements,
so `VLMInferencePipeline` and everything above it (services, endpoints) run
through their real code paths in tests; only the actual model call is faked.
"""

import json


class FakeVLMBackend:
    """A scripted stand-in for `HFQwenVLBackend`.

    By default returns a well-formed classification JSON response so
    happy-path tests don't need to construct one. Set `response_text` to
    override (e.g. to test malformed-response handling), or `raise_error` to
    simulate a backend failure.
    """

    def __init__(
        self,
        *,
        response_text: str | None = None,
        raise_error: Exception | None = None,
        model_name: str = "fake-qwen2.5-vl",
    ):
        self._response_text = response_text
        self._raise_error = raise_error
        self._model_name = model_name
        self.calls: list[list[dict]] = []

    @property
    def model_name(self) -> str:
        return self._model_name

    def generate(self, messages: list[dict], *, max_new_tokens: int) -> tuple[str, int, int]:
        self.calls.append(messages)

        if self._raise_error is not None:
            raise self._raise_error

        if self._response_text is not None:
            text = self._response_text
        else:
            # Infer whether this is a classification or chat call from the
            # presence of a "candidates" instruction in the prompt text.
            is_classification = any(
                isinstance(m.get("content"), list)
                and any(
                    isinstance(part, dict) and "top" in part.get("text", "").lower() and "candidates" in part.get("text", "").lower()
                    for part in m["content"]
                )
                for m in messages
            )
            if is_classification:
                text = json.dumps(
                    {
                        "candidates": [
                            {"label": "Pongamia_pinnata", "confidence": 0.87, "reasoning": "compound leaflets, oval shape"},
                            {"label": "Santalum_album", "confidence": 0.09, "reasoning": "less likely, different venation"},
                        ]
                    }
                )
            else:
                text = "This appears to be a healthy medicinal plant leaf."

        prompt_tokens = sum(len(str(m.get("content", ""))) for m in messages) // 4
        completion_tokens = len(text) // 4
        return text, prompt_tokens, completion_tokens
