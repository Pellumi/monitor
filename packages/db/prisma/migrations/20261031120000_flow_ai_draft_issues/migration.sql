-- Keeps what document-generation grounding left out (an invented state, a route the
-- document never wrote) and what the structural lint flagged, so a review surface can
-- show it instead of discarding it at the API layer. Additive, nullable: existing
-- graphs read NULL and are unaffected.
ALTER TABLE "BehaviorGraph"
ADD COLUMN "aiDraftIssues" JSONB;
