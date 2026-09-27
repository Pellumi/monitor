import { Prisma, type PrismaClient } from '@tellann/db';
import type { TellannEvent } from '@tellann/shared';
import { isUniqueViolation } from './prisma-errors';
import { applyPrivacyFloor, resolveIdentity, resolvePrivacyFloor } from './identity';

/**
 * Persisting one telemetry event.
 *
 * This existed twice — once in session-engine's Kafka consumer and once in
 * event-collector's Postgres branch — and the two had already drifted: the
 * collector verified that the event's `environmentId` and `runId` actually belong
 * to the application, and session-engine did not. Both now call this, and the
 * stricter behaviour is the one that survived.
 */

export type IngestOutcome =
  | {
      accepted: true;
      sessionId: string;
      created: boolean;
      identity: { endUserId: string | null; aliasCreated: boolean };
    }
  | { accepted: false; reason: 'UNKNOWN_APPLICATION' | 'MALFORMED' };

export interface IngestOptions {
  /**
   * Resolved applications, reused across a batch. A batch is almost always one
   * application, so without this every event pays for the same lookup.
   */
  applicationCache?: Map<string, ApplicationRow | null>;
}

export interface ApplicationRow {
  id: string;
  organizationId: string | null;
}

async function resolveApplication(
  prisma: PrismaClient,
  applicationId: string,
  cache?: Map<string, ApplicationRow | null>,
): Promise<ApplicationRow | null> {
  if (cache?.has(applicationId)) return cache.get(applicationId) ?? null;
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    select: { id: true, organizationId: true },
  });
  cache?.set(applicationId, application);
  return application;
}

/**
 * Creates or extends the session row for an event.
 *
 * Written as raw SQL rather than `prisma.session.upsert` for one reason Prisma
 * cannot express: `GREATEST`/`LEAST`. The previous upsert set `endTime` to the
 * incoming event's timestamp unconditionally, so a single out-of-order batch —
 * exactly what the SDK's re-buffer-on-failure path produces — moved `endTime`
 * backwards and corrupted `durationMs` for that session permanently.
 */
async function upsertSessionWindow(
  prisma: PrismaClient,
  event: TellannEvent,
  environmentId: string | null,
  runId: string | null,
  timestamp: Date,
): Promise<void> {
  const context = event.context ?? {};
  await prisma.$executeRaw`
    INSERT INTO "Session" (
      "id", "applicationId", "environmentId", "tenantId", "qaRunId", "traceId",
      "startTime", "endTime", "createdAt", "updatedAt",
      "anonymousId", "deviceType", "browserName", "browserVersion",
      "osName", "osVersion", "viewportWidth", "viewportHeight",
      "locale", "timezone", "releaseVersion", "sampleRate",
      "agentVersion", "instrumentationManifestVersion"
    ) VALUES (
      ${event.sessionId}, ${event.applicationId}, ${environmentId}, ${event.tenantId},
      ${runId}, ${event.traceId ?? null}, ${timestamp}, ${timestamp}, NOW(), NOW(),
      ${event.anonymousId ?? null},
      ${context.deviceType ?? null}, ${context.browserName ?? null}, ${context.browserVersion ?? null},
      ${context.osName ?? null}, ${context.osVersion ?? null},
      ${context.viewportWidth ?? null}, ${context.viewportHeight ?? null},
      ${context.locale ?? null}, ${context.timezone ?? null}, ${context.releaseVersion ?? null},
      ${event.sampleRate ?? null},
      ${event.agentVersion ?? null}, ${event.instrumentationManifestVersion ?? null}
    )
    ON CONFLICT ("id") DO UPDATE SET
      "endTime"       = GREATEST("Session"."endTime",   EXCLUDED."endTime"),
      "startTime"     = LEAST   ("Session"."startTime", EXCLUDED."startTime"),
      "environmentId" = COALESCE("Session"."environmentId", EXCLUDED."environmentId"),
      "qaRunId"       = COALESCE("Session"."qaRunId",       EXCLUDED."qaRunId"),
      "traceId"       = COALESCE("Session"."traceId",       EXCLUDED."traceId"),
      -- First writer wins for everything below. Context describes the page load, so
      -- it must not flap between events; and a later event that simply omits a field
      -- (an SDK reconfigured mid-session, a privacy extension switched on) must not
      -- erase what an earlier one established.
      "anonymousId"    = COALESCE("Session"."anonymousId",    EXCLUDED."anonymousId"),
      "deviceType"     = COALESCE("Session"."deviceType",     EXCLUDED."deviceType"),
      "browserName"    = COALESCE("Session"."browserName",    EXCLUDED."browserName"),
      "browserVersion" = COALESCE("Session"."browserVersion", EXCLUDED."browserVersion"),
      "osName"         = COALESCE("Session"."osName",         EXCLUDED."osName"),
      "osVersion"      = COALESCE("Session"."osVersion",      EXCLUDED."osVersion"),
      "viewportWidth"  = COALESCE("Session"."viewportWidth",  EXCLUDED."viewportWidth"),
      "viewportHeight" = COALESCE("Session"."viewportHeight", EXCLUDED."viewportHeight"),
      "locale"         = COALESCE("Session"."locale",         EXCLUDED."locale"),
      "timezone"       = COALESCE("Session"."timezone",       EXCLUDED."timezone"),
      "releaseVersion" = COALESCE("Session"."releaseVersion", EXCLUDED."releaseVersion"),
      "sampleRate"     = COALESCE("Session"."sampleRate",     EXCLUDED."sampleRate"),
      "agentVersion"   = COALESCE("Session"."agentVersion",   EXCLUDED."agentVersion"),
      "instrumentationManifestVersion" = COALESCE(
        "Session"."instrumentationManifestVersion", EXCLUDED."instrumentationManifestVersion"),
      "updatedAt"     = NOW()
  `;
}

