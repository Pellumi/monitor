import assert from 'node:assert/strict';
import test from 'node:test';
import { selectAppendixEvents, strideIndices } from './qa-evidence-appendix';
import { assessCoverageConfidence, buildSummaryText, confidenceBand } from './qa-report-worker';
import { baselineKey, compareToBaseline, fetchEndpointBaselines } from './qa-endpoint-baseline';

function events(spec: Array<[string, number]>): Array<{ id: string; eventType: string }> {
  const out: Array<{ id: string; eventType: string }> = [];
  for (const [eventType, count] of spec) {
    for (let n = 0; n < count; n += 1) out.push({ id: `${eventType}-${n}`, eventType });
  }
  return out;
}

// ── Appendix sampling ───────────────────────────────────────────────────────

test('an appendix within budget carries everything, untouched', () => {
  const all = events([['QA_REQUEST', 10]]);
  const selection = selectAppendixEvents(all, new Set(), 2_000);
  assert.equal(selection.events.length, 10);
  assert.equal(selection.truncated, 0);
  assert.deepEqual(selection.byType.QA_REQUEST, { kept: 10, total: 10 });
});

test('every event a finding cites survives, however tight the budget', () => {
  // A report that cites evidence it did not carry cannot be checked, which is
  // the entire purpose of the appendix.
  const all = events([['QA_REQUEST', 500]]);
  const cited = new Set(['QA_REQUEST-499', 'QA_REQUEST-498']);
  const selection = selectAppendixEvents(all, cited, 10);
  assert.equal(selection.events.length, 10);
  for (const id of cited) {
    assert.ok(selection.events.some((event) => event.id === id), `${id} survived`);
  }
});

test('flow and error events are never sampled away', () => {
  const all = events([['QA_REQUEST', 900], ['QA_PAGE_CRASH', 1], ['QA_FLOW_EVENT', 4]]);
  const selection = selectAppendixEvents(all, new Set(), 50);
  assert.equal(selection.byType.QA_PAGE_CRASH.kept, 1);
  assert.equal(selection.byType.QA_FLOW_EVENT.kept, 4);
});

test('a noisy type cannot crowd out a quiet one', () => {
  const all = events([['QA_REQUEST', 5_000], ['QA_CONSOLE', 2]]);
  const selection = selectAppendixEvents(all, new Set(), 100);
  assert.equal(selection.byType.QA_CONSOLE.kept, 2, 'both console rows kept');
  assert.ok(selection.byType.QA_REQUEST.kept > 50, 'the rest of the budget went to requests');
  assert.equal(selection.events.length, 100);
});

test('the sample spans the whole run rather than its beginning', () => {
  // The bug this replaces: slice(0, N) made the appendix the warm-up.
  const all = events([['QA_REQUEST', 1_000]]);
  const selection = selectAppendixEvents(all, new Set(), 10);
  const indices = selection.events.map((event) => Number(event.id.split('-')[1]));
  assert.ok(indices[0] < 100, 'starts near the beginning');
  assert.ok(indices[indices.length - 1] > 900, 'reaches the end');
});

test('the appendix still reads as a timeline', () => {
  const all = events([['QA_REQUEST', 200], ['QA_CONSOLE', 200]]);
  const selection = selectAppendixEvents(all, new Set(['QA_CONSOLE-199']), 40);
  const positions = selection.events.map((event) => all.findIndex((candidate) => candidate.id === event.id));
  assert.deepEqual(positions, [...positions].sort((left, right) => left - right));
});

test('kept plus truncated always accounts for every event', () => {
  const all = events([['QA_REQUEST', 800], ['QA_CONSOLE', 300], ['QA_FIELD_CHANGED', 400]]);
  const selection = selectAppendixEvents(all, new Set(), 250);
  assert.equal(selection.events.length + selection.truncated, all.length);
  const kept = Object.values(selection.byType).reduce((sum, row) => sum + row.kept, 0);
  assert.equal(kept, selection.events.length);
});

