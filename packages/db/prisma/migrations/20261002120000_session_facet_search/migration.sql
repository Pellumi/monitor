-- SessionFacet: one row per session, so a session can actually be found.
--
-- `GET /applications/:id/sessions` accepted page, limit, from, to and environmentId.
-- Nothing else. So the support workflow the product is sold on -- a client reports a
-- problem, go find that session -- had no way to begin.
--
-- The reason this is a denormalised table rather than a set of indexes is the query
-- shape, not JSON being slow. The predicates live on child tables while the sort key
-- and the total live on the parent: "error message contains" and "event type present"
-- are over SessionEvent, "state touched" is over StateObservation (whose sessionId is
-- not even a relation), and the ordering is Session.startTime DESC. No arrangement of
-- GIN indexes fixes that -- Postgres must either materialise a large set of session ids
-- and then sort the parents, or scan the parents and probe the children per row. One
-- row per session puts every predicate and the sort key in the same table.

CREATE TABLE IF NOT EXISTS "SessionFacet" (
  "sessionId"            TEXT NOT NULL,
  "applicationId"        TEXT NOT NULL,
  "environmentId"        TEXT,
  "tenantId"             TEXT NOT NULL,
  "startTime"            TIMESTAMP(3) NOT NULL,
  "endTime"              TIMESTAMP(3) NOT NULL,
  "durationMs"           INTEGER NOT NULL,
  "eventCount"           INTEGER NOT NULL,
  "errorCount"           INTEGER NOT NULL,
  "qaRunId"              TEXT,
  "anonymousId"          TEXT,
  "endUserId"            TEXT,
  "endUserIds"           TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "deviceType"           TEXT,
  "browserName"          TEXT,
  "osName"               TEXT,
  "releaseVersion"       TEXT,
  "sampleRate"           DOUBLE PRECISION,
  "eventTypes"           TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "stateNames"           TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "workflowNames"        TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "routes"               TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "statusCodes"          INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
  "maxStatusCode"        INTEGER,
  "errorNames"           TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "enteredFlows"         TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "reachedTerminalFlows" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "abandoned"            BOOLEAN NOT NULL DEFAULT FALSE,
  "errorText"            TEXT,
  "facetVersion"         INTEGER NOT NULL DEFAULT 1,
  "projectedAt"          TIMESTAMP(3),
  "computedAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SessionFacet_pkey" PRIMARY KEY ("sessionId")
);

-- The keyset index. The trailing sessionId is what makes the cursor total-ordered:
-- offset paging with ORDER BY startTime DESC is not merely slow at depth, it is wrong --
-- a session completing between two page loads shifts every following row, so a reader
-- paging through silently skips some sessions and sees others twice.
CREATE INDEX IF NOT EXISTS "SessionFacet_scope_keyset_idx"
  ON "SessionFacet"("applicationId", "environmentId", "startTime" DESC, "sessionId" DESC);

-- Presence sets. GIN because every one of these is answered with @>, and a btree
-- cannot answer containment against an array at all.
CREATE INDEX IF NOT EXISTS "SessionFacet_eventTypes_gin_idx"    ON "SessionFacet" USING GIN ("eventTypes");
CREATE INDEX IF NOT EXISTS "SessionFacet_stateNames_gin_idx"    ON "SessionFacet" USING GIN ("stateNames");
CREATE INDEX IF NOT EXISTS "SessionFacet_workflowNames_gin_idx" ON "SessionFacet" USING GIN ("workflowNames");
CREATE INDEX IF NOT EXISTS "SessionFacet_routes_gin_idx"        ON "SessionFacet" USING GIN ("routes");
CREATE INDEX IF NOT EXISTS "SessionFacet_statusCodes_gin_idx"   ON "SessionFacet" USING GIN ("statusCodes");
CREATE INDEX IF NOT EXISTS "SessionFacet_endUserIds_gin_idx"    ON "SessionFacet" USING GIN ("endUserIds");

CREATE INDEX IF NOT EXISTS "SessionFacet_endUserId_startTime_idx"
  ON "SessionFacet"("endUserId", "startTime" DESC);
