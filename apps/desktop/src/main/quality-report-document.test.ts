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

test('a report is filed under its run\'s name, in the document and in the file name', () => {
  const named = input({ title: 'Checkout smoke test' });
  const html = qualityReportHtml(named);
  assert.ok(html.includes('<title>Checkout smoke test</title>'));
  assert.ok(html.includes('<h1>Checkout smoke test</h1>'));
  assert.ok(qualityReportFileBase(named).includes('Checkout-smoke-test'));
  // A report from before runs were named keeps its Flow-based title.
  assert.ok(qualityReportHtml(input()).includes('Onboarding Flow quality report'));
});

test('a finding\'s AI-drafted resolution is carried into the document, with what it rests on', () => {
  const base = input();
  (base.report as any).sections.inFlowFindings.findings[0].resolution = {
    summary: 'The view rejected the caller before it read any data.',
    likelyCause: 'The permission refused this user.',
    steps: ['Confirm the caller\'s role.'],
    codeRefs: [{ id: 'ref1', role: 'handler', name: 'SchoolAnalyticsView', path: 'schools/views.py', startLine: 120, endLine: 168 }],
    confidence: 0.85,
    basis: { requests: 1, dataOperations: 1, code: true },
  };
  const html = qualityReportHtml(base);
  assert.ok(html.includes('Suggested resolution'));
  assert.ok(html.includes('schools/views.py:120–168'));
  assert.ok(html.includes('the code that handles the endpoint'));
  assert.ok(qualityReportCsv(base).includes('"Suggested resolution"'));
  // Findings without one add nothing.
  assert.ok(!qualityReportHtml(input()).includes('Suggested resolution'));
});

// ── Browser section ─────────────────────────────────────────────────────────

const FRONTEND_SECTION = {
  routes: [
    {
      route: '/checkout',
      samples: 3,
      hiddenSamplesDropped: 1,
      settleTimeouts: 1,
      failedResources: 4,
      lcpMs: { p50: 4_800, p75: 6_200, p95: 7_000, samples: 3 },
      cls: { p50: 0.3, p75: 0.41, p95: 0.5, samples: 3 },
      inpMs: { p50: null, p75: null, p95: null, samples: 0 },
      dataReadyMs: { p50: 400, p75: 500, p95: 900, samples: 2 },
      worstVital: { metric: 'CLS', value: 0.41, rating: 'poor' },
    },
  ],
  routesObserved: 1,
  worstVital: { route: '/checkout', metric: 'CLS', value: 0.41 },
  network: [
    {
      route: '/api/orders', resourceType: 'xhr', requests: 12, failed: 2, blocked: 0,
      statusClasses: { '2xx': 10, '5xx': 2 }, p95Ms: 900, transferredBytes: 4_096,
    },
  ],
  networkGroupsSeen: 1,
  networkTotals: { requests: 12, failed: 2, blocked: 0, errors: 2, transferredBytes: 4_096, p95Ms: 900 },
  console: {
    errors: 3, warnings: 1,
    groups: [{ level: 'error', message: 'Cannot read properties of undefined', occurrences: 3, routes: ['/checkout'] }],
  },
  runtimeErrors: 1,
  crashes: 0,
  accessibility: {
    scans: 2, routesScanned: 2, violations: 5,
    byImpact: { critical: 1, serious: 4 },
    rules: [{ ruleId: 'color-contrast', help: 'Elements must have sufficient contrast', impact: 'critical', occurrences: 1, nodes: 400, routes: ['/checkout'], targets: ['.btn'] }],
    cleanRoutes: ['/cart'],
  },
  interactions: {
    clicks: 20, clicksPreBoundary: 4, submitIntents: 3, submitIntentsPreBoundary: 1,
    submitted: 2, invalidSubmits: 1, invalidRate: 50, fieldChanges: 9,
    forms: [{ form: 'checkout', submits: 2, invalidSubmits: 1, invalidRate: 50, routes: ['/checkout'] }],
  },
  storageMutations: 6,
  clientStateMutations: 0,
  limitations: ['The browser did not support event, so INP was not measured for this run.'],
};

function frontendInput() {
  const base = input();
  (base.report as any).sections.frontendSummary = FRONTEND_SECTION;
  return base;
}

test('the browser chapter reports what the page did, not what the server did', () => {
  const html = qualityReportHtml(frontendInput());
  assert.ok(html.includes('What the browser saw'));
  assert.ok(html.includes('/checkout'));
  assert.ok(html.includes('CLS 0.41'), 'a layout-shift score reads as a score, not a duration');
  assert.ok(html.includes('Cannot read properties of undefined'));
  assert.ok(html.includes('color-contrast'));
  assert.ok(html.includes('Routes'));
  assert.ok(html.includes('Network by resource'));
  assert.ok(html.includes('Accessibility rules'));
  assert.ok(html.includes('Forms'));
  assert.ok(html.includes('so INP was not measured'), 'limitations are stated, not implied');
});

