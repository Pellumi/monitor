import { initTracing } from '@sots/telemetry';
initTracing('background-workers');

import { PrismaClient, aggregateAiUsageDaily, utcDayStart } from '@sots/db';
import { generateAiFlowDraft, resolveAiProvider, sanitizeAiInputFull } from '@sots/ai';
import { runRuleCandidatePromoter } from './rule-candidate-promoter';
import {
  runWeeklyReportDigest,
  runCoverageAlertDigest,
  runRuleCandidateAdminDigest,
} from './digest-workers';
import { runCrossTenantIndexBuilder } from './cross-tenant-index-builder';
import { runRetentionSweep } from './retention-worker';
import { applyScheduledSubscriptionChanges } from './subscription-change-worker';
import { processBillingDunning } from './billing-dunning-worker';
import { processDocumentJobs } from './document-processing-worker';
import { createMetricsRegistry, createHttpMetricsMiddleware } from '@sots/shared';
import http from 'http';
import { createHash } from 'crypto';
import { validateGeneratedGraph } from '@sots/graph-validation';

const prisma = new PrismaClient();

// Gap 8: Prometheus metrics for background-workers
const metrics = createMetricsRegistry('background-workers');

// ─────────────────────────────────────────────────────────────
// Worker: ai-draft-job-processor (Gap 8)
// Schedule: Every 5 seconds
// Polls AIFlowDraftJob, processes queued jobs asynchronously
// ─────────────────────────────────────────────────────────────

