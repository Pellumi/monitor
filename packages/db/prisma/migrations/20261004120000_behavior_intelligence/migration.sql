-- Behaviour intelligence: a time dimension, journeys, and friction.
--
-- Three things were missing, and each one made a question the product is sold on
-- unanswerable:
--
--  1. State.visitCount and Transition.frequency are monotone lifetime totals with no decay,
--     so "how is this system used *now*" and "is this getting worse" could not be asked. A
--     state abandoned six months ago looked identical to one visited this morning.
--  2. Workflow created one row per distinct exact state sequence, looked up with
--     `path: { equals: [...] }` against an unindexed Json column, and named each one
--     "<LAST_STATE> Workflow". Nothing bounded how many rows a busy application produced.
--  3. errorCount lived per session and was never attributed to a place, so "which part of
--     the client's system is prone to issues" had no structure behind it at all.

-- ── Daily state metrics ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "ObservedStateMetric" (
  "applicationId"  TEXT NOT NULL,
  "environmentId"  TEXT,
  "stateId"        TEXT NOT NULL,
  "day"            TIMESTAMP(3) NOT NULL,
  "visits"         INTEGER NOT NULL,
  "weightedVisits" DOUBLE PRECISION NOT NULL,
  "uniqueEndUsers" INTEGER NOT NULL,
  "uniqueSessions" INTEGER NOT NULL,
  "errorCount"     INTEGER NOT NULL,
  "dwellP50Ms"     INTEGER,
  "dwellP95Ms"     INTEGER,
  "computedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ObservedStateMetric_pkey" PRIMARY KEY ("applicationId", "stateId", "day")
);

CREATE INDEX IF NOT EXISTS "ObservedStateMetric_scope_day_idx"
  ON "ObservedStateMetric"("applicationId", "environmentId", "day");
CREATE INDEX IF NOT EXISTS "ObservedStateMetric_stateId_day_idx"
  ON "ObservedStateMetric"("stateId", "day");

-- ── Daily transition metrics ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "ObservedTransitionMetric" (
  "applicationId"      TEXT NOT NULL,
  "environmentId"      TEXT,
  "transitionId"       TEXT NOT NULL,
  "day"                TIMESTAMP(3) NOT NULL,
  "traversals"         INTEGER NOT NULL,
  "weightedTraversals" DOUBLE PRECISION NOT NULL,
  "uniqueSessions"     INTEGER NOT NULL,
  "errorSessions"      INTEGER NOT NULL,
  "computedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ObservedTransitionMetric_pkey" PRIMARY KEY ("applicationId", "transitionId", "day")
);

CREATE INDEX IF NOT EXISTS "ObservedTransitionMetric_scope_day_idx"
  ON "ObservedTransitionMetric"("applicationId", "environmentId", "day");

-- ── Journeys ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "JourneyPath" (
  "id"            TEXT NOT NULL,
  "applicationId" TEXT NOT NULL,
  "environmentId" TEXT,
  "pathHash"      TEXT NOT NULL,
  "path"          JSONB NOT NULL,
  "stateCount"    INTEGER NOT NULL,
  "entryState"    TEXT NOT NULL,
  "exitState"     TEXT NOT NULL,
  "firstSeenAt"   TIMESTAMP(3) NOT NULL,
  "lastSeenAt"    TIMESTAMP(3) NOT NULL,
  CONSTRAINT "JourneyPath_pkey" PRIMARY KEY ("id")
);

-- COALESCE, because environmentId is nullable and a unique index treats two NULLs as
-- distinct -- which would silently permit duplicate paths for the null-environment rows that
-- are the majority. Prisma cannot express a COALESCE expression index, and its
-- compound-unique `where` input rejects null outright, so writes go through a raw
-- ON CONFLICT. Same arrangement as State and Transition.
CREATE UNIQUE INDEX IF NOT EXISTS "JourneyPath_app_env_pathHash_key"
  ON "JourneyPath"("applicationId", COALESCE("environmentId", '-'), "pathHash");
CREATE INDEX IF NOT EXISTS "JourneyPath_app_env_pathHash_idx"
  ON "JourneyPath"("applicationId", "environmentId", "pathHash");
CREATE INDEX IF NOT EXISTS "JourneyPath_app_env_lastSeen_idx"
  ON "JourneyPath"("applicationId", "environmentId", "lastSeenAt");

