-- Move billing identity from organization scope to user scope.
--
-- The payer of record becomes the signed-in user: their ISO billing country
-- drives currency, plan eligibility (Local is NG-only), and provider routing.
-- Organizations remain the entitlement boundary but hold no billing identity.

-- 1. User-scoped billing profile ------------------------------------------------
CREATE TABLE "UserBillingProfile" (
    "id"                    TEXT NOT NULL,
    "userId"                TEXT NOT NULL,
    "countryCode"           TEXT NOT NULL,
    "legalName"             TEXT,
    "billingEmail"          TEXT,
    "addressLine1"          TEXT,
    "addressLine2"          TEXT,
    "city"                  TEXT,
    "region"                TEXT,
    "postalCode"            TEXT,
    "taxId"                 TEXT,
    "stripeCustomerId"      TEXT,
    "paystackCustomerCode"  TEXT,
    "flutterwaveCustomerId" TEXT,
    "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"             TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserBillingProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserBillingProfile_userId_key" ON "UserBillingProfile"("userId");

ALTER TABLE "UserBillingProfile"
    ADD CONSTRAINT "UserBillingProfile_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 2. Payer links -----------------------------------------------------------------
ALTER TABLE "Subscription" ADD COLUMN "payerUserId" TEXT;
ALTER TABLE "Invoice"      ADD COLUMN "payerUserId" TEXT;
ALTER TABLE "SubscriptionTrialHistory" ADD COLUMN "userId" TEXT;

ALTER TABLE "Subscription"
    ADD CONSTRAINT "Subscription_payerUserId_fkey"
    FOREIGN KEY ("payerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Invoice_payerUserId_createdAt_idx" ON "Invoice"("payerUserId", "createdAt");
CREATE INDEX "SubscriptionTrialHistory_userId_createdAt_idx" ON "SubscriptionTrialHistory"("userId", "createdAt");

-- 3. Backfill --------------------------------------------------------------------
-- Each organization's billing profile migrates to that organization's OWNER.
-- Where an owner already has a profile (they own several organizations) the
-- earliest-created organization profile wins and later ones are discarded,
-- because a user now has exactly one billing identity.
INSERT INTO "UserBillingProfile" (
    "id", "userId", "countryCode", "legalName", "billingEmail",
    "addressLine1", "addressLine2", "city", "region", "postalCode", "taxId",
    "createdAt", "updatedAt"
)
SELECT DISTINCT ON (m."userId")
    gen_random_uuid()::text,
    m."userId",
    p."countryCode",
    p."legalName",
    COALESCE(p."billingEmail", u."email"),
    p."addressLine1",
    p."addressLine2",
    p."city",
    p."region",
    p."postalCode",
    p."taxId",
    p."createdAt",
    CURRENT_TIMESTAMP
FROM "OrganizationBillingProfile" p
JOIN "OrganizationMembership" m
  ON m."organizationId" = p."organizationId" AND m."role" = 'OWNER'
JOIN "User" u ON u."id" = m."userId"
ORDER BY m."userId", p."createdAt" ASC
ON CONFLICT ("userId") DO NOTHING;

-- Attribute existing subscriptions and invoices to the organization owner.
UPDATE "Subscription" s
SET "payerUserId" = m."userId"
FROM "OrganizationMembership" m
WHERE m."organizationId" = s."organizationId"
  AND m."role" = 'OWNER'
  AND s."payerUserId" IS NULL;

UPDATE "Invoice" i
SET "payerUserId" = m."userId"
FROM "OrganizationMembership" m
WHERE m."organizationId" = i."organizationId"
  AND m."role" = 'OWNER'
  AND i."payerUserId" IS NULL;

UPDATE "SubscriptionTrialHistory" t
SET "userId" = m."userId"
FROM "OrganizationMembership" m
WHERE m."organizationId" = t."organizationId"
  AND m."role" = 'OWNER'
  AND t."userId" IS NULL;

-- Carry provider customer handles onto the payer's billing identity.
UPDATE "UserBillingProfile" p
SET "stripeCustomerId"     = COALESCE(p."stripeCustomerId", s."stripeCustomerId"),
    "paystackCustomerCode" = COALESCE(p."paystackCustomerCode", s."paystackCustomerCode")
FROM "Subscription" s
WHERE s."payerUserId" = p."userId";

-- 4. OrganizationBillingProfile is now deprecated -------------------------------
-- It is intentionally NOT dropped here. This is the expand half of an
-- expand/contract migration: the table is retained read-only so a rollback to
-- the previous release keeps working. The contract migration
-- (20260831130000_drop_organization_billing_profile) drops it once the
-- user-scoped release has been verified in every environment.
COMMENT ON TABLE "OrganizationBillingProfile" IS
    'DEPRECATED — superseded by UserBillingProfile. Billing identity is user-scoped as of 2026-08-31. Retained for rollback only; no application code reads or writes this table.';
