import { describe, expect, it } from 'vitest';
import {
  CURRENT_EVENT_VERSION,
  EVENT_VERSIONS,
  EventTypeSchema,
  TellannEventSchema,
  parseEventBatch,
} from './schema';
import type { EventType } from './types';

function baseEvent(overrides: Record<string, unknown> = {}) {
  return {
    eventId: '11111111-1111-4111-8111-111111111111',
    sessionId: '22222222-2222-4222-8222-222222222222',
    tenantId: 'org-1',
    applicationId: 'app-1',
    source: 'frontend-sdk',
    eventVersion: '1.1',
    eventType: 'PAGE_VIEW',
    timestamp: '2026-09-29T12:00:00.000Z',
    metadata: { url: 'https://lms.test/courses' },
    ...overrides,
  };
}

describe('envelope versioning', () => {
  it('still accepts a 1.0 payload', () => {
    // Customers pin the SDK, so a mixed fleet is permanent, not transitional.
    const parsed = TellannEventSchema.safeParse(baseEvent({ eventVersion: '1.0' }));
    expect(parsed.success).toBe(true);
  });

  it('accepts 1.1', () => {
    expect(TellannEventSchema.safeParse(baseEvent()).success).toBe(true);
    expect(EVENT_VERSIONS).toContain(CURRENT_EVENT_VERSION);
  });

  it('rejects a version it does not know', () => {
    const parsed = TellannEventSchema.safeParse(baseEvent({ eventVersion: '2.0' }));
    expect(parsed.success).toBe(false);
  });
});

describe('1.1 fields survive ingest', () => {
  // The bug this pins: `agentVersion` and `instrumentationManifestVersion` were in
  // the TypeScript type and set by the SDK, but absent from this schema -- and a
  // plain z.object strips unknown keys, so they were silently discarded for as long
  // as they existed. Every new field gets an assertion here.
  it('round-trips every field the envelope gained', () => {
    const event = baseEvent({
      anonymousId: 'anon-abc',
      endUserExternalId: 'student-42',
      endUserTraits: { plan: 'pro', seats: 3 },
      context: {
        deviceType: 'mobile',
        browserName: 'Chrome',
        browserVersion: '141',
        osName: 'Android',
        osVersion: '15',
        viewportWidth: 390,
        viewportHeight: 844,
        locale: 'en-GB',
        timezone: 'Europe/London',
        releaseVersion: 'web@2026.09.3',
      },
      sampled: true,
      sampleRate: 0.25,
      agentVersion: 'agent@1.4.0',
      instrumentationManifestVersion: 'manifest@7',
    });

    const parsed = TellannEventSchema.parse(event);

    expect(parsed.anonymousId).toBe('anon-abc');
    expect(parsed.endUserExternalId).toBe('student-42');
    expect(parsed.endUserTraits).toEqual({ plan: 'pro', seats: 3 });
    expect(parsed.context?.deviceType).toBe('mobile');
    expect(parsed.context?.viewportWidth).toBe(390);
    expect(parsed.context?.timezone).toBe('Europe/London');
    expect(parsed.context?.releaseVersion).toBe('web@2026.09.3');
    expect(parsed.sampled).toBe(true);
    expect(parsed.sampleRate).toBe(0.25);
    expect(parsed.agentVersion).toBe('agent@1.4.0');
    expect(parsed.instrumentationManifestVersion).toBe('manifest@7');
  });

  it('still strips a key nobody declared', () => {
    // Pinned deliberately rather than inherited by accident: applyGatewayIdentity and
    // applyRunCorrelation both spread the parsed event, so a top-level key a caller
    // invented would otherwise ride into the database.
    const parsed = TellannEventSchema.parse(baseEvent({ isAdmin: true, __proto__pollution: 'x' }));
    expect('isAdmin' in parsed).toBe(false);
    expect(Object.keys(parsed)).not.toContain('__proto__pollution');
  });

  it('treats every 1.1 field as independently optional', () => {
    // A 1.1 SDK is not a 1.1 payload: a privacy extension suppressing localStorage
    // leaves anonymousId absent, an unconfigured build has no releaseVersion.
    const parsed = TellannEventSchema.parse(baseEvent({ eventVersion: '1.1' }));
    expect(parsed.anonymousId).toBeUndefined();
    expect(parsed.context).toBeUndefined();
    expect(parsed.sampleRate).toBeUndefined();
  });

  it('requires sampleRate whenever sampled is present', () => {
    // A bare boolean carries almost no information -- if sampled were false the SDK
    // would not have sent the event. What a rollup needs is the inverse weight.
    const parsed = TellannEventSchema.safeParse(baseEvent({ sampled: true }));
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.some((issue) => issue.path.includes('sampleRate'))).toBe(true);
    }
  });

  it('rejects a context field that is the wrong shape rather than coercing it', () => {
    expect(TellannEventSchema.safeParse(baseEvent({
      context: { viewportWidth: 'wide' },
    })).success).toBe(false);
  });
});

