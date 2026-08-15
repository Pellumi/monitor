ALTER TABLE "ApplicationOnboardingProgress"
  ADD COLUMN "connectionMethodSelected" TEXT,
  ADD COLUMN "sdkTargetsConfigured" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "sessionObserved" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "analysisGenerated" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "firstAnalysisReviewed" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "DesktopSetupHandoff" (
  "id" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "applicationId" TEXT NOT NULL,
  "environmentId" TEXT NOT NULL,
  "requestedAction" TEXT NOT NULL DEFAULT 'CONNECT_SDK',
  "claimedDeviceSessionId" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "claimedAt" TIMESTAMP(3),
  "consumedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DesktopSetupHandoff_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DesktopSetupHandoff_tokenHash_key" ON "DesktopSetupHandoff"("tokenHash");
CREATE INDEX "DesktopSetupHandoff_userId_expiresAt_idx" ON "DesktopSetupHandoff"("userId", "expiresAt");
CREATE INDEX "DesktopSetupHandoff_applicationId_environmentId_idx" ON "DesktopSetupHandoff"("applicationId", "environmentId");
CREATE INDEX "DesktopSetupHandoff_claimedDeviceSessionId_idx" ON "DesktopSetupHandoff"("claimedDeviceSessionId");

ALTER TABLE "DesktopSetupHandoff" ADD CONSTRAINT "DesktopSetupHandoff_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DesktopSetupHandoff" ADD CONSTRAINT "DesktopSetupHandoff_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DesktopSetupHandoff" ADD CONSTRAINT "DesktopSetupHandoff_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DesktopSetupHandoff" ADD CONSTRAINT "DesktopSetupHandoff_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "Environment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DesktopSetupHandoff" ADD CONSTRAINT "DesktopSetupHandoff_claimedDeviceSessionId_fkey" FOREIGN KEY ("claimedDeviceSessionId") REFERENCES "DeviceSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
