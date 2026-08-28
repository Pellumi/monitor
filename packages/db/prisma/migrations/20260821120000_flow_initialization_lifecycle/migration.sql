CREATE TYPE "FlowInitializationMode" AS ENUM ('AUTOMATED', 'MANUAL');
CREATE TYPE "FlowInitializationStage" AS ENUM ('SDK_REQUIRED', 'SCANNING', 'REVIEW_READY', 'ROADMAP_READY', 'AWAITING_APPROVAL', 'APPLYING', 'AWAITING_TELEMETRY', 'COMPLETED', 'FAILED');

ALTER TABLE "FlowInitialization"
  ADD COLUMN "mode" "FlowInitializationMode",
  ADD COLUMN "stage" "FlowInitializationStage" NOT NULL DEFAULT 'SCANNING',
  ADD COLUMN "manifestVersion" TEXT NOT NULL DEFAULT '1.0',
  ADD COLUMN "manifest" JSONB,
  ADD COLUMN "reportProvenance" JSONB,
  ADD COLUMN "selectedTargetAdapters" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "roadmapRevision" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "manualRoadmap" JSONB,
  ADD COLUMN "verification" JSONB;
