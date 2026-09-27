import { AuditAction, PrismaClient } from '@tellann/db';
import { Services } from '@tellann/shared';
import { createStorageClient } from '@tellann/storage';

const DAY_MS = 24 * 60 * 60 * 1000;

const ENDPOINT_ENGINE_URL = (
  process.env.ENDPOINT_ENGINE_URL || `http://localhost:${Services.ENDPOINT_ENGINE}`
).replace(/\/$/, '');

/** Ledger entries reclaimed per organisation per tick. See the note at its use. */
const STORAGE_OBJECT_BUDGET = 5_000;

export interface RetentionSweepResult {
  dryRun: boolean;
  organizations: number;
  sessions: number;
  demonstrations: number;
  storageObjects: number;
  /** Applications whose endpoint metrics were asked to age out. */
  endpointMetricApplications: number;
  /** Organisations skipped entirely because of a legal hold. */
  heldOrganizations: number;
  /** Sessions whose DOM recording was deleted ahead of their events. */
  replayOnlySessions: number;
}

/**
 * Asks the endpoint engine to drop metrics older than an application's
 * retention window.
 *
 * ClickHouse stays owned by that service rather than giving this worker its own
 * client, and the mutation it issues is asynchronous — this returns as soon as
 * the request is accepted. Never fatal: endpoint metrics ageing out is not
 * worth abandoning a sweep of Postgres and object storage over.
 */
async function expireEndpointMetrics(applicationId: string, retentionDays: number): Promise<boolean> {
  const secret = process.env.ENDPOINT_ENGINE_INTERNAL_SECRET?.trim();
  try {
    const response = await fetch(
      `${ENDPOINT_ENGINE_URL}/endpoints/${applicationId}/retention?retentionDays=${Math.floor(retentionDays)}`,
      { method: 'DELETE', headers: secret ? { 'x-tellann-internal-secret': secret } : {} },
    );
    if (!response.ok) {
      console.warn(`[retention-worker] endpoint metrics retention returned ${response.status} for ${applicationId}`);
      return false;
    }
    return true;
  } catch (err) {
    console.warn(`[retention-worker] endpoint metrics retention unreachable for ${applicationId}`, err);
    return false;
  }
}

/**
 * Deletes DOM recordings that expire before their session does.
 *
 * `ApplicationReplaySetting.retentionDays` can be shorter than the organisation's -- a
 * customer may want recordings gone in seven days while keeping the events for ninety --
 * and the main sweep reads only the organisation's window, so without this the shorter
 * setting would have no effect at all.
 */
async function sweepExpiredReplays(
  prisma: PrismaClient,
  storage: ReturnType<typeof createStorageClient>,
  organizationId: string,
  now: Date,
  dryRun: boolean,
): Promise<number> {
  const settings = await prisma.applicationReplaySetting.findMany({
    where: { retentionDays: { not: null }, application: { organizationId } },
    select: { applicationId: true, retentionDays: true },
  });

  let sessions = 0;
  for (const setting of settings) {
    const days = setting.retentionDays;
    if (!days || days <= 0) continue;
    const cutoff = new Date(now.getTime() - days * DAY_MS);

    const chunks = await prisma.replayChunk.findMany({
      where: { applicationId: setting.applicationId, createdAt: { lt: cutoff } },
      select: { id: true, objectKey: true, sessionId: true },
      take: STORAGE_OBJECT_BUDGET,
    });
    if (chunks.length === 0) continue;

    const sessionIds = [...new Set(chunks.map((chunk) => chunk.sessionId))];
    sessions += sessionIds.length;
    if (dryRun) continue;

    // Objects first, rows last: a crash between the two leaves rows pointing at nothing,
    // which a later pass can clean, rather than objects nothing points at, which are
    // invisible and unbillable.
    for (const chunk of chunks) {
      await storage.delete(chunk.objectKey).catch((err: unknown) => {
        console.warn(`[retention] Failed to delete replay object ${chunk.objectKey}`, err);
      });
    }
    await prisma.replayChunk.deleteMany({ where: { id: { in: chunks.map((c) => c.id) } } });

    // The per-session ledger entry goes with the last of its chunks.
    for (const sessionId of sessionIds) {
      const remaining = await prisma.replayChunk.count({ where: { sessionId } });
      if (remaining > 0) continue;
      await prisma.storageLedgerEntry.updateMany({
        where: { objectKey: `replays/${sessionId}/` },
        data: { deletedAt: now, bytes: 0n, reservedBytes: 0n },
      });
    }
  }
  return sessions;
}

