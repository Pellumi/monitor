import assert from 'node:assert/strict';
import test from 'node:test';
import { flowRequiresPatch, inputsOfEdges, stateSpecPatch, transitionSpecPatch } from './flow-spec-data';

test('a field that is absent is left alone, null clears it, a value replaces it', () => {
  assert.deepEqual(stateSpecPatch({ stateName: 'X' }), {});
  assert.deepEqual(stateSpecPatch({ recognizer: null }), { recognizer: null });
  assert.deepEqual(stateSpecPatch({ recognizer: { routes: ['/Courses/:id'] } }), { recognizer: { routes: ['/courses/{param}'], headings: [], texts: [] } });
  assert.deepEqual(stateSpecPatch({ recognizer: { routes: ['nonsense'] } }), { recognizer: null }, 'something unusable clears rather than stores');
  assert.deepEqual(transitionSpecPatch({ action: 'X' }).patch, {});
});

test('a sub-flow can be named by id or by name', () => {
  assert.deepEqual(stateSpecPatch({ subFlowId: '0b5d8a3e-7f06-4e6e-9a54-3c4a6a1f0c11' }), { subFlow: { flowId: '0b5d8a3e-7f06-4e6e-9a54-3c4a6a1f0c11' } });
  assert.deepEqual(stateSpecPatch({ subFlow: { name: 'SIGN_IN' } }), { subFlow: { name: 'SIGN_IN' } });
  assert.deepEqual(stateSpecPatch({ subFlowId: null }), { subFlow: null });
});

test('transition fields are cleaned, and an empty list clears', () => {
  const { patch, invalid } = transitionSpecPatch({
    control: { role: 'anchor', label: 'Courses' },
    inputs: [{ name: 'Password' }, { name: 'Course title', role: 'GENERATED' }],
    effects: ['POST /api/courses -> 201'],
    mode: 'confirm',
  });
  assert.deepEqual(invalid, []);
  assert.deepEqual(patch.control, { role: 'link', label: 'Courses' });
  assert.deepEqual(patch.inputs?.map((input) => `${input.name}:${input.role}`), ['Password:PROTECTED', 'Course title:GENERATED']);
  assert.deepEqual(patch.effects, [{ method: 'POST', route: '/api/courses', status: 201 }]);
  assert.equal(patch.mode, 'CONFIRM');
  assert.deepEqual(transitionSpecPatch({ inputs: [], effects: [], control: null }).patch, { inputs: null, effects: null, control: null });
});

test('an unknown mode is refused, never quietly made AUTO', () => {
  const { patch, invalid } = transitionSpecPatch({ mode: 'sometimes' });
  assert.deepEqual(invalid, ['mode']);
  assert.equal(patch.mode, undefined);
});

test('requirements are completed from what the flow types', () => {
  const inputs = inputsOfEdges([{ expectedInput: [{ name: 'Password', dataKey: 'ADMIN_PASSWORD' }] }, { expectedInput: null }]);
  assert.deepEqual(flowRequiresPatch({ requires: { actor: 'admin' } }, inputs), { actor: 'ADMIN', environments: [], data: ['ADMIN_PASSWORD'] });
  assert.equal(flowRequiresPatch({ requires: null }), null);
  assert.equal(flowRequiresPatch({}), undefined);
});
