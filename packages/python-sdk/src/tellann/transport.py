"""Delivery of events to the Tellann collector.

Instrumentation must never be the reason a request is slow or a process dies,
so delivery runs on a daemon worker thread behind a bounded queue: a collector
that is down, slow or unreachable costs the application nothing but a dropped
event, and every failure is swallowed after being counted.

The transport is stdlib-only (`urllib.request`). Requiring `requests` would add
a dependency to every instrumented project, and would make the SDK unusable in
the environments that pin their own conflicting version of it.
"""

from __future__ import annotations

import atexit
import json
import logging
import queue
import threading
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Any, Dict, Optional

from .events import MAX_EVENT_BYTES

logger = logging.getLogger("tellann")

#: Bounded, so a collector outage costs a fixed amount of memory rather than
#: growing until the process is killed.
DEFAULT_QUEUE_SIZE = 1_000
DEFAULT_TIMEOUT_SECONDS = 5.0


@dataclass
class DeliveryStats:
    """What the transport has done, for diagnostics and tests."""

    sent: int = 0
    dropped_oversized: int = 0
    dropped_full: int = 0
    failed: int = 0


class EventTransport:
    """A background sender for one configured endpoint."""

    def __init__(
        self,
        endpoint: str,
        api_key: Optional[str] = None,
        *,
        timeout: float = DEFAULT_TIMEOUT_SECONDS,
        queue_size: int = DEFAULT_QUEUE_SIZE,
        opener: Optional[Any] = None,
    ) -> None:
        self.endpoint = endpoint.rstrip("/")
        self.api_key = api_key
        self.timeout = timeout
        self.stats = DeliveryStats()
        self._queue: "queue.Queue[Optional[Dict[str, Any]]]" = queue.Queue(maxsize=queue_size)
        self._opener = opener
        self._lock = threading.Lock()
        self._worker: Optional[threading.Thread] = None
        self._closed = False

    def _ensure_worker(self) -> None:
        # Started lazily, and never in a module import: a thread spawned at
        # import time is inherited across a `fork()` in a Gunicorn worker and
        # then never runs, which loses every event the worker produces.
        if self._worker is not None and self._worker.is_alive():
            return
        with self._lock:
            if self._worker is not None and self._worker.is_alive():
                return
            worker = threading.Thread(target=self._run, name="tellann-transport", daemon=True)
            self._worker = worker
            worker.start()
            atexit.register(self.flush)

    def _run(self) -> None:
        while True:
            item = self._queue.get()
            try:
                if item is None:
                    return
                self._deliver(item)
            except Exception:  # pragma: no cover - the worker must never die
                self.stats.failed += 1
            finally:
                self._queue.task_done()

    def _deliver(self, payload: Dict[str, Any]) -> None:
        body = json.dumps(payload).encode("utf-8")
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        environment_id = payload.get("environmentId")
        if environment_id:
            headers["x-tellann-environment-id"] = str(environment_id)
        if payload.get("runId"):
            headers["x-tellann-run-id"] = str(payload["runId"])
        if payload.get("sessionId"):
            headers["x-tellann-session-id"] = str(payload["sessionId"])
        if payload.get("traceId"):
            headers["x-tellann-trace-id"] = str(payload["traceId"])

        request = urllib.request.Request(
            f"{self.endpoint}/v1/events", data=body, headers=headers, method="POST"
        )
        try:
            opener = self._opener or urllib.request.urlopen
            with opener(request, timeout=self.timeout):
                self.stats.sent += 1
        except (urllib.error.URLError, OSError, ValueError) as error:
            self.stats.failed += 1
            logger.debug("Tellann event delivery failed: %s", error)

    def send(self, payload: Dict[str, Any]) -> None:
        """Queue an event. Never blocks, never raises."""
        if self._closed:
            return
        try:
            encoded = json.dumps(payload)
        except (TypeError, ValueError):
            # Metadata the application put in that cannot be serialized; the
            # event is unusable, and raising here would break that request.
            self.stats.dropped_oversized += 1
            logger.debug("Tellann event discarded: metadata is not JSON-serializable")
            return
        if len(encoded.encode("utf-8")) > MAX_EVENT_BYTES:
            self.stats.dropped_oversized += 1
            logger.warning(
                "Tellann event of type %s discarded: larger than the %d byte limit",
                payload.get("eventType"),
                MAX_EVENT_BYTES,
            )
            return
        self._ensure_worker()
        try:
            self._queue.put_nowait(payload)
        except queue.Full:
            self.stats.dropped_full += 1
            logger.debug("Tellann event dropped: delivery queue is full")

    def flush(self, timeout: Optional[float] = None) -> None:
        """Wait for queued events to be delivered. Safe to call repeatedly."""
        if self._worker is None:
            return
        if timeout is None:
            self._queue.join()
            return
        deadline = threading.Event()
        waiter = threading.Thread(target=lambda: (self._queue.join(), deadline.set()), daemon=True)
        waiter.start()
        deadline.wait(timeout)

    def close(self, timeout: Optional[float] = 2.0) -> None:
        """Stop the worker after draining what is already queued."""
        if self._closed:
            return
        self._closed = True
        if self._worker is None:
            return
        self.flush(timeout)
        try:
            self._queue.put_nowait(None)
        except queue.Full:  # pragma: no cover - a full queue drains on its own
            pass
        self._worker.join(timeout or 0)
        self._worker = None
