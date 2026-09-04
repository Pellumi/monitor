import crypto from 'node:crypto';
import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import type { PrismaClient } from '@tellann/db';
import type { StorageClient } from '@tellann/storage';
import {
  ARCHIVE_ENCRYPTION_NONE, decryptArchive, encryptArchive,
  isArchiveEncryptionConfigured, resolveRetentionDays, retentionDeadline,
} from '@tellann/storage';
import {
  CodebaseAnalysisSchema, GraphProjectionQuerySchema,
  type CodebaseAnalysis, type CodeEntity, type CodeRelationship,
} from '@tellann/desktop-contracts';
import {
  answerFromAnalysis, blastRadiusInAnalysis, compareAnalyses, describeEntity,
  hierarchyChildren, projectAnalysis, retrieveFeatures, shortestPathInAnalysis,
} from '@tellann/project-intelligence';
import { createGraphStore } from '@tellann/code-graph';
import { explainFeatures } from '@tellann/ai';
import { Feature } from '@tellann/shared';
import type { EntitlementChecker } from '@tellann/entitlement-checker';

type DesktopRequest = Request & { user?: { id: string; email: string } };
type Middleware = (req: DesktopRequest, res: Response, next: NextFunction) => unknown;

const ACTIVE_STATUSES = [
  'QUEUED', 'INGESTING', 'PARSING', 'LINKING', 'GRAPHING',
  'DISCOVERING_FEATURES', 'ANALYZING_ARCHITECTURE', 'SUMMARIZING',
] as const;

const TERMINAL_STATUSES = ['COMPLETED', 'PARTIAL', 'FAILED', 'CANCELLED'] as const;

/** Upload chunk ceiling. Keeps any single request well under the body limit. */
const MAX_PART_BYTES = 4 * 1024 * 1024;
const MAX_ARCHIVE_BYTES = 64 * 1024 * 1024;
const MAX_UPLOAD_PARTS = 64;

/**
 * In-flight chunked uploads, held in memory between `initiate` and `complete`.
 * Abandoned entries are swept on a timer rather than left to accumulate.
 */
type PendingUpload = {
  uploadId: string;
  applicationId: string;
  organizationId: string;
  userId: string;
  workspaceId: string;
  totalParts: number;
  contentHash: string;
  parts: Map<number, Buffer>;
  bytes: number;
  createdAt: number;
};

const UPLOAD_TTL_MS = 30 * 60_000;

/**
 * Reconstructed analyses, keyed by job. Rebuilding a large analysis from its
 * stored projections on every request would dominate the response time of the
 * views that read it.
 */
class AnalysisCache {
  private readonly entries = new Map<string, { analysis: CodebaseAnalysis; at: number }>();

  constructor(private readonly max = 8, private readonly ttlMs = 5 * 60_000) {}

  get(jobId: string): CodebaseAnalysis | null {
    const entry = this.entries.get(jobId);
    if (!entry) return null;
    if (Date.now() - entry.at > this.ttlMs) {
      this.entries.delete(jobId);
      return null;
    }
    return entry.analysis;
  }

  set(jobId: string, analysis: CodebaseAnalysis): void {
    if (this.entries.size >= this.max) {
      const oldest = [...this.entries.entries()].sort((left, right) => left[1].at - right[1].at)[0];
      if (oldest) this.entries.delete(oldest[0]);
    }
    this.entries.set(jobId, { analysis, at: Date.now() });
  }

  invalidate(jobId: string): void {
    this.entries.delete(jobId);
  }
}

const paginate = <T>(items: T[], req: DesktopRequest): { items: T[]; total: number; offset: number; limit: number } => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 1_000);
  const offset = Math.max(Number(req.query.offset) || 0, 0);
  return { items: items.slice(offset, offset + limit), total: items.length, offset, limit };
};

