-- Contract half of the user-scoped billing migration.
--
-- Run ONLY after 20260831120000_user_scoped_billing_identity has been applied
-- and verified in the target environment: every organization billing profile
-- must have a corresponding UserBillingProfile row for that organization's
-- owner. The guard below aborts the migration rather than silently dropping
-- billing identity that was never carried across.

DO $$
DECLARE
    orphaned INT;
BEGIN
    SELECT COUNT(*) INTO orphaned
    FROM "OrganizationBillingProfile" p
    WHERE NOT EXISTS (
        SELECT 1
        FROM "OrganizationMembership" m
        JOIN "UserBillingProfile" u ON u."userId" = m."userId"
        WHERE m."organizationId" = p."organizationId" AND m."role" = 'OWNER'
    );

    IF orphaned > 0 THEN
        RAISE EXCEPTION
            'Refusing to drop OrganizationBillingProfile: % profile(s) have no owner UserBillingProfile. Backfill them first.',
            orphaned;
    END IF;
END $$;

DROP TABLE "OrganizationBillingProfile";
