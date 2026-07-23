"""Ad-hoc local GPU validation run — mirrors the server-side audit script.
Not part of the permanent scripts/ suite; safe to delete after use.
"""
import time
import sys
import json
import random

from app.datasets.loader import get_dataset_loader
from app.images.preprocessing.pipeline import ImagePreprocessingPipeline
from app.inference.vlm.pipeline import VLMInferencePipeline
from app.inference.clip.backend import get_clip_backend
from app.inference.clip.classifier import get_trained_clip_classifier
from app.rag.image_retriever import ImageRetriever

loader = get_dataset_loader()
classes = [c for c in loader.load_classes() if c.is_verified]
candidate_labels = [c.display_name for c in classes]
print(f"STAGE: Class label verification")
print(f"  verified (active) classes: {len(classes)}")
print()

random.seed(99)  # different seed again -- fresh sample from both prior runs
N_IMAGES = 20
selected = random.sample(classes, min(N_IMAGES, len(classes)))
if len(selected) < N_IMAGES:
    extra_needed = N_IMAGES - len(selected)
    selected = selected + random.choices(classes, k=extra_needed)

pipeline = ImagePreprocessingPipeline()
retriever = ImageRetriever()

print("STAGE: Warming up models (excluded from per-image timing)")
t0 = time.perf_counter()
get_clip_backend()._ensure_loaded()
print(f"  CLIP loaded: {time.perf_counter()-t0:.1f}s")
t0 = time.perf_counter()
try:
    get_trained_clip_classifier()._ensure_loaded()
    print(f"  Trained classifier loaded: {time.perf_counter()-t0:.1f}s")
except Exception as e:
    print(f"  Trained classifier unavailable: {e}")
t0 = time.perf_counter()
inference_pipeline = VLMInferencePipeline(image_retriever=retriever)
inference_pipeline._backend._ensure_loaded()
print(f"  Qwen2.5-VL loaded: {time.perf_counter()-t0:.1f}s")
print()
print("=" * 80)

results = []
used_image_indices = {}
for dataset_class in selected:
    idx = used_image_indices.get(dataset_class.display_name, 0)
    image_paths = loader.sample_image_paths(dataset_class, limit=idx + 1)
    if len(image_paths) <= idx:
        print(f"SKIP: no more images for {dataset_class.display_name}")
        continue
    image_path = image_paths[idx]
    used_image_indices[dataset_class.display_name] = idx + 1
    true_label = dataset_class.display_name

    print(f"TRUE LABEL: {true_label}")
    print(f"IMAGE PATH: {image_path}")

    t_total = time.perf_counter()

    t0 = time.perf_counter()
    raw_bytes = open(image_path, "rb").read()
    preprocessing_result = pipeline.run(raw_bytes)
    t_preprocess = time.perf_counter() - t0
    print(f"  [Preprocessing] {t_preprocess*1000:.1f}ms")

    t0 = time.perf_counter()
    few_shot_matches = retriever.retrieve(preprocessing_result.pil_image, top_k=5)
    t_retrieval = time.perf_counter() - t0
    retrieved_labels = [m.label for m in few_shot_matches]
    retrieved_scores = [round(m.score, 3) for m in few_shot_matches]
    print(f"  [CLIP Retrieval Top-5] {t_retrieval*1000:.1f}ms | {list(zip(retrieved_labels, retrieved_scores))}")

    t0 = time.perf_counter()
    try:
        hint_label, hint_conf = get_trained_clip_classifier().predict(preprocessing_result.pil_image)
        t_classifier = time.perf_counter() - t0
        print(f"  [Trained CLIP Classifier] {t_classifier*1000:.1f}ms | hint: {hint_label} ({hint_conf:.2%})")
    except Exception as e:
        print(f"  [Trained CLIP Classifier] unavailable: {e}")
        hint_label, hint_conf = None, None

    t0 = time.perf_counter()
    try:
        result = inference_pipeline.classify(preprocessing_result.pil_image, candidate_labels=candidate_labels, top_k=3)
        t_classify = time.perf_counter() - t0
        print(f"  [Full classify()] {t_classify:.1f}s")
        print(f"  [Parsed top prediction] {result.top_prediction.label} (confidence={result.top_prediction.confidence:.2%})")
        correct = result.top_prediction.label == true_label
        retrieval_top1_correct = (retrieved_labels[0] == true_label) if retrieved_labels else None
        print(f'  [RESULT] {"CORRECT" if correct else "INCORRECT"} | retrieval_top1_correct={retrieval_top1_correct}')
        results.append({
            "true_label": true_label, "predicted": result.top_prediction.label,
            "confidence": result.top_prediction.confidence, "correct": correct,
            "clip_hint": hint_label, "clip_hint_correct": hint_label == true_label,
            "retrieval_top5": retrieved_labels,
            "retrieval_top1": retrieved_labels[0] if retrieved_labels else None,
            "retrieval_top1_correct": retrieval_top1_correct,
            "preprocess_ms": t_preprocess*1000, "retrieval_ms": t_retrieval*1000, "classify_s": t_classify,
        })
    except Exception as e:
        print(f"  [ERROR] classify() failed: {e}")
        results.append({"true_label": true_label, "error": str(e)})

    print(f"  [TOTAL] {time.perf_counter()-t_total:.1f}s")
    print("-" * 80)

print()
print("=" * 80)
print("SUMMARY")
n = len(results)
correct_count = sum(1 for r in results if r.get("correct"))
clip_correct_count = sum(1 for r in results if r.get("clip_hint_correct"))
retrieval_correct_count = sum(1 for r in results if r.get("retrieval_top1_correct"))
print(f"N images: {n}")
print(f"Full pipeline (Qwen2.5-VL) accuracy: {correct_count}/{n} ({correct_count/n:.1%})")
print(f"Trained CLIP classifier hint accuracy: {clip_correct_count}/{n} ({clip_correct_count/n:.1%})")
print(f"CLIP retrieval top-1 accuracy: {retrieval_correct_count}/{n} ({retrieval_correct_count/n:.1%})")
print()
print("CONFUSION_MATRIX_CSV_START")
print("true_label,predicted_label,correct,retrieval_top1,retrieval_top1_correct")
for r in results:
    if "error" in r:
        print(f"{r['true_label']},ERROR,False,,")
    else:
        print(f"{r['true_label']},{r['predicted']},{r['correct']},{r['retrieval_top1']},{r['retrieval_top1_correct']}")
print("CONFUSION_MATRIX_CSV_END")
