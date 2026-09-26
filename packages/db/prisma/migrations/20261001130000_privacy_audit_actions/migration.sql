-- Audit actions for the privacy decisions the identity floor introduces.
--
-- Switching an application to RAW identity mode means the platform begins storing the
-- customer's own user identifiers. That is a decision a person made, so it is recorded
-- as one -- not inferred afterwards from the state of a settings row.
--
-- ALTER TYPE ... ADD VALUE cannot run inside a transaction block on PostgreSQL before
-- 12, and `prisma migrate deploy` wraps each file in one. IF NOT EXISTS makes each
-- statement idempotent for the re-run that a partially applied migration needs.
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PRIVACY_IDENTITY_MODE_CHANGED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PRIVACY_TRAIT_ALLOWLIST_CHANGED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'END_USER_ERASED';
