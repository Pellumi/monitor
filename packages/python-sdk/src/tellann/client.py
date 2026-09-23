"""The `TELLANN` singleton, mirroring `@tellann/backend-sdk`.

Method names are snake_case because this is Python, but every one of them has a
camelCase counterpart in the JavaScript SDK and produces an identical event. A
Flow instrumented across a React page and a Django view therefore reaches the
collector as one sequence, not two dialects of one.
"""

from __future__ import annotations

import contextlib
import os
import re
import threading
import time
import traceback
import uuid
from typing import Any, Dict, Iterator, Optional

from .capture import (
    payload_bytes,
    resolve_capture_config,
    sanitize_headers,
    sanitize_payload,
)
from .events import EVENT_TYPES, SOURCE, TellannEvent
from .request_context import (
    current_request_context,
    record_data_access,
    summarize_data_access,
)
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

#: Operation names that change data. Used when a caller does not say.
MUTATION_PATTERN = re.compile(
    r"create|update|delete|upsert|insert|write|save|remove|drop|truncate", re.IGNORECASE
)


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
        capture: Optional[Dict[str, Any]] = None,
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
            # What a captured request may carry. Bodies and headers are on by
            # default so a QA run can show what was actually sent;
            # credential-shaped fields are dropped regardless, before anything
            # leaves this process.
            "capture": resolve_capture_config(capture),
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
        endpoint: Optional[str] = None,
        query: Optional[Dict[str, Any]] = None,
        request_body: Any = None,
        response_body: Any = None,
        request_headers: Optional[Dict[str, Any]] = None,
        response_headers: Optional[Dict[str, Any]] = None,
        handler: Optional[str] = None,
        framework: Optional[str] = None,
        request_id: Optional[str] = None,
        models: Optional[list] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> None:
        """Report one handled request.

        `route` is the template the framework matched (`/invoices/<int:pk>`)
        and `endpoint` the concrete path. Keeping both is what lets a run group
        a thousand calls under one row while still showing what was called.
        """
        capture = (self._config or {}).get("capture") or resolve_capture_config(None)
        context = current_request_context()
        payload: Dict[str, Any] = {
            "method": str(method).upper(),
            "route": route,
            "endpoint": endpoint or route,
            "requestId": request_id or str(uuid.uuid4()),
            "handler": handler,
            "framework": framework,
            "requestBytes": payload_bytes(request_body),
            "responseBytes": payload_bytes(response_body),
            "models": models if models is not None else summarize_data_access(
                (context or {}).get("data_access", [])
            ),
        }
        if status_code is not None:
            payload["statusCode"] = int(status_code)
        if duration_ms is not None:
            payload["durationMs"] = round(float(duration_ms), 3)
        sanitized_query = sanitize_payload(query, capture)
        if sanitized_query is not None:
            payload["query"] = sanitized_query
        if capture.get("request_body", True):
            sanitized_request = sanitize_payload(request_body, capture)
            if sanitized_request is not None:
                payload["requestBody"] = sanitized_request
        if capture.get("response_body", True):
            sanitized_response = sanitize_payload(response_body, capture)
            if sanitized_response is not None:
                payload["responseBody"] = sanitized_response
        safe_request_headers = sanitize_headers(request_headers, capture)
        if safe_request_headers:
            payload["requestHeaders"] = safe_request_headers
        safe_response_headers = sanitize_headers(response_headers, capture)
        if safe_response_headers:
            payload["responseHeaders"] = safe_response_headers
        payload.update(metadata or {})
        self.track_event("API_REQUEST", payload, session_id or (context or {}).get("session_id"))

    def track_data_access(
        self,
        model: str,
        operation: str,
        *,
        records: Optional[int] = None,
        duration_ms: Optional[float] = None,
        mutation: Optional[bool] = None,
        session_id: Optional[str] = None,
    ) -> None:
        """Report one persistence operation.

        Inside a request it is recorded and nothing is sent: the framework
        middleware flushes one event per model and operation once the response
        is done, so a handler that reads a model in a loop produces one row
        rather than a thousand. Outside a request - a migration, a management
        command, a queue consumer - there is nothing to flush it later, so it
        is sent immediately.
        """
        resolved_mutation = (
            mutation
            if mutation is not None
            else bool(MUTATION_PATTERN.search(str(operation)))
        )
        recorded = record_data_access(
            str(model),
            str(operation),
            records=records,
            duration_ms=duration_ms,
            mutation=resolved_mutation,
        )
        if recorded is not None:
            return
        self._send_data_access(
            model=model,
            operation=operation,
            records=records,
            duration_ms=duration_ms,
            mutation=resolved_mutation,
            count=1,
            context=current_request_context(),
            session_id=session_id,
        )

    def flush_data_access(self, context: Optional[Dict[str, Any]] = None) -> None:
        """Send what a finished request touched, one event per model and operation.

        The framework integrations call this; applications rarely need to. Safe
        to call twice: the context is emptied as it is flushed.
        """
        resolved = context if context is not None else current_request_context()
        entries = (resolved or {}).get("data_access") or []
        if not entries:
            return
        summary = summarize_data_access(entries)
        resolved["data_access"] = []
        for entry in summary:
            self._send_data_access(
                model=entry["model"],
                operation=entry["operation"],
                records=entry.get("records"),
                duration_ms=None,
                mutation=bool(entry.get("mutation")),
                count=int(entry.get("count", 1)),
                context=resolved,
            )

    def _send_data_access(
        self,
        *,
        model: Any,
        operation: Any,
        records: Optional[int],
        duration_ms: Optional[float],
        mutation: bool,
        count: int,
        context: Optional[Dict[str, Any]],
        session_id: Optional[str] = None,
    ) -> None:
        self.track_event(
            "BUSINESS_EVENT",
            {
                # The desktop routes on this discriminator, the same way it
                # routes client-state evidence from the frontend adapters.
                "businessEventType": "QA_BACKEND_DATA_ACCESS",
                "model": str(model)[:120],
                "operation": str(operation)[:60],
                "records": records,
                "durationMs": round(float(duration_ms), 3) if duration_ms is not None else None,
                "mutation": mutation,
                # How many individual operations this row stands for.
                "count": count,
                "route": (context or {}).get("route"),
                "method": (context or {}).get("method"),
            },
            session_id or (context or {}).get("session_id"),
        )

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
