/**
 * The arithmetic behind the dashboard overview, kept free of Prisma and HTTP.
 *
 * These functions used to live in the browser, where they could not be tested
 * and where an absent field silently became `0`. Everything that decides what
 * a number *means* belongs here so it can be pinned by a test; the handler in
 * `dashboard-overview.ts` only gathers rows and calls into this file.
 */

import {
  DASHBOARD_RANGES,
  type AnalysisStatus,
  type CoverageHistoryPoint,
  type DashboardHealthIssue,
  type DashboardLifecycle,
  type DashboardMaturity,
  type DashboardRange,
  type DashboardWindow,
  type DiscoveredWorkflow,
  type ExpectedVsObserved,
  type FindingSeverity,
  type MeasuredValue,
  type MeasurementStatus,
  type PlanUsage,
  type ReportSummary,
} from '@tellann/shared';

// ─────────────────────────────────────────────────────────────
// Measurement
// ─────────────────────────────────────────────────────────────

export function measured<T>(value: T | null | undefined, delta?: number): MeasuredValue<T> {
  if (value === null || value === undefined) {
    return { status: 'NOT_MEASURED', value: null };
  }
  return delta === undefined
    ? { status: 'MEASURED', value }
    : { status: 'MEASURED', value, delta };
}

export function notMeasured<T>(status: MeasurementStatus = 'NOT_MEASURED'): MeasuredValue<T> {
  return { status, value: null };
}

/**
 * A ratio as a percentage, or NOT_MEASURED when the denominator is zero.
 *
 * Zero observations out of zero expectations is not 0% coverage — it is an
 * unanswered question, and rendering it as 0% invents a failing grade.
 */
export function ratioPercent(numerator: number, denominator: number): MeasuredValue<number> {
  if (!Number.isFinite(denominator) || denominator <= 0) return notMeasured();
  const pct = (numerator / denominator) * 100;
  return measured(Math.max(0, Math.min(100, Number(pct.toFixed(1)))));
}

/** Difference between two measurements, only when both are actually measured. */
export function withDelta(
  current: MeasuredValue<number>,
  previous: number | null | undefined,
): MeasuredValue<number> {
  if (current.status !== 'MEASURED' || current.value === null) return current;
  if (previous === null || previous === undefined) return current;
  return { ...current, delta: Number((current.value - previous).toFixed(1)) };
}

// ─────────────────────────────────────────────────────────────
// Window
// ─────────────────────────────────────────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Turns the range the UI asked for into the bounds every query applies.
 *
 * The selector previously wrote `?range=7d` and the sessions endpoint read
 * `from`/`to`, so nothing was ever filtered. Doing the translation in one place
 * on the server is what stops those two from disagreeing again.
 *
 * `latest` has no lower bound here — it means "the most recent analysis" and is
 * applied by taking the newest snapshot rather than by narrowing time.
 */
export function resolveRangeWindow(
  range: string | undefined,
  from: string | undefined,
  to: string | undefined,
  now: Date = new Date(),
): DashboardWindow & { fromDate: Date | null; toDate: Date | null } {
  const explicitFrom = parseDate(from);
  const explicitTo = parseDate(to);
  if (explicitFrom || explicitTo) {
    return {
      range: 'custom',
      from: explicitFrom?.toISOString() ?? null,
      to: explicitTo?.toISOString() ?? null,
      fromDate: explicitFrom,
      toDate: explicitTo,
    };
  }

  const resolved: DashboardRange = (DASHBOARD_RANGES as readonly string[]).includes(range ?? '')
    ? (range as DashboardRange)
    : '30d';

  const days = resolved === '7d' ? 7 : resolved === '30d' ? 30 : null;
  const fromDate = days === null ? null : new Date(now.getTime() - days * DAY_MS);

  return {
    range: resolved,
    from: fromDate?.toISOString() ?? null,
    to: null,
    fromDate,
    toDate: null,
  };
}

