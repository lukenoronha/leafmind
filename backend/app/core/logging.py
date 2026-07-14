"""Loguru-based structured logging configuration."""

import logging
import sys
from pathlib import Path

from loguru import logger

from app.core.config import settings


class InterceptHandler(logging.Handler):
    """Redirects stdlib logging (uvicorn, sqlalchemy, etc.) into Loguru."""

    def emit(self, record: logging.LogRecord) -> None:
        try:
            level = logger.level(record.levelname).name
        except ValueError:
            level = record.levelno

        frame, depth = logging.currentframe(), 2
        while frame and frame.f_code.co_filename == logging.__file__:
            frame = frame.f_back
            depth += 1

        logger.opt(depth=depth, exception=record.exc_info).log(
            level, record.getMessage()
        )


def configure_logging() -> None:
    """Configure Loguru sinks: console + rotating file handlers."""
    log_dir = Path(settings.LOG_DIR)
    log_dir.mkdir(parents=True, exist_ok=True)

    logger.remove()

    logger.add(
        sys.stdout,
        level=settings.LOG_LEVEL,
        colorize=True,
        format=(
            "<green>{time:YYYY-MM-DD HH:mm:ss.SSS}</green> | "
            "<level>{level: <8}</level> | "
            "<cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - "
            "<level>{message}</level>"
        ),
        backtrace=settings.DEBUG,
        diagnose=settings.DEBUG,
    )

    logger.add(
        log_dir / "leafmind.log",
        level=settings.LOG_LEVEL,
        rotation=settings.LOG_ROTATION,
        retention=settings.LOG_RETENTION,
        compression="zip",
        serialize=settings.LOG_SERIALIZE_JSON,
        backtrace=False,
        diagnose=False,
        enqueue=True,
    )

    logger.add(
        log_dir / "errors.log",
        level="ERROR",
        rotation=settings.LOG_ROTATION,
        retention=settings.LOG_RETENTION,
        compression="zip",
        serialize=settings.LOG_SERIALIZE_JSON,
        backtrace=True,
        diagnose=False,
        enqueue=True,
    )

    # Dedicated JSON-lines sink (Sprint 5): purely additive, always serialized
    # regardless of LOG_SERIALIZE_JSON, so `GET /developer/logs` has a stable
    # machine-readable source to filter/paginate without depending on the
    # human-readable sinks above ever changing format.
    logger.add(
        log_dir / "structured.jsonl",
        level=settings.LOG_LEVEL,
        rotation=settings.LOG_ROTATION,
        retention=settings.LOG_RETENTION,
        compression="zip",
        serialize=True,
        backtrace=False,
        diagnose=False,
        enqueue=True,
    )

    # Route stdlib/uvicorn logging through Loguru for a single unified log stream.
    logging.basicConfig(handlers=[InterceptHandler()], level=0, force=True)
    for noisy_logger in ("uvicorn", "uvicorn.access", "uvicorn.error", "sqlalchemy.engine"):
        logging.getLogger(noisy_logger).handlers = [InterceptHandler()]
        logging.getLogger(noisy_logger).propagate = False

    logger.info(
        "Logging configured | environment={} level={}",
        settings.ENVIRONMENT,
        settings.LOG_LEVEL,
    )
