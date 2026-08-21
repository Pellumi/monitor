CREATE TYPE "FlowLifecycleStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED', 'SUPERSEDED');
CREATE TYPE "FlowNodeRole" AS ENUM ('NORMAL', 'INITIAL', 'TERMINAL');
CREATE TYPE "FlowTerminalKind" AS ENUM ('SUCCESS', 'FAILURE', 'CANCELLATION', 'ALTERNATE');
CREATE TYPE "FlowBindingStatus" AS ENUM ('PENDING_INITIALIZATION', 'INITIALIZING', 'ACTIVE', 'STALE', 'FAILED', 'REQUIRES_REBASE');
CREATE TYPE "FlowScanKind" AS ENUM ('INITIALIZATION', 'RESCAN');
CREATE TYPE "FlowScanStatus" AS ENUM ('CREATED', 'SCANNING', 'ANALYZING', 'COMPLETED', 'FAILED');
CREATE TYPE "FlowInitializationStatus" AS ENUM ('PROPOSED', 'APPROVED', 'APPLYING', 'VALIDATING', 'COMPLETED', 'FAILED', 'ROLLED_BACK');
CREATE TYPE "QACaptureTrack" AS ENUM ('FRONTEND', 'BACKEND');
CREATE TYPE "InstrumentationPurpose" AS ENUM ('BOOTSTRAP', 'FLOW');

ALTER TYPE "QARunStatus" ADD VALUE 'ARMED';
ALTER TYPE "QARunStatus" ADD VALUE 'WAITING_FOR_INITIAL';
ALTER TYPE "QARunStatus" ADD VALUE 'RECORDING';
ALTER TYPE "QARunStatus" ADD VALUE 'COMPLETED_INCOMPLETE';

ALTER TABLE "BehaviorGraph"
  ADD COLUMN "lifecycleStatus" "FlowLifecycleStatus" NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN "purpose" TEXT,
  ADD COLUMN "scopeStatement" TEXT,
  ADD COLUMN "exclusions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "publishedVersionId" TEXT,
  ADD COLUMN "supersededByFlowId" TEXT;

UPDATE "BehaviorGraph"
SET "lifecycleStatus" = CASE WHEN "status" = 'COMPLETE' THEN 'PUBLISHED'::"FlowLifecycleStatus" ELSE 'DRAFT'::"FlowLifecycleStatus" END;

ALTER TABLE "BehaviorGraphNode"
  ADD COLUMN "role" "FlowNodeRole" NOT NULL DEFAULT 'NORMAL',
  ADD COLUMN "terminalKind" "FlowTerminalKind",
  ADD COLUMN "description" TEXT,
  ADD COLUMN "actor" TEXT,
  ADD COLUMN "system" TEXT,
  ADD COLUMN "componentRef" TEXT,
  ADD COLUMN "endpointRef" TEXT,
  ADD COLUMN "expectedInput" JSONB,
  ADD COLUMN "expectedOutput" JSONB;

ALTER TABLE "BehaviorGraphEdge"
  ADD COLUMN "condition" TEXT,
  ADD COLUMN "actor" TEXT,
  ADD COLUMN "system" TEXT,
  ADD COLUMN "componentRef" TEXT,
  ADD COLUMN "endpointRef" TEXT,
  ADD COLUMN "expectedInput" JSONB,
  ADD COLUMN "expectedOutput" JSONB;

ALTER TABLE "BehaviorGraphVersion"
  ADD COLUMN "lifecycleStatus" "FlowLifecycleStatus" NOT NULL DEFAULT 'PUBLISHED',
  ADD COLUMN "diagramRendererVersion" TEXT NOT NULL DEFAULT '1.0',
  ADD COLUMN "diagramProjectionMetadata" JSONB,
  ADD COLUMN "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "publishedById" TEXT,
  ADD COLUMN "derivedFromVersionId" TEXT;

ALTER TABLE "InstrumentationPlan"
  ADD COLUMN "purpose" "InstrumentationPurpose" NOT NULL DEFAULT 'BOOTSTRAP',
  ADD COLUMN "flowId" TEXT,
  ADD COLUMN "flowVersionId" TEXT;