function parseDate(value: string | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** The endpoint engine takes a day count rather than bounds. */
export function windowDays(window: { fromDate: Date | null }, now: Date = new Date()): number | null {
  if (!window.fromDate) return null;
  return Math.max(1, Math.ceil((now.getTime() - window.fromDate.getTime()) / DAY_MS));
}

// ─────────────────────────────────────────────────────────────
// Lifecycle
// ─────────────────────────────────────────────────────────────

export interface LifecycleInput {
  hasApplication: boolean;
  frontendConnected: boolean;
  backendConnected: boolean;
  demonstrationCompleted: boolean;
  firstAnalysisReviewed: boolean;
  analysisCount: number;
  /** Status of the most recent non-archived run, if any. */
  activeRunStatus: string | null;
}

/**
 * The one place a lifecycle is decided.
 *
 * It used to be computed twice from different inputs — once when assembling the
 * response and again in the client's state engine, which ignored the first. The
 * client now renders what this returns.
 */
export function deriveLifecycle(input: LifecycleInput): DashboardLifecycle {
  if (!input.hasApplication) return 'NEW_ACCOUNT';

  if (input.activeRunStatus === 'RECORDING' || input.activeRunStatus === 'RUNNING') {
    return 'DEMONSTRATION_IN_PROGRESS';
  }
  if (input.activeRunStatus === 'PROCESSING') return 'ANALYSIS_IN_PROGRESS';

  if (!input.frontendConnected && !input.backendConnected) return 'SDK_SETUP';

  if (input.analysisCount === 0) {
    return input.demonstrationCompleted ? 'ANALYSIS_IN_PROGRESS' : 'READY_TO_DEMONSTRATE';
  }

  // The acknowledgement is persisted, so this no longer traps a single-session
  // account in the celebration card on every reload.
  if (input.analysisCount === 1 && !input.firstAnalysisReviewed) return 'FIRST_ANALYSIS_READY';

  return 'ACTIVE';
}

export function deriveMaturity(analysisCount: number, sessionCount: number): DashboardMaturity {
  if (sessionCount > 10 || analysisCount > 10) return 'ESTABLISHED';
  if (sessionCount > 1 || analysisCount > 1) return 'EARLY';
  return 'NEW';
}

// ─────────────────────────────────────────────────────────────
// Workflow coverage
// ─────────────────────────────────────────────────────────────

/** `FROM->TO`, the key both sides of the comparison are built with. */
export function transitionKey(from: string, to: string): string {
  return `${from}->${to}`;
}

export function consecutivePairs(path: string[]): Array<[string, string]> {
  const pairs: Array<[string, string]> = [];
  for (let i = 0; i < path.length - 1; i += 1) {
    pairs.push([path[i], path[i + 1]]);
  }
  return pairs;
}

export interface WorkflowCoverageInput {
  id: string;
  name: string;
  path: unknown;
  stateCount: number;
  transitionCount: number;
  executionCount: number;
  lastDemonstratedAt: Date | null;
  /** Observed transitions inside the requested environment and window, as `FROM->TO` keys. */
  observedTransitions: Set<string>;
  /**
   * False when the scope produced no observations at all. Without this a quiet
   * window reports every workflow at 0%, which asserts a regression where there
   * is only an absence of measurement.
   */
  scopeHasObservations: boolean;
  /** Reconciliation score for this workflow's declared flow, 0..1, when one exists. */
  declaredCoverageScore?: number | null;
}

/**
 * How much of a workflow has been re-exercised in the requested scope.
 *
 * The denominator has to be chosen carefully. A `Workflow` row is not a
 * specification — `graph-engine` builds `path` from one session's actual
 * traversal and only writes the row if that exact path was seen. Measuring the
 * path against all-time observations is therefore tautological: every workflow
 * is 100% by construction, which is no more useful than the 0% it replaces.
 *
 * So the numerator is scoped to the requested environment and window while the
 * denominator stays the full path. The question becomes "how much of this
 * workflow has been exercised *here*, *recently*" — which genuinely varies, and
 * is the question someone looking at a coverage table is asking. A workflow
 * demonstrated in production today reads 100%; one last seen in development six
 * months ago reads 0% against a 7-day production window, correctly.
 */
export function deriveWorkflowCoverage(input: WorkflowCoverageInput): DiscoveredWorkflow {
  const path = Array.isArray(input.path) ? (input.path as unknown[]).map(String) : [];
  const pairs = consecutivePairs(path);

  const observedCount = pairs.filter(([from, to]) =>
    input.observedTransitions.has(transitionKey(from, to)),
  ).length;

  let coverage: MeasuredValue<number>;
  let missingPathCount: number | null;

  if (typeof input.declaredCoverageScore === 'number') {
    // A declared flow is a real specification, unlike an observed path, so
    // reconciliation against it wins wherever it exists.
    coverage = measured(Number((input.declaredCoverageScore * 100).toFixed(1)));
    missingPathCount = pairs.length ? pairs.length - observedCount : null;
  } else if (pairs.length === 0 || !input.scopeHasObservations) {
    // A single-state path has no step to observe; an empty scope has no
    // measurement to report. Neither is 0%.
    coverage = notMeasured();
    missingPathCount = null;
  } else {
    coverage = ratioPercent(observedCount, pairs.length);
    missingPathCount = pairs.length - observedCount;
  }

  return {
    id: input.id,
    name: input.name,
    coverage,
    stateCount: input.stateCount || path.length,
    transitionCount: input.transitionCount || pairs.length,
    observedTransitionCount: observedCount,
    missingPathCount,
    demonstrationCount: input.executionCount,
    lastDemonstratedAt: input.lastDemonstratedAt?.toISOString() ?? null,
    severity: severityForCoverage(coverage),
  };
}

/**
 * Severity is only claimed where coverage is known. An unmeasured workflow is
 * INFO, not HIGH: "we have not looked" is not the same finding as "this is bad".
 */
export function severityForCoverage(coverage: MeasuredValue<number>): FindingSeverity {
  if (coverage.status !== 'MEASURED' || coverage.value === null) return 'INFO';
  if (coverage.value < 40) return 'CRITICAL';
  if (coverage.value < 65) return 'HIGH';
  if (coverage.value < 85) return 'MEDIUM';
  return 'LOW';
}

// ─────────────────────────────────────────────────────────────
// Error coverage
// ─────────────────────────────────────────────────────────────

/**
 * Error coverage over the ruleset's own expectations.
 *
 * The denominator is every ERROR- and RECOVERY-category state the active
 * ruleset says an application of this shape should have; the numerator is how
 * many have actually been observed. Sharing the rule groups with missing-state
 * detection is deliberate — the tile and the findings list are then two views
 * of one calculation and cannot disagree.
 */
export function deriveErrorCoverage(input: {
  expectedErrorStates: Iterable<string>;
  observedStateNames: Set<string>;
}): MeasuredValue<number> {
  const expected = new Set(input.expectedErrorStates);
  if (expected.size === 0) return notMeasured();
  let observed = 0;
  for (const name of expected) {
    if (input.observedStateNames.has(name)) observed += 1;
  }
  return ratioPercent(observed, expected.size);
}

// ─────────────────────────────────────────────────────────────
// Findings
// ─────────────────────────────────────────────────────────────

const SEVERITIES: FindingSeverity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];

