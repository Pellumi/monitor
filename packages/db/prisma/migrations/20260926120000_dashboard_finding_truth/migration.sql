-- Makes coverage findings answerable rather than merely countable.
--
-- Three things were missing. Findings had no environment, so a gap closed in
-- development still counted against production and the same row was reported
-- to both. Findings had no resolution, so the open count only ever grew and
-- the coverage denominator (observed / (observed + missing)) never recovered
-- when a gap was actually closed. And the detecting rule's own classification
-- was discarded, so the dashboard printed a category it had invented.
--
-- Resolution is soft: a finding is stamped, never deleted, so "gaps you closed
-- since your last analysis" stays answerable and a regression re-opens the
-- original row instead of creating a duplicate.

ALTER TABLE "MissingState"
  ADD COLUMN "environmentId" TEXT,
  ADD COLUMN "category"      TEXT,
  ADD COLUMN "lastSeenAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "resolvedAt"    TIMESTAMP(3);

ALTER TABLE "MissingFlow"
  ADD COLUMN "environmentId" TEXT,
  ADD COLUMN "workflowId"    TEXT,
  ADD COLUMN "category"      TEXT,
  ADD COLUMN "lastSeenAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "resolvedAt"    TIMESTAMP(3);

-- Backfill only where the answer is not a guess.
--
-- Detection resolves the environment from the caller: unspecified means the
-- application's default, but demonstration-api passes the demonstration's own
-- environment, so an existing finding may have come from any of them. Where an
-- application has exactly one environment the attribution is unambiguous and we
-- write it. Where it has several we leave null, which reads as "recorded before
-- findings were scoped" — the next analysis per environment re-infers the gap
-- with a real environment, and the resolve pass retires the unscoped row once
-- the state is observed. Stamping the default everywhere would assert that a
-- staging gap belongs to development, which is worse than admitting we do not
-- know.
UPDATE "MissingState" ms
   SET "environmentId" = sole."id"
  FROM (
    SELECT "applicationId", MIN("id") AS "id"
      FROM "Environment"
     GROUP BY "applicationId"
    HAVING COUNT(*) = 1
  ) sole
 WHERE sole."applicationId" = ms."applicationId";

UPDATE "MissingFlow" mf
   SET "environmentId" = sole."id"
  FROM (
    SELECT "applicationId", MIN("id") AS "id"
      FROM "Environment"
     GROUP BY "applicationId"
    HAVING COUNT(*) = 1
  ) sole
 WHERE sole."applicationId" = mf."applicationId";

-- lastSeenAt must reflect when the gap was actually last recorded, not when
-- this migration happened to run.
UPDATE "MissingState" SET "lastSeenAt" = "detectedAt";
UPDATE "MissingFlow"  SET "lastSeenAt" = "createdAt";

-- Link existing flow findings to the workflow they were derived from. Detection
-- stores the source workflow's exact path in sourceFlow, so this is an equality
-- join rather than a guess.
UPDATE "MissingFlow" mf
   SET "workflowId" = w."id"
  FROM "Workflow" w
 WHERE w."applicationId" = mf."applicationId"
   AND w."path" = mf."sourceFlow";

ALTER TABLE "MissingState"
  ADD CONSTRAINT "MissingState_environmentId_fkey"
  FOREIGN KEY ("environmentId") REFERENCES "Environment"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MissingFlow"
  ADD CONSTRAINT "MissingFlow_environmentId_fkey"
  FOREIGN KEY ("environmentId") REFERENCES "Environment"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MissingFlow"
  ADD CONSTRAINT "MissingFlow_workflowId_fkey"
  FOREIGN KEY ("workflowId") REFERENCES "Workflow"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "MissingState_applicationId_environmentId_resolvedAt_idx"
  ON "MissingState"("applicationId", "environmentId", "resolvedAt");

CREATE INDEX "MissingFlow_applicationId_environmentId_resolvedAt_idx"
  ON "MissingFlow"("applicationId", "environmentId", "resolvedAt");

-- A snapshot already recorded the observed-state count. Without the other two
-- there is nothing to difference, so a change summary ("+5 transitions
-- observed, 6 gaps closed") has no source.
--
-- Nullable and without a default, on purpose. A snapshot taken before this
-- migration did not measure zero, it measured nothing, and `NOT NULL DEFAULT 0`
-- would make those indistinguishable to arithmetic: every historic row would
-- difference into a large fabricated improvement the first time a dashboard
-- rendered a change summary. Null is the only value that survives a restored
-- backup or a database migrated on a different date.
ALTER TABLE "CoverageSnapshot"
  ADD COLUMN "observedTransitions" INTEGER,
  ADD COLUMN "openFindings"        INTEGER;

-- Every dashboard load reads the newest snapshot for one application and
-- environment, and the trend reads the newest thirty. Without this the read is
-- a sequential scan plus a sort; the table has carried no index but its primary
-- key since it was created.
CREATE INDEX "CoverageSnapshot_applicationId_environmentId_createdAt_idx"
  ON "CoverageSnapshot"("applicationId", "environmentId", "createdAt");

-- Reconciliation is read by application and environment on every dashboard
-- load; its existing indexes are keyed on flow and run.
CREATE INDEX "ReconciliationReport_applicationId_environmentId_generatedAt_idx"
  ON "ReconciliationReport"("applicationId", "environmentId", "generatedAt");

-- graphId is a relation scalar on both tables, so Prisma created no index for
-- it. Counting a declared flow's states and transitions scans both tables once
-- per flow without these.
CREATE INDEX "BehaviorGraphNode_graphId_idx" ON "BehaviorGraphNode"("graphId");
CREATE INDEX "BehaviorGraphEdge_graphId_idx" ON "BehaviorGraphEdge"("graphId");

-- Environment-scoped graph counts join observations to their session. Neither
-- observation table has ever had an index on sessionId -- it is not a relation
-- scalar, so Prisma never created one, and no migration adds it -- which makes
-- every such join a sequential scan over the two largest tables in the schema.
-- The dashboard runs those joins on every load, so they need one.
CREATE INDEX "StateObservation_sessionId_timestamp_idx"
  ON "StateObservation"("sessionId", "timestamp");

CREATE INDEX "TransitionObservation_sessionId_timestamp_idx"
  ON "TransitionObservation"("sessionId", "timestamp");

CREATE INDEX "Session_applicationId_environmentId_startTime_idx"
  ON "Session"("applicationId", "environmentId", "startTime");
