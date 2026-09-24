import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildCodeContext,
  buildResolutionBundle,
  canonicalRoute,
  parseFindingTarget,
  readStoredAnalysis,
  type EvidenceEventRow,
  type FindingRow,
} from './qa-finding-resolution';

const finding = (overrides: Partial<FindingRow> = {}): FindingRow => ({
  id: 'finding-1',
  category: 'BACKEND_CLIENT_ERROR',
  severity: 'MEDIUM',
  title: 'GET /schools/<int:pk>/analytics/ returned 403',
  description: "The application's own server answered GET /schools/<int:pk>/analytics/ with 403.",
  recommendation: null,
  dedupeKey: 'backend:GET:/schools/<int:pk>/analytics/:403',
  ...overrides,
});

const request = (id: string, metadata: Record<string, unknown>): EvidenceEventRow => ({
  id, eventType: 'QA_BACKEND_REQUEST', occurredAt: '2026-09-24T10:00:00.000Z',
  metadata: { method: 'GET', route: '/schools/<int:pk>/analytics/', statusCode: 200, durationMs: 40, ...metadata },
});

const analysis = readStoredAnalysis({
  revision: 'abc123',
  entities: [
    { id: 'endpoint:1', type: 'endpoint', name: 'GET /schools/{param}/analytics', path: 'schools/urls.py', startLine: 12, endLine: 12, metadata: { method: 'GET', route: '/schools/{param}/analytics' } },
    { id: 'endpoint:client', type: 'endpoint', name: 'GET /schools/{param}/analytics', path: null, metadata: { method: 'GET', route: '/schools/{param}/analytics', calledFromClient: true } },
    { id: 'fn:view', type: 'class', name: 'SchoolAnalyticsView', path: 'schools/views.py', startLine: 120, endLine: 168, metadata: {} },
    { id: 'fn:count', type: 'function', name: 'count_students', path: 'schools/services.py', startLine: 10, endLine: 30, metadata: {} },
    { id: 'model:school', type: 'database_model', name: 'School', path: 'schools/models.py', startLine: 5, endLine: 5, metadata: {} },
    { id: 'test:1', type: 'test', name: 'test_analytics_forbidden', path: 'schools/tests.py', startLine: 1, endLine: 9, metadata: {} },
  ],
  relationships: [
    { source: 'endpoint:1', target: 'fn:view', type: 'ROUTES_TO' },
    { source: 'fn:view', target: 'fn:count', type: 'CALLS' },
    { source: 'fn:count', target: 'model:school', type: 'READS' },
    { source: 'test:1', target: 'fn:view', type: 'TESTS' },
  ],
  features: [{ entrypoints: ['endpoint:1'], workflow: [{ label: 'class: SchoolAnalyticsView' }], reads: ['School'], writes: [], authorization: ['IsSchoolAdmin'], sourceFiles: ['schools/views.py'] }],
})!;

test('a finding is traced back to its endpoint from the key the desktop gave it', () => {
  assert.deepEqual(parseFindingTarget(finding()), { method: 'GET', route: '/schools/<int:pk>/analytics/', status: 403 });
  assert.deepEqual(
    parseFindingTarget(finding({ dedupeKey: 'backend-slow:POST /exams/teacher/create/', title: 'POST /exams/teacher/create/ took 8.6 s' })),
    { method: 'POST', route: '/exams/teacher/create/', status: null },
  );
  assert.deepEqual(
    parseFindingTarget(finding({ category: 'BACKEND_UNHANDLED_ERROR', dedupeKey: 'backend-error:/api/orders:TypeError', title: 'Unhandled server error on /api/orders' })),
    { method: null, route: '/api/orders', status: null },
  );
  // No key: the title alone still names the endpoint.
  assert.deepEqual(parseFindingTarget(finding({ dedupeKey: null })), { method: 'GET', route: '/schools/<int:pk>/analytics/', status: 403 });
  assert.equal(parseFindingTarget(finding({ dedupeKey: null, title: 'Something else entirely' })), null);
});

test('runtime templates and analysed routes reduce to the same endpoint', () => {
  assert.equal(canonicalRoute('/schools/<int:pk>/analytics/'), canonicalRoute('/schools/{param}/analytics'));
  assert.equal(canonicalRoute('/users/:id'), canonicalRoute('/users/<uuid:id>/'));
});

