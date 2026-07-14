"""Process start-time tracking for uptime reporting.

`_started_at` is set at import time, which for this application happens once
during process startup (imported transitively via `app.main`) — a
lightweight stand-in for a true "app started" hook without adding logic to
`app.main`'s lifespan.
"""

import time

_started_at = time.monotonic()


def get_uptime_seconds() -> float:
    return time.monotonic() - _started_at
