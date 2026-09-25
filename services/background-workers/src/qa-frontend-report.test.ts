import assert from 'node:assert/strict';
import test from 'node:test';
import {
  summarizeFrontendEvidence,
  worstVitalOf,
  type FrontendEvidenceEvent,
} from './qa-frontend-report';
import { summarizeBackendEvidence } from './qa-backend-report';

const AT = '2026-01-01T10:00:00.000Z';

function event(
  eventType: string,
  metadata: Record<string, unknown> = {},
  overrides: Partial<FrontendEvidenceEvent> = {},
): FrontendEvidenceEvent {
  return { eventType, occurredAt: AT, metadata, ...overrides };
}

/** A vitals-shaped performance event: carries `supported`, never `trigger`. */
function vitals(route: string, metrics: Record<string, unknown> = {}): FrontendEvidenceEvent {
  return event('QA_PAGE_PERFORMANCE', {
    route, reason: 'load', supported: true, unsupportedMetrics: [],
    lcp: 1_000, fcp: 500, cls: 0.01, inpMs: 100, ttfbMs: 80,
    longTaskMs: 0, resourceCount: 10, transferredBytes: 1_000,
    failedResourceCount: 0, interactionCount: 3, hiddenMs: 0,
    ...metrics,
  });
}

/** A settle-shaped performance event: carries `trigger`, never vitals. */
function settle(route: string, metrics: Record<string, unknown> = {}): FrontendEvidenceEvent {
  return event('QA_PAGE_PERFORMANCE', {
    route, trigger: 'route', dataReadyMs: 400, visuallyStableMs: 600,
    dataReadyTimedOut: false, visuallyStableTimedOut: false,
    ...metrics,
  });
}

const FRONTEND_ONLY = { captureTracks: ['FRONTEND'] };

test('a backend-only run carries no frontend section at all', () => {
  const summary = summarizeFrontendEvidence(
    [event('QA_BACKEND_REQUEST', { route: '/orders' })],
    { captureTracks: ['BACKEND'] },
  );
  assert.equal(summary, null);
});

test('a run that selected the frontend track says so even when nothing arrived', () => {
  const summary = summarizeFrontendEvidence([], FRONTEND_ONLY);
  assert.ok(summary);
  assert.equal(summary.routesObserved, 0);
  assert.ok(summary.limitations.some((line) => line.includes('no browser evidence reached it')));
});

test('vitals and settle timings are different events and neither zeroes the other', () => {
  // The recorder emits four disjoint shapes under QA_PAGE_PERFORMANCE. Reading
  // lcp and dataReadyMs off one row always leaves one of them null.
  const summary = summarizeFrontendEvidence(
    [vitals('/checkout'), settle('/checkout')],
    FRONTEND_ONLY,
  );
  const route = summary!.routes[0];
  assert.equal(route.route, '/checkout');
  assert.equal(route.lcpMs.p50, 1_000);
  assert.equal(route.dataReadyMs.p50, 400);
  assert.equal(route.samples, 1, 'one vitals sample');
  assert.equal(route.settleSamples, 1, 'one route settle');
});

test('an interaction settle never enters the page-load percentiles', () => {
  // scheduleSettled('interaction') fires on every click, so pooling them would
  // make a page-load p95 a statement about click responsiveness.
  const summary = summarizeFrontendEvidence(
    [
      settle('/cart', { dataReadyMs: 100 }),
      settle('/cart', { trigger: 'interaction', dataReadyMs: 9_000 }),
      settle('/cart', { trigger: 'interaction', dataReadyMs: 9_500 }),
    ],
    FRONTEND_ONLY,
  );
  const route = summary!.routes[0];
  assert.equal(route.settleSamples, 1);
  assert.equal(route.dataReadyMs.p95, 100, 'the click settles stayed out');
  assert.equal(route.interactionSettleSamples, 2);
  assert.equal(route.interactionDataReadyP95, 9_500);
});

test('a settle timeout counts whichever trigger produced it', () => {
  const summary = summarizeFrontendEvidence(
    [
      settle('/slow', { dataReadyTimedOut: true }),
      settle('/slow', { trigger: 'interaction', visuallyStableTimedOut: true }),
    ],
    FRONTEND_ONLY,
  );
  assert.equal(summary!.routes[0].settleTimeouts, 2);
});

test('paint timings measured while the tab was hidden are discarded, not averaged in', () => {
  const summary = summarizeFrontendEvidence(
    [
      vitals('/a', { lcp: 900 }),
      vitals('/a', { lcp: 40_000, hiddenMs: 30_000, failedResourceCount: 2 }),
    ],
    FRONTEND_ONLY,
  );
  const route = summary!.routes[0];
  assert.equal(route.samples, 1);
  assert.equal(route.hiddenSamplesDropped, 1);
  assert.equal(route.lcpMs.p95, 900, 'the backgrounded sample never reached the percentile');
  // Counts stay valid while hidden: a broken image is broken either way.
  assert.equal(route.failedResources, 2);
});

