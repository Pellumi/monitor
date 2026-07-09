import type { PrismaClient } from '@prisma/client';

const MS_PER_DAY = 86_400_000;
const NULL_APPLICATION_ID = '__none__';

type AiUsagePrisma = PrismaClient;

type InvocationLog = Awaited<
  ReturnType<AiUsagePrisma['aIInvocationLog']['findMany']>
>[number];

type AggregateGroup = {
  organizationId: string;
  applicationId: string | null;
  date: Date;
  feature: InvocationLog['feature'];
  provider: string;
  model: string;
  items: InvocationLog[];
};

export interface AiUsageDateRange {
  days: number;
  startDate: Date;
  endDate: Date;
}

export interface AggregateAiUsageOptions {
  prisma: AiUsagePrisma;
  startDate: Date;
  endDate: Date;
  organizationId?: string;
}

export interface AggregateAiUsageResult {
  logsRead: number;
  groupsWritten: number;
}

export function normalizeAiUsageDays(value: unknown, fallback = 30, max = 365): number {
  const parsed = Number.parseInt(String(value ?? fallback), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(max, parsed);
}

export function utcDayStart(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

export function aiUsageDateRangeForDays(value: unknown, now = new Date()): AiUsageDateRange {
  const days = normalizeAiUsageDays(value);
  const todayStart = utcDayStart(now);
  return {
    days,
    startDate: new Date(todayStart.getTime() - (days - 1) * MS_PER_DAY),
    endDate: new Date(todayStart.getTime() + MS_PER_DAY),
  };
}

function aggregateGroupKey(log: InvocationLog): string {
  return [
    utcDayStart(log.createdAt).toISOString(),
    log.organizationId,
    log.applicationId ?? NULL_APPLICATION_ID,
    log.feature,
    log.provider,
    log.model,
  ].join('|');
}

function groupInvocationLogs(logs: InvocationLog[]): AggregateGroup[] {
  const groups = new Map<string, AggregateGroup>();

  for (const log of logs) {
    const key = aggregateGroupKey(log);
    const existing = groups.get(key);
    if (existing) {
      existing.items.push(log);
      continue;
    }

    groups.set(key, {
      organizationId: log.organizationId,
      applicationId: log.applicationId ?? null,
      date: utcDayStart(log.createdAt),
      feature: log.feature,
      provider: log.provider,
      model: log.model,
      items: [log],
    });
  }

  return [...groups.values()];
}

function aggregateDataForGroup(group: AggregateGroup) {
  const latencies = group.items
    .map((item) => item.latencyMs ?? 0)
    .filter((latency) => latency > 0)
    .sort((a, b) => a - b);

  const p95Index = latencies.length > 0 ? Math.ceil(latencies.length * 0.95) - 1 : 0;

  return {
    organizationId: group.organizationId,
    applicationId: group.applicationId,
    date: group.date,
    feature: group.feature,
    provider: group.provider,
    model: group.model,
    totalCalls: group.items.length,
    successCalls: group.items.filter((item) => item.status === 'SUCCESS').length,
    failedCalls: group.items.filter((item) => item.status === 'FAILED').length,
    repairedCalls: group.items.filter((item) => item.repaired).length,
    fallbackCalls: group.items.filter((item) => item.fallbackUsed || item.status === 'FALLBACK_USED').length,
    timeoutCalls: group.items.filter((item) => item.status === 'TIMEOUT').length,
    totalInputTokens: group.items.reduce((sum, item) => sum + (item.inputTokens ?? 0), 0),
    totalOutputTokens: group.items.reduce((sum, item) => sum + (item.outputTokens ?? 0), 0),
    totalTokens: group.items.reduce((sum, item) => sum + (item.totalTokens ?? 0), 0),
    totalCostUsd: group.items.reduce((sum, item) => sum + Number(item.costEstimate ?? 0), 0),
    avgLatencyMs: latencies.length > 0
      ? Math.round(latencies.reduce((sum, latency) => sum + latency, 0) / latencies.length)
      : 0,
    p95LatencyMs: latencies.length > 0 ? latencies[p95Index] ?? 0 : 0,
    maxLatencyMs: latencies.length > 0 ? latencies[latencies.length - 1] ?? 0 : 0,
  };
}

async function replaceAggregateGroup(prisma: AiUsagePrisma, group: AggregateGroup): Promise<void> {
  const data = aggregateDataForGroup(group);
  const where = {
    date: group.date,
    feature: group.feature,
    provider: group.provider,
    model: group.model,
    organizationId: group.organizationId,
    applicationId: group.applicationId,
  };

  if (group.applicationId) {
    await prisma.aIUsageDailyAggregate.upsert({
      where: {
        date_feature_provider_model_organizationId_applicationId: {
          date: group.date,
          feature: group.feature,
          provider: group.provider,
          model: group.model,
          organizationId: group.organizationId,
          applicationId: group.applicationId,
        },
      },
      create: data,
      update: { ...data, updatedAt: new Date() },
    });
    return;
  }

  await prisma.$transaction(async (tx) => {
    const existing = await tx.aIUsageDailyAggregate.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });

    if (existing.length === 0) {
      await tx.aIUsageDailyAggregate.create({ data });
      return;
    }

    const [keeper, ...duplicates] = existing;
    await tx.aIUsageDailyAggregate.update({
      where: { id: keeper.id },
      data: { ...data, updatedAt: new Date() },
    });

    if (duplicates.length > 0) {
      await tx.aIUsageDailyAggregate.deleteMany({
        where: { id: { in: duplicates.map((row) => row.id) } },
      });
    }
  });
}

export async function aggregateAiUsageDaily({
  prisma,
  startDate,
  endDate,
  organizationId,
}: AggregateAiUsageOptions): Promise<AggregateAiUsageResult> {
  const logs = await prisma.aIInvocationLog.findMany({
    where: {
      createdAt: { gte: startDate, lt: endDate },
      ...(organizationId ? { organizationId } : {}),
    },
  });

  const groups = groupInvocationLogs(logs);

  for (const group of groups) {
    await replaceAggregateGroup(prisma, group);
  }

  return {
    logsRead: logs.length,
    groupsWritten: groups.length,
  };
}

export async function backfillAiUsageDaily({
  prisma,
  days = 30,
}: {
  prisma: AiUsagePrisma;
  days?: number;
}): Promise<AggregateAiUsageResult> {
  const todayStart = utcDayStart(new Date());
  let totalLogsRead = 0;
  let totalGroupsWritten = 0;

  for (let i = 0; i < days; i++) {
    const dayStart = new Date(todayStart.getTime() - i * MS_PER_DAY);
    const dayEnd = new Date(dayStart.getTime() + MS_PER_DAY);
    const result = await aggregateAiUsageDaily({
      prisma,
      startDate: dayStart,
      endDate: dayEnd,
    });
    totalLogsRead += result.logsRead;
    totalGroupsWritten += result.groupsWritten;
  }

  return {
    logsRead: totalLogsRead,
    groupsWritten: totalGroupsWritten,
  };
}
