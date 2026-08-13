ALTER TABLE "Subscription" ADD COLUMN "nonRenewing" BOOLEAN NOT NULL DEFAULT false;
ALTER TYPE "OtpPurpose" ADD VALUE IF NOT EXISTS 'ACCOUNT_DELETION';
UPDATE "Subscription" s SET "nonRenewing" = true, "activeProvider" = NULL,
  "providerCustomerId" = NULL, "providerSubscriptionId" = NULL, "providerPlanCode" = NULL,
  "providerManagementToken" = NULL, "providerPeriodStart" = NULL, "providerPeriodEnd" = NULL,
  "providerNextChargeAt" = NULL, "paymentMethodReference" = NULL
FROM "Plan" p WHERE s."planId" = p.id AND p.type = 'FREE';

ALTER TABLE "User" ADD COLUMN "deletedAt" TIMESTAMP(3), ADD COLUMN "deletionScheduledFor" TIMESTAMP(3),
  ADD COLUMN "deletionStatus" TEXT NOT NULL DEFAULT 'ACTIVE', ADD COLUMN "deletionLegalHold" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Organization" ADD COLUMN "deletedAt" TIMESTAMP(3), ADD COLUMN "deletionScheduledFor" TIMESTAMP(3),
  ADD COLUMN "deletionStatus" TEXT NOT NULL DEFAULT 'ACTIVE', ADD COLUMN "deletionLegalHold" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "AccountDeletionRequest" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
  "confirmationPhrase" TEXT NOT NULL, "organizationIds" TEXT[], "scheduledFor" TIMESTAMP(3) NOT NULL,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "purgeStartedAt" TIMESTAMP(3),
  "purgeCompletedAt" TIMESTAMP(3), "lastCheckpoint" TEXT, "processingError" TEXT,
  "requestedIpHash" TEXT, "requestedUserAgent" TEXT,
  CONSTRAINT "AccountDeletionRequest_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AccountDeletionRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "AccountDeletionRequest_status_scheduledFor_idx" ON "AccountDeletionRequest"("status", "scheduledFor");
CREATE INDEX "AccountDeletionRequest_userId_requestedAt_idx" ON "AccountDeletionRequest"("userId", "requestedAt");
