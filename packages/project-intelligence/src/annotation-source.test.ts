import assert from 'node:assert/strict';
import test from 'node:test';
import type { CodebaseAnalysis, CreateQARunAnnotation } from '@tellann/desktop-contracts';
import { resolveAnnotationSource } from './annotation-source';

function analysis(entities: CodebaseAnalysis['entities']): CodebaseAnalysis {
  return {
    id: 'analysis-1', workspaceId: 'workspace-1', repositoryFingerprint: 'repo', graphVersion: 'graph-1',
    analyzerVersions: {}, status: 'COMPLETED', progress: 100, stageMessage: 'Done', startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(), revision: null, branch: null, dirty: false, contentHash: 'hash',
    summary: {
      files: 1, symbols: entities.length, relationships: 0, applications: 1, services: 0,
      domains: 0, features: 0, endpoints: 0, dataModels: 0, events: 0,
      externalServices: 0, tests: 0, coveragePercent: 100, confidence: 0.95,
    },
    entities, relationships: [], features: [], findings: [], warnings: [], notices: [],
    architecture: null, coverage: null, incremental: null, explanations: [],
  };
}

/**
 * The CSS path here is the shape the injected recorder actually produces for an
 * element with no id or test id: a full ancestor chain. Fixtures that used a
 * short, tidy selector hid the fact that the chain's own tag names were being
 * scored as part of the element's identity.
 */
const annotation = (overrides: Partial<CreateQARunAnnotation['elementFingerprint']> = {}) => ({
  normalizedRoute: '/dashboard',
  elementFingerprint: {
    tag: 'button', role: null, accessibleName: 'Continue', id: null, testId: null,
    cssPath: 'html > body > div:nth-of-type(2) > main > section > form > button',
    frameUrl: 'http://localhost/dashboard', domFingerprint: 'button:Continue',
    sourceMapping: null, ...overrides,
  },
});

const uiAction = (overrides: Partial<CodebaseAnalysis['entities'][number]> = {}) => ({
  id: 'action', type: 'ui_action' as const, name: 'Continue (onClick)', path: 'src/Dashboard.tsx',
  startLine: 42, endLine: 42, language: null, confidence: 0.95,
  metadata: { element: 'button', labels: ['Continue'] }, evidence: [], ...overrides,
});

const component = (overrides: Partial<CodebaseAnalysis['entities'][number]> = {}) => ({
  id: 'component', type: 'function' as const, name: 'Dashboard', path: 'src/Dashboard.tsx',
  startLine: 12, endLine: 58, language: 'TypeScript', confidence: 1,
  metadata: {}, evidence: [], ...overrides,
});

const owning = (source: string) => ({
  id: `owns-${source}`, source, target: 'component', type: 'ROUTES_TO' as const,
  confidence: 0.95, evidence: [],
});

test('maps a rendered control to matching UI-action source lines', () => {
  const fixture = analysis([{
    id: 'action', type: 'ui_action', name: 'Continue (onClick)', path: 'src/Dashboard.tsx',
    startLine: 42, endLine: 42, language: null, confidence: 0.95,
    metadata: { element: 'button' }, evidence: [],
  }, {
    id: 'component', type: 'function', name: 'Dashboard', path: 'src/Dashboard.tsx',
    startLine: 12, endLine: 58, language: 'TypeScript', confidence: 1,
    metadata: {}, evidence: [],
  }]);
  fixture.relationships.push({
    id: 'owns-action', source: 'action', target: 'component', type: 'ROUTES_TO', confidence: 0.95, evidence: [],
  });
  const result = resolveAnnotationSource(fixture, annotation());
  assert.equal(result?.path, 'src/Dashboard.tsx');
  assert.equal(result?.startLine, 12);
  assert.equal(result?.endLine, 58);
  assert.equal(result?.symbol, 'Dashboard');
  assert.equal(result?.strategy, 'ELEMENT');
});

