"""The `TELLANN` singleton, mirroring `@tellann/backend-sdk`.

Method names are snake_case because this is Python, but every one of them has a
camelCase counterpart in the JavaScript SDK and produces an identical event. A
Flow instrumented across a React page and a Django view therefore reaches the
collector as one sequence, not two dialects of one.
"""

from __future__ import annotations

import contextlib
import os
import threading
import time
import traceback
import uuid
from typing import Any, Dict, Iterator, Optional

from .events import EVENT_TYPES, SOURCE, TellannEvent
from .transport import EventTransport

#: Environment variables read when `initialize` is called without arguments.
#: The names match what the desktop instrumenter writes into `.env.local`.
#: Nothing here loads that file - Python has no bundler to do it - so the
#: generated `tellann_instrumentation` module reads it into `os.environ` before
#: calling `initialize`, and a process started by a deployment supplies the
#: variables itself.
ENV_ENDPOINT = "TELLANN_GATEWAY_URL"
ENV_API_KEY = "TELLANN_INGESTION_KEY"
ENV_APPLICATION_ID = "TELLANN_APPLICATION_ID"
ENV_ENVIRONMENT_ID = "TELLANN_ENVIRONMENT_ID"


class TellannBackend:
    """Configuration, session identity and event construction."""

    def __init__(self) -> None:
        self._transport: Optional[EventTransport] = None
        self._config: Optional[Dict[str, Any]] = None
        self._workflows: Dict[str, Dict[str, Any]] = {}
        self._lock = threading.Lock()

    # ── lifecycle ─────────────────────────────────────────────────────────────

    def initialize(
        self,
        endpoint: Optional[str] = None,
        *,
        application_id: Optional[str] = None,
        api_key: Optional[str] = None,
        environment_id: Optional[str] = None,
        tenant_id: Optional[str] = None,
        session_id: Optional[str] = None,
        run_id: Optional[str] = None,
        trace_id: Optional[str] = None,
        agent_version: Optional[str] = None,
        instrumentation_manifest_version: Optional[str] = None,
        transport: Optional[EventTransport] = None,
    ) -> "TellannBackend":
        """Configure the SDK.

        Every argument falls back to its environment variable, so a generated
        module can call `initialize()` with no arguments and still work in an
        environment where the values are supplied by deployment rather than by
        the checked-in source.
        """
        resolved_endpoint = endpoint or os.environ.get(ENV_ENDPOINT)
        resolved_application = application_id or os.environ.get(ENV_APPLICATION_ID)
        if not resolved_endpoint or not resolved_application:
            # Misconfiguration disables the SDK rather than raising: telemetry
            # that is not set up must not stop an application from booting.
            self._config = None
            return self

        self._config = {
            "endpoint": resolved_endpoint.rstrip("/"),
            "application_id": resolved_application,
            "environment_id": environment_id or os.environ.get(ENV_ENVIRONMENT_ID),
            "tenant_id": tenant_id or "unknown",
            "session_id": session_id or str(uuid.uuid4()),
            "run_id": run_id or os.environ.get("TELLANN_RUN_ID"),
            "trace_id": trace_id or os.environ.get("TELLANN_TRACE_ID"),
            "agent_version": agent_version,
            "instrumentation_manifest_version": instrumentation_manifest_version,
        }
        self._transport = transport or EventTransport(
            self._config["endpoint"], api_key or os.environ.get(ENV_API_KEY)
        )
        return self

    def is_initialized(self) -> bool:
        return self._config is not None

    def get_config(self) -> Optional[Dict[str, Any]]:
        return dict(self._config) if self._config else None

    def teardown(self) -> None:
        """Release the worker thread. Used by tests and by worker shutdown."""
        if self._transport is not None:
            self._transport.close()
        self._transport = None
        self._config = None
        self._workflows.clear()

    def flush(self, timeout: Optional[float] = None) -> None:
        if self._transport is not None:
            self._transport.flush(timeout)

    # ── event construction ────────────────────────────────────────────────────

    def track_event(
        self,
        event_type: str,
        metadata: Optional[Dict[str, Any]] = None,
        session_id: Optional[str] = None,
    ) -> None:
        """Send one event. Unknown event types are sent as given.

        The collector owns the authoritative list, and refusing to send a type
        this SDK version has not heard of would make every new event type a
        blocking SDK upgrade.
        """
        if self._config is None or self._transport is None:
            return
        event = TellannEvent(
            event_type=event_type,
            application_id=self._config["application_id"],
            session_id=session_id or self._config["session_id"],
            tenant_id=self._config["tenant_id"],
            environment_id=self._config["environment_id"],
            run_id=self._config["run_id"],
            trace_id=self._config["trace_id"],
            agent_version=self._config["agent_version"],
            instrumentation_manifest_version=self._config["instrumentation_manifest_version"],
            metadata=metadata or {},
            source=SOURCE,
        )
        self._transport.send(event.to_payload())

    def verify_installation(self, session_id: Optional[str] = None) -> None:
        """Prove the SDK is wired up, which is what marks the target connected."""
        self.track_event(
            "TELLANN_INITIALIZED",
            {"source": "manual_verification", "verificationKind": "BOOTSTRAP_INITIALIZED"},
            session_id,
        )

    # ── the four primitives the JavaScript SDK exposes ────────────────────────

    def track_api(
        self,
        method: str,
        route: str,
        status_code: Optional[int] = None,
        duration_ms: Optional[float] = None,
        *,
        session_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> None:
        payload: Dict[str, Any] = {"method": str(method).upper(), "route": route}
        if status_code is not None:
            payload["statusCode"] = int(status_code)
        if duration_ms is not None:
            payload["durationMs"] = round(float(duration_ms), 3)
        payload.update(metadata or {})
        self.track_event("API_REQUEST", payload, session_id)

    def capture_error(
        self,
        error: BaseException | str,
        *,
        session_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> None:
        if isinstance(error, BaseException):
            payload: Dict[str, Any] = {
                "message": str(error),
                "type": type(error).__name__,
                # Bounded: a deep stack in a hot error path would otherwise
                # push the event past the collector's size limit.
                "stack": "".join(traceback.format_exception(error))[:4_000],
            }
        else:
            payload = {"message": str(error), "type": "Error"}
        payload.update(metadata or {})
        self.track_event("SERVER_ERROR", payload, session_id)

    def capture_message(
        self,
        message: str,
        severity: str = "error",
        session_id: Optional[str] = None,
    ) -> None:
        self.track_event("SERVER_ERROR", {"message": message, "severity": severity}, session_id)

    def track_state(
        self,
        state: str,
        *,
        previous_state: Optional[str] = None,
        session_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> None:
        payload: Dict[str, Any] = {"state": state}
        if previous_state:
            payload["previousState"] = previous_state
        payload.update(metadata or {})
        self.track_event(
            "STATE_TRANSITION" if previous_state else "STATE_ENTERED", payload, session_id
        )

    # ── workflows ─────────────────────────────────────────────────────────────

    def start_workflow(self, workflow_name: str, session_id: Optional[str] = None) -> str:
        workflow_id = str(uuid.uuid4())
        with self._lock:
            self._workflows[workflow_id] = {"name": workflow_name, "started": time.monotonic()}
        self.track_event(
            "WORKFLOW_STARTED", {"workflowId": workflow_id, "workflowName": workflow_name}, session_id
        )
        return workflow_id

    def _finish_workflow(self, workflow_id: str) -> Optional[Dict[str, Any]]:
        with self._lock:
            record = self._workflows.pop(workflow_id, None)
        if record is None:
            return None
        return {
            "workflowName": record["name"],
            "durationMs": round((time.monotonic() - record["started"]) * 1000, 3),
        }

    def complete_workflow(self, workflow_id: str, session_id: Optional[str] = None) -> None:
        result = self._finish_workflow(workflow_id)
        if result:
            self.track_event("WORKFLOW_COMPLETED", {"workflowId": workflow_id, **result}, session_id)

    def fail_workflow(
        self, workflow_id: str, reason: Optional[str] = None, session_id: Optional[str] = None
    ) -> None:
        result = self._finish_workflow(workflow_id)
        if result:
            self.track_event(
                "WORKFLOW_FAILED",
                {"workflowId": workflow_id, "reason": reason or "Unknown error", **result},
                session_id,
            )

    def cancel_workflow(
        self, workflow_id: str, reason: Optional[str] = None, session_id: Optional[str] = None
    ) -> None:
        result = self._finish_workflow(workflow_id)
        if result:
            self.track_event(
                "WORKFLOW_CANCELLED",
                {"workflowId": workflow_id, "reason": reason or "Cancelled", **result},
                session_id,
            )

    def abandon_workflow(self, workflow_id: str) -> None:
        with self._lock:
            self._workflows.pop(workflow_id, None)

    @contextlib.contextmanager
    def workflow(self, workflow_name: str, session_id: Optional[str] = None) -> Iterator[str]:
        """Run a block as a workflow, failing it if the block raises."""
        workflow_id = self.start_workflow(workflow_name, session_id)
        try:
            yield workflow_id
        except BaseException as error:
            self.fail_workflow(workflow_id, str(error), session_id)
            raise
        else:
            self.complete_workflow(workflow_id, session_id)

    # ── Flow checkpoints ──────────────────────────────────────────────────────

    def checkpoint(
        self,
        checkpoint_id: str,
        *,
        event_type: str = "FLOW_STATE_REACHED",
        state_id: Optional[str] = None,
        transition_id: Optional[str] = None,
        terminal_kind: Optional[str] = None,
        flow_initialization_id: Optional[str] = None,
        session_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> None:
        """Mark a declared Flow checkpoint.

        This is what the instrumenter inserts into application code, so its
        signature is a contract: changing it breaks every file already patched.
        """
        payload: Dict[str, Any] = {"checkpointId": checkpoint_id}
        if state_id:
            payload["stateId"] = state_id
        if transition_id:
            payload["transitionId"] = transition_id
        if terminal_kind:
            payload["terminalKind"] = terminal_kind
        if flow_initialization_id:
            payload["flowInitializationId"] = flow_initialization_id
        payload.update(metadata or {})
        self.track_event(
            event_type if event_type in EVENT_TYPES else "FLOW_STATE_REACHED", payload, session_id
        )


#: The module-level singleton, matching the JavaScript SDK's `TELLANN` export.
TELLANN = TellannBackend()
