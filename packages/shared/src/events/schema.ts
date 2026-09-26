import { z } from 'zod';
import type { ClientContext } from './types';

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
  // Present in the EventType union and emitted by the SDK's workflow tracker since
  // it was written, but never listed here -- so every cancelled workflow was
  // rejected by the collector with a 400 that (before the flush fix) was silently
  // discarded along with the rest of its batch.
  'WORKFLOW_CANCELLED',
  // ── Session lifecycle (1.1) ─────────────────────────────────────────────
  // A session was previously implicit: the SDK minted an id per page load and the
  // server inferred the end from silence. These make both boundaries explicit.
  'SESSION_STARTED',
  'SESSION_ENDED',
  // ── Identity (1.1) ─────────────────────────────────────────────────────
  // identify() used to write its user id into a BUSINESS_EVENT's metadata, where
  // the SDK's own privacy sanitizer replaced it with a constant string. Identity
  // is envelope data, not payload data.
  'USER_IDENTIFIED',
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
  'EXPECTED_FLOW_VERSION_SELECTED',
]);

/**
 * Envelope versions this collector accepts.
 *
 * `eventVersion` is provenance and fleet telemetry — "what share of ingest is
 * still 1.0" — and deliberately NOT a dispatch key. Nothing branches on it, and
 * nothing should: customers pin the SDK, so the fleet is always mixed, and a 1.1
 * SDK is not a 1.1 payload. A privacy extension can suppress `localStorage`, so
 * `anonymousId` is absent; an unconfigured build has no `releaseVersion`. Version
 * branching would therefore be wrong in both directions. Every consumer treats
 * each field below as independently optional.
 */
export const EVENT_VERSIONS = ['1.0', '1.1'] as const;
export const EventVersionSchema = z.enum(EVENT_VERSIONS);
export const CURRENT_EVENT_VERSION = '1.1' satisfies (typeof EVENT_VERSIONS)[number];

/**
 * What the page was, rather than what happened on it.
 *
 * Captured once when a session starts and repeated on every event, because a
 * scheme that sent it only on the first event fails the moment a page load produces
 * two batches and the first one is rejected. It costs ~220 bytes against a 32 KB
 * per-event limit. It is persisted once, on `Session`, never per event.
 */
export const ClientContextSchema = z.object({
  deviceType: z.enum(['desktop', 'mobile', 'tablet', 'bot', 'unknown']).optional(),
  browserName: z.string().max(40).optional(),
  browserVersion: z.string().max(24).optional(),
  osName: z.string().max(40).optional(),
  osVersion: z.string().max(24).optional(),
  viewportWidth: z.number().int().min(0).max(65535).optional(),
  viewportHeight: z.number().int().min(0).max(65535).optional(),
  /** BCP-47, whose worst realistic case is well under 35 characters. */
  locale: z.string().max(35).optional(),
  /** IANA zone name. */
  timezone: z.string().max(64).optional(),
  releaseVersion: z.string().max(64).optional(),
});

/**
 * Compile-time proof that the validator and the hand-written interface describe the
 * same shape.
 *
 * This is the exact drift that let `agentVersion` and
 * `instrumentationManifestVersion` sit in the TypeScript type, be set by the SDK,
 * and be silently stripped at ingest for as long as they existed. A field added to
 * one side and forgotten on the other now fails the build instead.
 */
type MutuallyAssignable<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never;
const _clientContextShapesAgree: MutuallyAssignable<ClientContext, z.infer<typeof ClientContextSchema>> = true;
void _clientContextShapesAgree;

/**
 * The event envelope.
 *
 * Stays a plain `z.object`, which strips unknown keys. That is a security property
 * rather than an oversight: both `applyGatewayIdentity` and `applyRunCorrelation`
 * spread the parsed event, so any top-level key a caller invented would ride into
 * the database. New fields are therefore added explicitly — and `agentVersion` and
 * `instrumentationManifestVersion` below are not new features but a fix: they have
 * been in the TypeScript type and set by the SDK all along, while this schema
 * silently discarded them.
 */