CREATE INDEX IF NOT EXISTS "SessionFacet_anonymousId_startTime_idx"
  ON "SessionFacet"("anonymousId", "startTime" DESC);
CREATE INDEX IF NOT EXISTS "SessionFacet_durationMs_idx"
  ON "SessionFacet"("applicationId", "environmentId", "durationMs");

-- Partial, because both are selective and asked for constantly: "show me the broken
-- ones" and "show me the ones that gave up".
CREATE INDEX IF NOT EXISTS "SessionFacet_errors_idx"
  ON "SessionFacet"("applicationId", "environmentId", "startTime" DESC) WHERE "errorCount" > 0;
CREATE INDEX IF NOT EXISTS "SessionFacet_abandoned_idx"
  ON "SessionFacet"("applicationId", "environmentId", "startTime" DESC) WHERE "abandoned";

-- ── Free text ────────────────────────────────────────────────────────────────
-- A STORED generated column, so it cannot drift from its inputs and needs no trigger.
-- PostgreSQL marks array_to_string(anyarray, text) STABLE because the generic function
-- can call a type-specific output function whose result depends on settings. These arrays
-- are text[], whose concatenation is deterministic, but generated expressions still reject
-- the generic function on volatility alone. Keep that narrow guarantee in one typed wrapper
-- rather than falsely labelling a generic conversion immutable.
CREATE OR REPLACE FUNCTION "tellann_text_array_to_string"(values_to_join TEXT[], delimiter TEXT)
RETURNS TEXT
LANGUAGE SQL
IMMUTABLE
PARALLEL SAFE
RETURNS NULL ON NULL INPUT
AS 'SELECT array_to_string(values_to_join, delimiter)';

ALTER TABLE "SessionFacet"
  ADD COLUMN IF NOT EXISTS "searchVector" tsvector
  GENERATED ALWAYS AS (
    to_tsvector('simple',
      COALESCE("errorText", '') || ' ' ||
      COALESCE("tellann_text_array_to_string"("stateNames", ' '), '') || ' ' ||
      COALESCE("tellann_text_array_to_string"("workflowNames", ' '), '') || ' ' ||
      COALESCE("tellann_text_array_to_string"("routes", ' '), '') || ' ' ||
      COALESCE("browserName", '') || ' ' ||
      COALESCE("osName", '') || ' ' ||
      COALESCE("deviceType", '') || ' ' ||
      COALESCE("releaseVersion", '')
    )
  ) STORED;

CREATE INDEX IF NOT EXISTS "SessionFacet_searchVector_gin_idx"
  ON "SessionFacet" USING GIN ("searchVector");

-- Substring search ("the error containing ECONNRESET") needs trigrams; tsvector only
-- matches whole lexemes. pg_trgm is in contrib and available on every managed Postgres
-- this deploys to, but creating an extension needs elevated rights -- so it is optional
-- and the query degrades to a plain ILIKE scan without it.
DO $$ BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_trgm;
  CREATE INDEX IF NOT EXISTS "SessionFacet_errorText_trgm_idx"
    ON "SessionFacet" USING GIN ("errorText" gin_trgm_ops);
EXCEPTION WHEN insufficient_privilege OR undefined_file OR undefined_object THEN
  RAISE NOTICE 'pg_trgm unavailable; substring error search will fall back to ILIKE scans';
END $$;

-- Backfill candidates for the session-facet-backfill worker. Partial, so the candidate
-- query stays proportional to the work outstanding rather than to the corpus.
CREATE INDEX IF NOT EXISTS "Session_facet_stale_idx"
  ON "Session"("completedAt") WHERE "facetVersion" IS NULL;

-- Every session completed before this migration has no facet and is therefore
-- unsearchable until the backfill reaches it. Marking them explicitly is what puts them
-- in the worker's queue; doing it here rather than leaving facetVersion at its default
-- means the queue is correct from the first tick.
UPDATE "Session" SET "facetVersion" = NULL
 WHERE "completedAt" IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM "SessionFacet" f WHERE f."sessionId" = "Session"."id");
