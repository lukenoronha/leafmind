import time
import sys
import json
sys.path.insert(0, '/app')

from PIL import Image
from app.datasets.loader import get_dataset_loader
from app.images.preprocessing.pipeline import ImagePreprocessingPipeline
from app.inference.vlm.pipeline import VLMInferencePipeline
from app.inference.clip.backend import get_clip_backend
from app.inference.clip.classifier import get_trained_clip_classifier
from app.rag.image_retriever import ImageRetriever

loader = get_dataset_loader()
classes = [c for c in loader.load_classes() if c.is_verified]
candidate_labels = [c.display_name for c in classes]
print(f'STAGE: Class label verification')
print(f'  total classes in taxonomy: {len(loader.load_classes())}')
print(f'  verified (active) classes: {len(classes)}')
print(f'  candidate_labels sample: {candidate_labels[:3]} ... {candidate_labels[-3:]}')
print()

# Pick 10 real training images across different species
import random
random.seed(42)
selected = random.sample(classes, min(10, len(classes)))

pipeline = ImagePreprocessingPipeline()
retriever = ImageRetriever()

print('STAGE: Warming up models (excluded from per-image timing)')
t0 = time.perf_counter()
get_clip_backend()._ensure_loaded()
print(f'  CLIP loaded: {time.perf_counter()-t0:.1f}s')
t0 = time.perf_counter()
try:
    get_trained_clip_classifier()._ensure_loaded()
    print(f'  Trained classifier loaded: {time.perf_counter()-t0:.1f}s')
except Exception as e:
    print(f'  Trained classifier unavailable: {e}')
t0 = time.perf_counter()
inference_pipeline = VLMInferencePipeline(image_retriever=retriever)
inference_pipeline._backend._ensure_loaded()
print(f'  Qwen2.5-VL loaded: {time.perf_counter()-t0:.1f}s')
print()
print('=' * 80)

results = []
for dataset_class in selected:
    image_paths = loader.sample_image_paths(dataset_class, limit=1)
    if not image_paths:
        print(f'SKIP: no images for {dataset_class.display_name}')
        continue
    image_path = image_paths[0]
    true_label = dataset_class.display_name

    print(f'TRUE LABEL: {true_label}')
    print(f'IMAGE PATH: {image_path}')

    t_total = time.perf_counter()

    # Stage: read + preprocess
    t0 = time.perf_counter()
    raw_bytes = open(image_path, 'rb').read()
    preprocessing_result = pipeline.run(raw_bytes)
    t_preprocess = time.perf_counter() - t0
    print(f'  [Preprocessing] {t_preprocess*1000:.1f}ms | output size: {preprocessing_result.pil_image.size}')

    # Stage: CLIP retrieval (breakdown)
    t0 = time.perf_counter()
    few_shot_matches = retriever.retrieve(preprocessing_result.pil_image)
    t_retrieval = time.perf_counter() - t0
    retrieved_labels = [m.label for m in few_shot_matches]
    print(f'  [CLIP Few-Shot Retrieval] {t_retrieval*1000:.1f}ms | top matches: {retrieved_labels}')

    # Stage: trained classifier hint
    t0 = time.perf_counter()
    try:
        hint_label, hint_conf = get_trained_clip_classifier().predict(preprocessing_result.pil_image)
        t_classifier = time.perf_counter() - t0
        print(f'  [Trained CLIP Classifier] {t_classifier*1000:.1f}ms | hint: {hint_label} ({hint_conf:.2%})')
    except Exception as e:
        print(f'  [Trained CLIP Classifier] unavailable: {e}')
        hint_label, hint_conf = None, None

    # Stage: full classify() call (includes retrieval again internally + Qwen generation)
    t0 = time.perf_counter()
    try:
        result = inference_pipeline.classify(preprocessing_result.pil_image, candidate_labels=candidate_labels, top_k=3)
        t_classify = time.perf_counter() - t0
        print(f'  [Full classify() incl. Qwen generation] {t_classify:.1f}s')
        print(f'  [Raw Qwen response] {result.raw_response[:300]!r}')
        print(f'  [Parsed top prediction] {result.top_prediction.label} (confidence={result.top_prediction.confidence:.2%})')
        print(f'  [All candidates] {[(c.label, round(c.confidence,3)) for c in result.candidates]}')
        correct = result.top_prediction.label == true_label
        print(f'  [RESULT] {"CORRECT" if correct else "INCORRECT"}')
        results.append({
            'true_label': true_label, 'predicted': result.top_prediction.label,
            'confidence': result.top_prediction.confidence, 'correct': correct,
            'clip_hint': hint_label, 'clip_hint_correct': hint_label == true_label,
            'retrieval_top1': retrieved_labels[0] if retrieved_labels else None,
            'retrieval_top1_correct': (retrieved_labels[0] == true_label) if retrieved_labels else None,
            'preprocess_ms': t_preprocess*1000, 'retrieval_ms': t_retrieval*1000, 'classify_s': t_classify,
        })
    except Exception as e:
        print(f'  [ERROR] classify() failed: {e}')
        results.append({'true_label': true_label, 'error': str(e)})

    print(f'  [TOTAL for this image] {time.perf_counter()-t_total:.1f}s')
    print('-' * 80)

print()
print('=' * 80)
print('SUMMARY')
correct_count = sum(1 for r in results if r.get('correct'))
clip_correct_count = sum(1 for r in results if r.get('clip_hint_correct'))
retrieval_correct_count = sum(1 for r in results if r.get('retrieval_top1_correct'))
print(f'Full pipeline (Qwen2.5-VL) accuracy: {correct_count}/{len(results)}')
print(f'Trained CLIP classifier hint accuracy: {clip_correct_count}/{len(results)}')
print(f'CLIP retrieval top-1 accuracy: {retrieval_correct_count}/{len(results)}')
print()
print(json.dumps(results, indent=2))
