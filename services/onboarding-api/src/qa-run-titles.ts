/**
 * A QA run is named for what it exercised once the operator gives it a name.
 * The implementation lives in `@tellann/shared` so the report, which carries
 * its run's name, resolves it the same way the run list does.
 */
export { derivedQaRunTitle, resolveQaRunTitle, normalizeQaRunTitle } from '@tellann/shared';
