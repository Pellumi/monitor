import test from 'node:test';
import assert from 'node:assert/strict';

import {
  classifyGraphNodes,
  consecutivePairs,
  deriveErrorCoverage,
  deriveLifecycle,
  deriveMaturity,
  deriveWorkflowCoverage,
  measured,
  normaliseSeverity,
  ratioPercent,
  resolveRangeWindow,
  severityForCoverage,
  summariseFindings,
  topNodesByVisits,
  transitionKey,
  windowDays,
  withDelta,
  coverageHistoryLabel,
  deriveAnalysisStatus,
  deriveExpectedCoverage,
  deriveExpectedVsObserved,
  deriveHealthIssues,
  derivePlanUsage,
  isSnapshotMeasured,
  latestReconciliationPerFlow,
  pickDeltaBaseline,
  toCoverageHistory,
  toReportSummaries,
  withBasisDelta,
  type ReconciliationRow,
  type SnapshotPoint,
  type WorkflowCoverageInput,
} from './dashboard-derivation';

// ─────────────────────────────────────────────────────────────
// Measurement — the distinction the whole dashboard rests on
// ─────────────────────────────────────────────────────────────

test('an absent value is NOT_MEASURED, never zero', () => {
  assert.deepEqual(measured<number>(null), { status: 'NOT_MEASURED', value: null });
  assert.deepEqual(measured<number>(undefined), { status: 'NOT_MEASURED', value: null });
  // Zero is a real measurement and must survive.
  assert.deepEqual(measured(0), { status: 'MEASURED', value: 0 });
});

test('a ratio with no denominator is unmeasured rather than 0%', () => {
  assert.equal(ratioPercent(0, 0).status, 'NOT_MEASURED');
  assert.equal(ratioPercent(5, 0).status, 'NOT_MEASURED');
  assert.deepEqual(ratioPercent(1, 4), { status: 'MEASURED', value: 25 });
  // Zero observed out of a real denominator IS 0%, and must say so.
  assert.deepEqual(ratioPercent(0, 4), { status: 'MEASURED', value: 0 });
});

test('a ratio cannot exceed 100 or fall below 0', () => {
  assert.equal(ratioPercent(9, 4).value, 100);
  assert.equal(ratioPercent(-3, 4).value, 0);
});

test('a delta is only attached when both sides are measured', () => {
  assert.equal(withDelta(ratioPercent(1, 2), null).delta, undefined);
  assert.equal(withDelta({ status: 'NOT_MEASURED', value: null }, 40).delta, undefined);
  assert.equal(withDelta(ratioPercent(1, 2), 40).delta, 10);
});

// ─────────────────────────────────────────────────────────────
// Window — the selector that used to filter nothing
// ─────────────────────────────────────────────────────────────

const NOW = new Date('2026-09-26T12:00:00.000Z');

test('a range becomes real bounds', () => {
  const week = resolveRangeWindow('7d', undefined, undefined, NOW);
  assert.equal(week.range, '7d');
  assert.equal(week.fromDate?.toISOString(), '2026-09-19T12:00:00.000Z');

  const all = resolveRangeWindow('all', undefined, undefined, NOW);
  assert.equal(all.fromDate, null, 'all time has no lower bound');
});

test('an unrecognised range falls back to the default rather than filtering nothing', () => {
  const nonsense = resolveRangeWindow('yesterday-ish', undefined, undefined, NOW);
  assert.equal(nonsense.range, '30d');
  assert.equal(nonsense.fromDate?.toISOString(), '2026-08-27T12:00:00.000Z');
});

test('explicit bounds win over a range', () => {
  const custom = resolveRangeWindow('7d', '2026-01-01T00:00:00.000Z', '2026-02-01T00:00:00.000Z', NOW);
  assert.equal(custom.range, 'custom');
  assert.equal(custom.fromDate?.toISOString(), '2026-01-01T00:00:00.000Z');
  assert.equal(custom.toDate?.toISOString(), '2026-02-01T00:00:00.000Z');
});

