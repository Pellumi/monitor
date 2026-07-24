import { initTracing } from '@sots/telemetry';
initTracing('usage-tracker');

import express, { Request, Response } from 'express';
import { MemberRole, PrismaClient, UsageMetric } from '@sots/db';
import { Services } from '@sots/shared';
import { NotificationEmailService, appUrl, buildIdempotencyKey } from '@sots/email';

const app = express();
const prisma = new PrismaClient();
const emailService = new NotificationEmailService(prisma);
app.use(express.json());

// CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-sots-user-id');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Health
app.get('/health', (_req, res) => {
  res.json({ status: 'healthy', service: 'usage-tracker' });
});

// Run aggregation
async function sendUsageLimitWarning(params: {
  organizationId: string;
  organizationName: string;
  metric: UsageMetric;
  value: number;
  limit: number | null;
  applicationId?: string | null;
  environmentId?: string | null;
  periodEnd: Date;
}) {
  if (!params.limit || params.limit <= 0) return;
  const percent = Math.round((params.value / params.limit) * 100);
  const threshold = percent >= 100 ? 100 : percent >= 90 ? 90 : percent >= 80 ? 80 : null;
  if (!threshold) return;

  void emailService.sendToOrganizationMembers({
    templateKey: 'usage-limit-warning',
    organizationId: params.organizationId,
    applicationId: params.applicationId ?? null,
    eventType: 'USAGE_LIMIT_WARNING',
    severity: threshold >= 100 ? 'HIGH' : 'MEDIUM',
    variables: {
      organizationName: params.organizationName,
      metric: params.metric,
      value: params.value,
      limit: params.limit,
      percentUsed: percent,
      usageUrl: appUrl('/settings/profile'),
    },
    idempotencyKey: buildIdempotencyKey([
      'usage-limit-warning',
      params.organizationId,
      params.applicationId,
      params.environmentId,
      params.metric,
      threshold,
      params.periodEnd.toISOString().slice(0, 10),
    ]),
    roles: [MemberRole.OWNER, MemberRole.ADMIN],
  }).catch((err) => console.error('[Email] usage-limit-warning failed', err));
}

async function runAggregationForOrg(orgId: string, startDate: Date, endDate: Date) {
  const subscription = await prisma.subscription.findUnique({
    where: { organizationId: orgId },
    include: { plan: true }
  });
  if (!subscription) return;

  const plan = subscription.plan;
  const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { name: true } });
  const organizationName = org?.name || 'Organization';

  // 1. Applications usage
  const appCount = await prisma.application.count({ where: { organizationId: orgId } });
  await prisma.usageRecord.create({
    data: {
      subscriptionId: subscription.id,
      organizationId: orgId,
      metric: UsageMetric.APPLICATIONS,
      value: appCount,
      limit: plan.maxApplications,
      periodStart: startDate,
      periodEnd: endDate
    }
  });

  await prisma.usageSnapshot.create({
    data: {
      organizationId: orgId,
      metric: UsageMetric.APPLICATIONS,
      value: appCount,
      snapshotDate: endDate
    }
  });
  await sendUsageLimitWarning({
    organizationId: orgId,
    organizationName,
    metric: UsageMetric.APPLICATIONS,
    value: appCount,
    limit: plan.maxApplications,
    periodEnd: endDate,
  });

  const now = new Date();
  const [memberCount, pendingInvitationCount, storageTotals] = await Promise.all([
    prisma.organizationMembership.count({ where: { organizationId: orgId } }),
    prisma.organizationInvitation.count({ where: { organizationId: orgId, acceptedAt: null, expiresAt: { gt: now } } }),
    prisma.storageLedgerEntry.aggregate({
      where: { organizationId: orgId, deletedAt: null },
      _sum: { bytes: true, reservedBytes: true },
    }),
  ]);
  const userCount = memberCount + pendingInvitationCount;
  const storageGb = Number((storageTotals._sum.bytes ?? 0n) + (storageTotals._sum.reservedBytes ?? 0n)) / 1024 / 1024 / 1024;
  for (const item of [
    { metric: UsageMetric.USERS, value: userCount, limit: plan.maxUsers },
    { metric: UsageMetric.STORAGE_GB, value: storageGb, limit: plan.maxStorageGb },
  ]) {
    await prisma.usageRecord.create({
      data: { subscriptionId: subscription.id, organizationId: orgId, ...item, periodStart: startDate, periodEnd: endDate },
    });
    await prisma.usageSnapshot.create({
      data: { organizationId: orgId, metric: item.metric, value: item.value, snapshotDate: endDate },
    });
    await sendUsageLimitWarning({
      organizationId: orgId,
      organizationName,
      metric: item.metric,
      value: item.value,
      limit: item.limit,
      periodEnd: endDate,
    });
  }
  const demonstrationCount = await prisma.demonstration.count({
    where: {
      application: { organizationId: orgId },
      startedAt: { gte: subscription.currentPeriodStart, lt: subscription.currentPeriodEnd },
    },
  });
  await prisma.usageRecord.create({
    data: {
      subscriptionId: subscription.id,
      organizationId: orgId,
      metric: UsageMetric.DEMONSTRATIONS,
      value: demonstrationCount,
      limit: plan.maxDemoSessions,
      periodStart: subscription.currentPeriodStart,
      periodEnd: subscription.currentPeriodEnd,
    },
  });
  await prisma.usageSnapshot.create({
    data: { organizationId: orgId, metric: UsageMetric.DEMONSTRATIONS, value: demonstrationCount, snapshotDate: endDate },
  });
  await sendUsageLimitWarning({
    organizationId: orgId,
    organizationName,
    metric: UsageMetric.DEMONSTRATIONS,
    value: demonstrationCount,
    limit: plan.maxDemoSessions,
    periodEnd: subscription.currentPeriodEnd,
  });

  // Load all applications for organization
  const apps = await prisma.application.findMany({
    where: { organizationId: orgId },
    include: { environments: true }
  });

  for (const app of apps) {
    for (const env of app.environments) {
      // Sessions usage (created within the period)
      const sessionCount = await prisma.session.count({
        where: {
          applicationId: app.id,
          environmentId: env.id,
          createdAt: { gte: startDate, lte: endDate }
        }
      });

      await prisma.usageRecord.create({
        data: {
          subscriptionId: subscription.id,
          organizationId: orgId,
          applicationId: app.id,
          environmentId: env.id,
          metric: UsageMetric.SESSIONS,
          value: sessionCount,
          limit: null,
          periodStart: startDate,
          periodEnd: endDate
        }
      });

      await prisma.usageSnapshot.create({
        data: {
          organizationId: orgId,
          applicationId: app.id,
          environmentId: env.id,
          metric: UsageMetric.SESSIONS,
          value: sessionCount,
          snapshotDate: endDate
        }
      });

      // Events usage (created within the period)
      const eventCount = await prisma.sessionEvent.count({
        where: {
          session: {
            applicationId: app.id,
            environmentId: env.id
          },
          createdAt: { gte: startDate, lte: endDate }
        }
      });

      await prisma.usageRecord.create({
        data: {
          subscriptionId: subscription.id,
          organizationId: orgId,
          applicationId: app.id,
          environmentId: env.id,
          metric: UsageMetric.EVENTS,
          value: eventCount,
          limit: null,
          periodStart: startDate,
          periodEnd: endDate
        }
      });

      await prisma.usageSnapshot.create({
        data: {
          organizationId: orgId,
          applicationId: app.id,
          environmentId: env.id,
          metric: UsageMetric.EVENTS,
          value: eventCount,
          snapshotDate: endDate
        }
      });

    }
  }
}

