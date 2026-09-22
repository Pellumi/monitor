"""Django ORM telemetry.

Reports which models a request wrote, using Django's own signals. Signals are
used rather than a database-cursor wrapper because they name the model, which
is what a QA run shows, and because they cannot change how a query executes.

Reads are not reported from here. Django emits no signal for a read, and the
only way to catch one is to wrap the cursor and parse SQL, which would put
table names and literal values from every query into telemetry. A read that
matters to a run is reported explicitly with `TELLANN.track_data_access`.
"""

from __future__ import annotations

from typing import Any

_INSTALLED = False


def _model_name(sender: Any) -> str:
    meta = getattr(sender, "_meta", None)
    label = getattr(meta, "label", None)
    if isinstance(label, str) and label:
        return label
    return getattr(sender, "__name__", "unknown")


def instrument_django_orm() -> None:
    """Connect the post-save and post-delete signals. Idempotent."""
    global _INSTALLED
    if _INSTALLED:
        return
    from django.db.models.signals import post_delete, post_save

    from ..client import TELLANN

    def on_save(sender: Any, instance: Any = None, created: bool = False, **_: Any) -> None:
        try:
            TELLANN.track_data_access(
                _model_name(sender),
                "create" if created else "update",
                records=1,
                mutation=True,
            )
        except Exception:  # pragma: no cover - telemetry never breaks a save
            pass

    def on_delete(sender: Any, **_: Any) -> None:
        try:
            TELLANN.track_data_access(_model_name(sender), "delete", records=1, mutation=True)
        except Exception:  # pragma: no cover
            pass

    post_save.connect(on_save, dispatch_uid="tellann_post_save", weak=False)
    post_delete.connect(on_delete, dispatch_uid="tellann_post_delete", weak=False)
    _INSTALLED = True
