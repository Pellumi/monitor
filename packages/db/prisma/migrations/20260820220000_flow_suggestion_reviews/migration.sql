ALTER TABLE "DeclaredStateSuggestion"
  ADD COLUMN "reviewId" TEXT;

CREATE INDEX "DeclaredStateSuggestion_flowId_reviewId_idx"
  ON "DeclaredStateSuggestion"("flowId", "reviewId");