/**
 * Normalises a stored severity string.
 *
 * Returns MEDIUM for an unrecognised value rather than guessing upward: an
 * unknown severity is not evidence of a critical problem. Severity is never
 * derived from confidence — a confidence threshold wearing a severity label is
 * exactly what this replaces.
 */
export function normaliseSeverity(value: string | null | undefined): FindingSeverity {
  if (!value) return 'MEDIUM';
  const upper = value.toUpperCase() as FindingSeverity;
  return SEVERITIES.includes(upper) ? upper : 'MEDIUM';
}

export function summariseFindings(
  rows: Array<{ severity: string | null }>,
): { total: number; critical: number; high: number; medium: number; low: number } {
  const tally = { total: rows.length, critical: 0, high: 0, medium: 0, low: 0 };
  for (const row of rows) {
    switch (normaliseSeverity(row.severity)) {
      case 'CRITICAL':
        tally.critical += 1;
        break;
      case 'HIGH':
        tally.high += 1;
        break;
      case 'MEDIUM':
        tally.medium += 1;
        break;
      case 'LOW':
        tally.low += 1;
        break;
      default:
        break;
    }
  }
  return tally;
}

// ─────────────────────────────────────────────────────────────
// Graph
// ─────────────────────────────────────────────────────────────

/**
 * Entry and exit points by degree, not by row order.
 *
 * These were previously taken from the first and last element of an unordered
 * `findMany`, so both counts were always exactly 1 regardless of the graph.
 */
