"""Plain dataclasses for structured VLM output — deliberately not Pydantic here.

These are internal, in-process data structures produced by the inference
pipeline and consumed by the image-analysis service, which then maps them
onto the API's Pydantic response schemas (`app.schemas.images`). Keeping this
layer dependency-light means the inference module has no FastAPI/Pydantic
coupling and could be reused outside the web app (e.g. a batch evaluation
script) unchanged.
"""

from dataclasses import dataclass


@dataclass
class ClassificationCandidate:
    """One ranked species candidate extracted from the model's structured response."""

    label: str
    confidence: float
    reasoning: str = ""


@dataclass
class ClassificationResult:
    """Full structured output of a single classification inference call."""

    top_prediction: ClassificationCandidate
    candidates: list[ClassificationCandidate]
    raw_response: str
    model_name: str
    inference_ms: float
    prompt_tokens: int | None = None
    completion_tokens: int | None = None


@dataclass
class ChatTurn:
    """A single generated chat response, with basic usage/timing metadata."""

    response_text: str
    model_name: str
    inference_ms: float
    prompt_tokens: int | None = None
    completion_tokens: int | None = None