export async function runAiDraftJobProcessor(): Promise<void> {
  const MAX_BATCH = 3; // process up to 3 jobs per tick

  try {
    // Claim up to MAX_BATCH QUEUED jobs atomically (update to PROCESSING)
    const queuedJobs = await (prisma as any).aIFlowDraftJob.findMany({
      where: {
        status: 'QUEUED',
        scheduledAt: { lte: new Date() },
        attempts: { lt: 3 },
      },
      take: 25,
      orderBy: { scheduledAt: 'asc' },
    });
    const organizationIds = [...new Set(queuedJobs.map((job: any) => job.organizationId))] as string[];
    const subscriptions = await prisma.subscription.findMany({
      where: { organizationId: { in: organizationIds } },
      include: { plan: true },
    });
    const priorityOrganizations = new Set(
      subscriptions.filter((subscription) => ['BUSINESS', 'ENTERPRISE'].includes(subscription.plan.type)).map((subscription) => subscription.organizationId),
    );
    const jobs = queuedJobs
      .sort((left: any, right: any) =>
        Number(priorityOrganizations.has(right.organizationId)) - Number(priorityOrganizations.has(left.organizationId))
        || left.scheduledAt.getTime() - right.scheduledAt.getTime())
      .slice(0, MAX_BATCH);

    if (jobs.length === 0) return;

    await Promise.all(jobs.map(async (job: any) => {
      // Claim only if the job is still queued. This prevents duplicate workers
      // and user cancellation from being overwritten after the initial read.
      const claim = await (prisma as any).aIFlowDraftJob.updateMany({
        where: { id: job.id, status: 'QUEUED' },
        data: { status: 'PROCESSING', startedAt: new Date(), attempts: { increment: 1 } },
      });
      if (claim.count !== 1) return;

      try {
        // Load rulesets for the domain
        const { getActiveRulesets, generateRuleBasedFlow } = await import('@sots/rules');
        const rulesets = await getActiveRulesets({
          organizationId: job.organizationId,
          applicationId: job.applicationId,
          domainKey: job.domainKey,
          prisma,
        });

        // Run AI generation (productDescription is already sanitized/redacted)
        let result;
        try {
          result = await generateAiFlowDraft({
            productDescription: job.productDescription,
            domainKey: job.domainKey,
            rulesets,
            provider: resolveAiProvider(),
          });
        } catch (providerError) {
          const fallbackDraft = await generateRuleBasedFlow({
            domainKey: job.domainKey,
            productDescription: job.productDescription,
            rulesets,
          });
          result = {
            draft: { ...fallbackDraft, source: 'HYBRID' as const },
            provider: 'rule-engine-fallback',
            model: 'ruleset-fallback-v1',
            promptHash: createHash('sha256')
              .update(JSON.stringify({ description: job.productDescription, domainKey: job.domainKey }))
              .digest('hex'),
            validation: validateGeneratedGraph({ workflows: fallbackDraft.workflows }),
          };
          console.warn(`[ai-draft-job-processor] Provider unavailable for ${job.id}; used rules fallback`,
            providerError instanceof Error ? providerError.message : 'Unknown provider error');
        }

        // Create the AIFlowDraft record
        const sanitized = sanitizeAiInputFull(job.productDescription);
        const draftRecord = await prisma.aIFlowDraft.create({
          data: {
            organizationId: job.organizationId,
            applicationId: job.applicationId,
            environmentId: job.environmentId ?? null,
            source: job.source as any,
            status: 'PENDING_REVIEW',
            productDescription: job.productDescription, // already redacted
            productDescriptionHash: sanitized.originalHash,
            inferredDomainKey: job.domainKey,
            rulesetVersionIds: job.rulesetVersionIds,
            promptHash: result.promptHash,
            provider: result.provider,
            model: result.model,
            draftJson: {
              ...result.draft,
              sourceManifest: job.sourceManifest ?? null,
              conflicts: (job.sourceManifest as any)?.conflicts ?? [],
              unresolvedQuestions: (job.sourceManifest as any)?.unresolvedQuestions ?? [],
            } as any,
            validationJson: result.validation as any,
            confidence: result.draft.confidence,
            sourceManifest: job.sourceManifest ?? undefined,
          },
        });

        const evidenceIds = Array.isArray((job.sourceManifest as any)?.evidenceIds)
          ? (job.sourceManifest as any).evidenceIds.filter((id: unknown) => typeof id === 'string')
          : [];
        if (evidenceIds.length) {
          await prisma.intentEvidence.updateMany({
            where: { id: { in: evidenceIds }, applicationId: job.applicationId, aiFlowDraftId: null },
            data: { aiFlowDraftId: draftRecord.id },
          });
        }

        // Mark job COMPLETED
        await (prisma as any).aIFlowDraftJob.update({
          where: { id: job.id },
          data: { status: 'COMPLETED', draftId: draftRecord.id, completedAt: new Date() },
        });

        console.log(`[ai-draft-job-processor] Job ${job.id} completed → draft ${draftRecord.id}`);
      } catch (err: any) {
        const isFinalAttempt = (job.attempts + 1) >= job.maxAttempts;
        const backoffMs = Math.pow(2, job.attempts) * 30_000; // 30s, 60s, 120s
        const nextSchedule = new Date(Date.now() + backoffMs);

        await (prisma as any).aIFlowDraftJob.update({
          where: { id: job.id },
          data: {
            status: isFinalAttempt ? 'FAILED' : 'QUEUED',
            errorMessage: err?.message ?? 'Unknown error',
            scheduledAt: isFinalAttempt ? undefined : nextSchedule,
          },
        });

        console.error(`[ai-draft-job-processor] Job ${job.id} ${isFinalAttempt ? 'FAILED permanently' : `retrying at ${nextSchedule.toISOString()}`}`, err?.message);
      }
    }));
  } catch (err) {
    console.error('[ai-draft-job-processor] Poll error', err);
  }
}



// ─────────────────────────────────────────────────────────────
// Worker: ai-draft-expiry-cleaner
// Schedule: Daily
// Deletes/archives stale AI flow drafts older than 30 days
// ─────────────────────────────────────────────────────────────

export async function runAiDraftExpiryCleaner(): Promise<void> {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  try {
    const result = await prisma.aIFlowDraft.updateMany({
      where: {
        status: 'PENDING_REVIEW',
        createdAt: { lt: cutoff },
      },
      data: { status: 'EXPIRED' },
    });
    console.log(`[ai-draft-expiry-cleaner] Archived ${result.count} stale drafts`);
  } catch (err) {
    console.error('[ai-draft-expiry-cleaner] Error', err);
  }
}

