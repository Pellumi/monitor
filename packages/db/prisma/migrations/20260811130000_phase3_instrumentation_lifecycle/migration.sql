CREATE TYPE "InstrumentationPlanStatus" AS ENUM (
  'PROPOSED', 'APPROVED', 'APPLYING', 'APPLIED', 'VALIDATING', 'COMPLETED',
  'VALIDATION_FAILED', 'STALE', 'REJECTED', 'FAILED', 'ROLLED_BACK'
);

CREATE TYPE "PatchSetStatus" AS ENUM (
  'CHECKPOINTED', 'APPLYING', 'APPLIED', 'VALIDATED', 'VALIDATION_FAILED',
  'ROLLING_BACK', 'ROLLED_BACK', 'ROLLBACK_FAILED'
);

ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'INSTRUMENTATION_PLAN_CREATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'INSTRUMENTATION_PLAN_APPROVED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'INSTRUMENTATION_PLAN_REJECTED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'INSTRUMENTATION_APPLIED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'INSTRUMENTATION_VALIDATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'INSTRUMENTATION_ROLLED_BACK';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'INSTRUMENTATION_FAILED';

ALTER TABLE "InstrumentationPlan"
  ADD COLUMN "environmentId" TEXT,
  ADD COLUMN "deviceSessionId" TEXT,
  ADD COLUMN "taskKey" TEXT,
  ADD COLUMN "contractVersion" TEXT NOT NULL DEFAULT '1.0',
  ADD COLUMN "manifestVersion" TEXT NOT NULL DEFAULT '1.0',
  ADD COLUMN "frameworkVersion" TEXT,
  ADD COLUMN "supportedVersionRange" TEXT,
  ADD COLUMN "approvedCommandIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "approvalHash" TEXT,
  ADD COLUMN "baseRevision" TEXT,
  ADD COLUMN "repositoryFingerprint" TEXT,
  ADD COLUMN "targetFileHashes" JSONB,
  ADD COLUMN "evidenceJson" JSONB,
  ADD COLUMN "commandManifest" JSONB,
  ADD COLUMN "eventMappingManifest" JSONB,
  ADD COLUMN "staleReasonSafe" TEXT,
  ADD COLUMN "rejectionReasonSafe" TEXT,
  ADD COLUMN "failureReasonSafe" TEXT,
  ADD COLUMN "approvedByUserId" TEXT,
  ADD COLUMN "expiresAt" TIMESTAMP(3);

UPDATE "InstrumentationPlan"
SET "taskKey" = md5("id" || ':' || "workspaceId") || md5("workspaceId" || ':' || "id")
WHERE "taskKey" IS NULL;

ALTER TABLE "InstrumentationPlan" ALTER COLUMN "taskKey" SET NOT NULL;
ALTER TABLE "InstrumentationPlan"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "InstrumentationPlanStatus" USING
    CASE
      WHEN "status" IN ('PROPOSED','APPROVED','APPLYING','APPLIED','VALIDATING','COMPLETED','VALIDATION_FAILED','STALE','REJECTED','FAILED','ROLLED_BACK')
        THEN "status"::"InstrumentationPlanStatus"
      ELSE 'FAILED'::"InstrumentationPlanStatus"
    END,
  ALTER COLUMN "status" SET DEFAULT 'PROPOSED';

CREATE UNIQUE INDEX "InstrumentationPlan_workspaceId_taskKey_key" ON "InstrumentationPlan"("workspaceId", "taskKey");
CREATE INDEX "InstrumentationPlan_environmentId_status_idx" ON "InstrumentationPlan"("environmentId", "status");

ALTER TABLE "PatchSet"
  ADD COLUMN "checkpointKind" TEXT NOT NULL DEFAULT 'LOCAL',
  ADD COLUMN "manifestVersion" TEXT NOT NULL DEFAULT '1.0',
  ADD COLUMN "approvedScopeHash" TEXT,
  ADD COLUMN "commandResultsJson" JSONB,
  ADD COLUMN "rollbackJson" JSONB,
  ADD COLUMN "failureReasonSafe" TEXT,
  ADD COLUMN "appliedByUserId" TEXT,
  ADD COLUMN "rolledBackByUserId" TEXT,
  ADD COLUMN "validatedAt" TIMESTAMP(3);

ALTER TABLE "PatchSet"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "PatchSetStatus" USING
    CASE
      WHEN "status" = 'PLANNED' THEN 'CHECKPOINTED'::"PatchSetStatus"
      WHEN "status" IN ('CHECKPOINTED','APPLYING','APPLIED','VALIDATED','VALIDATION_FAILED','ROLLING_BACK','ROLLED_BACK','ROLLBACK_FAILED')
        THEN "status"::"PatchSetStatus"
      ELSE 'ROLLBACK_FAILED'::"PatchSetStatus"
    END,
  ALTER COLUMN "status" SET DEFAULT 'CHECKPOINTED';
