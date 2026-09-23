"""FastAPI and Starlette integration.

Written as a raw ASGI middleware rather than against Starlette's
`BaseHTTPMiddleware`, because that class buffers streaming responses and
changes exception handling. Instrumentation that alters how an application
streams or reports errors is not instrumentation any more.
"""

from __future__ import annotations

import time
from typing import Any, Awaitable, Callable, MutableMapping

from ..capture import parse_body
from ..client import TELLANN
from .data_hooks import install_data_hooks
from ..request_context import (
    current_request_context,
    enter_request_context,
    exit_request_context,
    new_request_context,
)

Scope = MutableMapping[str, Any]
Receive = Callable[[], Awaitable[MutableMapping[str, Any]]]
Send = Callable[[MutableMapping[str, Any]], Awaitable[None]]

#: Beyond this, a body is reported by size only. The capture config clips again
#: on the way out; this ceiling is about not holding a large upload in memory.
MAX_CAPTURED_BODY_BYTES = 64 * 1024


def _route_of(scope: Scope) -> str:
    """The matched route template, so path parameters never reach telemetry."""
    route = scope.get("route")
    path_format = getattr(route, "path_format", None) or getattr(route, "path", None)
    if isinstance(path_format, str) and path_format:
        return path_format
    return str(scope.get("path") or "/")


def _headers_of(scope_or_message: Any) -> dict:
    """ASGI headers arrive as a list of byte pairs."""
    raw = scope_or_message.get("headers") or []
    headers: dict = {}
    for key, value in raw:
        try:
            headers[key.decode("latin-1").lower()] = value.decode("latin-1")
        except Exception:
            continue
    return headers


def _query_of(scope: Scope) -> dict:
    raw = scope.get("query_string") or b""
    if not raw:
        return {}
    from urllib.parse import parse_qsl

    try:
        return dict(parse_qsl(raw.decode("latin-1")))
    except Exception:
        return {}


class TellannASGIMiddleware:
    """Request telemetry for any ASGI application."""

    def __init__(self, app: Any) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope.get("type") != "http":
            await self.app(scope, receive, send)
            return

        started = time.monotonic()
        status_code: dict = {"value": None}
        request_chunks: list = []
        response_chunks: list = []
        response_headers: dict = {}
        request_headers = _headers_of(scope)

        # The request body is read once, by the application. Tapping `receive`
        # copies what the application is given without consuming it, which is
        # the only way an ASGI middleware can see a body at all.
        async def receive_wrapper() -> MutableMapping[str, Any]:
            message = await receive()
            if message.get("type") == "http.request":
                body = message.get("body") or b""
                if body and sum(len(chunk) for chunk in request_chunks) < MAX_CAPTURED_BODY_BYTES:
                    request_chunks.append(body)
            return message

        async def send_wrapper(message: MutableMapping[str, Any]) -> None:
            if message.get("type") == "http.response.start":
                status_code["value"] = message.get("status")
                response_headers.update(_headers_of(message))
            elif message.get("type") == "http.response.body":
                body = message.get("body") or b""
                if body and sum(len(chunk) for chunk in response_chunks) < MAX_CAPTURED_BODY_BYTES:
                    response_chunks.append(body)
            await send(message)

        token = enter_request_context(new_request_context(
            method=scope.get("method", "GET"),
            route=str(scope.get("path") or "/"),
            session_id=request_headers.get("x-tellann-session-id"),
            run_id=request_headers.get("x-tellann-run-id"),
            trace_id=request_headers.get("x-tellann-trace-id"),
        ))
        try:
            await self.app(scope, receive_wrapper, send_wrapper)
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
                # Read after the call: Starlette sets `scope["route"]` while
                # routing, so before the call there is nothing to read.
                route = _route_of(scope)
                context = current_request_context()
                if context is not None:
                    context["route"] = route
                endpoint = scope.get("endpoint")
                TELLANN.track_api(
                    scope.get("method", "GET"),
                    route,
                    status_code["value"],
                    (time.monotonic() - started) * 1000,
                    endpoint=str(scope.get("path") or route),
                    framework="asgi",
                    handler=getattr(endpoint, "__qualname__", None) or getattr(endpoint, "__name__", None),
                    query=_query_of(scope),
                    request_body=parse_body(
                        b"".join(request_chunks), request_headers.get("content-type", "")
                    ),
                    response_body=parse_body(
                        b"".join(response_chunks), response_headers.get("content-type", "")
                    ),
                    request_headers=request_headers,
                    response_headers=response_headers,
                )
            except Exception:  # pragma: no cover
                pass
            try:
                TELLANN.flush_data_access(context)
            except Exception:  # pragma: no cover
                pass
            exit_request_context(token)


def instrument_fastapi(app: Any) -> Any:
    """Add Tellann telemetry to a FastAPI or Starlette application.

    Idempotent, for the same reason the Flask helper is: an application object
    built by a factory is frequently constructed more than once per process.
    """
    if getattr(app, "_tellann_instrumented", False):
        return app
    if not TELLANN.is_initialized():
        TELLANN.initialize()
    install_data_hooks()
    app.add_middleware(TellannASGIMiddleware)
    app._tellann_instrumented = True
    return app


#: Starlette applications use the same helper; the alias documents that.
instrument_starlette = instrument_fastapi
