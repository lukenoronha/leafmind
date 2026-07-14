"""Prompt construction for grounded RAG chat turns — combines predicted plant,
user question, retrieved context, and conversation history into Qwen2.5-VL
chat-format messages.

Mirrors `app.inference.vlm.prompts.build_chat_messages`, and is the direct
replacement for it in the chat flow: `RAGService` calls this instead of the
old prompt builder before handing messages to `VLMInferencePipeline`.
"""

from app.rag.schemas import RetrievedChunk

_RAG_SYSTEM_PROMPT = (
    "You are LeafMind, a botanical assistant grounded in a curated reference "
    "library about medicinal plants. Answer the user's question using ONLY "
    "the retrieved context provided below and, if given, the predicted plant "
    "species for this conversation. If the retrieved context does not "
    "contain enough information to answer confidently, say so explicitly "
    "rather than guessing. Cite the source document name (and page number, "
    "if given) inline when you use a specific fact, e.g. '(Source: "
    "Medicinal Plants Handbook, p. 42)'."
)


def build_context_block(chunks: list[RetrievedChunk]) -> str:
    """Render retrieved chunks into a numbered context block for the prompt."""
    if not chunks:
        return "(No relevant context was retrieved for this question.)"

    blocks = []
    for i, chunk in enumerate(chunks, start=1):
        source = chunk.document_name or "Unknown source"
        if chunk.page_number is not None:
            source += f", p. {chunk.page_number}"
        if chunk.chapter:
            source += f" ({chunk.chapter})"
        blocks.append(f"[{i}] Source: {source}\n{chunk.text}")

    return "\n\n".join(blocks)


def build_rag_messages(
    *,
    user_message: str,
    retrieved_chunks: list[RetrievedChunk],
    history: list[tuple[str, str]],
    predicted_plant: str | None = None,
    pil_image=None,
) -> list[dict]:
    """Qwen2.5-VL chat-format messages for one grounded RAG turn.

    `history` is a list of (role, text) pairs already truncated to the
    configured window by the caller (`RAGService`), matching the contract of
    `app.inference.vlm.prompts.build_chat_messages`.
    """
    messages: list[dict] = [{"role": "system", "content": _RAG_SYSTEM_PROMPT}]

    if predicted_plant:
        messages.append(
            {
                "role": "system",
                "content": f"Predicted plant species for this conversation: {predicted_plant}.",
            }
        )

    messages.append(
        {
            "role": "system",
            "content": f"Retrieved reference context:\n\n{build_context_block(retrieved_chunks)}",
        }
    )

    for role, text in history:
        messages.append({"role": role, "content": text})

    if pil_image is not None:
        messages.append(
            {
                "role": "user",
                "content": [
                    {"type": "image", "image": pil_image},
                    {"type": "text", "text": user_message},
                ],
            }
        )
    else:
        messages.append({"role": "user", "content": user_message})

    return messages
