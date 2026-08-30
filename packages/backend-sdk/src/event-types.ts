export type EventType =
  | 'PAGE_VIEW' | 'ROUTE_CHANGE' | 'BUTTON_CLICK' | 'LINK_CLICK'
  | 'FORM_SUBMIT' | 'FORM_SUBMITTED' | 'API_REQUEST'
  | 'ERROR_EVENT' | 'ERROR_OCCURRED' | 'UNHANDLED_EXCEPTION'
  | 'SERVER_ERROR' | 'CLIENT_ERROR' | 'BUSINESS_EVENT'
  | 'STATE_ENTERED' | 'STATE_TRANSITION'
  | 'FLOW_INITIAL_STATE' | 'FLOW_STATE_REACHED' | 'FLOW_TRANSITION' | 'FLOW_TERMINAL_STATE'
  | 'WORKFLOW_STARTED' | 'WORKFLOW_COMPLETED' | 'WORKFLOW_FAILED' | 'WORKFLOW_CANCELLED'
  | 'TELLANN_ONBOARDING_TEST' | 'TELLANN_INITIALIZED' | 'QA_RUN_STARTED' | 'QA_RUN_COMPLETED' | 'QA_RUN_FAILED'
  | 'BROWSER_PAGE_LOADED' | 'BROWSER_CONSOLE_ERROR' | 'BROWSER_NETWORK_FAILED'
  | 'VISUAL_ASSERTION_FAILED' | 'ACCESSIBILITY_FINDING' | 'INSTRUMENTATION_VERIFIED'
  | 'REPOSITORY_SNAPSHOT_CREATED' | 'EXPECTED_FLOW_VERSION_SELECTED';

export interface TellannEvent {
  eventId: string;
  sessionId: string;
  tenantId: string;
  applicationId: string;
  environmentId?: string | null;
  runId?: string | null;
  traceId?: string | null;
  agentVersion?: string | null;
  instrumentationManifestVersion?: string | null;
  source: string;
  eventVersion: string;
  eventType: EventType;
  timestamp: string;
  metadata: Record<string, any>;
}
