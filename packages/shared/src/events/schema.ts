import { z } from 'zod';

export const EventTypeSchema = z.enum([
  'PAGE_VIEW',
  'ROUTE_CHANGE',
  'BUTTON_CLICK',
  'LINK_CLICK',
  'FORM_SUBMIT',
  'FORM_SUBMITTED',
  'API_REQUEST',
  'ERROR_EVENT',
  'ERROR_OCCURRED',
  'UNHANDLED_EXCEPTION',
  'SERVER_ERROR',
  'CLIENT_ERROR',
  'BUSINESS_EVENT',
  'STATE_ENTERED',
  'STATE_TRANSITION',
  'FLOW_INITIAL_STATE',
  'FLOW_STATE_REACHED',
  'FLOW_TRANSITION',
  'FLOW_TERMINAL_STATE',
  'WORKFLOW_STARTED',
  'WORKFLOW_COMPLETED',
  'WORKFLOW_FAILED',
  'TELLANN_ONBOARDING_TEST',
  'TELLANN_INITIALIZED',
  'QA_RUN_STARTED',
  'QA_RUN_COMPLETED',
  'QA_RUN_FAILED',
  'BROWSER_PAGE_LOADED',
  'BROWSER_CONSOLE_ERROR',
  'BROWSER_NETWORK_FAILED',
  'VISUAL_ASSERTION_FAILED',
  'ACCESSIBILITY_FINDING',
  'INSTRUMENTATION_VERIFIED',
  'REPOSITORY_SNAPSHOT_CREATED',
  'EXPECTED_FLOW_VERSION_SELECTED'
]);

export const TellannEventSchema = z.object({
  eventId: z.string().uuid(),
  sessionId: z.string().uuid(),
  tenantId: z.string(),
  applicationId: z.string(),
  environmentId: z.string().nullable().optional(),
  runId: z.string().uuid().nullable().optional(),
  traceId: z.string().uuid().nullable().optional(),
  source: z.string(),
  eventVersion: z.literal('1.0'),
  eventType: EventTypeSchema,
  timestamp: z.string().datetime(),
  metadata: z.record(z.any()).default({}),
});

export const ApiRequestEventSchema = TellannEventSchema.extend({
  eventType: z.literal('API_REQUEST'),
  metadata: z.object({
    requestId: z.string().uuid().optional(),
    endpoint: z.string(),
    method: z.string(),
    statusCode: z.number(),
    durationMs: z.number(),
  }),
});

export const EventBatchSchema = z.array(TellannEventSchema);
