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

const annotation = (overrides: Partial<CreateQARunAnnotation['elementFingerprint']> = {}) => ({
  normalizedRoute: '/dashboard',
  elementFingerprint: {
    tag: 'button', role: null, accessibleName: 'Continue', id: null, testId: null,
    cssPath: 'main > button', frameUrl: 'http://localhost/dashboard', domFingerprint: 'button:Continue',
    sourceMapping: null, ...overrides,
  },
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
