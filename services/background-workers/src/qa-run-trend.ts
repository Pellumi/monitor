/**
 * Declared-vs-observed comparison across runs: what's new, what's resolved, and
 * what's still present relative to the last comparable run.
 *
 * "Comparable" means the same declared Flow when one exists, falling back to the
 * same application and environment for a flowless session. `BrowserFinding.dedupeKey`
 * is stable across runs by construction (built only from route + rule/metric
 * identifiers, never a run id, timestamp, or evidence id — see packages/browser-observer),
 * so raw set membership over dedupeKeys is enough to tell new from resolved from
 * persisting, with no new schema.
 *
 * A comparison always states its own basis rather than letting a count imply more
 * than it proves: whether the declared Flow version changed underneath it, and
 * whether the prior run was on the same environment, are both surfaced so the
 * reader can judge whether "resolved" means fixed or just no longer comparable.
 */
import { QARunStatus, type PrismaClient } from '@tellann/db';

export type TrendBasis = {
  comparedToRunId: string | null;
  comparedToRunAt: string | null;
  comparisonScope: 'SAME_FLOW' | 'SAME_APPLICATION_AND_ENVIRONMENT_NO_FLOW';
  flowVersionChanged: boolean | null;
  sameEnvironment: boolean | null;
};

export type TrendItem = { dedupeKey: string; category: string | null; severity: string; title: string };

export type TrendOutcome = {
  /** 'READY' | 'NO_PRIOR_RUN' | `UNAVAILABLE:${string}` */
  status: string;
  available: boolean;
  basis: TrendBasis;
  new: TrendItem[];
  resolved: TrendItem[];
  stillPresent: TrendItem[];
  newCount: number;
  resolvedCount: number;
  stillPresentCount: number;
};

export const NO_TREND = (basis: TrendBasis): TrendOutcome => ({
  status: 'NO_PRIOR_RUN',
  available: false,
  basis,
  new: [],
  resolved: [],
  stillPresent: [],
  newCount: 0,
  resolvedCount: 0,
  stillPresentCount: 0,
});

const COMPARABLE_STATUSES = [QARunStatus.COMPLETED, QARunStatus.COMPLETED_INCOMPLETE];

/** Most recent completed run comparable to this one: same Flow when declared, else same application+environment. */
export async function fetchPriorComparableRun(
  prisma: PrismaClient,
  run: { id: string; flowId: string | null; applicationId: string; environmentId: string; createdAt: Date },
) {
  if (run.flowId) {
    // Not filtered by expectedGraphVersionId: a run on a newer Flow version is
    // still "the last run of this Flow" — the version difference is surfaced
    // in the basis, not used to exclude the run from comparison.
    return prisma.qARun.findFirst({
      where: {
        flowId: run.flowId,
        id: { not: run.id },
        createdAt: { lt: run.createdAt },
        status: { in: COMPARABLE_STATUSES },
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true, createdAt: true, expectedGraphVersionId: true, environmentId: true },
    });
  }
  return prisma.qARun.findFirst({
    where: {
      applicationId: run.applicationId,
      environmentId: run.environmentId,
      flowId: null,
      id: { not: run.id },
      createdAt: { lt: run.createdAt },
      status: { in: COMPARABLE_STATUSES },
    },
    orderBy: { createdAt: 'desc' },
    // expectedGraphVersionId is always selected, even though it's meaningless
    // without a declared Flow, so both branches return the same shape and the
    // caller never has to narrow a union to read it.
    select: { id: true, createdAt: true, expectedGraphVersionId: true, environmentId: true },
  });
}

/**
 * Pure set comparison over stable dedupeKeys. Items with no dedupeKey (the
 * synthetic DECLARED_COVERAGE_GAP rows) never participate — they describe an
 * absence relative to the Flow, not a recurring BrowserFinding.
 */
export function buildTrend(
  currentFindings: Array<{ dedupeKey: string | null; category: string | null; severity: string; title: string }>,
  priorFindings: Array<{ dedupeKey: string | null; category: string | null; severity: string; title: string }>,
  basis: TrendBasis,
): TrendOutcome {
  const currentByKey = new Map(
    currentFindings.filter((f) => f.dedupeKey).map((f) => [f.dedupeKey as string, f]),
  );
  const priorByKey = new Map(
    priorFindings.filter((f) => f.dedupeKey).map((f) => [f.dedupeKey as string, f]),
  );
  const toItem = (key: string, f: { category: string | null; severity: string; title: string }): TrendItem => ({
    dedupeKey: key,
    category: f.category,
    severity: f.severity,
    title: f.title,
  });
  const newOnes = [...currentByKey.entries()]
    .filter(([key]) => !priorByKey.has(key))
    .map(([key, f]) => toItem(key, f));
  const stillPresent = [...currentByKey.entries()]
    .filter(([key]) => priorByKey.has(key))
    .map(([key, f]) => toItem(key, f));
  const resolved = [...priorByKey.entries()]
    .filter(([key]) => !currentByKey.has(key))
    .map(([key, f]) => toItem(key, f));
  return {
    status: 'READY',
    available: true,
    basis,
    new: newOnes,
    resolved,
    stillPresent,
    newCount: newOnes.length,
    resolvedCount: resolved.length,
    stillPresentCount: stillPresent.length,
  };
}