test('an unparseable date is ignored rather than producing an Invalid Date bound', () => {
  const bad = resolveRangeWindow('30d', 'not-a-date', undefined, NOW);
  assert.equal(bad.range, '30d');
  assert.ok(bad.fromDate instanceof Date && !Number.isNaN(bad.fromDate.getTime()));
});

test('the endpoint engine gets a day count, and none for all-time', () => {
  assert.equal(windowDays(resolveRangeWindow('7d', undefined, undefined, NOW), NOW), 7);
  assert.equal(windowDays(resolveRangeWindow('all', undefined, undefined, NOW), NOW), null);
});

// ─────────────────────────────────────────────────────────────
// Lifecycle
// ─────────────────────────────────────────────────────────────

const lifecycleBase = {
  hasApplication: true,
  frontendConnected: true,
  backendConnected: false,
  demonstrationCompleted: true,
  firstAnalysisReviewed: true,
  analysisCount: 5,
  activeRunStatus: null as string | null,
};

test('a live run outranks everything else', () => {
  assert.equal(deriveLifecycle({ ...lifecycleBase, activeRunStatus: 'RECORDING' }), 'DEMONSTRATION_IN_PROGRESS');
  assert.equal(deriveLifecycle({ ...lifecycleBase, activeRunStatus: 'RUNNING' }), 'DEMONSTRATION_IN_PROGRESS');
  assert.equal(deriveLifecycle({ ...lifecycleBase, activeRunStatus: 'PROCESSING' }), 'ANALYSIS_IN_PROGRESS');
});

test('an armed but idle run does not claim a demonstration is under way', () => {
  assert.equal(deriveLifecycle({ ...lifecycleBase, activeRunStatus: 'ARMED' }), 'ACTIVE');
  assert.equal(deriveLifecycle({ ...lifecycleBase, activeRunStatus: 'WAITING_FOR_INITIAL' }), 'ACTIVE');
});

test('SDK_SETUP requires both SDKs to be absent', () => {
  assert.equal(
    deriveLifecycle({ ...lifecycleBase, frontendConnected: false, backendConnected: false, analysisCount: 0, demonstrationCompleted: false }),
    'SDK_SETUP',
  );
  assert.notEqual(
    deriveLifecycle({ ...lifecycleBase, frontendConnected: false, backendConnected: true }),
    'SDK_SETUP',
  );
});

test('an acknowledged first analysis releases the celebration card', () => {
  const unreviewed = { ...lifecycleBase, analysisCount: 1, firstAnalysisReviewed: false };
  assert.equal(deriveLifecycle(unreviewed), 'FIRST_ANALYSIS_READY');
  // Persisting the acknowledgement is what stops a single-session account being
  // shown the celebration on every reload.
  assert.equal(deriveLifecycle({ ...unreviewed, firstAnalysisReviewed: true }), 'ACTIVE');
});

test('no application short-circuits to NEW_ACCOUNT', () => {
  assert.equal(deriveLifecycle({ ...lifecycleBase, hasApplication: false }), 'NEW_ACCOUNT');
});

test('maturity tracks whichever signal is further along', () => {
  assert.equal(deriveMaturity(0, 0), 'NEW');
  assert.equal(deriveMaturity(0, 5), 'EARLY');
  assert.equal(deriveMaturity(20, 0), 'ESTABLISHED');
});

// ─────────────────────────────────────────────────────────────
// Workflow coverage
// ─────────────────────────────────────────────────────────────

function workflow(over: Partial<WorkflowCoverageInput> = {}): WorkflowCoverageInput {
  return {
    id: 'wf-1',
    name: 'Checkout',
    path: ['CART', 'CHECKOUT', 'CHECKOUT_SUCCESS'],
    stateCount: 3,
    transitionCount: 2,
    executionCount: 4,
    lastDemonstratedAt: null,
    observedTransitions: new Set<string>(),
    scopeHasObservations: true,
    ...over,
  };
}

