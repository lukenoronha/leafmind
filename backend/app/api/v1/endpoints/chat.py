"""Temporary VLM-only chat endpoint (no Retrieval-Augmented Generation).

Sprint 4 introduces ChromaDB-backed RAG; this endpoint and `ChatService` are
kept isolated from `ImageAnalysisService` specifically so RAG can be layered
in later (as a retrieval step feeding into `VLMInferencePipeline.chat`)
without changing this endpoint's contract.
"""

from fastapi import APIRouter

from app.api.deps import ChatServiceDep, CurrentUserDep
from app.schemas.chat import ChatMessageResponse, ChatRequest, ChatResponse

router = APIRouter(prefix="/chat", tags=["Chat (VLM-only)"])


@router.post(
    "",
    response_model=ChatResponse,
    summary="Send a chat message to the Vision-Language Model",
    description="Temporary, non-RAG chat: responses are generated directly by "
    "Qwen2.5-VL, optionally grounded in an uploaded image and/or its most "
    "recent prediction. Conversation history is persisted and replayed on "
    "subsequent turns within the same `conversation_id`.",
)
async def send_chat_message(
    payload: ChatRequest,
    current_user: CurrentUserDep,
    service: ChatServiceDep,
) -> ChatResponse:
    conversation_id, assistant_message = await service.send_message(
        user=current_user,
        message=payload.message,
        conversation_id=payload.conversation_id,
        image_id=payload.image_id,
    )
    return ChatResponse(
        conversation_id=conversation_id,
        message=ChatMessageResponse.model_validate(assistant_message),
        model_name=assistant_message.model_name or "unknown",
        inference_ms=assistant_message.inference_ms or 0.0,
    )
