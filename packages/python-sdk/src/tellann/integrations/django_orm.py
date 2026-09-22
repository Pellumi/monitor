"""Django ORM telemetry.

Writes come from Django's own signals, which name the model class and cannot
change how a query executes.

Reads have no signal, so they come from the statement instead - but only from
its shape. The verb and the table name are taken from the front of the SQL and
nothing else is read: no `WHERE` clause, no parameters, no literals. That is
the whole difference between "this request read Order" and putting the
identifiers a QA run is required to protect into telemetry.

Reads are recorded against the in-flight request and flushed as one row per
table when it finishes, so a view with a query in a loop reports once.
"""

from __future__ import annotations

import re
from typing import Any

_INSTALLED = False

#: The leading verb and the first table it names. Anchored at the start, so a
#: table name appearing later in a subquery or a literal cannot match.
_SELECT_TABLE = re.compile(r'^\s*SELECT\b.*?\bFROM\s+[`"\[]?([A-Za-z_][\w$.]*)', re.IGNORECASE | re.DOTALL)

#: Statements that are already covered by the write signals, or that say
#: nothing about the application's models.
_IGNORED_PREFIX = re.compile(
    r'^\s*(INSERT|UPDATE|DELETE|BEGIN|COMMIT|ROLLBACK|SAVEPOINT|RELEASE|SET|PRAGMA|SHOW|EXPLAIN)\b',
    re.IGNORECASE,
)

#: Django's own bookkeeping tables, which are not the application's models.
_INTERNAL_TABLES = frozenset({
    "django_migrations", "django_session", "django_content_type", "django_admin_log",
})


def table_read_by(sql: str) -> str | None:
    """The table a SELECT reads, or None when the statement is not one.

    Exposed for its own test: this is the only place a statement is inspected,
    and what it may and may not take out of one is worth pinning down.
    """
    if not sql or _IGNORED_PREFIX.match(sql):
        return None
    match = _SELECT_TABLE.match(sql)
    if not match:
        return None
    table = match.group(1).strip('`"[]')
    if not table or table.lower() in _INTERNAL_TABLES:
        return None
    return table


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


def read_wrapper(execute: Any, sql: Any, params: Any, many: Any, context: Any) -> Any:
    """A Django execute wrapper that records reads and changes nothing.

    Recording happens after the statement runs, so a failure in telemetry can
    never affect the query, and a failing query is not recorded as a read.
    """
    result = execute(sql, params, many, context)
    try:
        from ..request_context import record_data_access

        table = table_read_by(str(sql))
        if table is not None:
            # Recorded only: the middleware flushes one row per table when the
            # request finishes, so a query in a loop does not become a flood.
            record_data_access(table, "select", mutation=False)
    except Exception:  # pragma: no cover - telemetry never breaks a query
        pass
    return result