test('an unmeasurable metric reads as absent, never as zero', () => {
  const summary = summarizeFrontendEvidence(
    [vitals('/a', { inpMs: null, cls: null, unsupportedMetrics: ['event', 'layout-shift'] })],
    FRONTEND_ONLY,
  );
  const route = summary!.routes[0];
  assert.equal(route.inpMs.p50, null);
  assert.equal(route.cls.p50, null);
  assert.equal(route.lcpMs.p50, 1_000, 'the metrics it could measure are unaffected');
  assert.ok(summary!.limitations.some((line) => line.includes('INP') && line.includes('CLS')));
});

test('a browser with no PerformanceObserver says so and creates no route', () => {
  const summary = summarizeFrontendEvidence(
    [event('QA_PAGE_PERFORMANCE', {
      supported: false, reason: 'PerformanceObserver unavailable',
      unsupportedMetrics: ['paint', 'largest-contentful-paint'],
    })],
    FRONTEND_ONLY,
  );
  assert.equal(summary!.routes.length, 0, 'the fallback carries no route to attribute');
  assert.ok(summary!.limitations.some((line) => line.includes('no usable PerformanceObserver')));
});

test("a performance event is attributed to the route it measured, not the one being entered", () => {
  // flushRouteMetrics fires after pushState already moved the URL, so the
  // event's normalizedRoute names the successor.
  const summary = summarizeFrontendEvidence(
    [event('QA_PAGE_PERFORMANCE',
      { route: '/checkout', supported: true, lcp: 5_000, hiddenMs: 0, unsupportedMetrics: [] },
      { normalizedRoute: '/confirmation' })],
    FRONTEND_ONLY,
  );
  assert.equal(summary!.routes[0].route, '/checkout');
});

test('network rows group by resource path and type, and a policy block is not a failure', () => {
  const summary = summarizeFrontendEvidence(
    [
      event('QA_REQUEST', { resourceType: 'xhr', statusCode: 200, durationMs: 50, method: 'GET', transferredBytes: 10 }, { normalizedRoute: '/api/orders' }),
      event('QA_REQUEST', { resourceType: 'xhr', statusCode: 500, durationMs: 90, method: 'GET' }, { normalizedRoute: '/api/orders' }),
      event('QA_REQUEST', { resourceType: 'image', failed: true }, { normalizedRoute: '/logo.png' }),
      event('QA_REQUEST', { resourceType: 'xhr', blockedByPolicy: true }, { normalizedRoute: '/api/orders' }),
    ],
    FRONTEND_ONLY,
  );
  assert.equal(summary!.networkTotals.requests, 4);
  assert.equal(summary!.networkTotals.failed, 1, 'only the genuinely failed image');
  assert.equal(summary!.networkTotals.blocked, 1);
  assert.equal(summary!.networkTotals.errors, 1);
  const api = summary!.network.find((row) => row.route === '/api/orders')!;
  assert.equal(api.requests, 3);
  assert.equal(api.serverErrors, 1);
  assert.equal(api.blocked, 1);
  assert.equal(api.failed, 0);
});

test('the interaction funnel says why pre-boundary submits have no outcome', () => {
  const summary = summarizeFrontendEvidence(
    [
      event('QA_CONTROL_CLICKED', {}, { scope: 'PRE_BOUNDARY' }),
      event('QA_FORM_SUBMIT_INTENT', {}, { scope: 'PRE_BOUNDARY' }),
      event('QA_CONTROL_CLICKED', {}, { scope: 'IN_FLOW' }),
      event('QA_FORM_SUBMIT_INTENT', {}, { scope: 'IN_FLOW' }),
      event('QA_FORM_SUBMITTED', { formName: 'checkout', valid: false }, { scope: 'IN_FLOW' }),
    ],
    FRONTEND_ONLY,
  );
  const funnel = summary!.interactions;
  assert.equal(funnel.clicks, 2);
  assert.equal(funnel.clicksPreBoundary, 1);
  assert.equal(funnel.submitIntents, 2);
  assert.equal(funnel.submitted, 1);
  assert.equal(funnel.invalidSubmits, 1);
  assert.equal(funnel.invalidRate, 100);
  assert.equal(funnel.forms[0].form, 'checkout');
  // Without this the report shows a fake 100% drop-off at every login screen.
  assert.ok(summary!.limitations.some((line) => line.includes('It is not a drop-off')));
});

test('a form whose validity was never reported is not counted as rejected', () => {
  const summary = summarizeFrontendEvidence(
    [event('QA_FORM_SUBMITTED', { formName: 'legacy' })],
    FRONTEND_ONLY,
  );
  assert.equal(summary!.interactions.invalidSubmits, 0);
});

