-- An instrumentation task is named for what it does: an initialisation task
-- carries the derived "Initialisation" title, a Flow task is named after its
-- Flow, and `title` holds the operator's own wording when they rename it.
-- Archiving keeps a task readable and restorable while taking it out of every
-- working list, including the patch sets offered when a QA run is started.
ALTER TABLE "InstrumentationPlan"
  ADD COLUMN "title" TEXT,
  ADD COLUMN "archivedAt" TIMESTAMP(3),
  ADD COLUMN "archivedByUserId" TEXT;

CREATE INDEX "InstrumentationPlan_workspaceId_archivedAt_idx"
  ON "InstrumentationPlan"("workspaceId", "archivedAt");

ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'INSTRUMENTATION_RENAMED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'INSTRUMENTATION_ARCHIVED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'INSTRUMENTATION_RESTORED';