export async function runRetentionSweep(
  prisma: PrismaClient,
  options: { dryRun?: boolean; now?: Date } = {},
): Promise<RetentionSweepResult> {
  const dryRun = options.dryRun ?? process.env.RETENTION_ENFORCEMENT_ENABLED !== 'true';
  const now = options.now ?? new Date();
  const storage = createStorageClient();
  const entitlements = await prisma.entitlement.findMany({ select: { organizationId: true, limits: true } });
  const result: RetentionSweepResult = { dryRun, organizations: 0, sessions: 0, demonstrations: 0, storageObjects: 0, endpointMetricApplications: 0, heldOrganizations: 0, replayOnlySessions: 0 };

  for (const entitlement of entitlements) {
    const agreement = await prisma.enterpriseAgreement.findUnique({ where: { organizationId: entitlement.organizationId } });
    if (agreement?.legalHold) {
      // Correct to skip -- but it means a held organisation's storage grows without
      // bound, and replay chunks are exactly the artefact a hold is usually about. So
      // it is reported rather than silently passed over.
      result.heldOrganizations += 1;
      continue;
    }
    const retentionDays = Number((entitlement.limits as Record<string, unknown>)?.retentionDays);
    if (!Number.isFinite(retentionDays) || retentionDays <= 0 || retentionDays >= 9999) continue;
    const cutoff = new Date(now.getTime() - retentionDays * DAY_MS);
    const sessions = await prisma.session.findMany({
      where: { application: { organizationId: entitlement.organizationId }, createdAt: { lt: cutoff } },
      select: { id: true },
      take: 500,
    });
    const demonstrations = await prisma.demonstration.findMany({
      where: { application: { organizationId: entitlement.organizationId }, startedAt: { lt: cutoff } },
      select: { id: true },
      take: 500,
    });
    // A higher budget than its siblings, because replay makes this the fastest-growing
    // thing retention has to reclaim: one ledger entry per recorded session, where a
    // session may be tens of megabytes. At 500 a day a busy application's quota would
    // never recover. (The entry is per session, not per chunk, precisely so this number
    // can stay in the thousands rather than the tens of thousands.)
    const objects = await prisma.storageLedgerEntry.findMany({
      where: { organizationId: entitlement.organizationId, deletedAt: null, createdAt: { lt: cutoff } },
      select: { id: true, objectKey: true },
      take: STORAGE_OBJECT_BUDGET,
    });
    // Endpoint metrics live in ClickHouse under their own TTL ceiling, so they
    // are expired per application rather than by the Postgres row counts above.
    // This runs even when nothing else aged out this tick: an application can
    // have months of request metrics and no expired sessions at all.
    const applications = await prisma.application.findMany({
      where: { organizationId: entitlement.organizationId },
      select: { id: true },
      take: 500,
    });
    if (!dryRun) {
      for (const application of applications) {
        if (await expireEndpointMetrics(application.id, retentionDays)) {
          result.endpointMetricApplications += 1;
        }
      }
    }

    // Before the early continue: an organisation whose events have not expired can still
    // have recordings that have, and skipping here would mean the shorter replay window
    // silently never applied.
    result.replayOnlySessions += await sweepExpiredReplays(prisma, storage, entitlement.organizationId, now, dryRun);

    if (!sessions.length && !demonstrations.length && !objects.length) continue;

    result.organizations += 1;
    result.sessions += sessions.length;
    result.demonstrations += demonstrations.length;
    result.storageObjects += objects.length;
    if (dryRun) continue;

    for (const object of objects) {
      await storage.delete(object.objectKey);
      await prisma.storageLedgerEntry.update({ where: { id: object.id }, data: { deletedAt: now, bytes: 0n, reservedBytes: 0n } });
    }
    const sessionIds = sessions.map((session) => session.id);
    const demonstrationIds = demonstrations.map((demonstration) => demonstration.id);
    await prisma.$transaction([
      prisma.stateObservation.deleteMany({ where: { sessionId: { in: sessionIds } } }),
      prisma.transitionObservation.deleteMany({ where: { sessionId: { in: sessionIds } } }),
      prisma.sessionEvent.deleteMany({ where: { sessionId: { in: sessionIds } } }),
      prisma.sessionStatistic.deleteMany({ where: { sessionId: { in: sessionIds } } }),
      // Every table keyed by sessionId has to be listed here or it outlives its
      // retention window invisibly. These are keyed on a plain scalar, not a
      // relation, so no cascade would catch them.
      prisma.sessionCompletionOutbox.deleteMany({ where: { sessionId: { in: sessionIds } } }),
      prisma.workflowExecution.deleteMany({ where: { sessionId: { in: sessionIds } } }),
      prisma.sessionFacet.deleteMany({ where: { sessionId: { in: sessionIds } } }),
      // Rows last is deliberate -- see the object-deletion loop above. A crash between the
      // two leaves recoverable orphan ROWS rather than orphan OBJECTS, which would be
      // invisible, unbillable and undeletable.
      prisma.replayChunk.deleteMany({ where: { sessionId: { in: sessionIds } } }),
      prisma.demonstration.deleteMany({ where: { id: { in: demonstrationIds } } }),
      prisma.session.deleteMany({ where: { id: { in: sessionIds } } }),
      prisma.auditLog.create({
        data: {
          organizationId: entitlement.organizationId,
          action: AuditAction.RETENTION_DATA_DELETED,
          metadata: { cutoff: cutoff.toISOString(), sessions: sessionIds.length, demonstrations: demonstrationIds.length, storageObjects: objects.length },
        },
      }),
    ]);
  }

  console.log('[retention-worker] sweep complete', result);
  return result;
}