test('accessibility impact counts rules, not the elements each one failed on', () => {
  const summary = summarizeFrontendEvidence(
    [
      event('QA_ACCESSIBILITY_SCAN', {
        route: '/a', violationCount: 1,
        violations: [{ id: 'color-contrast', impact: 'critical', help: 'Contrast', nodes: 400, targets: ['.btn'] }],
      }),
      event('QA_ACCESSIBILITY_SCAN', { route: '/b', violationCount: 0, violations: [] }),
    ],
    FRONTEND_ONLY,
  );
  const a11y = summary!.accessibility;
  assert.equal(a11y.byImpact.critical, 1, '400 failing nodes is one problem to fix');
  assert.equal(a11y.rules[0].nodes, 400);
  assert.equal(a11y.routesScanned, 2);
  assert.deepEqual(a11y.cleanRoutes, ['/b']);
});

test('a scan at the per-scan cap admits it may have missed some', () => {
  const violations = Array.from({ length: 20 }, (_, index) => ({
    id: `rule-${index}`, impact: 'minor', help: 'h', nodes: 1, targets: [],
  }));
  const summary = summarizeFrontendEvidence(
    [event('QA_ACCESSIBILITY_SCAN', { route: '/a', violations })],
    FRONTEND_ONLY,
  );
  assert.ok(summary!.limitations.some((line) => line.includes('per-scan cap')));
});

test('the route table is capped but the route count is not', () => {
  const events = Array.from({ length: 80 }, (_, index) => vitals(`/route-${index}`));
  const summary = summarizeFrontendEvidence(events, FRONTEND_ONLY);
  assert.equal(summary!.routes.length, 50);
  assert.equal(summary!.routesObserved, 80);
  assert.ok(summary!.limitations.some((line) => line.includes('50 of 80 routes')));
});

test('the worst vital across routes is the one furthest past good', () => {
  const summary = summarizeFrontendEvidence(
    [vitals('/fast', { lcp: 2_600 }), vitals('/slow', { lcp: 9_000 })],
    FRONTEND_ONLY,
  );
  assert.equal(summary!.worstVital?.route, '/slow');
  assert.equal(summary!.worstVital?.metric, 'LCP');
});

test('worstVitalOf ranks by distance past good and reports the rating', () => {
  assert.equal(worstVitalOf({ lcp: 1_000, cls: 0.01, inp: 50 }), null, 'nothing is bad');
  assert.deepEqual(worstVitalOf({ lcp: 5_000, cls: null, inp: null }), {
    metric: 'LCP', value: 5_000, rating: 'poor',
  });
  assert.equal(worstVitalOf({ lcp: 3_000, cls: null, inp: null })?.rating, 'needs-improvement');
  // CLS 0.5 is 5x good; LCP 3000 is 1.2x good.
  assert.equal(worstVitalOf({ lcp: 3_000, cls: 0.5, inp: null })?.metric, 'CLS');
});

test('console errors group by message and keep the routes they fired on', () => {
  const summary = summarizeFrontendEvidence(
    [
      event('QA_CONSOLE', { level: 'error', message: 'boom' }, { normalizedRoute: '/a' }),
      event('QA_CONSOLE', { level: 'error', message: 'boom' }, { normalizedRoute: '/b' }),
      event('QA_CONSOLE', { level: 'warning', message: 'careful' }, { normalizedRoute: '/a' }),
      event('QA_CONSOLE', { level: 'log', message: 'noise' }, { normalizedRoute: '/a' }),
    ],
    FRONTEND_ONLY,
  );
  assert.equal(summary!.console.errors, 2);
  assert.equal(summary!.console.warnings, 1);
  assert.equal(summary!.console.groups.length, 2, 'log level is not grouped');
  assert.equal(summary!.console.groups[0].occurrences, 2);
  assert.deepEqual(summary!.console.groups[0].routes, ['/a', '/b']);
});

// ── Backend regression: the capped table must not corrupt the totals ────────

test('a run past the endpoint cap still counts every request in its totals', () => {
  // The cap used to `continue` above the duration accumulation, so the run's
  // average, percentiles and slowest-request list silently excluded every
  // request past the 100th distinct route.
  const events = Array.from({ length: 101 }, (_, index) => ({
    eventType: 'QA_BACKEND_REQUEST',
    occurredAt: AT,
    metadata: {
      method: 'GET', route: `/route-${index}`, statusCode: 200,
      durationMs: index === 100 ? 9_000 : 10,
    },
  }));
  const summary = summarizeBackendEvidence(events, { captureTracks: ['BACKEND'] })!;
  assert.equal(summary.requests, 101);
  assert.equal(summary.endpoints.length, 100, 'the table is still capped');
  assert.equal(summary.endpointsSeen, 101);
  assert.equal(summary.slowestMs, 9_000, 'the 101st route reached the run-wide maximum');
  assert.ok(
    summary.slowestRequests.some((row) => row.route === '/route-100'),
    'and the slowest-requests table',
  );
  assert.ok(summary.limitations.some((line) => line.includes('100 of 101 routes')));
});