export function classifyGraphNodes(
  nodes: Array<{ id: string }>,
  edges: Array<{ source: string; target: string }>,
): Map<string, 'entry' | 'exit' | 'state'> {
  const hasIncoming = new Set(edges.map((e) => e.target));
  const hasOutgoing = new Set(edges.map((e) => e.source));
  const classified = new Map<string, 'entry' | 'exit' | 'state'>();
  for (const node of nodes) {
    const incoming = hasIncoming.has(node.id);
    const outgoing = hasOutgoing.has(node.id);
    if (!incoming && outgoing) classified.set(node.id, 'entry');
    else if (incoming && !outgoing) classified.set(node.id, 'exit');
    else classified.set(node.id, 'state');
  }
  return classified;
}

/** Preview nodes, most-visited first. An unbounded list renders hundreds of chips. */
export const GRAPH_PREVIEW_LIMIT = 12;

export function topNodesByVisits<T extends { visitCount?: number }>(
  nodes: T[],
  limit = GRAPH_PREVIEW_LIMIT,
): T[] {
  return [...nodes].sort((a, b) => (b.visitCount ?? 0) - (a.visitCount ?? 0)).slice(0, limit);
}

// ─────────────────────────────────────────────────────────────
// Snapshots, deltas and history
// ─────────────────────────────────────────────────────────────

/** A coverage snapshot reduced to what the dashboard differences and plots. */
export interface SnapshotPoint {
  id: string;
  createdAt: Date;
  coveragePercent: number;
  transitionCoverage: number;
  flowCoverage: number;
  observedStates: number;
  /** Null on snapshots written before the column existed. Not zero. */
  observedTransitions: number | null;
  openFindings: number | null;
}

export type DeltaBasis = NonNullable<MeasuredValue<number>['deltaBasis']>;

/**
 * Whether this snapshot recorded the values that will be read off it.
 *
 * Snapshots predating the counter columns carry null, and the two percentage
 * columns they *do* carry (`transitionCoverage`, `flowCoverage`) were added with
 * a zero default of their own — so such a row plots as a cliff to 0% and
 * differences into a large invented improvement. There is no independent way to
 * date those two columns, so they piggyback on the counters: one predicate,
 * applied to both the delta baseline and the plotted series.
 */
export function isSnapshotMeasured(point: SnapshotPoint): boolean {
  return point.observedTransitions !== null && point.openFindings !== null;
}

/**
 * The row current figures are compared against, and the name of the comparison.
 *
 * `series` is newest-first, as Prisma returns it. Returning a null basis
 * alongside a null baseline is deliberate: a delta without a stated basis is
 * ambiguous, and "since your last analysis" and "versus the previous 30 days"
 * are different claims that must not render identically.
 */
export function pickDeltaBaseline(
  series: SnapshotPoint[],
  windowFrom: Date | null,
): { baseline: SnapshotPoint | null; basis: DeltaBasis | null } {
  const measuredSeries = series.filter(isSnapshotMeasured);
  if (measuredSeries.length < 2) return { baseline: null, basis: null };

  if (windowFrom) {
    // The state of the world when the window opened.
    const atWindowOpen = measuredSeries.find((point) => point.createdAt <= windowFrom);
    if (atWindowOpen && atWindowOpen !== measuredSeries[0]) {
      return { baseline: atWindowOpen, basis: 'PREVIOUS_WINDOW' };
    }
    // Nothing that old is in hand. Fall back to the previous analysis and say
    // so, rather than labelling it as a window comparison it is not.
    return { baseline: measuredSeries[1], basis: 'PREVIOUS_ANALYSIS' };
  }

  return { baseline: measuredSeries[1], basis: 'PREVIOUS_ANALYSIS' };
}

/** `withDelta`, plus the discriminator — and never a basis without a delta. */
export function withBasisDelta(
  current: MeasuredValue<number>,
  previous: number | null | undefined,
  basis: DeltaBasis | null,
): MeasuredValue<number> {
  const next = withDelta(current, previous);
  if (next.delta === undefined || !basis) return next;
  return { ...next, deltaBasis: basis };
}

export const COVERAGE_HISTORY_LIMIT = 30;

