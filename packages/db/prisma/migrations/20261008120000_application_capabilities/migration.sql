-- CreateEnum
CREATE TYPE "ArchitectureType" AS ENUM ('FRONTEND', 'BACKEND', 'MIXED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "ArchitectureConfidence" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "ApplicationProfileState" AS ENUM ('DETECTED', 'CONFIRMED', 'DISPUTED', 'STALE', 'UNKNOWN_PENDING');

-- CreateEnum
CREATE TYPE "ProfileRevisionReason" AS ENUM ('DETECTED', 'CONFIRMED', 'CORRECTED', 'REANALYZED', 'TRAIT_CHANGED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'APPLICATION_ARCHITECTURE_CONFIRMED';
ALTER TYPE "AuditAction" ADD VALUE 'APPLICATION_ARCHITECTURE_CORRECTED';

-- CreateTable
CREATE TABLE "ApplicationArchitectureProfile" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "detectedType" "ArchitectureType" NOT NULL,
    "confirmedType" "ArchitectureType",
    "effectiveType" "ArchitectureType" NOT NULL,
    "confidence" "ArchitectureConfidence" NOT NULL,
    "state" "ApplicationProfileState" NOT NULL,
    "traits" JSONB NOT NULL,
    "frameworks" JSONB NOT NULL,
    "workspaceRoot" TEXT NOT NULL DEFAULT '.',
    "workspaceCandidates" JSONB,
    "analysisSnapshotId" TEXT,
    "repositorySnapshotId" TEXT,
    "analyzedCommit" TEXT,
    "detectorVersion" TEXT NOT NULL,
    "reviewRequired" BOOLEAN NOT NULL DEFAULT false,
    "detectedAt" TIMESTAMP(3) NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "confirmedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApplicationArchitectureProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationProfileRevision" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "revisionNumber" INTEGER NOT NULL,
    "detectedType" "ArchitectureType" NOT NULL,
    "confirmedType" "ArchitectureType",
    "traits" JSONB NOT NULL,
    "frameworks" JSONB NOT NULL,
    "analysisSnapshotId" TEXT,
    "detectorVersion" TEXT NOT NULL,
    "reason" "ProfileRevisionReason" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApplicationProfileRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationEvidenceSummary" (
    "applicationId" TEXT NOT NULL,
    "frontendEventCount" BIGINT NOT NULL DEFAULT 0,
    "backendEventCount" BIGINT NOT NULL DEFAULT 0,
    "browserEventCount" BIGINT NOT NULL DEFAULT 0,
    "frontendLastSeenAt" TIMESTAMP(3),
    "backendLastSeenAt" TIMESTAMP(3),
    "sessionCount" INTEGER NOT NULL DEFAULT 0,
    "runCount" INTEGER NOT NULL DEFAULT 0,
    "inFlowEventCount" BIGINT NOT NULL DEFAULT 0,
    "endpointCount" INTEGER NOT NULL DEFAULT 0,
    "observedStateCount" INTEGER NOT NULL DEFAULT 0,
    "observedWorkflowCount" INTEGER NOT NULL DEFAULT 0,
    "declaredFlowCount" INTEGER NOT NULL DEFAULT 0,
    "behaviorGraphVersion" TEXT,
    "reviewRequired" BOOLEAN NOT NULL DEFAULT false,
    "evidenceSyncedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApplicationEvidenceSummary_pkey" PRIMARY KEY ("applicationId")
);

-- CreateTable
CREATE TABLE "ApplicationCapabilitySnapshot" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "capabilityKey" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "reasonCode" TEXT,
    "mode" TEXT,
    "resolverVersion" INTEGER NOT NULL,
    "profileRevisionId" TEXT,
    "evidenceRevision" INTEGER NOT NULL DEFAULT 0,
    "resolvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApplicationCapabilitySnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationCapabilityStateChange" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "capabilityKey" TEXT NOT NULL,
    "previousState" TEXT,
    "newState" TEXT NOT NULL,
    "reasonCode" TEXT,
    "resolverVersion" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApplicationCapabilityStateChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ApplicationArchitectureProfile_applicationId_key" ON "ApplicationArchitectureProfile"("applicationId");

-- CreateIndex
CREATE INDEX "ApplicationArchitectureProfile_organizationId_idx" ON "ApplicationArchitectureProfile"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "ApplicationProfileRevision_applicationId_revisionNumber_key" ON "ApplicationProfileRevision"("applicationId", "revisionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ApplicationCapabilitySnapshot_applicationId_capabilityKey_key" ON "ApplicationCapabilitySnapshot"("applicationId", "capabilityKey");

-- CreateIndex
CREATE INDEX "ApplicationCapabilityStateChange_applicationId_capabilityKe_idx" ON "ApplicationCapabilityStateChange"("applicationId", "capabilityKey", "createdAt");

-- AddForeignKey
ALTER TABLE "ApplicationArchitectureProfile" ADD CONSTRAINT "ApplicationArchitectureProfile_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationProfileRevision" ADD CONSTRAINT "ApplicationProfileRevision_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationEvidenceSummary" ADD CONSTRAINT "ApplicationEvidenceSummary_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationCapabilitySnapshot" ADD CONSTRAINT "ApplicationCapabilitySnapshot_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationCapabilityStateChange" ADD CONSTRAINT "ApplicationCapabilityStateChange_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

