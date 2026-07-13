"""Request logging middleware — logs method, path, status, and duration."""

import time
import uuid

from loguru import logger
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Assigns a request ID, logs request/response details, and records latency."""

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        request_id = str(uuid.uuid4())
        request.state.request_id = request_id

        start_time = time.perf_counter()
        logger.bind(request_id=request_id).info(
            "--> {} {}", request.method, request.url.path
        )

        response = await call_next(request)

        duration_ms = (time.perf_counter() - start_time) * 1000
        response.headers["X-Request-ID"] = request_id
        response.headers["X-Process-Time-Ms"] = f"{duration_ms:.2f}"

        logger.bind(request_id=request_id).info(
            "<-- {} {} status={} duration_ms={:.2f}",
            request.method,
            request.url.path,
            response.status_code,
            duration_ms,
        )
        return response
