import assert from 'node:assert/strict';
import test from 'node:test';
import type { CodebaseAnalysis, CodeEntity, CodeRelationship, DeclaredFlowDetail } from '@tellann/desktop-contracts';
import { buildFlowMappingQueries, retrieveFlowMappings } from './flow-mapping';

const STATE_LOGIN = '10000000-0000-4000-8000-000000000001';
const STATE_VERIFY = '10000000-0000-4000-8000-000000000002';
const STATE_DASHBOARD = '10000000-0000-4000-8000-000000000003';
const TRANSITION_SUBMIT = '20000000-0000-4000-8000-000000000001';

function entity(input: Partial<CodeEntity> & Pick<CodeEntity, 'id' | 'type' | 'name'>): CodeEntity {
  return {
    path: null, startLine: null, endLine: null, language: 'typescript', confidence: 0.9,
    metadata: {}, evidence: [], ...input,
  };
}

function edge(input: Omit<CodeRelationship, 'id' | 'confidence' | 'evidence'>): CodeRelationship {
  return { id: `${input.source}:${input.type}:${input.target}`, confidence: 0.9, evidence: [], ...input };
}

function flow(): DeclaredFlowDetail {
  return {
    id: '30000000-0000-4000-8000-000000000001', name: 'User authentication', status: 'PUBLISHED',
    workflowType: 'USER_JOURNEY',
    states: [
      { id: STATE_LOGIN, stateName: 'LOGIN PAGE', category: 'UI', provenance: 'USER', role: 'INITIAL' },
      { id: STATE_VERIFY, stateName: 'VERIFYING_CREDENTIALS', category: 'PROCESS', provenance: 'USER', role: 'NORMAL' },
      { id: STATE_DASHBOARD, stateName: 'DASHBOARD', category: 'UI', provenance: 'USER', role: 'TERMINAL', terminalKind: 'SUCCESS' },
    ],
    transitions: [{
      id: TRANSITION_SUBMIT, fromStateId: STATE_LOGIN, toStateId: STATE_VERIFY,
      action: 'SUBMIT_CREDENTIALS', condition: null, provenance: 'USER',
    }],
  };
}

function analysis(entities: CodeEntity[], relationships: CodeRelationship[] = [], features: CodebaseAnalysis['features'] = []): CodebaseAnalysis {
  return {
    id: 'analysis-1', workspaceId: '40000000-0000-4000-8000-000000000001',
    repositoryFingerprint: 'repo', graphVersion: 'graph-1', analyzerVersions: {},
    status: 'COMPLETED', progress: 100, stageMessage: 'complete',
    startedAt: '2026-09-16T00:00:00.000Z', completedAt: '2026-09-16T00:01:00.000Z',
    revision: 'abc', branch: 'main', dirty: false, contentHash: 'content',
    entities, relationships, features, findings: [], architecture: null, coverage: null,
    incremental: null, explanations: [],
    summary: { files: 1, symbols: entities.length, relationships: relationships.length, applications: 1, services: 0, domains: 1, features: features.length, endpoints: 0, dataModels: 0, events: 0, externalServices: 0, tests: 0, confidence: 0.9, coveragePercent: 100 },
    warnings: [], notices: [],
  };
}

test('builds state and transition queries with flow-neighbour context', () => {
  const queries = buildFlowMappingQueries(flow());
  const login = queries.find((query) => query.checkpointId === `state:${STATE_LOGIN}`)!;
  const submit = queries.find((query) => query.checkpointId === `transition:${TRANSITION_SUBMIT}`)!;

  assert.deepEqual(login.neighborNames, ['SUBMIT_CREDENTIALS', 'VERIFYING_CREDENTIALS']);
  assert.equal(submit.kind, 'TRANSITION');
  assert.equal(submit.sourceStateName, 'LOGIN PAGE');
  assert.equal(submit.targetStateName, 'VERIFYING_CREDENTIALS');
  assert.ok(submit.terms.includes('credentials'));
  assert.equal(queries.length, 4);
});

test('maps LOGIN PAGE to a sign-in route without requiring the exact declared label', () => {
  const input = analysis([
    entity({ id: 'route-login', type: 'ui_route', name: '/sign-in', path: 'apps/web/app/sign-in/page.tsx', startLine: 1, endLine: 30 }),
    entity({ id: 'settings', type: 'ui_route', name: '/settings', path: 'apps/web/app/settings/page.tsx', startLine: 1, endLine: 20 }),
  ]);

  const result = retrieveFlowMappings({ flow: flow(), analysis: input });
  const mapping = result.mappings.find((item) => item.checkpointId === `state:${STATE_LOGIN}`)!;

  assert.equal(mapping.candidates[0].entityId, 'route-login');
  assert.equal(mapping.status, 'RESOLVED');
  assert.ok(mapping.candidates[0].scoreBreakdown.lexical > 0);
});

