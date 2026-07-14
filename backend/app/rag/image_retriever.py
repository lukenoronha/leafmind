"""Few-shot image retrieval — embeds a query leaf image with CLIP, searches the
reference-image vector store, and returns the top-K visually similar labeled
examples to ground VLM classification.

Mirrors `app.rag.retriever.Retriever`'s shape (embed query -> vector-store
query -> similarity filter), but over CLIP image vectors and the reference
image collection instead of text-chunk vectors, so it depends only on the
`CLIPBackend` and `VectorStore` protocols.
"""

import time
from dataclasses import dataclass

from loguru import logger

from app.core.config import Settings, get_settings
from app.inference.clip.backend import CLIPBackend, get_clip_backend
from app.rag.vectorstore import VectorStore, get_image_vector_store


@dataclass
class RetrievedReferenceImage:
    """One few-shot retrieval hit: a labeled reference image and its similarity score."""

    image_path: str
    label: str
    score: float


class ImageRetriever:
    """Turns a query leaf image into a ranked, filtered list of labeled reference images."""

    def __init__(
        self,
        *,
        clip_backend: CLIPBackend | None = None,
        vector_store: VectorStore | None = None,
        settings: Settings | None = None,
    ):
        self._settings = settings or get_settings()
        self._clip_backend = clip_backend or get_clip_backend()
        self._vector_store = vector_store or get_image_vector_store()

    def retrieve(
        self,
        pil_image,
        *,
        top_k: int | None = None,
        similarity_threshold: float | None = None,
    ) -> list[RetrievedReferenceImage]:
        """Retrieve the most visually similar labeled reference images for `pil_image`."""
        top_k = top_k if top_k is not None else self._settings.CLIP_FEW_SHOT_TOP_K
        if similarity_threshold is None:
            similarity_threshold = self._settings.CLIP_FEW_SHOT_SIMILARITY_THRESHOLD

        start = time.perf_counter()

        [query_vector] = self._clip_backend.embed_images([pil_image])
        matches = self._vector_store.query(query_vector, top_k=top_k)

        results: list[RetrievedReferenceImage] = []
        for match in matches:
            # Cosine distance in [0, 2] -> similarity in [0, 1].
            similarity = 1.0 - (match.distance / 2.0)
            if similarity < similarity_threshold:
                continue
            results.append(
                RetrievedReferenceImage(
                    image_path=match.metadata.get("image_path", ""),
                    label=match.metadata.get("label", ""),
                    score=round(similarity, 4),
                )
            )

        retrieval_ms = (time.perf_counter() - start) * 1000
        logger.bind(
            retrieval_ms=round(retrieval_ms, 2), matches_returned=len(results), top_k=top_k
        ).info("CLIP few-shot image retrieval completed")

        return results
