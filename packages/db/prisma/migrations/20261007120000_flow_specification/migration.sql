-- Flow specification: what a declared flow can say beyond its states and transitions.
-- Every column is nullable or defaulted, so existing flows and running services are unaffected.

-- CreateEnum
CREATE TYPE "StepMode" AS ENUM ('AUTO', 'CONFIRM', 'MANUAL');

-- AlterTable
ALTER TABLE "BehaviorGraph" ADD COLUMN     "requires" JSONB;

-- AlterTable
ALTER TABLE "BehaviorGraphNode" ADD COLUMN     "recognizer" JSONB,
ADD COLUMN     "subFlowId" TEXT;

-- AlterTable
ALTER TABLE "BehaviorGraphEdge" ADD COLUMN     "control" JSONB,
ADD COLUMN     "mode" "StepMode" NOT NULL DEFAULT 'AUTO';
