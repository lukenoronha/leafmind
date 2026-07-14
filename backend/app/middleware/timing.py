"""Response timing middleware — adds Server-Timing header for client-side
diagnostics, and maintains a small process-lifetime rolling window of recent
request latencies for `/admin/monitoring/status` (Sprint 7).
"""

import time
from collections import deque

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

_RECENT_LATENCIES_MS: deque[float] = deque(maxlen=500)


def get_recent_latency_stats() -> dict:
    """Rolling average/p95 request latency over the last (up to) 500 requests.

    Ephemeral, in-memory, process-lifetime data — deliberately not persisted,
    mirroring `app.core.uptime`'s process-start-time tracker. Returns zeros
    if no requests have been observed yet (e.g. immediately after boot).
    """
    samples = list(_RECENT_LATENCIES_MS)
    if not samples:
        return {"avg_request_latency_ms": 0.0, "p95_request_latency_ms": 0.0, "sample_count": 0}

    sorted_samples = sorted(samples)
    p95_index = min(int(len(sorted_samples) * 0.95), len(sorted_samples) - 1)
    return {
        "avg_request_latency_ms": round(sum(samples) / len(samples), 2),
        "p95_request_latency_ms": round(sorted_samples[p95_index], 2),
        "sample_count": len(samples),
    }


class ResponseTimingMiddleware(BaseHTTPMiddleware):
    """Measures total request handling time and exposes it via Server-Timing."""

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        start_time = time.perf_counter()
        response = await call_next(request)
        duration_ms = (time.perf_counter() - start_time) * 1000
        response.headers["Server-Timing"] = f"total;dur={duration_ms:.2f}"
        _RECENT_LATENCIES_MS.append(duration_ms)
        return response
