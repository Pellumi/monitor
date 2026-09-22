"""Flask integration.

Attaches to an application object, so it works for both the module-level `app`
and the application-factory layout. The route reported is the matched rule
(`/invoices/<int:pk>`), never the concrete path.
"""

from __future__ import annotations

import time
from typing import Any

from ..capture import parse_body
from ..client import TELLANN
from ..request_context import (
    current_request_context,
    enter_request_context,
    exit_request_context,
    new_request_context,
)


def _correlation_of(headers: Any) -> dict:
    get = headers.get if hasattr(headers, "get") else (lambda key, default=None: default)
    return {
        "session_id": get("X-Tellann-Session-Id"),
        "run_id": get("X-Tellann-Run-Id"),
        "trace_id": get("X-Tellann-Trace-Id"),
    }


def instrument_flask(app: Any) -> Any:
    """Add request, error and timing telemetry to a Flask application.

    Idempotent: instrumenting the same application twice - which happens when
    a factory is called once per worker and once by a test - registers one set
    of hooks, not two, so events are not doubled.
    """
    if getattr(app, "_tellann_instrumented", False):
        return app

    if not TELLANN.is_initialized():
        TELLANN.initialize()

    @app.before_request
    def _tellann_before_request() -> None:  # pragma: no cover - exercised via Flask
        from flask import g, request

        g._tellann_started = time.monotonic()
        g._tellann_token = enter_request_context(new_request_context(
            method=request.method,
            route=getattr(request.url_rule, "rule", None) or request.path,
            **_correlation_of(request.headers),
        ))

    @app.after_request
    def _tellann_after_request(response: Any) -> Any:  # pragma: no cover - exercised via Flask
        from flask import g, request

        started = getattr(g, "_tellann_started", None)
        try:
            rule = getattr(request.url_rule, "rule", None) or request.path
            context = current_request_context()
            if context is not None:
                context["route"] = rule
            endpoint_function = app.view_functions.get(request.endpoint) if request.endpoint else None
            TELLANN.track_api(
                request.method,
                rule,
                getattr(response, "status_code", None),
                (time.monotonic() - started) * 1000 if started else None,
                endpoint=request.path,
                framework="flask",
                handler=getattr(endpoint_function, "__qualname__", None) or request.endpoint,
                query=dict(request.args or {}),
                request_body=(
                    request.get_json(silent=True)
                    or (dict(request.form) if request.form else None)
                    or parse_body(request.get_data(cache=True, as_text=True), request.content_type or "")
                ),
                response_body=(
                    None if getattr(response, "is_streamed", False)
                    else parse_body(response.get_data(as_text=True), response.content_type or "")
                ),
                request_headers=dict(request.headers or {}),
                response_headers=dict(response.headers or {}),
            )
        except Exception:
            pass
        return response

    @app.teardown_request
    def _tellann_teardown(error: BaseException | None) -> None:  # pragma: no cover
        from flask import g

        if error is not None:
            try:
                TELLANN.capture_error(error)
            except Exception:
                pass
        token = getattr(g, "_tellann_token", None)
        if token is not None:
            exit_request_context(token)

    app._tellann_instrumented = True
    return app