test('a single-state workflow is unmeasured, not zero', () => {
  const result = deriveWorkflowCoverage(workflow({ path: ['HOME'], transitionCount: 0 }));
  assert.equal(result.coverage.status, 'NOT_MEASURED');
  assert.equal(result.missingPathCount, null, 'a "Complete" badge must not be derivable from an absent count');
});

test('an empty scope reports nothing measured rather than a universal 0%', () => {
  // The regression this guards: a quiet window rendering every workflow as a
  // red 0% bar, asserting a collapse that never happened.
  const result = deriveWorkflowCoverage(workflow({ scopeHasObservations: false }));
  assert.equal(result.coverage.status, 'NOT_MEASURED');
  assert.equal(result.missingPathCount, null);
  assert.equal(result.severity, 'INFO');
});

test('a fully re-observed path is 100% with nothing missing', () => {
  const result = deriveWorkflowCoverage(
    workflow({
      observedTransitions: new Set([transitionKey('CART', 'CHECKOUT'), transitionKey('CHECKOUT', 'CHECKOUT_SUCCESS')]),
    }),
  );
  assert.deepEqual(result.coverage, { status: 'MEASURED', value: 100 });
  assert.equal(result.missingPathCount, 0);
  assert.equal(result.observedTransitionCount, 2);
  assert.equal(result.severity, 'LOW');
});

test('a partially re-observed path reports the exact fraction', () => {
  const result = deriveWorkflowCoverage(
    workflow({ observedTransitions: new Set([transitionKey('CART', 'CHECKOUT')]) }),
  );
  assert.deepEqual(result.coverage, { status: 'MEASURED', value: 50 });
  assert.equal(result.missingPathCount, 1);
  assert.equal(result.observedTransitionCount, 1);
});

test('an unobserved path inside a scope that saw other traffic is a real 0%', () => {
  const result = deriveWorkflowCoverage(
    workflow({ observedTransitions: new Set([transitionKey('LOGIN', 'HOME')]), scopeHasObservations: true }),
  );
  assert.deepEqual(result.coverage, { status: 'MEASURED', value: 0 });
  assert.equal(result.missingPathCount, 2);
  assert.equal(result.severity, 'CRITICAL');
});

test('a declared flow overrides the observed-path estimate', () => {
  const result = deriveWorkflowCoverage(workflow({ declaredCoverageScore: 0.735 }));
  assert.deepEqual(result.coverage, { status: 'MEASURED', value: 73.5 });
});

test('a malformed path is survived rather than crashed on', () => {
  const result = deriveWorkflowCoverage(workflow({ path: 'CART->CHECKOUT' as unknown, transitionCount: 0 }));
  assert.equal(result.coverage.status, 'NOT_MEASURED');
});

test('severity is only claimed where coverage is known', () => {
  assert.equal(severityForCoverage({ status: 'NOT_MEASURED', value: null }), 'INFO');
  assert.equal(severityForCoverage({ status: 'MEASURED', value: 30 }), 'CRITICAL');
  assert.equal(severityForCoverage({ status: 'MEASURED', value: 90 }), 'LOW');
});

test('consecutivePairs walks a path into its steps', () => {
  assert.deepEqual(consecutivePairs(['A', 'B', 'C']), [['A', 'B'], ['B', 'C']]);
  assert.deepEqual(consecutivePairs(['A']), []);
  assert.deepEqual(consecutivePairs([]), []);
});

// ─────────────────────────────────────────────────────────────
// Error coverage
// ─────────────────────────────────────────────────────────────

test('error coverage counts observed error states against the ruleset expectation', () => {
  const result = deriveErrorCoverage({
    expectedErrorStates: ['LOGIN_FAILURE', 'API_ERROR', 'PASSWORD_RESET', 'RATE_LIMITED'],
    observedStateNames: new Set(['LOGIN_FAILURE', 'API_ERROR', 'HOME']),
  });
  assert.deepEqual(result, { status: 'MEASURED', value: 50 });
});