/**
 * A label for a point on the trend axis.
 *
 * Locale-free and UTC. `toLocaleDateString` on a server picks the container's
 * locale, which has nothing to do with the reader's; the point also carries its
 * ISO `timestamp` so a client can re-format it properly.
 */
export function coverageHistoryLabel(at: Date, sameDayAsNeighbour: boolean): string {
  const iso = at.toISOString();
  return sameDayAsNeighbour ? `${iso.slice(0, 10)} ${iso.slice(11, 16)}` : iso.slice(0, 10);
}

/**
 * The coverage series, oldest-first.
 *
 * Reversed on the server because recharts plots array order and Prisma returns
 * newest-first — an unreversed series draws the trend backwards, so coverage
 * that rose appears to have fallen.
 *
 * Capped rather than sampled. Decimating a trend means choosing which analyses
 * to hide, and the interesting one is always the outlier: the analysis where
 * coverage dropped is exactly the point a sampler discards.
 */
export function toCoverageHistory(
  series: SnapshotPoint[],
  limit: number = COVERAGE_HISTORY_LIMIT,
): CoverageHistoryPoint[] {
  const usable = series.filter(isSnapshotMeasured).slice(0, limit).reverse();

  return usable.map((point, index) => {
    const day = point.createdAt.toISOString().slice(0, 10);
    const sharesDay =
      usable[index - 1]?.createdAt.toISOString().slice(0, 10) === day ||
      usable[index + 1]?.createdAt.toISOString().slice(0, 10) === day;

    return {
      analysisId: point.id,
      label: coverageHistoryLabel(point.createdAt, sharesDay),
      timestamp: point.createdAt.toISOString(),
      workflow: Number(point.flowCoverage.toFixed(1)),
      state: Number(point.coveragePercent.toFixed(1)),
      transition: Number(point.transitionCoverage.toFixed(1)),
    };
  });
}

// ─────────────────────────────────────────────────────────────
// Analysis status
// ─────────────────────────────────────────────────────────────

const ACTIVE_RUN_STATUSES = new Set(['RECORDING', 'RUNNING', 'PROCESSING']);
const PENDING_RUN_STATUSES = new Set(['CREATED', 'ARMED', 'WAITING_FOR_INITIAL']);
const REPORT_IN_FLIGHT = new Set(['PENDING', 'RECONCILING', 'ANALYZING', 'GENERATING']);

export interface AnalysisStatusInput {
  activeRunStatus: string | null;
  pendingRunStatus: string | null;
  terminalRunStatus: string | null;
  /** The terminal run's report status, if it has one. */
  terminalReportStatus: string | null;
  /** Whether that run has a report row at all. */
  terminalHasReport: boolean;
}

/**
 * What the analysis pipeline is doing.
 *
 * The status the client used to show came from "has any session existed", so it
 * said COMPLETED the moment telemetry arrived — which is why a failed report
 * never surfaced a retry. This folds in the report's own status, because a run
 * can succeed and its report generation fail independently.
 */
export function deriveAnalysisStatus(input: AnalysisStatusInput): AnalysisStatus['status'] {
  if (input.activeRunStatus && ACTIVE_RUN_STATUSES.has(input.activeRunStatus)) return 'PROCESSING';
  // A run exists and is armed. NOT_STARTED would be untrue.
  if (input.pendingRunStatus && PENDING_RUN_STATUSES.has(input.pendingRunStatus)) return 'QUEUED';

  if (input.terminalRunStatus === 'FAILED') return 'FAILED';
  if (input.terminalReportStatus === 'FAILED') return 'FAILED';

  if (input.terminalRunStatus === 'COMPLETED' || input.terminalRunStatus === 'COMPLETED_INCOMPLETE') {
    if (input.terminalReportStatus === 'READY') return 'COMPLETED';
    if (input.terminalReportStatus && REPORT_IN_FLIGHT.has(input.terminalReportStatus)) return 'PROCESSING';
    // The worker enqueues asynchronously, so an absent report is in flight.
    if (!input.terminalHasReport) return 'PROCESSING';
    return 'COMPLETED';
  }

  // A cancelled run is an operator's decision, not a product fault. Colouring
  // it as a failure is the same overclaim as an unmeasured coverage reading
  // being shown as zero.
  return 'NOT_STARTED';
}

// ─────────────────────────────────────────────────────────────
// Plan usage
// ─────────────────────────────────────────────────────────────

