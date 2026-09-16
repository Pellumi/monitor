-- Evidence-grounded Flow mapping is additive so existing v1 initializations and
-- scans remain readable while v2 analysis is rolled out behind a feature flag.
ALTER TABLE "FlowScan"
  ADD COLUMN "codebaseAnalysisJobId" TEXT,
  ADD COLUMN "analysisMode" TEXT,
  ADD COLUMN "analysisGraphVersion" TEXT,
  ADD COLUMN "analysisContentHash" TEXT,
  ADD COLUMN "analysisRevision" TEXT,
  ADD COLUMN "analysisBranch" TEXT,
  ADD COLUMN "analysisDirty" BOOLEAN,
  ADD COLUMN "retrievalVersion" TEXT,
  ADD COLUMN "mappingStatus" TEXT,
  ADD COLUMN "mappingProgress" JSONB,
  ADD COLUMN "candidateEvidence" JSONB,
  ADD COLUMN "mappingProvenance" JSONB;

ALTER TABLE "FlowInitialization"
  ADD COLUMN "mappingVersion" TEXT NOT NULL DEFAULT '1.0',
  ADD COLUMN "finalMappings" JSONB,
  ADD COLUMN "mappingConfirmations" JSONB;

CREATE INDEX "FlowScan_codebaseAnalysisJobId_idx" ON "FlowScan"("codebaseAnalysisJobId");

ALTER TABLE "FlowScan"
  ADD CONSTRAINT "FlowScan_codebaseAnalysisJobId_fkey"
  FOREIGN KEY ("codebaseAnalysisJobId") REFERENCES "CodebaseAnalysisJob"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