CREATE TABLE IF NOT EXISTS "JourneyPathDaily" (
  "journeyPathId"      TEXT NOT NULL,
  "day"                TIMESTAMP(3) NOT NULL,
  "executions"         INTEGER NOT NULL,
  "weightedExecutions" DOUBLE PRECISION NOT NULL,
  "uniqueEndUsers"     INTEGER NOT NULL,
  "completions"        INTEGER NOT NULL,
  "abandonments"       INTEGER NOT NULL,
  "errorSessions"      INTEGER NOT NULL,
  "medianMs"           INTEGER,
  "computedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "JourneyPathDaily_pkey" PRIMARY KEY ("journeyPathId", "day")
);

CREATE INDEX IF NOT EXISTS "JourneyPathDaily_day_idx" ON "JourneyPathDaily"("day");

DO $$ BEGIN
  ALTER TABLE "JourneyPathDaily" ADD CONSTRAINT "JourneyPathDaily_journeyPathId_fkey"
    FOREIGN KEY ("journeyPathId") REFERENCES "JourneyPath"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Friction findings ────────────────────────────────────────────────────────
-- Separate from BrowserFinding, whose runId is non-null and cascades from QARun: a finding
-- derived from a production session has no QA run to hang off, and widening that column
-- would make every existing query ambiguous about what it is looking at.
CREATE TABLE IF NOT EXISTS "ObservedFrictionFinding" (
  "id"                     TEXT NOT NULL,
  "applicationId"          TEXT NOT NULL,
  "environmentId"          TEXT,
  "category"               TEXT NOT NULL,
  "severity"               TEXT NOT NULL,
  "confidence"             DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  "title"                  TEXT NOT NULL,
  "description"            TEXT NOT NULL,
  "recommendation"         TEXT,
  "relatedStateName"       TEXT,
  "relatedTransitionId"    TEXT,
  "relatedRoute"           TEXT,
  "sampleSessionIds"       TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "observedValue"          DOUBLE PRECISION,
  "baselineValue"          DOUBLE PRECISION,
  "affectedSessions"       INTEGER NOT NULL DEFAULT 0,
  "observationWindowStart" TIMESTAMP(3) NOT NULL,
  "observationWindowEnd"   TIMESTAMP(3) NOT NULL,
  "dedupeKey"              TEXT NOT NULL,
  "detectedAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt"             TIMESTAMP(3),
  CONSTRAINT "ObservedFrictionFinding_pkey" PRIMARY KEY ("id")
);

-- Stable across recomputations, so the daily detector refreshes a standing finding instead
-- of filing a duplicate every morning. detectedAt is never updated on refresh: "this has
-- been true since Tuesday" is the useful fact.
CREATE UNIQUE INDEX IF NOT EXISTS "ObservedFrictionFinding_app_env_dedupe_key"
  ON "ObservedFrictionFinding"("applicationId", COALESCE("environmentId", '-'), "dedupeKey");
CREATE INDEX IF NOT EXISTS "ObservedFrictionFinding_app_env_dedupe_idx"
  ON "ObservedFrictionFinding"("applicationId", "environmentId", "dedupeKey");
CREATE INDEX IF NOT EXISTS "ObservedFrictionFinding_open_idx"
  ON "ObservedFrictionFinding"("applicationId", "environmentId", "resolvedAt");
CREATE INDEX IF NOT EXISTS "ObservedFrictionFinding_severity_idx"
  ON "ObservedFrictionFinding"("applicationId", "severity", "detectedAt");

-- ── Route-induced states ─────────────────────────────────────────────────────
-- No schema change needed: State.category already exists and induced nodes are written with
-- category 'ROUTE'. Noted here because it is the change with the largest effect on what the
-- graph contains, and it is invisible in a schema diff.
--
-- getRuleSet resolves exactly two profile types (ECOMMERCE and LMS) and every call site
-- falls back to ECOMMERCE, so an application nobody hand-wrote rules for produced no nodes
-- at all -- or worse, produced e-commerce state names for a hospital. Induction runs only
-- where every rule declined, so a declared vocabulary is never overridden by an inferred
-- one, and canonicalRouteFromPath collapses identifier segments so /exams/17 and /exams/18
-- are one state rather than an unbounded family of them.
