-- Central notification pipeline (Phase 1).
--
-- One logical Notification per business event, fanned out to per-recipient
-- UserNotification feed rows and per-channel NotificationDelivery attempts.
-- Email stays a delivery adapter; the legacy NotificationEvent / EmailDelivery
-- tables are untouched so existing producers and the digest workers keep
-- working during migration.

-- ── Enums ────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE "NotificationSeverity" AS ENUM ('INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'WEB_PUSH', 'DESKTOP', 'EMAIL', 'WEBHOOK');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "NotificationDeliveryStatus" AS ENUM ('QUEUED', 'SENT', 'DELIVERED', 'FAILED', 'SKIPPED', 'SUPPRESSED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "NotificationDevicePlatform" AS ENUM ('WINDOWS', 'MACOS', 'LINUX');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── NotificationPreference: new channel / severity / quiet-hour columns ───────
ALTER TABLE "NotificationPreference"
  ADD COLUMN IF NOT EXISTS "webPushEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "desktopEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "minSeverity" "NotificationSeverity" NOT NULL DEFAULT 'LOW',
  ADD COLUMN IF NOT EXISTS "quietHoursEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "quietHoursStart" INTEGER,
  ADD COLUMN IF NOT EXISTS "quietHoursEnd" INTEGER,
  ADD COLUMN IF NOT EXISTS "criticalOverridesQuietHours" BOOLEAN NOT NULL DEFAULT true;

-- ── Notification ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "Notification" (
  "id"              TEXT NOT NULL,
  "organizationId"  TEXT NOT NULL,
  "applicationId"   TEXT,
  "workflowId"      TEXT,
  "reportId"        TEXT,
  "runId"           TEXT,
  "type"            TEXT NOT NULL,
  "category"        "EmailCategory" NOT NULL,
  "severity"        "NotificationSeverity" NOT NULL DEFAULT 'INFO',
  "title"           TEXT NOT NULL,
  "body"            TEXT NOT NULL,
  "deepLink"        TEXT,
  "sourceEventType" TEXT NOT NULL,
  "sourceEventId"   TEXT,
  "dedupeKey"       TEXT,
  "groupKey"        TEXT,
  "metadata"        JSONB NOT NULL DEFAULT '{}',
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt"       TIMESTAMP(3),
  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "Notification"
    ADD CONSTRAINT "Notification_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "Notification_sourceEventType_sourceEventId_key"
  ON "Notification"("sourceEventType", "sourceEventId");
CREATE UNIQUE INDEX IF NOT EXISTS "Notification_organizationId_dedupeKey_key"
  ON "Notification"("organizationId", "dedupeKey");
CREATE INDEX IF NOT EXISTS "Notification_organizationId_createdAt_idx"
  ON "Notification"("organizationId", "createdAt");
CREATE INDEX IF NOT EXISTS "Notification_groupKey_idx" ON "Notification"("groupKey");

-- ── UserNotification ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "UserNotification" (
  "id"              TEXT NOT NULL,
  "notificationId"  TEXT NOT NULL,
  "userId"          TEXT NOT NULL,
  "organizationId"  TEXT NOT NULL,
  "deliveredToFeed" BOOLEAN NOT NULL DEFAULT true,
  "readAt"          TIMESTAMP(3),
  "dismissedAt"     TIMESTAMP(3),
  "actionedAt"      TIMESTAMP(3),
  "expiresAt"       TIMESTAMP(3),
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UserNotification_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "UserNotification"
    ADD CONSTRAINT "UserNotification_notificationId_fkey"
    FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "UserNotification"
    ADD CONSTRAINT "UserNotification_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "UserNotification_notificationId_userId_key"
  ON "UserNotification"("notificationId", "userId");
CREATE INDEX IF NOT EXISTS "UserNotification_userId_organizationId_createdAt_idx"
  ON "UserNotification"("userId", "organizationId", "createdAt");
CREATE INDEX IF NOT EXISTS "UserNotification_userId_organizationId_readAt_idx"
  ON "UserNotification"("userId", "organizationId", "readAt");
CREATE INDEX IF NOT EXISTS "UserNotification_userId_organizationId_dismissedAt_idx"
  ON "UserNotification"("userId", "organizationId", "dismissedAt");

-- ── NotificationDelivery ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "NotificationDelivery" (
  "id"             TEXT NOT NULL,
  "notificationId" TEXT NOT NULL,
  "userId"         TEXT,
  "channel"        "NotificationChannel" NOT NULL,
  "status"         "NotificationDeliveryStatus" NOT NULL DEFAULT 'QUEUED',
  "attempts"       INTEGER NOT NULL DEFAULT 0,
  "providerId"     TEXT,
  "failureCode"    TEXT,
  "skippedReason"  TEXT,
  "nextAttemptAt"  TIMESTAMP(3),
  "sentAt"         TIMESTAMP(3),
  "deliveredAt"    TIMESTAMP(3),
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "NotificationDelivery_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "NotificationDelivery"
    ADD CONSTRAINT "NotificationDelivery_notificationId_fkey"
    FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "NotificationDelivery_notificationId_userId_channel_key"
  ON "NotificationDelivery"("notificationId", "userId", "channel");
CREATE INDEX IF NOT EXISTS "NotificationDelivery_status_nextAttemptAt_idx"
  ON "NotificationDelivery"("status", "nextAttemptAt");

-- ── PushSubscription ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "PushSubscription" (
  "id"             TEXT NOT NULL,
  "userId"         TEXT NOT NULL,
  "organizationId" TEXT,
  "endpoint"       TEXT NOT NULL,
  "p256dh"         TEXT NOT NULL,
  "auth"           TEXT NOT NULL,
  "userAgent"      TEXT,
  "deviceLabel"    TEXT,
  "enabled"        BOOLEAN NOT NULL DEFAULT true,
  "failureCount"   INTEGER NOT NULL DEFAULT 0,
  "lastSeenAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "PushSubscription"
    ADD CONSTRAINT "PushSubscription_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");
CREATE INDEX IF NOT EXISTS "PushSubscription_userId_enabled_idx" ON "PushSubscription"("userId", "enabled");

-- ── NotificationDevice ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "NotificationDevice" (
  "id"             TEXT NOT NULL,
  "userId"         TEXT NOT NULL,
  "organizationId" TEXT,
  "installationId" TEXT NOT NULL,
  "platform"       "NotificationDevicePlatform" NOT NULL,
  "appVersion"     TEXT,
  "label"          TEXT,
  "enabled"        BOOLEAN NOT NULL DEFAULT true,
  "present"        BOOLEAN NOT NULL DEFAULT false,
  "lastSeenAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "NotificationDevice_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "NotificationDevice"
    ADD CONSTRAINT "NotificationDevice_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "NotificationDevice_installationId_key"
  ON "NotificationDevice"("installationId");
CREATE INDEX IF NOT EXISTS "NotificationDevice_userId_enabled_idx"
  ON "NotificationDevice"("userId", "enabled");
