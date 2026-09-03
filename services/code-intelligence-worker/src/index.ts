import { initTracing } from '@tellann/telemetry';
initTracing('code-intelligence-worker');
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { PrismaClient } from '@tellann/db';
import { createStorageClient, decryptArchive } from '@tellann/storage';
import {
  analyzeCodebase, buildFeatureEvidenceBundle, testNamesForFeature,
} from '@tellann/project-intelligence';
import type { CodebaseAnalysis } from '@tellann/desktop-contracts';
import { createGraphStore } from '@tellann/code-graph';
import { explainFeatures } from '@tellann/ai';

const prisma = new PrismaClient();
const anyPrisma = prisma as any;
const storage = createStorageClient();
const graph = createGraphStore();
const workerId = `${os.hostname()}:${process.pid}`;
const LEASE_MS = 5 * 60_000;
const ACTIVE_STATUSES = [
  'INGESTING', 'PARSING', 'LINKING', 'GRAPHING',
  'DISCOVERING_FEATURES', 'ANALYZING_ARCHITECTURE', 'SUMMARIZING',
];

let stopping = false;

type Archive = { format: 'tellann-codebase-v1'; files: Array<{ path: string; sha256: string; contentBase64: string }> };

/** Strip anything that could leak a local path or a credential into the UI. */
const safeMessage = (error: unknown): string =>
  (error instanceof Error ? error.message : 'Analysis failed')
    .replace(/[A-Za-z]:[\\/][^\s]+/g, '[workspace]')
    .replace(/\/(?:home|Users|tmp|var)\/[^\s]+/g, '[workspace]')
    .slice(0, 1_000);

function extractArchive(buffer: Buffer): string {
  const archive = JSON.parse(zlib.gunzipSync(buffer).toString('utf8')) as Archive;
  if (archive.format !== 'tellann-codebase-v1' || !Array.isArray(archive.files)) {
    throw new Error('INVALID_SOURCE_ARCHIVE');
  }
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tellann-codebase-'));
  const resolvedRoot = fs.realpathSync(root);
  for (const file of archive.files) {
    const normalized = file.path.replaceAll('\\', '/');
    if (!normalized || normalized.startsWith('/') || normalized.split('/').includes('..') || path.isAbsolute(normalized)) {
      throw new Error('UNSAFE_SOURCE_ARCHIVE_PATH');
    }
    const content = Buffer.from(file.contentBase64, 'base64');
    if (crypto.createHash('sha256').update(content).digest('hex') !== file.sha256) {
      throw new Error('SOURCE_FILE_CHECKSUM_MISMATCH');
    }
    const target = path.join(resolvedRoot, ...normalized.split('/'));
    // Belt and braces: confirm the resolved destination is still inside root.
    if (!target.startsWith(resolvedRoot + path.sep)) throw new Error('UNSAFE_SOURCE_ARCHIVE_PATH');
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  }
  return resolvedRoot;
}

async function cancelled(jobId: string): Promise<boolean> {
  const job = await anyPrisma.codebaseAnalysisJob.findUnique({
    where: { id: jobId },
    select: { status: true, cancellationRequestedAt: true },
  });
  return !job || job.status === 'CANCELLED' || Boolean(job.cancellationRequestedAt);
}

async function recordStage(jobId: string, stage: string, progress: number, attempt: number): Promise<void> {
  await anyPrisma.analysisStageRun.create({
    data: { jobId, stage, status: 'COMPLETED', progress, attempt, completedAt: new Date() },
  }).catch(() => undefined);
}

