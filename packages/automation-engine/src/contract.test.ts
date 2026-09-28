import assert from 'node:assert/strict';
import test from 'node:test';
import { compileExecutableContract } from './contract';
import type { CheckpointLike, CodeEntityLike, CodeRelationshipLike, CompileInput, FlowSnapshotLike } from './contract';

/**
 * A miniature LMS codebase, wired the way the analyzer wires a real one:
 *
 *   ui_route /courses/{param}  ── same file as ──  CourseDetails (page)
 *   ui_action <button Create Exam>  ROUTES_TO  handleCreateExam   (fn)
 *   ui_action <form onSubmit>       ROUTES_TO  submitExam         (fn)  CALLS  POST /api/exams
 *   ui_action <button Delete>       ROUTES_TO  removeExam         (fn)  CALLS  DELETE /api/exams/{param}
 */
const entity = (id: string, type: string, name: string, path: string | null, metadata: Record<string, unknown> = {}): CodeEntityLike => ({ id, type, name, path, metadata });
const rel = (source: string, target: string, type: string, confidence = 0.9): CodeRelationshipLike => ({ source, target, type, confidence });

const entities: CodeEntityLike[] = [
  entity('route-details', 'ui_route', '/courses/[id]', 'app/courses/[id]/page.tsx', { route: '/courses/{param}', framework: 'Next.js' }),
  entity('route-new', 'ui_route', '/courses/[id]/exams/new', 'app/courses/[id]/exams/new/page.tsx', { route: '/courses/{param}/exams/new' }),
  entity('page-details', 'function', 'CourseDetails', 'app/courses/[id]/page.tsx'),
  entity('page-new', 'function', 'NewExam', 'app/courses/[id]/exams/new/page.tsx'),
  entity('btn-create', 'ui_action', 'onClick', 'app/courses/[id]/page.tsx', { event: 'onClick', element: 'button', labels: ['Create Exam'], testId: 'create-exam' }),
  entity('btn-students', 'ui_action', 'onClick', 'app/courses/[id]/page.tsx', { event: 'onClick', element: 'button', labels: ['Students'] }),
  entity('fn-create', 'function', 'handleCreateExam', 'app/courses/[id]/page.tsx'),
  entity('form-exam', 'ui_action', 'onSubmit', 'app/courses/[id]/exams/new/page.tsx', { event: 'onSubmit', element: 'form', labels: ['Save exam'] }),
  entity('fn-submit', 'function', 'submitExam', 'app/courses/[id]/exams/new/page.tsx'),
  entity('ep-create', 'endpoint', 'POST /api/exams', 'api/exams.ts', { method: 'POST', route: '/api/exams' }),
  entity('btn-delete', 'ui_action', 'onClick', 'app/courses/[id]/page.tsx', { event: 'onClick', element: 'button', labels: ['Delete exam'] }),
  entity('fn-remove', 'function', 'removeExam', 'app/courses/[id]/page.tsx'),
  entity('ep-delete', 'endpoint', 'DELETE /api/exams/{param}', 'api/exams.ts', { method: 'DELETE', route: '/api/exams/{param}' }),
  entity('link-back', 'ui_action', 'href', 'app/courses/[id]/exams/new/page.tsx', { element: 'a', labels: ['Back to course'], href: '/courses/{param}' }),
  entity('fn-nav', 'function', 'goBack', 'app/courses/[id]/exams/new/page.tsx'),
  // A second button elsewhere that calls the same endpoint: must not be attributed to "Create Exam".
  entity('btn-quick', 'ui_action', 'onClick', 'app/quick/page.tsx', { event: 'onClick', element: 'button', labels: ['Quick exam'] }),
  entity('fn-quick', 'function', 'quickExam', 'app/quick/page.tsx'),
];

const relationships: CodeRelationshipLike[] = [
  rel('btn-create', 'fn-create', 'ROUTES_TO'),
  rel('form-exam', 'fn-submit', 'ROUTES_TO'),
  rel('fn-submit', 'ep-create', 'CALLS'),
  rel('btn-delete', 'fn-remove', 'ROUTES_TO'),
  rel('fn-remove', 'ep-delete', 'CALLS'),
  rel('link-back', 'fn-nav', 'ROUTES_TO'),
  rel('btn-quick', 'fn-quick', 'ROUTES_TO'),
  rel('fn-quick', 'ep-create', 'CALLS'),
];

