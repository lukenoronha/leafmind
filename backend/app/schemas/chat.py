"""Request/response schemas for the temporary VLM-only chat feature (pre-RAG)."""

import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=4000)
    conversation_id: uuid.UUID | None = Field(
        default=None, description="Omit to start a new conversation."
    )
    image_id: uuid.UUID | None = Field(
        default=None,
        description="Optional uploaded image to ground this conversation in.",
    )


class ChatMessageResponse(BaseModel):
    id: uuid.UUID
    role: str
    content: str
    created_at: datetime

    model_config = {"from_attributes": True}


class ChatResponse(BaseModel):
    conversation_id: uuid.UUID
    message: ChatMessageResponse
    model_name: str
    inference_ms: float