async function processOne(): Promise<boolean> {
  const queued = await anyPrisma.codebaseAnalysisJob.findFirst({
    where: { status: 'QUEUED', scheduledAt: { lte: new Date() } },
    orderBy: { scheduledAt: 'asc' },
    include: { codebaseSnapshot: { include: { sourceArchive: true } } },
  });
  if (!queued) return false;

  const archiveRecord = queued.codebaseSnapshot?.sourceArchive;
  if (!archiveRecord?.objectKey || archiveRecord.status !== 'READY') {
    await anyPrisma.codebaseAnalysisJob.update({
      where: { id: queued.id },
      data: {
        status: 'FAILED',
        completedAt: new Date(),
        stageMessage: 'The source snapshot for this analysis is no longer available',
        errorCodeSafe: 'SOURCE_ARCHIVE_UNAVAILABLE',
      },
    });
    return true;
  }

  // Atomic claim: only one worker can move a job out of QUEUED.
  const claimed = await anyPrisma.codebaseAnalysisJob.updateMany({
    where: { id: queued.id, status: 'QUEUED' },
    data: {
      status: 'INGESTING',
      progress: 5,
      stageMessage: 'Downloading the encrypted source snapshot',
      startedAt: new Date(),
      heartbeatAt: new Date(),
      leaseOwner: workerId,
      leaseExpiresAt: new Date(Date.now() + LEASE_MS),
      attempt: { increment: 1 },
      errorCodeSafe: null,
      errorMessageSafe: null,
    },
  });
  if (!claimed.count) return true;

  const attempt = queued.attempt + 1;
  let root: string | null = null;
  try {
    const stored = await storage.download(archiveRecord.objectKey);
    root = extractArchive(decryptArchive(stored));

    let lastStage = '';
    const result = analyzeCodebase(
      root,
      queued.codebaseSnapshot.workspaceId,
      queued.codebaseSnapshot.repositoryFingerprint,
      {
        budgetMs: Number(process.env.CODEBASE_ANALYSIS_BUDGET_MS ?? 10 * 60_000),
        onProgress: (status, progress, stageMessage) => {
          if (status === lastStage) return;
          lastStage = status;
          // Progress writes are fire-and-forget: the analysis must not stall
          // waiting on a status update, and the lease sweep covers a lost one.
          void anyPrisma.codebaseAnalysisJob.updateMany({
            where: { id: queued.id, status: { not: 'CANCELLED' } },
            data: {
              status,
              progress,
              stageMessage,
              heartbeatAt: new Date(),
              leaseExpiresAt: new Date(Date.now() + LEASE_MS),
            },
          }).catch(() => undefined);
          void recordStage(queued.id, status, progress, attempt);
        },
      },
    );

    if (await cancelled(queued.id)) return true;

    const analysis: CodebaseAnalysis = result.analysis;

    // Readable feature descriptions, from bounded evidence only. A provider
    // outage leaves the deterministic descriptions in place.
    try {
      const bundles = analysis.features
        .slice(0, Number(process.env.CODEBASE_AI_MAX_FEATURES ?? 120))
        .map((feature) => buildFeatureEvidenceBundle(analysis, feature, testNamesForFeature(analysis, feature)));
      const explanations = await explainFeatures(bundles, {
        maxFeatures: Number(process.env.CODEBASE_AI_MAX_FEATURES ?? 120),
      });
      analysis.explanations = explanations;
      const byId = new Map(explanations.filter((item) => item.grounded).map((item) => [item.featureId, item]));
      for (const feature of analysis.features) {
        const explanation = byId.get(feature.id);
        if (!explanation) continue;
        feature.name = explanation.name;
        feature.description = explanation.description;
      }
    } catch (error) {
      await anyPrisma.analysisWarning.create({
        data: {
          jobId: queued.id,
          code: 'AI_PROVIDER_UNAVAILABLE',
          severity: 'INFO',
          message: `Feature descriptions fell back to deterministic text: ${safeMessage(error)}`,
        },
      }).catch(() => undefined);
    }

    await prisma.$transaction(async (tx) => {
      const anyTx = tx as any;
      // The whole analysis is one projection; the slices beside it let a view
      // read a single collection without rehydrating everything.
      const projections = [
        { kind: 'analysis', payload: analysis },
        { kind: 'features', payload: analysis.features },
        { kind: 'findings', payload: analysis.findings },
        { kind: 'architecture', payload: analysis.architecture },
      ];
      for (const projection of projections) {
        await anyTx.analysisProjection.upsert({
          where: { jobId_kind: { jobId: queued.id, kind: projection.kind } },
          create: {
            jobId: queued.id,
            kind: projection.kind,
            payload: projection.payload as object,
            checksum: crypto.createHash('sha256').update(JSON.stringify(projection.payload ?? null)).digest('hex'),
          },
          update: {
            payload: projection.payload as object,
            checksum: crypto.createHash('sha256').update(JSON.stringify(projection.payload ?? null)).digest('hex'),
          },
        });
      }
      for (const [analyzer, version] of Object.entries(analysis.analyzerVersions)) {
        await anyTx.analyzerRun.create({
          data: {
            jobId: queued.id,
            analyzer,
            version,
            status: 'COMPLETED',
            inputCount: analysis.coverage?.analyzedFiles ?? 0,
            outputCount: analysis.entities.length,
          },
        });
      }
      for (const message of analysis.warnings) {
        await anyTx.analysisWarning.create({
          data: { jobId: queued.id, code: 'ANALYSIS_WARNING', severity: 'WARNING', message: message.slice(0, 1_000) },
        });
      }
    });

    let graphStatus: CodebaseAnalysis['status'] = analysis.status;
    if (graph) {
      try {
        const scope = {
          organizationId: queued.organizationId,
          applicationId: queued.applicationId,
          snapshotId: queued.codebaseSnapshotId,
          graphVersion: analysis.graphVersion,
        };
        await graph.replace(scope, analysis.entities, analysis.relationships);
        await graph.deleteOtherVersions(scope).catch(() => 0);
      } catch (error) {
        graphStatus = 'PARTIAL';
        await anyPrisma.analysisWarning.create({
          data: {
            jobId: queued.id,
            code: 'GRAPH_STORE_UNAVAILABLE',
            severity: 'WARNING',
            message: safeMessage(error),
          },
        }).catch(() => undefined);
      }
    }

    await anyPrisma.codebaseAnalysisJob.update({
      where: { id: queued.id },
      data: {
        status: graphStatus,
        progress: 100,
        stageMessage: graphStatus === 'PARTIAL'
          ? 'Analysis completed with warnings'
          : 'Analysis completed',
        completedAt: new Date(),
        leaseOwner: null,
        leaseExpiresAt: null,
        entityCount: analysis.entities.length,
        relationshipCount: analysis.relationships.length,
        featureCount: analysis.features.length,
        resultSummary: analysis.summary,
        graphVersion: analysis.graphVersion,
      },
    });
    await anyPrisma.codebaseSnapshot.update({
      where: { id: queued.codebaseSnapshotId },
      data: { graphVersion: analysis.graphVersion, analyzerVersions: analysis.analyzerVersions },
    });
  } catch (error) {
    const retry = attempt < queued.maxAttempts;
    await anyPrisma.codebaseAnalysisJob.update({
      where: { id: queued.id },
      data: retry
        ? {
          status: 'QUEUED',
          scheduledAt: new Date(Date.now() + 30_000 * 2 ** queued.attempt),
          stageMessage: 'Retry scheduled after a failed attempt',
          errorMessageSafe: safeMessage(error),
          leaseOwner: null,
          leaseExpiresAt: null,
        }
        : {
          status: 'FAILED',
          completedAt: new Date(),
          stageMessage: 'Analysis failed',
          errorCodeSafe: 'ANALYSIS_FAILED',
          errorMessageSafe: safeMessage(error),
          leaseOwner: null,
          leaseExpiresAt: null,
        },
    });
  } finally {
    if (root) fs.rmSync(root, { recursive: true, force: true });
  }
  return true;
}

