-- CreateEnum
CREATE TYPE "DesktopPermissionType" AS ENUM ('BROWSER_ONLY', 'READ_WORKSPACE', 'PROPOSE_INSTRUMENTATION', 'APPLY_TASK', 'RUN_COMMANDS', 'SENSITIVE_BROWSER_ACTIONS');

-- CreateEnum
CREATE TYPE "WorkspaceTrustStatus" AS ENUM ('UNTRUSTED', 'READ_ONLY', 'TRUSTED', 'REVOKED');

-- CreateEnum
CREATE TYPE "QARunMode" AS ENUM ('GUIDED', 'ASSISTED', 'OBSERVATION_ONLY');

-- CreateEnum
CREATE TYPE "QARunStatus" AS ENUM ('CREATED', 'RUNNING', 'PAUSED', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "QARunArtifactType" AS ENUM ('SCREENSHOT', 'PLAYWRIGHT_TRACE', 'ACCESSIBILITY_SNAPSHOT', 'CONSOLE_LOG', 'NETWORK_LOG', 'RUN_MANIFEST');

-- CreateEnum
CREATE TYPE "PrivacyClassification" AS ENUM ('PUBLIC', 'INTERNAL', 'SENSITIVE', 'RESTRICTED');

-- CreateEnum
CREATE TYPE "SourceDocumentStatus" AS ENUM ('UPLOADING', 'READY', 'PROCESSING', 'PROCESSED', 'FAILED', 'REJECTED');

-- CreateTable
CREATE TABLE "DeviceSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT,
    "deviceIdentifier" TEXT NOT NULL,
    "deviceName" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "appVersion" TEXT NOT NULL,
    "publicKey" TEXT,
    "scopes" TEXT[],
    "refreshTokenHash" TEXT NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeviceSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DesktopAuthorizationRequest" (
    "id" TEXT NOT NULL,
    "requestTokenHash" TEXT NOT NULL,
    "codeChallenge" TEXT NOT NULL,
    "challengeMethod" TEXT NOT NULL DEFAULT 'S256',
    "deviceIdentifier" TEXT NOT NULL,
    "deviceName" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "appVersion" TEXT NOT NULL,
    "scopes" TEXT[],
    "userId" TEXT,
    "authorizationHash" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "authorizedAt" TIMESTAMP(3),
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DesktopAuthorizationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectWorkspace" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "opaqueLocalId" TEXT NOT NULL,
    "repositoryFingerprint" TEXT NOT NULL,
    "repositoryOriginHash" TEXT,
    "detectedStack" JSONB,
    "packageManager" TEXT,
    "trustStatus" "WorkspaceTrustStatus" NOT NULL DEFAULT 'UNTRUSTED',
    "lastScannedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectWorkspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PermissionGrant" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "grantedByUserId" TEXT NOT NULL,
    "permissionType" "DesktopPermissionType" NOT NULL,
    "fileScopes" TEXT[],
    "commandScopes" TEXT[],
    "purpose" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PermissionGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RepositorySnapshot" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "revision" TEXT,
    "branch" TEXT,
    "dirty" BOOLEAN NOT NULL,
    "repositoryFingerprint" TEXT NOT NULL,
    "frameworkSummary" JSONB NOT NULL,
    "routeSummary" JSONB NOT NULL,
    "endpointSummary" JSONB NOT NULL,
    "documentationSummary" JSONB NOT NULL,
    "manifestHashes" JSONB NOT NULL,
    "scannerVersion" TEXT NOT NULL,
    "redactionSummary" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RepositorySnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceDocument" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "uploadedByUserId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "objectKey" TEXT,
    "uploadMode" TEXT NOT NULL,
    "status" "SourceDocumentStatus" NOT NULL DEFAULT 'UPLOADING',
    "parserVersion" TEXT,
    "errorMessageSafe" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SourceDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceDocumentVersion" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "extractedSummary" JSONB NOT NULL,
    "redactionSummary" JSONB NOT NULL,
    "structureSummary" JSONB,
    "processorVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SourceDocumentVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntentEvidence" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "evidenceType" TEXT NOT NULL,
    "sourceDocumentId" TEXT,
    "documentVersionId" TEXT,
    "repositoryPathHash" TEXT,
    "sourceLabel" TEXT NOT NULL,
    "excerpt" TEXT,
    "symbol" TEXT,
    "locator" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntentEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstrumentationPlan" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "repositorySnapshotId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "adapterId" TEXT NOT NULL,
    "adapterVersion" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PROPOSED',
    "risk" TEXT NOT NULL,
    "approvedFileScopes" TEXT[],
    "planJson" JSONB NOT NULL,
    "validationJson" JSONB,
    "approvedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstrumentationPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatchSet" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "instrumentationPlanId" TEXT NOT NULL,
    "baseRevision" TEXT,
    "checkpointId" TEXT NOT NULL,
    "diffHash" TEXT NOT NULL,
    "changedFileHashes" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "validationJson" JSONB,
    "appliedAt" TIMESTAMP(3),
    "rolledBackAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PatchSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QARun" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "environmentId" TEXT NOT NULL,
    "workspaceId" TEXT,
    "deviceSessionId" TEXT,
    "repositorySnapshotId" TEXT,
    "expectedGraphVersionId" TEXT,
    "patchSetId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "mode" "QARunMode" NOT NULL,
    "status" "QARunStatus" NOT NULL DEFAULT 'CREATED',
    "targetUrl" TEXT NOT NULL,
    "browserMetadata" JSONB,
    "artifactManifest" JSONB,
    "reconciliationReportId" TEXT,
    "reportId" TEXT,
    "failureReasonSafe" TEXT,
    "retryOfRunId" TEXT,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QARun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QARunArtifact" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "artifactType" "QARunArtifactType" NOT NULL,
    "privacyClassification" "PrivacyClassification" NOT NULL,
    "objectKey" TEXT,
    "bytes" BIGINT NOT NULL,
    "checksum" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QARunArtifact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrowserFinding" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "url" TEXT,
    "viewport" JSONB,
    "reproductionSteps" JSONB NOT NULL,
    "recommendation" TEXT,
    "relatedWorkflowId" TEXT,
    "relatedStateName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BrowserFinding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrowserFindingEvidence" (
    "findingId" TEXT NOT NULL,
    "artifactId" TEXT NOT NULL,

    CONSTRAINT "BrowserFindingEvidence_pkey" PRIMARY KEY ("findingId","artifactId")
);

-- CreateIndex
CREATE UNIQUE INDEX "DeviceSession_refreshTokenHash_key" ON "DeviceSession"("refreshTokenHash");

-- CreateIndex
CREATE INDEX "DeviceSession_userId_revokedAt_idx" ON "DeviceSession"("userId", "revokedAt");

-- CreateIndex
CREATE INDEX "DeviceSession_organizationId_revokedAt_idx" ON "DeviceSession"("organizationId", "revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "DeviceSession_userId_deviceIdentifier_key" ON "DeviceSession"("userId", "deviceIdentifier");

-- CreateIndex
CREATE UNIQUE INDEX "DesktopAuthorizationRequest_requestTokenHash_key" ON "DesktopAuthorizationRequest"("requestTokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "DesktopAuthorizationRequest_authorizationHash_key" ON "DesktopAuthorizationRequest"("authorizationHash");

-- CreateIndex
CREATE INDEX "DesktopAuthorizationRequest_expiresAt_consumedAt_idx" ON "DesktopAuthorizationRequest"("expiresAt", "consumedAt");

-- CreateIndex
CREATE INDEX "DesktopAuthorizationRequest_userId_authorizedAt_idx" ON "DesktopAuthorizationRequest"("userId", "authorizedAt");

-- CreateIndex
CREATE INDEX "ProjectWorkspace_organizationId_applicationId_idx" ON "ProjectWorkspace"("organizationId", "applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectWorkspace_applicationId_opaqueLocalId_key" ON "ProjectWorkspace"("applicationId", "opaqueLocalId");

-- CreateIndex
CREATE INDEX "PermissionGrant_workspaceId_permissionType_revokedAt_idx" ON "PermissionGrant"("workspaceId", "permissionType", "revokedAt");

-- CreateIndex
CREATE INDEX "RepositorySnapshot_workspaceId_createdAt_idx" ON "RepositorySnapshot"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "SourceDocument_organizationId_applicationId_status_idx" ON "SourceDocument"("organizationId", "applicationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "SourceDocument_applicationId_checksum_key" ON "SourceDocument"("applicationId", "checksum");

-- CreateIndex
CREATE UNIQUE INDEX "SourceDocumentVersion_documentId_version_key" ON "SourceDocumentVersion"("documentId", "version");

-- CreateIndex
CREATE INDEX "IntentEvidence_applicationId_evidenceType_idx" ON "IntentEvidence"("applicationId", "evidenceType");

-- CreateIndex
CREATE INDEX "IntentEvidence_sourceDocumentId_idx" ON "IntentEvidence"("sourceDocumentId");

-- CreateIndex
CREATE INDEX "InstrumentationPlan_workspaceId_status_idx" ON "InstrumentationPlan"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "PatchSet_workspaceId_status_idx" ON "PatchSet"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "QARun_organizationId_applicationId_createdAt_idx" ON "QARun"("organizationId", "applicationId", "createdAt");

-- CreateIndex
CREATE INDEX "QARun_environmentId_status_idx" ON "QARun"("environmentId", "status");

-- CreateIndex
CREATE INDEX "QARun_deviceSessionId_idx" ON "QARun"("deviceSessionId");

-- CreateIndex
CREATE INDEX "QARunArtifact_runId_artifactType_idx" ON "QARunArtifact"("runId", "artifactType");

-- CreateIndex
CREATE UNIQUE INDEX "QARunArtifact_runId_checksum_key" ON "QARunArtifact"("runId", "checksum");

-- CreateIndex
CREATE INDEX "BrowserFinding_runId_severity_idx" ON "BrowserFinding"("runId", "severity");

-- AddForeignKey
ALTER TABLE "DeviceSession" ADD CONSTRAINT "DeviceSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceSession" ADD CONSTRAINT "DeviceSession_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectWorkspace" ADD CONSTRAINT "ProjectWorkspace_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectWorkspace" ADD CONSTRAINT "ProjectWorkspace_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PermissionGrant" ADD CONSTRAINT "PermissionGrant_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "ProjectWorkspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepositorySnapshot" ADD CONSTRAINT "RepositorySnapshot_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "ProjectWorkspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceDocument" ADD CONSTRAINT "SourceDocument_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceDocument" ADD CONSTRAINT "SourceDocument_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceDocumentVersion" ADD CONSTRAINT "SourceDocumentVersion_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "SourceDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntentEvidence" ADD CONSTRAINT "IntentEvidence_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "SourceDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntentEvidence" ADD CONSTRAINT "IntentEvidence_documentVersionId_fkey" FOREIGN KEY ("documentVersionId") REFERENCES "SourceDocumentVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstrumentationPlan" ADD CONSTRAINT "InstrumentationPlan_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "ProjectWorkspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstrumentationPlan" ADD CONSTRAINT "InstrumentationPlan_repositorySnapshotId_fkey" FOREIGN KEY ("repositorySnapshotId") REFERENCES "RepositorySnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatchSet" ADD CONSTRAINT "PatchSet_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "ProjectWorkspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatchSet" ADD CONSTRAINT "PatchSet_instrumentationPlanId_fkey" FOREIGN KEY ("instrumentationPlanId") REFERENCES "InstrumentationPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QARun" ADD CONSTRAINT "QARun_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QARun" ADD CONSTRAINT "QARun_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QARun" ADD CONSTRAINT "QARun_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "Environment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QARun" ADD CONSTRAINT "QARun_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "ProjectWorkspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QARun" ADD CONSTRAINT "QARun_deviceSessionId_fkey" FOREIGN KEY ("deviceSessionId") REFERENCES "DeviceSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QARun" ADD CONSTRAINT "QARun_repositorySnapshotId_fkey" FOREIGN KEY ("repositorySnapshotId") REFERENCES "RepositorySnapshot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QARun" ADD CONSTRAINT "QARun_expectedGraphVersionId_fkey" FOREIGN KEY ("expectedGraphVersionId") REFERENCES "BehaviorGraphVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QARun" ADD CONSTRAINT "QARun_patchSetId_fkey" FOREIGN KEY ("patchSetId") REFERENCES "PatchSet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QARunArtifact" ADD CONSTRAINT "QARunArtifact_runId_fkey" FOREIGN KEY ("runId") REFERENCES "QARun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrowserFinding" ADD CONSTRAINT "BrowserFinding_runId_fkey" FOREIGN KEY ("runId") REFERENCES "QARun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrowserFindingEvidence" ADD CONSTRAINT "BrowserFindingEvidence_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "BrowserFinding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrowserFindingEvidence" ADD CONSTRAINT "BrowserFindingEvidence_artifactId_fkey" FOREIGN KEY ("artifactId") REFERENCES "QARunArtifact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
