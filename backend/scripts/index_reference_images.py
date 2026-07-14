"""One-time (re-runnable) indexing script: embeds every labeled image under
`datasets/raw/medicinal_leaf_images/<class>/` with CLIP and upserts the
vectors into the reference-image Chroma collection used by
`app.rag.image_retriever.ImageRetriever` for few-shot classification grounding.

Usage (from backend/):
    python -m scripts.index_reference_images
"""

import uuid

from PIL import Image
from loguru import logger

from app.core.config import get_settings
from app.datasets.loader import get_dataset_loader
from app.inference.clip.backend import get_clip_backend
from app.rag.vectorstore import VectorRecord, get_image_vector_store

BATCH_SIZE = 16


def main() -> None:
    settings = get_settings()
    loader = get_dataset_loader()
    clip_backend = get_clip_backend()
    vector_store = get_image_vector_store()

    classes = [c for c in loader.load_classes() if c.is_verified]
    logger.info("Indexing reference images for {} verified classes...", len(classes))

    total_indexed = 0
    for dataset_class in classes:
        image_paths = loader.sample_image_paths(dataset_class, limit=10_000)
        if not image_paths:
            logger.warning("No images found for class '{}', skipping", dataset_class.display_name)
            continue

        for batch_start in range(0, len(image_paths), BATCH_SIZE):
            batch_paths = image_paths[batch_start : batch_start + BATCH_SIZE]
            pil_images = [Image.open(p).convert("RGB") for p in batch_paths]
            vectors = clip_backend.embed_images(pil_images)

            records = [
                VectorRecord(
                    id=str(uuid.uuid5(uuid.NAMESPACE_URL, str(path))),
                    vector=vector,
                    text=dataset_class.display_name,
                    metadata={"label": dataset_class.display_name, "image_path": str(path)},
                )
                for path, vector in zip(batch_paths, vectors, strict=False)
            ]
            vector_store.upsert(records)
            total_indexed += len(records)

        logger.info(
            "Indexed {} reference images for class '{}'",
            len(image_paths),
            dataset_class.display_name,
        )

    logger.info(
        "Reference-image indexing complete: {} images across {} classes into collection '{}'",
        total_indexed,
        len(classes),
        settings.CLIP_COLLECTION_NAME,
    )


if __name__ == "__main__":
    main()
