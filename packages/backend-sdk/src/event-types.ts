export type EventType =
  | 'PAGE_VIEW' | 'ROUTE_CHANGE' | 'BUTTON_CLICK' | 'LINK_CLICK'
  | 'FORM_SUBMIT' | 'FORM_SUBMITTED' | 'API_REQUEST'
  | 'ERROR_EVENT' | 'ERROR_OCCURRED' | 'UNHANDLED_EXCEPTION'
  | 'SERVER_ERROR' | 'CLIENT_ERROR' | 'BUSINESS_EVENT'
  | 'STATE_ENTERED' | 'STATE_TRANSITION'
  | 'FLOW_INITIAL_STATE' | 'FLOW_STATE_REACHED' | 'FLOW_TRANSITION' | 'FLOW_TERMINAL_STATE'
  | 'WORKFLOW_STARTED' | 'WORKFLOW_COMPLETED' | 'WORKFLOW_FAILED' | 'WORKFLOW_CANCELLED'
  | 'SESSION_STARTED' | 'SESSION_ENDED' | 'USER_IDENTIFIED'
  | 'TELLANN_ONBOARDING_TEST' | 'TELLANN_INITIALIZED' | 'QA_RUN_STARTED' | 'QA_RUN_COMPLETED' | 'QA_RUN_FAILED'
  | 'BROWSER_PAGE_LOADED' | 'BROWSER_CONSOLE_ERROR' | 'BROWSER_NETWORK_FAILED'
  | 'VISUAL_ASSERTION_FAILED' | 'ACCESSIBILITY_FINDING' | 'INSTRUMENTATION_VERIFIED'
  | 'REPOSITORY_SNAPSHOT_CREATED' | 'EXPECTED_FLOW_VERSION_SELECTED';

/**
 * What the page is, rather than what happened on it. Captured once per session and
 * attached to every event; stored once, on the session row, never per event.
 */
export interface ClientContext {
  deviceType?: 'desktop' | 'mobile' | 'tablet' | 'bot' | 'unknown';
  browserName?: string;
  browserVersion?: string;
  osName?: string;
  osVersion?: string;
  viewportWidth?: number;
  viewportHeight?: number;
  locale?: string;
  timezone?: string;
  releaseVersion?: string;
}

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

  // ── Envelope 1.1 ───────────────────────────────────────────────────────
  /** Stable per-browser id, from localStorage. */
  anonymousId?: string | null;
  /** The customer's own user id, as asserted by identify(). A proposal: the server
   *  applies the application's privacy floor before storing anything. */
  endUserExternalId?: string | null;
  endUserTraits?: Record<string, any> | null;
  context?: ClientContext | null;
  /** Sampling is decided per session, never per event. */
  sampled?: boolean;
  sampleRate?: number;
}
