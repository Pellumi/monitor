"""Turning on data-access telemetry, wherever it can be turned on.

A QA run cannot say which models a request touched unless something reports
them, and asking every project to wire that by hand means the answer is usually
"no models" - which reads as "this request changed nothing" rather than "nobody
was watching".

So the framework integrations call this, and it attaches to whichever ORM is
actually importable. Nothing here requires an ORM to be installed, and an ORM
that is installed but unused simply never fires.
"""

from __future__ import annotations

_ATTEMPTED = False


def install_data_hooks(*, django: bool = False, sqlalchemy: bool = True) -> list[str]:
    """Attach the available ORM hooks once. Returns the ones that attached.

    Never raises: telemetry that cannot be installed must not stop an
    application from starting.
    """
    global _ATTEMPTED
    if _ATTEMPTED:
        return []
    _ATTEMPTED = True
    installed: list[str] = []

    if django:
        try:
            from .django_orm import instrument_django_orm

            instrument_django_orm()
            installed.append("django")
        except Exception:  # pragma: no cover - absent, or apps not ready
            pass

    if sqlalchemy:
        try:
            # Only when the package is actually present. Importing the hook
            # module itself is cheap; it imports SQLAlchemy lazily.
            import importlib.util

            if importlib.util.find_spec("sqlalchemy") is not None:
                from .sqlalchemy_hook import instrument_sqlalchemy

                instrument_sqlalchemy()
                installed.append("sqlalchemy")
        except Exception:  # pragma: no cover
            pass

    return installed


def reset_data_hooks_for_tests() -> None:
    """Lets a test install into a fresh registry. Not part of the public API."""
    global _ATTEMPTED
    _ATTEMPTED = False