describe('event types the collector accepts', () => {
  it('accepts WORKFLOW_CANCELLED, which the SDK has always emitted', () => {
    // It was in the EventType union and produced by the workflow tracker, but never
    // listed in this enum -- so every cancelled workflow was rejected at ingest.
    expect(EventTypeSchema.safeParse('WORKFLOW_CANCELLED').success).toBe(true);
  });

  it('accepts the session lifecycle and identity types', () => {
    for (const eventType of ['SESSION_STARTED', 'SESSION_ENDED', 'USER_IDENTIFIED']) {
      expect(EventTypeSchema.safeParse(eventType).success).toBe(true);
    }
  });

  it('accepts every member of the EventType union', () => {
    // The drift guard. The union and this enum are two hand-maintained lists of the
    // same thing, and WORKFLOW_CANCELLED shows what happens when they disagree: the
    // SDK emits an event the collector refuses.
    const declared: EventType[] = [
      'PAGE_VIEW', 'ROUTE_CHANGE', 'BUTTON_CLICK', 'LINK_CLICK',
      'FORM_SUBMIT', 'FORM_SUBMITTED', 'API_REQUEST',
      'ERROR_EVENT', 'ERROR_OCCURRED', 'UNHANDLED_EXCEPTION',
      'SERVER_ERROR', 'CLIENT_ERROR', 'BUSINESS_EVENT',
      'STATE_ENTERED', 'STATE_TRANSITION',
      'FLOW_INITIAL_STATE', 'FLOW_STATE_REACHED', 'FLOW_TRANSITION', 'FLOW_TERMINAL_STATE',
      'WORKFLOW_STARTED', 'WORKFLOW_COMPLETED', 'WORKFLOW_FAILED', 'WORKFLOW_CANCELLED',
      'SESSION_STARTED', 'SESSION_ENDED', 'USER_IDENTIFIED',
      'TELLANN_ONBOARDING_TEST', 'TELLANN_INITIALIZED',
      'QA_RUN_STARTED', 'QA_RUN_COMPLETED', 'QA_RUN_FAILED',
      'BROWSER_PAGE_LOADED', 'BROWSER_CONSOLE_ERROR', 'BROWSER_NETWORK_FAILED',
      'VISUAL_ASSERTION_FAILED', 'ACCESSIBILITY_FINDING', 'INSTRUMENTATION_VERIFIED',
      'REPOSITORY_SNAPSHOT_CREATED', 'EXPECTED_FLOW_VERSION_SELECTED',
    ];
    const rejected = declared.filter((eventType) => !EventTypeSchema.safeParse(eventType).success);
    expect(rejected).toEqual([]);
    // And the enum has nothing the union lacks.
    expect(EventTypeSchema.options.length).toBe(declared.length);
  });
});

describe('parseEventBatch', () => {
  it('keeps the good events when one is bad', () => {
    // `EventBatchSchema.parse` threw on the first invalid element and the collector
    // answered 400, so one event the server did not understand discarded every event
    // that shared its flush -- and the SDK did not re-buffer them, because fetch does
    // not reject on a 400.
    const batch = [
      baseEvent({ eventId: '33333333-3333-4333-8333-333333333333' }),
      { eventId: 'not-a-uuid', eventType: 'PAGE_VIEW' },
      baseEvent({ eventId: '44444444-4444-4444-8444-444444444444' }),
    ];

    const result = parseEventBatch(batch);

    expect(result.wellFormed).toBe(true);
    expect(result.events).toHaveLength(2);
    expect(result.rejected).toHaveLength(1);
    expect(result.rejected[0].index).toBe(1);
    expect(result.rejected[0].eventId).toBe('not-a-uuid');
    expect(result.rejected[0].issues.length).toBeGreaterThan(0);
  });

  it('keeps 199 of 200 when one is malformed', () => {
    const batch: unknown[] = Array.from({ length: 199 }, (_, index) => baseEvent({
      eventId: `5555${String(index).padStart(4, '0')}-5555-4555-8555-555555555555`,
    }));
    batch.splice(100, 0, { garbage: true });

    const result = parseEventBatch(batch);
    expect(result.events).toHaveLength(199);
    expect(result.rejected).toHaveLength(1);
  });

  it('reports a non-array body as not well formed, which is the only 400', () => {
    expect(parseEventBatch({ events: [] }).wellFormed).toBe(false);
    expect(parseEventBatch(null).wellFormed).toBe(false);
    expect(parseEventBatch('[]').wellFormed).toBe(false);
  });

  it('accepts an empty array without complaint', () => {
    const result = parseEventBatch([]);
    expect(result.wellFormed).toBe(true);
    expect(result.events).toEqual([]);
    expect(result.rejected).toEqual([]);
  });

  it('names the offending path so a fleet problem is diagnosable from logs', () => {
    const result = parseEventBatch([baseEvent({ sampled: true })]);
    expect(result.rejected[0].issues.join(' ')).toContain('sampleRate');
  });
});