const flow: FlowSnapshotLike = {
  states: [
    { id: 's-details', stateName: 'Course Details', behaviorKey: 'COURSE_DETAILS', role: 'INITIAL' },
    { id: 's-form', stateName: 'Exam Form', behaviorKey: 'EXAM_FORM', role: 'NORMAL' },
    { id: 's-created', stateName: 'Exam Created', behaviorKey: 'EXAM_CREATED', role: 'TERMINAL', terminalKind: 'SUCCESS' },
    { id: 's-removed', stateName: 'Exam Removed', behaviorKey: 'EXAM_REMOVED', role: 'TERMINAL', terminalKind: 'SUCCESS' },
  ],
  transitions: [
    { id: 't-create', fromNodeId: 's-details', toNodeId: 's-form', action: 'Create Exam' },
    { id: 't-submit', fromNodeId: 's-form', toNodeId: 's-created', action: 'Submit exam', expectedInput: [{ name: 'title', label: 'Title', dataKey: 'examTitle' }, 'dueDate'] },
    { id: 't-remove', fromNodeId: 's-details', toNodeId: 's-removed', action: 'Delete exam' },
    { id: 't-back', fromNodeId: 's-form', toNodeId: 's-details', action: 'Back' },
  ],
};

const mapped = (id: string, entityId: string | null, file: string | null = null, status: CheckpointLike['mapping']['status'] = 'RESOLVED'): CheckpointLike =>
  ({ id, mapping: { status, entityId, file, symbol: null } });

const input = (overrides: Partial<CompileInput> = {}): CompileInput => ({
  flowVersionId: 'v1',
  flow,
  checkpoints: [
    mapped('state:s-details', 'page-details'),
    mapped('state:s-form', 'page-new'),
    mapped('state:s-created', 'ep-create'),
    mapped('transition:t-create', 'fn-create'),
    mapped('transition:t-submit', 'ep-create'),
    mapped('transition:t-remove', 'fn-remove'),
    mapped('transition:t-back', 'fn-nav'),
  ],
  code: { entities, relationships },
  analysisIdentity: 'analysis-9',
  ...overrides,
});

const transitionOf = (id: string, overrides?: Partial<CompileInput>) => compileExecutableContract(input(overrides)).transitions.find((t) => t.id === id)!;

test('the contract is pinned to the Flow version and analysis it was compiled from', () => {
  const contract = compileExecutableContract(input());
  assert.equal(contract.flowVersionId, 'v1');
  assert.equal(contract.analysisIdentity, 'analysis-9');
  assert.equal(contract.initialStateKey, 'course_details');
  assert.match(contract.flowHash, /^[0-9a-f]{64}$/);
  assert.equal(contract.flowHash, compileExecutableContract(input()).flowHash, 'stable');
  assert.notEqual(contract.flowHash, compileExecutableContract(input({ flow: { ...flow, states: flow.states.slice(1) } })).flowHash);
});

test('state keys are the boundary evaluator keys, and each state carries the SDK key it will report', () => {
  const contract = compileExecutableContract(input());
  assert.deepEqual(contract.states.map((s) => s.key), ['course_details', 'exam_form', 'exam_created', 'exam_removed']);
  assert.deepEqual(contract.states[0]!.sdkStateSignals, ['course_details']);
  assert.equal(contract.states[2]!.terminalKind, 'SUCCESS');
});

test('a state gets its route from the page it is implemented in', () => {
  const contract = compileExecutableContract(input());
  assert.deepEqual(contract.states.find((s) => s.key === 'course_details')!.routePatterns, ['/courses/{param}']);
  assert.deepEqual(contract.states.find((s) => s.key === 'exam_form')!.routePatterns, ['/courses/{param}/exams/new']);
});

test('the controls a page defines become optional evidence for its state, never required', () => {
  const details = compileExecutableContract(input()).states.find((s) => s.key === 'course_details')!;
  assert.ok(details.optionalElements.some((e) => e.labels.includes('Create Exam')));
  assert.ok(details.optionalElements.some((e) => e.labels.includes('Students')));
  assert.equal(details.requiredElements.length, 0);
});

test('a transition finds its control by following its handler back to the button', () => {
  const create = transitionOf('t-create');
  assert.equal(create.derivation, 'RESOLVED');
  assert.deepEqual(create.control?.labels, ['Create Exam']);
  assert.equal(create.control?.testId, 'create-exam');
  assert.equal(create.control?.element, 'button');
  assert.equal(create.from, 'course_details');
  assert.equal(create.to, 'exam_form');
});

test('a transition mapped to an endpoint finds the control that reaches it, through its caller', () => {
  const submit = transitionOf('t-submit');
  assert.ok(submit.control?.labels.includes('Save exam'), 'form -> submitExam -> POST /api/exams');
});

