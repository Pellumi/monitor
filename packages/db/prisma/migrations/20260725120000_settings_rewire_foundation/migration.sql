CREATE TABLE "UserPreference" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "theme" TEXT NOT NULL DEFAULT 'SYSTEM',
  "density" TEXT NOT NULL DEFAULT 'COMFORTABLE',
  "sidebarCollapsed" BOOLEAN NOT NULL DEFAULT false,
  "reducedMotion" BOOLEAN NOT NULL DEFAULT false,
  "highContrast" BOOLEAN NOT NULL DEFAULT false,
  "tablePageSize" INTEGER NOT NULL DEFAULT 25,
  "persistFilters" BOOLEAN NOT NULL DEFAULT true,
  "defaultLandingPage" TEXT NOT NULL DEFAULT '/',
  "rememberLastApplication" BOOLEAN NOT NULL DEFAULT true,
  "rememberLastEnvironment" BOOLEAN NOT NULL DEFAULT true,
  "reportsOpenInNewTab" BOOLEAN NOT NULL DEFAULT false,
  "graphPreferences" JSONB,
  "replayPreferences" JSONB,
  "reportPreferences" JSONB,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UserPreference_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OrganizationSettings" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "primaryTimezone" TEXT NOT NULL DEFAULT 'UTC',
  "defaultApplicationId" TEXT,
  "defaultEnvironmentId" TEXT,
  "defaultReportFormat" TEXT NOT NULL DEFAULT 'JSON',
  "defaultGraphVisibility" TEXT NOT NULL DEFAULT 'STANDARD',
  "defaultDemonstrationMode" TEXT NOT NULL DEFAULT 'GUIDED',
  "defaultMemberRole" "MemberRole" NOT NULL DEFAULT 'MEMBER',
  "defaultInvitationExpiryDays" INTEGER NOT NULL DEFAULT 7,
  "defaultSeverityThreshold" TEXT NOT NULL DEFAULT 'WARNING',
  "billingContactEmail" TEXT,
  "technicalContactEmail" TEXT,
  "securityContactEmail" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OrganizationSettings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OrganizationSecuritySettings" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "requireMfa" BOOLEAN NOT NULL DEFAULT false,
  "idleTimeoutMinutes" INTEGER NOT NULL DEFAULT 60,
  "maximumSessionHours" INTEGER NOT NULL DEFAULT 168,
  "allowedEmailDomains" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "blockPersonalEmailDomains" BOOLEAN NOT NULL DEFAULT false,
  "invitationExpiryDays" INTEGER NOT NULL DEFAULT 7,
  "requireVerifiedEmail" BOOLEAN NOT NULL DEFAULT true,
  "revokeSessionsOnRoleChange" BOOLEAN NOT NULL DEFAULT true,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OrganizationSecuritySettings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserPreference_userId_key" ON "UserPreference"("userId");
CREATE UNIQUE INDEX "OrganizationSettings_organizationId_key" ON "OrganizationSettings"("organizationId");
CREATE UNIQUE INDEX "OrganizationSecuritySettings_organizationId_key" ON "OrganizationSecuritySettings"("organizationId");

ALTER TABLE "UserPreference" ADD CONSTRAINT "UserPreference_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrganizationSettings" ADD CONSTRAINT "OrganizationSettings_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrganizationSecuritySettings" ADD CONSTRAINT "OrganizationSecuritySettings_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
