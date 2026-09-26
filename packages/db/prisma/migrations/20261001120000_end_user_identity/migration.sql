-- End-user identity, and the privacy floor that has to ship with it.
--
-- identify() has never worked. It wrote `{ businessEventType: 'USER_IDENTIFIED',
-- userId }` into a BUSINESS_EVENT's metadata, and the SDK's own sanitizer matched
-- 'userId'.toLowerCase() === 'userid' against its identifier list and replaced the
-- value with the literal string '[PSEUDONYMIZED BY QA INGESTION]'. Identity was
-- destroyed in the page, before anything was sent, for as long as the method existed.
--
-- Identity now travels in the envelope, which the sanitizer does not touch. That
-- means the sanitizer is no longer what protects traits -- so ApplicationPrivacySetting
-- below is not a feature shipped alongside this, it is the thing that makes shipping
-- this safe. It defaults to HASHED precisely so an SDK upgrade alone can never begin
-- storing identifiers for an application whose owner never visited a settings page.

-- ── The end user ─────────────────────────────────────────────────────────────
-- No counters anywhere in this table. Anything incremented is wrong under Kafka's
-- `fromBeginning: true` replay and under at-least-once outbox delivery; session
-- counts are derived from Session at read time instead.
CREATE TABLE IF NOT EXISTS "EndUser" (
  "id"              TEXT NOT NULL,
  "applicationId"   TEXT NOT NULL,
  "externalId"      TEXT,
  "externalIdHash"  TEXT NOT NULL,
  "traits"          JSONB NOT NULL DEFAULT '{}',
  "traitsUpdatedAt" TIMESTAMP(3),
  "firstSeenAt"     TIMESTAMP(3) NOT NULL,
  "lastSeenAt"      TIMESTAMP(3) NOT NULL,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EndUser_pkey" PRIMARY KEY ("id")
);

-- Keyed on applicationId, NOT (applicationId, environmentId). Session.environmentId is
-- nullable and a unique index treats two NULLs as distinct, so an environment-scoped
-- key would silently permit duplicates; and an end user is a fact about the customer's
-- user directory rather than about a deployment stage. The cost, stated plainly: a
-- staging environment seeding externalId 'admin' shares a row with production and can
-- overwrite its traits. The escape hatch is additive -- add environmentId and swap this
-- for a COALESCE expression index -- but it must be decided before there is production
-- data, not after.
CREATE UNIQUE INDEX IF NOT EXISTS "EndUser_applicationId_externalIdHash_key"
  ON "EndUser"("applicationId", "externalIdHash");
CREATE INDEX IF NOT EXISTS "EndUser_applicationId_externalIdHash_idx"
  ON "EndUser"("applicationId", "externalIdHash");
CREATE INDEX IF NOT EXISTS "EndUser_applicationId_lastSeenAt_idx"
  ON "EndUser"("applicationId", "lastSeenAt");

DO $$ BEGIN
  ALTER TABLE "EndUser" ADD CONSTRAINT "EndUser_applicationId_fkey"
    FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── The browser-to-person link ───────────────────────────────────────────────
-- The unique is on the TRIPLE, not on (applicationId, anonymousId). A shared device
-- legitimately maps one browser to several people over time; a pair-unique would
-- destroy the previous mapping on every sign-out and silently re-attribute that
-- person's earlier sessions to whoever signed in next.
CREATE TABLE IF NOT EXISTS "EndUserAlias" (
  "id"            TEXT NOT NULL,
  "applicationId" TEXT NOT NULL,
  "anonymousId"   TEXT NOT NULL,
  "endUserId"     TEXT NOT NULL,
  "firstSeenAt"   TIMESTAMP(3) NOT NULL,
  "lastSeenAt"    TIMESTAMP(3) NOT NULL,
  "backlinkedAt"  TIMESTAMP(3),
  CONSTRAINT "EndUserAlias_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "EndUserAlias_applicationId_anonymousId_endUserId_key"
  ON "EndUserAlias"("applicationId", "anonymousId", "endUserId");
CREATE INDEX IF NOT EXISTS "EndUserAlias_applicationId_anonymousId_lastSeenAt_idx"
  ON "EndUserAlias"("applicationId", "anonymousId", "lastSeenAt");
-- backlinkedAt doubles as the work queue for the historical back-link, so the worker's
-- candidate query needs it. Partial, because every row is eventually stamped and the
-- pending set stays small.
CREATE INDEX IF NOT EXISTS "EndUserAlias_backlinkedAt_idx"
  ON "EndUserAlias"("backlinkedAt") WHERE "backlinkedAt" IS NULL;

DO $$ BEGIN
  ALTER TABLE "EndUserAlias" ADD CONSTRAINT "EndUserAlias_endUserId_fkey"
    FOREIGN KEY ("endUserId") REFERENCES "EndUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── The privacy floor ────────────────────────────────────────────────────────
-- allowedTraitKeys is an ALLOW-list. A deny-list can only block what someone thought
-- of in advance, which is exactly how the identifier rule came to swallow the SDK's
-- own userId. Empty means no traits are stored, which is the safe default.
CREATE TABLE IF NOT EXISTS "ApplicationPrivacySetting" (
  "id"               TEXT NOT NULL,
  "applicationId"    TEXT NOT NULL,
  "identityMode"     TEXT NOT NULL DEFAULT 'HASHED',
  "identitySalt"     TEXT NOT NULL,
  "allowedTraitKeys" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ApplicationPrivacySetting_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ApplicationPrivacySetting_applicationId_key"
  ON "ApplicationPrivacySetting"("applicationId");

DO $$ BEGIN
  ALTER TABLE "ApplicationPrivacySetting" ADD CONSTRAINT "ApplicationPrivacySetting_applicationId_fkey"
    FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Attribution on the session ───────────────────────────────────────────────
-- The LAST identity asserted during the session, with identifiedAt keeping the first.
-- A session is one browser visit; if it identifies as A, signs out and identifies as
-- B, the honest model would split it -- but sessionId is the correlation key for
-- replay chunks, observations and the completion claim, so splitting is worse than
-- recording the terminal identity. The filterable set of everyone seen during the
-- session lives on SessionFacet.endUserIds.
--
-- ON DELETE SET NULL, not CASCADE: erasing a user must be a deliberate act through the
-- erasure path, never a side effect of pruning a directory row.
ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "endUserId" TEXT;

DO $$ BEGIN
  ALTER TABLE "Session" ADD CONSTRAINT "Session_endUserId_fkey"
    FOREIGN KEY ("endUserId") REFERENCES "EndUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- "All sessions for this person", which spans their devices automatically because
-- every one of their browsers claims an alias onto the same EndUser row.
CREATE INDEX IF NOT EXISTS "Session_endUserId_startTime_idx"
  ON "Session"("endUserId", "startTime" DESC);