test('error coverage with no ruleset expectation is unmeasured, not 0%', () => {
  const result = deriveErrorCoverage({ expectedErrorStates: [], observedStateNames: new Set(['HOME']) });
  assert.equal(result.status, 'NOT_MEASURED');
});

// ─────────────────────────────────────────────────────────────
// Findings
// ─────────────────────────────────────────────────────────────

test('severity is read from the record, never inferred from confidence', () => {
  assert.equal(normaliseSeverity('HIGH'), 'HIGH');
  assert.equal(normaliseSeverity('critical'), 'CRITICAL');
  // An unrecognised value does not get promoted upward.
  assert.equal(normaliseSeverity('catastrophic'), 'MEDIUM');
  assert.equal(normaliseSeverity(null), 'MEDIUM');
});

test('the severity breakdown sums to the total', () => {
  const tally = summariseFindings([
    { severity: 'CRITICAL' },
    { severity: 'HIGH' },
    { severity: 'HIGH' },
    { severity: 'MEDIUM' },
    { severity: 'LOW' },
  ]);
  assert.deepEqual(tally, { total: 5, critical: 1, high: 2, medium: 1, low: 1 });
  assert.equal(tally.critical + tally.high + tally.medium + tally.low, tally.total);
});

// ─────────────────────────────────────────────────────────────
// Graph
// ─────────────────────────────────────────────────────────────

test('entry and exit points come from degree, not row order', () => {
  // Previously taken from the first and last element of an unordered findMany,
  // which made both counts always exactly 1.
  const nodes = [{ id: 'b' }, { id: 'a' }, { id: 'c' }, { id: 'd' }];
  const edges = [
    { source: 'a', target: 'b' },
    { source: 'b', target: 'c' },
    { source: 'd', target: 'b' },
  ];
  const classified = classifyGraphNodes(nodes, edges);
  assert.equal(classified.get('a'), 'entry');
  assert.equal(classified.get('d'), 'entry', 'a second entry point must be found');
  assert.equal(classified.get('b'), 'state');
  assert.equal(classified.get('c'), 'exit');
});

test('an isolated node is neither an entry nor an exit', () => {
  const classified = classifyGraphNodes([{ id: 'lonely' }], []);
  assert.equal(classified.get('lonely'), 'state');
});

test('the preview keeps the most-visited nodes and is bounded', () => {
  const nodes = Array.from({ length: 40 }, (_, i) => ({ id: `s${i}`, visitCount: i }));
  const top = topNodesByVisits(nodes, 12);
  assert.equal(top.length, 12);
  assert.equal(top[0].id, 's39');
});

// ─────────────────────────────────────────────────────────────
// Snapshots and deltas
// ─────────────────────────────────────────────────────────────

function snapshot(over: Partial<SnapshotPoint> = {}): SnapshotPoint {
  return {
    id: 's1',
    createdAt: new Date('2026-09-26T12:00:00.000Z'),
    coveragePercent: 60,
    transitionCoverage: 50,
    flowCoverage: 70,
    observedStates: 20,
    observedTransitions: 30,
    openFindings: 10,
    ...over,
  };
}

test('a snapshot that never recorded its counters is not a measurement', () => {
  assert.equal(isSnapshotMeasured(snapshot()), true);
  assert.equal(isSnapshotMeasured(snapshot({ observedTransitions: null })), false);
  assert.equal(isSnapshotMeasured(snapshot({ openFindings: null })), false);
});

test('a measured zero is still a measurement', () => {
  // The counterpart to the rule above: the fix must not over-reach and treat a
  // genuine zero as absent.
  assert.equal(isSnapshotMeasured(snapshot({ observedTransitions: 0, openFindings: 0 })), true);
});

