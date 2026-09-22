"""Framework integrations.

Each one is imported lazily by name rather than re-exported here, because
importing this package must not require every framework to be installed: a
FastAPI service has no Django to import.
"""

from __future__ import annotations

__all__ = [
    "install_data_hooks",
    "instrument_django",
    "instrument_django_orm",
    "instrument_fastapi",
    "instrument_flask",
    "instrument_sqlalchemy",
    "instrument_starlette",
]


def __getattr__(name: str):
    if name == "install_data_hooks":
        from .data_hooks import install_data_hooks

        return install_data_hooks
    if name == "instrument_django":
        from .django_middleware import instrument_django

        return instrument_django
    if name == "instrument_django_orm":
        from .django_orm import instrument_django_orm

        return instrument_django_orm
    if name == "instrument_flask":
        from .flask_extension import instrument_flask

        return instrument_flask
    if name == "instrument_sqlalchemy":
        from .sqlalchemy_hook import instrument_sqlalchemy

        return instrument_sqlalchemy
    if name in {"instrument_fastapi", "instrument_starlette"}:
        from .asgi_middleware import instrument_fastapi, instrument_starlette

        return instrument_fastapi if name == "instrument_fastapi" else instrument_starlette
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