export interface PlanUsageInput {
  planName: string;
  applicationsUsed: number;
  applicationsLimit: number | null;
  storageBytes: bigint;
  storageLimitGb: number | null;
  retentionDays: number | null;
}

export function derivePlanUsage(input: PlanUsageInput): PlanUsage {
  return {
    planName: input.planName,
    applicationsUsed: input.applicationsUsed,
    applicationsLimit: input.applicationsLimit,
    // BigInt division first: Number() on a large byte sum loses precision
    // before the division would ever run.
    storageUsedMb: Number(input.storageBytes / 1024n) / 1024,
    storageLimitMb: input.storageLimitGb === null ? null : input.storageLimitGb * 1024,
    retentionDays: input.retentionDays,
  };
}

// ─────────────────────────────────────────────────────────────
// Health issues
// ─────────────────────────────────────────────────────────────

export const NO_RECENT_DATA_HOURS = 72;
export const PLAN_LIMIT_WARN_PERCENT = 90;
const HOUR_MS = 60 * 60 * 1000;

export interface HealthIssueInput {
  now: Date;
  /** The last-event watermark. */
  lastEventAt: Date | null;
  /** So a brand-new application is in onboarding, not in an alarm. */
  hasEverReceivedData: boolean;
  latestFailure: {
    runId: string;
    reportId: string | null;
    failedAt: Date | null;
    reason: string | null;
  } | null;
  usage: PlanUsage | null;
}

/**
 * Operational problems worth interrupting someone about.
 *
 * Returned most-actionable-first, because the client renders array order.
 */
export function deriveHealthIssues(input: HealthIssueInput): DashboardHealthIssue[] {
  const issues: DashboardHealthIssue[] = [];

  if (input.latestFailure) {
    issues.push({
      kind: 'ANALYSIS_FAILED',
      runId: input.latestFailure.runId,
      reportId: input.latestFailure.reportId,
      failedAt: input.latestFailure.failedAt?.toISOString() ?? null,
      reason: input.latestFailure.reason,
    });
  }

  const usage = input.usage;
  if (usage) {
    const storagePercent = percentOf(usage.storageUsedMb, usage.storageLimitMb);
    if (storagePercent !== null && storagePercent >= PLAN_LIMIT_WARN_PERCENT) {
      issues.push({
        kind: 'PLAN_LIMIT_REACHED',
        metric: 'STORAGE',
        planName: usage.planName,
        used: Math.round(usage.storageUsedMb),
        limit: usage.storageLimitMb as number,
        usedPercent: storagePercent,
        // What actually happens: new uploads are refused. Nothing is deleted —
        // retention runs on age, not on pressure.
        consequence: 'NEW_UPLOADS_REJECTED',
      });
    }

    const appPercent = percentOf(usage.applicationsUsed, usage.applicationsLimit);
    if (appPercent !== null && appPercent >= 100) {
      issues.push({
        kind: 'PLAN_LIMIT_REACHED',
        metric: 'APPLICATIONS',
        planName: usage.planName,
        used: usage.applicationsUsed,
        limit: usage.applicationsLimit as number,
        usedPercent: appPercent,
        consequence: 'NEW_APPLICATIONS_BLOCKED',
      });
    }
  }

  // Only raised once data has actually flowed. Otherwise a brand-new
  // application gets a red "no telemetry" banner on top of its setup guide.
  if (input.hasEverReceivedData && input.lastEventAt) {
    const hours = Math.floor((input.now.getTime() - input.lastEventAt.getTime()) / HOUR_MS);
    if (hours > NO_RECENT_DATA_HOURS) {
      issues.push({
        kind: 'NO_RECENT_DATA',
        lastEventAt: input.lastEventAt.toISOString(),
        hoursSinceLastEvent: hours,
      });
    }
  }

  return issues;
}

/** Null when there is no limit to be a percentage of. */
function percentOf(used: number, limit: number | null): number | null {
  if (limit === null || limit <= 0) return null;
  return Math.round((used / limit) * 100);
}

// ─────────────────────────────────────────────────────────────
// Reports
// ─────────────────────────────────────────────────────────────

export interface ReportCandidate {
  id: string;
  title: string | null;
  createdAt: Date;
  startedAt: Date | null;
  environmentName: string | null;
  report: { id: string; status: string; generatedAt: Date | null } | null;
}

