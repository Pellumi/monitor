CREATE TYPE "CodebaseAnalysisStatus" AS ENUM ('QUEUED','INGESTING','PARSING','LINKING','GRAPHING','DISCOVERING_FEATURES','ANALYZING_ARCHITECTURE','SUMMARIZING','COMPLETED','PARTIAL','FAILED','CANCELLED');
CREATE TYPE "SourceArchiveStatus" AS ENUM ('PENDING','UPLOADING','READY','FAILED','DELETED');

CREATE TABLE "CodebaseSnapshot" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "applicationId" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL, "repositorySnapshotId" TEXT, "repositoryFingerprint" TEXT NOT NULL,
  "repositoryIdentity" TEXT, "revision" TEXT, "branch" TEXT, "dirty" BOOLEAN NOT NULL,
  "contentHash" TEXT NOT NULL, "scannerVersion" TEXT NOT NULL, "analyzerVersions" JSONB NOT NULL,
  "fileCount" INTEGER NOT NULL DEFAULT 0, "totalBytes" BIGINT NOT NULL DEFAULT 0,
  "excludedFileCount" INTEGER NOT NULL DEFAULT 0, "graphVersion" TEXT, "createdByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "CodebaseSnapshot_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "SourceArchive" (
  "id" TEXT NOT NULL, "codebaseSnapshotId" TEXT NOT NULL, "status" "SourceArchiveStatus" NOT NULL DEFAULT 'PENDING',
  "objectKey" TEXT, "checksum" TEXT NOT NULL, "bytes" BIGINT NOT NULL, "fileCount" INTEGER NOT NULL,
  "encryptionVersion" TEXT NOT NULL DEFAULT 'storage-managed-v1', "retentionUntil" TIMESTAMP(3),
  "uploadedAt" TIMESTAMP(3), "deletedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "SourceArchive_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "CodebaseAnalysisJob" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "applicationId" TEXT NOT NULL, "codebaseSnapshotId" TEXT NOT NULL,
  "status" "CodebaseAnalysisStatus" NOT NULL DEFAULT 'QUEUED', "progress" INTEGER NOT NULL DEFAULT 0,
  "stageMessage" TEXT NOT NULL DEFAULT 'Queued', "attempt" INTEGER NOT NULL DEFAULT 0, "maxAttempts" INTEGER NOT NULL DEFAULT 3,
  "scheduledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "startedAt" TIMESTAMP(3), "completedAt" TIMESTAMP(3),
  "heartbeatAt" TIMESTAMP(3), "leaseOwner" TEXT, "leaseExpiresAt" TIMESTAMP(3), "cancellationRequestedAt" TIMESTAMP(3),
  "errorCodeSafe" TEXT, "errorMessageSafe" TEXT, "entityCount" INTEGER NOT NULL DEFAULT 0,
  "relationshipCount" INTEGER NOT NULL DEFAULT 0, "featureCount" INTEGER NOT NULL DEFAULT 0,
  "resultSummary" JSONB, "graphVersion" TEXT, "supersededByJobId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CodebaseAnalysisJob_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "AnalysisStageRun" (
  "id" TEXT NOT NULL, "jobId" TEXT NOT NULL, "stage" "CodebaseAnalysisStatus" NOT NULL, "status" TEXT NOT NULL,
  "progress" INTEGER NOT NULL DEFAULT 0, "attempt" INTEGER NOT NULL DEFAULT 1, "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3), "errorSafe" TEXT, CONSTRAINT "AnalysisStageRun_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "AnalyzerRun" (
  "id" TEXT NOT NULL, "jobId" TEXT NOT NULL, "analyzer" TEXT NOT NULL, "version" TEXT NOT NULL, "status" TEXT NOT NULL,
  "inputCount" INTEGER NOT NULL DEFAULT 0, "outputCount" INTEGER NOT NULL DEFAULT 0, "durationMs" INTEGER, "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "AnalyzerRun_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "AnalysisWarning" (
  "id" TEXT NOT NULL, "jobId" TEXT NOT NULL, "code" TEXT NOT NULL, "severity" TEXT NOT NULL, "message" TEXT NOT NULL,
  "path" TEXT, "metadata" JSONB, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AnalysisWarning_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "AnalysisProjection" (
  "id" TEXT NOT NULL, "jobId" TEXT NOT NULL, "kind" TEXT NOT NULL, "schemaVersion" TEXT NOT NULL DEFAULT '1.0',
  "payload" JSONB NOT NULL, "checksum" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "AnalysisProjection_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CodebaseSnapshot_workspaceId_contentHash_scannerVersion_key" ON "CodebaseSnapshot"("workspaceId","contentHash","scannerVersion");
CREATE INDEX "CodebaseSnapshot_applicationId_createdAt_idx" ON "CodebaseSnapshot"("applicationId","createdAt");
CREATE INDEX "CodebaseSnapshot_organizationId_createdAt_idx" ON "CodebaseSnapshot"("organizationId","createdAt");
CREATE UNIQUE INDEX "SourceArchive_codebaseSnapshotId_key" ON "SourceArchive"("codebaseSnapshotId");
CREATE UNIQUE INDEX "SourceArchive_objectKey_key" ON "SourceArchive"("objectKey");
CREATE INDEX "CodebaseAnalysisJob_status_scheduledAt_idx" ON "CodebaseAnalysisJob"("status","scheduledAt");
CREATE INDEX "CodebaseAnalysisJob_applicationId_createdAt_idx" ON "CodebaseAnalysisJob"("applicationId","createdAt");
CREATE INDEX "CodebaseAnalysisJob_codebaseSnapshotId_createdAt_idx" ON "CodebaseAnalysisJob"("codebaseSnapshotId","createdAt");
CREATE INDEX "AnalysisStageRun_jobId_startedAt_idx" ON "AnalysisStageRun"("jobId","startedAt");
CREATE INDEX "AnalyzerRun_jobId_analyzer_idx" ON "AnalyzerRun"("jobId","analyzer");
CREATE INDEX "AnalysisWarning_jobId_severity_idx" ON "AnalysisWarning"("jobId","severity");
CREATE UNIQUE INDEX "AnalysisProjection_jobId_kind_key" ON "AnalysisProjection"("jobId","kind");
ALTER TABLE "CodebaseSnapshot" ADD CONSTRAINT "CodebaseSnapshot_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CodebaseSnapshot" ADD CONSTRAINT "CodebaseSnapshot_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CodebaseSnapshot" ADD CONSTRAINT "CodebaseSnapshot_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "ProjectWorkspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CodebaseSnapshot" ADD CONSTRAINT "CodebaseSnapshot_repositorySnapshotId_fkey" FOREIGN KEY ("repositorySnapshotId") REFERENCES "RepositorySnapshot"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SourceArchive" ADD CONSTRAINT "SourceArchive_codebaseSnapshotId_fkey" FOREIGN KEY ("codebaseSnapshotId") REFERENCES "CodebaseSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CodebaseAnalysisJob" ADD CONSTRAINT "CodebaseAnalysisJob_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CodebaseAnalysisJob" ADD CONSTRAINT "CodebaseAnalysisJob_codebaseSnapshotId_fkey" FOREIGN KEY ("codebaseSnapshotId") REFERENCES "CodebaseSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AnalysisStageRun" ADD CONSTRAINT "AnalysisStageRun_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "CodebaseAnalysisJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AnalyzerRun" ADD CONSTRAINT "AnalyzerRun_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "CodebaseAnalysisJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AnalysisWarning" ADD CONSTRAINT "AnalysisWarning_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "CodebaseAnalysisJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AnalysisProjection" ADD CONSTRAINT "AnalysisProjection_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "CodebaseAnalysisJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Organisation-configurable retention for uploaded source snapshots.
ALTER TABLE "OrganizationSettings" ADD COLUMN IF NOT EXISTS "codebaseRetentionDays" INTEGER;