// ─────────────────────────────────────────────────────────────
// Worker: ruleset-feedback-analyzer
// Schedule: Daily
// Aggregates accepted/rejected feedback, produces candidate stats
// ─────────────────────────────────────────────────────────────

export async function runRulesetFeedbackAnalyzer(): Promise<void> {
  try {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const feedback = await prisma.ruleFeedback.findMany({
      where: { createdAt: { gte: yesterday } },
    });

    const stats = feedback.reduce<Record<string, { accepted: number; rejected: number }>>(
      (acc, item) => {
        const key = item.rulePatternId || 'unknown';
        acc[key] = acc[key] || { accepted: 0, rejected: 0 };
        if (item.feedbackType === 'ACCEPTED') acc[key].accepted++;
        if (item.feedbackType === 'REJECTED') acc[key].rejected++;
        return acc;
      },
      {},
    );

    console.log('[ruleset-feedback-analyzer] Daily feedback stats:', {
      totalFeedback: feedback.length,
      uniquePatterns: Object.keys(stats).length,
    });

    // Gap 2: Feedback loop complete — promoter runs separately 1h later
    // (see runRuleCandidatePromoter in rule-candidate-promoter.ts)
  } catch (err) {
    console.error('[ruleset-feedback-analyzer] Error', err);
  }
}

// ─────────────────────────────────────────────────────────────
// Worker: ruleset-cache-warmer
// Schedule: Every 10 minutes
// Warms active rulesets into the in-memory cache
// ─────────────────────────────────────────────────────────────

export async function runRulesetCacheWarmer(): Promise<void> {
  try {
    const { getActiveRulesets } = await import('@sots/rules');
    const { setCachedRulesets } = await import('@sots/rules');

    const activeDomains = await prisma.domain.findMany({
      where: { isActive: true },
      select: { key: true },
    });

    for (const domain of activeDomains) {
      try {
        const rulesets = await getActiveRulesets({ domainKey: domain.key, prisma });
        setCachedRulesets({ organizationId: null, domainKey: domain.key }, rulesets);
        console.log(`[ruleset-cache-warmer] Warmed domain: ${domain.key}`);
      } catch (domainErr) {
        console.warn(`[ruleset-cache-warmer] Failed to warm domain ${domain.key}`, domainErr);
      }
    }
  } catch (err) {
    console.error('[ruleset-cache-warmer] Error', err);
  }
}

// ─────────────────────────────────────────────────────────────
// Worker: ai-invocation-metrics-aggregator
// Schedule: Hourly
// Aggregates AI invocation stats → persists to AIUsageDailyAggregate
// ─────────────────────────────────────────────────────────────

export async function runAiMetricsAggregator(): Promise<void> {
  try {
    const now = new Date();
    const dayStart = utcDayStart(now);
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

    const result = await aggregateAiUsageDaily({
      prisma,
      startDate: dayStart,
      endDate: dayEnd,
    });

    if (result.logsRead === 0) {
      console.log('[ai-metrics-aggregator] No logs to aggregate for today');
      return;
    }

    console.log(
      `[ai-metrics-aggregator] Aggregated ${result.logsRead} logs into ${result.groupsWritten} daily aggregate rows for ${dayStart.toISOString().slice(0, 10)}`,
    );
  } catch (err) {
    console.error('[ai-invocation-metrics-aggregator] Error', err);
  }
}

// Job definitions - name, handler, and schedule

interface JobDefinition {
  name: string;
  handler: () => Promise<void>;
  /** Repeat interval in milliseconds (for every-N-ms jobs) */
  every?: number;
  /** Cron pattern (for cron-based jobs, mutually exclusive with `every`) */
  pattern?: string;
  /** Delay before first run in ms (for offset jobs like rule-candidate-promoter) */
  delay?: number;
}

