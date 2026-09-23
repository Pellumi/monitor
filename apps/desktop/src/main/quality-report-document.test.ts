import test from 'node:test';
import assert from 'node:assert/strict';
import {
  qualityReportCsv,
  qualityReportFileBase,
  qualityReportHtml,
  type QualityReportDocumentInput,
} from './quality-report-document';

function input(overrides: Record<string, unknown> = {}): QualityReportDocumentInput {
  return {
    generatedAt: '2026-01-05T10:00:00.000Z',
    report: {
      id: 'qa-report:1',
      runId: '11111111-2222-3333-4444-555555555555',
      status: 'COMPLETED_INCOMPLETE',
      generatedAt: '2026-01-05T09:00:00.000Z',
      application: { id: 'app', name: 'Acad AI' },
      environment: { id: 'env', name: 'Development', type: 'DEVELOPMENT' },
      coverage: { expected: 40, reconciledFlows: 1 },
      summary: {
        sessionCount: 1,
        observedStateCount: 8,
        observedTransitionCount: 12,
        artifactCount: 3,
        findingCount: 2,
        criticalOrHighFindings: 1,
      },
      correlation: { runId: 'r', sessions: [{ sessionId: 's' }] },
      sections: {
        flowSummary: { name: 'Onboarding Flow', version: 61, declaredStateCount: 22, declaredTransitionCount: 34 },
        runSummary: { url: 'http://localhost:5173', durationMs: 5000, eventCounts: { QA_REQUEST: 7 } },
        inFlowFindings: {
          recommendedNextActions: [{ id: 'f1', priority: 'HIGH', title: 'Exercise the missing DASHBOARD state' }],
          findings: [
            {
              id: 'f1',
              priority: 'HIGH',
              title: 'Exercise the missing DASHBOARD state',
              impact: 'The declared Flow was not fully verified.',
              suggestedAction: 'Repeat the Flow.',
              confidence: 1,
            },
          ],
          missingStates: [{ key: 'DASHBOARD', name: 'Dashboard', role: 'TERMINAL' }],
          missingTransitions: [{ from: 'GUEST', to: 'LOGIN', action: 'sign in' }],
          unexpectedStates: ['MARKETING_HOME'],
        },
        criticalSystemWideFindings: [{ id: 'c1', priority: 'HIGH', title: 'Request returned 500' }],
        userAnnotations: [{ id: 'a1', pin: 1, comment: 'Button does nothing', author: { displayName: 'QA' } }],
        evidenceAppendix: {
          events: [{ id: 'e1', type: 'QA_REQUEST', route: '/login', scope: 'IN_FLOW' }],
          eventTotal: 900,
          eventsTruncated: 899,
          limitations: ['Framework-state evidence was unavailable.'],
        },
      },
      ...overrides,
    },
  };
}

test('the document carries every section the report page no longer shows', () => {
  const html = qualityReportHtml(input());
  for (const heading of [
    'What the Flow declared',
    'How the run was captured',
    'Every finding in this Flow',
    'Declared coverage gaps',
    'Risks outside the selected Flow',
    'Inspect-mode feedback',
    'Auditable capture record',
  ]) {
    assert.ok(html.includes(heading), `missing section: ${heading}`);
  }
  assert.ok(html.includes('Exercise the missing DASHBOARD state'));
  assert.ok(html.includes('Repeat the Flow.'));
  assert.ok(html.includes('MARKETING_HOME'));
  assert.ok(html.includes('Request returned 500'));
  assert.ok(html.includes('Button does nothing'));
});

test('the document is the Tellann watermarked page', () => {
  const html = qualityReportHtml(input());
  assert.ok(html.includes('class="watermark"'));
  assert.ok(html.includes('<svg'));
  assert.ok(html.includes('size:A4'));
  assert.ok(html.includes('TELLANN'));
});