async function tick(): Promise<void> {
  if (stopping) return;
  try {
    // Drain serially: analysis is CPU-bound and two at once helps nobody.
    while (!stopping && await processOne()) { /* keep draining */ }
  } catch (error) {
    console.error('[code-intelligence-worker]', safeMessage(error));
  }
}

/**
 * Recover work abandoned by a crashed worker, and delete source archives whose
 * retention window has passed.
 */
async function maintain(): Promise<void> {
  const expired = await anyPrisma.codebaseAnalysisJob.findMany({
    where: { leaseExpiresAt: { lt: new Date() }, status: { in: ACTIVE_STATUSES } },
    take: 50,
  });
  for (const job of expired) {
    const canRetry = job.attempt < job.maxAttempts;
    await anyPrisma.codebaseAnalysisJob.update({
      where: { id: job.id },
      data: {
        status: canRetry ? 'QUEUED' : 'FAILED',
        scheduledAt: new Date(),
        leaseOwner: null,
        leaseExpiresAt: null,
        stageMessage: canRetry
          ? 'Recovered after a worker interruption'
          : 'The analysis lease expired too many times',
        errorCodeSafe: canRetry ? null : 'LEASE_EXPIRED',
        ...(canRetry ? {} : { completedAt: new Date() }),
      },
    });
  }

  const archives = await anyPrisma.sourceArchive.findMany({
    where: { retentionUntil: { lt: new Date() }, status: 'READY' },
    take: 25,
    include: { codebaseSnapshot: { select: { id: true, organizationId: true, applicationId: true, graphVersion: true } } },
  });
  for (const archive of archives) {
    const objectKey = archive.objectKey;
    if (objectKey) await storage.delete(objectKey).catch(() => undefined);
    await anyPrisma.sourceArchive.update({
      where: { id: archive.id },
      data: { status: 'DELETED', deletedAt: new Date(), objectKey: null },
    });
    if (objectKey) {
      await prisma.storageLedgerEntry.updateMany({
        where: { objectKey },
        data: { deletedAt: new Date() },
      }).catch(() => undefined);
    }
    console.warn(`[code-intelligence-worker] Deleted expired source archive for snapshot ${archive.codebaseSnapshotId}`);
  }

  // Graph versions left behind by a superseded snapshot.
  if (graph) {
    const orphans = await anyPrisma.codebaseSnapshot.findMany({
      where: { sourceArchive: { status: 'DELETED' }, graphVersion: { not: null } },
      take: 10,
      select: { id: true, organizationId: true, applicationId: true, graphVersion: true },
    });
    for (const snapshot of orphans) {
      const stillReferenced = await anyPrisma.codebaseAnalysisJob.count({
        where: { codebaseSnapshotId: snapshot.id, status: { in: ['COMPLETED', 'PARTIAL'] } },
      });
      if (stillReferenced) continue;
      await graph.delete({
        organizationId: snapshot.organizationId,
        applicationId: snapshot.applicationId,
        snapshotId: snapshot.id,
        graphVersion: snapshot.graphVersion ?? '',
      }).catch(() => undefined);
    }
  }
}

const timer = setInterval(() => void tick(), 3_000);
void tick();
const maintenanceTimer = setInterval(
  () => void maintain().catch((error) => console.error('[code-intelligence-maintenance]', safeMessage(error))),
  60_000,
);
void maintain().catch(() => undefined);

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    stopping = true;
    clearInterval(timer);
    clearInterval(maintenanceTimer);
    void prisma.$disconnect().finally(() => process.exit(0));
  });
}
