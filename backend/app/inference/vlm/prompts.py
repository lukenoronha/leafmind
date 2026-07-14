"""Prompt construction for classification and chat with Qwen2.5-VL.

Centralized here so prompt wording can be iterated on independently of model
loading/generation code, and so the exact same prompt logic is used whether
the caller is `/predict` or the chat service's first turn.
"""

import json

_CLASSIFICATION_SYSTEM_PROMPT = (
    "You are LeafMind, a botanical identification assistant specialized in "
    "medicinal plant leaves. You analyze leaf images for shape, margin, "
    "venation pattern, color, texture, and any visible surface features, and "
    "identify the most likely species. You must always answer using the exact "
    "JSON schema requested — no prose outside the JSON."
)

_CHAT_SYSTEM_PROMPT = (
    "You are LeafMind, a helpful assistant knowledgeable about medicinal "
    "plants and leaf identification. Answer clearly and concisely. If a "
    "previous identification result is provided as context, ground your "
    "answer in it, but say so explicitly if you are uncertain."
)


def build_classification_prompt(
    *, candidate_labels: list[str], top_k: int, has_few_shot_examples: bool = False
) -> str:
    """User-turn text prompt instructing the model to classify a leaf image.

    `candidate_labels` gives the model a closed set of species drawn from the
    dataset taxonomy (see `app.datasets.loader`) to bias it toward answers
    that are actually in-scope for this system, while still allowing an
    "other/unknown" fallback so it isn't forced into a wrong forced choice.
    """
    labels_block = "\n".join(f"- {label}" for label in candidate_labels)
    schema_example = json.dumps(
        {
            "candidates": [
                {"label": "Genus_species", "confidence": 0.0, "reasoning": "short justification"}
            ]
        },
        indent=2,
    )
    few_shot_preamble = (
        "Above are labeled reference images of known species, each followed by its "
        "correct label, retrieved because they are visually similar to the new leaf "
        "below. Use them as few-shot examples grounding your identification.\n\n"
        if has_few_shot_examples
        else ""
    )
    return (
        f"{few_shot_preamble}"
        "Identify the medicinal plant species shown in this leaf image.\n\n"
        f"Known candidate species (prefer one of these if it plausibly matches):\n{labels_block}\n\n"
        f"Return exactly the top {top_k} most likely candidates, ranked most to least likely, "
        "as strict JSON matching this schema (confidence is a float between 0 and 1, "
        "reflecting your genuine certainty):\n\n"
        f"{schema_example}\n\n"
        "If none of the known candidates plausibly match, use your own best-guess "
        "scientific name (or \"Unknown\") as the label instead. Respond with JSON only."
    )


def build_classification_messages(
    *,
    pil_image,
    candidate_labels: list[str],
    top_k: int,
    few_shot_examples: list[tuple[object, str]] | None = None,
) -> list[dict]:
    """Qwen2.5-VL chat-format messages for a single classification turn.

    `few_shot_examples` is an optional list of (pil_image, label) pairs —
    visually similar, correctly labeled reference images retrieved by
    `app.rag.image_retriever.ImageRetriever` — attached ahead of the query
    image so the model has concrete grounded examples instead of relying
    purely on its own pretrained knowledge of the candidate label text.
    """
    few_shot_examples = few_shot_examples or []

    content: list[dict] = []
    for example_image, example_label in few_shot_examples:
        content.append({"type": "image", "image": example_image})
        content.append({"type": "text", "text": f"Known reference: {example_label}"})

    content.append({"type": "image", "image": pil_image})
    content.append(
        {
            "type": "text",
            "text": build_classification_prompt(
                candidate_labels=candidate_labels,
                top_k=top_k,
                has_few_shot_examples=bool(few_shot_examples),
            ),
        }
    )

    return [
        {"role": "system", "content": _CLASSIFICATION_SYSTEM_PROMPT},
        {"role": "user", "content": content},
    ]


def build_chat_messages(
    *,
    user_message: str,
    history: list[tuple[str, str]],
    pil_image=None,
    prediction_context: str | None = None,
) -> list[dict]:
    """Qwen2.5-VL chat-format messages for a conversational turn.

    `history` is a list of (role, text) pairs already truncated to the
    configured window by the caller (`ChatService`). `pil_image` is optional —
    later turns in a conversation may be text-only, referencing a leaf image
    uploaded earlier via `prediction_context` instead of re-attaching it.
    """
    messages: list[dict] = [{"role": "system", "content": _CHAT_SYSTEM_PROMPT}]

    if prediction_context:
        messages.append(
            {
                "role": "system",
                "content": f"Prior identification result for this conversation: {prediction_context}",
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
