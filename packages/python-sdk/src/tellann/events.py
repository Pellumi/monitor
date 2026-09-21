"""Event vocabulary shared with the JavaScript SDKs.

The names and the envelope are copied from `@tellann/backend-sdk`'s
`event-types.ts` deliberately: the collector, the session engine and the flow
boundary all key off `eventType` and `source`, so a Python service that spelled
them differently would ingest as telemetry nobody queries.
"""

from __future__ import annotations

import time
import uuid
from dataclasses import dataclass, field
from typing import Any, Dict, Optional

EVENT_VERSION = "1.0"

#: Where the event came from. The onboarding readiness check groups this with
#: the other backend sources, which is what marks a backend target connected.
SOURCE = "python-sdk"

EVENT_TYPES = frozenset(
    {
        "PAGE_VIEW",
        "ROUTE_CHANGE",
        "BUTTON_CLICK",
        "LINK_CLICK",
        "FORM_SUBMIT",
        "FORM_SUBMITTED",
        "API_REQUEST",
        "ERROR_EVENT",
        "ERROR_OCCURRED",
        "UNHANDLED_EXCEPTION",
        "SERVER_ERROR",
        "CLIENT_ERROR",
        "BUSINESS_EVENT",
        "STATE_ENTERED",
        "STATE_TRANSITION",
        "FLOW_INITIAL_STATE",
        "FLOW_STATE_REACHED",
        "FLOW_TRANSITION",
        "FLOW_TERMINAL_STATE",
        "WORKFLOW_STARTED",
        "WORKFLOW_COMPLETED",
        "WORKFLOW_FAILED",
        "WORKFLOW_CANCELLED",
        "TELLANN_ONBOARDING_TEST",
        "TELLANN_INITIALIZED",
        "QA_RUN_STARTED",
        "QA_RUN_COMPLETED",
        "QA_RUN_FAILED",
        "BROWSER_PAGE_LOADED",
        "BROWSER_CONSOLE_ERROR",
        "BROWSER_NETWORK_FAILED",
        "VISUAL_ASSERTION_FAILED",
        "ACCESSIBILITY_FINDING",
        "INSTRUMENTATION_VERIFIED",
        "REPOSITORY_SNAPSHOT_CREATED",
        "EXPECTED_FLOW_VERSION_SELECTED",
    }
)

#: The collector rejects anything larger, so an oversized event is dropped here
#: with a warning rather than sent and silently discarded on the other side.
MAX_EVENT_BYTES = 32 * 1024


def _timestamp() -> str:
    """An ISO-8601 timestamp in UTC, matching `new Date().toISOString()`."""
    return time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime()) + f".{int(time.time() * 1000) % 1000:03d}Z"


@dataclass
class TellannEvent:
    """One telemetry event, shaped exactly like the JavaScript envelope."""

    event_type: str
    application_id: str
    session_id: str
    tenant_id: str = "unknown"
    environment_id: Optional[str] = None
    run_id: Optional[str] = None
    trace_id: Optional[str] = None
    agent_version: Optional[str] = None
    instrumentation_manifest_version: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    event_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    timestamp: str = field(default_factory=_timestamp)
    source: str = SOURCE

    def to_payload(self) -> Dict[str, Any]:
        """The camelCase JSON body the collector accepts."""
        return {
            "eventId": self.event_id,
            "sessionId": self.session_id,
            "tenantId": self.tenant_id,
            "applicationId": self.application_id,
            "environmentId": self.environment_id,
            "runId": self.run_id,
            "traceId": self.trace_id,
            "agentVersion": self.agent_version,
            "instrumentationManifestVersion": self.instrumentation_manifest_version,
            "source": self.source,
            "eventVersion": EVENT_VERSION,
            "eventType": self.event_type,
            "timestamp": self.timestamp,
            "metadata": self.metadata,
        }
