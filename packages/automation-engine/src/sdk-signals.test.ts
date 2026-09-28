import assert from 'node:assert/strict';
import test from 'node:test';
import { compileExecutableContract } from './contract';
import { recognize } from './recognizer';
import { FLOW_STATE_MARKER_EVENTS, SdkSignalBuffer, canonicalStateKey, resolveMarkerState, stateAliasesOf } from './sdk-signals';
import { snapshot } from './test-fixtures';

const states = [
  { id: 's-course', stateName: 'Course Details', behaviorKey: 'course_details' },
  { id: 's-form', stateName: 'Exam Form' },
  { id: 's-created', stateId: 'state-created-7', name: 'Exam Created' },
];
const aliases = stateAliasesOf(states);

test('a state answers to its key, its name and its id, all as the one canonical key', () => {
  assert.equal(aliases.course_details, 'course_details');
  assert.equal(aliases.s_course, 'course_details');
  assert.equal(aliases.exam_form, 'exam_form');
  assert.equal(aliases.s_form, 'exam_form');
  assert.equal(aliases.exam_created, 'exam_created');
  assert.equal(aliases.state_created_7, 'exam_created', 'the separate stateId is an alias too');
});

test('the canonical key is what the boundary evaluator would derive: behaviorKey, then name', () => {
  assert.equal(canonicalStateKey({ id: 'x', stateName: 'Course Details', behaviorKey: 'course_details' }), 'course_details');
  assert.equal(canonicalStateKey({ id: 'x', stateName: 'Exam Form' }), 'exam_form');
  assert.equal(canonicalStateKey({ id: 'X-1' }), 'x_1');
});

test('the first state to claim a name keeps it', () => {
  const claimed = stateAliasesOf([{ id: 'a', stateName: 'Shared' }, { id: 'b', stateName: 'Other', behaviorKey: 'other', name: 'Shared' }]);
  assert.equal(claimed.shared, 'shared', 'not stolen by the second state, whose own key is "other"');
  assert.equal(claimed.other, 'other');
});

test('the three shapes a marker can take all resolve to the same state', () => {
  // The SDK's typed calls.
  assert.equal(resolveMarkerState(aliases, { flowVersionId: 'v1', stateKey: 'Exam Form' }), 'exam_form');
  // A hand-written slug marker.
  assert.equal(resolveMarkerState(aliases, { flow: 'lms-flow', state: 'exam-form' }), 'exam_form');
  // What instrumentation adapters write: the state's id, and no flow at all.
  assert.equal(resolveMarkerState(aliases, { stateId: 's-form', checkpointId: 'c1', source: 'tellann-adapter', transitionId: null }), 'exam_form');
  assert.equal(resolveMarkerState(aliases, { stateId: 'state-created-7', source: 'tellann-adapter' }), 'exam_created');
});

test('a transition marker names the state it arrives in, not the one it left', () => {
  assert.equal(resolveMarkerState(aliases, { fromStateKey: 'course_details', toStateKey: 'exam_form', action: 'Create Exam' }), 'exam_form');
  assert.equal(resolveMarkerState(aliases, { stateKey: 'exam_form', fromStateKey: 'course_details', toStateKey: 'exam_form' }), 'exam_form');
});

test('fields are read in the order the desktop and the evaluator read them', () => {
  assert.equal(resolveMarkerState(aliases, { stateKey: 'course_details', toStateKey: 'exam_form', state: 'exam_created', stateId: 's-form' }), 'course_details');
  assert.equal(resolveMarkerState(aliases, { stateKey: '  ', toStateKey: 'exam_form', state: 'exam_created' }), 'exam_form', 'blank is not a name');
  assert.equal(resolveMarkerState(aliases, { state: 'exam_created', stateId: 's-form' }), 'exam_created');
});

test('a marker that names nothing resolves to nothing, and an unknown name is kept as itself', () => {
  assert.equal(resolveMarkerState(aliases, {}), null);
  assert.equal(resolveMarkerState(aliases, { stateId: null, state: '' }), null);
  assert.equal(resolveMarkerState(aliases, { stateKey: '!!!' }), null);
  assert.equal(resolveMarkerState(aliases, { stateKey: 'Somewhere Else' }), 'somewhere_else', 'refused later as unknown, exactly as the evaluator does');
});

test('only the events that assert a state are markers', () => {
  assert.deepEqual([...FLOW_STATE_MARKER_EVENTS], ['FLOW_INITIAL_STATE', 'FLOW_STATE_REACHED', 'FLOW_TRANSITION', 'FLOW_TERMINAL_STATE']);
});

test('the buffer holds what was seen since the last action, in the canonical vocabulary', () => {
  const buffer = new SdkSignalBuffer(aliases);
  assert.deepEqual(buffer.states(), []);
  assert.equal(buffer.observe({ stateId: 's-form' }), 'exam_form');
  assert.equal(buffer.observe({}), null, 'a marker that names nothing adds nothing');
  buffer.observe({ state: 'exam-created' });
  assert.deepEqual(buffer.states(), ['exam_form', 'exam_created']);
  buffer.reset();
  assert.deepEqual(buffer.states(), []);
  buffer.states().push('tamper');
  assert.deepEqual(buffer.states(), [], 'callers get a copy');
});

test('the contract carries the aliases of the Flow it was compiled from', () => {
  const contract = compileExecutableContract({
    flowVersionId: 'v1',
    flow: {
      states: [{ id: 's-a', stateName: 'Alpha', role: 'INITIAL' }, { id: 's-b', stateName: 'Beta', role: 'TERMINAL' }],
      transitions: [{ id: 't', fromStateId: 's-a', toStateId: 's-b' }],
    },
    checkpoints: [],
    code: { entities: [], relationships: [] },
  });
  assert.deepEqual(contract.stateAliases, { alpha: 'alpha', s_a: 'alpha', beta: 'beta', s_b: 'beta' });
});

test('an adapter marker is recognised as the state it names, which by text alone it would not be', () => {
  const contract = compileExecutableContract({
    flowVersionId: 'v1',
    flow: { states: [{ id: 's-form', stateName: 'Exam Form', role: 'INITIAL' }], transitions: [] },
    checkpoints: [],
    code: { entities: [], relationships: [] },
  });
  const form = contract.states[0]!;
  const view = (sdkStates: string[]) => snapshot({ path: '/anywhere', sdkStates });

  // Comparing the adapter's raw stateId with the contract's key: a conflict, not a match.
  assert.notEqual(recognize(view(['s-form']), form).evidence.sdk, 'MATCH');

  // Through the buffer, it is the state it names.
  const buffer = new SdkSignalBuffer(contract.stateAliases!);
  buffer.observe({ stateId: 's-form', checkpointId: 'c', source: 'tellann-adapter' });
  const recognition = recognize(view(buffer.states()), form);
  assert.equal(recognition.evidence.sdk, 'MATCH');
  assert.equal(recognition.stateKey, 'exam_form');
});
