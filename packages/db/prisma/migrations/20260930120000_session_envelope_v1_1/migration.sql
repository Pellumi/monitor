-- Envelope 1.1: identity, client context and sampling reach the session row.
--
-- Deployment order matters and is not optional. This migration and the collector
-- that accepts `eventVersion: '1.1'` ship FIRST; only then does an SDK emit it. The
-- other way round, a 1.1 payload meets `z.literal('1.0')`, the collector answers
-- 400, and -- before the SDK's flush was fixed to treat a non-2xx as a failure --
-- `fetch` did not reject, so the batch was dropped with no log outside debug mode.
--
-- Every column is nullable, because a 1.1 SDK does not imply a 1.1 payload: a
-- privacy extension can suppress localStorage so `anonymousId` is absent, and an
-- unconfigured build has no `releaseVersion`. Nothing branches on eventVersion.

-- ── Identity ─────────────────────────────────────────────────────────────────
-- `endUserId` is deliberately NOT here. It is a foreign key to EndUser, which
-- arrives with the stitching migration in the next stage.
ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "anonymousId"  TEXT;
ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "identifiedAt" TIMESTAMP(3);

-- ── Client context ───────────────────────────────────────────────────────────
-- Repeated on every event on the wire (~220 bytes, about 1% of the 32 KB per-event
-- limit) but stored once here. Per-event storage would be ~44 KB of duplication per
-- session, roughly 12 GB at 50M events, for data that describes the page load
-- rather than the event.
ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "deviceType"     TEXT;
ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "browserName"    TEXT;
ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "browserVersion" TEXT;
ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "osName"         TEXT;
ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "osVersion"      TEXT;
ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "viewportWidth"  INTEGER;
ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "viewportHeight" INTEGER;
ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "locale"         TEXT;
ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "timezone"       TEXT;
ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "releaseVersion" TEXT;

-- ── Sampling ─────────────────────────────────────────────────────────────────
-- Decided per session, never per event: an event-sampled session is uninterpretable
-- as a funnel. Stored so a rollup can divide by it and report a population estimate
-- rather than a sample count.
ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "sampleRate" DOUBLE PRECISION;

-- ── Two fields that were being sent and thrown away ──────────────────────────
-- Both have been in the TellannEvent type and populated by the SDK since they were
-- introduced, but were absent from the collector's Zod object -- which strips
-- unknown keys -- so they never survived ingest. The schema now accepts them and
-- there is somewhere to put them.
ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "agentVersion"                   TEXT;
ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "instrumentationManifestVersion" TEXT;

-- Finding a returning browser's earlier sessions, and the per-device filters in
-- session search. Partial, because the overwhelming majority of historical rows
-- have no anonymousId and never will.
CREATE INDEX IF NOT EXISTS "Session_applicationId_anonymousId_startTime_idx"
  ON "Session"("applicationId", "anonymousId", "startTime" DESC)
  WHERE "anonymousId" IS NOT NULL;
