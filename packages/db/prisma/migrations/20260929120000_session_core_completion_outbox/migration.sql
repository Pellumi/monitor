-- One completion path for both transports, and a projection that survives a repeat.
--
-- Completion logic lived inside session-engine's Kafka consumer, so a deployment
-- without a broker produced no statistics, no announcement, no observed graph and
-- no reconciliation -- silently. It now lives in @tellann/session-core and is
-- driven either by that consumer's idle timer or by a worker querying Postgres.
-- Because two processes can now complete the same session, and because Kafka
-- replays with `fromBeginning: true`, everything below is about making a repeat a
-- no-op instead of a doubling.

-- ── Session: the claim, made readable and indexable ──────────────────────────
-- The sweep looked for `statistics IS NULL`, which plans as a LEFT JOIN anti-join
-- between the two largest tables with no supporting index, so it got slower with
-- every session ever completed. A partial index over the incomplete rows keeps it
-- proportional to the backlog forever.
ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP(3);
ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "facetVersion" INTEGER;

CREATE INDEX IF NOT EXISTS "Session_incomplete_idx"
  ON "Session"("endTime") WHERE "completedAt" IS NULL;

-- Sessions completed before this migration have statistics but no completedAt, and
-- the sweep would pick every one of them up again. Backfill from the claim itself.
UPDATE "Session" s
   SET "completedAt" = s."updatedAt"
  FROM "SessionStatistic" st
 WHERE st."sessionId" = s."id"
   AND s."completedAt" IS NULL;

