-- Frozen published version + in-progress draft counter for declared flows.
ALTER TABLE "BehaviorGraph" ADD COLUMN "draftSeq" INTEGER NOT NULL DEFAULT 0;

-- Draft-history snapshots: one row per mutation that bumps BehaviorGraph.draftSeq.
CREATE TABLE "FlowDraftSnapshot" (
    "id" TEXT NOT NULL,
    "graphId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "draftSeq" INTEGER NOT NULL,
    "label" TEXT,
    "snapshot" JSONB NOT NULL,
    "stateCount" INTEGER NOT NULL DEFAULT 0,
    "transitionCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "FlowDraftSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FlowDraftSnapshot_graphId_version_draftSeq_key" ON "FlowDraftSnapshot"("graphId", "version", "draftSeq");
CREATE INDEX "FlowDraftSnapshot_graphId_version_idx" ON "FlowDraftSnapshot"("graphId", "version");

ALTER TABLE "FlowDraftSnapshot" ADD CONSTRAINT "FlowDraftSnapshot_graphId_fkey" FOREIGN KEY ("graphId") REFERENCES "BehaviorGraph"("id") ON DELETE CASCADE ON UPDATE CASCADE;
