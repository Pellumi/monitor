-- AlterTable
ALTER TABLE "FlowInitialization" ADD COLUMN "confirmedDuplicateCheckpointIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
