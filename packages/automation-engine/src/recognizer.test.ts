import assert from 'node:assert/strict';
import test from 'node:test';
import { recognize, recognizeAmong } from './recognizer';
import { control, element, snapshot, state } from './test-fixtures';

const details = state({
  key: 'course_details',
  routePatterns: ['/courses/{param}'],
  requiredElements: [control({ labels: ['Students'] })],
  optionalElements: [control({ labels: ['Create Exam'] }), control({ labels: ['Materials'] })],
});

const onDetailsPage = () => snapshot({
  path: '/courses/7',
  elements: [element({ ref: 'a', name: 'Students' }), element({ ref: 'b', name: 'Create Exam' })],
});

test('an SDK signal, the route and the required elements together are high confidence', () => {
  const result = recognize({ ...onDetailsPage(), sdkStates: ['course_details'] }, details);
  assert.equal(result.confidence, 'HIGH');
  assert.equal(result.evidence.sdk, 'MATCH');
  assert.equal(result.evidence.route, 'MATCH');
  assert.equal(result.evidence.requiredPresent, 1);
  assert.equal(result.evidence.optionalPresent, 1);
});

test('without an SDK signal, two independent kinds of evidence agreeing is still high confidence', () => {
  const result = recognize(onDetailsPage(), details);
  assert.equal(result.evidence.sdk, 'ABSENT');
  assert.equal(result.confidence, 'HIGH');
});

test('a matching route on its own is only medium confidence', () => {
  const routeOnly = state({ key: 'course_details', routePatterns: ['/courses/{param}'], sdkStateSignals: [] });
  const result = recognize(snapshot({ path: '/courses/7' }), routeOnly);
  assert.equal(result.evidence.route, 'MATCH');
  assert.equal(result.confidence, 'MEDIUM');
});

test('a route that does not match is a contradiction, however good the elements look', () => {
  const result = recognize({ ...onDetailsPage(), path: '/dashboard' }, details);
  assert.equal(result.evidence.route, 'MISMATCH');
  assert.equal(result.confidence, 'LOW');
});

test('the application reporting a different state outranks a matching route', () => {
  // The DOM says course_details; the app's own SDK just said it is somewhere else.
  const result = recognize({ ...onDetailsPage(), sdkStates: ['exam_form'] }, details);
  assert.equal(result.evidence.sdk, 'CONFLICT');
  assert.equal(result.confidence, 'LOW');
});

test('a missing required element vetoes the state', () => {
  const result = recognize(snapshot({ path: '/courses/7', elements: [element({ ref: 'b', name: 'Create Exam' })] }), details);
  assert.equal(result.evidence.requiredPresent, 0);
  assert.equal(result.confidence, 'LOW');
});

test('hidden elements are not present', () => {
  const result = recognize(snapshot({ path: '/courses/7', elements: [element({ ref: 'a', name: 'Students', visible: false })] }), details);
  assert.equal(result.evidence.requiredPresent, 0);
});

test('a state with nothing to check against is never recognised', () => {
  const bare = state({ key: 'x', sdkStateSignals: [] });
  assert.equal(recognize(snapshot(), bare).confidence, 'LOW');
});

test('the SDK signal is compared on the normalised key', () => {
  const result = recognize(snapshot({ path: '/courses/7', sdkStates: ['Course Details'], elements: [element({ ref: 'a', name: 'Students' })] }), details);
  assert.equal(result.evidence.sdk, 'MATCH');
});

test('completed requests matching the expected API raise confidence; incomplete ones do not', () => {
  const created = state({ key: 'created', routePatterns: [], expectedApi: [{ method: 'POST', route: '/api/exams', expectStatus: 201 }] });
  const ok = recognize(snapshot({ requests: [{ method: 'post', route: '/api/exams', status: 201, completed: true }] }), created);
  assert.equal(ok.evidence.apiMatched, 1);
  const wrongStatus = recognize(snapshot({ requests: [{ method: 'POST', route: '/api/exams', status: 500, completed: true }] }), created);
  assert.equal(wrongStatus.evidence.apiMatched, 0);
  const pending = recognize(snapshot({ requests: [{ method: 'POST', route: '/api/exams', status: null, completed: false }] }), created);
  assert.equal(pending.evidence.apiMatched, 0);
});

test('recognising among states picks the best fit and reports when two fit equally', () => {
  const list = state({ key: 'course_list', routePatterns: ['/courses'], sdkStateSignals: [] });
  const one = recognizeAmong(snapshot({ path: '/courses/7', elements: [element({ ref: 'a', name: 'Students' })] }), [details, list]);
  assert.equal(one.best?.stateKey, 'course_details');
  assert.equal(one.ambiguous, false);

  const twinA = state({ key: 'a', routePatterns: ['/x/{param}'], sdkStateSignals: [] });
  const twinB = state({ key: 'b', routePatterns: ['/x/{param}'], sdkStateSignals: [] });
  assert.equal(recognizeAmong(snapshot({ path: '/x/1' }), [twinA, twinB]).ambiguous, true);
});

test('a more specific route wins over a parameter route that also matches', () => {
  const generic = state({ key: 'course_details', routePatterns: ['/courses/{param}'], sdkStateSignals: [] });
  const specific = state({ key: 'course_new', routePatterns: ['/courses/new'], sdkStateSignals: [] });
  const result = recognizeAmong(snapshot({ path: '/courses/new' }), [generic, specific]);
  assert.equal(result.best?.stateKey, 'course_new');
  assert.equal(result.ambiguous, false);
});

test('nothing recognised is not ambiguous', () => {
  const result = recognizeAmong(snapshot({ path: '/nowhere' }), [details]);
  assert.equal(result.best, null);
  assert.equal(result.ambiguous, false);
});
