ALTER TABLE "DeclaredStateSuggestion"
  ADD COLUMN "graphVersion" INTEGER,
  ADD COLUMN "graphHash" TEXT,
  ADD COLUMN "dedupeKey" TEXT,
  ADD COLUMN "generationTrigger" TEXT;

UPDATE "DeclaredStateSuggestion" SET "status" = 'PENDING' WHERE "status" = 'SUGGESTED';

CREATE INDEX "DeclaredStateSuggestion_flowId_graphHash_status_idx"
  ON "DeclaredStateSuggestion"("flowId", "graphHash", "status");
CREATE UNIQUE INDEX "DeclaredStateSuggestion_flowId_graphHash_dedupeKey_key"
  ON "DeclaredStateSuggestion"("flowId", "graphHash", "dedupeKey");
