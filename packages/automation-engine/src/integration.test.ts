import assert from 'node:assert/strict';
import test from 'node:test';
import { compileExecutableContract } from './contract';
import { runAutomation } from './executor';
import { FakeApp, ORIGIN, element, limits } from './test-fixtures';

/**
 * Compile a contract from a code graph, then execute it against a fake application whose DOM
 * is what that code would render. Nothing in the contract is hand-written: if derivation and
 * execution disagree about what a control looks like, this is where it shows.
 */
test('a contract derived from code drives a run to its terminal state', async () => {
  const contract = compileExecutableContract({
    flowVersionId: 'v1',
    flow: {
      states: [
        { id: 'a', behaviorKey: 'COURSE_DETAILS', role: 'INITIAL' },
        { id: 'b', behaviorKey: 'EXAM_FORM', role: 'NORMAL' },
        { id: 'c', behaviorKey: 'EXAM_CREATED', role: 'TERMINAL', terminalKind: 'SUCCESS' },
      ],
      transitions: [
        { id: 't1', fromNodeId: 'a', toNodeId: 'b', action: 'Create Exam' },
        { id: 't2', fromNodeId: 'b', toNodeId: 'c', action: 'Submit', expectedInput: [{ name: 'title', dataKey: 'examTitle' }] },
      ],
    },
    checkpoints: [
      { id: 'state:a', mapping: { status: 'RESOLVED', entityId: 'page-a', file: null, symbol: null } },
      { id: 'state:b', mapping: { status: 'RESOLVED', entityId: 'page-b', file: null, symbol: null } },
      { id: 'state:c', mapping: { status: 'RESOLVED', entityId: 'page-c', file: null, symbol: null } },
      { id: 'transition:t1', mapping: { status: 'RESOLVED', entityId: 'fn-create', file: null, symbol: null } },
      { id: 'transition:t2', mapping: { status: 'RESOLVED', entityId: 'fn-submit', file: null, symbol: null } },
    ],
    code: {
      entities: [
        { id: 'route-a', type: 'ui_route', name: 'a', path: 'a.tsx', metadata: { route: '/courses/[id]' } },
        { id: 'route-b', type: 'ui_route', name: 'b', path: 'b.tsx', metadata: { route: '/courses/[id]/exams/new' } },
        { id: 'route-c', type: 'ui_route', name: 'c', path: 'c.tsx', metadata: { route: '/courses/[id]/exams/[examId]' } },
        { id: 'page-a', type: 'function', name: 'A', path: 'a.tsx', metadata: {} },
        { id: 'page-b', type: 'function', name: 'B', path: 'b.tsx', metadata: {} },
        { id: 'page-c', type: 'function', name: 'C', path: 'c.tsx', metadata: {} },
        { id: 'btn', type: 'ui_action', name: 'onClick', path: 'a.tsx', metadata: { event: 'onClick', element: 'button', labels: ['Create Exam'] } },
        { id: 'fn-create', type: 'function', name: 'create', path: 'a.tsx', metadata: {} },
        { id: 'form', type: 'ui_action', name: 'onSubmit', path: 'b.tsx', metadata: { event: 'onSubmit', element: 'form', labels: ['Save'], testId: 'save' } },
        { id: 'fn-submit', type: 'function', name: 'submit', path: 'b.tsx', metadata: {} },
        { id: 'ep', type: 'endpoint', name: 'POST /api/exams', path: 'api.ts', metadata: { method: 'POST', route: '/api/exams' } },
      ],
      relationships: [
        { source: 'btn', target: 'fn-create', type: 'ROUTES_TO', confidence: 0.9 },
        { source: 'form', target: 'fn-submit', type: 'ROUTES_TO', confidence: 0.9 },
        { source: 'fn-submit', target: 'ep', type: 'CALLS', confidence: 0.9 },
      ],
    },
  });

  const app = new FakeApp({
    start: 'a',
    pages: {
      a: { path: '/courses/7', sdkState: 'course_details', elements: [element({ ref: 'r-create', name: 'Create Exam' })] },
      b: {
        path: '/courses/7/exams/new', sdkState: 'exam_form',
        elements: [
          element({ ref: 'r-title', tag: 'input', role: 'textbox', label: 'title', fieldName: 'title' }),
          element({ ref: 'r-save', testId: 'save', name: 'Save' }),
        ],
      },
      c: { path: '/courses/7/exams/42', sdkState: 'exam_created', elements: [] },
    },
    clicks: { 'r-create': 'b', 'r-save': 'c' },
    data: { examTitle: { value: 'Automated QA Exam', secret: false } },
  });

  const result = await runAutomation(app, {
    contract, targetStateKey: 'exam_created', environment: 'DEVELOPMENT', applicationOrigin: ORIGIN, limits: limits(),
  });
  assert.equal(result.stopReason, 'TERMINAL_STATE_REACHED');
  assert.deepEqual(result.states.map((s) => s.stateKey), ['course_details', 'exam_form', 'exam_created']);
  // The submit was classified from the endpoint it reaches, without anyone declaring it.
  assert.equal(contract.transitions.find((t) => t.id === 't2')!.actionClass, 'SERVER_MUTATION');
  assert.equal(result.states[1]!.leftVia?.actionClass, 'SERVER_MUTATION');
});
