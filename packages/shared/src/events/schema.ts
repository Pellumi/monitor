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
  'WORKFLOW_STARTED',
  'WORKFLOW_COMPLETED',
  'WORKFLOW_FAILED',
  'SOTS_ONBOARDING_TEST'
]);

export const SotsEventSchema = z.object({
  eventId: z.string().uuid(),
  sessionId: z.string().uuid(),
  tenantId: z.string(),
  applicationId: z.string(),
  source: z.string(),
  eventVersion: z.literal('1.0'),
  eventType: EventTypeSchema,
  timestamp: z.string().datetime(),
  metadata: z.record(z.any()).default({}),
});

export const ApiRequestEventSchema = SotsEventSchema.extend({
  eventType: z.literal('API_REQUEST'),
  metadata: z.object({
    requestId: z.string().uuid().optional(),
    endpoint: z.string(),
    method: z.string(),
    statusCode: z.number(),
    durationMs: z.number(),
  }),
});

export const EventBatchSchema = z.array(SotsEventSchema);
