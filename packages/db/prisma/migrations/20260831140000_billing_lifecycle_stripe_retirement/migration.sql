-- Retire Stripe and add the self-managed billing lifecycle.
--
-- Stripe is fully deprecated: USD now settles through Flutterwave and NGN
-- through Paystack or Flutterwave, so the Stripe customer/subscription/invoice
-- handles and the Stripe-to-Paystack migrationStatus have no remaining reader.
--
-- The new Subscription columns move recurring billing in-house: Tellann
-- schedules its own charges against the stored payment method (a Paystack
-- authorization code or a Flutterwave card token) instead of relying on
-- processor-side subscriptions. That is what makes a free trial, prorated plan
-- changes, and a uniform grace period behave the same on every processor.
--
-- Invoice gains the tax detail BSS §17 requires on the printed document.

-- AlterTable
ALTER TABLE "Invoice" DROP COLUMN "stripeInvoiceId",
ADD COLUMN     "reason" TEXT NOT NULL DEFAULT 'SUBSCRIPTION',
ADD COLUMN     "taxJurisdiction" TEXT,
ADD COLUMN     "taxLabel" TEXT,
ADD COLUMN     "taxRate" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Subscription" DROP COLUMN "migrationStatus",
DROP COLUMN "stripeCustomerId",
DROP COLUMN "stripeSubscriptionId",
ADD COLUMN     "billingFailureCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "graceEndsAt" TIMESTAMP(3),
ADD COLUMN     "lapsedAt" TIMESTAMP(3),
ADD COLUMN     "lapsedFromPlanId" TEXT,
ADD COLUMN     "lastBillingAttemptAt" TIMESTAMP(3),
ADD COLUMN     "nextBillingAt" TIMESTAMP(3),
ADD COLUMN     "trialStartedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "UserBillingProfile" DROP COLUMN "stripeCustomerId";

-- CreateIndex
CREATE INDEX "Subscription_nextBillingAt_status_idx" ON "Subscription"("nextBillingAt", "status");

-- CreateIndex
CREATE INDEX "Subscription_trialEndsAt_status_idx" ON "Subscription"("trialEndsAt", "status");

-- CreateIndex
CREATE INDEX "Subscription_graceEndsAt_status_idx" ON "Subscription"("graceEndsAt", "status");

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_lapsedFromPlanId_fkey" FOREIGN KEY ("lapsedFromPlanId") REFERENCES "Plan"("id") ON DELETE SET NULL ON UPDATE CASCADE;



-- Backfill: schedule the next charge for every renewable subscription so the
-- renewal worker picks up existing payers on its first pass rather than
-- silently skipping them.
UPDATE "Subscription"
SET "nextBillingAt" = "currentPeriodEnd"
WHERE "nextBillingAt" IS NULL
  AND "nonRenewing" = false
  AND "status" IN ('ACTIVE', 'TRIAL', 'PAST_DUE', 'GRACE_PERIOD');
