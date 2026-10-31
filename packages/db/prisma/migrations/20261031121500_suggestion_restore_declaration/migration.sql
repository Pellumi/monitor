-- Three new suggestion types produced by packages/ai/src/flow-suggestions: a documented
-- step missing from the flow entirely, a detail document-generation dropped that can now
-- be re-checked and restored, and a branch with no condition distinguishing its outcomes.
-- PostgreSQL requires each ALTER TYPE ADD VALUE to be a separate statement.
ALTER TYPE "SuggestionType" ADD VALUE IF NOT EXISTS 'MISSING_DOCUMENTED_STEP';
ALTER TYPE "SuggestionType" ADD VALUE IF NOT EXISTS 'RESTORE_DECLARATION';
ALTER TYPE "SuggestionType" ADD VALUE IF NOT EXISTS 'AMBIGUOUS_BRANCH';

-- RESTORE_DECLARATION carries what to re-attach and to what instead of a new
-- state/transition patch, so it needs its own payload rather than
-- suggestedStatesJson/suggestedTransitionsJson (which stay empty for this type).
ALTER TABLE "DeclaredStateSuggestion"
ADD COLUMN "restoreDeclarationJson" JSONB;
