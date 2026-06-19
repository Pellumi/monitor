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
  | 'WORKFLOW_STARTED'
  | 'WORKFLOW_COMPLETED'
  | 'WORKFLOW_FAILED'
  | 'SOTS_ONBOARDING_TEST';

export interface SotsEvent {
  eventId: string;
  sessionId: string;
  tenantId: string;
  applicationId: string;
  environmentId?: string | null;
  source: string;
  eventVersion: string;
  eventType: EventType;
  timestamp: string;
  metadata: Record<string, any>;
}

export interface ApiRequestEvent extends SotsEvent {
  eventType: 'API_REQUEST';
  metadata: {
    requestId: string;
    endpoint: string;
    method: string;
    statusCode: number;
    durationMs: number;
  };
}
