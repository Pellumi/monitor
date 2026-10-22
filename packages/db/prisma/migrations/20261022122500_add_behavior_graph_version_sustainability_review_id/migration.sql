-- Store the sustainability review acknowledged when a graph version was
-- published. This is an audit-only soft reference, so no foreign key is
-- required and existing versions remain valid with NULL.
ALTER TABLE "BehaviorGraphVersion"
ADD COLUMN "sustainabilityReviewId" TEXT;
