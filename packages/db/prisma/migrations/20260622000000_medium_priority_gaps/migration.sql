-- Migration: medium_priority_gaps
-- Generated: 2026-06-22
-- Covers: Gap 1 (no schema changes), Gap 2 (no schema changes),
--         Gap 3 (docs-only), Gap 4, Gap 5, Gap 6, Gap 7
-- ============================================================

-- ─── Gap 4: Cross-tenant opt-in fields on Organization ───────────────────────
ALTER TABLE "Organization"
  ADD COLUMN IF NOT EXISTS "allowCrossTenantPatterns" BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS "mfaRequiredForAdmins"     BOOLEAN NOT NULL DEFAULT FALSE;

-- ─── Gap 5: TOTP / MFA fields on User ────────────────────────────────────────
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "totpEnabled"     BOOLEAN   NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "totpSecret"      TEXT,
  ADD COLUMN IF NOT EXISTS "totpEnabledAt"  TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "totpBackupCodes" TEXT[]    NOT NULL DEFAULT '{}';

-- Gap 5: New audit actions (enum additions) ─
-- PostgreSQL requires each ALTER TYPE to be a separate statement.
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'MFA_VERIFIED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'MFA_CHALLENGE_FAILED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'MFA_BACKUP_CODE_USED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'SSO_LOGIN_SUCCESS';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'SSO_PROVIDER_CONFIGURED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'SSO_PROVIDER_REMOVED';

-- Gap 5: MFA challenge token ─
CREATE TABLE IF NOT EXISTS "MfaChallengeToken" (
  "id"        TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  "userId"    TEXT        NOT NULL,
  "tokenHash" TEXT        NOT NULL UNIQUE,
  "expiresAt" TIMESTAMP   NOT NULL,
  "usedAt"    TIMESTAMP,
  "attempts"  INTEGER     NOT NULL DEFAULT 0,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP   NOT NULL DEFAULT NOW(),
  CONSTRAINT "MfaChallengeToken_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "MfaChallengeToken_userId_idx" ON "MfaChallengeToken"("userId");

-- ─── Gap 6: SSO / OIDC Provider ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "OIDCProvider" (
  "id"             TEXT      NOT NULL,
  "organizationId" TEXT      NOT NULL UNIQUE,
  "displayName"    TEXT      NOT NULL,
  "issuerUrl"      TEXT      NOT NULL,
  "clientId"       TEXT      NOT NULL,
  "clientSecret"   TEXT      NOT NULL,
  "scopes"         TEXT[]    NOT NULL DEFAULT '{"openid","email","profile"}',
  "isActive"       BOOLEAN   NOT NULL DEFAULT TRUE,
  "allowedDomains" TEXT[]    NOT NULL DEFAULT '{}',
  "providerPreset" TEXT               DEFAULT 'custom',
  "createdAt"      TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt"      TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT "OIDCProvider_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OIDCProvider_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "OIDCProvider_allowedDomains_idx" ON "OIDCProvider"("allowedDomains");

-- ─── Gap 4: Cross-Tenant Pattern Index ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS "CrossTenantPatternIndex" (
  "id"                TEXT      NOT NULL,
  "patternKey"        TEXT      NOT NULL,
  "domain"            TEXT      NOT NULL,
  "anonymizedExample" JSONB     NOT NULL,
  "occurrenceCount"   INTEGER   NOT NULL DEFAULT 1,
  "confidenceScore"   DOUBLE PRECISION NOT NULL,
  "suggestedBranches" JSONB     NOT NULL,
  "createdAt"         TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt"         TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT "CrossTenantPatternIndex_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CrossTenantPatternIndex_patternKey_domain_key"
    UNIQUE ("patternKey", "domain")
);
CREATE INDEX IF NOT EXISTS "CrossTenantPatternIndex_domain_idx"          ON "CrossTenantPatternIndex"("domain");
CREATE INDEX IF NOT EXISTS "CrossTenantPatternIndex_confidenceScore_idx" ON "CrossTenantPatternIndex"("confidenceScore");

-- ─── Gap 7: Digest frequency enum and NotificationDigestPreference ───────────
DO $$ BEGIN
  CREATE TYPE "DigestFrequency" AS ENUM ('DAILY', 'WEEKLY', 'NEVER');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "NotificationDigestPreference" (
  "id"                  TEXT             NOT NULL DEFAULT gen_random_uuid()::text,
  "userId"              TEXT             NOT NULL UNIQUE,
  "weeklyReport"        BOOLEAN          NOT NULL DEFAULT TRUE,
  "coverageAlerts"      BOOLEAN          NOT NULL DEFAULT TRUE,
  "ruleCandidateAlerts" BOOLEAN          NOT NULL DEFAULT FALSE,
  "digestFrequency"     "DigestFrequency" NOT NULL DEFAULT 'WEEKLY',
  "lastWeeklyReportAt"  TIMESTAMP,
  "lastCoverageAlertAt" TIMESTAMP,
  "createdAt"           TIMESTAMP        NOT NULL DEFAULT NOW(),
  "updatedAt"           TIMESTAMP        NOT NULL DEFAULT NOW(),
  CONSTRAINT "NotificationDigestPreference_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "NotificationDigestPreference_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);