test('no delta is produced against a snapshot that predates the counters', () => {
  // The regression this phase exists to prevent: differencing against a column
  // default would announce a large improvement that never happened.
  const series = [
    snapshot({ id: 'new' }),
    snapshot({ id: 'old', observedTransitions: null, openFindings: null }),
  ];
  const { baseline, basis } = pickDeltaBaseline(series, null);
  // Computed before the null assertions below, which narrow `baseline` away.
  const result = withBasisDelta(measured(30), baseline?.observedTransitions, basis);

  assert.equal(baseline, null);
  assert.equal(basis, null);
  assert.equal(result.delta, undefined);
  assert.ok(!('deltaBasis' in result), 'a basis without a delta is its own bug');
});

test('a delta against a real earlier snapshot is produced and named', () => {
  const series = [
    snapshot({ id: 'new', flowCoverage: 76.2 }),
    snapshot({ id: 'old', flowCoverage: 71.5, createdAt: new Date('2026-09-20T12:00:00.000Z') }),
  ];
  const { baseline, basis } = pickDeltaBaseline(series, null);
  assert.equal(baseline?.id, 'old');
  assert.equal(basis, 'PREVIOUS_ANALYSIS');

  const result = withBasisDelta(measured(76.2), baseline?.flowCoverage, basis);
  assert.equal(result.delta, 4.7);
  assert.equal(result.deltaBasis, 'PREVIOUS_ANALYSIS');
});

test('a single snapshot has nothing to compare against', () => {
  const { baseline, basis } = pickDeltaBaseline([snapshot()], null);
  assert.equal(baseline, null);
  assert.equal(basis, null);
});

test('a bounded window compares against the state of the world when it opened', () => {
  const windowFrom = new Date('2026-09-19T00:00:00.000Z');
  const series = [
    snapshot({ id: 'inside', createdAt: new Date('2026-09-25T00:00:00.000Z') }),
    snapshot({ id: 'alsoInside', createdAt: new Date('2026-09-22T00:00:00.000Z') }),
    snapshot({ id: 'atOpen', createdAt: new Date('2026-09-18T00:00:00.000Z') }),
  ];
  const { baseline, basis } = pickDeltaBaseline(series, windowFrom);
  assert.equal(baseline?.id, 'atOpen', 'must not pick a snapshot inside the window');
  assert.equal(basis, 'PREVIOUS_WINDOW');
});

test('an exhausted window falls back to the previous analysis and says so', () => {
  const windowFrom = new Date('2026-01-01T00:00:00.000Z');
  const series = [
    snapshot({ id: 'new', createdAt: new Date('2026-09-25T00:00:00.000Z') }),
    snapshot({ id: 'older', createdAt: new Date('2026-09-22T00:00:00.000Z') }),
  ];
  const { baseline, basis } = pickDeltaBaseline(series, windowFrom);
  assert.equal(baseline?.id, 'older');
  assert.equal(basis, 'PREVIOUS_ANALYSIS', 'a fallback must not be labelled a window comparison');
});

// ─────────────────────────────────────────────────────────────
// Coverage history
// ─────────────────────────────────────────────────────────────

test('history comes back oldest-first however the database returned it', () => {
  // Recharts plots array order; an unreversed series draws the trend backwards.
  const series = [
    snapshot({ id: 'c', createdAt: new Date('2026-09-26T00:00:00.000Z') }),
    snapshot({ id: 'b', createdAt: new Date('2026-09-20T00:00:00.000Z') }),
    snapshot({ id: 'a', createdAt: new Date('2026-09-10T00:00:00.000Z') }),
  ];
  const history = toCoverageHistory(series);
  assert.deepEqual(history.map((point) => point.analysisId), ['a', 'b', 'c']);
});

test('the cap keeps the newest analyses, not the first rows returned', () => {
  const series = Array.from({ length: 50 }, (_, i) =>
    snapshot({ id: `s${i}`, createdAt: new Date(Date.UTC(2026, 0, 50 - i)) }),
  );
  const history = toCoverageHistory(series, 30);
  assert.equal(history.length, 30);
  assert.equal(history[history.length - 1].analysisId, 's0', 'the newest must survive the cap');
});

