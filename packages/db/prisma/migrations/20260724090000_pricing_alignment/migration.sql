ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'BILLING_PROFILE_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'ENTERPRISE_SALES_REQUESTED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'RETENTION_DATA_DELETED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PROGRAMMATIC_TOKEN_CREATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PROGRAMMATIC_TOKEN_REVOKED';

ALTER TABLE "Subscription"
  ADD COLUMN IF NOT EXISTS "pendingPlanId" TEXT,
  ADD COLUMN IF NOT EXISTS "pendingChangeAt" TIMESTAMP(3);

ALTER TABLE "Subscription"
  ADD CONSTRAINT "Subscription_pendingPlanId_fkey"
  FOREIGN KEY ("pendingPlanId") REFERENCES "Plan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "OrganizationBillingProfile" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "countryCode" TEXT NOT NULL,
  "legalName" TEXT,
  "billingEmail" TEXT,
  "addressLine1" TEXT,
  "addressLine2" TEXT,
  "city" TEXT,
  "region" TEXT,
  "postalCode" TEXT,
  "taxId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OrganizationBillingProfile_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OrganizationBillingProfile_organizationId_key" UNIQUE ("organizationId"),
  CONSTRAINT "OrganizationBillingProfile_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "SubscriptionTrialHistory" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "planType" "PlanType" NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL,
  "endedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SubscriptionTrialHistory_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SubscriptionTrialHistory_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "SubscriptionTrialHistory_organizationId_createdAt_idx" ON "SubscriptionTrialHistory"("organizationId", "createdAt");

CREATE TABLE "StorageLedgerEntry" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "objectKey" TEXT NOT NULL,
  "ownerType" TEXT NOT NULL,
  "ownerId" TEXT,
  "category" TEXT NOT NULL,
  "bytes" BIGINT NOT NULL,
  "reservedBytes" BIGINT NOT NULL DEFAULT 0,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StorageLedgerEntry_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StorageLedgerEntry_objectKey_key" UNIQUE ("objectKey"),
  CONSTRAINT "StorageLedgerEntry_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "StorageLedgerEntry_organizationId_deletedAt_idx" ON "StorageLedgerEntry"("organizationId", "deletedAt");

CREATE TABLE "ProgrammaticAccessToken" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "createdByUserId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "tokenPrefix" TEXT NOT NULL,
  "label" TEXT,
  "scopes" TEXT[],
  "expiresAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "lastUsedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProgrammaticAccessToken_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProgrammaticAccessToken_tokenHash_key" UNIQUE ("tokenHash"),
  CONSTRAINT "ProgrammaticAccessToken_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ProgrammaticAccessToken_organizationId_revokedAt_idx" ON "ProgrammaticAccessToken"("organizationId", "revokedAt");

CREATE TABLE "EnterpriseSalesRequest" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "requesterUserId" TEXT NOT NULL,
  "currentPlan" "PlanType" NOT NULL,
  "requestedCapabilities" TEXT[],
  "deploymentPreference" TEXT,
  "notes" TEXT,
  "status" TEXT NOT NULL DEFAULT 'REQUESTED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EnterpriseSalesRequest_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EnterpriseSalesRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "EnterpriseSalesRequest_organizationId_status_idx" ON "EnterpriseSalesRequest"("organizationId", "status");

CREATE TABLE "EnterpriseAgreement" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "contractStart" TIMESTAMP(3),
  "contractEnd" TIMESTAMP(3),
  "annualCommitment" BOOLEAN NOT NULL DEFAULT true,
  "legalHold" BOOLEAN NOT NULL DEFAULT false,
  "dataResidencyRegion" TEXT,
  "negotiatedLimits" JSONB,
  "negotiatedSupport" JSONB,
  "capabilities" JSONB NOT NULL,
  "approvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EnterpriseAgreement_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EnterpriseAgreement_organizationId_key" UNIQUE ("organizationId"),
  CONSTRAINT "EnterpriseAgreement_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
