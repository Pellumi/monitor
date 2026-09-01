-- Branch policy enforcement mode for an application's QA review branch.
CREATE TYPE "BranchPolicyEnforcement" AS ENUM ('WARN', 'BLOCK');

-- Agent-performed QA branch switching is an explicit, revocable grant.
ALTER TYPE "DesktopPermissionType" ADD VALUE 'MANAGE_QA_BRANCH';

-- A ProjectWorkspace is one member's checkout on one machine. The old unique key
-- collapsed every member of an organisation onto a single row whenever their
-- desktop happened to produce the same opaque id. Widening the key is safe: it
-- can only ever admit rows the narrower key already permitted.
ALTER TABLE "ProjectWorkspace"
DROP CONSTRAINT IF EXISTS "ProjectWorkspace_applicationId_opaqueLocalId_key";

DROP INDEX IF EXISTS "ProjectWorkspace_applicationId_opaqueLocalId_key";

ALTER TABLE "ProjectWorkspace"
ADD COLUMN "portableManifestIdentity" TEXT;

CREATE UNIQUE INDEX "ProjectWorkspace_applicationId_createdByUserId_opaqueLocalId_key"
ON "ProjectWorkspace"("applicationId", "createdByUserId", "opaqueLocalId");

CREATE INDEX "ProjectWorkspace_applicationId_createdByUserId_idx"
ON "ProjectWorkspace"("applicationId", "createdByUserId");

-- Divergence of a member's checkout from the shared QA branch.
ALTER TABLE "RepositorySnapshot"
ADD COLUMN "upstreamBranch" TEXT,
ADD COLUMN "aheadCount" INTEGER,
ADD COLUMN "behindCount" INTEGER;

-- The org-owned repository binding and QA branch policy.
CREATE TABLE "ApplicationRepositoryBinding" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "repositoryOriginHash" TEXT,
    "repositoryCloneUrl" TEXT,
    "portableManifestIdentity" TEXT,
    "qaBranchName" TEXT NOT NULL DEFAULT 'tellann/qa-review',
    "qaBranchBase" TEXT NOT NULL DEFAULT 'main',
    "enforcement" "BranchPolicyEnforcement" NOT NULL DEFAULT 'WARN',
    "allowAgentCheckout" BOOLEAN NOT NULL DEFAULT false,
    "boundByUserId" TEXT,
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApplicationRepositoryBinding_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ApplicationRepositoryBinding_applicationId_key"
ON "ApplicationRepositoryBinding"("applicationId");

CREATE INDEX "ApplicationRepositoryBinding_repositoryOriginHash_idx"
ON "ApplicationRepositoryBinding"("repositoryOriginHash");

ALTER TABLE "ApplicationRepositoryBinding"
ADD CONSTRAINT "ApplicationRepositoryBinding_applicationId_fkey"
FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
