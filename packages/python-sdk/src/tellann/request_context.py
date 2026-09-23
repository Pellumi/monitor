"""Ties a persistence operation to the request that caused it.

`contextvars` is Python's counterpart to `AsyncLocalStorage`, and it is what
makes "which models did this endpoint touch" answerable without the application
threading a context object down through every layer. It follows `await` in an
ASGI application and stays put in a synchronous WSGI worker, which covers
Django, Flask and FastAPI alike.

Work that escapes the request - a Celery task, a thread, a background job -
lands in no context at all and is reported without a route, which is correct:
it did not belong to that request.
"""

from __future__ import annotations

import contextvars
from typing import Any, Dict, List, Optional

_CURRENT: contextvars.ContextVar[Optional[Dict[str, Any]]] = contextvars.ContextVar(
    "tellann_request_context", default=None
)

#: A request in a loop can touch one model thousands of times; the run needs
#: the shape of what happened, not an unbounded list.
MAX_DATA_ACCESS = 200


def new_request_context(
    *,
    method: Optional[str] = None,
    route: Optional[str] = None,
    session_id: Optional[str] = None,
    run_id: Optional[str] = None,
    trace_id: Optional[str] = None,
) -> Dict[str, Any]:
    return {
        "method": method,
        "route": route,
        "session_id": session_id,
        "run_id": run_id,
        "trace_id": trace_id,
        "data_access": [],
    }


def enter_request_context(context: Dict[str, Any]) -> contextvars.Token:
    """Bind a context to the current execution. Reset with `exit_request_context`."""
    return _CURRENT.set(context)


def exit_request_context(token: contextvars.Token) -> None:
    try:
        _CURRENT.reset(token)
    except ValueError:
        # The token belongs to a different context - the request finished on
        # another task. Clearing is still the right outcome.
        _CURRENT.set(None)


def current_request_context() -> Optional[Dict[str, Any]]:
    return _CURRENT.get()


def record_data_access(
    model: str,
    operation: str,
    *,
    records: Optional[int] = None,
    duration_ms: Optional[float] = None,
    mutation: Optional[bool] = None,
) -> Optional[Dict[str, Any]]:
    """Record one operation against the in-flight request, if there is one."""
    context = _CURRENT.get()
    if context is None:
        return None
    entries: List[Dict[str, Any]] = context["data_access"]
    if len(entries) < MAX_DATA_ACCESS:
        entries.append({
            "model": model,
            "operation": operation,
            "records": records,
            "durationMs": duration_ms,
            "mutation": mutation,
        })
    return context


def summarize_data_access(entries: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """One entry per model and operation, with records summed and reads counted.

    Collapsing matters: a request that reads one model in a loop produces
    thousands of entries, and reporting each one would flood the run with rows
    that all say the same thing. The count keeps the volume visible without the
    noise.
    """
    totals: Dict[str, Dict[str, Any]] = {}
    for entry in entries:
        key = f"{entry.get('model')}:{entry.get('operation')}"
        existing = totals.get(key)
        if existing is None:
            totals[key] = {
                "model": entry.get("model"),
                "operation": entry.get("operation"),
                "records": entry.get("records"),
                "count": 1,
                "mutation": bool(entry.get("mutation")),
            }
            continue
        existing["count"] += 1
        if entry.get("records") is not None:
            existing["records"] = (existing.get("records") or 0) + entry["records"]
    return list(totals.values())[:50]
