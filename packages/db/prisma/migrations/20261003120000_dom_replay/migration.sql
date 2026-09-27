-- Visual replay: DOM recordings, and a setting that governs them.
--
-- The "replay" the product had was an event-log scrubber. No DOM was captured anywhere in
-- the codebase -- the one MutationObserver, in the desktop QA recorder, records a single
-- timestamp and discards the mutation records -- and the element preview in the viewer was
-- a mock synthesised from a CSS selector. A support engineer chasing "the user cannot
-- create an exam" saw event names and had to reason about the screen from memory.

-- ── Chunks ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "ReplayChunk" (
  "id"              TEXT NOT NULL,
  "sessionId"       TEXT NOT NULL,
  "applicationId"   TEXT NOT NULL,
  "environmentId"   TEXT,
  "organizationId"  TEXT,
  "seq"             INTEGER NOT NULL,
  "objectKey"       TEXT NOT NULL,
  "bytes"           BIGINT NOT NULL,
  "startOffsetMs"   INTEGER NOT NULL,
  "endOffsetMs"     INTEGER NOT NULL,
  "eventCount"      INTEGER NOT NULL,
  "format"          TEXT NOT NULL DEFAULT 'rrweb-v2',
  "encoding"        TEXT NOT NULL DEFAULT 'gzip',
  "hasFullSnapshot" BOOLEAN NOT NULL DEFAULT FALSE,
  "trigger"         TEXT NOT NULL DEFAULT 'CONTINUOUS',
  "maskProfileHash" TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReplayChunk_pkey" PRIMARY KEY ("id")
);

-- objectKey is deterministic (replays/<sessionId>/chunks/<000000>.jsonl.gz), so a retried
-- upload overwrites the same object; this unique plus the one below is the whole
-- idempotency story for replay ingest.
CREATE UNIQUE INDEX IF NOT EXISTS "ReplayChunk_objectKey_key" ON "ReplayChunk"("objectKey");
CREATE UNIQUE INDEX IF NOT EXISTS "ReplayChunk_sessionId_seq_key" ON "ReplayChunk"("sessionId", "seq");

-- sessionId is a plain scalar, not a relation: chunks routinely arrive before the first
-- telemetry batch has created the Session row, and a required relation would reject them.
-- Prisma indexes no non-relation scalar, so this is explicit -- the same trap
-- StateObservation.sessionId fell into and was never indexed for.
CREATE INDEX IF NOT EXISTS "ReplayChunk_sessionId_seq_idx" ON "ReplayChunk"("sessionId", "seq");
CREATE INDEX IF NOT EXISTS "ReplayChunk_applicationId_createdAt_idx"
  ON "ReplayChunk"("applicationId", "createdAt");

-- ── The recording setting ────────────────────────────────────────────────────
-- Defaults to ERROR, not ALWAYS. A ten-minute ALWAYS session is 5-20 MB compressed, which
-- at any real traffic is the largest single line in the storage ledger; ERROR records the
-- session that broke and nothing else.
CREATE TABLE IF NOT EXISTS "ApplicationReplaySetting" (
  "id"                       TEXT NOT NULL,
  "applicationId"            TEXT NOT NULL,
  "mode"                     TEXT NOT NULL DEFAULT 'ERROR',
  "maskAllInputs"            BOOLEAN NOT NULL DEFAULT TRUE,
  "maskAllText"              BOOLEAN NOT NULL DEFAULT FALSE,
  "blockSelectors"           TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "maskSelectors"            TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "recordCanvas"             BOOLEAN NOT NULL DEFAULT FALSE,
  "recordCrossOriginIframes" BOOLEAN NOT NULL DEFAULT FALSE,
  "sampleRate"               DOUBLE PRECISION NOT NULL DEFAULT 1.0,
  "maxChunkBytes"            INTEGER NOT NULL DEFAULT 2097152,
  "bufferSeconds"            INTEGER NOT NULL DEFAULT 30,
  "retentionDays"            INTEGER,
  "profileHash"              TEXT NOT NULL,
  "createdAt"                TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"                TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ApplicationReplaySetting_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ApplicationReplaySetting_applicationId_key"
  ON "ApplicationReplaySetting"("applicationId");

DO $$ BEGIN
  ALTER TABLE "ApplicationReplaySetting" ADD CONSTRAINT "ApplicationReplaySetting_applicationId_fkey"
    FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- A note on what the masking setting can and cannot do, because the stronger reading
-- becomes a compliance problem if it goes unstated:
--
-- A server-enforced masking floor is not achievable for rrweb. Once a page has serialised
-- unmasked DOM text into a chunk, enforcing a floor server-side would mean gunzipping,
-- parsing the mutation stream, walking text nodes, redacting and re-serialising -- a
-- DOM-diff engine in the ingest path, wrong often enough to be worse than useless.
--
-- What is real: the client enforces a config it did not choose (fetched, not configured);
-- every chunk attests the profile hash it recorded under and a stale one is refused with
-- 409, so tightening takes effect within a chunk interval; and ingest can always refuse
-- to store. The server cannot retroactively clean.