-- ── The transactional outbox ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "SessionCompletionOutbox" (
  "id"            TEXT NOT NULL,
  "sessionId"     TEXT NOT NULL,
  "applicationId" TEXT NOT NULL,
  "environmentId" TEXT,
  "tenantId"      TEXT NOT NULL,
  "payload"       JSONB,
  "status"        TEXT NOT NULL DEFAULT 'PENDING',
  "attempts"      INTEGER NOT NULL DEFAULT 0,
  "lastError"     TEXT,
  "claimedAt"     TIMESTAMP(3),
  "deliveredAt"   TIMESTAMP(3),
  "availableAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SessionCompletionOutbox_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SessionCompletionOutbox_sessionId_key"
  ON "SessionCompletionOutbox"("sessionId");
CREATE INDEX IF NOT EXISTS "SessionCompletionOutbox_status_availableAt_idx"
  ON "SessionCompletionOutbox"("status", "availableAt");
CREATE INDEX IF NOT EXISTS "SessionCompletionOutbox_applicationId_createdAt_idx"
  ON "SessionCompletionOutbox"("applicationId", "createdAt");

-- ── Observations become the projection's idempotency key ─────────────────────
-- Duplicates predate this change (every consumer rebalance replayed the topic),
-- so they have to be cleared before a unique index can exist. Keep the earliest
-- row of each group: it is the one whose counter increments were already counted.
DELETE FROM "StateObservation" so
 USING "StateObservation" dup
 WHERE so."sessionId" = dup."sessionId"
   AND so."eventId"   = dup."eventId"
   AND so."stateId"   = dup."stateId"
   AND so."id" > dup."id";

CREATE UNIQUE INDEX IF NOT EXISTS "StateObservation_sessionId_eventId_stateId_key"
  ON "StateObservation"("sessionId", "eventId", "stateId");

DELETE FROM "TransitionObservation" tobs
 USING "TransitionObservation" dup
 WHERE tobs."sessionId"   = dup."sessionId"
   AND tobs."fromEventId" = dup."fromEventId"
   AND tobs."toEventId"   = dup."toEventId"
   AND tobs."id" > dup."id";

CREATE UNIQUE INDEX IF NOT EXISTS "TransitionObservation_sessionId_fromEventId_toEventId_key"
  ON "TransitionObservation"("sessionId", "fromEventId", "toEventId");

-- ── State / Transition identity ──────────────────────────────────────────────
-- `upsertObservedState` was findFirst-then-create, which is a race under any
-- concurrency: two sessions reaching a new state at once created two rows for it,
-- and every later visit incremented whichever one findFirst happened to return.
--
-- environmentId is added now, nullable and unread, purely so this index is built
-- once. Scoping the graph by environment is Stage 6; building the index on
-- (applicationId, name) today and rebuilding it later on a table this size is the
-- expensive way to arrive at the same place. COALESCE is required because a unique
-- index treats two NULLs as distinct, which would let the null-environment rows
-- this table is full of duplicate freely.
ALTER TABLE "State"      ADD COLUMN IF NOT EXISTS "environmentId" TEXT;
ALTER TABLE "Transition" ADD COLUMN IF NOT EXISTS "environmentId" TEXT;

-- Pre-existing duplicates: fold observations onto the survivor, then drop the rest.
UPDATE "StateObservation" so
   SET "stateId" = keep."id"
  FROM "State" dup
  JOIN "State" keep
    ON keep."applicationId" = dup."applicationId"
   AND keep."name" = dup."name"
   AND COALESCE(keep."environmentId", '-') = COALESCE(dup."environmentId", '-')
   AND keep."id" < dup."id"
 WHERE so."stateId" = dup."id";

DELETE FROM "State" dup
 USING "State" keep
 WHERE keep."applicationId" = dup."applicationId"
   AND keep."name" = dup."name"
   AND COALESCE(keep."environmentId", '-') = COALESCE(dup."environmentId", '-')
   AND keep."id" < dup."id"
   AND NOT EXISTS (SELECT 1 FROM "Transition" t
                    WHERE t."fromStateId" = dup."id" OR t."toStateId" = dup."id");

CREATE UNIQUE INDEX IF NOT EXISTS "State_applicationId_environmentId_name_key"
  ON "State"("applicationId", COALESCE("environmentId", '-'), "name");

DELETE FROM "Transition" dup
 USING "Transition" keep
 WHERE keep."applicationId" = dup."applicationId"
   AND COALESCE(keep."environmentId", '-') = COALESCE(dup."environmentId", '-')
   AND keep."fromStateId" = dup."fromStateId"
   AND keep."toStateId"   = dup."toStateId"
   AND COALESCE(keep."action", '') = COALESCE(dup."action", '')
   AND keep."id" < dup."id"
   AND NOT EXISTS (SELECT 1 FROM "TransitionObservation" o WHERE o."transitionId" = dup."id");

CREATE UNIQUE INDEX IF NOT EXISTS "Transition_applicationId_environmentId_edge_key"
  ON "Transition"("applicationId", COALESCE("environmentId", '-'),
                  "fromStateId", "toStateId", COALESCE("action", ''));

-- ── Workflow.executionCount stops being a running total ──────────────────────
CREATE TABLE IF NOT EXISTS "WorkflowExecution" (
  "id"         TEXT NOT NULL,
  "workflowId" TEXT NOT NULL,
  "sessionId"  TEXT NOT NULL,
  "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkflowExecution_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "WorkflowExecution_workflowId_sessionId_key"
  ON "WorkflowExecution"("workflowId", "sessionId");
CREATE INDEX IF NOT EXISTS "WorkflowExecution_sessionId_idx"
  ON "WorkflowExecution"("sessionId");

DO $$ BEGIN
  ALTER TABLE "WorkflowExecution"
    ADD CONSTRAINT "WorkflowExecution_workflowId_fkey"
    FOREIGN KEY ("workflowId") REFERENCES "Workflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- The historical counts cannot be reconstructed -- the sessions that produced them
-- were never recorded -- so seed one synthetic execution per existing count and let
-- the honest count take over from here. Without this, every discovered workflow
-- would appear to reset to zero.
INSERT INTO "WorkflowExecution" ("id", "workflowId", "sessionId", "observedAt")
SELECT md5(w."id" || ':legacy:' || g.n), w."id", 'legacy:' || w."id" || ':' || g.n, w."createdAt"
  FROM "Workflow" w
  CROSS JOIN LATERAL generate_series(1, GREATEST(w."executionCount", 1)) AS g(n)
 ON CONFLICT ("workflowId", "sessionId") DO NOTHING;
