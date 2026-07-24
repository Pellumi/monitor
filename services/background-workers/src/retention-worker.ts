import { AuditAction, PrismaClient } from '@sots/db';
import { createStorageClient } from '@sots/storage';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface RetentionSweepResult {
  dryRun: boolean;
  organizations: number;
  sessions: number;
  demonstrations: number;
  storageObjects: number;
}

export async function runRetentionSweep(
  prisma: PrismaClient,
  options: { dryRun?: boolean; now?: Date } = {},
): Promise<RetentionSweepResult> {
  const dryRun = options.dryRun ?? process.env.RETENTION_ENFORCEMENT_ENABLED !== 'true';
  const now = options.now ?? new Date();
  const storage = createStorageClient();
  const entitlements = await prisma.entitlement.findMany({ select: { organizationId: true, limits: true } });
  const result: RetentionSweepResult = { dryRun, organizations: 0, sessions: 0, demonstrations: 0, storageObjects: 0 };

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
