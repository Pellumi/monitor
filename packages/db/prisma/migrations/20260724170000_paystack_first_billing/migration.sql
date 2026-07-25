ALTER TABLE "Subscription"
  ADD COLUMN IF NOT EXISTS "activeProvider" TEXT,
  ADD COLUMN IF NOT EXISTS "providerCustomerId" TEXT,
  ADD COLUMN IF NOT EXISTS "providerSubscriptionId" TEXT,
  ADD COLUMN IF NOT EXISTS "providerPlanCode" TEXT,
  ADD COLUMN IF NOT EXISTS "providerManagementToken" TEXT,
  ADD COLUMN IF NOT EXISTS "providerPeriodStart" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "providerPeriodEnd" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "providerNextChargeAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "paymentMethodReference" TEXT,
  ADD COLUMN IF NOT EXISTS "paymentMethodBrand" TEXT,
  ADD COLUMN IF NOT EXISTS "paymentMethodLast4" TEXT,
  ADD COLUMN IF NOT EXISTS "paymentMethodExpMonth" TEXT,
  ADD COLUMN IF NOT EXISTS "paymentMethodExpYear" TEXT,
  ADD COLUMN IF NOT EXISTS "paymentMethodAuthorizedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "migrationStatus" TEXT NOT NULL DEFAULT 'NONE';

UPDATE "Subscription"
SET
  "activeProvider" = CASE
    WHEN "paystackSubscriptionCode" IS NOT NULL THEN 'PAYSTACK'
    WHEN "stripeSubscriptionId" IS NOT NULL THEN 'STRIPE'
    ELSE NULL
  END,
  "providerCustomerId" = COALESCE("paystackCustomerCode", "stripeCustomerId"),
  "providerSubscriptionId" = COALESCE("paystackSubscriptionCode", "stripeSubscriptionId"),
  "migrationStatus" = CASE
    WHEN "stripeSubscriptionId" IS NOT NULL THEN 'STRIPE_ACTIVE'
    WHEN "paystackSubscriptionCode" IS NOT NULL THEN 'PAYSTACK_ACTIVE'
    ELSE 'RECONCILIATION_REQUIRED'
  END
WHERE "activeProvider" IS NULL;

CREATE TABLE "BillingProviderPlan" (
  "id" TEXT NOT NULL,
  "planType" "PlanType" NOT NULL,
  "billingInterval" "BillingInterval" NOT NULL,
  "currency" "BillingCurrency" NOT NULL,
  "provider" TEXT NOT NULL,
  "environment" TEXT NOT NULL DEFAULT 'production',
  "providerPlanCode" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "retiredAt" TIMESTAMP(3),
  CONSTRAINT "BillingProviderPlan_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BillingProviderPlan_planType_billingInterval_currency_provider_environment_version_key"
  ON "BillingProviderPlan"("planType", "billingInterval", "currency", "provider", "environment", "version");
CREATE INDEX "BillingProviderPlan_lookup_idx"
  ON "BillingProviderPlan"("planType", "billingInterval", "currency", "provider", "environment", "active");

CREATE TABLE "SubscriptionChange" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "sourcePlanId" TEXT,
  "targetPlanId" TEXT NOT NULL,
  "sourceInterval" "BillingInterval",
  "targetInterval" "BillingInterval" NOT NULL,
  "currency" "BillingCurrency" NOT NULL,
  "direction" TEXT NOT NULL,
  "effectiveMode" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PREVIEWED',
  "previewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "previewExpiresAt" TIMESTAMP(3) NOT NULL,
  "prorationAt" TIMESTAMP(3) NOT NULL,
  "amountDue" INTEGER NOT NULL DEFAULT 0,
  "creditAmount" INTEGER NOT NULL DEFAULT 0,
  "nextCycleAmount" INTEGER NOT NULL,
  "effectiveAt" TIMESTAMP(3),
  "provider" TEXT,
  "providerOperationId" TEXT,
  "providerReference" TEXT,
  "idempotencyKey" TEXT NOT NULL,
  "processingError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SubscriptionChange_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SubscriptionChange_idempotencyKey_key" ON "SubscriptionChange"("idempotencyKey");
CREATE INDEX "SubscriptionChange_organizationId_status_idx" ON "SubscriptionChange"("organizationId", "status");
CREATE INDEX "SubscriptionChange_effectiveAt_status_idx" ON "SubscriptionChange"("effectiveAt", "status");

CREATE TABLE "BillingDunningAttempt" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "invoiceId" TEXT,
  "provider" TEXT NOT NULL,
  "providerReference" TEXT,
  "attemptNumber" INTEGER NOT NULL,
  "scheduledAt" TIMESTAMP(3) NOT NULL,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
  "amount" INTEGER NOT NULL,
  "currency" "BillingCurrency" NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "processingError" TEXT,
  "customerNotifiedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BillingDunningAttempt_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "BillingDunningAttempt_idempotencyKey_key" ON "BillingDunningAttempt"("idempotencyKey");
CREATE UNIQUE INDEX "BillingDunningAttempt_org_reference_attempt_key"
  ON "BillingDunningAttempt"("organizationId", "providerReference", "attemptNumber");
CREATE INDEX "BillingDunningAttempt_scheduledAt_status_idx" ON "BillingDunningAttempt"("scheduledAt", "status");
CREATE INDEX "BillingDunningAttempt_organizationId_status_idx" ON "BillingDunningAttempt"("organizationId", "status");