export function createCodebaseRouter(input: {
  prisma: PrismaClient;
  verifyJwt: Middleware;
  verifyAppOwnership: Middleware;
  storage: StorageClient;
  /** Omitted only by tests that exercise the routes in isolation. */
  entitlementChecker?: EntitlementChecker;
}) {
  const { prisma, verifyJwt, verifyAppOwnership, storage, entitlementChecker } = input;
  const router = Router();
  const codeGraph = createGraphStore();
  const analyses = new AnalysisCache();
  const uploads = new Map<string, PendingUpload>();
  const anyPrisma = prisma as any;

  const sweep = setInterval(() => {
    const cutoff = Date.now() - UPLOAD_TTL_MS;
    for (const [id, upload] of uploads) if (upload.createdAt < cutoff) uploads.delete(id);
  }, 60_000);
  sweep.unref?.();

  /**
   * Codebase intelligence is a paid capability, so every route below is gated on
   * the owning organisation's entitlement as well as on ownership.
   */
  const requireEntitlement: Middleware = async (req, res, next) => {
    if (!entitlementChecker) return next();
    const organizationId = await organizationFor(req.params.appId);
    if (!organizationId) return res.status(404).json({ error: 'Application not found' });
    if (!await entitlementChecker.canAccess(organizationId, Feature.CODEBASE_INTELLIGENCE)) {
      return res.status(403).json({ error: 'FEATURE_NOT_ENTITLED', feature: Feature.CODEBASE_INTELLIGENCE });
    }
    return next();
  };
  const guarded = [verifyJwt, verifyAppOwnership, requireEntitlement];

  async function organizationFor(applicationId: string): Promise<string | null> {
    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      select: { organizationId: true },
    });
    return application?.organizationId ?? null;
  }

  async function latestJob(applicationId: string, statuses?: readonly string[]) {
    return anyPrisma.codebaseAnalysisJob.findFirst({
      where: { applicationId, ...(statuses ? { status: { in: statuses } } : {}) },
      orderBy: { createdAt: 'desc' },
      include: { codebaseSnapshot: true },
    });
  }

  /** Rebuild a full analysis from its stored projections. */
  async function loadAnalysis(jobId: string): Promise<CodebaseAnalysis | null> {
    const cached = analyses.get(jobId);
    if (cached) return cached;
    const job = await anyPrisma.codebaseAnalysisJob.findUnique({
      where: { id: jobId },
      include: { projections: true, codebaseSnapshot: true, warnings: true },
    });
    if (!job) return null;
    const byKind = new Map<string, unknown>(job.projections.map((item: any) => [item.kind, item.payload]));
    const document = byKind.get('analysis');
    if (!document) return null;
    const parsed = CodebaseAnalysisSchema.safeParse(document);
    if (!parsed.success) return null;
    analyses.set(jobId, parsed.data);
    return parsed.data;
  }

  /** The analysis a read endpoint should serve, or a 404-shaped null. */
  async function currentAnalysis(applicationId: string): Promise<{ jobId: string; analysis: CodebaseAnalysis } | null> {
    const job = await latestJob(applicationId, ['COMPLETED', 'PARTIAL']);
    if (!job) return null;
    const analysis = await loadAnalysis(job.id);
    return analysis ? { jobId: job.id, analysis } : null;
  }

  function graphScopeFor(job: any, analysis: CodebaseAnalysis) {
    return {
      organizationId: job.organizationId,
      applicationId: job.applicationId,
      snapshotId: job.codebaseSnapshotId,
      graphVersion: analysis.graphVersion,
    };
  }

  // ── Chunked source upload ──────────────────────────────────────────────────

  router.post('/applications/:appId/codebase/uploads', ...guarded, async (req: DesktopRequest, res: Response) => {
    const { workspaceId, totalParts, contentHash, totalBytes } = req.body ?? {};
    if (!workspaceId || !contentHash) {
      return res.status(400).json({ error: 'INVALID_UPLOAD_REQUEST', message: 'workspaceId and contentHash are required.' });
    }
    const parts = Number(totalParts);
    if (!Number.isInteger(parts) || parts < 1 || parts > MAX_UPLOAD_PARTS) {
      return res.status(400).json({ error: 'INVALID_PART_COUNT', message: `totalParts must be between 1 and ${MAX_UPLOAD_PARTS}.` });
    }
    if (Number(totalBytes) > MAX_ARCHIVE_BYTES) {
      return res.status(413).json({ error: 'SOURCE_ARCHIVE_TOO_LARGE', maxBytes: MAX_ARCHIVE_BYTES });
    }
    const organizationId = await organizationFor(req.params.appId);
    const workspace = await prisma.projectWorkspace.findFirst({
      where: { id: String(workspaceId), applicationId: req.params.appId, createdByUserId: req.user!.id },
    });
    if (!organizationId || !workspace) return res.status(404).json({ error: 'Workspace not found' });

    const uploadId = crypto.randomUUID();
    uploads.set(uploadId, {
      uploadId,
      applicationId: req.params.appId,
      organizationId,
      userId: req.user!.id,
      workspaceId: workspace.id,
      totalParts: parts,
      contentHash: String(contentHash),
      parts: new Map(),
      bytes: 0,
      createdAt: Date.now(),
    });
    res.status(201).json({ uploadId, maxPartBytes: MAX_PART_BYTES, expiresInSeconds: UPLOAD_TTL_MS / 1_000 });
  });

  router.put('/applications/:appId/codebase/uploads/:uploadId/parts/:partNumber', ...guarded, async (req: DesktopRequest, res: Response) => {
    const upload = uploads.get(req.params.uploadId);
    if (!upload || upload.applicationId !== req.params.appId || upload.userId !== req.user!.id) {
      return res.status(404).json({ error: 'UPLOAD_NOT_FOUND' });
    }
    const partNumber = Number(req.params.partNumber);
    if (!Number.isInteger(partNumber) || partNumber < 0 || partNumber >= upload.totalParts) {
      return res.status(400).json({ error: 'INVALID_PART_NUMBER' });
    }
    let part: Buffer;
    try {
      part = Buffer.from(String(req.body?.dataBase64 ?? ''), 'base64');
    } catch {
      return res.status(400).json({ error: 'INVALID_PART_ENCODING' });
    }
    if (!part.length || part.length > MAX_PART_BYTES) {
      return res.status(413).json({ error: 'PART_TOO_LARGE', maxPartBytes: MAX_PART_BYTES });
    }
    if (upload.bytes - (upload.parts.get(partNumber)?.length ?? 0) + part.length > MAX_ARCHIVE_BYTES) {
      uploads.delete(upload.uploadId);
      return res.status(413).json({ error: 'SOURCE_ARCHIVE_TOO_LARGE' });
    }
    upload.bytes += part.length - (upload.parts.get(partNumber)?.length ?? 0);
    upload.parts.set(partNumber, part);
    // Re-uploading a part is how a resumed transfer recovers, so this is
    // deliberately idempotent.
    res.json({ received: upload.parts.size, totalParts: upload.totalParts });
  });

  router.delete('/applications/:appId/codebase/uploads/:uploadId', ...guarded, (req: DesktopRequest, res: Response) => {
    const upload = uploads.get(req.params.uploadId);
    if (upload && upload.userId === req.user!.id) uploads.delete(req.params.uploadId);
    res.json({ cancelled: true });
  });

  // ── Snapshot creation and job scheduling ───────────────────────────────────

  router.post('/applications/:appId/codebase/snapshots', ...guarded, async (req: DesktopRequest, res: Response) => {
    const body = req.body ?? {};
    const upload = body.uploadId ? uploads.get(String(body.uploadId)) : null;
    if (!upload || upload.applicationId !== req.params.appId || upload.userId !== req.user!.id) {
      return res.status(400).json({ error: 'UPLOAD_NOT_FOUND', message: 'Start an upload before creating a snapshot.' });
    }
    if (upload.parts.size !== upload.totalParts) {
      return res.status(409).json({
        error: 'UPLOAD_INCOMPLETE',
        received: upload.parts.size,
        totalParts: upload.totalParts,
        missing: Array.from({ length: upload.totalParts }, (_, index) => index).filter((index) => !upload.parts.has(index)),
      });
    }
    if (!body.repositoryFingerprint || !body.scannerVersion) {
      return res.status(400).json({ error: 'INVALID_CODEBASE_SNAPSHOT', message: 'repositoryFingerprint and scannerVersion are required.' });
    }

    const archive = Buffer.concat(
      Array.from({ length: upload.totalParts }, (_, index) => upload.parts.get(index)!),
    );
    const checksum = crypto.createHash('sha256').update(archive).digest('hex');
    if (checksum !== upload.contentHash) {
      uploads.delete(upload.uploadId);
      return res.status(400).json({ error: 'SOURCE_ARCHIVE_CHECKSUM_MISMATCH' });
    }
    uploads.delete(upload.uploadId);

    const scannerVersion = String(body.scannerVersion);
    const existing = await anyPrisma.codebaseSnapshot.findUnique({
      where: {
        workspaceId_contentHash_scannerVersion: {
          workspaceId: upload.workspaceId, contentHash: checksum, scannerVersion,
        },
      },
      include: { analysisJobs: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });
    if (existing?.analysisJobs?.[0]) {
      return res.status(200).json({
        snapshotId: existing.id,
        jobId: existing.analysisJobs[0].id,
        status: existing.analysisJobs[0].status,
        deduplicated: true,
      });
    }

    const settings = await prisma.organizationSettings.findUnique({
      where: { organizationId: upload.organizationId },
      select: { codebaseRetentionDays: true },
    });
    const retentionDays = resolveRetentionDays(settings?.codebaseRetentionDays ?? null);

    const snapshot = await anyPrisma.codebaseSnapshot.create({
      data: {
        organizationId: upload.organizationId,
        applicationId: req.params.appId,
        workspaceId: upload.workspaceId,
        repositorySnapshotId: body.repositorySnapshotId ? String(body.repositorySnapshotId) : null,
        repositoryFingerprint: String(body.repositoryFingerprint),
        repositoryIdentity: body.repositoryIdentity ? String(body.repositoryIdentity) : null,
        revision: body.revision ? String(body.revision) : null,
        branch: body.branch ? String(body.branch) : null,
        dirty: Boolean(body.dirty),
        contentHash: checksum,
        scannerVersion,
        analyzerVersions: {},
        fileCount: Math.max(0, Number(body.fileCount) || 0),
        totalBytes: BigInt(Math.max(0, Number(body.totalBytes) || 0)),
        excludedFileCount: Math.max(0, Number(body.excludedFileCount) || 0),
        createdByUserId: req.user!.id,
      },
    });

    const objectKey = `codebase-snapshots/${upload.organizationId}/${req.params.appId}/${snapshot.id}.bin`;
    try {
      // Encrypted before it reaches the provider, so the stored object is not
      // readable from the bucket alone.
      const encrypted = encryptArchive(archive);
      await storage.upload(objectKey, encrypted.buffer, 'application/octet-stream');

      const job = await prisma.$transaction(async (tx) => {
        const anyTx = tx as any;
        await anyTx.sourceArchive.create({
          data: {
            codebaseSnapshotId: snapshot.id,
            status: 'READY',
            objectKey,
            checksum,
            bytes: BigInt(encrypted.buffer.length),
            fileCount: Math.max(0, Number(body.fileCount) || 0),
            encryptionVersion: encrypted.encryptionVersion,
            // Retention is set at creation. Without this the cleanup sweep
            // matches nothing and archives are kept for ever.
            retentionUntil: retentionDeadline(retentionDays),
            uploadedAt: new Date(),
          },
        });
        await anyTx.codebaseAnalysisJob.updateMany({
          where: { applicationId: req.params.appId, status: { in: ACTIVE_STATUSES } },
          data: { status: 'CANCELLED', completedAt: new Date(), stageMessage: 'Superseded by a newer snapshot' },
        });
        return anyTx.codebaseAnalysisJob.create({
          data: {
            organizationId: upload.organizationId,
            applicationId: req.params.appId,
            codebaseSnapshotId: snapshot.id,
          },
        });
      });

      await prisma.storageLedgerEntry.create({
        data: {
          organizationId: upload.organizationId,
          objectKey,
          ownerType: 'CODEBASE_SNAPSHOT',
          ownerId: snapshot.id,
          category: 'SOURCE_ARCHIVE',
          bytes: BigInt(encrypted.buffer.length),
        },
      });

      return res.status(202).json({
        snapshotId: snapshot.id,
        jobId: job.id,
        status: job.status,
        encrypted: encrypted.encryptionVersion !== ARCHIVE_ENCRYPTION_NONE,
        retentionUntil: retentionDeadline(retentionDays).toISOString(),
      });
    } catch (error) {
      await anyPrisma.codebaseSnapshot.delete({ where: { id: snapshot.id } }).catch(() => undefined);
      throw error;
    }
  });

  // ── Job lifecycle ──────────────────────────────────────────────────────────

  router.get('/applications/:appId/codebase/analyses/latest', ...guarded, async (req: DesktopRequest, res: Response) => {
    const job = await anyPrisma.codebaseAnalysisJob.findFirst({
      where: { applicationId: req.params.appId },
      orderBy: { createdAt: 'desc' },
      include: {
        stages: { orderBy: { startedAt: 'asc' } },
        warnings: true,
        codebaseSnapshot: {
          select: { id: true, revision: true, branch: true, dirty: true, contentHash: true, createdAt: true },
        },
      },
    });
    if (!job) return res.status(404).json({ error: 'Codebase analysis not found' });
    const analysis = TERMINAL_STATUSES.includes(job.status) ? await loadAnalysis(job.id) : null;
    res.json({
      jobId: job.id,
      status: job.status,
      progress: job.progress,
      stageMessage: job.stageMessage,
      attempt: job.attempt,
      maxAttempts: job.maxAttempts,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      errorCodeSafe: job.errorCodeSafe,
      errorMessageSafe: job.errorMessageSafe,
      entityCount: job.entityCount,
      relationshipCount: job.relationshipCount,
      featureCount: job.featureCount,
      resultSummary: job.resultSummary,
      graphVersion: job.graphVersion,
      snapshot: job.codebaseSnapshot,
      stages: job.stages,
      warnings: job.warnings,
      analysis,
    });
  });

  router.get('/applications/:appId/codebase/analyses', ...guarded, async (req: DesktopRequest, res: Response) => {
    const jobs = await anyPrisma.codebaseAnalysisJob.findMany({
      where: { applicationId: req.params.appId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(Number(req.query.limit) || 20, 1), 100),
      include: {
        codebaseSnapshot: { select: { id: true, revision: true, branch: true, dirty: true, createdAt: true } },
      },
    });
    res.json({ jobs });
  });

  router.get('/applications/:appId/codebase/analyses/:jobId/stages', ...guarded, async (req: DesktopRequest, res: Response) => {
    const job = await anyPrisma.codebaseAnalysisJob.findFirst({
      where: { id: req.params.jobId, applicationId: req.params.appId },
      include: {
        stages: { orderBy: { startedAt: 'asc' } },
        analyzerRuns: { orderBy: { createdAt: 'asc' } },
        warnings: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!job) return res.status(404).json({ error: 'Codebase analysis not found' });
    res.json({ stages: job.stages, analyzerRuns: job.analyzerRuns, warnings: job.warnings });
  });

  router.post('/applications/:appId/codebase/analyses/:jobId/cancel', ...guarded, async (req: DesktopRequest, res: Response) => {
    const result = await anyPrisma.codebaseAnalysisJob.updateMany({
      where: { id: req.params.jobId, applicationId: req.params.appId, status: { notIn: TERMINAL_STATUSES } },
      data: {
        cancellationRequestedAt: new Date(),
        status: 'CANCELLED',
        completedAt: new Date(),
        stageMessage: 'Cancelled by user',
      },
    });
    res.json({ cancelled: result.count > 0 });
  });

  router.post('/applications/:appId/codebase/analyses/:jobId/retry', ...guarded, async (req: DesktopRequest, res: Response) => {
    const job = await anyPrisma.codebaseAnalysisJob.findFirst({
      where: { id: req.params.jobId, applicationId: req.params.appId },
      include: { codebaseSnapshot: { include: { sourceArchive: true } } },
    });
    if (!job) return res.status(404).json({ error: 'Codebase analysis not found' });
    if (!TERMINAL_STATUSES.includes(job.status)) {
      return res.status(409).json({ error: 'ANALYSIS_STILL_RUNNING' });
    }
    if (job.codebaseSnapshot?.sourceArchive?.status !== 'READY') {
      return res.status(409).json({
        error: 'SOURCE_ARCHIVE_UNAVAILABLE',
        message: 'The source snapshot for this analysis has been deleted under the retention policy. Re-attach the workspace to analyse it again.',
      });
    }
    analyses.invalidate(job.id);
    const retried = await anyPrisma.codebaseAnalysisJob.create({
      data: {
        organizationId: job.organizationId,
        applicationId: job.applicationId,
        codebaseSnapshotId: job.codebaseSnapshotId,
      },
    });
    await anyPrisma.codebaseAnalysisJob.update({
      where: { id: job.id },
      data: { supersededByJobId: retried.id },
    });
    res.status(202).json({ jobId: retried.id, status: retried.status });
  });

  // ── Projections over the completed analysis ────────────────────────────────

  const collectionRoute = (
    path: string,
    select: (analysis: CodebaseAnalysis, req: DesktopRequest) => unknown[],
  ) => {
    router.get(`/applications/:appId/codebase/${path}`, ...guarded, async (req: DesktopRequest, res: Response) => {
      const current = await currentAnalysis(req.params.appId);
      if (!current) return res.status(404).json({ error: 'Codebase analysis not found' });
      const all = select(current.analysis, req);
      const search = String(req.query.search ?? '').toLowerCase();
      const filtered = search
        ? all.filter((item) => JSON.stringify(item).toLowerCase().includes(search))
        : all;
      res.json(paginate(filtered, req));
    });
  };

  collectionRoute('features', (analysis, req) => {
    const domain = String(req.query.domain ?? '');
    return domain ? analysis.features.filter((feature) => feature.domain === domain) : analysis.features;
  });
  collectionRoute('domains', (analysis) => analysis.architecture?.domains ?? []);
  collectionRoute('endpoints', (analysis) => analysis.entities.filter((entity) => entity.type === 'endpoint'));
  collectionRoute('ui-routes', (analysis) => analysis.entities.filter((entity) => entity.type === 'ui_route' || entity.type === 'ui_action'));
  collectionRoute('data-stores', (analysis) => analysis.entities.filter((entity) => entity.type === 'database_model' || entity.type === 'database_table'));
  collectionRoute('events', (analysis) => analysis.entities.filter((entity) => entity.type === 'event' || entity.type === 'queue' || entity.type === 'job'));
  collectionRoute('external-systems', (analysis) => analysis.entities.filter((entity) => entity.type === 'external_service'));
  collectionRoute('findings', (analysis, req) => {
    const kind = String(req.query.kind ?? '');
    return kind ? analysis.findings.filter((finding) => finding.kind === kind) : analysis.findings;
  });
  collectionRoute('coupling', (analysis) => analysis.architecture?.coupling ?? []);

  router.get('/applications/:appId/codebase/overview', ...guarded, async (req: DesktopRequest, res: Response) => {
    const current = await currentAnalysis(req.params.appId);
    if (!current) return res.status(404).json({ error: 'Codebase analysis not found' });
    const { analysis } = current;
    res.json({
      id: analysis.id,
      status: analysis.status,
      graphVersion: analysis.graphVersion,
      revision: analysis.revision,
      branch: analysis.branch,
      dirty: analysis.dirty,
      startedAt: analysis.startedAt,
      completedAt: analysis.completedAt,
      summary: analysis.summary,
      coverage: analysis.coverage,
      incremental: analysis.incremental,
      architecture: analysis.architecture
        ? { metrics: analysis.architecture.metrics, domains: analysis.architecture.domains, hotspots: analysis.architecture.hotspots }
        : null,
      warnings: analysis.warnings,
      findingCounts: analysis.findings.reduce<Record<string, number>>((totals, finding) => {
        totals[finding.kind] = (totals[finding.kind] ?? 0) + 1;
        return totals;
      }, {}),
      analyzerVersions: analysis.analyzerVersions,
    });
  });

  /**
   * Hierarchy children, one level at a time. The desktop tree asks for what the
   * user actually expanded rather than receiving the whole repository.
   */
  router.get('/applications/:appId/codebase/hierarchy', ...guarded, async (req: DesktopRequest, res: Response) => {
    const current = await currentAnalysis(req.params.appId);
    if (!current) return res.status(404).json({ error: 'Codebase analysis not found' });
    const parentId = req.query.parentId ? String(req.query.parentId) : null;
    res.json(paginate(hierarchyChildren(current.analysis, parentId), req));
  });

  router.get('/applications/:appId/codebase/entities/:entityId', ...guarded, async (req: DesktopRequest, res: Response) => {
    const current = await currentAnalysis(req.params.appId);
    if (!current) return res.status(404).json({ error: 'Codebase analysis not found' });
    const detail = describeEntity(current.analysis, req.params.entityId);
    if (!detail) return res.status(404).json({ error: 'Entity not found' });
    res.json(detail);
  });

  /**
   * Bounded source excerpt for one entity, read out of the stored snapshot.
   * Never returns a whole file, and never a path the caller supplied.
   */
  router.get('/applications/:appId/codebase/entities/:entityId/source', ...guarded, async (req: DesktopRequest, res: Response) => {
    const job = await latestJob(req.params.appId, ['COMPLETED', 'PARTIAL']);
    if (!job) return res.status(404).json({ error: 'Codebase analysis not found' });
    const analysis = await loadAnalysis(job.id);
    const entity = analysis?.entities.find((item) => item.id === req.params.entityId);
    if (!entity?.path) return res.status(404).json({ error: 'Entity has no source location' });

    const archive = await anyPrisma.sourceArchive.findUnique({
      where: { codebaseSnapshotId: job.codebaseSnapshotId },
    });
    if (!archive?.objectKey || archive.status !== 'READY') {
      return res.status(410).json({
        error: 'SOURCE_ARCHIVE_UNAVAILABLE',
        message: 'The source snapshot has been deleted under the retention policy.',
      });
    }
    let files: Array<{ path: string; contentBase64: string }>;
    try {
      const raw = decryptArchive(await storage.download(archive.objectKey));
      const zlib = await import('node:zlib');
      files = JSON.parse(zlib.gunzipSync(raw).toString('utf8')).files ?? [];
    } catch {
      return res.status(500).json({ error: 'SOURCE_ARCHIVE_UNREADABLE' });
    }
    const file = files.find((item) => item.path === entity.path);
    if (!file) return res.status(404).json({ error: 'File not present in the stored snapshot' });

    const lines = Buffer.from(file.contentBase64, 'base64').toString('utf8').split('\n');
    const start = Math.max((entity.startLine ?? 1) - 1 - 3, 0);
    const end = Math.min((entity.endLine ?? entity.startLine ?? 1) + 3, lines.length);
    res.json({
      path: entity.path,
      startLine: start + 1,
      endLine: end,
      // Capped so this can never become a whole-repository download.
      excerpt: lines.slice(start, Math.min(end, start + 400)).join('\n'),
    });
  });

  // ── Graph traversal ────────────────────────────────────────────────────────

  router.post('/applications/:appId/codebase/graph', ...guarded, async (req: DesktopRequest, res: Response) => {
    const parsed = GraphProjectionQuerySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ error: 'INVALID_GRAPH_QUERY', details: parsed.error.issues.slice(0, 10) });
    }
    const job = await latestJob(req.params.appId, ['COMPLETED', 'PARTIAL']);
    if (!job) return res.status(404).json({ error: 'Codebase analysis not found' });
    const analysis = await loadAnalysis(job.id);
    if (!analysis) return res.status(404).json({ error: 'Codebase analysis not found' });

    if (codeGraph && job.graphVersion) {
      try {
        const projection = await codeGraph.project(graphScopeFor(job, analysis), parsed.data);
        return res.json(projection);
      } catch {
        // Fall through to the stored projection so an unavailable graph store
        // degrades the view rather than breaking it.
      }
    }
    res.json(projectAnalysis(analysis, parsed.data));
  });

  router.post('/applications/:appId/codebase/path', ...guarded, async (req: DesktopRequest, res: Response) => {
    const source = String(req.body?.source ?? '');
    const target = String(req.body?.target ?? '');
    if (!source || !target) return res.status(400).json({ error: 'SOURCE_AND_TARGET_REQUIRED' });
    const job = await latestJob(req.params.appId, ['COMPLETED', 'PARTIAL']);
    if (!job) return res.status(404).json({ error: 'Codebase analysis not found' });
    const analysis = await loadAnalysis(job.id);
    if (!analysis) return res.status(404).json({ error: 'Codebase analysis not found' });

    if (codeGraph && job.graphVersion) {
      try {
        const path = await codeGraph.shortestPath(graphScopeFor(job, analysis), source, target);
        if (path.found) return res.json(path);
      } catch { /* fall through */ }
    }
    res.json(shortestPathInAnalysis(analysis, source, target));
  });

  router.post('/applications/:appId/codebase/blast-radius', ...guarded, async (req: DesktopRequest, res: Response) => {
    const entityId = String(req.body?.entityId ?? '');
    if (!entityId) return res.status(400).json({ error: 'ENTITY_ID_REQUIRED' });
    const current = await currentAnalysis(req.params.appId);
    if (!current) return res.status(404).json({ error: 'Codebase analysis not found' });
    res.json(blastRadiusInAnalysis(current.analysis, entityId, Math.min(Math.max(Number(req.body?.maxDepth) || 8, 1), 12)));
  });

  router.get('/applications/:appId/codebase/compare', ...guarded, async (req: DesktopRequest, res: Response) => {
    const jobs = await anyPrisma.codebaseAnalysisJob.findMany({
      where: { applicationId: req.params.appId, status: { in: ['COMPLETED', 'PARTIAL'] } },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    const toId = req.query.to ? String(req.query.to) : jobs[0]?.id;
    const fromId = req.query.from ? String(req.query.from) : jobs[1]?.id;
    if (!fromId || !toId) {
      return res.status(404).json({
        error: 'NOT_ENOUGH_ANALYSES',
        message: 'Two completed analyses are needed before changes can be compared.',
        available: jobs.length,
      });
    }
    const [before, after] = await Promise.all([loadAnalysis(fromId), loadAnalysis(toId)]);
    if (!before || !after) return res.status(404).json({ error: 'Codebase analysis not found' });
    res.json(compareAnalyses(before, after));
  });

  // ── Evidence-grounded questions ────────────────────────────────────────────

  router.post('/applications/:appId/codebase/ask', ...guarded, async (req: DesktopRequest, res: Response) => {
    const question = String(req.body?.question ?? '').trim().slice(0, 500);
    if (question.length < 3) return res.status(400).json({ error: 'QUESTION_REQUIRED' });
    const current = await currentAnalysis(req.params.appId);
    if (!current) return res.status(404).json({ error: 'Codebase analysis not found' });

    const { analysis } = current;
    // Retrieval: rank features by term overlap, then answer from their evidence
    // bundles so every statement is traceable to a graph node.
    // Retrieval is shared with the offline path so both rank the same way; only
    // the description step differs.
    const scored = retrieveFeatures(analysis, question);

    if (!scored.length) return res.json(answerFromAnalysis(analysis, question));

    const bundles = scored.map(({ feature }) => ({
      featureId: feature.id,
      fallbackName: feature.name,
      fallbackDescription: feature.description,
      trigger: feature.triggers[0] ?? feature.name,
      entrypointType: 'feature',
      domain: feature.domain,
      workflow: feature.workflow.map((step) => step.label).slice(0, 25),
      reads: feature.reads,
      writes: feature.writes,
      externalServices: feature.externalServices,
      emittedEvents: feature.emittedEvents,
      downstreamEffects: feature.downstreamEffects,
      authorization: feature.authorization,
      sourceFiles: feature.sourceFiles,
      testNames: [],
      confidence: feature.confidence,
      vocabulary: [
        feature.name, feature.description, feature.domain, ...feature.triggers,
        ...feature.reads, ...feature.writes, ...feature.externalServices,
        ...feature.emittedEvents, ...feature.sourceFiles,
        ...feature.workflow.map((step) => step.label),
      ].join(' ').split(/[^A-Za-z0-9]+/).filter((token) => token.length > 2),
    }));

    const explanations = await explainFeatures(bundles, { maxFeatures: 5 }).catch(() => []);
    const answers = scored.map(({ feature }) => {
      const explanation = explanations.find((item) => item.featureId === feature.id);
      return {
        featureId: feature.id,
        name: explanation?.name ?? feature.name,
        summary: explanation?.description ?? feature.description,
        grounded: explanation?.grounded ?? false,
        confidence: explanation?.confidence ?? feature.confidence,
        citations: feature.evidence.slice(0, 6).map((item) => ({
          path: item.path,
          startLine: item.startLine,
          endLine: item.endLine,
          analyzer: item.analyzer,
          confidence: item.confidence,
        })),
        sourceFiles: feature.sourceFiles.slice(0, 10),
      };
    });

    res.json({
      answer: answers.map((item) => `${item.name}: ${item.summary}`).join('\n\n'),
      grounded: answers.some((item) => item.grounded),
      uncertainty: answers.every((item) => item.confidence < 0.7)
        ? 'The supporting evidence for this answer is weak. Treat it as a starting point and open the cited files to confirm.'
        : null,
      features: answers,
      citations: answers.flatMap((item) => item.citations).slice(0, 20),
    });
  });

  // ── Retention and deletion ─────────────────────────────────────────────────

  router.put('/applications/:appId/codebase/retention', ...guarded, async (req: DesktopRequest, res: Response) => {
    const days = Number(req.body?.retentionDays);
    if (!Number.isInteger(days) || days < 1 || days > 365) {
      return res.status(400).json({ error: 'INVALID_RETENTION', message: 'retentionDays must be between 1 and 365.' });
    }
    const organizationId = await organizationFor(req.params.appId);
    if (!organizationId) return res.status(404).json({ error: 'Application not found' });
    await prisma.organizationSettings.update({
      where: { organizationId },
      data: { codebaseRetentionDays: days },
    });
    res.json({ retentionDays: days });
  });

  router.delete('/applications/:appId/codebase/snapshots/:snapshotId', ...guarded, async (req: DesktopRequest, res: Response) => {
    const snapshot = await anyPrisma.codebaseSnapshot.findFirst({
      where: { id: req.params.snapshotId, applicationId: req.params.appId },
      include: { sourceArchive: true, analysisJobs: true },
    });
    if (!snapshot) return res.status(404).json({ error: 'Snapshot not found' });

    if (snapshot.sourceArchive?.objectKey) {
      await storage.delete(snapshot.sourceArchive.objectKey).catch(() => undefined);
      await prisma.storageLedgerEntry.updateMany({
        where: { objectKey: snapshot.sourceArchive.objectKey },
        data: { deletedAt: new Date() },
      });
      await anyPrisma.sourceArchive.update({
        where: { id: snapshot.sourceArchive.id },
        data: { status: 'DELETED', deletedAt: new Date(), objectKey: null },
      });
    }
    if (codeGraph) {
      const job = snapshot.analysisJobs[0];
      await codeGraph.delete({
        organizationId: snapshot.organizationId,
        applicationId: snapshot.applicationId,
        snapshotId: snapshot.id,
        graphVersion: job?.graphVersion ?? '',
      }).catch(() => undefined);
    }
    for (const job of snapshot.analysisJobs) analyses.invalidate(job.id);
    res.json({ deleted: true, snapshotId: snapshot.id });
  });

  router.get('/applications/:appId/codebase/health', ...guarded, async (_req: DesktopRequest, res: Response) => {
    res.json({
      graphStore: codeGraph ? await codeGraph.health().catch(() => false) : null,
      archiveEncryption: isArchiveEncryptionConfigured(),
    });
  });

  return router;
}
