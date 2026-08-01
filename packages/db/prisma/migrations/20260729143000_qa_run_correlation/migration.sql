ALTER TABLE "Session" ADD COLUMN "qaRunId" TEXT;
ALTER TABLE "Session" ADD COLUMN "traceId" TEXT;

CREATE INDEX "Session_qaRunId_idx" ON "Session"("qaRunId");

ALTER TABLE "Session"
ADD CONSTRAINT "Session_qaRunId_fkey"
FOREIGN KEY ("qaRunId") REFERENCES "QARun"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
