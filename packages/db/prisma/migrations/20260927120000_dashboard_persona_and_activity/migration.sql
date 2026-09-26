-- Which layout a person wants the overview arranged into.
--
-- A typed column rather than another Json blob. The three existing preference
-- blobs (graphPreferences, replayPreferences, reportPreferences) are named in
-- the API's field allowlist and read by nothing else in the repository, so
-- following them would have meant following a pattern that has never worked.
-- Null means the default layout.
ALTER TABLE "UserPreference" ADD COLUMN "dashboardPersona" TEXT;

-- The activity feed reads one application's events newest-first. The existing
-- index leads with the organisation and the event name, so it cannot serve
-- that read at all.
CREATE INDEX "ActivationEvent_applicationId_occurredAt_idx"
  ON "ActivationEvent"("applicationId", "occurredAt");
