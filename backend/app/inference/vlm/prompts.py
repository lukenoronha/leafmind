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

_LEAF_ASSESSMENT_SYSTEM_PROMPT = (
    "You are an image content checker for a plant leaf identification system. "
    "You only judge what is visible in the photo — you never guess a species. "
    "You must always answer using the exact JSON schema requested — no prose "
    "outside the JSON."
)


def build_classification_prompt(
    *,
    candidate_labels: list[str],
    top_k: int,
    has_few_shot_examples: bool = False,
    trained_classifier_hint: tuple[str, float] | None = None,
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
    classifier_hint_block = ""
    if trained_classifier_hint is not None:
        hint_label, hint_confidence = trained_classifier_hint
        classifier_hint_block = (
            "A separate classifier trained on labeled reference images of these "
            f"species predicts '{hint_label}' with {hint_confidence:.0%} confidence. "
            "Treat this as one additional signal, not a guaranteed answer — weigh it "
            "against the visual evidence yourself.\n\n"
        )
    return (
        f"{few_shot_preamble}"
        f"{classifier_hint_block}"
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
    trained_classifier_hint: tuple[str, float] | None = None,
) -> list[dict]:
    """Qwen2.5-VL chat-format messages for a single classification turn.

    `few_shot_examples` is an optional list of (pil_image, label) pairs —
    visually similar, correctly labeled reference images retrieved by
    `app.rag.image_retriever.ImageRetriever` — attached ahead of the query
    image so the model has concrete grounded examples instead of relying
    purely on its own pretrained knowledge of the candidate label text.

    `trained_classifier_hint` is an optional (label, confidence) pair from
    `app.inference.clip.classifier.TrainedCLIPClassifier` — a linear model
    fit on this dataset's CLIP embeddings, folded in as a text hint rather
    than overriding the VLM's own reasoning.
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
                trained_classifier_hint=trained_classifier_hint,
            ),
        }
    )

    return [
        {"role": "system", "content": _CLASSIFICATION_SYSTEM_PROMPT},
        {"role": "user", "content": content},
    ]


def build_leaf_assessment_messages(*, pil_image) -> list[dict]:
    """Qwen2.5-VL chat-format messages for the pre-classification content check.

    Combines leaf-presence, leaf-count, and occlusion assessment into a
    single generation call (rather than three separate ones) — the lightest
    way to add this validation stage on top of the existing VLM without a
    second model. Blur/lighting are deliberately excluded here since those
    are cheaper to compute directly from pixel data (see
    `app.images.preprocessing.content_validation`) and don't need a model call.
    """
    schema_example = json.dumps(
        {
            "is_leaf": True,
            "leaf_count": 1,
            "is_heavily_occluded": False,
            "reasoning": "short justification",
        },
        indent=2,
    )
    prompt = (
        "Look at this image and answer only about what is visible — do not "
        "identify a species.\n\n"
        "1. is_leaf: true if the image's main subject is one or more plant "
        "leaves (not a whole plant/tree, not an unrelated object, not a "
        "person/animal/document/etc.).\n"
        "2. leaf_count: your best count of distinct, clearly separate "
        "individual leaves that are prominent in the frame (use 1 if it's a "
        "single leaf, or if leaflets belong to one compound leaf).\n"
        "3. is_heavily_occluded: true if the leaf is so obstructed (by a "
        "hand, other objects, heavy shadow, or cropping) that its shape, "
        "margin, or venation cannot be clearly seen.\n\n"
        f"Respond with strict JSON matching this schema:\n\n{schema_example}\n\n"
        "Respond with JSON only."
    )

    return [
        {"role": "system", "content": _LEAF_ASSESSMENT_SYSTEM_PROMPT},
        {
            "role": "user",
            "content": [
                {"type": "image", "image": pil_image},
                {"type": "text", "text": prompt},
            ],
        },
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