test('falls back from an exact route to the component declaration in its file', () => {
  const result = resolveAnnotationSource(analysis([{
    id: 'route', type: 'ui_route', name: '/dashboard', path: 'app/dashboard/page.tsx', startLine: 1, endLine: null,
    language: null, confidence: 0.98, metadata: { route: '/dashboard' }, evidence: [],
  }, {
    id: 'component', type: 'function', name: 'DashboardPage', path: 'app/dashboard/page.tsx', startLine: 8, endLine: 64,
    language: 'TypeScript', confidence: 0.95, metadata: {}, evidence: [],
  }]), annotation({ accessibleName: 'Unknown control' }));
  assert.deepEqual(result && { path: result.path, start: result.startLine, end: result.endLine, symbol: result.symbol, strategy: result.strategy }, {
    path: 'app/dashboard/page.tsx', start: 8, end: 64, symbol: 'DashboardPage', strategy: 'ROUTE',
  });
});

test('does not invent a source location without a confident element or route match', () => {
  assert.equal(resolveAnnotationSource(analysis([]), annotation()), null);
});

test('a literal test id in the source is matched outright rather than scored', () => {
  const fixture = analysis([
    uiAction({ metadata: { element: 'Button', labels: ['Export'], testId: 'export-report' } }),
    component(),
  ]);
  fixture.relationships.push(owning('action'));
  const result = resolveAnnotationSource(fixture, annotation({
    accessibleName: 'Export', testId: 'export-report', cssPath: '[data-testid="export-report"]',
  }));
  assert.equal(result?.strategy, 'ELEMENT');
  assert.equal(result?.path, 'src/Dashboard.tsx');
  // A component element renders a different tag than it is written as, so this
  // must not have depended on the tag agreeing.
  assert.ok((result?.confidence ?? 0) > 0.95, 'an exact identifier is near-certain');
});

test('an identifier shared by two elements identifies neither', () => {
  const fixture = analysis([
    uiAction({ id: 'first', metadata: { element: 'button', labels: ['Row'], testId: 'row-action' } }),
    uiAction({ id: 'second', path: 'src/Other.tsx', metadata: { element: 'button', labels: ['Row'], testId: 'row-action' } }),
    component(),
  ]);
  fixture.relationships.push(owning('first'), owning('second'));
  // A duplicated test id would otherwise hand whichever element happened to be
  // analysed first a near-certain score it has not earned.
  const result = resolveAnnotationSource(fixture, annotation({
    accessibleName: 'Quarterly revenue chart', testId: 'row-action',
    cssPath: '[data-testid="row-action"]',
  }));
  assert.equal(result, null, 'an ambiguous test id must not be treated as exact');
});

test('the CSS path ancestor chain does not dilute a real element match', () => {
  const fixture = analysis([uiAction(), component()]);
  fixture.relationships.push(owning('action'));
  // The same annotation with a seven-segment selector: every extra ancestor
  // used to drag the score further below the threshold.
  const result = resolveAnnotationSource(fixture, annotation());
  assert.equal(result?.strategy, 'ELEMENT');
  assert.equal(result?.symbol, 'Dashboard');
});

test('matches a rendered label against the handler identifier that serves it', () => {
  const fixture = analysis([
    uiAction({
      name: 'button (onClick)',
      metadata: { element: 'button' },
      evidence: [{
        kind: 'ui-event-handler', path: 'src/Dashboard.tsx', startLine: 42, endLine: 42,
        symbol: null, excerpt: 'onClick={handleExportReport}', analyzer: 'framework', confidence: 0.95,
      }],
    }),
    component(),
  ]);
  fixture.relationships.push(owning('action'));
  const result = resolveAnnotationSource(fixture, annotation({ accessibleName: 'Export report' }));
  assert.equal(result?.strategy, 'ELEMENT', 'handleExportReport should reach "Export report"');
});

test('rejects an element whose words the code does not account for', () => {
  const fixture = analysis([uiAction(), component()]);
  fixture.relationships.push(owning('action'));
  assert.equal(
    resolveAnnotationSource(fixture, annotation({ accessibleName: 'Quarterly revenue chart' })),
    null,
  );
});
