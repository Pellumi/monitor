import crypto from 'node:crypto';
import { Router, type NextFunction, type Request, type Response } from 'express';
import type { PrismaClient } from '@tellann/db';
import { Feature } from '@tellann/shared';
import type { EntitlementChecker } from '@tellann/entitlement-checker';
import type { StorageClient } from '@tellann/storage';
import { generateFlowFromDocument } from '@tellann/ai';

type AuthenticatedRequest = Request & { user?: { id: string; email: string } };
type Middleware = (req: AuthenticatedRequest, res: Response, next: NextFunction) => unknown;
const ALLOWED_KINDS = new Set(['PDF', 'DOCX', 'MARKDOWN', 'TEXT', 'HTML', 'OPENAPI']);

const KIND_BY_MIME: Record<string, string> = {
  'application/pdf': 'PDF',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
  'application/msword': 'DOCX',
  'text/markdown': 'MARKDOWN',
  'text/x-markdown': 'MARKDOWN',
  'text/plain': 'TEXT',
  'text/html': 'HTML',
  'application/json': 'OPENAPI',
  'application/yaml': 'OPENAPI',
  'application/x-yaml': 'OPENAPI',
  'text/yaml': 'OPENAPI',
};
const MAX_DOCUMENT_BYTES = 15 * 1024 * 1024;

function logicalKey(filename: string): string {
  return crypto.createHash('sha256').update(filename.trim().toLowerCase()).digest('hex');
}

// The desktop sends an opaque, device-scoped digest of where the file lives so
// two different files that share a name (docs/a/requirements.md and
// docs/b/requirements.md) stay separate documents. The path itself never leaves
// the machine.
const SOURCE_KEY_PATTERN = /^[a-f0-9]{64}$/;

function sourceLogicalKey(filename: string, sourceKey: string): string {
  return crypto.createHash('sha256').update(`${filename.trim().toLowerCase()}:${sourceKey}`).digest('hex');
}

