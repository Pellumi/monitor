"""Django integration.

Added to `MIDDLEWARE` by the instrumenter. It reports the matched URL pattern
rather than the concrete path, so `/invoices/41/` and `/invoices/42/` are the
same endpoint in the graph instead of two, and so no identifier from a URL ends
up in telemetry.
"""

from __future__ import annotations

import time
from typing import Any, Callable

from ..client import TELLANN


def _route_of(request: Any) -> str:
    """The URL pattern Django matched, falling back to the path."""
    match = getattr(request, "resolver_match", None)
    route = getattr(match, "route", None) if match is not None else None
    if isinstance(route, str) and route:
        return route if route.startswith("/") else f"/{route}"
    path = getattr(request, "path", "") or ""
    return path or "/"


class TellannMiddleware:
    """Request telemetry for Django's synchronous middleware chain."""

    def __init__(self, get_response: Callable[[Any], Any]) -> None:
        self.get_response = get_response

    def __call__(self, request: Any) -> Any:
        started = time.monotonic()
        response = self.get_response(request)
        try:
            TELLANN.track_api(
                getattr(request, "method", "GET"),
                _route_of(request),
                getattr(response, "status_code", None),
                (time.monotonic() - started) * 1000,
            )
        except Exception:  # pragma: no cover - telemetry never breaks a response
            pass
        return response

    def process_exception(self, request: Any, exception: BaseException) -> None:
        """Report an unhandled view exception, then let Django handle it."""
        try:
            TELLANN.capture_error(
                exception,
                metadata={"route": _route_of(request), "method": getattr(request, "method", "GET")},
            )
        except Exception:  # pragma: no cover
            pass
        return None


def instrument_django() -> None:
    """Initialize from the environment. Called by the generated settings hook."""
    if not TELLANN.is_initialized():
        TELLANN.initialize()
