-- A correction or a set of conflict answers produces a revised review draft.
-- The draft it replaces moves out of the review queue instead of staying pending.
ALTER TYPE "AIFlowDraftStatus" ADD VALUE IF NOT EXISTS 'SUPERSEDED';