test('the bundle samples the failing requests, not just any call to the route', () => {
  const events = [
    request('ok', { statusCode: 200 }),
    request('bad', { statusCode: 403, responseBody: { detail: '[PROTECTED · 20 characters]' }, handler: 'SchoolAnalyticsView', models: [{ model: 'users_user' }] }),
    request('other-route', { route: '/other/', statusCode: 403 }),
  ];
  const bundle = buildResolutionBundle(finding(), events, null, null)!;
  assert.equal(bundle.occurrences, 2);
  assert.equal(bundle.requests.length, 1);
  assert.equal(bundle.requests[0].statusCode, 403);
  assert.deepEqual(bundle.requests[0].models, ['users_user']);
  assert.deepEqual(bundle.requests[0].responseBody, { detail: '[PROTECTED · 20 characters]' });
  assert.equal(bundle.code, null);
});

test('a slow finding is sampled from the slowest calls', () => {
  const events = [
    request('a', { durationMs: 100 }), request('b', { durationMs: 9000 }), request('c', { durationMs: 300 }), request('d', { durationMs: 50 }),
  ];
  const bundle = buildResolutionBundle(
    finding({ category: 'BACKEND_SLOW_RESPONSE', dedupeKey: 'backend-slow:GET /schools/<int:pk>/analytics/', title: 'GET /schools/<int:pk>/analytics/ took 9.0 s' }),
    events, null, null,
  )!;
  assert.deepEqual(bundle.requests.map((item) => item.durationMs), [9000, 300, 100]);
});

test('data operations for the endpoint are collapsed by model and operation', () => {
  const dataOp = (id: string, metadata: Record<string, unknown>): EvidenceEventRow => ({
    id, eventType: 'QA_BACKEND_DATA_ACCESS', occurredAt: '2026-09-24T10:00:00.000Z',
    metadata: { route: '/schools/<int:pk>/analytics/', method: 'GET', operation: 'select', mutation: false, ...metadata },
  });
  const bundle = buildResolutionBundle(finding(), [
    dataOp('1', { model: 'users_user', count: 2, records: 1 }),
    dataOp('2', { model: 'users_user', count: 3, records: 4 }),
    dataOp('3', { model: 'unrelated', route: '/elsewhere/' }),
  ], null, null)!;
  assert.deepEqual(bundle.dataOperations, [{ model: 'users_user', operation: 'select', mutation: false, records: 5, count: 5 }]);
});

test('the handler, what it calls and its authorization signals come from the stored analysis', () => {
  const code = buildCodeContext(analysis, { method: 'GET', route: '/schools/<int:pk>/analytics/', status: 403 }, { handler: null, repositoryRevision: 'abc123' })!;
  assert.deepEqual(code.refs.map((ref) => `${ref.role}:${ref.name}:${ref.path}:${ref.startLine}-${ref.endLine}`), [
    'route registration:GET /schools/{param}/analytics:schools/urls.py:12-12',
    'handler:SchoolAnalyticsView:schools/views.py:120-168',
    'called by the handler:count_students:schools/services.py:10-30',
  ]);
  assert.deepEqual(code.refs.map((ref) => ref.id), ['ref1', 'ref2', 'ref3']);
  assert.deepEqual(code.authorization, ['IsSchoolAdmin']);
  assert.deepEqual(code.reads, ['School']);
  assert.deepEqual(code.tests, ['test_analytics_forbidden']);
  assert.equal(code.matchesRun, true);
});

test('a client-side call to the same route is not mistaken for its handler', () => {
  const onlyClient = readStoredAnalysis({
    entities: [{ id: 'endpoint:client', type: 'endpoint', name: 'GET /x', path: null, metadata: { method: 'GET', route: '/x', calledFromClient: true } }],
    relationships: [],
  })!;
  assert.equal(buildCodeContext(onlyClient, { method: 'GET', route: '/x', status: null }, { handler: null, repositoryRevision: null }), null);
});

test('the handler the SDK reported anchors a route the analysis could not resolve', () => {
  const code = buildCodeContext(analysis, { method: 'GET', route: '/unregistered/', status: null }, { handler: 'schools.views.SchoolAnalyticsView', repositoryRevision: 'def456' })!;
  assert.equal(code.refs[0].name, 'SchoolAnalyticsView');
  assert.equal(code.matchesRun, false);
});

test('a payload that is not an analysis reads as none', () => {
  assert.equal(readStoredAnalysis(null), null);
  assert.equal(readStoredAnalysis({ entities: 'nope' }), null);
});
