-- AI-generated flow drafts (e.g. from an uploaded document) awaiting review.
ALTER TABLE "BehaviorGraph" ADD COLUMN "aiDraftStatus" TEXT;
ALTER TABLE "BehaviorGraph" ADD COLUMN "aiDraftSourceName" TEXT;
