import { initTracing } from '@tellann/telemetry';
initTracing('code-intelligence-worker');
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { PrismaClient } from '@tellann/db';
import { createStorageClient } from '@tellann/storage';
import { analyzeCodebase } from '@tellann/project-intelligence';
import { createGraphStore } from '@tellann/code-graph';

const prisma = new PrismaClient();
const storage = createStorageClient();
const graph = createGraphStore();
const workerId = `${os.hostname()}:${process.pid}`;
let stopping = false;

type Archive = { format: 'tellann-codebase-v1'; files: Array<{ path: string; sha256: string; contentBase64: string }> };
const safeMessage = (error: unknown) => (error instanceof Error ? error.message : 'Analysis failed').replace(/[A-Za-z]:[\\/][^\s]+/g, '[workspace]').slice(0, 1_000);

function extractArchive(buffer: Buffer): string {
  const archive = JSON.parse(zlib.gunzipSync(buffer).toString('utf8')) as Archive;
  if (archive.format !== 'tellann-codebase-v1' || !Array.isArray(archive.files)) throw new Error('INVALID_SOURCE_ARCHIVE');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tellann-codebase-'));
  for (const file of archive.files) {
    const normalized = file.path.replaceAll('\\', '/');
    if (!normalized || normalized.startsWith('/') || normalized.includes('../') || path.isAbsolute(normalized)) throw new Error('UNSAFE_SOURCE_ARCHIVE_PATH');
    const content = Buffer.from(file.contentBase64, 'base64');
    if (crypto.createHash('sha256').update(content).digest('hex') !== file.sha256) throw new Error('SOURCE_FILE_CHECKSUM_MISMATCH');
    const target = path.join(root, ...normalized.split('/'));
    fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, content);
  }
  return root;
}

async function processOne(): Promise<boolean> {
  const queued = await (prisma as any).codebaseAnalysisJob.findFirst({ where: { status: 'QUEUED', scheduledAt: { lte: new Date() } }, orderBy: { scheduledAt: 'asc' }, include: { codebaseSnapshot: { include: { sourceArchive: true } } } });
  if (!queued?.codebaseSnapshot?.sourceArchive?.objectKey) return false;
  const claimed = await (prisma as any).codebaseAnalysisJob.updateMany({ where: { id: queued.id, status: 'QUEUED' }, data: { status: 'INGESTING', progress: 5, stageMessage: 'Downloading encrypted source snapshot', startedAt: new Date(), heartbeatAt: new Date(), leaseOwner: workerId, leaseExpiresAt: new Date(Date.now() + 5 * 60_000), attempt: { increment: 1 } } });
  if (!claimed.count) return true;
  let root: string | null = null;
  try {
    root = extractArchive(await storage.download(queued.codebaseSnapshot.sourceArchive.objectKey));
    const analysis = analyzeCodebase(root, queued.codebaseSnapshot.workspaceId, queued.codebaseSnapshot.repositoryFingerprint, async (status, progress, stageMessage) => {
      await (prisma as any).codebaseAnalysisJob.updateMany({ where: { id: queued.id, status: { not: 'CANCELLED' } }, data: { status, progress, stageMessage, heartbeatAt: new Date(), leaseExpiresAt: new Date(Date.now() + 5 * 60_000) } });
    });
    const projections = ['entities','relationships','features','findings'].map((kind) => ({ kind, payload: (analysis as any)[kind] ?? [], checksum: crypto.createHash('sha256').update(JSON.stringify((analysis as any)[kind] ?? [])).digest('hex') }));
    for (const projection of projections) await (prisma as any).analysisProjection.upsert({ where: { jobId_kind: { jobId: queued.id, kind: projection.kind } }, create: { jobId: queued.id, ...projection }, update: projection });
    if (graph) await graph.replace({ organizationId: queued.organizationId, applicationId: queued.applicationId, snapshotId: queued.codebaseSnapshotId, graphVersion: analysis.graphVersion }, analysis.entities, analysis.relationships);
    await (prisma as any).codebaseAnalysisJob.update({ where: { id: queued.id }, data: { status: analysis.status, progress: 100, stageMessage: analysis.stageMessage, completedAt: new Date(), leaseOwner: null, leaseExpiresAt: null, entityCount: analysis.entities.length, relationshipCount: analysis.relationships.length, featureCount: analysis.features.length, resultSummary: analysis.summary, graphVersion: analysis.graphVersion } });
    await (prisma as any).codebaseSnapshot.update({ where: { id: queued.codebaseSnapshotId }, data: { graphVersion: analysis.graphVersion, analyzerVersions: analysis.analyzerVersions } });
  } catch (error) {
    const retry = queued.attempt + 1 < queued.maxAttempts;
    await (prisma as any).codebaseAnalysisJob.update({ where: { id: queued.id }, data: retry ? { status: 'QUEUED', scheduledAt: new Date(Date.now() + 30_000 * 2 ** queued.attempt), stageMessage: 'Retry scheduled', errorMessageSafe: safeMessage(error), leaseOwner: null, leaseExpiresAt: null } : { status: 'FAILED', completedAt: new Date(), stageMessage: 'Analysis failed', errorCodeSafe: 'ANALYSIS_FAILED', errorMessageSafe: safeMessage(error), leaseOwner: null, leaseExpiresAt: null } });
  } finally { if (root) fs.rmSync(root, { recursive: true, force: true }); }
  return true;
}

async function tick() { if (stopping) return; try { while (await processOne()) { /* drain bounded queue serially */ } } catch (error) { console.error('[code-intelligence-worker]', safeMessage(error)); } }
const timer = setInterval(() => void tick(), 3_000); void tick();
async function maintain() {
  const expired = await (prisma as any).codebaseAnalysisJob.findMany({ where: { leaseExpiresAt: { lt: new Date() }, status: { in: ['INGESTING','PARSING','LINKING','GRAPHING','DISCOVERING_FEATURES','ANALYZING_ARCHITECTURE','SUMMARIZING'] } }, take: 50 });
  for (const job of expired) await (prisma as any).codebaseAnalysisJob.update({ where: { id: job.id }, data: { status: job.attempt < job.maxAttempts ? 'QUEUED' : 'FAILED', scheduledAt: new Date(), leaseOwner: null, leaseExpiresAt: null, stageMessage: job.attempt < job.maxAttempts ? 'Recovered after worker interruption' : 'Analysis lease expired too many times', errorCodeSafe: job.attempt < job.maxAttempts ? null : 'LEASE_EXPIRED' } });
  const archives = await (prisma as any).sourceArchive.findMany({ where: { retentionUntil: { lt: new Date() }, status: 'READY' }, take: 25 });
  for (const archive of archives) {
    if (archive.objectKey) await storage.delete(archive.objectKey).catch(() => undefined);
    await (prisma as any).sourceArchive.update({ where: { id: archive.id }, data: { status: 'DELETED', deletedAt: new Date(), objectKey: null } });
    if (archive.objectKey) await prisma.storageLedgerEntry.updateMany({ where: { objectKey: archive.objectKey }, data: { deletedAt: new Date() } });
  }
}
const maintenanceTimer = setInterval(() => void maintain().catch((error) => console.error('[code-intelligence-maintenance]', safeMessage(error))), 60_000);
for (const signal of ['SIGINT','SIGTERM'] as const) process.on(signal, () => { stopping = true; clearInterval(timer); clearInterval(maintenanceTimer); void prisma.$disconnect().finally(() => process.exit(0)); });