test('a report with no browser section leaves the chapter out entirely', () => {
  // The legacy assembler in report-engine serves reports with no `sections`
  // key at all, so every reader has to tolerate the section being absent
  // rather than printing an empty chapter of zeroes.
  const html = qualityReportHtml(input());
  assert.ok(!html.includes('What the browser saw'));
});

test('a report whose sections key is missing altogether still renders', () => {
  const legacy = input();
  delete (legacy.report as any).sections;
  const html = qualityReportHtml(legacy);
  assert.ok(html.includes('Quality // QA run report'));
  assert.ok(!html.includes('What the browser saw'));
  assert.ok(!html.includes('What the server handled'));
});

test('an unmeasured vital says so rather than printing a zero', () => {
  const html = qualityReportHtml(frontendInput());
  assert.ok(html.includes('Not measured'), 'INP had no samples on this route');
});

test('the CSV carries the browser rows a spreadsheet would want', () => {
  const csv = qualityReportCsv(frontendInput());
  const sections = new Set(csv.split('\n').filter(Boolean).map((row) => row.split(',')[0]));
  for (const section of ['"Browser"', '"Route"', '"Resource"', '"Accessibility"', '"Console"', '"Form"']) {
    assert.ok(sections.has(section), `${section} rows present`);
  }
});

test('the CSV has no browser rows when the run captured no browser evidence', () => {
  const csv = qualityReportCsv(input());
  const sections = new Set(csv.split('\n').filter(Boolean).map((row) => row.split(',')[0]));
  assert.ok(!sections.has('"Browser"'));
  assert.ok(!sections.has('"Route"'));
});

// ── Coverage confidence ─────────────────────────────────────────────────────

test('a qualified coverage figure carries its qualifications', () => {
  const qualified = input({
    coverage: {
      expected: 40, reconciledFlows: 1, confidence: 0.45, confidenceBand: 'LOW',
      caveats: ['Capture was degraded during this run.', 'The working tree had uncommitted changes.'],
    },
  });
  const html = qualityReportHtml(qualified);
  assert.ok(html.includes('CONFIDENCE'));
  assert.ok(html.includes('LOW (45%)'));
  assert.ok(html.includes('2 qualifying conditions'));
  assert.ok(html.includes('What qualifies that number'));
  assert.ok(html.includes('The working tree had uncommitted changes.'));

  const csv = qualityReportCsv(qualified);
  assert.ok(csv.includes('"Coverage caveat"'));
});

test('an unqualified coverage figure prints no confidence row', () => {
  const html = qualityReportHtml(input());
  assert.ok(!html.includes('What qualifies that number'));
});

test('readReport tolerates a malformed frontend section without throwing', () => {
  for (const malformed of ['not an object', [], null, 42]) {
    const broken = input();
    (broken.report as any).sections.frontendSummary = malformed;
    assert.doesNotThrow(() => qualityReportHtml(broken));
    assert.doesNotThrow(() => qualityReportCsv(broken));
  }
});

const automatedSection = (overrides: Record<string, unknown> = {}) => ({
  pinned: {
    flowVersionId: 'v7', initialStateKey: 'course_details', targetTerminalStateKey: 'exam_created',
    executionProfileId: 'profile-1', testPersonaId: 'persona-1', runDataSetId: null,
    codeSnapshotId: 'hash-1', instrumentationManifestVersion: 'patch-1',
  },
  outcome: { stopReason: 'EXPECTED_TRANSITION_NOT_FOUND', kind: 'APPLICATION', reachedTarget: false, detail: 'No control for Create Exam is on the page.', steps: 0, replans: 0 },
  states: [
    { sequence: 0, stateKey: 'course_details', scope: 'PRE_BOUNDARY', route: '/courses/7', durationMs: 310, action: { label: 'Create Exam', verified: false, error: null }, errorCount: 0 },
  ],
  unreachedStates: [
    { stateKey: 'exam_form', status: 'BLOCKED_BY_APPLICATION', detail: 'No control for Create Exam is on the page.' },
    { stateKey: 'exam_error', status: 'NOT_ATTEMPTED', detail: null },
  ],
  reconciliation: { AUTHORIZATION_MISMATCH: 1 },
  ...overrides,
});

function withAutomated(section: Record<string, unknown> | null, mode = 'AUTOMATED'): QualityReportDocumentInput {
  const base = input();
  const report = base.report as Record<string, any>;
  return { ...base, report: { ...report, mode, sections: { ...report.sections, ...(section ? { automated: section } : {}) } } };
}

test('every report states the mode its evidence was gathered under', () => {
  for (const [mode, label] of [['GUIDED', 'Guided'], ['ASSISTED', 'Assisted'], ['OBSERVATION_ONLY', 'Observation only'], ['AUTOMATED', 'Automated']]) {
    assert.ok(qualityReportHtml(withAutomated(null, mode)).includes(label), mode);
  }
  // A report generated before modes were recorded says so rather than guessing.
  const legacy = input();
  assert.ok(qualityReportHtml(legacy).includes('Not recorded'));
});

