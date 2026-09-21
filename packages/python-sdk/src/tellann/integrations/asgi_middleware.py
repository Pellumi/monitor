"""FastAPI and Starlette integration.

Written as a raw ASGI middleware rather than against Starlette's
`BaseHTTPMiddleware`, because that class buffers streaming responses and
changes exception handling. Instrumentation that alters how an application
streams or reports errors is not instrumentation any more.
"""

from __future__ import annotations

import time
from typing import Any, Awaitable, Callable, MutableMapping

from ..client import TELLANN

Scope = MutableMapping[str, Any]
Receive = Callable[[], Awaitable[MutableMapping[str, Any]]]
Send = Callable[[MutableMapping[str, Any]], Awaitable[None]]


def _route_of(scope: Scope) -> str:
    """The matched route template, so path parameters never reach telemetry."""
    route = scope.get("route")
    path_format = getattr(route, "path_format", None) or getattr(route, "path", None)
    if isinstance(path_format, str) and path_format:
        return path_format
    return str(scope.get("path") or "/")


class TellannASGIMiddleware:
    """Request telemetry for any ASGI application."""

    def __init__(self, app: Any) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope.get("type") != "http":
            await self.app(scope, receive, send)
            return

        started = time.monotonic()
        status_code = {"value": None}

        async def send_wrapper(message: MutableMapping[str, Any]) -> None:
            if message.get("type") == "http.response.start":
                status_code["value"] = message.get("status")
            await send(message)

        try:
            await self.app(scope, receive, send_wrapper)
        except BaseException as error:
            try:
                TELLANN.capture_error(
                    error,
                    metadata={"route": _route_of(scope), "method": scope.get("method", "GET")},
                )
            except Exception:  # pragma: no cover
                pass
            raise
        finally:
            try:
                TELLANN.track_api(
                    scope.get("method", "GET"),
                    # Read after the call: Starlette sets `scope["route"]` while
                    # routing, so before the call there is nothing to read.
                    _route_of(scope),
                    status_code["value"],
                    (time.monotonic() - started) * 1000,
                )
            except Exception:  # pragma: no cover
                pass


def instrument_fastapi(app: Any) -> Any:
    """Add Tellann telemetry to a FastAPI or Starlette application.

    Idempotent, for the same reason the Flask helper is: an application object
    built by a factory is frequently constructed more than once per process.
    """
    if getattr(app, "_tellann_instrumented", False):
        return app
    if not TELLANN.is_initialized():
        TELLANN.initialize()
    app.add_middleware(TellannASGIMiddleware)
    app._tellann_instrumented = True
    return app


#: Starlette applications use the same helper; the alias documents that.
instrument_starlette = instrument_fastapi
