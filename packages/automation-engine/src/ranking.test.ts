import assert from 'node:assert/strict';
import test from 'node:test';
import { ACCEPTANCE_THRESHOLD, rankControls } from './ranking';
import { control, element } from './test-fixtures';

test('an instrumented anchor beats every other kind of evidence', () => {
  const descriptor = control({ labels: ['Create Exam'], testId: 'create', actionAnchor: 'CREATE_EXAM' });
  const result = rankControls(descriptor, [
    element({ ref: 'plain', name: 'Create Exam' }),
    element({ ref: 'tid', testId: 'create', name: 'x' }),
    element({ ref: 'anchor', actionAnchor: 'CREATE_EXAM', name: 'Add Assessment' }),
  ]);
  assert.equal(result.best?.element.ref, 'anchor');
  assert.equal(result.best?.method, 'ACTION_ANCHOR');
});

test('the anchor survives a label rename, which is the point of instrumenting it', () => {
  const result = rankControls(control({ labels: ['Create Exam'], actionAnchor: 'CREATE_EXAM' }), [
    element({ ref: 'renamed', actionAnchor: 'CREATE_EXAM', name: 'Add Assessment' }),
  ]);
  assert.equal(result.best?.element.ref, 'renamed');
});

test('test id beats accessible name; accessible name on the right element beats a bare label', () => {
  const byTestId = rankControls(control({ labels: ['Save'], testId: 'save' }), [
    element({ ref: 'a', name: 'Save' }), element({ ref: 'b', testId: 'save', name: 'Persist' }),
  ]);
  assert.equal(byTestId.best?.element.ref, 'b');

  const roleFits = rankControls(control({ labels: ['Save'], element: 'button' }), [
    element({ ref: 'link', tag: 'a', role: 'link', name: 'Save' }),
    element({ ref: 'btn', tag: 'button', role: 'button', name: 'Save' }),
  ]);
  assert.equal(roleFits.best?.element.ref, 'btn');
  assert.equal(roleFits.best?.method, 'ROLE_NAME');
  assert.equal(roleFits.candidates.find((c) => c.element.ref === 'link')?.method, 'LABEL');
});

test('names compare without regard to case or punctuation', () => {
  const result = rankControls(control({ labels: ['Create Exam'] }), [element({ ref: 'a', name: 'create  exam!' })]);
  assert.equal(result.best?.element.ref, 'a');
});

test('a partial text match is weaker and only used for names long enough to mean something', () => {
  const partial = rankControls(control({ labels: ['Create Exam'] }), [element({ ref: 'a', name: 'Create Exam for this course' })]);
  assert.equal(partial.best?.method, 'TEXT');
  const short = rankControls(control({ labels: ['Go'] }), [element({ ref: 'a', name: 'Go to dashboard' })]);
  assert.equal(short.best, null, 'two letters is not evidence');
});

test('hidden and disabled controls are reported but never chosen', () => {
  const result = rankControls(control({ labels: ['Create Exam'] }), [
    element({ ref: 'hidden', name: 'Create Exam', visible: false }),
    element({ ref: 'off', name: 'Create Exam', enabled: false }),
  ]);
  assert.equal(result.best, null);
  assert.equal(result.unusable.length, 2);
});

test('two different elements matching equally is ambiguous, not a coin flip', () => {
  const result = rankControls(control({ labels: ['Create Exam'] }), [
    element({ ref: 'top', name: 'Create Exam' }), element({ ref: 'bottom', name: 'Create Exam' }),
  ]);
  assert.equal(result.ambiguous, true);
  assert.equal(result.best, null);
  assert.equal(result.candidates.length, 2);
});

test('a link is found by where it points', () => {
  const result = rankControls(control({ href: '/courses/{param}' }), [
    element({ ref: 'a', tag: 'a', role: 'link', href: 'http://localhost:3000/courses/9', name: 'Algebra' }),
  ]);
  assert.equal(result.best?.method, 'HREF');
});

test('an id alone is structural: reported, but below the acceptance threshold', () => {
  const result = rankControls(control({ domId: 'btn-1' }), [element({ ref: 'a', domId: 'btn-1', name: 'x' })]);
  assert.equal(result.candidates[0]?.method, 'STRUCTURAL');
  assert.ok(result.candidates[0]!.score < ACCEPTANCE_THRESHOLD);
  assert.equal(result.best, null);
});

test('nothing on the page matches', () => {
  const result = rankControls(control({ labels: ['Create Exam'] }), [element({ ref: 'a', name: 'Logout' })]);
  assert.deepEqual([result.best, result.ambiguous, result.candidates.length], [null, false, 0]);
});