test('an automated run gets its own chapter with what it was pinned to, state by state', () => {
  const html = qualityReportHtml(withAutomated(automatedSection()));
  for (const text of ['What the automated run did', 'What the run was pinned to', 'State by state', 'v7', 'exam_created', 'persona-1', 'hash-1', 'course_details', 'Create Exam']) {
    assert.ok(html.includes(text), `missing: ${text}`);
  }
  assert.ok(html.includes('setup, before the Flow began'), 'setup is kept apart from the Flow itself');
  assert.ok(html.includes('did not advance'));
});

test('a state the application prevented is kept apart from one the run never attempted', () => {
  const html = qualityReportHtml(withAutomated(automatedSection()));
  assert.ok(html.includes('Prevented by the application'));
  assert.ok(html.includes('Not attempted'));
  assert.ok(html.includes('No control for Create Exam is on the page.'));
});

test('an infrastructure failure is never described as a finding about the application', () => {
  const html = qualityReportHtml(withAutomated(automatedSection({
    outcome: { stopReason: 'APPLICATION_START_FAILED', kind: 'INFRASTRUCTURE', reachedTarget: false, detail: null, steps: 0, replans: 0 },
  })));
  assert.ok(html.includes('not a finding about the application'));
  assert.ok(!html.includes('did not behave as the declared Flow describes'));
});

test('reconciliation attributions are listed in words', () => {
  assert.ok(qualityReportHtml(withAutomated(automatedSection())).includes('1 × authorization mismatch'));
});

test('a run that is not automated has no automated chapter', () => {
  assert.ok(!qualityReportHtml(withAutomated(null, 'GUIDED')).includes('What the automated run did'));
  assert.ok(!qualityReportHtml(input()).includes('What the automated run did'));
});

test('report content is escaped, since evidence text comes from the application under test', () => {
  const html = qualityReportHtml(withAutomated(automatedSection({
    outcome: { stopReason: 'EXPECTED_TRANSITION_NOT_FOUND', kind: 'APPLICATION', reachedTarget: false, detail: '<script>alert(1)</script>', steps: 0, replans: 0 },
  })));
  assert.ok(!html.includes('<script>alert(1)</script>'));
  assert.ok(html.includes('&lt;script&gt;'));
});

test('a failed step is explained from the code, by location, and says the source stays local', () => {
  const html = qualityReportHtml(withAutomated(automatedSection({
    codeEvidence: [{
      subject: { kind: 'TRANSITION', id: 't-submit' }, stateKey: 'exam_form', derivation: 'AMBIGUOUS',
      refs: [{ file: 'src/exams/create.tsx', symbol: 'saveExam', startLine: 2, endLine: 4, excerptSha256: 'abc' }],
      summary: 'Save exam is mapped to saveExam. The handler calls POST /api/exams.', at: '2026-01-01T00:00:00.000Z',
    }],
  })));
  for (const text of ['What the code says about the step that failed', 'Transition t-submit', 'saveExam — src/exams/create.tsx:2-4', 'POST /api/exams', 'stays on the machine', 'treat this as a lead']) {
    assert.ok(html.includes(text), `missing: ${text}`);
  }
});

test('retained traces are listed with the reason, and a run without any prints no such heading', () => {
  const withTrace = qualityReportHtml(withAutomated(automatedSection({
    retainedTraces: [{ stateKey: 'exam_form', reasons: ['ACTION_DID_NOT_ADVANCE'], at: '2026-01-01T00:00:00.000Z' }],
  })));
  assert.ok(withTrace.includes('Diagnostic traces kept'));
  assert.ok(withTrace.includes('action did not advance'));
  const without = qualityReportHtml(withAutomated(automatedSection()));
  assert.ok(!without.includes('Diagnostic traces kept'));
  assert.ok(!without.includes('What the code says about the step that failed'));
});

test('code evidence text is escaped too', () => {
  const html = qualityReportHtml(withAutomated(automatedSection({
    codeEvidence: [{ subject: { kind: 'STATE', id: '<b>x</b>' }, derivation: 'RESOLVED', refs: [], summary: '<img src=x onerror=1>', at: '2026-01-01T00:00:00.000Z' }],
  })));
  assert.ok(!html.includes('<img src=x'));
  assert.ok(!html.includes('<b>x</b>'));
});

test('render timing appears only when the run watched components, worst first, and is escaped', () => {
  const html = qualityReportHtml(withAutomated(automatedSection({
    renderTiming: [
      { component: 'Layout', states: [], mounts: 1, updates: 0, totalMs: 1, maxMs: 1 },
      { component: 'ExamForm<script>', states: ['exam_form'], mounts: 1, updates: 3, totalMs: 13.3, maxMs: 5 },
    ],
  })));
  assert.ok(html.includes("Render time of the Flow's components"));
  assert.ok(html.indexOf('ExamForm&lt;script&gt;') < html.indexOf('Layout'), 'the costliest component comes first');
  assert.ok(html.includes('1 mounts, 3 updates') && html.includes('13.3 ms total, 5 ms worst'));
  assert.ok(!html.includes('ExamForm<script>'));
  assert.ok(!qualityReportHtml(withAutomated(automatedSection())).includes("Render time of the Flow's components"));
});
