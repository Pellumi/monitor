/**
 * Decides which of the three degraded `sourceMapping` statuses an Inspect
 * annotation gets when a full source-code match isn't attempted — or
 * whether it should be attempted at all. Split out of `attachAnnotationSource`
 * in main.ts because main.ts bootstraps the Electron app on import (so it
 * cannot be required from a plain Node test); this piece has no such
 * side effect and is exactly the decision the "deployed URL / no codebase
 * connected" requirement turns on, so it gets its own test coverage.
 */
export type SourceAvailability =
  | { status: 'NOT_CONNECTED' }
  | { status: 'ANALYSIS_UNAVAILABLE'; analysisId: string | null }
  | { status: 'RESOLVE'; analysisId: string };

/**
 * `hasConnectedWorkspace` is false both when nobody ever connected a local
 * codebase to this application, and when this particular run targeted a
 * deployed URL with no corresponding local checkout — the two cases this
 * function (deliberately) does not try to tell apart, since neither one has
 * source to analyze. `analysis` is the application's codebase analysis
 * record, if a workspace is connected.
 */
export function classifySourceAvailability(
  hasConnectedWorkspace: boolean,
  analysis: { id: string; status: string } | null,
): SourceAvailability {
  if (!hasConnectedWorkspace) return { status: 'NOT_CONNECTED' };
  if (!analysis || !['COMPLETED', 'PARTIAL'].includes(analysis.status)) {
    return { status: 'ANALYSIS_UNAVAILABLE', analysisId: analysis?.id ?? null };
  }
  return { status: 'RESOLVE', analysisId: analysis.id };
}