/**
 * Runs whose report is actually readable.
 *
 * No download URL: none is stored, and the export route mints a one-hour
 * presigned link on demand — embedding one in a polled payload hands out a link
 * that expires while the page is still open.
 */
export function toReportSummaries(
  runs: ReportCandidate[],
  deriveTitle: (run: ReportCandidate) => string,
  limit = 4,
): ReportSummary[] {
  return runs
    .filter((run) => run.report?.status === 'READY' && run.report.generatedAt)
    .sort((a, b) => (b.report!.generatedAt!.getTime() - a.report!.generatedAt!.getTime()))
    .slice(0, limit)
    .map((run) => ({
      id: run.report!.id,
      title: deriveTitle(run),
      // QAReport has no type discriminator; an executive/technical split would
      // be invented here.
      type: 'QA',
      generatedAt: run.report!.generatedAt!.toISOString(),
      runId: run.id,
    }));
}

// ─────────────────────────────────────────────────────────────
// Expected vs observed
// ─────────────────────────────────────────────────────────────

export interface ReconciliationRow {
  id: string;
  flowId: string;
  flowName: string;
  qaRunId: string | null;
  generatedAt: Date;
  expectedCoverageScore: number;
  transitionCoverageScore: number;
  trueGapCount: number;
  trueGapTransitions: number;
  undeclaredCount: number;
  undeclaredTransitions: number;
}

/**
 * The newest report per flow.
 *
 * Reconciliation reports accumulate per run, so an unfiltered list counts the
 * same flow several times at several ages.
 */
export function latestReconciliationPerFlow<T extends { flowId: string; generatedAt: Date }>(
  rows: T[],
): T[] {
  const newest = new Map<string, T>();
  for (const row of rows) {
    const existing = newest.get(row.flowId);
    if (!existing || row.generatedAt > existing.generatedAt) newest.set(row.flowId, row);
  }
  return [...newest.values()];
}

/**
 * Expected coverage across everything declared.
 *
 * The mean of the newest score per flow. Taking a single newest report presents
 * one flow's score as the whole application's; averaging every report weights
 * flows by how often they happen to have been reconciled.
 */
export function deriveExpectedCoverage(rows: ReconciliationRow[]): MeasuredValue<number> {
  const latest = latestReconciliationPerFlow(rows);
  if (latest.length === 0) return notMeasured();
  const mean = latest.reduce((sum, row) => sum + row.expectedCoverageScore, 0) / latest.length;
  return measured(Number((mean * 100).toFixed(1)));
}

export function deriveExpectedVsObserved(input: {
  graphs: Array<{ id: string; name: string; nodeCount: number; edgeCount: number }>;
  reconciliations: ReconciliationRow[];
  limit?: number;
}): ExpectedVsObserved | null {
  if (input.graphs.length === 0) return null;

  const topGaps = latestReconciliationPerFlow(input.reconciliations)
    .map((row) => ({
      reportId: row.id,
      flowId: row.flowId,
      flowName: row.flowName,
      expectedCoverage: Number((row.expectedCoverageScore * 100).toFixed(1)),
      transitionCoverage: Number((row.transitionCoverageScore * 100).toFixed(1)),
      trueGapStateCount: row.trueGapCount,
      trueGapTransitionCount: row.trueGapTransitions,
      undeclaredStateCount: row.undeclaredCount,
      undeclaredTransitionCount: row.undeclaredTransitions,
      generatedAt: row.generatedAt.toISOString(),
      qaRunId: row.qaRunId,
    }))
    .sort((a, b) => {
      const gaps =
        b.trueGapStateCount + b.trueGapTransitionCount -
        (a.trueGapStateCount + a.trueGapTransitionCount);
      return gaps !== 0 ? gaps : b.generatedAt.localeCompare(a.generatedAt);
    })
    .slice(0, input.limit ?? 3);

  return {
    expected: {
      declaredFlowCount: input.graphs.length,
      expectedStateCount: input.graphs.reduce((sum, g) => sum + g.nodeCount, 0),
      expectedTransitionCount: input.graphs.reduce((sum, g) => sum + g.edgeCount, 0),
    },
    topGaps,
  };
}
