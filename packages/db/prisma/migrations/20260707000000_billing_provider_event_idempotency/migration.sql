-- Billing provider event idempotency and invoice reconciliation

ALTER TABLE "Invoice"
  ADD COLUMN IF NOT EXISTS "provider" TEXT,
  ADD COLUMN IF NOT EXISTS "providerReference" TEXT,
  ADD COLUMN IF NOT EXISTS "providerCustomerId" TEXT,
  ADD COLUMN IF NOT EXISTS "providerSubscriptionId" TEXT;

UPDATE "Invoice"
SET
  "provider" = COALESCE(
    "provider",
    CASE
      WHEN "stripeInvoiceId" IS NOT NULL THEN 'STRIPE'
      WHEN "paystackRef" IS NOT NULL THEN 'PAYSTACK'
      ELSE NULL
    END
  ),
  "providerReference" = COALESCE("providerReference", "stripeInvoiceId", "paystackRef")
WHERE "provider" IS NULL OR "providerReference" IS NULL;

CREATE INDEX IF NOT EXISTS "Invoice_provider_providerSubscriptionId_idx"
  ON "Invoice"("provider", "providerSubscriptionId");

CREATE UNIQUE INDEX IF NOT EXISTS "Invoice_provider_providerReference_key"
  ON "Invoice"("provider", "providerReference");

ALTER TABLE "PaymentEvent"
  ADD COLUMN IF NOT EXISTS "providerEventId" TEXT,
  ADD COLUMN IF NOT EXISTS "providerReference" TEXT,
  ADD COLUMN IF NOT EXISTS "invoiceId" TEXT,
  ADD COLUMN IF NOT EXISTS "processingStatus" TEXT NOT NULL DEFAULT 'PROCESSED',
  ADD COLUMN IF NOT EXISTS "processingError" TEXT,
  ADD COLUMN IF NOT EXISTS "receivedAt" TIMESTAMP NOT NULL DEFAULT NOW();

ALTER TABLE "PaymentEvent"
  ALTER COLUMN "processedAt" DROP DEFAULT,
  ALTER COLUMN "processedAt" DROP NOT NULL;

UPDATE "PaymentEvent"
SET "providerEventId" = COALESCE("providerEventId", "payload"->>'id')
WHERE "providerEventId" IS NULL
  AND "payload" ? 'id';

UPDATE "PaymentEvent"
SET "providerReference" = COALESCE(
  "providerReference",
  "payload"->'data'->'object'->>'id',
  "payload"->'data'->>'reference',
  "payload"->>'reference'
)
WHERE "providerReference" IS NULL;

UPDATE "PaymentEvent"
SET "invoiceId" = COALESCE(
  "invoiceId",
  "payload"->'data'->'object'->'metadata'->>'invoiceId',
  "payload"->'data'->'metadata'->>'invoiceId',
  "payload"->'metadata'->>'invoiceId',
  "payload"->>'invoiceId'
)
WHERE "invoiceId" IS NULL;

CREATE INDEX IF NOT EXISTS "PaymentEvent_invoiceId_idx"
  ON "PaymentEvent"("invoiceId");

CREATE INDEX IF NOT EXISTS "PaymentEvent_provider_providerReference_idx"
  ON "PaymentEvent"("provider", "providerReference");

CREATE UNIQUE INDEX IF NOT EXISTS "PaymentEvent_provider_providerEventId_key"
  ON "PaymentEvent"("provider", "providerEventId");

DO $$ BEGIN
  ALTER TABLE "PaymentEvent"
    ADD CONSTRAINT "PaymentEvent_invoiceId_fkey"
    FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;