test('strideIndices spreads picks instead of taking a head slice', () => {
  assert.deepEqual(strideIndices(10, 10), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.deepEqual(strideIndices(10, 3), [0, 5, 9]);
  assert.deepEqual(strideIndices(10, 1), [5], 'a single pick lands in the middle, not on an edge');
  assert.deepEqual(strideIndices(0, 5), []);
  assert.deepEqual(strideIndices(5, 0), []);
});

// ── Summary sentence ────────────────────────────────────────────────────────

const NO_SECTIONS = { backend: null, frontend: null };

function frontendSection(overrides: Record<string, unknown> = {}) {
  return {
    console: { errors: 2, warnings: 0, groups: [] },
    networkTotals: { requests: 10, failed: 1, blocked: 0, errors: 2, transferredBytes: 0, p95Ms: null },
    accessibility: { scans: 1, routesScanned: 1, violations: 4, byImpact: {}, rules: [], cleanRoutes: [] },
    worstVital: { route: '/checkout', metric: 'LCP', value: 5_200 },
    routes: [], routesObserved: 1, network: [], networkGroupsSeen: 0,
    runtimeErrors: 0, crashes: 0,
    interactions: {
      clicks: 0, clicksPreBoundary: 0, submitIntents: 0, submitIntentsPreBoundary: 0,
      submitted: 0, invalidSubmits: 0, invalidRate: null, fieldChanges: 0, forms: [],
    },
    storageMutations: 0, clientStateMutations: 0, limitations: [],
    ...overrides,
  } as never;
}

function backendSection(overrides: Record<string, unknown> = {}) {
  return { requests: 20, errors: 3, p95Ms: 180, ...overrides } as never;
}

test('a backend-only run keeps the sentence it always had', () => {
  const text = buildSummaryText({
    captureTracks: ['BACKEND'], hasDeclaredFlow: false,
    observedStates: 0, observedTransitions: 0, expectedCoverage: null,
    totalFindings: 1, criticalOrHighFindings: 1,
    backend: backendSection(), frontend: null,
  });
  assert.equal(
    text,
    'Backend run: 20 requests handled, 3 failed, p95 180ms. 1 finding raised (1 critical or high priority).',
  );
});

test('a frontend flow run carries the numbers it actually found', () => {
  // It used to say only "N states visited" — no mention of the console errors,
  // failed requests or accessibility violations the same run had just found.
  const text = buildSummaryText({
    captureTracks: ['FRONTEND'], hasDeclaredFlow: true,
    observedStates: 4, observedTransitions: 3, expectedCoverage: 80,
    totalFindings: 6, criticalOrHighFindings: 2,
    backend: null, frontend: frontendSection(),
  });
  assert.ok(text.startsWith('Flow run: 4 states visited, 3 transitions, 80.0% expected coverage.'));
  assert.ok(text.includes('2 console errors'));
  assert.ok(text.includes('3 failed requests'));
  assert.ok(text.includes('4 accessibility violations'));
  assert.ok(text.includes('worst vital LCP 5.2s on /checkout'));
  assert.ok(text.endsWith('6 findings raised (2 critical or high priority).'));
});

test('a mixed-track run describes both sides in one sentence', () => {
  const text = buildSummaryText({
    captureTracks: ['FRONTEND', 'BACKEND'], hasDeclaredFlow: true,
    observedStates: 2, observedTransitions: 1, expectedCoverage: 50,
    totalFindings: 0, criticalOrHighFindings: 0,
    backend: backendSection(), frontend: frontendSection(),
  });
  assert.ok(text.startsWith('Full-stack run:'));
  assert.ok(text.includes('Server handled 20 requests, 3 failed, p95 180ms.'));
  assert.ok(text.includes('No findings were raised'));
});

test('an observational run with nothing wrong says so plainly', () => {
  const text = buildSummaryText({
    captureTracks: ['FRONTEND'], hasDeclaredFlow: false,
    observedStates: 1, observedTransitions: 0, expectedCoverage: null,
    totalFindings: 0, criticalOrHighFindings: 0, ...NO_SECTIONS,
  });
  assert.equal(
    text,
    'Observational run: 1 state observed. No findings were raised — everything this run exercised completed as expected.',
  );
});

test('a CLS worst-vital reads as a score, not a duration', () => {
  const text = buildSummaryText({
    captureTracks: ['FRONTEND'], hasDeclaredFlow: false,
    observedStates: 0, observedTransitions: 0, expectedCoverage: null,
    totalFindings: 0, criticalOrHighFindings: 0,
    backend: null,
    frontend: frontendSection({ worstVital: { route: '/a', metric: 'CLS', value: 0.41 } }),
  });
  assert.ok(text.includes('worst vital CLS 0.41 on /a'));
});

// ── Coverage confidence ─────────────────────────────────────────────────────

const CLEAN = {
  hasExpectedCoverage: true,
  captureDegraded: false,
  repositoryDirty: false,
  hasValidatedInstrumentation: true,
  hasClientStateEvidence: true,
  productionCapture: false,
  appendixTruncated: false,
  quarantinedEvents: 0,
};

test('a clean run earns full confidence and says nothing', () => {
  const result = assessCoverageConfidence(CLEAN);
  assert.equal(result.score, 1);
  assert.equal(result.band, 'HIGH');
  assert.deepEqual(result.caveats, []);
});

test('a run with no coverage figure has no confidence to report', () => {
  const result = assessCoverageConfidence({ ...CLEAN, hasExpectedCoverage: false });
  assert.equal(result.score, null);
  assert.equal(result.band, null);
  assert.deepEqual(result.caveats, []);
});

test('degraded capture alone drops the figure out of HIGH', () => {
  const result = assessCoverageConfidence({ ...CLEAN, captureDegraded: true });
  assert.equal(result.band, 'LOW');
  assert.equal(result.caveats.length, 1);
  assert.ok(result.caveats[0].includes('rejected rather than'));
});

test('each condition contributes its own sentence and only its own', () => {
  assert.equal(assessCoverageConfidence({ ...CLEAN, repositoryDirty: true }).caveats.length, 1);
  assert.equal(assessCoverageConfidence({ ...CLEAN, hasValidatedInstrumentation: false }).caveats.length, 1);
  assert.equal(assessCoverageConfidence({ ...CLEAN, hasClientStateEvidence: false }).caveats.length, 1);
  assert.equal(assessCoverageConfidence({ ...CLEAN, productionCapture: true }).caveats.length, 1);
  assert.equal(assessCoverageConfidence({ ...CLEAN, appendixTruncated: true }).caveats.length, 1);
  assert.equal(assessCoverageConfidence({ ...CLEAN, quarantinedEvents: 2 }).caveats.length, 1);
});

test('conditions compose, and the score never falls through the floor', () => {
  const result = assessCoverageConfidence({
    hasExpectedCoverage: true,
    captureDegraded: true,
    repositoryDirty: true,
    hasValidatedInstrumentation: false,
    hasClientStateEvidence: false,
    productionCapture: true,
    appendixTruncated: true,
    quarantinedEvents: 5,
  });
  assert.equal(result.caveats.length, 7);
  assert.equal(result.band, 'LOW');
  assert.ok(result.score! >= 0.2, 'floored rather than negative');
});

test('a quarantined-event caveat agrees with itself about number', () => {
  assert.ok(assessCoverageConfidence({ ...CLEAN, quarantinedEvents: 1 }).caveats[0].includes('1 Flow event was'));
  assert.ok(assessCoverageConfidence({ ...CLEAN, quarantinedEvents: 3 }).caveats[0].includes('3 Flow events were'));
});

test('confidence bands break where they claim to', () => {
  assert.equal(confidenceBand(0.9), 'HIGH');
  assert.equal(confidenceBand(0.89), 'MODERATE');
  assert.equal(confidenceBand(0.7), 'MODERATE');
  assert.equal(confidenceBand(0.69), 'LOW');
});

// ── Endpoint baseline ───────────────────────────────────────────────────────

test('a baseline key survives either side spelling the route differently', () => {
  // The run reports a framework template; ClickHouse stores a canonicalised
  // one. If they disagree the join silently finds nothing.
  assert.equal(baselineKey('get', '/orders/:id'), baselineKey('GET', '/orders/{id}'));
  assert.equal(baselineKey('POST', '/checkout/'), 'POST /checkout');
});

test('a route with no history is not reported as unchanged', () => {
  assert.equal(compareToBaseline(2_400, undefined), null);
  assert.equal(compareToBaseline(2_400, {
    route: '/a', method: 'GET', requestCount: 10, p50Ms: 10, p95Ms: null, errorRate: 0,
  }), null);
  assert.equal(compareToBaseline(null, {
    route: '/a', method: 'GET', requestCount: 10, p50Ms: 10, p95Ms: 180, errorRate: 0,
  }), null);
});

test('a comparison carries how much history stands behind it', () => {
  // "3x slower than usual" over four prior requests is not the same claim as
  // the same ratio over four thousand, and the ratio alone cannot say which.
  const verdict = compareToBaseline(2_400, {
    route: '/checkout', method: 'POST', requestCount: 4_120, p50Ms: 120, p95Ms: 180, errorRate: 0.01,
  });
  assert.equal(verdict?.verdict, 'SLOWER');
  assert.equal(verdict?.ratio, 13.33);
  assert.equal(verdict?.samples, 4_120);
  assert.equal(verdict?.p95Ms, 180);
});

test('ordinary variation is not reported as a regression', () => {
  const baseline = { route: '/a', method: 'GET', requestCount: 100, p50Ms: 90, p95Ms: 200, errorRate: 0 };
  assert.equal(compareToBaseline(210, baseline)?.verdict, 'TYPICAL');
  assert.equal(compareToBaseline(170, baseline)?.verdict, 'TYPICAL');
  assert.equal(compareToBaseline(320, baseline)?.verdict, 'SLOWER');
  assert.equal(compareToBaseline(100, baseline)?.verdict, 'FASTER');
});

test('a baseline lookup with no routes to ask about does not call out at all', async () => {
  const outcome = await fetchEndpointBaselines({
    applicationId: 'app', environmentId: null, runId: 'run', routes: [],
  });
  assert.equal(outcome.status, 'NO_ROUTES');
  assert.equal(outcome.byRoute.size, 0);
});

test('an unreachable endpoint engine degrades rather than failing the report', async () => {
  const outcome = await fetchEndpointBaselines({
    applicationId: 'app',
    environmentId: null,
    runId: 'run',
    routes: [{ method: 'GET', route: '/orders' }],
    timeoutMs: 1,
  });
  assert.ok(outcome.status.startsWith('UNAVAILABLE:'), outcome.status);
  assert.equal(outcome.byRoute.size, 0);
});
