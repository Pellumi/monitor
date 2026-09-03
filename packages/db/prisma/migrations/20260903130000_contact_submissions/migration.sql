-- Public contact form submissions.
--
-- The marketing contact form previously posted to whatever
-- NEXT_PUBLIC_CONTACT_ENDPOINT pointed at, and nothing in this repo received
-- it. This table is that destination: shared fields as columns so submissions
-- can be triaged by type, route-specific answers in `details` rather than a
-- wide sparse table.

DO $$ BEGIN
  CREATE TYPE "ContactSubmissionType" AS ENUM (
    'SALES', 'ENTERPRISE', 'SUPPORT', 'PARTNERSHIP', 'PRESS', 'SECURITY', 'PRIVACY', 'GENERAL'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "ContactSubmissionStatus" AS ENUM ('NEW', 'IN_PROGRESS', 'RESOLVED', 'SPAM');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "ContactSubmission" (
  "id"           TEXT NOT NULL,
  "type"         "ContactSubmissionType" NOT NULL,
  "status"       "ContactSubmissionStatus" NOT NULL DEFAULT 'NEW',
  "firstName"    TEXT NOT NULL,
  "lastName"     TEXT NOT NULL,
  "email"        TEXT NOT NULL,
  "organization" TEXT,
  "subject"      TEXT,
  "message"      TEXT NOT NULL,
  "details"      JSONB NOT NULL DEFAULT '{}',
  "ipHash"       TEXT,
  "userAgent"    TEXT,
  "notifiedAt"   TIMESTAMP(3),
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ContactSubmission_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ContactSubmission_type_status_idx" ON "ContactSubmission"("type", "status");
CREATE INDEX IF NOT EXISTS "ContactSubmission_createdAt_idx" ON "ContactSubmission"("createdAt");
CREATE INDEX IF NOT EXISTS "ContactSubmission_email_idx" ON "ContactSubmission"("email");