test('uses transition, graph and feature context to find credential submission', () => {
  const entities = [
    entity({ id: 'login-route', type: 'ui_route', name: '/login', path: 'web/login/page.tsx', startLine: 1, endLine: 40 }),
    entity({ id: 'submit-action', type: 'ui_action', name: 'Submit login form', path: 'web/login/LoginForm.tsx', startLine: 18, endLine: 18 }),
    entity({ id: 'authenticate', type: 'function', name: 'authenticateUser', path: 'web/login/actions.ts', startLine: 5, endLine: 22 }),
    entity({ id: 'session-endpoint', type: 'endpoint', name: 'POST /sessions', path: 'api/session.ts', startLine: 10, endLine: 30 }),
    entity({ id: 'save-cart', type: 'function', name: 'submitCart', path: 'web/cart/actions.ts', startLine: 2, endLine: 12 }),
  ];
  const relationships = [
    edge({ source: 'login-route', target: 'submit-action', type: 'CONTAINS' }),
    edge({ source: 'submit-action', target: 'authenticate', type: 'ROUTES_TO' }),
    edge({ source: 'authenticate', target: 'session-endpoint', type: 'CALLS' }),
  ];
  const features: CodebaseAnalysis['features'] = [{
    id: 'auth-feature', name: 'User sign in', description: 'Verifies submitted credentials and creates a session', domain: 'Identity',
    triggers: ['/login', 'Submit login form'], entrypoints: ['login-route'],
    workflow: [{ entityId: 'login-route', label: 'Show login page' }, { entityId: 'submit-action', label: 'Submit credentials' }, { entityId: 'authenticate', label: 'Verify credentials' }],
    reads: ['User'], writes: ['Session'], externalServices: [], emittedEvents: [], downstreamEffects: ['Open dashboard'],
    authorization: [], sourceFiles: ['web/login/page.tsx', 'web/login/LoginForm.tsx', 'web/login/actions.ts'], confidence: 0.94, evidence: [],
  }];

  const result = retrieveFlowMappings({ flow: flow(), analysis: analysis(entities, relationships, features) });
  const mapping = result.mappings.find((item) => item.checkpointId === `transition:${TRANSITION_SUBMIT}`)!;

  assert.equal(mapping.candidates[0].entityId, 'submit-action');
  assert.equal(mapping.status, 'RESOLVED');
  assert.ok(mapping.candidates[0].scoreBreakdown.graph > 0);
  assert.ok(mapping.candidates[0].featureIds.includes('auth-feature'));
  assert.ok(mapping.candidates[0].relationshipPaths.length > 0);
});

test('uses graph context to separate duplicate symbol names', () => {
  const entities = [
    entity({ id: 'auth-submit', type: 'function', name: 'submit', path: 'auth/login.ts', startLine: 8, endLine: 18 }),
    entity({ id: 'cart-submit', type: 'function', name: 'submit', path: 'checkout/cart.ts', startLine: 8, endLine: 18 }),
    entity({ id: 'verify', type: 'function', name: 'verifyCredentials', path: 'auth/verify.ts', startLine: 1, endLine: 12 }),
    entity({ id: 'checkout', type: 'function', name: 'completeCheckout', path: 'checkout/complete.ts', startLine: 1, endLine: 12 }),
  ];
  const relationships = [
    edge({ source: 'auth-submit', target: 'verify', type: 'CALLS' }),
    edge({ source: 'cart-submit', target: 'checkout', type: 'CALLS' }),
  ];

  const result = retrieveFlowMappings({ flow: flow(), analysis: analysis(entities, relationships) });
  const mapping = result.mappings.find((item) => item.checkpointId === `transition:${TRANSITION_SUBMIT}`)!;

  assert.equal(mapping.candidates[0].entityId, 'auth-submit');
  assert.ok(mapping.candidates[0].score > mapping.candidates[1].score);
});

test('bounds candidates, deduplicates locations and reports an honest no-match', () => {
  const entities = Array.from({ length: 12 }, (_, index) => entity({
    id: `candidate-${index}`, type: 'function', name: 'renderDashboard',
    path: `feature-${index}/dashboard.ts`, startLine: 2, endLine: 12,
  }));
  entities.push(entity({ id: 'duplicate-location', type: 'method', name: 'renderDashboard', path: 'feature-0/dashboard.ts', startLine: 2, endLine: 12 }));

  const result = retrieveFlowMappings({ flow: flow(), analysis: analysis(entities) });
  const dashboard = result.mappings.find((item) => item.checkpointId === `state:${STATE_DASHBOARD}`)!;
  const verifying = result.mappings.find((item) => item.checkpointId === `state:${STATE_VERIFY}`)!;

  assert.ok(dashboard.candidates.length <= 8);
  assert.ok(new Set(dashboard.candidates.map((item) => item.path)).size <= 5);
  assert.equal(dashboard.candidates.filter((item) => item.path === 'feature-0/dashboard.ts').length, 1);
  assert.equal(verifying.status, 'UNRESOLVED');
  assert.deepEqual(verifying.candidates, []);
  assert.equal(verifying.confidence, 0);
});