const JOB_DEFINITIONS: JobDefinition[] = [
  { name: 'document-processing',              handler: () => processDocumentJobs(prisma).then(() => undefined), every: 3_000 },
  { name: 'ai-draft-job-processor',           handler: runAiDraftJobProcessor,      every: 5_000 },
  { name: 'ruleset-cache-warmer',             handler: runRulesetCacheWarmer,       every: 600_000 },
  { name: 'ai-invocation-metrics-aggregator', handler: runAiMetricsAggregator,      pattern: '0 * * * *' },   // hourly
  { name: 'ai-draft-expiry-cleaner',          handler: runAiDraftExpiryCleaner,     pattern: '0 2 * * *' },   // daily 2am
  { name: 'ruleset-feedback-analyzer',        handler: runRulesetFeedbackAnalyzer,  pattern: '0 3 * * *' },   // daily 3am
  { name: 'rule-candidate-promoter',          handler: runRuleCandidatePromoter,    pattern: '0 4 * * *' },   // daily 4am (1h after feedback)
  { name: 'weekly-report-digest',             handler: runWeeklyReportDigest,       pattern: '0 6 * * 1' },   // Monday 6am
  { name: 'coverage-alert-digest',            handler: runCoverageAlertDigest,      pattern: '0 7 * * *' },   // daily 7am
  { name: 'rule-candidate-admin-digest',      handler: runRuleCandidateAdminDigest, pattern: '0 8 * * *' },   // daily 8am
  { name: 'cross-tenant-index-builder',       handler: runCrossTenantIndexBuilder,  pattern: '0 1 * * 0' },   // Sunday 1am (weekly)
  { name: 'behavioral-data-retention',        handler: () => runRetentionSweep(prisma).then(() => undefined), pattern: '0 2 * * *' },
  { name: 'scheduled-subscription-changes',   handler: () => applyScheduledSubscriptionChanges(prisma).then(() => undefined), every: 60_000 },
  { name: 'billing-dunning',                  handler: () => processBillingDunning(prisma).then(() => undefined), every: 60_000 },
];

// ─────────────────────────────────────────────────────────────
// Fallback: setInterval scheduler (when REDIS_URL is not set)
// ─────────────────────────────────────────────────────────────

function every(
  ms: number,
  fn: () => Promise<void>,
  name: string,
  runImmediately = true,
): void {
  const run = async () => {
    try {
      await fn();
    } catch (err) {
      console.error(`[worker:${name}] Unhandled error`, err);
    }
  };
  if (runImmediately) {
    void run();
  }
  setInterval(run, ms);
}

