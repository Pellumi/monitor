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
import urllib.parse
import urllib.request
import uuid
from dataclasses import dataclass
from typing import Any, Dict, Optional

from .events import MAX_EVENT_BYTES

#: `eventType` values worth relaying as QA run evidence, and what each one
#: becomes on that side of the fence. Anything else (page views, workflow
#: markers, Flow checkpoints) already has its own path into a run and does not
#: need a second one here.
_QA_EVIDENCE_EVENT_TYPES = {
    "API_REQUEST": "QA_BACKEND_REQUEST",
    "SERVER_ERROR": "QA_BACKEND_ERROR",
}

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
        #: One evidence session for this transport's lifetime, grouped the
        #: same way the desktop's own recorder groups a run's events. Only
        #: touched from the single worker thread in `_run`, so it needs no
        #: lock of its own.
        self._evidence_session_id = str(uuid.uuid4())
        self._evidence_sequence = 0

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

        self._deliver_qa_evidence(payload)

    def _is_local_relay(self) -> bool:
        # The desktop app's local relay only ever binds to loopback, so an
        # endpoint pointed anywhere else is the standing, environment-scoped
        # gateway a deployed server is configured with once and never has to
        # change per run.
        try:
            return urllib.parse.urlsplit(self.endpoint).hostname == "127.0.0.1"
        except ValueError:
            return False

    def _deliver_qa_evidence(self, payload: Dict[str, Any]) -> None:
        """A no-op unless this transport carries a standing ingestion key.

        A process pointed at the desktop's own local relay (`TELLANN_RUN_ID`
        credential, loopback endpoint) already has its backend evidence
        picked up from the `/v1/events` post above; this only matters for a
        process configured with the persistent, environment-scoped ingestion
        key instead — a deployment that is never restarted just to hand it a
        fresh per-run credential. Which run the event lands on is resolved
        server-side, against whichever run is currently recording for this
        environment.
        """
        environment_id = payload.get("environmentId")
        if not self.api_key or not environment_id or self._is_local_relay():
            return
        qa_event_type = _QA_EVIDENCE_EVENT_TYPES.get(str(payload.get("eventType")))
        if qa_event_type is None:
            metadata = payload.get("metadata") or {}
            if metadata.get("businessEventType") != "QA_BACKEND_DATA_ACCESS":
                return
            qa_event_type = "QA_BACKEND_DATA_ACCESS"
        self._evidence_sequence += 1
        event: Dict[str, Any] = {
            "schemaVersion": "2.0",
            "eventId": str(uuid.uuid4()),
            "sessionId": self._evidence_session_id,
            "traceId": payload.get("traceId"),
            "applicationId": payload.get("applicationId"),
            "environmentId": environment_id,
            "localSequence": self._evidence_sequence,
            "timestamp": payload.get("timestamp"),
            "eventType": qa_event_type,
            "source": "BACKEND_SDK",
            "scope": "PRE_BOUNDARY",
            "metadata": payload.get("metadata") or {},
            "protectedValues": [],
        }
        if payload.get("runId"):
            event["runId"] = payload["runId"]
        body = json.dumps({"events": [event]}).encode("utf-8")
        request = urllib.request.Request(
            f"{self.endpoint}/environments/{environment_id}/qa-evidence/batch",
            data=body,
            headers={"Content-Type": "application/json", "Authorization": f"Bearer {self.api_key}"},
            method="POST",
        )
        try:
            opener = self._opener or urllib.request.urlopen
            with opener(request, timeout=self.timeout):
                pass
        except (urllib.error.URLError, OSError, ValueError) as error:
            logger.debug("Tellann QA evidence delivery failed: %s", error)

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
