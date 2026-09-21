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