export function createDocumentRouter(input: {
  prisma: PrismaClient;
  entitlementChecker: EntitlementChecker;
  verifyJwt: Middleware;
  verifyAppOwnership: Middleware;
  storage: StorageClient;
}) {
  const { prisma, entitlementChecker, verifyJwt, verifyAppOwnership, storage } = input;
  const router = Router();

  async function application(req: AuthenticatedRequest, res: Response) {
    const record = await prisma.application.findUnique({ where: { id: req.params.appId }, select: { id: true, organizationId: true } });
    if (!record?.organizationId) {
      res.status(404).json({ error: 'Application not found' });
      return null;
    }
    return record;
  }

  async function requireDocumentEntitlement(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    const record = await application(req, res);
    if (!record?.organizationId) return;
    if (!await entitlementChecker.canAccess(record.organizationId, Feature.DOCUMENT_FLOW_INFERENCE)) {
      return res.status(403).json({ error: 'FEATURE_NOT_ENTITLED', feature: Feature.DOCUMENT_FLOW_INFERENCE });
    }
    next();
  }

  router.use('/applications/:appId/source-documents', verifyJwt, verifyAppOwnership, requireDocumentEntitlement);

  router.get('/applications/:appId/source-documents', async (req: AuthenticatedRequest, res: Response) => {
    const documents = await prisma.sourceDocument.findMany({
      where: { applicationId: req.params.appId },
      include: { versions: { orderBy: { version: 'desc' }, take: 1 }, processingJobs: { orderBy: { createdAt: 'desc' }, take: 1 } },
      orderBy: { updatedAt: 'desc' },
    });
    res.json(documents.map((document) => ({ ...document, objectKey: undefined })));
  });

  router.post('/applications/:appId/source-documents/upload-intent', async (req: AuthenticatedRequest, res: Response) => {
    const app = await application(req, res);
    if (!app?.organizationId) return;
    const manifest = req.body?.manifest;
    if (!manifest || typeof manifest !== 'object' || !manifest.filename || !manifest.checksum || !ALLOWED_KINDS.has(String(manifest.kind))) {
      return res.status(400).json({ error: 'INVALID_DOCUMENT_MANIFEST' });
    }
    if (req.body.absolutePath || manifest.absolutePath || manifest.localPath) {
      return res.status(400).json({ error: 'ABSOLUTE_LOCAL_PATH_NOT_ALLOWED' });
    }
    if (!Array.isArray(manifest.segments) || manifest.segments.length > 250 || String(manifest.summary ?? '').length > 12_000) {
      return res.status(413).json({ error: 'DERIVED_DOCUMENT_SUMMARY_TOO_LARGE' });
    }
    if (manifest.sourceKey !== undefined && !SOURCE_KEY_PATTERN.test(String(manifest.sourceKey))) {
      return res.status(400).json({ error: 'INVALID_DOCUMENT_SOURCE_KEY' });
    }
    const filename = String(manifest.filename);
    const checksum = String(manifest.checksum);
    const uploadMode = req.body.fullFileApproved === true ? 'FULL_FILE_APPROVED' : 'DERIVED_SUMMARY';
    const legacyKey = logicalKey(filename);
    const key = manifest.sourceKey ? sourceLogicalKey(filename, String(manifest.sourceKey)) : legacyKey;

    let document = await prisma.sourceDocument.findUnique({ where: { applicationId_logicalKey: { applicationId: app.id, logicalKey: key } } });
    if (!document && key !== legacyKey) {
      // Documents uploaded before source keys existed are keyed by filename
      // alone. The first upload of that filename from a known location adopts
      // the existing document, so its version history continues instead of a
      // duplicate appearing beside it.
      const legacy = await prisma.sourceDocument.findUnique({ where: { applicationId_logicalKey: { applicationId: app.id, logicalKey: legacyKey } } });
      if (legacy) document = await prisma.sourceDocument.update({ where: { id: legacy.id }, data: { logicalKey: key } });
    }
    if (!document) {
      document = await prisma.sourceDocument.create({
        data: {
          organizationId: app.organizationId, applicationId: app.id, uploadedByUserId: req.user!.id,
          logicalKey: key, filename, mimeType: String(manifest.mimeType ?? 'application/octet-stream'),
          checksum, uploadMode, status: 'PROCESSING', parserVersion: String(manifest.processorVersion ?? 'unknown'),
        },
      });
    }
    const documentFields = {
      filename, mimeType: String(manifest.mimeType ?? 'application/octet-stream'), checksum, uploadMode,
      parserVersion: String(manifest.processorVersion ?? 'unknown'), errorMessageSafe: null,
    };

    const latest = await prisma.sourceDocumentVersion.findFirst({ where: { documentId: document.id }, orderBy: { version: 'desc' } });
    if (latest && (latest.extractedSummary as any)?.checksum === checksum) {
      // Unchanged content: the latest version already holds this evidence. The
      // document must read as PROCESSED again, otherwise intent generation
      // rejects the version it was just handed.
      await prisma.documentProcessingJob.updateMany({
        where: { documentId: document.id, status: 'QUEUED' },
        data: { status: 'CANCELLED', completedAt: new Date(), errorMessageSafe: 'Superseded by a newer upload.' },
      });
      await prisma.sourceDocument.update({ where: { id: document.id }, data: { ...documentFields, status: 'PROCESSED' } });
      return res.status(200).json({ documentId: document.id, versionId: latest.id, status: 'PROCESSED', deduplicated: true });
    }

    // The same content may already be queued, for example when the desktop
    // resumes an interrupted import. Reuse that job instead of queueing another.
    const inFlight = await prisma.documentProcessingJob.findFirst({
      where: { documentId: document.id, status: { in: ['QUEUED', 'PROCESSING'] }, inputManifest: { path: ['checksum'], equals: checksum } },
      orderBy: { createdAt: 'desc' },
    });
    if (inFlight) {
      await prisma.sourceDocument.update({ where: { id: document.id }, data: { ...documentFields, status: 'PROCESSING' } });
      return res.status(202).json({ documentId: document.id, jobId: inFlight.id, status: inFlight.status, deduplicated: true, fullFileUploaded: false });
    }

    // Latest upload wins: older queued content for this document is dropped.
    await prisma.documentProcessingJob.updateMany({
      where: { documentId: document.id, status: 'QUEUED' },
      data: { status: 'CANCELLED', completedAt: new Date(), errorMessageSafe: 'Superseded by a newer upload.' },
    });
    const job = await prisma.documentProcessingJob.create({
      data: {
        organizationId: app.organizationId, applicationId: app.id, documentId: document.id, requestedByUserId: req.user!.id,
        inputManifest: { ...manifest, aiSafeText: String(manifest.aiSafeText ?? '').slice(0, 100_000) },
      },
    });
    await prisma.sourceDocument.update({ where: { id: document.id }, data: { ...documentFields, status: 'PROCESSING' } });
    res.status(202).json({ documentId: document.id, jobId: job.id, status: job.status, fullFileUploaded: false });
  });

  router.get('/applications/:appId/source-documents/:documentId', async (req: AuthenticatedRequest, res: Response) => {
    const document = await prisma.sourceDocument.findFirst({
      where: { id: req.params.documentId, applicationId: req.params.appId },
      include: { versions: { orderBy: { version: 'desc' } }, processingJobs: { orderBy: { createdAt: 'desc' } } },
    });
    if (!document) return res.status(404).json({ error: 'Source document not found' });
    res.json({ ...document, objectKey: undefined });
  });

  router.post('/applications/:appId/source-documents/:documentId/process', async (req: AuthenticatedRequest, res: Response) => {
    const document = await prisma.sourceDocument.findFirst({ where: { id: req.params.documentId, applicationId: req.params.appId } });
    if (!document) return res.status(404).json({ error: 'Source document not found' });
    const previous = await prisma.documentProcessingJob.findFirst({ where: { documentId: document.id }, orderBy: { createdAt: 'desc' } });
    if (!previous) return res.status(409).json({ error: 'NO_APPROVED_DERIVED_MANIFEST' });
    const job = await prisma.documentProcessingJob.create({
      data: { organizationId: document.organizationId, applicationId: document.applicationId, documentId: document.id, requestedByUserId: req.user!.id, inputManifest: previous.inputManifest as any },
    });
    await prisma.sourceDocument.update({ where: { id: document.id }, data: { status: 'PROCESSING' } });
    res.status(202).json({ jobId: job.id, status: job.status });
  });

  router.get('/applications/:appId/source-documents/jobs/:jobId', async (req: AuthenticatedRequest, res: Response) => {
    const job = await prisma.documentProcessingJob.findFirst({ where: { id: req.params.jobId, applicationId: req.params.appId } });
    if (!job) return res.status(404).json({ error: 'Document processing job not found' });
    res.json(job);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Web document → flow: the browser posts the raw file (base64 JSON), we send
  // it straight to Gemini multimodal and materialise a DRAFT declared flow that
  // opens in the graph editor for review. Synchronous — no worker.
  // ───────────────────────────────────────────────────────────────────────────
  router.post('/applications/:appId/source-documents/generate-flow', async (req: AuthenticatedRequest, res: Response) => {
    const app = await application(req, res);
    if (!app?.organizationId) return;

    const { filename, mimeType, dataBase64 } = req.body ?? {};
    if (
      typeof filename !== 'string' || !filename.trim() ||
      typeof mimeType !== 'string' ||
      typeof dataBase64 !== 'string' || !dataBase64
    ) {
      return res.status(400).json({ error: 'INVALID_DOCUMENT_PAYLOAD' });
    }
    const kind = KIND_BY_MIME[mimeType];
    if (!kind || !ALLOWED_KINDS.has(kind)) {
      return res.status(415).json({ error: 'UNSUPPORTED_DOCUMENT_TYPE' });
    }

    let buffer: Buffer;
    try {
      buffer = Buffer.from(dataBase64, 'base64');
    } catch {
      return res.status(400).json({ error: 'INVALID_DOCUMENT_PAYLOAD' });
    }
    if (!buffer.length) return res.status(400).json({ error: 'EMPTY_DOCUMENT' });
    if (buffer.length > MAX_DOCUMENT_BYTES) return res.status(413).json({ error: 'DOCUMENT_TOO_LARGE' });

    const checksum = crypto.createHash('sha256').update(buffer).digest('hex');
    const safeName = filename.replace(/[^\w.\-]+/g, '_').slice(0, 120) || 'document';
    const objectKey = `flow-source-documents/${app.id}/${checksum.slice(0, 16)}-${safeName}`;

    // 1) Persist the raw file (best-effort — generation is the primary goal).
    let storedKey: string | null = null;
    try {
      await storage.uploadAndPresign(objectKey, buffer, mimeType, 3600);
      storedKey = objectKey;
    } catch (err) {
      console.warn('[documents] raw file storage failed (non-fatal)', err);
    }

    // 2) Record the source document.
    const document = await prisma.sourceDocument.upsert({
      where: { applicationId_logicalKey: { applicationId: app.id, logicalKey: logicalKey(filename) } },
      update: {
        filename, mimeType, checksum, uploadMode: 'FULL_FILE_APPROVED', status: 'READY',
        objectKey: storedKey, parserVersion: 'gemini-multimodal', errorMessageSafe: null,
      },
      create: {
        organizationId: app.organizationId, applicationId: app.id, uploadedByUserId: req.user!.id,
        logicalKey: logicalKey(filename), filename, mimeType, checksum,
        uploadMode: 'FULL_FILE_APPROVED', status: 'READY', objectKey: storedKey, parserVersion: 'gemini-multimodal',
      },
    });

    // 3) Ask Gemini for the flow.
    let generated: Awaited<ReturnType<typeof generateFlowFromDocument>>;
    try {
      generated = await generateFlowFromDocument({ fileBase64: dataBase64, mimeType, filename });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'DOCUMENT_FLOW_GENERATION_FAILED';
      await prisma.sourceDocument
        .update({ where: { id: document.id }, data: { status: 'FAILED', errorMessageSafe: 'Flow could not be generated from this document.' } })
        .catch(() => {});
      const status = message.startsWith('DOCUMENT_FLOW_PROVIDER_UNCONFIGURED') ? 503 : 422;
      return res.status(status).json({ error: 'DOCUMENT_FLOW_GENERATION_FAILED', detail: message.slice(0, 200) });
    }

    // 4) Materialise a DRAFT declared flow pending review.
    const devEnv = await prisma.environment.findFirst({ where: { applicationId: app.id, isDefault: true } });
    const normalize = (value: string) => value.toUpperCase().trim().replace(/\s+/g, '_');

    const graph = await prisma.behaviorGraph.create({
      data: {
        applicationId: app.id, environmentId: devEnv?.id ?? null,
        name: generated.name || 'New Flow',
        purpose: generated.purpose || null,
        scopeStatement: generated.scopeStatement || '',
        workflowType: generated.workflowType || 'CUSTOM',
        graphType: 'DECLARED', sourceType: 'SYSTEM_GENERATED',
        lifecycleStatus: 'DRAFT', status: 'DRAFT',
        declaredById: req.user!.id,
        // Each flow keeps its own version line: v1 until a revision is opened.
        version: 1,
        aiDraftStatus: 'PENDING_REVIEW',
        aiDraftSourceName: filename,
      },
    });

    const nodeByName = new Map<string, { id: string }>();
    for (const state of generated.states) {
      const name = normalize(state.name);
      if (!name || nodeByName.has(name)) continue;
      const node = await prisma.behaviorGraphNode.create({
        data: {
          graphId: graph.id, stateName: name, behaviorKey: name, canonicalBehavior: name,
          category: state.category, role: state.role,
          terminalKind: state.role === 'TERMINAL' ? (state.terminalKind ?? 'SUCCESS') : null,
          provenance: 'SUGGESTED_ACCEPTED', declaredById: req.user!.id,
        },
      });
      nodeByName.set(name, node);
    }
    let transitionCount = 0;
    for (const transition of generated.transitions) {
      const from = nodeByName.get(normalize(transition.from));
      const to = nodeByName.get(normalize(transition.to));
      if (!from || !to) continue;
      await prisma.behaviorGraphEdge.create({
        data: { graphId: graph.id, fromNodeId: from.id, toNodeId: to.id, action: transition.action || null, provenance: 'SUGGESTED_ACCEPTED' },
      });
      transitionCount += 1;
    }

    res.status(201).json({
      flowId: graph.id,
      name: graph.name,
      sourceName: filename,
      stateCount: nodeByName.size,
      transitionCount,
      provider: generated.provider,
      model: generated.model,
    });
  });

  return router;
}