CREATE TABLE "ProjectConnection" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "applicationId" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "environmentId" TEXT NOT NULL,
  "createdByUserId" TEXT NOT NULL,
  "detectedStack" JSONB,
  "sdkTargets" JSONB,
  "initializationEventVerified" BOOLEAN NOT NULL DEFAULT false,
  "initializationEventAt" TIMESTAMP(3),
  "connectedAt" TIMESTAMP(3),
  "lastVerifiedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProjectConnection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FlowProjectBinding" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "applicationId" TEXT NOT NULL,
  "flowId" TEXT NOT NULL,
  "flowVersionId" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "environmentId" TEXT NOT NULL,
  "status" "FlowBindingStatus" NOT NULL DEFAULT 'PENDING_INITIALIZATION',
  "currentScanId" TEXT,
  "currentPatchSetId" TEXT,
  "initializedAt" TIMESTAMP(3),
  "lastRescannedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FlowProjectBinding_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FlowScan" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "applicationId" TEXT NOT NULL,
  "flowId" TEXT NOT NULL,
  "flowVersionId" TEXT NOT NULL,
  "bindingId" TEXT NOT NULL,
  "repositorySnapshotId" TEXT NOT NULL,
  "parentScanId" TEXT,
  "kind" "FlowScanKind" NOT NULL,
  "status" "FlowScanStatus" NOT NULL DEFAULT 'CREATED',
  "scannerVersion" TEXT NOT NULL,
  "detectedRoutes" JSONB,
  "detectedComponents" JSONB,
  "detectedEndpoints" JSONB,
  "conformanceFindings" JSONB,
  "errorMessageSafe" TEXT,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FlowScan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FlowInitialization" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "applicationId" TEXT NOT NULL,
  "flowId" TEXT NOT NULL,
  "flowVersionId" TEXT NOT NULL,
  "bindingId" TEXT NOT NULL,
  "scanId" TEXT NOT NULL,
  "instrumentationPlanId" TEXT,
  "patchSetId" TEXT,
  "status" "FlowInitializationStatus" NOT NULL DEFAULT 'PROPOSED',
  "codeReviewReport" JSONB,
  "validation" JSONB,
  "failureReasonSafe" TEXT,
  "approvedByUserId" TEXT,
  "approvedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FlowInitialization_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FlowDrift" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "applicationId" TEXT NOT NULL,
  "flowId" TEXT NOT NULL,
  "flowVersionId" TEXT NOT NULL,
  "previousScanId" TEXT NOT NULL,
  "currentScanId" TEXT NOT NULL,
  "implementationDiff" JSONB NOT NULL,
  "previousConformance" JSONB NOT NULL,
  "currentConformance" JSONB NOT NULL,
  "remediationAlignment" JSONB,
  "regressions" JSONB,
  "edgeCases" JSONB,
  "expectedFlowImpact" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FlowDrift_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "QARunProgressEvent" (
  "id" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "stateKey" TEXT,
  "accepted" BOOLEAN NOT NULL DEFAULT true,
  "reason" TEXT,
  "metadata" JSONB,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "QARunProgressEvent_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "QARun"
  ADD COLUMN "flowId" TEXT,
  ADD COLUMN "flowBindingId" TEXT,
  ADD COLUMN "flowInitializationId" TEXT,
  ADD COLUMN "flowScanId" TEXT,
  ADD COLUMN "flowDriftId" TEXT,
  ADD COLUMN "captureTracks" "QACaptureTrack"[] NOT NULL DEFAULT ARRAY['FRONTEND']::"QACaptureTrack"[],
  ADD COLUMN "initialStateKey" TEXT,
  ADD COLUMN "terminalStateKeys" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "lastObservedStateKey" TEXT,
  ADD COLUMN "boundaryStartedAt" TIMESTAMP(3),
  ADD COLUMN "boundaryCompletedAt" TIMESTAMP(3),
  ADD COLUMN "completionReason" TEXT,
  ADD COLUMN "timeoutAt" TIMESTAMP(3);

ALTER TABLE "ReconciliationReport"
  ADD COLUMN "flowVersionId" TEXT,
  ADD COLUMN "qaRunId" TEXT;

CREATE UNIQUE INDEX "ProjectConnection_workspaceId_environmentId_key" ON "ProjectConnection"("workspaceId", "environmentId");
CREATE INDEX "ProjectConnection_organizationId_applicationId_idx" ON "ProjectConnection"("organizationId", "applicationId");
CREATE UNIQUE INDEX "FlowProjectBinding_flowVersionId_workspaceId_environmentId_key" ON "FlowProjectBinding"("flowVersionId", "workspaceId", "environmentId");
CREATE INDEX "FlowProjectBinding_applicationId_flowId_status_idx" ON "FlowProjectBinding"("applicationId", "flowId", "status");
CREATE INDEX "FlowScan_bindingId_createdAt_idx" ON "FlowScan"("bindingId", "createdAt");
CREATE INDEX "FlowScan_applicationId_flowId_status_idx" ON "FlowScan"("applicationId", "flowId", "status");
CREATE UNIQUE INDEX "FlowInitialization_bindingId_flowVersionId_key" ON "FlowInitialization"("bindingId", "flowVersionId");
CREATE INDEX "FlowInitialization_applicationId_flowId_status_idx" ON "FlowInitialization"("applicationId", "flowId", "status");
CREATE UNIQUE INDEX "FlowDrift_previousScanId_currentScanId_key" ON "FlowDrift"("previousScanId", "currentScanId");
CREATE INDEX "FlowDrift_applicationId_flowId_createdAt_idx" ON "FlowDrift"("applicationId", "flowId", "createdAt");
CREATE INDEX "QARun_flowId_expectedGraphVersionId_createdAt_idx" ON "QARun"("flowId", "expectedGraphVersionId", "createdAt");
CREATE INDEX "QARun_flowBindingId_status_idx" ON "QARun"("flowBindingId", "status");
CREATE INDEX "QARunProgressEvent_runId_occurredAt_idx" ON "QARunProgressEvent"("runId", "occurredAt");
CREATE INDEX "QARunProgressEvent_runId_accepted_idx" ON "QARunProgressEvent"("runId", "accepted");
CREATE INDEX "ReconciliationReport_flowId_flowVersionId_generatedAt_idx" ON "ReconciliationReport"("flowId", "flowVersionId", "generatedAt");
CREATE INDEX "ReconciliationReport_qaRunId_idx" ON "ReconciliationReport"("qaRunId");
CREATE INDEX "InstrumentationPlan_flowId_flowVersionId_status_idx" ON "InstrumentationPlan"("flowId", "flowVersionId", "status");

ALTER TABLE "ProjectConnection" ADD CONSTRAINT "ProjectConnection_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectConnection" ADD CONSTRAINT "ProjectConnection_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "ProjectWorkspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectConnection" ADD CONSTRAINT "ProjectConnection_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "Environment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FlowProjectBinding" ADD CONSTRAINT "FlowProjectBinding_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "BehaviorGraph"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FlowProjectBinding" ADD CONSTRAINT "FlowProjectBinding_flowVersionId_fkey" FOREIGN KEY ("flowVersionId") REFERENCES "BehaviorGraphVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FlowProjectBinding" ADD CONSTRAINT "FlowProjectBinding_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "ProjectWorkspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FlowProjectBinding" ADD CONSTRAINT "FlowProjectBinding_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "Environment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FlowScan" ADD CONSTRAINT "FlowScan_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "BehaviorGraph"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FlowScan" ADD CONSTRAINT "FlowScan_flowVersionId_fkey" FOREIGN KEY ("flowVersionId") REFERENCES "BehaviorGraphVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FlowScan" ADD CONSTRAINT "FlowScan_bindingId_fkey" FOREIGN KEY ("bindingId") REFERENCES "FlowProjectBinding"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FlowScan" ADD CONSTRAINT "FlowScan_repositorySnapshotId_fkey" FOREIGN KEY ("repositorySnapshotId") REFERENCES "RepositorySnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FlowScan" ADD CONSTRAINT "FlowScan_parentScanId_fkey" FOREIGN KEY ("parentScanId") REFERENCES "FlowScan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FlowInitialization" ADD CONSTRAINT "FlowInitialization_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "BehaviorGraph"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FlowInitialization" ADD CONSTRAINT "FlowInitialization_flowVersionId_fkey" FOREIGN KEY ("flowVersionId") REFERENCES "BehaviorGraphVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FlowInitialization" ADD CONSTRAINT "FlowInitialization_bindingId_fkey" FOREIGN KEY ("bindingId") REFERENCES "FlowProjectBinding"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FlowInitialization" ADD CONSTRAINT "FlowInitialization_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "FlowScan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FlowDrift" ADD CONSTRAINT "FlowDrift_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "BehaviorGraph"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FlowDrift" ADD CONSTRAINT "FlowDrift_flowVersionId_fkey" FOREIGN KEY ("flowVersionId") REFERENCES "BehaviorGraphVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FlowDrift" ADD CONSTRAINT "FlowDrift_previousScanId_fkey" FOREIGN KEY ("previousScanId") REFERENCES "FlowScan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FlowDrift" ADD CONSTRAINT "FlowDrift_currentScanId_fkey" FOREIGN KEY ("currentScanId") REFERENCES "FlowScan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "QARun" ADD CONSTRAINT "QARun_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "BehaviorGraph"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "QARun" ADD CONSTRAINT "QARun_flowBindingId_fkey" FOREIGN KEY ("flowBindingId") REFERENCES "FlowProjectBinding"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "QARun" ADD CONSTRAINT "QARun_flowInitializationId_fkey" FOREIGN KEY ("flowInitializationId") REFERENCES "FlowInitialization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "QARun" ADD CONSTRAINT "QARun_flowScanId_fkey" FOREIGN KEY ("flowScanId") REFERENCES "FlowScan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "QARun" ADD CONSTRAINT "QARun_flowDriftId_fkey" FOREIGN KEY ("flowDriftId") REFERENCES "FlowDrift"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "QARunProgressEvent" ADD CONSTRAINT "QARunProgressEvent_runId_fkey" FOREIGN KEY ("runId") REFERENCES "QARun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Existing published declared graphs become explicit compatibility flows.
UPDATE "BehaviorGraph"
SET "purpose" = COALESCE("purpose", 'Legacy application analysis'),
    "scopeStatement" = COALESCE("scopeStatement", 'Imported from the pre-flow-centric Tellann graph model')
WHERE "status" = 'COMPLETE';
