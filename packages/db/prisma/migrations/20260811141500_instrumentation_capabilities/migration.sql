CREATE TYPE "InstrumentationCapabilityAction" AS ENUM ('APPLY', 'ROLLBACK');

CREATE TABLE "InstrumentationCapability" (
    "id" TEXT NOT NULL,
    "jtiHash" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "patchSetId" TEXT,
    "deviceSessionId" TEXT NOT NULL,
    "action" "InstrumentationCapabilityAction" NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InstrumentationCapability_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InstrumentationCapability_jtiHash_key" ON "InstrumentationCapability"("jtiHash");
CREATE INDEX "InstrumentationCapability_planId_action_consumedAt_idx" ON "InstrumentationCapability"("planId", "action", "consumedAt");
CREATE INDEX "InstrumentationCapability_deviceSessionId_expiresAt_idx" ON "InstrumentationCapability"("deviceSessionId", "expiresAt");

ALTER TABLE "InstrumentationCapability"
  ADD CONSTRAINT "InstrumentationCapability_planId_fkey"
  FOREIGN KEY ("planId") REFERENCES "InstrumentationPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InstrumentationCapability"
  ADD CONSTRAINT "InstrumentationCapability_patchSetId_fkey"
  FOREIGN KEY ("patchSetId") REFERENCES "PatchSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InstrumentationCapability"
  ADD CONSTRAINT "InstrumentationCapability_deviceSessionId_fkey"
  FOREIGN KEY ("deviceSessionId") REFERENCES "DeviceSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
