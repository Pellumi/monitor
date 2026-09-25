import { AuditAction, PrismaClient } from '@tellann/db';
import { Services } from '@tellann/shared';
import { createStorageClient } from '@tellann/storage';

const DAY_MS = 24 * 60 * 60 * 1000;

const ENDPOINT_ENGINE_URL = (
  process.env.ENDPOINT_ENGINE_URL || `http://localhost:${Services.ENDPOINT_ENGINE}`
).replace(/\/$/, '');

export interface RetentionSweepResult {
  dryRun: boolean;
  organizations: number;
  sessions: number;
  demonstrations: number;
  storageObjects: number;
  /** Applications whose endpoint metrics were asked to age out. */
  endpointMetricApplications: number;
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

export async function runRetentionSweep(
  prisma: PrismaClient,
  options: { dryRun?: boolean; now?: Date } = {},
): Promise<RetentionSweepResult> {
  const dryRun = options.dryRun ?? process.env.RETENTION_ENFORCEMENT_ENABLED !== 'true';
  const now = options.now ?? new Date();
  const storage = createStorageClient();
  const entitlements = await prisma.entitlement.findMany({ select: { organizationId: true, limits: true } });
  const result: RetentionSweepResult = { dryRun, organizations: 0, sessions: 0, demonstrations: 0, storageObjects: 0, endpointMetricApplications: 0 };

  for (const entitlement of entitlements) {
    const agreement = await prisma.enterpriseAgreement.findUnique({ where: { organizationId: entitlement.organizationId } });
    if (agreement?.legalHold) continue;
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
    const objects = await prisma.storageLedgerEntry.findMany({
      where: { organizationId: entitlement.organizationId, deletedAt: null, createdAt: { lt: cutoff } },
      select: { id: true, objectKey: true },
      take: 500,
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