function startWithSetInterval(): void {
  console.log('[background-workers] Using setInterval scheduler (no REDIS_URL)');
  for (const job of JOB_DEFINITIONS) {
    if (job.every) {
      every(job.every, job.handler, job.name);
    } else {
      // Cron-based jobs: approximate with 24h interval for local dev
      const intervalMs = job.pattern?.includes('* * 0') || job.pattern?.includes('* * 1')
        ? 7 * 24 * 60 * 60 * 1000  // weekly
        : 24 * 60 * 60 * 1000;     // daily
      if (job.delay) {
        setTimeout(() => every(intervalMs, job.handler, job.name), job.delay);
      } else {
        // Cron-style maintenance jobs should wait for their schedule. Running all
        // of them during local startup competes with document and draft processing.
        every(intervalMs, job.handler, job.name, false);
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────
// BullMQ scheduler + Bull Board (when REDIS_URL is available)
// ─────────────────────────────────────────────────────────────

async function startWithBullMQ(redisUrl: string): Promise<{ queues: any[] }> {
  const { Queue, Worker } = await import('bullmq');
  const { createBullBoard } = await import('@bull-board/api');
  const { BullMQAdapter } = await import('@bull-board/api/bullMQAdapter');
  const { ExpressAdapter } = await import('@bull-board/express');

  const connection = { url: redisUrl };

  // Create one queue per job for fine-grained Bull Board visibility
  const queues: InstanceType<typeof Queue>[] = [];
  const bullBoardAdapters: InstanceType<typeof BullMQAdapter>[] = [];

  for (const job of JOB_DEFINITIONS) {
    const queue = new Queue(job.name, {
      connection,
      defaultJobOptions: {
        removeOnComplete: { count: 100 },  // keep last 100 completed
        removeOnFail: { count: 200 },      // keep last 200 failed
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
      },
    });
    queues.push(queue);
    bullBoardAdapters.push(new BullMQAdapter(queue));

    // Register repeatable job schedule
    if (job.every) {
      await queue.upsertJobScheduler(
        `${job.name}-scheduler`,
        { every: job.every },
        { name: job.name },
      );
    } else if (job.pattern) {
      await queue.upsertJobScheduler(
        `${job.name}-scheduler`,
        { pattern: job.pattern },
        { name: job.name },
      );
    }

    // Create a worker for each queue
    const worker = new Worker(
      job.name,
      async () => {
        await job.handler();
      },
      {
        connection,
        concurrency: 1,
        limiter: { max: 1, duration: 1000 },
      },
    );

    worker.on('completed', (bullJob) => {
      console.log(`[bullmq:${job.name}] Job ${bullJob.id} completed`);
    });

    worker.on('failed', (bullJob, err) => {
      console.error(`[bullmq:${job.name}] Job ${bullJob?.id} failed:`, err.message);
    });

    console.log(`[bullmq] Registered: ${job.name}`);
  }

  // Set up Bull Board express adapter
  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath('/admin/jobs');

  createBullBoard({
    queues: bullBoardAdapters,
    serverAdapter,
  });

  return { queues };
}

// ─────────────────────────────────────────────────────────────
// Entry point
// ─────────────────────────────────────────────────────────────

async function main() {
  console.log('[background-workers] Starting...');

  const redisUrl = process.env.REDIS_URL;
  let bullBoardMiddleware: any = null;

  if (redisUrl) {
    console.log('[background-workers] REDIS_URL detected — using BullMQ persistent scheduler');
    const { queues } = await startWithBullMQ(redisUrl);

    // Get Bull Board middleware for the HTTP server
    const { ExpressAdapter } = await import('@bull-board/express');
    const { createBullBoard } = await import('@bull-board/api');
    const { BullMQAdapter } = await import('@bull-board/api/bullMQAdapter');
    const { Queue } = await import('bullmq');

    // Create Bull Board express app for the admin UI
    const express = (await import('express')).default;
    const boardApp = express();

    const serverAdapter = new ExpressAdapter();
    serverAdapter.setBasePath('/admin/jobs');

    const boardQueues = JOB_DEFINITIONS.map((job) =>
      new BullMQAdapter(new Queue(job.name, { connection: { url: redisUrl } }))
    );

    createBullBoard({
      queues: boardQueues,
      serverAdapter,
    });

    boardApp.use('/admin/jobs', serverAdapter.getRouter());
    bullBoardMiddleware = boardApp;
  } else {
    startWithSetInterval();
  }

  // ── Prometheus /metrics + Bull Board server ───────────────────
  // 3020 is reserved by the marketing/docs dev surface in the monorepo.
  const metricsPort = parseInt(process.env.BACKGROUND_WORKERS_METRICS_PORT ?? '3022', 10);

  if (bullBoardMiddleware) {
    // Use express to serve both /metrics and /admin/jobs
    const express = (await import('express')).default;
    const app = express();

    // Health check
    app.get('/health', (_req: any, res: any) => {
      res.json({ status: 'ok', scheduler: 'bullmq' });
    });

    // Prometheus metrics
    app.get('/metrics', async (req: any, res: any) => {
      await metrics.metricsHandler(req, res);
    });

    // Bull Board admin UI
    app.use(bullBoardMiddleware);

    app.listen(metricsPort, () => {
      console.log(`[background-workers] /metrics + /admin/jobs listening on port ${metricsPort}`);
    });
  } else {
    // Fallback: raw http server (no Bull Board)
    const metricsServer = http.createServer(async (req, res) => {
      if (req.url === '/metrics' && req.method === 'GET') {
        await metrics.metricsHandler(req, res);
      } else if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', scheduler: 'setInterval' }));
      } else {
        res.writeHead(404);
        res.end();
      }
    });
    metricsServer.listen(metricsPort, () => {
      console.log(`[background-workers] /metrics listening on port ${metricsPort}`);
    });
  }

  console.log('[background-workers] All workers scheduled');
}

main().catch((err) => {
  console.error('[background-workers] Fatal error', err);
  process.exit(1);
});