/**
 * Onboarding milestones a first event proves.
 *
 * Kept out of the hot path's critical section: these are one-time transitions, so
 * the guard reads cheaply and the writes only ever happen once per application.
 */
async function recordActivation(
  prisma: PrismaClient,
  event: TellannEvent,
  application: ApplicationRow,
  environmentId: string,
): Promise<void> {
  if (!application.organizationId) return;

  const progress = await prisma.applicationOnboardingProgress.findUnique({
    where: { applicationId: event.applicationId },
  });
  if (!progress) return;

  if (!progress.sdkConnected) {
    await prisma.applicationOnboardingProgress.update({
      where: { applicationId: event.applicationId },
      data: { sdkConnected: true },
    });
    await prisma.activationEvent.create({
      data: {
        organizationId: application.organizationId,
        applicationId: event.applicationId,
        environmentId,
        eventName: 'SDK_CONNECTED',
        metadata: { sessionId: event.sessionId },
      },
    });
  }

  if (event.eventType === 'TELLANN_ONBOARDING_TEST' && !progress.installationTestPassed) {
    await prisma.applicationOnboardingProgress.update({
      where: { applicationId: event.applicationId },
      data: { installationTestPassed: true },
    });
    await prisma.activationEvent.create({
      data: {
        organizationId: application.organizationId,
        applicationId: event.applicationId,
        environmentId,
        eventName: 'INSTALL_TEST_PASSED',
        metadata: { sessionId: event.sessionId },
      },
    });
  }
}

