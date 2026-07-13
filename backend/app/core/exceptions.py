"""Application-wide exception types and handlers."""

from fastapi import Request, status
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from loguru import logger
from starlette.exceptions import HTTPException as StarletteHTTPException


class LeafMindError(Exception):
    """Base class for all domain-specific LeafMind exceptions."""

    def __init__(self, message: str, status_code: int = status.HTTP_400_BAD_REQUEST):
        self.message = message
        self.status_code = status_code
        super().__init__(message)


class ServiceUnavailableError(LeafMindError):
    """Raised when a downstream dependency (DB, vector store, model) is unreachable."""

    def __init__(self, message: str = "Service temporarily unavailable"):
        super().__init__(message, status_code=status.HTTP_503_SERVICE_UNAVAILABLE)


def _error_response(request: Request, status_code: int, message: str, details: object = None) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content=jsonable_encoder(
            {
                "success": False,
                "error": {
                    "status_code": status_code,
                    "message": message,
                    "path": request.url.path,
                    "details": details,
                },
            }
        ),
    )


async def leafmind_exception_handler(request: Request, exc: LeafMindError) -> JSONResponse:
    logger.error("Domain error on {} {}: {}", request.method, request.url.path, exc.message)
    return _error_response(request, exc.status_code, exc.message)


async def http_exception_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    logger.warning("HTTP {} on {} {}: {}", exc.status_code, request.method, request.url.path, exc.detail)
    return _error_response(request, exc.status_code, str(exc.detail))


async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    logger.warning("Validation error on {} {}: {}", request.method, request.url.path, exc.errors())
    return _error_response(
        request,
        status.HTTP_422_UNPROCESSABLE_ENTITY,
        "Request validation failed",
        details=exc.errors(),
    )


async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled exception on {} {}", request.method, request.url.path)
    return _error_response(
        request,
        status.HTTP_500_INTERNAL_SERVER_ERROR,
        "Internal server error",
    )
