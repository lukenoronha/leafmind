"""Response timing middleware — adds Server-Timing header for client-side diagnostics."""

import time

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response


class ResponseTimingMiddleware(BaseHTTPMiddleware):
    """Measures total request handling time and exposes it via Server-Timing."""

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        start_time = time.perf_counter()
        response = await call_next(request)
        duration_ms = (time.perf_counter() - start_time) * 1000
        response.headers["Server-Timing"] = f"total;dur={duration_ms:.2f}"
        return response
