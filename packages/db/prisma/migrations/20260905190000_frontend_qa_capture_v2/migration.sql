-- Frontend QA Capture, Inspect Mode, and durable Report V2.

DO $$ BEGIN
  CREATE TYPE "QAEvidenceScope" AS ENUM ('PRE_BOUNDARY', 'IN_FLOW');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "QAProtectedValueKind" AS ENUM ('ORDINARY', 'DIRECT_IDENTIFIER', 'SECRET');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "QAReportStatus" AS ENUM ('PENDING', 'RECONCILING', 'ANALYZING', 'GENERATING', 'READY', 'FAILED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "QAReportJobStatus" AS ENUM ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TYPE "QARunArtifactType" ADD VALUE IF NOT EXISTS 'INSPECT_SCREENSHOT';
ALTER TYPE "QARunArtifactType" ADD VALUE IF NOT EXISTS 'SANITIZED_FINAL_SCREENSHOT';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'QA_EVIDENCE_REVEALED';

CREATE TABLE "QARunEvidenceEvent" (
  "id" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "traceId" TEXT,
  "localSequence" INTEGER NOT NULL,
  "eventType" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "scope" "QAEvidenceScope" NOT NULL,
  "privacyClassification" "PrivacyClassification" NOT NULL DEFAULT 'INTERNAL',
  "pageUrl" TEXT,
  "normalizedRoute" TEXT,
  "acceptedFlowStateKey" TEXT,
  "viewport" JSONB,
  "interactionGroupId" TEXT,
  "causedByEventId" TEXT,
  "metadata" JSONB NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "QARunEvidenceEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "QARunProtectedValue" (
  "id" TEXT NOT NULL,
  "evidenceEventId" TEXT NOT NULL,
  "keyPath" TEXT NOT NULL,
  "kind" "QAProtectedValueKind" NOT NULL,
  "displayValue" TEXT NOT NULL,
  "valueLength" INTEGER NOT NULL,
  "fingerprint" TEXT,
  "keyVersion" TEXT,
  "iv" TEXT,
  "ciphertext" TEXT,
  "authTag" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "QARunProtectedValue_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "QARunAnnotation" (
  "id" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "scope" "QAEvidenceScope" NOT NULL,
  "flowStateKey" TEXT,
  "pageUrl" TEXT NOT NULL,
  "normalizedRoute" TEXT NOT NULL,
  "comment" TEXT NOT NULL,
  "elementFingerprint" JSONB NOT NULL,
  "documentBounds" JSONB,
  "viewportBounds" JSONB NOT NULL,
  "windowResolution" JSONB NOT NULL,
  "screenshotArtifactId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "QARunAnnotation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "QARunAnnotationMention" (
  "annotationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "displayNameSnapshot" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "QARunAnnotationMention_pkey" PRIMARY KEY ("annotationId", "userId")
);

CREATE TABLE "QAReport" (
  "id" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "status" "QAReportStatus" NOT NULL DEFAULT 'PENDING',
  "schemaVersion" TEXT NOT NULL DEFAULT '2.0',
  "payload" JSONB,
  "generatorProvenance" JSONB,
  "aiStatus" TEXT NOT NULL DEFAULT 'NOT_REQUESTED',
  "rulesStatus" TEXT NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "failureReasonSafe" TEXT,
  "startedAt" TIMESTAMP(3),
  "generatedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "QAReport_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "QAReportGenerationJob" (
  "id" TEXT NOT NULL,
  "reportId" TEXT NOT NULL,
  "status" "QAReportJobStatus" NOT NULL DEFAULT 'QUEUED',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 3,
  "scheduledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "failureReasonSafe" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "QAReportGenerationJob_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "BrowserFinding"
  ADD COLUMN "scope" "QAEvidenceScope",
  ADD COLUMN "dedupeKey" TEXT,
  ADD COLUMN "generatorSource" TEXT NOT NULL DEFAULT 'BROWSER';

CREATE TABLE "BrowserFindingEventEvidence" (
  "findingId" TEXT NOT NULL,
  "evidenceEventId" TEXT NOT NULL,
  CONSTRAINT "BrowserFindingEventEvidence_pkey" PRIMARY KEY ("findingId", "evidenceEventId")
);

ALTER TABLE "QARunEvidenceEvent" ADD CONSTRAINT "QARunEvidenceEvent_runId_fkey" FOREIGN KEY ("runId") REFERENCES "QARun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QARunProtectedValue" ADD CONSTRAINT "QARunProtectedValue_evidenceEventId_fkey" FOREIGN KEY ("evidenceEventId") REFERENCES "QARunEvidenceEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QARunAnnotation" ADD CONSTRAINT "QARunAnnotation_runId_fkey" FOREIGN KEY ("runId") REFERENCES "QARun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QARunAnnotation" ADD CONSTRAINT "QARunAnnotation_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "QARunAnnotationMention" ADD CONSTRAINT "QARunAnnotationMention_annotationId_fkey" FOREIGN KEY ("annotationId") REFERENCES "QARunAnnotation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QARunAnnotationMention" ADD CONSTRAINT "QARunAnnotationMention_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "QAReport" ADD CONSTRAINT "QAReport_runId_fkey" FOREIGN KEY ("runId") REFERENCES "QARun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QAReportGenerationJob" ADD CONSTRAINT "QAReportGenerationJob_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "QAReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BrowserFindingEventEvidence" ADD CONSTRAINT "BrowserFindingEventEvidence_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "BrowserFinding"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BrowserFindingEventEvidence" ADD CONSTRAINT "BrowserFindingEventEvidence_evidenceEventId_fkey" FOREIGN KEY ("evidenceEventId") REFERENCES "QARunEvidenceEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "QARunEvidenceEvent_runId_eventId_key" ON "QARunEvidenceEvent"("runId", "eventId");
CREATE UNIQUE INDEX "QARunEvidenceEvent_runId_sessionId_localSequence_key" ON "QARunEvidenceEvent"("runId", "sessionId", "localSequence");
CREATE INDEX "QARunEvidenceEvent_runId_scope_occurredAt_idx" ON "QARunEvidenceEvent"("runId", "scope", "occurredAt");
CREATE INDEX "QARunEvidenceEvent_runId_eventType_occurredAt_idx" ON "QARunEvidenceEvent"("runId", "eventType", "occurredAt");
CREATE INDEX "QARunEvidenceEvent_interactionGroupId_idx" ON "QARunEvidenceEvent"("interactionGroupId");
CREATE INDEX "QARunProtectedValue_evidenceEventId_idx" ON "QARunProtectedValue"("evidenceEventId");
CREATE INDEX "QARunAnnotation_runId_createdAt_idx" ON "QARunAnnotation"("runId", "createdAt");
CREATE INDEX "QARunAnnotation_authorId_idx" ON "QARunAnnotation"("authorId");
CREATE INDEX "QARunAnnotationMention_userId_idx" ON "QARunAnnotationMention"("userId");
CREATE UNIQUE INDEX "QAReport_runId_key" ON "QAReport"("runId");
CREATE UNIQUE INDEX "QAReportGenerationJob_reportId_key" ON "QAReportGenerationJob"("reportId");
CREATE INDEX "QAReportGenerationJob_status_scheduledAt_idx" ON "QAReportGenerationJob"("status", "scheduledAt");
CREATE UNIQUE INDEX "BrowserFinding_runId_dedupeKey_key" ON "BrowserFinding"("runId", "dedupeKey");
CREATE INDEX "BrowserFindingEventEvidence_evidenceEventId_idx" ON "BrowserFindingEventEvidence"("evidenceEventId");