// Perform aggregation for all orgs
app.post('/usage/aggregate', async (req: Request, res: Response) => {
  const { orgId } = req.body;
  const now = new Date();
  const startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000); // last 24h
  const endDate = now;

  try {
    if (orgId) {
      await runAggregationForOrg(orgId, startDate, endDate);
    } else {
      const orgs = await prisma.organization.findMany({ select: { id: true } });
      for (const org of orgs) {
        await runAggregationForOrg(org.id, startDate, endDate);
      }
    }
    res.json({ success: true, message: 'Aggregation completed successfully.' });
  } catch (err) {
    console.error('[UsageTracker] Error during aggregation', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /usage/organization/:orgId — get usage limits and thresholds
app.get('/usage/organization/:orgId', async (req: Request, res: Response) => {
  const { orgId } = req.params;

  try {
    const subscription = await prisma.subscription.findUnique({
      where: { organizationId: orgId },
      include: { plan: true }
    });

    if (!subscription) return res.status(404).json({ error: 'No subscription found' });

    // Fetch current snapshots
    const snapshots = await prisma.usageSnapshot.findMany({
      where: { organizationId: orgId },
      orderBy: { snapshotDate: 'desc' }
    });

    const latestMetrics: Record<string, any> = {};
    for (const snap of snapshots) {
      const key = `${snap.applicationId || 'global'}_${snap.environmentId || 'global'}_${snap.metric}`;
      if (!latestMetrics[key]) {
        latestMetrics[key] = snap;
      }
    }

    const usageItems = Object.values(latestMetrics).map((m: any) => {
      let limit: number | null = null;
      if (m.metric === UsageMetric.APPLICATIONS) limit = subscription.plan.maxApplications;
      if (m.metric === UsageMetric.USERS) limit = subscription.plan.maxUsers;
      if (m.metric === UsageMetric.STORAGE_GB) limit = subscription.plan.maxStorageGb;
      if (m.metric === UsageMetric.DEMONSTRATIONS) limit = subscription.plan.maxDemoSessions;

      const percent = limit ? (m.value / limit) * 100 : 0;
      return {
        applicationId: m.applicationId,
        environmentId: m.environmentId,
        metric: m.metric,
        value: m.value,
        limit,
        percent,
        thresholdAlert80: limit ? (m.value >= limit * 0.8) : false,
        thresholdAlert100: limit ? (m.value >= limit) : false
      };
    });

    res.json({
      plan: subscription.plan.name,
      status: subscription.status,
      usage: usageItems
    });
  } catch (err) {
    console.error('[UsageTracker] Get usage details error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

void emailService.syncBuiltinTemplates().catch((err) => console.error('[Email] Template sync failed', err));

const PORT = Services.USAGE_TRACKER || 3008;
app.listen(PORT, () => {
  console.log(`[UsageTracker] Running on port ${PORT}`);
});
