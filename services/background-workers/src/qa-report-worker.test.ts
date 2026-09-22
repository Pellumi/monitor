import assert from 'node:assert/strict';
import test from 'node:test';
import { anchorAiSuggestion, deriveFlowAnalysis, isInFlow, normalize, resolveFindingScope } from './qa-report-worker';
import { percentileOf, summarizeBackendEvidence } from './qa-backend-report';

const KNOWN = {
  evidenceIds: new Set(['evidence-1', 'evidence-2']),
  findingIds: new Set(['finding-1']),
  stateKeys: new Set(['sign_in', 'cart']),
  transitionKeys: new Set(['sign_in>cart']),
};

function suggestion(overrides: Partial<{
  evidenceIds: string[];
  affectedState: string | null;
  affectedTransition: string | null;
}> = {}) {
  return {
    suggestedAction: 'Do the thing',
    evidenceIds: [] as string[],
    affectedState: null as string | null,
    affectedTransition: null as string | null,
    ...overrides,
  };
}

test('an absent finding scope resolves from the run boundary, never to in-Flow by default', () => {
  assert.equal(resolveFindingScope(null, false), 'PRE_BOUNDARY');
  assert.equal(resolveFindingScope(undefined, false), 'PRE_BOUNDARY');
  assert.equal(resolveFindingScope(null, true), 'IN_FLOW');
  assert.equal(resolveFindingScope('PRE_BOUNDARY', true), 'PRE_BOUNDARY', 'an explicit scope always wins');
  assert.equal(resolveFindingScope('IN_FLOW', false), 'IN_FLOW');
});

test('out-of-Flow findings are excluded from the in-Flow section', () => {
  assert.equal(isInFlow({ scope: 'PRE_BOUNDARY' }), false);
  assert.equal(isInFlow({ scope: 'IN_FLOW' }), true);
  // Absence findings (a declared state never reached) belong to the Flow and
  // carry no scope of their own.
  assert.equal(isInFlow({}), true);
});

test('invented evidence ids are stripped from AI output', () => {
  const result = anchorAiSuggestion(
    suggestion({ evidenceIds: ['evidence-1', 'totally-made-up'], affectedState: 'sign_in' }),
    KNOWN,
  );
  assert.deepEqual(result?.evidenceIds, ['evidence-1']);
});

test('a finding id is an acceptable evidence anchor', () => {
  const result = anchorAiSuggestion(suggestion({ evidenceIds: ['finding-1'] }), KNOWN);
  assert.deepEqual(result?.evidenceIds, ['finding-1']);
});

test('an invented state or transition is dropped rather than published', () => {
  const result = anchorAiSuggestion(
    suggestion({
      evidenceIds: ['evidence-2'],
      affectedState: 'checkout_step_9',
      affectedTransition: 'cart>order_confirmed',
    }),
    KNOWN,
  );
  assert.equal(result?.affectedState, null);
  assert.equal(result?.affectedTransition, null);
  assert.deepEqual(result?.evidenceIds, ['evidence-2'], 'the real anchor survives');
});

test('a declared state anchor is kept and normalized', () => {
  const result = anchorAiSuggestion(suggestion({ affectedState: 'Sign In' }), KNOWN);
  assert.equal(result?.affectedState, 'sign_in');
});

test('a suggestion with no verifiable anchor at all is discarded', () => {
  assert.equal(anchorAiSuggestion(suggestion(), KNOWN), null);
  assert.equal(
    anchorAiSuggestion(suggestion({
      evidenceIds: ['made-up'], affectedState: 'nope', affectedTransition: 'a>b',
    }), KNOWN),
    null,
    'every reference being invented means the suggestion is not evidence-backed',
  );
});

test('normalize produces the comparison form used across the report', () => {
  assert.equal(normalize('Sign In'), 'sign_in');
  assert.equal(normalize('  Order-Confirmed! '), 'order_confirmed');
  assert.equal(normalize(null), '');
});

test('a session-scoped run has no reconciliation or declared coverage gaps', () => {
  const analysis = deriveFlowAnalysis(false, [{ key: 'declared', name: 'Declared', role: 'TERMINAL' }], [{ from: 'a', to: 'b', action: 'go' }], []);
  assert.deepEqual(analysis, {
    missingStates: [],
    missingTransitions: [],
    unexpectedStates: [],
    expectedCoverage: null,
    reconciledFlows: 0,
  });
});

test('a Flow-scoped run preserves declared reconciliation semantics', () => {
  const analysis = deriveFlowAnalysis(
    true,
    [{ key: 'start', name: 'Start', role: 'INITIAL' }, { key: 'done', name: 'Done', role: 'TERMINAL' }],
    [{ from: 'start', to: 'done', action: 'finish' }],
    [{ eventType: 'FLOW_STATE', stateKey: 'start', metadata: null }],
  );
  assert.equal(analysis.expectedCoverage, 50);
  assert.equal(analysis.reconciledFlows, 1);
  assert.deepEqual(analysis.missingStates.map((state) => state.key), ['done']);
  assert.deepEqual(analysis.missingTransitions.map((transition) => `${transition.from}>${transition.to}`), ['start>done']);
});


function backendRequest(overrides: Record<string, unknown> = {}, at = '2026-01-05T10:00:00.000Z') {
  return {
    eventId: `event-${Math.random()}`,
    eventType: 'QA_BACKEND_REQUEST',
    occurredAt: new Date(at),
    metadata: {
      method: 'GET', route: '/orders', statusCode: 200, durationMs: 40,
      requestBytes: 100, responseBytes: 200, ...overrides,
    },
  };
}

