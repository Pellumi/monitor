"""Tellann SDK for Python.

The public surface mirrors `@tellann/backend-sdk`, so the same concepts appear
under the same names in both languages::

    from tellann import TELLANN

    TELLANN.initialize(
        endpoint="https://gateway.example.com",
        application_id="...",
        environment_id="...",
    )
    TELLANN.verify_installation()

Framework integrations are imported on demand, so installing this package never
requires a framework the project does not use.
"""

from __future__ import annotations

from .capture import sanitize_headers, sanitize_payload
from .client import TELLANN, TellannBackend
from .events import EVENT_TYPES, MAX_EVENT_BYTES, SOURCE, TellannEvent
from .request_context import (
    current_request_context,
    enter_request_context,
    exit_request_context,
    new_request_context,
    record_data_access,
)
from .transport import EventTransport

__version__ = "0.2.0"

__all__ = [
    "EVENT_TYPES",
    "EventTransport",
    "MAX_EVENT_BYTES",
    "SOURCE",
    "TELLANN",
    "TellannBackend",
    "TellannEvent",
    "__version__",
    "capture_error",
    "checkpoint",
    "current_request_context",
    "enter_request_context",
    "exit_request_context",
    "flush_data_access",
    "instrument_django",
    "instrument_django_orm",
    "instrument_fastapi",
    "instrument_flask",
    "instrument_sqlalchemy",
    "instrument_starlette",
    "new_request_context",
    "record_data_access",
    "sanitize_headers",
    "sanitize_payload",
    "track_api",
    "track_data_access",
    "track_event",
    "track_state",
]


def track_api(*args, **kwargs) -> None:
    """Module-level helper, matching the JavaScript SDK's loose functions."""
    TELLANN.track_api(*args, **kwargs)


def track_event(*args, **kwargs) -> None:
    TELLANN.track_event(*args, **kwargs)


def track_state(*args, **kwargs) -> None:
    TELLANN.track_state(*args, **kwargs)


def track_data_access(*args, **kwargs) -> None:
    TELLANN.track_data_access(*args, **kwargs)


def flush_data_access(*args, **kwargs) -> None:
    TELLANN.flush_data_access(*args, **kwargs)


def capture_error(*args, **kwargs) -> None:
    TELLANN.capture_error(*args, **kwargs)


def checkpoint(*args, **kwargs) -> None:
    TELLANN.checkpoint(*args, **kwargs)


def __getattr__(name: str):
    if name.startswith("instrument_"):
        from . import integrations

        return getattr(integrations, name)
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
