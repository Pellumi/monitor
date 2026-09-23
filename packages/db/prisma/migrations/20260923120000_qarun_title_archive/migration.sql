-- A QA run is named for what it exercised once the operator gives it a name;
-- unset means the UI derives one from its environment and start time, the
-- same convention an untitled instrumentation task already follows.
-- Archiving keeps a run (and its report) readable and restorable while
-- taking it out of the working list, without touching its evidence.
ALTER TABLE "QARun"
  ADD COLUMN "title" TEXT,
  ADD COLUMN "archivedAt" TIMESTAMP(3),
  ADD COLUMN "archivedByUserId" TEXT;

CREATE INDEX "QARun_applicationId_archivedAt_idx"
  ON "QARun"("applicationId", "archivedAt");

ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'QARUN_RENAMED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'QARUN_ARCHIVED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'QARUN_RESTORED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'QARUN_DELETED';
