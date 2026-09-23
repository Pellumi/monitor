"""Django integration.

Added to `MIDDLEWARE` by the instrumenter. It reports the matched URL pattern
rather than the concrete path, so `/invoices/41/` and `/invoices/42/` are the
same endpoint in the graph instead of two, and so no identifier from a URL ends
up in telemetry.
"""

from __future__ import annotations

import time
from contextlib import ExitStack
from typing import Any, Callable

from ..capture import parse_body
from ..client import TELLANN
from .data_hooks import install_data_hooks
from ..request_context import (
    current_request_context,
    enter_request_context,
    exit_request_context,
    new_request_context,
)


def _route_of(request: Any) -> str:
    """The URL pattern Django matched, falling back to the path."""
    match = getattr(request, "resolver_match", None)
    route = getattr(match, "route", None) if match is not None else None
    if isinstance(route, str) and route:
        return route if route.startswith("/") else f"/{route}"
    path = getattr(request, "path", "") or ""
    return path or "/"


def _handler_of(request: Any) -> str | None:
    """The view that served the request, as `module.name`."""
    match = getattr(request, "resolver_match", None)
    if match is None:
        return None
    view = getattr(match, "func", None)
    name = getattr(view, "__qualname__", None) or getattr(view, "__name__", None)
    module = getattr(view, "__module__", None)
    if not name:
        return getattr(match, "view_name", None)
    return f"{module}.{name}" if module else name


def _correlation_of(request: Any) -> dict:
    """Run and session identity, as the desktop's relay stamps it on requests."""
    headers = getattr(request, "headers", None) or {}
    get = headers.get if hasattr(headers, "get") else (lambda key, default=None: default)
    return {
        "session_id": get("x-tellann-session-id") or get("X-Tellann-Session-Id"),
        "run_id": get("x-tellann-run-id") or get("X-Tellann-Run-Id"),
        "trace_id": get("x-tellann-trace-id") or get("X-Tellann-Trace-Id"),
    }


def _request_body(request: Any) -> Any:
    """The parsed request body, or nothing.

    `request.body` raises once the stream has been consumed - a file upload, a
    streaming parser - and reading it again would break the view. Anything that
    raises is reported as absent rather than as an error.
    """
    try:
        content_type = getattr(request, "content_type", "") or ""
        if "multipart/form-data" in content_type:
            return {"multipart": True, "fields": list(getattr(request, "POST", {}).keys())}
        raw = getattr(request, "body", None)
    except Exception:
        return None
    return parse_body(raw, content_type)


def _response_body(response: Any) -> Any:
    """The response body, for ordinary buffered responses only."""
    if getattr(response, "streaming", False):
        return None
    try:
        content_type = str(response.get("Content-Type", "") if hasattr(response, "get") else "")
        if "json" not in content_type and "text" not in content_type:
            return None
        return parse_body(getattr(response, "content", None), content_type)
    except Exception:
        return None


class TellannMiddleware:
    """Request telemetry for Django's synchronous middleware chain."""

    def __init__(self, get_response: Callable[[Any], Any]) -> None:
        self.get_response = get_response
        # Model telemetry is attached here rather than from `instrument_django`,
        # because a Django project instrumented by the desktop only ever gets
        # this middleware added to settings - nothing calls that helper. By the
        # time middleware is constructed the app registry is loaded, which is
        # exactly what connecting model signals requires.
        install_data_hooks(django=True)

    def __call__(self, request: Any) -> Any:
        started = time.monotonic()
        correlation = _correlation_of(request)
        context = new_request_context(
            method=getattr(request, "method", "GET"),
            route=getattr(request, "path", None),
            **correlation,
        )
        token = enter_request_context(context)
        try:
            with ExitStack() as stack:
                self._watch_reads(stack)
                response = self.get_response(request)
            try:
                context = current_request_context() or {}
                # Read after the view has run: `resolver_match` is only set
                # once Django has routed, so before the call there is nothing.
                route = _route_of(request)
                context["route"] = route
                TELLANN.track_api(
                    getattr(request, "method", "GET"),
                    route,
                    getattr(response, "status_code", None),
                    (time.monotonic() - started) * 1000,
                    endpoint=getattr(request, "path", None),
                    framework="django",
                    handler=_handler_of(request),
                    query=dict(getattr(request, "GET", {}) or {}),
                    request_body=_request_body(request),
                    response_body=_response_body(response),
                    request_headers=dict(getattr(request, "headers", {}) or {}),
                    response_headers=dict(getattr(response, "headers", {}) or {}),
                )
            except Exception:  # pragma: no cover - telemetry never breaks a response
                pass
            try:
                # One row per table, after the response: a view that queries in
                # a loop reports what it touched, not every time it touched it.
                TELLANN.flush_data_access(context)
            except Exception:  # pragma: no cover
                pass
            return response
        finally:
            exit_request_context(token)

    @staticmethod
    def _watch_reads(stack: ExitStack) -> None:
        """Record the tables this request reads, on every open connection."""
        try:
            from django.db import connections

            from .django_orm import read_wrapper

            for alias in connections:
                stack.enter_context(connections[alias].execute_wrapper(read_wrapper))
        except Exception:  # pragma: no cover - reads are a bonus, never required
            pass

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
    install_data_hooks(django=True)
