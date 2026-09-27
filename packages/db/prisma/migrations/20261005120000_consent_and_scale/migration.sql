-- Consent, and the honest freshness signal.
--
-- Both default to FALSE, and that is the decision rather than an oversight. Turning on
-- requireConsent for an application that never wired up grantConsent() would silently stop
-- all telemetry -- an upgrade that quietly breaks a customer's monitoring is worse than one
-- that requires them to opt in. Do Not Track is advisory rather than a legal instruction in
-- most jurisdictions, so the same reasoning applies.
ALTER TABLE "ApplicationPrivacySetting"
  ADD COLUMN IF NOT EXISTS "requireConsent" BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE "ApplicationPrivacySetting"
  ADD COLUMN IF NOT EXISTS "honorDoNotTrack" BOOLEAN NOT NULL DEFAULT FALSE;

-- Ingest freshness.
--
-- `frontendStatus` was derived from `sessionCount > 0`, which cannot tell "healthy" from
-- "stopped reporting three weeks ago" -- the count only ever rises. This index serves the
-- max(endTime) per application/environment that a real staleness check needs; before it,
-- that query had no support at all on the largest table pair in the schema.
CREATE INDEX IF NOT EXISTS "Session_freshness_idx"
  ON "Session"("applicationId", "environmentId", "endTime" DESC);