test('a frontend-only run carries no backend section at all', () => {
  assert.equal(summarizeBackendEvidence([], { captureTracks: ['FRONTEND'] }), null);
  assert.equal(
    summarizeBackendEvidence(
      [{ eventType: 'QA_REQUEST', occurredAt: new Date(), metadata: {} }],
      { captureTracks: ['FRONTEND'] },
    ),
    null,
  );
});

test('a backend run that saw no traffic says so rather than reporting zeroes silently', () => {
  const summary = summarizeBackendEvidence([], { captureTracks: ['BACKEND'] });
  assert.ok(summary);
  assert.equal(summary.requests, 0);
  assert.equal(summary.p95Ms, null);
  assert.match(summary.limitations.join(' '), /no request reached it/i);
});

test('backend requests roll up per endpoint, with percentiles and status classes', () => {
  const summary = summarizeBackendEvidence([
    backendRequest({ durationMs: 10 }, '2026-01-05T10:00:00.000Z'),
    backendRequest({ durationMs: 30 }, '2026-01-05T10:01:00.000Z'),
    backendRequest({ durationMs: 90, statusCode: 500 }, '2026-01-05T10:02:00.000Z'),
    backendRequest({
      method: 'POST', route: '/orders/:id', statusCode: 422, durationMs: 15,
      handler: 'orders.update', models: [{ model: 'Order', operation: 'update' }],
      requestBody: { note: '[PROTECTED · 4 characters]' },
    }, '2026-01-05T10:03:00.000Z'),
  ], { captureTracks: ['BACKEND'] })!;

  assert.equal(summary.requests, 4);
  assert.equal(summary.serverErrors, 1);
  assert.equal(summary.clientErrors, 1);
  assert.equal(summary.errors, 2);
  assert.equal(summary.errorRate, 50);
  assert.equal(summary.p50Ms, 15);
  assert.equal(summary.slowestMs, 90);
  assert.equal(summary.payloadsCaptured, 1);
  assert.equal(summary.requestBytes, 400);

  // Busiest first, and a route is the template rather than the concrete path.
  assert.equal(summary.endpoints[0].key, 'GET /orders');
  assert.equal(summary.endpoints[0].requests, 3);
  assert.equal(summary.endpoints[0].serverErrors, 1);
  assert.deepEqual(summary.endpoints[0].statusClasses, { '2xx': 2, '5xx': 1 });
  assert.equal(summary.endpoints[1].key, 'POST /orders/:id');
  assert.deepEqual(summary.endpoints[1].models, ['Order']);
  assert.deepEqual(summary.endpoints[1].handlers, ['orders.update']);

  // The slowest requests are listed for the report, worst first.
  assert.equal(summary.slowestRequests[0].durationMs, 90);
  assert.equal(summary.slowestRequests[0].statusCode, 500);

  // A rate is only published once there is a window worth dividing by.
  assert.ok(summary.requestsPerMinute && summary.requestsPerMinute > 0);
});

test('data access rolls up per model, and server errors group by route and type', () => {
  const summary = summarizeBackendEvidence([
    backendRequest(),
    {
      eventType: 'QA_BACKEND_DATA_ACCESS',
      occurredAt: new Date('2026-01-05T10:00:01.000Z'),
      metadata: { model: 'Order', operation: 'update', records: 2, mutation: true, route: '/orders/:id', method: 'POST' },
    },
    {
      eventType: 'QA_BACKEND_DATA_ACCESS',
      occurredAt: new Date('2026-01-05T10:00:02.000Z'),
      metadata: { model: 'Order', operation: 'findMany', records: 5, mutation: false, route: '/orders', method: 'GET' },
    },
    {
      eventType: 'QA_BACKEND_ERROR',
      occurredAt: new Date('2026-01-05T10:00:03.000Z'),
      metadata: { name: 'TypeError', message: 'cannot read id', route: '/orders/:id', method: 'POST' },
    },
    {
      eventType: 'QA_BACKEND_ERROR',
      occurredAt: new Date('2026-01-05T10:00:04.000Z'),
      metadata: { name: 'TypeError', message: 'cannot read id', route: '/orders/:id', method: 'POST' },
    },
  ], { captureTracks: ['BACKEND'] })!;

  assert.equal(summary.dataOperations, 2);
  assert.equal(summary.models[0].model, 'Order');
  assert.equal(summary.models[0].writes, 1);
  assert.equal(summary.models[0].reads, 1);
  assert.equal(summary.models[0].records, 7);
  assert.deepEqual(summary.models[0].operations, ['update', 'findMany']);
  assert.deepEqual(summary.models[0].endpoints, ['POST /orders/:id', 'GET /orders']);

  assert.equal(summary.unhandledErrors, 2);
  assert.equal(summary.serverErrorGroups.length, 1, 'the same error on the same route is one group');
  assert.equal(summary.serverErrorGroups[0].occurrences, 2);
  assert.equal(summary.serverErrorGroups[0].name, 'TypeError');
});

test('a run with no captured payloads and no ORM hooks says which is missing', () => {
  const summary = summarizeBackendEvidence([backendRequest()], { captureTracks: ['BACKEND'] })!;
  const limitations = summary.limitations.join(' ');
  assert.match(limitations, /No request or response payloads were retained/);
  assert.match(limitations, /models each request touched are unknown/);
});

test('report percentiles are nearest-rank, matching what the run showed live', () => {
  assert.equal(percentileOf([], 95), null);
  assert.equal(percentileOf([10, 20, 30, 40], 50), 20);
  assert.equal(percentileOf([10], 99), 10);
});
