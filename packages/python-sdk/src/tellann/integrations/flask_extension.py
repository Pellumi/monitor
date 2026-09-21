"""Flask integration.

Attaches to an application object, so it works for both the module-level `app`
and the application-factory layout. The route reported is the matched rule
(`/invoices/<int:pk>`), never the concrete path.
"""

from __future__ import annotations

import time
from typing import Any

from ..client import TELLANN


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
        from flask import g

        g._tellann_started = time.monotonic()

    @app.after_request
    def _tellann_after_request(response: Any) -> Any:  # pragma: no cover - exercised via Flask
        from flask import g, request

        started = getattr(g, "_tellann_started", None)
        try:
            rule = getattr(request.url_rule, "rule", None) or request.path
            TELLANN.track_api(
                request.method,
                rule,
                getattr(response, "status_code", None),
                (time.monotonic() - started) * 1000 if started else None,
            )
        except Exception:
            pass
        return response

    @app.teardown_request
    def _tellann_teardown(error: BaseException | None) -> None:  # pragma: no cover
        if error is None:
            return
        try:
            TELLANN.capture_error(error)
        except Exception:
            pass

    app._tellann_instrumented = True
    return app
