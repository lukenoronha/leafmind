"""Read-only system/model-availability introspection for the developer System Status endpoint.

`psutil` is a lightweight, always-installed dependency (unlike torch/
transformers/chromadb/sentence-transformers), so it's imported at module level.
GPU/model-availability checks follow the existing lazy-import convention from
`app.inference.vlm.backend` / `app.rag.embedding` — `torch` is only imported
inside a try/except here, purely to call read-only inspection functions
(`torch.cuda.is_available()`), never to load a model. This module never
constructs `HFQwenVLBackend`/`SentenceTransformerBackend`/`ChromaVectorStore`
directly — it only checks whether their singletons have already been
instantiated, so calling it never triggers an expensive model load as a side
effect.
"""

from dataclasses import dataclass

import psutil


@dataclass
class GPUStatus:
    available: bool
    device_count: int
    device_names: list[str]


@dataclass
class ModelAvailability:
    vlm_importable: bool
    vlm_loaded: bool
    embedding_importable: bool
    embedding_loaded: bool


@dataclass
class ResourceUsage:
    cpu_percent: float
    memory_total_mb: float
    memory_used_mb: float
    memory_percent: float
    disk_total_gb: float
    disk_used_gb: float
    disk_percent: float


def get_gpu_status() -> GPUStatus:
    """Best-effort GPU introspection — never raises, never loads a model."""
    try:
        import torch
    except ImportError:
        return GPUStatus(available=False, device_count=0, device_names=[])

    try:
        available = torch.cuda.is_available()
        device_count = torch.cuda.device_count() if available else 0
        device_names = [torch.cuda.get_device_name(i) for i in range(device_count)]
    except Exception:
        return GPUStatus(available=False, device_count=0, device_names=[])

    return GPUStatus(available=available, device_count=device_count, device_names=device_names)


def get_model_availability() -> ModelAvailability:
    """Checks whether the VLM/embedding libraries are importable and whether
    their process-wide singletons have already been loaded — without loading
    them itself (loading only happens lazily on the first real `/predict`,
    `/rag/query`, or `/documents/upload` call).
    """
    vlm_importable = _is_importable("transformers") and _is_importable("torch")
    embedding_importable = _is_importable("sentence_transformers")

    vlm_loaded = False
    try:
        from app.inference.vlm.backend import _backend_instance

        vlm_loaded = _backend_instance is not None and _backend_instance._model is not None
    except Exception:
        vlm_loaded = False

    embedding_loaded = False
    try:
        from app.rag.embedding import _backend_instance as _embedding_instance

        embedding_loaded = (
            _embedding_instance is not None and _embedding_instance._model is not None
        )
    except Exception:
        embedding_loaded = False

    return ModelAvailability(
        vlm_importable=vlm_importable,
        vlm_loaded=vlm_loaded,
        embedding_importable=embedding_importable,
        embedding_loaded=embedding_loaded,
    )


def get_resource_usage(*, disk_path: str = ".") -> ResourceUsage:
    """CPU/memory/disk snapshot via `psutil`. `interval=None` means the CPU
    reading is instantaneous (non-blocking) rather than sampled over time.
    """
    memory = psutil.virtual_memory()
    disk = psutil.disk_usage(disk_path)

    return ResourceUsage(
        cpu_percent=psutil.cpu_percent(interval=None),
        memory_total_mb=round(memory.total / (1024 * 1024), 2),
        memory_used_mb=round(memory.used / (1024 * 1024), 2),
        memory_percent=memory.percent,
        disk_total_gb=round(disk.total / (1024 * 1024 * 1024), 2),
        disk_used_gb=round(disk.used / (1024 * 1024 * 1024), 2),
        disk_percent=disk.percent,
    )


def _is_importable(module_name: str) -> bool:
    try:
        __import__(module_name)
    except ImportError:
        return False
    return True