test('a payload with no sections still renders rather than throwing', () => {
  const bare: QualityReportDocumentInput = {
    generatedAt: '2026-01-05T10:00:00.000Z',
    report: { runId: 'r1', application: {}, environment: {}, summary: {}, coverage: {} },
  };
  const html = qualityReportHtml(bare);
  assert.ok(html.includes('Selected Flow quality report'));
  assert.ok(html.includes('The deterministic analysis found no in-Flow finding for this run.'));
});

test('report values that could break the page are escaped, not rendered', () => {
  const hostile = input();
  (hostile.report as any).application = { id: 'app', name: '<script>alert(1)</script>' };
  const html = qualityReportHtml(hostile);
  assert.ok(!html.includes('<script>alert(1)</script>'));
  assert.ok(html.includes('&lt;script&gt;'));
});

test('the CSV covers findings, gaps, out-of-Flow risks, annotations and limits', () => {
  const rows = qualityReportCsv(input()).trim().split('\n');
  assert.equal(rows[0], '"Section","Item","Priority/Value","Detail"');
  const sections = new Set(rows.slice(1).map((row) => row.split(',')[0]));
  for (const section of ['"Finding"', '"Coverage gap"', '"Outside Flow"', '"Annotation"', '"Limitation"']) {
    assert.ok(sections.has(section), `missing CSV section: ${section}`);
  }
  // A comment containing a quote or a newline must not split the row.
  const quoted = input();
  (quoted.report as any).sections.userAnnotations = [{ pin: 1, comment: 'He said "no"\nthen left' }];
  const csv = qualityReportCsv(quoted);
  assert.ok(csv.includes('"He said ""no"" then left"'));
});

