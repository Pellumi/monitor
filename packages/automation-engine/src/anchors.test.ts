import assert from 'node:assert/strict';
import test from 'node:test';
import { anchorValueFor, appliedAnchors, controlAnchorTargets } from './anchors';
import { compileExecutableContract } from './contract';
import type { CompileInput } from './contract';
import { rankControls } from './ranking';
import { element } from './test-fixtures';

const input = (extra: Partial<CompileInput> = {}, actions = 1): CompileInput => ({
  flowVersionId: 'v1',
  flow: {
    states: [{ id: 's-a', stateName: 'A', role: 'INITIAL' }, { id: 's-b', stateName: 'B', role: 'TERMINAL' }],
    transitions: [{ id: 't-go', fromStateId: 's-a', toStateId: 's-b', action: 'Create Exam' }],
  },
  checkpoints: [{ id: 'transition:t-go', mapping: { status: 'RESOLVED', entityId: 'handler', file: 'src/Course.tsx', symbol: 'create' } }],
  code: {
    entities: [
      { id: 'handler', type: 'function', name: 'create', path: 'src/Course.tsx', metadata: {} },
      ...Array.from({ length: actions }, (_, index) => ({
        id: `button-${index}`, type: 'ui_action', name: `btn${index}`, path: 'src/Course.tsx', startLine: 40 + index * 5, endLine: 42 + index * 5,
        metadata: { labels: ['Create Exam'], element: 'button', event: 'onClick' },
      })),
    ],
    relationships: Array.from({ length: actions }, (_, index) => ({ source: `button-${index}`, target: 'handler', type: 'ROUTES_TO', confidence: 1 })),
  },
  ...extra,
});

test('a transition with one control records where that control is in source', () => {
  const contract = compileExecutableContract(input());
  assert.deepEqual(contract.transitions[0]!.controlSource, { file: 'src/Course.tsx', startLine: 40, endLine: 42, element: 'button' });
});

test('a handler behind two controls has no single element to anchor, so none is claimed', () => {
  assert.equal(compileExecutableContract(input({}, 2)).transitions[0]!.controlSource, null);
});

test('a transition with no control found has no source and no anchor', () => {
  const none = input();
  none.code = { entities: [none.code.entities[0]!], relationships: [] };
  const contract = compileExecutableContract({ ...none, anchors: { 't-go': 'tellann:t-go' } });
  assert.equal(contract.transitions[0]!.controlSource, null);
  assert.equal(contract.transitions[0]!.control, null, 'an anchor is never a reason to invent a control');
});

test('targets are made from the contract, with a value that depends only on the transition', () => {
  const targets = controlAnchorTargets(compileExecutableContract(input()));
  assert.deepEqual(targets, [{
    transitionId: 't-go', value: 'tellann:t-go', file: 'src/Course.tsx', startLine: 40, endLine: 42, element: 'button', label: 'Create Exam',
  }]);
  assert.equal(anchorValueFor('t-go'), anchorValueFor('t-go'));
  assert.notEqual(anchorValueFor('a'), anchorValueFor('b'));
});

test('an id that is not attribute-safe is reduced to something that is, and stays deterministic', () => {
  const value = anchorValueFor('transition:9f1c/2 weird"id');
  assert.match(value, /^[A-Za-z0-9:_.-]{1,120}$/);
  assert.equal(value, anchorValueFor('transition:9f1c/2 weird"id'));
  assert.ok(anchorValueFor('x'.repeat(500)).length <= 120);
});

test('an applied anchor becomes the control\'s anchor, and only for a transition that has a control', () => {
  const anchors = { 't-go': anchorValueFor('t-go') };
  const contract = compileExecutableContract(input({ anchors }));
  assert.equal(contract.transitions[0]!.control!.actionAnchor, 'tellann:t-go');
  assert.equal(compileExecutableContract(input()).transitions[0]!.control!.actionAnchor, null, 'without an applied anchor there is none');
});

test('an anchored control is found after its text is reworded; an unanchored one is not', () => {
  const anchored = compileExecutableContract(input({ anchors: { 't-go': 'tellann:t-go' } })).transitions[0]!.control!;
  const plain = compileExecutableContract(input()).transitions[0]!.control!;
  // The page after someone renamed the button, and changed its role and test id.
  const reworded = [element({ ref: 'r', name: 'New assessment', role: 'button', actionAnchor: 'tellann:t-go' })];
  const withAnchor = rankControls(anchored, reworded);
  assert.equal(withAnchor.best?.element.ref, 'r');
  assert.equal(withAnchor.best?.method, 'ACTION_ANCHOR');
  assert.equal(rankControls(plain, reworded).best, null, 'the label no longer matches, and nothing else does');
});

test('an anchor outranks a label match on a different control', () => {
  const control = compileExecutableContract(input({ anchors: { 't-go': 'tellann:t-go' } })).transitions[0]!.control!;
  const page = [
    element({ ref: 'decoy', name: 'Create Exam', role: 'button' }),
    element({ ref: 'real', name: 'Start something else', role: 'button', actionAnchor: 'tellann:t-go' }),
  ];
  const ranked = rankControls(control, page);
  assert.equal(ranked.best?.element.ref, 'real');
  assert.equal(ranked.ambiguous, false);
});

test('a control that carries somebody else\'s anchor is not taken for ours', () => {
  const control = compileExecutableContract(input({ anchors: { 't-go': 'tellann:t-go' } })).transitions[0]!.control!;
  const ranked = rankControls(control, [element({ ref: 'x', name: 'Create Exam', role: 'button', actionAnchor: 'tellann:another' })]);
  assert.notEqual(ranked.best?.method, 'ACTION_ANCHOR');
});

test('applied anchors are read from the operations of a plan, and only the anchor ones', () => {
  const plan = {
    operations: [
      { id: 'package-sdk', transformId: 'tellann.package-json.dependency' },
      { id: 'anchor:t-go', transformId: 'tellann.action.anchor', anchorAttribute: { value: 'tellann:t-go' } },
      { id: 'anchor:broken', transformId: 'tellann.action.anchor', anchorAttribute: null },
      { id: 'other:x', transformId: 'tellann.action.anchor', anchorAttribute: { value: 'tellann:x' } },
    ],
  };
  assert.deepEqual(appliedAnchors(plan), { 't-go': 'tellann:t-go' });
  assert.deepEqual(appliedAnchors(null), {});
  assert.deepEqual(appliedAnchors({ operations: [] }), {});
});
