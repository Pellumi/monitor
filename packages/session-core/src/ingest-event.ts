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

/** Applies a batch, sharing one application lookup across it. */
export async function applyEventsToSessions(
  prisma: PrismaClient,
  events: TellannEvent[],
): Promise<IngestBatchResult> {
  const applicationCache = new Map<string, ApplicationRow | null>();
  const result: IngestBatchResult = {
    accepted: 0, duplicates: 0, rejected: [], sessionIds: [], aliasesCreated: 0,
  };
  const sessionIds = new Set<string>();

  for (const event of events) {
    const outcome = await applyEventToSession(prisma, event, { applicationCache });
    if (!outcome.accepted) {
      result.rejected.push({ eventId: event.eventId, reason: outcome.reason });
      continue;
    }
    result.accepted += 1;
    if (!outcome.created) result.duplicates += 1;
    if (outcome.identity.aliasCreated) result.aliasesCreated += 1;
    sessionIds.add(outcome.sessionId);
  }

  result.sessionIds = [...sessionIds];
  return result;
}
