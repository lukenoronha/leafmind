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
        label_sequence: list[str] | None = None,
    ):
        self._response_text = response_text
        self._raise_error = raise_error
        self._model_name = model_name
        self._label_sequence = label_sequence
        self._classification_call_count = 0
        self.calls: list[list[dict]] = []

    @property
    def model_name(self) -> str:
        return self._model_name

    def generate(self, messages: list[dict], *, max_new_tokens: int) -> tuple[str, int, int]:
        self.calls.append(messages)

        if self._raise_error is not None:
            raise self._raise_error

        is_classification_call = any(
            isinstance(m.get("content"), list)
            and any(
                isinstance(part, dict)
                and "top" in part.get("text", "").lower()
                and "candidates" in part.get("text", "").lower()
                for part in m["content"]
            )
            for m in messages
        )

        if self._response_text is not None:
            text = self._response_text
        elif is_classification_call and self._label_sequence is not None:
            # Scripted mode for evaluation tests: returns the Nth label in
            # `label_sequence` (wrapping if there are more calls than labels),
            # so a test can assert exact accuracy/precision/recall/F1 against
            # a fully deterministic, known-correct/known-wrong prediction
            # sequence instead of the fixed hardcoded response below.
            label = self._label_sequence[
                self._classification_call_count % len(self._label_sequence)
            ]
            self._classification_call_count += 1
            text = json.dumps({"candidates": [{"label": label, "confidence": 0.9, "reasoning": "scripted"}]})
        elif is_classification_call:
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


class FakeEmbeddingBackend:
    """A deterministic stand-in for `SentenceTransformerBackend`.

    Implements `app.rag.embedding.EmbeddingBackend` — encodes text into a
    small fixed-dimension vector derived from a hash of the text, so
    identical/similar strings produce identical/similar vectors without
    loading any real model. Good enough for exercising retrieval ranking in
    tests without downloading weights.
    """

    def __init__(self, *, dimension: int = 8, model_name: str = "fake-embedding-model"):
        self._dimension = dimension
        self._model_name = model_name
        self.calls: list[list[str]] = []

    @property
    def model_name(self) -> str:
        return self._model_name

    @property
    def dimension(self) -> int:
        return self._dimension

    def embed(self, texts: list[str]) -> list[list[float]]:
        self.calls.append(texts)
        return [self._vector_for(text) for text in texts]

    def _vector_for(self, text: str) -> list[float]:
        tokens = text.lower().split()
        vector = [0.0] * self._dimension
        for token in tokens:
            vector[hash(token) % self._dimension] += 1.0
        norm = sum(v * v for v in vector) ** 0.5
        if norm == 0:
            return vector
        return [v / norm for v in vector]


class FakeVectorStore:
    """An in-memory stand-in for `ChromaVectorStore` — implements `app.rag.vectorstore.VectorStore`.

    Computes cosine distance directly in Python so retrieval ranking/
    filtering logic in `Retriever` runs through its real code path in tests,
    without a real ChromaDB persistence directory.
    """

    def __init__(self):
        self._records: dict[str, object] = {}

    def upsert(self, records) -> None:
        for record in records:
            self._records[record.id] = record

    def query(self, vector: list[float], *, top_k: int):
        from app.rag.vectorstore import VectorMatch

        scored = [
            (self._cosine_distance(vector, record.vector), record)
            for record in self._records.values()
        ]
        scored.sort(key=lambda pair: pair[0])
        return [
            VectorMatch(id=record.id, text=record.text, distance=distance, metadata=record.metadata)
            for distance, record in scored[:top_k]
        ]

    def delete_by_document(self, document_id: str) -> None:
        self._records = {
            chunk_id: record
            for chunk_id, record in self._records.items()
            if record.metadata.get("document_id") != document_id
        }

    def count(self) -> int:
        return len(self._records)

    def clear_all(self) -> None:
        self._records = {}

    def get_collection_info(self) -> dict:
        return {
            "name": "fake-collection",
            "vector_count": len(self._records),
            "persist_dir": "fake",
            "distance_metric": "cosine",
        }

    @staticmethod
    def _cosine_distance(a: list[float], b: list[float]) -> float:
        dot = sum(x * y for x, y in zip(a, b))
        norm_a = sum(x * x for x in a) ** 0.5
        norm_b = sum(y * y for y in b) ** 0.5
        if norm_a == 0 or norm_b == 0:
            return 2.0
        cosine_similarity = dot / (norm_a * norm_b)
        return 1.0 - cosine_similarity