test('an endpoint checkpoint is attributed to every control that reaches it, which is reported as ambiguity', () => {
  // POST /api/exams is called from the exam form and from an unrelated quick-exam button. The compiler cannot
  // tell which the Flow means, and must say so rather than choose.
  const submit = transitionOf('t-submit');
  assert.equal(submit.derivation, 'AMBIGUOUS');
  assert.ok(submit.control!.labels.includes('Save exam'));
  assert.ok(submit.control!.labels.includes('Quick exam'));
});

test('a handler checkpoint is not contaminated by another button that shares an endpoint', () => {
  // t-create maps to handleCreateExam, which calls nothing. Neither the form nor the quick button belong to it.
  const create = transitionOf('t-create');
  assert.deepEqual(create.control?.labels, ['Create Exam']);
  assert.equal(create.expectedApi.length, 0);
});

test('the endpoint a control ends up calling becomes the transition\'s API condition and drives its class', () => {
  const remove = transitionOf('t-remove');
  assert.deepEqual(remove.expectedApi, [{ method: 'DELETE', route: '/api/exams/{param}', expectStatus: null }]);
  assert.equal(remove.actionClass, 'DESTRUCTIVE');
  const create = transitionOf('t-create');
  // No endpoint traced: a button we cannot see the effect of is never a READ.
  assert.equal(create.actionClass, 'CLIENT_STATE_MUTATION');
});

test('a form submission is a server mutation', () => {
  const submitOnly = transitionOf('t-submit', { checkpoints: [
    mapped('transition:t-submit', 'fn-submit'),
  ] });
  assert.equal(submitOnly.actionClass, 'SERVER_MUTATION');
  assert.deepEqual(submitOnly.control?.labels, ['Save exam']);
  assert.equal(submitOnly.derivation, 'RESOLVED');
  assert.deepEqual(submitOnly.expectedApi, [{ method: 'POST', route: '/api/exams', expectStatus: null }]);
});

test('a link is a read and carries where it points', () => {
  const back = transitionOf('t-back');
  assert.equal(back.actionClass, 'READ');
  assert.equal(back.control?.href, '/courses/{param}');
  assert.equal(back.control?.element, 'a');
});

test('declared form inputs are carried through with the data key they resolve against', () => {
  const submit = transitionOf('t-submit');
  assert.deepEqual(submit.inputs, [
    { name: 'title', label: 'Title', dataKey: 'examTitle' },
    { name: 'dueDate', label: null, dataKey: 'dueDate' },
  ]);
});

test('a checkpoint that never resolved yields an unresolved transition with no control, not a guess', () => {
  const missing = transitionOf('t-create', { checkpoints: [mapped('transition:t-create', null, null, 'UNRESOLVED')] });
  assert.equal(missing.derivation, 'UNRESOLVED');
  assert.equal(missing.control, null);
  const noCheckpoint = transitionOf('t-create', { checkpoints: [] });
  assert.equal(noCheckpoint.derivation, 'UNRESOLVED');
  assert.equal(noCheckpoint.control, null);
  assert.equal(noCheckpoint.actionClass, 'CLIENT_STATE_MUTATION', 'and the least-safe assumption stands');
});

test('a resolved mapping whose handler no control invokes is unresolved', () => {
  const orphan = transitionOf('t-create', { checkpoints: [mapped('transition:t-create', 'page-details')] });
  assert.equal(orphan.control, null);
  assert.equal(orphan.derivation, 'UNRESOLVED');
});

test('an ambiguous mapping stays ambiguous', () => {
  assert.equal(transitionOf('t-create', { checkpoints: [mapped('transition:t-create', 'fn-create', null, 'AMBIGUOUS')] }).derivation, 'AMBIGUOUS');
});

test('unsupported mappings are treated as unresolved', () => {
  assert.equal(transitionOf('t-create', { checkpoints: [mapped('transition:t-create', 'fn-create', null, 'UNSUPPORTED')] }).derivation, 'UNRESOLVED');
});

test('a transition with an endpoint of a state that does not exist is dropped', () => {
  const contract = compileExecutableContract(input({ flow: { ...flow, transitions: [...flow.transitions, { id: 't-ghost', fromNodeId: 's-details', toNodeId: 'nope' }] } }));
  assert.ok(!contract.transitions.some((t) => t.id === 't-ghost'));
});

test('code references point back at the mapped source', () => {
  const create = transitionOf('t-create', { checkpoints: [mapped('transition:t-create', 'fn-create', 'app/courses/[id]/page.tsx')] });
  // The mapping gave no symbol, so the mapped entity's own name stands in for it.
  assert.deepEqual(create.codeRefs, [{ file: 'app/courses/[id]/page.tsx', symbol: 'handleCreateExam', entityId: 'fn-create' }]);
});
