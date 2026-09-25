export type EventType =
  | 'PAGE_VIEW'
  | 'ROUTE_CHANGE'
  | 'BUTTON_CLICK'
  | 'LINK_CLICK'
  | 'FORM_SUBMIT'
  | 'FORM_SUBMITTED'
  | 'API_REQUEST'
  | 'ERROR_EVENT'
  | 'ERROR_OCCURRED'
  | 'UNHANDLED_EXCEPTION'
  | 'SERVER_ERROR'
  | 'CLIENT_ERROR'
  | 'BUSINESS_EVENT'
  | 'STATE_ENTERED'
  | 'STATE_TRANSITION'
  | 'FLOW_INITIAL_STATE'
  | 'FLOW_STATE_REACHED'
  | 'FLOW_TRANSITION'
  | 'FLOW_TERMINAL_STATE'
  | 'WORKFLOW_STARTED'
  | 'WORKFLOW_COMPLETED'
  | 'WORKFLOW_FAILED'
  | 'WORKFLOW_CANCELLED'
  | 'TELLANN_ONBOARDING_TEST'
  | 'TELLANN_INITIALIZED'
  | 'QA_RUN_STARTED'
  | 'QA_RUN_COMPLETED'
  | 'QA_RUN_FAILED'
  | 'BROWSER_PAGE_LOADED'
  | 'BROWSER_CONSOLE_ERROR'
  | 'BROWSER_NETWORK_FAILED'
  | 'VISUAL_ASSERTION_FAILED'
  | 'ACCESSIBILITY_FINDING'
  | 'INSTRUMENTATION_VERIFIED'
  | 'REPOSITORY_SNAPSHOT_CREATED'
  | 'EXPECTED_FLOW_VERSION_SELECTED';

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

export interface ApiRequestEvent extends TellannEvent {
  eventType: 'API_REQUEST';
  metadata: {
    requestId: string;
    endpoint: string;
    method: string;
    statusCode: number;
    durationMs: number;
  };
}

/**
 * Event types that represent a runtime error.
 *
 * Session statistics and the replay timeline both need to answer "did anything
 * go wrong here", and both used to answer it by matching `ERROR_EVENT` alone —
 * so a session full of `UNHANDLED_EXCEPTION`s reported zero errors. Every
 * consumer reads this set instead of its own literal.
 *
 * `WORKFLOW_FAILED` is deliberately absent: a workflow that did not complete is
 * a flow outcome, not a runtime error, and the replay viewer already colours it
 * separately. Adding it here would inflate every error count in the product.
 */
export const ERROR_EVENT_TYPES = [
  'ERROR_EVENT',
  'ERROR_OCCURRED',
  'UNHANDLED_EXCEPTION',
  'SERVER_ERROR',
  'CLIENT_ERROR',
] as const satisfies readonly EventType[];

export type ErrorEventType = (typeof ERROR_EVENT_TYPES)[number];

export const ERROR_EVENT_TYPE_SET: ReadonlySet<string> = new Set(ERROR_EVENT_TYPES);

/** True when an event type records something the application got wrong. */
export function isErrorEventType(eventType: string): boolean {
  return ERROR_EVENT_TYPE_SET.has(eventType);
}

/**
 * The human-readable message and stack an error event carries.
 *
 * The five error types do not agree on where they put it — the browser SDK
 * writes `message`, the backend SDK's captureError writes `error`, and a
 * business-event wrapper writes `title` — so reading `metadata.message` alone
 * silently rendered most errors as blank rows.
 */
export function readErrorEventDetail(
  metadata: Record<string, unknown> | null | undefined,
): { message: string; stack: string | null } {
  const bag = metadata && typeof metadata === 'object' ? metadata : {};
  const raw = bag.message ?? bag.error ?? bag.title ?? bag.reason;
  const stack = bag.stack;
  return {
    message: raw === null || raw === undefined ? 'Unknown error' : String(raw),
    stack: stack === null || stack === undefined ? null : String(stack),
  };
}
