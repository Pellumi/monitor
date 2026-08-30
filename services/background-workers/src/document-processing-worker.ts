import type { PrismaClient } from '@tellann/db';

type DerivedManifest = {
  checksum: string;
  processorVersion: string;
  summary: string;
  kind: string;
  title: string;
  structure?: unknown;
  redaction?: unknown;
  segments?: Array<{ id: string; heading?: string | null; excerpt: string; locator: string; confidence: number; excludedFromAi?: boolean }>;
};

export async function processDocumentJobs(prisma: PrismaClient, limit = 5): Promise<number> {
  const jobs = await prisma.documentProcessingJob.findMany({
    where: { status: 'QUEUED', scheduledAt: { lte: new Date() } }, orderBy: { scheduledAt: 'asc' }, take: limit,
  });
  let completed = 0;
  for (const queued of jobs) {
    const claimed = await prisma.documentProcessingJob.updateMany({
      where: { id: queued.id, status: 'QUEUED' }, data: { status: 'PROCESSING', startedAt: new Date(), attempts: { increment: 1 } },
    });
    if (!claimed.count) continue;
    try {
      const manifest = queued.inputManifest as unknown as DerivedManifest;
      if (!manifest.checksum || !manifest.processorVersion || !Array.isArray(manifest.segments)) throw new Error('INVALID_DERIVED_MANIFEST');
      const segments = manifest.segments;
      const latest = await prisma.sourceDocumentVersion.findFirst({ where: { documentId: queued.documentId }, orderBy: { version: 'desc' } });
      const version = await prisma.$transaction(async (tx) => {
        const created = await tx.sourceDocumentVersion.create({
          data: {
            documentId: queued.documentId, version: (latest?.version ?? 0) + 1,
            extractedSummary: { checksum: manifest.checksum, title: manifest.title, kind: manifest.kind, summary: manifest.summary } as any,
            redactionSummary: (manifest.redaction ?? {}) as any, structureSummary: (manifest.structure ?? {}) as any, processorVersion: manifest.processorVersion,
          },
        });
        await tx.intentEvidence.createMany({
          data: segments.filter((segment) => !segment.excludedFromAi).map((segment) => ({
            applicationId: queued.applicationId, evidenceType: 'DOCUMENT_REQUIREMENT', sourceDocumentId: queued.documentId,
            documentVersionId: created.id, sourceLabel: segment.heading || manifest.title || 'Document evidence', excerpt: segment.excerpt.slice(0, 1_200),
            locator: segment.locator, confidence: Math.max(0, Math.min(1, segment.confidence || 0.5)), metadata: { localEvidenceId: segment.id } as any,
          })),
        });
        await tx.sourceDocument.update({ where: { id: queued.documentId }, data: { status: 'PROCESSED', errorMessageSafe: null } });
        await tx.documentProcessingJob.update({ where: { id: queued.id }, data: { status: 'COMPLETED', resultVersionId: created.id, completedAt: new Date() } });
        return created;
      });
      if (version) completed += 1;
    } catch (error) {
      const retry = queued.attempts + 1 < queued.maxAttempts;
      await prisma.documentProcessingJob.update({
        where: { id: queued.id }, data: retry
          ? { status: 'QUEUED', scheduledAt: new Date(Date.now() + 30_000), errorMessageSafe: 'Document processing will retry.' }
          : { status: 'FAILED', completedAt: new Date(), errorMessageSafe: error instanceof Error ? error.message.slice(0, 240) : 'Document processing failed.' },
      });
      if (!retry) await prisma.sourceDocument.update({ where: { id: queued.documentId }, data: { status: 'FAILED', errorMessageSafe: 'Document processing failed.' } });
    }
  }
  return completed;
}
