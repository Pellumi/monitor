ALTER TYPE "AIFlowDraftSource" ADD VALUE IF NOT EXISTS 'DOCUMENT';
ALTER TYPE "AIFlowDraftSource" ADD VALUE IF NOT EXISTS 'REPOSITORY_SCAN';
ALTER TYPE "AIFlowDraftSource" ADD VALUE IF NOT EXISTS 'HYBRID_ANALYSIS';
ALTER TYPE "AIFlowDraftSource" ADD VALUE IF NOT EXISTS 'USER_CORRECTION';

CREATE TYPE "DocumentProcessingJobStatus" AS ENUM ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED');

ALTER TABLE "AIFlowDraft"
  ADD COLUMN "sourceManifest" JSONB,
  ADD COLUMN "acceptedGraphId" TEXT,
  ADD COLUMN "acceptedGraphVersionId" TEXT;

ALTER TABLE "AIFlowDraftJob" ADD COLUMN "sourceManifest" JSONB;

ALTER TABLE "SourceDocument" ADD COLUMN "logicalKey" TEXT;
UPDATE "SourceDocument" SET "logicalKey" = "id" WHERE "logicalKey" IS NULL;
ALTER TABLE "SourceDocument" ALTER COLUMN "logicalKey" SET NOT NULL;
DROP INDEX IF EXISTS "SourceDocument_applicationId_checksum_key";
CREATE UNIQUE INDEX "SourceDocument_applicationId_logicalKey_key" ON "SourceDocument"("applicationId", "logicalKey");
CREATE INDEX "SourceDocument_applicationId_checksum_idx" ON "SourceDocument"("applicationId", "checksum");

CREATE TABLE "DocumentProcessingJob" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "applicationId" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "requestedByUserId" TEXT NOT NULL,
  "status" "DocumentProcessingJobStatus" NOT NULL DEFAULT 'QUEUED',
  "inputManifest" JSONB NOT NULL,
  "resultVersionId" TEXT,
  "errorMessageSafe" TEXT,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 3,
  "scheduledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DocumentProcessingJob_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DocumentProcessingJob_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "SourceDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "DocumentProcessingJob_status_scheduledAt_idx" ON "DocumentProcessingJob"("status", "scheduledAt");
CREATE INDEX "DocumentProcessingJob_organizationId_applicationId_idx" ON "DocumentProcessingJob"("organizationId", "applicationId");
CREATE INDEX "DocumentProcessingJob_documentId_createdAt_idx" ON "DocumentProcessingJob"("documentId", "createdAt");

ALTER TABLE "IntentEvidence" ADD COLUMN "aiFlowDraftId" TEXT;
ALTER TABLE "IntentEvidence" ADD CONSTRAINT "IntentEvidence_aiFlowDraftId_fkey" FOREIGN KEY ("aiFlowDraftId") REFERENCES "AIFlowDraft"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "IntentEvidence_aiFlowDraftId_idx" ON "IntentEvidence"("aiFlowDraftId");

ALTER TABLE "BehaviorGraphNode" ADD COLUMN "evidenceIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "BehaviorGraphEdge" ADD COLUMN "evidenceIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