export async function applyEventToSession(
  prisma: PrismaClient,
  event: TellannEvent,
  options: IngestOptions = {},
): Promise<IngestOutcome> {
  // Telemetry used to be able to mint an Application: session-engine did
  // `application.upsert({ create: { id, name: 'App <id>' } })`, so anything that
  // reached the collector with an arbitrary applicationId created a tenant-less
  // row that then owned real sessions. An unknown application is now a dropped
  // event.
  const application = await resolveApplication(prisma, event.applicationId, options.applicationCache);
  if (!application) return { accepted: false, reason: 'UNKNOWN_APPLICATION' };

  const timestamp = new Date(event.timestamp);
  if (Number.isNaN(timestamp.getTime())) return { accepted: false, reason: 'MALFORMED' };

  // An environment or run the caller does not own must not be recorded against
  // this session — and a dangling id would fail the foreign key anyway, losing the
  // whole event rather than just its correlation.
  const [environment, run] = await Promise.all([
    event.environmentId
      ? prisma.environment.findFirst({
        where: { id: event.environmentId, applicationId: event.applicationId },
        select: { id: true },
      })
      : null,
    event.runId
      ? prisma.qARun.findFirst({
        where: { id: event.runId, applicationId: event.applicationId },
        select: { id: true },
      })
      : null,
  ]);

  const environmentId = environment?.id ?? null;
  const runId = run?.id ?? null;

  await upsertSessionWindow(prisma, event, environmentId, runId, timestamp);

  // Keyed by eventId, so a Kafka replay or a retried batch is a no-op rather than
  // a duplicate timeline entry.
  let created = true;
  try {
    await prisma.sessionEvent.create({
      data: {
        id: event.eventId,
        sessionId: event.sessionId,
        eventType: event.eventType,
        eventVersion: event.eventVersion,
        source: event.source,
        timestamp,
        metadata: (event.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    created = false;
  }

  // Identity, after the session row exists so there is something to attribute to.
  // The floor runs here rather than at the edge of the read plane: raw identity must
  // never reach Kafka, a log line, or the outbox payload.
  let identity: { endUserId: string | null; aliasCreated: boolean } = {
    endUserId: null,
    aliasCreated: false,
  };
  if (event.anonymousId || event.endUserExternalId) {
    const floor = await resolvePrivacyFloor(prisma, event.applicationId);
    const floored = applyPrivacyFloor(floor, {
      externalId: event.endUserExternalId ?? null,
      traits: event.endUserTraits ?? null,
    });
    identity = await resolveIdentity(prisma, {
      applicationId: event.applicationId,
      sessionId: event.sessionId,
      anonymousId: event.anonymousId ?? null,
      externalId: floored.externalId,
      externalIdHash: floored.externalIdHash,
      traits: floored.traits,
      // The event's own timestamp, never now(): an out-of-order or replayed batch
      // must not overwrite newer traits with older ones.
      at: timestamp,
    });
  }

  if (environmentId) {
    await recordActivation(prisma, event, application, environmentId);
  }

  return { accepted: true, sessionId: event.sessionId, created, identity };
}

export interface IngestBatchResult {
  accepted: number;
  duplicates: number;
  rejected: Array<{ eventId: string; reason: 'UNKNOWN_APPLICATION' | 'MALFORMED' }>;
  sessionIds: string[];
  /** Browsers linked to a person for the first time, so a back-link can be queued. */
  aliasesCreated: number;
}

/**
 * Applies a batch.
 *
 * Per event this used to be three sequential round-trips -- an application lookup, a session
 * upsert, an event insert -- so a 200-event batch was 600 of them. The event rows, which are
 * the bulk, now go in one `createMany`, and the session window is folded once per session
 * rather than once per event. What is left per event is the identity work, which genuinely
 * has to be ordered: a later assertion must win over an earlier one.
 */
export async function applyEventsToSessions(
  prisma: PrismaClient,
  events: TellannEvent[],
): Promise<IngestBatchResult> {
  const applicationCache = new Map<string, ApplicationRow | null>();
  const result: IngestBatchResult = {
    accepted: 0, duplicates: 0, rejected: [], sessionIds: [], aliasesCreated: 0,
  };
  if (events.length === 0) return result;

  // A batch is almost always one session, so the identity and activation work is done once
  // per session via the last event that carries each -- not once per event.
  const bySession = new Map<string, TellannEvent[]>();
  for (const event of events) {
    const list = bySession.get(event.sessionId);
    if (list) list.push(event);
    else bySession.set(event.sessionId, [event]);
  }

  const insertable: TellannEvent[] = [];

  for (const [sessionId, sessionEvents] of bySession) {
    // Ordered, so "the session window" and "the last identity asserted" both mean what they
    // say even when a batch arrives out of order.
    sessionEvents.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

    let anyAccepted = false;
    for (const event of sessionEvents) {
      const prepared = await prepareEvent(prisma, event, applicationCache);
      if (!prepared.ok) {
        result.rejected.push({ eventId: event.eventId, reason: prepared.reason });
        continue;
      }

      await upsertSessionWindow(prisma, event, prepared.environmentId, prepared.runId, prepared.timestamp);
      insertable.push(event);
      anyAccepted = true;

      if (event.anonymousId || event.endUserExternalId) {
        const identity = await resolveIdentityForEvent(prisma, event, prepared.timestamp);
        if (identity.aliasCreated) result.aliasesCreated += 1;
      }

      if (prepared.environmentId) {
        await recordActivation(prisma, event, prepared.application, prepared.environmentId);
      }
    }

    if (anyAccepted) result.sessionIds.push(sessionId);
  }

  if (insertable.length > 0) {
    // One statement for the bulk. skipDuplicates makes a replayed or retried batch a no-op,
    // which is the same guarantee the per-event path got from catching P2002 -- without
    // paying for a round-trip per event to find out.
    const inserted = await prisma.sessionEvent.createMany({
      data: insertable.map((event) => ({
        id: event.eventId,
        sessionId: event.sessionId,
        eventType: event.eventType,
        eventVersion: event.eventVersion,
        source: event.source,
        timestamp: new Date(event.timestamp),
        metadata: (event.metadata ?? {}) as Prisma.InputJsonValue,
      })),
      skipDuplicates: true,
    });
    result.accepted = insertable.length;
    result.duplicates = insertable.length - inserted.count;
  }

  return result;
}

type PreparedEvent =
  | {
      ok: true;
      application: ApplicationRow;
      environmentId: string | null;
      runId: string | null;
      timestamp: Date;
    }
  | { ok: false; reason: 'UNKNOWN_APPLICATION' | 'MALFORMED' };

/** The per-event validation both the single and the batch path share. */
async function prepareEvent(
  prisma: PrismaClient,
  event: TellannEvent,
  applicationCache: Map<string, ApplicationRow | null>,
): Promise<PreparedEvent> {
  const application = await resolveApplication(prisma, event.applicationId, applicationCache);
  if (!application) return { ok: false, reason: 'UNKNOWN_APPLICATION' };

  const timestamp = new Date(event.timestamp);
  if (Number.isNaN(timestamp.getTime())) return { ok: false, reason: 'MALFORMED' };

  const [environment, run] = await Promise.all([
    event.environmentId
      ? prisma.environment.findFirst({
        where: { id: event.environmentId, applicationId: event.applicationId },
        select: { id: true },
      })
      : null,
    event.runId
      ? prisma.qARun.findFirst({
        where: { id: event.runId, applicationId: event.applicationId },
        select: { id: true },
      })
      : null,
  ]);

  return {
    ok: true,
    application,
    environmentId: environment?.id ?? null,
    runId: run?.id ?? null,
    timestamp,
  };
}

/** The identity resolution both paths share, floor included. */
async function resolveIdentityForEvent(
  prisma: PrismaClient,
  event: TellannEvent,
  timestamp: Date,
): Promise<{ endUserId: string | null; aliasCreated: boolean }> {
  const floor = await resolvePrivacyFloor(prisma, event.applicationId);
  const floored = applyPrivacyFloor(floor, {
    externalId: event.endUserExternalId ?? null,
    traits: event.endUserTraits ?? null,
  });
  return resolveIdentity(prisma, {
    applicationId: event.applicationId,
    sessionId: event.sessionId,
    anonymousId: event.anonymousId ?? null,
    externalId: floored.externalId,
    externalIdHash: floored.externalIdHash,
    traits: floored.traits,
    // The event's own timestamp, never now(): an out-of-order or replayed batch must not
    // overwrite newer traits with older ones.
    at: timestamp,
  });
}