test('unmeasured snapshots are dropped rather than plotted as a cliff to zero', () => {
  const series = [
    snapshot({ id: 'good' }),
    snapshot({ id: 'ancient', observedTransitions: null, openFindings: null, flowCoverage: 0 }),
  ];
  assert.deepEqual(toCoverageHistory(series).map((p) => p.analysisId), ['good']);
});

test('labels are locale-free and disambiguate same-day analyses', () => {
  assert.equal(coverageHistoryLabel(new Date('2026-09-26T14:30:00.000Z'), false), '2026-09-26');
  assert.equal(coverageHistoryLabel(new Date('2026-09-26T14:30:00.000Z'), true), '2026-09-26 14:30');

  const sameDay = [
    snapshot({ id: 'pm', createdAt: new Date('2026-09-26T16:00:00.000Z') }),
    snapshot({ id: 'am', createdAt: new Date('2026-09-26T09:00:00.000Z') }),
  ];
  const labels = toCoverageHistory(sameDay).map((p) => p.label);
  assert.notEqual(labels[0], labels[1], 'two analyses in one day need distinguishable ticks');
});

// ─────────────────────────────────────────────────────────────
// Analysis status
// ─────────────────────────────────────────────────────────────

const analysisBase = {
  activeRunStatus: null as string | null,
  pendingRunStatus: null as string | null,
  terminalRunStatus: null as string | null,
  terminalReportStatus: null as string | null,
  terminalHasReport: false,
};

test('a completed run whose report is still generating is not COMPLETED', () => {
  assert.equal(
    deriveAnalysisStatus({
      ...analysisBase,
      terminalRunStatus: 'COMPLETED',
      terminalReportStatus: 'GENERATING',
      terminalHasReport: true,
    }),
    'PROCESSING',
  );
});

test('a successful run with a failed report is a failure', () => {
  assert.equal(
    deriveAnalysisStatus({
      ...analysisBase,
      terminalRunStatus: 'COMPLETED',
      terminalReportStatus: 'FAILED',
      terminalHasReport: true,
    }),
    'FAILED',
  );
});

test('a completed run with no report row yet is still in flight', () => {
  assert.equal(
    deriveAnalysisStatus({ ...analysisBase, terminalRunStatus: 'COMPLETED', terminalHasReport: false }),
    'PROCESSING',
  );
});

test('an armed run is queued, not unstarted', () => {
  assert.equal(deriveAnalysisStatus({ ...analysisBase, pendingRunStatus: 'ARMED' }), 'QUEUED');
});

test('a cancelled run is not reported as a failure', () => {
  assert.equal(deriveAnalysisStatus({ ...analysisBase, terminalRunStatus: 'CANCELLED' }), 'NOT_STARTED');
});

test('a live run outranks any terminal history', () => {
  assert.equal(
    deriveAnalysisStatus({ ...analysisBase, activeRunStatus: 'RECORDING', terminalRunStatus: 'FAILED' }),
    'PROCESSING',
  );
});

// ─────────────────────────────────────────────────────────────
// Plan usage and health
// ─────────────────────────────────────────────────────────────

test('gigabyte limits become megabytes exactly', () => {
  const usage = derivePlanUsage({
    planName: 'SOLO',
    applicationsUsed: 2,
    applicationsLimit: 3,
    storageBytes: 1024n * 1024n * 512n,
    storageLimitGb: 5,
    retentionDays: 90,
  });
  assert.equal(usage.storageLimitMb, 5120);
  assert.equal(usage.storageUsedMb, 512);
});