const TellannEventEnvelopeSchema = z.object({
  eventId: z.string().uuid(),
  sessionId: z.string().uuid(),
  tenantId: z.string(),
  applicationId: z.string(),
  environmentId: z.string().nullable().optional(),
  runId: z.string().uuid().nullable().optional(),
  traceId: z.string().uuid().nullable().optional(),
  source: z.string(),
  eventVersion: EventVersionSchema,
  eventType: EventTypeSchema,
  timestamp: z.string().datetime(),
  metadata: z.record(z.any()).default({}),

  // ── 1.1 additions, every one optional ─────────────────────────────────
  /**
   * Stable per-browser id from `localStorage`. Not constrained to a uuid on
   * purpose: an older SDK, a privacy extension or a cookie-less mode may supply
   * something else, and rejecting the event would lose the telemetry as well as
   * the identity.
   */
  anonymousId: z.string().min(1).max(128).nullable().optional(),
  /**
   * The customer's own user id, as asserted by `identify()`. A proposal, not a
   * decision: the collector applies the per-application privacy floor before
   * anything durable is written.
   */
  endUserExternalId: z.string().min(1).max(256).nullable().optional(),
  endUserTraits: z.record(z.any()).nullable().optional(),
  context: ClientContextSchema.nullable().optional(),
  /** Whether this session was selected for capture. */
  sampled: z.boolean().optional(),
  /**
   * The probability it was selected with. Required alongside `sampled`, because a
   * bare boolean carries almost no information: a rollup that says "1,200
   * checkouts" for a 10%-sampled application has to be able to say 12,000.
   */
  sampleRate: z.number().min(0).max(1).optional(),

  // ── Present in the type and sent by the SDK; previously stripped here ──
  agentVersion: z.string().max(64).nullable().optional(),
  instrumentationManifestVersion: z.string().max(64).nullable().optional(),
});

/**
 * The envelope plus its cross-field rules.
 *
 * Split from the object above only because `.superRefine` produces a ZodEffects,
 * which cannot be `.extend`ed -- and the per-type schemas below need to extend the
 * plain object.
 */
export const TellannEventSchema = TellannEventEnvelopeSchema.superRefine((event, ctx) => {
  if (event.sampled !== undefined && event.sampleRate === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['sampleRate'],
      message: 'sampleRate is required whenever sampled is present',
    });
  }
});

export const ApiRequestEventSchema = TellannEventEnvelopeSchema.extend({
  eventType: z.literal('API_REQUEST'),
  metadata: z.object({
    requestId: z.string().uuid().optional(),
    endpoint: z.string(),
    method: z.string(),
    statusCode: z.number(),
    durationMs: z.number(),
  }),
});

/**
 * Kept for compatibility. Prefer `parseEventBatch`: this rejects the entire batch
 * on any single invalid element, and the collector answers 400, so one malformed
 * event loses the other 199.
 */
export const EventBatchSchema = z.array(TellannEventSchema);

export interface BatchParseResult<T = z.infer<typeof TellannEventSchema>> {
  events: T[];
  rejected: Array<{ index: number; eventId?: string; issues: string[] }>;
  /** False when the body was not an array at all, which is a client bug worth a 400. */
  wellFormed: boolean;
}

/**
 * Parses a batch element by element.
 *
 * With a widening envelope and a fleet of pinned SDK versions, all-or-nothing
 * validation is a data-loss amplifier: it takes one event the server does not yet
 * understand to discard every event that shared its flush.
 */
export function parseEventBatch(input: unknown): BatchParseResult {
  if (!Array.isArray(input)) return { events: [], rejected: [], wellFormed: false };

  const events: Array<z.infer<typeof TellannEventSchema>> = [];
  const rejected: BatchParseResult['rejected'] = [];

  input.forEach((candidate, index) => {
    const parsed = TellannEventSchema.safeParse(candidate);
    if (parsed.success) {
      events.push(parsed.data);
      return;
    }
    rejected.push({
      index,
      eventId: typeof (candidate as { eventId?: unknown })?.eventId === 'string'
        ? (candidate as { eventId: string }).eventId
        : undefined,
      issues: parsed.error.issues.map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`),
    });
  });

  return { events, rejected, wellFormed: true };
}