test('the file name identifies the application, Flow and run without a path', () => {
  const base = qualityReportFileBase(input());
  assert.equal(base, 'Tellann-Acad-AI-Onboarding-Flow-quality-report-11111111-2026-01-05');
  assert.ok(!/[\\/:*?"<>|]/.test(base));
});

test('a session-scoped report makes no Flow reconciliation or expected coverage claims', () => {
  const session = input({
    scopeKind: 'SESSION',
    flow: null,
    coverage: { expected: null, reconciledFlows: 0 },
    sections: {
      ...(input().report as any).sections,
      flowSummary: null,
      inFlowFindings: {
        recommendedNextActions: [],
        findings: [{ id: 'runtime', priority: 'HIGH', title: 'Request returned 500' }],
        missingStates: [],
        missingTransitions: [],
        unexpectedStates: [],
      },
      criticalSystemWideFindings: [],
    },
  });
  const html = qualityReportHtml(session);
  assert.ok(html.includes('Observational QA report'));
  assert.ok(html.includes('Session findings'));
  assert.ok(!html.includes('What the Flow declared'));
  assert.ok(!html.includes('Declared coverage gaps'));
  assert.ok(!html.includes('Expected coverage'));
  assert.ok(!html.includes('Risks outside the selected Flow'));

  const csv = qualityReportCsv(session);
  assert.ok(!csv.includes('"Coverage","Expected coverage"'));
  assert.ok(!csv.includes('"Coverage gap"'));
  assert.ok(!csv.includes('"Report","Flow"'));
});


/** A report from a backend run, as the worker writes it. */
function backendInput(): QualityReportDocumentInput {
  const base = input();
  (base.report as any).scopeKind = 'SESSION';
  (base.report as any).sections.backendSummary = {
    requests: 4,
    errors: 2,
    clientErrors: 1,
    serverErrors: 1,
    unhandledErrors: 1,
    dataOperations: 3,
    errorRate: 50,
    averageMs: 36.25,
    p50Ms: 15,
    p95Ms: 90,
    p99Ms: 90,
    slowestMs: 90,
    requestBytes: 400,
    responseBytes: 800,
    requestsPerMinute: 1.3,
    payloadsCaptured: 1,
    endpoints: [
      {
        key: 'GET /orders', method: 'GET', route: '/orders', requests: 3, errors: 1,
        clientErrors: 0, serverErrors: 1, averageMs: 43.33, p95Ms: 90, slowestMs: 90,
        statusClasses: { '2xx': 2, '5xx': 1 }, lastStatus: 500,
        models: ['Order'], handlers: ['orders.index'], requestBytes: 300, responseBytes: 600,
      },
      {
        key: 'POST /orders/:id', method: 'POST', route: '/orders/:id', requests: 1, errors: 1,
        clientErrors: 1, serverErrors: 0, averageMs: 15, p95Ms: 15, slowestMs: 15,
        statusClasses: { '4xx': 1 }, lastStatus: 422,
        models: [], handlers: [], requestBytes: 100, responseBytes: 200,
      },
    ],
    models: [
      { model: 'Order', reads: 1, writes: 2, records: 7, operations: ['update', 'findMany'], endpoints: ['POST /orders/:id'] },
    ],
    serverErrorGroups: [
      { route: '/orders/:id', method: 'POST', name: 'TypeError', message: 'cannot read id', occurrences: 2 },
    ],
    slowestRequests: [
      { method: 'GET', route: '/orders', durationMs: 90, statusCode: 500, occurredAt: '2026-01-05T10:02:00.000Z', eventId: 'e9' },
    ],
    limitations: ['No request or response payloads were retained for this run.'],
  };
  return base;
}

test('a backend run gets its own chapter, with endpoints, models and server errors', () => {
  const html = qualityReportHtml(backendInput());
  assert.ok(html.includes('What the server handled'));
  assert.ok(html.includes('/orders/:id'), 'the route template, not a concrete path');
  assert.ok(html.includes('orders.index'), 'the handler that served the route');
  assert.ok(html.includes('Models affected'));
  assert.ok(html.includes('Unhandled server errors'));
  assert.ok(html.includes('cannot read id'));
  assert.ok(html.includes('Slowest requests'));
  assert.ok(html.includes('2xx 2 · 5xx 1'), 'status classes read as a breakdown');
  assert.ok(html.includes('90 ms'), 'durations are formatted at their magnitude');
  assert.ok(html.includes('No request or response payloads were retained for this run.'));
});

test('a frontend-only report has no backend chapter at all', () => {
  const html = qualityReportHtml(input());
  assert.ok(!html.includes('What the server handled'));
  assert.ok(!html.includes('Section // Backend'));
});

test('a backend-only run carries no window resolution, instrumentation or framework-state rows', () => {
  const backendOnly = backendInput();
  (backendOnly.report as any).sections.runSummary.captureTracks = ['BACKEND'];
  const html = qualityReportHtml(backendOnly);
  assert.ok(!html.includes('WINDOW RESOLUTION'));
  assert.ok(!html.includes('FRAMEWORK STATE EVIDENCE'));
  assert.ok(!html.includes('Browser-level evidence only'));
  const csv = qualityReportCsv(backendOnly);
  assert.ok(!csv.includes('Window resolution'));
  // A run that captured both tracks still gets the browser-shaped rows.
  const mixed = backendInput();
  (mixed.report as any).sections.runSummary.captureTracks = ['FRONTEND', 'BACKEND'];
  assert.ok(qualityReportHtml(mixed).includes('WINDOW RESOLUTION'));
});

test('the CSV carries the backend rollup, one row per endpoint and model', () => {
  const rows = qualityReportCsv(backendInput()).trim().split('\n');
  const sections = new Set(rows.map((row) => row.split(',')[0]));
  for (const section of ['"Backend"', '"Endpoint"', '"Model"', '"Server error"', '"Slowest request"']) {
    assert.ok(sections.has(section), `missing CSV section: ${section}`);
  }
  assert.ok(rows.some((row) => row.includes('POST /orders/:id')));
  assert.ok(rows.some((row) => row.includes('2xx 2 · 5xx 1')));
});
