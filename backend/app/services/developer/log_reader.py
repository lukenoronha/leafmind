"""Reads and filters the structured JSON-lines log sink for the developer Logs endpoint.

Reads `logs/structured.jsonl` (added in `app.core.logging.configure_logging`
specifically for this purpose) rather than the human-readable sinks, so
filtering by level/text/time is a matter of parsing stable JSON fields rather
than a fragile text-format regex. Read-only — never writes to the log file.
"""

import json
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

from app.core.config import Settings, get_settings


@dataclass
class LogEntry:
    timestamp: datetime
    level: str
    message: str
    module: str
    function: str
    line: int
    extra: dict


class LogReader:
    """Reads Loguru's serialized JSON-lines sink, newest first."""

    def __init__(self, settings: Settings | None = None):
        self._settings = settings or get_settings()

    def read(
        self,
        *,
        level: str | None = None,
        search: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[LogEntry], int]:
        """Returns (page of entries newest-first, total matching count)."""
        entries = self._load_all()

        if level is not None:
            entries = [e for e in entries if e.level.upper() == level.upper()]
        if search:
            needle = search.lower()
            entries = [e for e in entries if needle in e.message.lower()]

        entries.sort(key=lambda e: e.timestamp, reverse=True)
        total = len(entries)

        return entries[offset : offset + limit], total

    def _load_all(self) -> list[LogEntry]:
        log_path = Path(self._settings.LOG_DIR) / "structured.jsonl"
        if not log_path.exists():
            return []

        entries: list[LogEntry] = []
        with log_path.open(encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    payload = json.loads(line)
                    record = payload["record"]
                    entries.append(
                        LogEntry(
                            timestamp=datetime.fromtimestamp(
                                record["time"]["timestamp"], tz=UTC
                            ),
                            level=record["level"]["name"],
                            message=record["message"],
                            module=record["name"] or "",
                            function=record["function"],
                            line=record["line"],
                            extra=record.get("extra", {}),
                        )
                    )
                except (json.JSONDecodeError, KeyError, ValueError):
                    continue

        return entries
