"""Framework integrations.

Each one is imported lazily by name rather than re-exported here, because
importing this package must not require every framework to be installed: a
FastAPI service has no Django to import.
"""

from __future__ import annotations

__all__ = [
    "instrument_django",
    "instrument_fastapi",
    "instrument_flask",
    "instrument_starlette",
]


def __getattr__(name: str):
    if name == "instrument_django":
        from .django_middleware import instrument_django

        return instrument_django
    if name == "instrument_flask":
        from .flask_extension import instrument_flask

        return instrument_flask
    if name in {"instrument_fastapi", "instrument_starlette"}:
        from .asgi_middleware import instrument_fastapi, instrument_starlette

        return instrument_fastapi if name == "instrument_fastapi" else instrument_starlette
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
