import assert from 'node:assert/strict';
import test from 'node:test';
import { performStep, resolveStep } from './act';
import { control, element, snapshot } from './test-fixtures';
import type { AutomationAction } from './types';

const data: Record<string, { value: string; secret: boolean }> = { title: { value: 'Automated QA Exam', secret: false } };

test('resolving fails without touching the page when the code gave no control', () => {
  const result = resolveStep(snapshot(), { control: null, inputs: [], data: () => undefined, label: 'Create Exam' });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, 'NO_DERIVED_CONTROL');
});

test('resolving finds the control and reports how it was matched', () => {
  const page = snapshot({ elements: [element({ ref: 'a', name: 'Create Exam' })] });
  const result = resolveStep(page, { control: control({ labels: ['Create Exam'] }), inputs: [], data: () => undefined, label: 'Create Exam' });
  assert.ok(result.ok);
  if (result.ok) {
    assert.equal(result.controlRef, 'a');
    // The descriptor names no element kind, so an exact-name match is accepted as ROLE_NAME rather than downgraded to TEXT.
    assert.equal(result.method, 'ROLE_NAME');
    assert.deepEqual(result.fills, []);
  }
});

test('ambiguous and not-found controls are distinct failures', () => {
  const twoMatches = snapshot({ elements: [element({ ref: 'a', name: 'Save' }), element({ ref: 'b', name: 'Save' })] });
  const ambiguous = resolveStep(twoMatches, { control: control({ labels: ['Save'] }), inputs: [], data: () => undefined, label: 'Save' });
  assert.equal(!ambiguous.ok && ambiguous.reason, 'CONTROL_AMBIGUOUS');

  const notFound = resolveStep(snapshot(), { control: control({ labels: ['Save'] }), inputs: [], data: () => undefined, label: 'Save' });
  assert.equal(!notFound.ok && notFound.reason, 'CONTROL_NOT_FOUND');
});

test('a missing data value is caught before the control is even relevant', () => {
  const page = snapshot({ elements: [element({ ref: 'a', name: 'Save' }), element({ ref: 't', fieldName: 'title', label: 'Title' })] });
  const result = resolveStep(page, { control: control({ labels: ['Save'] }), inputs: [{ name: 'title', label: 'Title', dataKey: 'title' }], data: () => undefined, label: 'Save' });
  assert.equal(!result.ok && result.reason, 'DATA_UNAVAILABLE');
});

test('a field the page does not have is reported distinctly from missing data', () => {
  const page = snapshot({ elements: [element({ ref: 'a', name: 'Save' })] });
  const result = resolveStep(page, { control: control({ labels: ['Save'] }), inputs: [{ name: 'title', label: 'Title', dataKey: 'title' }], data: (key) => data[key], label: 'Save' });
  assert.equal(!result.ok && result.reason, 'FIELD_NOT_FOUND');
});

test('resolving a form fill matches by field name or label, case- and punctuation-insensitively', () => {
  const page = snapshot({ elements: [element({ ref: 'a', name: 'Save', testId: 'save' }), element({ ref: 't', fieldName: 'Title', tag: 'input' })] });
  const result = resolveStep(page, { control: control({ testId: 'save' }), inputs: [{ name: 'title', label: null, dataKey: 'title' }], data: (key) => data[key], label: 'Save' });
  assert.ok(result.ok);
  if (result.ok) assert.deepEqual(result.fills, [{ ref: 't', value: 'Automated QA Exam', secret: false, control: 'TEXT' }]);
});

test('performing a resolved step fills in order, then clicks', async () => {
  const actions: AutomationAction[] = [];
  const ports = { act: async (action: AutomationAction) => { actions.push(action); return { ok: true }; } };
  const resolved = { ok: true as const, controlRef: 'btn', method: 'TEXT', score: 0.5, fills: [{ ref: 't', value: 'x', secret: false }] };
  const result = await performStep(ports, resolved);
  assert.equal(result.ok, true);
  assert.deepEqual(actions, [{ kind: 'FILL', ref: 't', value: 'x', secret: false }, { kind: 'CLICK', ref: 'btn' }]);
});

test('a failed fill stops before the click, and reports which stage failed', async () => {
  const actions: AutomationAction[] = [];
  const ports = { act: async (action: AutomationAction) => { actions.push(action); return action.kind === 'FILL' ? { ok: false, error: 'no such field' } : { ok: true }; } };
  const resolved = { ok: true as const, controlRef: 'btn', method: 'TEXT', score: 0.5, fills: [{ ref: 't', value: 'x', secret: false }] };
  const result = await performStep(ports, resolved);
  assert.deepEqual(result, { ok: false, stage: 'FILL', error: 'no such field' });
  assert.deepEqual(actions, [{ kind: 'FILL', ref: 't', value: 'x', secret: false }]);
});

test('a failed click is reported as its own stage', async () => {
  const ports = { act: async () => ({ ok: false, error: 'detached' }) };
  const resolved = { ok: true as const, controlRef: 'btn', method: 'TEXT', score: 0.5, fills: [] };
  assert.deepEqual(await performStep(ports, resolved), { ok: false, stage: 'CLICK', error: 'detached' });
});
