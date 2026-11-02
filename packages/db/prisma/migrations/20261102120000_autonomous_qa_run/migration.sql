-- AlterEnum
ALTER TYPE "QARunMode" ADD VALUE IF NOT EXISTS 'AUTONOMOUS';

-- CreateEnum
CREATE TYPE "AutonomousRunStatus" AS ENUM ('PLANNING', 'AWAITING_PLAN_APPROVAL', 'RUNNING', 'AWAITING_HUMAN', 'RECOVERING', 'PAUSED', 'VERIFYING', 'COMPLETED', 'COMPLETED_INCOMPLETE', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AutonomousRiskTier" AS ENUM ('READ_ONLY', 'REVERSIBLE', 'STATE_CHANGING', 'HIGH_IMPACT');

-- CreateEnum
CREATE TYPE "AutonomousActionOutcome" AS ENUM ('EXECUTED', 'VERIFIED', 'FAILED', 'BLOCKED_BY_POLICY', 'BLOCKED_AWAITING_APPROVAL', 'RETRIED');

-- CreateEnum
CREATE TYPE "AutonomousScenarioStatus" AS ENUM ('NOT_RUN', 'RUNNING', 'PASS', 'FAIL', 'BLOCKED', 'INCONCLUSIVE');

-- CreateEnum
CREATE TYPE "AutonomousInterventionCategory" AS ENUM ('MISSING_INFORMATION', 'MISSING_AUTHORITY', 'EXTERNAL_DEPENDENCY', 'HIGH_IMPACT_APPROVAL');

-- CreateEnum
CREATE TYPE "AutonomousInterventionStatus" AS ENUM ('PENDING', 'RESOLVED', 'CANCELLED', 'TIMED_OUT');

-- CreateTable
CREATE TABLE "AutonomousRun" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "goal" TEXT NOT NULL,
    "constraints" JSONB NOT NULL,
    "planVersion" INTEGER NOT NULL DEFAULT 0,
    "status" "AutonomousRunStatus" NOT NULL DEFAULT 'PLANNING',
    "maxActions" INTEGER NOT NULL,
    "maxModelCalls" INTEGER NOT NULL,
    "maxDurationMs" INTEGER NOT NULL,
    "actionsUsed" INTEGER NOT NULL DEFAULT 0,
    "modelCallsUsed" INTEGER NOT NULL DEFAULT 0,
    "pendingInterventionId" TEXT,
    "scopeApprovedAt" TIMESTAMP(3),
    "scopeApprovedByUserId" TEXT,
    "cancelRequestedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutonomousRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutonomousPlanVersion" (
    "id" TEXT NOT NULL,
    "autonomousRunId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "plan" JSONB NOT NULL,
    "reason" TEXT,
    "provider" TEXT,
    "model" TEXT,
    "promptHash" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutonomousPlanVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutonomousScenario" (
    "id" TEXT NOT NULL,
    "autonomousRunId" TEXT NOT NULL,
    "planVersion" INTEGER NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "successCriteria" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "status" "AutonomousScenarioStatus" NOT NULL DEFAULT 'NOT_RUN',
    "detail" TEXT,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "AutonomousScenario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutonomousIntervention" (
    "id" TEXT NOT NULL,
    "autonomousRunId" TEXT NOT NULL,
    "category" "AutonomousInterventionCategory" NOT NULL,
    "question" TEXT NOT NULL,
    "allowedResponses" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "status" "AutonomousInterventionStatus" NOT NULL DEFAULT 'PENDING',
    "response" TEXT,
    "respondedByUserId" TEXT,
    "respondedAt" TIMESTAMP(3),
    "actionFingerprint" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutonomousIntervention_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutonomousAction" (
    "id" TEXT NOT NULL,
    "autonomousRunId" TEXT NOT NULL,
    "scenarioId" TEXT,
    "sequence" INTEGER NOT NULL,
    "proposal" JSONB NOT NULL,
    "riskTier" "AutonomousRiskTier" NOT NULL,
    "requiredApproval" BOOLEAN NOT NULL DEFAULT false,
    "interventionId" TEXT,
    "outcome" "AutonomousActionOutcome" NOT NULL,
    "observedState" TEXT,
    "failureExplanation" JSONB,
    "provider" TEXT,
    "model" TEXT,
    "promptHash" TEXT,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "estimatedCostUsd" DOUBLE PRECISION,
    "latencyMs" INTEGER,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutonomousAction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AutonomousRun_runId_key" ON "AutonomousRun"("runId");

-- CreateIndex
CREATE UNIQUE INDEX "AutonomousRun_pendingInterventionId_key" ON "AutonomousRun"("pendingInterventionId");

-- CreateIndex
CREATE INDEX "AutonomousRun_status_idx" ON "AutonomousRun"("status");

-- CreateIndex
CREATE UNIQUE INDEX "AutonomousPlanVersion_autonomousRunId_version_key" ON "AutonomousPlanVersion"("autonomousRunId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "AutonomousScenario_autonomousRunId_planVersion_key_key" ON "AutonomousScenario"("autonomousRunId", "planVersion", "key");

-- CreateIndex
CREATE INDEX "AutonomousScenario_autonomousRunId_status_idx" ON "AutonomousScenario"("autonomousRunId", "status");

-- CreateIndex
CREATE INDEX "AutonomousIntervention_autonomousRunId_status_idx" ON "AutonomousIntervention"("autonomousRunId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AutonomousAction_autonomousRunId_sequence_key" ON "AutonomousAction"("autonomousRunId", "sequence");

-- CreateIndex
CREATE INDEX "AutonomousAction_autonomousRunId_outcome_idx" ON "AutonomousAction"("autonomousRunId", "outcome");

-- CreateIndex
CREATE INDEX "AutonomousAction_scenarioId_idx" ON "AutonomousAction"("scenarioId");

-- AddForeignKey
ALTER TABLE "AutonomousRun" ADD CONSTRAINT "AutonomousRun_runId_fkey" FOREIGN KEY ("runId") REFERENCES "QARun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutonomousPlanVersion" ADD CONSTRAINT "AutonomousPlanVersion_autonomousRunId_fkey" FOREIGN KEY ("autonomousRunId") REFERENCES "AutonomousRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutonomousScenario" ADD CONSTRAINT "AutonomousScenario_autonomousRunId_fkey" FOREIGN KEY ("autonomousRunId") REFERENCES "AutonomousRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutonomousIntervention" ADD CONSTRAINT "AutonomousIntervention_autonomousRunId_fkey" FOREIGN KEY ("autonomousRunId") REFERENCES "AutonomousRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutonomousAction" ADD CONSTRAINT "AutonomousAction_autonomousRunId_fkey" FOREIGN KEY ("autonomousRunId") REFERENCES "AutonomousRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutonomousAction" ADD CONSTRAINT "AutonomousAction_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "AutonomousScenario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutonomousAction" ADD CONSTRAINT "AutonomousAction_interventionId_fkey" FOREIGN KEY ("interventionId") REFERENCES "AutonomousIntervention"("id") ON DELETE SET NULL ON UPDATE CASCADE;
