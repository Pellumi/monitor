-- Add missing Application.summary column.
-- The schema field was added on 2026-08-16 (commit c126830) but no migration
-- was ever generated, so environments synced only via `prisma migrate deploy`
-- are missing the column. IF NOT EXISTS keeps this safe on DBs that already
-- picked it up through `prisma db push`.
ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "summary" TEXT;
