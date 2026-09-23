"""SQLAlchemy telemetry.

Reports which mapped classes a session flushed, using SQLAlchemy's ORM events.
Like the Django integration it reports the model and the operation, never the
statement or its parameters: a `WHERE` clause routinely contains the
identifiers a QA run is required not to keep in the clear.
"""

from __future__ import annotations

from typing import Any

_INSTALLED = False


def _model_name(instance: Any) -> str:
    mapper = getattr(type(instance), "__mapper__", None)
    entity = getattr(mapper, "class_", None) if mapper is not None else None
    return getattr(entity or type(instance), "__name__", "unknown")


def instrument_sqlalchemy(session_factory: Any = None) -> None:
    """Listen for flushes on a session class, or on every session.

    Pass the project's `sessionmaker` or `Session` class where there is one;
    with no argument the listener is attached to SQLAlchemy's global `Session`
    events, which covers applications that build sessions ad hoc.
    """
    global _INSTALLED
    if _INSTALLED:
        return
    from sqlalchemy import event
    from sqlalchemy.orm import Session

    from ..client import TELLANN

    def after_flush(session: Any, _context: Any) -> None:
        try:
            for instance in session.new:
                TELLANN.track_data_access(_model_name(instance), "insert", records=1, mutation=True)
            for instance in session.dirty:
                if session.is_modified(instance):
                    TELLANN.track_data_access(_model_name(instance), "update", records=1, mutation=True)
            for instance in session.deleted:
                TELLANN.track_data_access(_model_name(instance), "delete", records=1, mutation=True)
        except Exception:  # pragma: no cover - telemetry never breaks a flush
            pass

    event.listen(session_factory or Session, "after_flush", after_flush)
    _INSTALLED = True
