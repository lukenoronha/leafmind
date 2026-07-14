"""Trains a linear classifier on top of frozen CLIP image embeddings.

Generic CLIP was pretrained on web images, not leaves specifically, so its
embedding space isn't naturally organized by leaf morphology. This script
reuses the CLIP embeddings already indexed by
`scripts/index_reference_images.py` (no re-embedding needed) and fits a
logistic regression head on top: embedding -> species label. That trained
head becomes an additional, dataset-specific classification signal
alongside CLIP few-shot retrieval and Qwen2.5-VL's zero-shot reasoning.

Usage (from backend/):
    python -m scripts.train_clip_classifier
"""

import json
from pathlib import Path

import numpy as np
from loguru import logger
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report, confusion_matrix
from sklearn.model_selection import train_test_split

from app.rag.vectorstore import get_image_vector_store

MODEL_DIR = Path("app/inference/clip/trained")
MODEL_PATH = MODEL_DIR / "classifier.joblib"
LABELS_PATH = MODEL_DIR / "classes.json"
REPORT_PATH = MODEL_DIR / "evaluation_report.json"

MIN_IMAGES_PER_CLASS = 4  # need at least train+val+test to split meaningfully
TEST_SIZE = 0.2
VAL_SIZE = 0.1


def main() -> None:
    store = get_image_vector_store()
    all_vectors = store.get_all()
    logger.info("Loaded {} indexed reference-image embeddings", len(all_vectors))

    by_label: dict[str, list[list[float]]] = {}
    for match in all_vectors:
        label = match.metadata.get("label", "")
        if not label or match.vector is None:
            continue
        by_label.setdefault(label, []).append(match.vector)

    excluded = {label: len(v) for label, v in by_label.items() if len(v) < MIN_IMAGES_PER_CLASS}
    if excluded:
        logger.warning(
            "Excluding {} classes with fewer than {} images: {}",
            len(excluded),
            MIN_IMAGES_PER_CLASS,
            excluded,
        )
    by_label = {k: v for k, v in by_label.items() if len(v) >= MIN_IMAGES_PER_CLASS}

    labels_sorted = sorted(by_label.keys())
    label_to_id = {label: i for i, label in enumerate(labels_sorted)}

    X, y = [], []
    for label, vectors in by_label.items():
        for vector in vectors:
            X.append(vector)
            y.append(label_to_id[label])
    X = np.array(X)
    y = np.array(y)

    logger.info("Training set: {} images across {} classes", len(X), len(labels_sorted))

    X_train, X_temp, y_train, y_temp = train_test_split(
        X, y, test_size=(TEST_SIZE + VAL_SIZE), stratify=y, random_state=42
    )
    relative_test_size = TEST_SIZE / (TEST_SIZE + VAL_SIZE)
    X_val, X_test, y_val, y_test = train_test_split(
        X_temp, y_temp, test_size=relative_test_size, stratify=y_temp, random_state=42
    )
    logger.info(
        "Split -> train={} val={} test={}", len(X_train), len(X_val), len(X_test)
    )

    clf = LogisticRegression(max_iter=2000, C=1.0)
    clf.fit(X_train, y_train)

    val_accuracy = clf.score(X_val, y_val)
    test_accuracy = clf.score(X_test, y_test)
    logger.info("Validation accuracy: {:.4f}", val_accuracy)
    logger.info("Test accuracy: {:.4f}", test_accuracy)

    y_test_pred = clf.predict(X_test)
    report = classification_report(
        y_test, y_test_pred, target_names=labels_sorted, zero_division=0, output_dict=True
    )
    conf_matrix = confusion_matrix(y_test, y_test_pred).tolist()

    MODEL_DIR.mkdir(parents=True, exist_ok=True)

    import joblib

    joblib.dump(clf, MODEL_PATH)
    LABELS_PATH.write_text(json.dumps(labels_sorted, indent=2), encoding="utf-8")
    REPORT_PATH.write_text(
        json.dumps(
            {
                "val_accuracy": val_accuracy,
                "test_accuracy": test_accuracy,
                "classification_report": report,
                "confusion_matrix": conf_matrix,
                "class_labels": labels_sorted,
                "excluded_classes": excluded,
            },
            indent=2,
        ),
        encoding="utf-8",
    )

    logger.info("Saved trained classifier to {}", MODEL_PATH)
    logger.info("Saved evaluation report to {}", REPORT_PATH)


if __name__ == "__main__":
    main()