test('a byte sum beyond safe-integer range keeps its precision', () => {
  const huge = 9007199254740993n * 1024n;
  const usage = derivePlanUsage({
    planName: 'ENTERPRISE',
    applicationsUsed: 1,
    applicationsLimit: null,
    storageBytes: huge,
    storageLimitGb: null,
    retentionDays: null,
  });
  assert.ok(usage.storageUsedMb > 8.7e9, 'BigInt division must happen before Number()');
  assert.equal(usage.storageLimitMb, null, 'an unlimited plan has no limit, not zero');
});

test('an application that never reported data is not put in a freshness alarm', () => {
  const issues = deriveHealthIssues({
    now: new Date('2026-09-26T12:00:00.000Z'),
    lastEventAt: null,
    hasEverReceivedData: false,
    latestFailure: null,
    usage: null,
  });
  assert.deepEqual(issues, []);
});

test('the freshness threshold holds on both sides of 72 hours', () => {
  const now = new Date('2026-09-26T12:00:00.000Z');
  const at = (hours: number) => new Date(now.getTime() - hours * 60 * 60 * 1000);
  const issuesFor = (hours: number) =>
    deriveHealthIssues({
      now,
      lastEventAt: at(hours),
      hasEverReceivedData: true,
      latestFailure: null,
      usage: null,
    });

  assert.equal(issuesFor(71).length, 0);
  assert.equal(issuesFor(73)[0]?.kind, 'NO_RECENT_DATA');
});

test('a storage banner carries the real percentage and never blames retention', () => {
  const issues = deriveHealthIssues({
    now: new Date('2026-09-26T12:00:00.000Z'),
    lastEventAt: new Date('2026-09-26T11:00:00.000Z'),
    hasEverReceivedData: true,
    latestFailure: null,
    usage: {
      planName: 'SOLO',
      applicationsUsed: 1,
      applicationsLimit: 3,
      storageUsedMb: 4812.8,
      storageLimitMb: 5120,
      retentionDays: 90,
    },
  });
  const storage = issues.find((issue) => issue.kind === 'PLAN_LIMIT_REACHED');
  assert.ok(storage && storage.kind === 'PLAN_LIMIT_REACHED');
  assert.equal(storage.usedPercent, 94, 'the figure must be computed, not hardcoded');
  assert.equal(storage.consequence, 'NEW_UPLOADS_REJECTED');
  assert.ok(!JSON.stringify(storage).toLowerCase().includes('retention'));
});

test('an unlimited plan has no percentage and therefore no banner', () => {
  const issues = deriveHealthIssues({
    now: new Date('2026-09-26T12:00:00.000Z'),
    lastEventAt: new Date('2026-09-26T11:00:00.000Z'),
    hasEverReceivedData: true,
    latestFailure: null,
    usage: {
      planName: 'ENTERPRISE',
      applicationsUsed: 40,
      applicationsLimit: null,
      storageUsedMb: 900000,
      storageLimitMb: null,
      retentionDays: null,
    },
  });
  assert.deepEqual(issues, []);
});

test('health issues come back most-actionable-first', () => {
  const issues = deriveHealthIssues({
    now: new Date('2026-09-26T12:00:00.000Z'),
    lastEventAt: new Date('2026-09-01T12:00:00.000Z'),
    hasEverReceivedData: true,
    latestFailure: { runId: 'run-1', reportId: null, failedAt: null, reason: 'Safe reason' },
    usage: {
      planName: 'SOLO',
      applicationsUsed: 3,
      applicationsLimit: 3,
      storageUsedMb: 5000,
      storageLimitMb: 5120,
      retentionDays: 90,
    },
  });
  assert.deepEqual(issues.map((issue) => issue.kind), [
    'ANALYSIS_FAILED',
    'PLAN_LIMIT_REACHED',
    'PLAN_LIMIT_REACHED',
    'NO_RECENT_DATA',
  ]);
});

// ─────────────────────────────────────────────────────────────
// Reports and reconciliation
// ─────────────────────────────────────────────────────────────

