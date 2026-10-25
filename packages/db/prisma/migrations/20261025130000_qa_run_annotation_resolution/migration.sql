-- Adds edit/delete/resolve support to QA-run Inspect-mode annotations.
-- `comment`/`elementFingerprint` were already mutable columns (no diff
-- needed for edit); this migration only adds the resolve-state fields.
ALTER TABLE "QARunAnnotation"
  ADD COLUMN "resolved" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "resolvedAt" TIMESTAMP(3),
  ADD COLUMN "resolvedById" TEXT;

ALTER TABLE "QARunAnnotation"
  ADD CONSTRAINT "QARunAnnotation_resolvedById_fkey"
  FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "QARunAnnotation_runId_resolved_idx" ON "QARunAnnotation"("runId", "resolved");
