import crypto from 'node:crypto';
import { Router, type NextFunction, type Request, type Response } from 'express';
import type { PrismaClient } from '@sots/db';
import { Feature } from '@sots/shared';
import type { EntitlementChecker } from '@sots/entitlement-checker';

type AuthenticatedRequest = Request & { user?: { id: string; email: string } };
type Middleware = (req: AuthenticatedRequest, res: Response, next: NextFunction) => unknown;
const ALLOWED_KINDS = new Set(['PDF', 'DOCX', 'MARKDOWN', 'TEXT', 'HTML', 'OPENAPI']);

function logicalKey(filename: string): string {
  return crypto.createHash('sha256').update(filename.trim().toLowerCase()).digest('hex');
}

export function createDocumentRouter(input: {
  prisma: PrismaClient;
  entitlementChecker: EntitlementChecker;
  verifyJwt: Middleware;
  verifyAppOwnership: Middleware;
}) {
  const { prisma, entitlementChecker, verifyJwt, verifyAppOwnership } = input;
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
    const document = await prisma.sourceDocument.upsert({
      where: { applicationId_logicalKey: { applicationId: app.id, logicalKey: logicalKey(String(manifest.filename)) } },
      update: {
        filename: String(manifest.filename), mimeType: String(manifest.mimeType ?? 'application/octet-stream'), checksum: String(manifest.checksum),
        uploadMode: req.body.fullFileApproved === true ? 'FULL_FILE_APPROVED' : 'DERIVED_SUMMARY', status: 'READY', parserVersion: String(manifest.processorVersion ?? 'unknown'), errorMessageSafe: null,
      },
      create: {
        organizationId: app.organizationId, applicationId: app.id, uploadedByUserId: req.user!.id,
        logicalKey: logicalKey(String(manifest.filename)), filename: String(manifest.filename), mimeType: String(manifest.mimeType ?? 'application/octet-stream'),
        checksum: String(manifest.checksum), uploadMode: req.body.fullFileApproved === true ? 'FULL_FILE_APPROVED' : 'DERIVED_SUMMARY', status: 'READY', parserVersion: String(manifest.processorVersion ?? 'unknown'),
      },
    });
    const latest = await prisma.sourceDocumentVersion.findFirst({ where: { documentId: document.id }, orderBy: { version: 'desc' } });
    if (latest && document.checksum === String(manifest.checksum) && (latest.extractedSummary as any)?.checksum === String(manifest.checksum)) {
      return res.status(200).json({ documentId: document.id, versionId: latest.id, status: 'PROCESSED', deduplicated: true });
    }
    const job = await prisma.documentProcessingJob.create({
      data: {
        organizationId: app.organizationId, applicationId: app.id, documentId: document.id, requestedByUserId: req.user!.id,
        inputManifest: { ...manifest, aiSafeText: String(manifest.aiSafeText ?? '').slice(0, 100_000) },
      },
    });
    await prisma.sourceDocument.update({ where: { id: document.id }, data: { status: 'PROCESSING' } });
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

  return router;
}