test('only readable reports are listed, newest first', () => {
  const run = (id: string, status: string, generatedAt: Date | null) => ({
    id,
    title: null,
    createdAt: new Date('2026-09-01T00:00:00.000Z'),
    startedAt: null,
    environmentName: 'Development',
    report: { id: `rep-${id}`, status, generatedAt },
  });
  const summaries = toReportSummaries(
    [
      run('a', 'READY', new Date('2026-09-10T00:00:00.000Z')),
      run('b', 'GENERATING', null),
      run('c', 'READY', new Date('2026-09-20T00:00:00.000Z')),
      run('d', 'FAILED', null),
    ],
    () => 'Derived title',
  );
  assert.deepEqual(summaries.map((s) => s.runId), ['c', 'a']);
  assert.equal(summaries[0].type, 'QA');
  assert.equal(summaries[0].title, 'Derived title');
});

test('only the newest reconciliation per flow counts', () => {
  const row = (id: string, flowId: string, at: string, score: number): ReconciliationRow => ({
    id,
    flowId,
    flowName: flowId,
    qaRunId: null,
    generatedAt: new Date(at),
    expectedCoverageScore: score,
    transitionCoverageScore: score,
    trueGapCount: 1,
    trueGapTransitions: 0,
    undeclaredCount: 0,
    undeclaredTransitions: 0,
  });
  const rows = [
    row('r1', 'flow-a', '2026-09-20T00:00:00.000Z', 0.9),
    row('r2', 'flow-a', '2026-09-10T00:00:00.000Z', 0.1),
    row('r3', 'flow-b', '2026-09-15T00:00:00.000Z', 0.7),
  ];
  assert.equal(latestReconciliationPerFlow(rows).length, 2);
  // Mean of 0.9 and 0.7 — not dragged down by the stale 0.1 for flow-a.
  assert.deepEqual(deriveExpectedCoverage(rows), { status: 'MEASURED', value: 80 });
});

test('expected coverage with nothing declared is unmeasured', () => {
  assert.equal(deriveExpectedCoverage([]).status, 'NOT_MEASURED');
});

test('an application that declared nothing gets null, not a zeroed summary', () => {
  assert.equal(deriveExpectedVsObserved({ graphs: [], reconciliations: [] }), null);
});

test('top gaps rank by total true gaps across states and transitions', () => {
  const row = (id: string, flowId: string, gaps: number, transGaps: number): ReconciliationRow => ({
    id,
    flowId,
    flowName: flowId,
    qaRunId: null,
    generatedAt: new Date('2026-09-20T00:00:00.000Z'),
    expectedCoverageScore: 0.5,
    transitionCoverageScore: 0.5,
    trueGapCount: gaps,
    trueGapTransitions: transGaps,
    undeclaredCount: 0,
    undeclaredTransitions: 0,
  });
  const result = deriveExpectedVsObserved({
    graphs: [{ id: 'g1', name: 'Checkout', nodeCount: 8, edgeCount: 7 }],
    reconciliations: [row('r1', 'a', 1, 1), row('r2', 'b', 5, 0), row('r3', 'c', 0, 9)],
  });
  assert.deepEqual(result?.topGaps.map((g) => g.flowId), ['c', 'b', 'a']);
  assert.equal(result?.expected.expectedStateCount, 8);
});

test('reconciliation scores are scaled from 0..1 exactly once', () => {
  const result = deriveExpectedVsObserved({
    graphs: [{ id: 'g1', name: 'Flow', nodeCount: 1, edgeCount: 1 }],
    reconciliations: [
      {
        id: 'r1',
        flowId: 'a',
        flowName: 'a',
        qaRunId: null,
        generatedAt: new Date('2026-09-20T00:00:00.000Z'),
        expectedCoverageScore: 0.873,
        transitionCoverageScore: 0.5,
        trueGapCount: 0,
        trueGapTransitions: 0,
        undeclaredCount: 0,
        undeclaredTransitions: 0,
      },
    ],
  });
  assert.equal(result?.topGaps[0].expectedCoverage, 87.3);
});
