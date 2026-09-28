import assert from 'node:assert/strict';
import test from 'node:test';
import { canonicalPattern, normalizeStateKey, normalizeText, patternSpecificity, pathOnly, routeMatches } from './keys';

test('state keys match the boundary evaluator exactly', () => {
  // Reference values produced by `normalizeQaFlowKey` in packages/db/src/qa-flow-boundary.ts.
  // If the evaluator's normalisation ever changes, these change with it, on purpose: a
  // recognizer that named a state differently from the evaluator would report states it cannot accept.
  const reference: Array<[unknown, string]> = [
    ['COURSE_DETAILS', 'course_details'],
    ['Course Details', 'course_details'],
    ['  exam-created ', 'exam_created'],
    ['Exam__Created!', 'exam_created'],
    ['ÉXAM créé', 'xam_cr'],
    ['__x__', 'x'],
    ['', ''],
    [null, ''],
    [undefined, ''],
    ['CREATE EXAM (v2)', 'create_exam_v2'],
    ['123 Go', '123_go'],
  ];
  for (const [input, expected] of reference) assert.equal(normalizeStateKey(input), expected, String(input));
});

test('route patterns match concrete paths, one segment per parameter', () => {
  assert.equal(routeMatches('/courses/{param}', '/courses/17'), true);
  assert.equal(routeMatches('/courses/[id]', '/courses/17'), true, 'Next.js spelling');
  assert.equal(routeMatches('/courses/:courseId/exams', 'http://localhost:3000/courses/7/exams?draft=1'), true);
  assert.equal(routeMatches('/courses/{param}', '/courses/17/exams'), false, 'a parameter is one segment');
  assert.equal(routeMatches('/courses/{param}', '/courses/'), false, 'a parameter is not empty');
  assert.equal(routeMatches('/courses/new', '/courses/17'), false);
  assert.equal(routeMatches('/', '/'), true);
  assert.equal(routeMatches('/Courses', '/courses'), true, 'case-insensitive like the canonicaliser');
});

test('a literal segment is more specific than a parameter', () => {
  assert.ok(patternSpecificity('/courses/new') > patternSpecificity('/courses/{param}'));
  assert.equal(canonicalPattern('/orders/<int:pk>/'), '/orders/{param}');
  assert.equal(pathOnly('https://x.test/a/b/?q=1#h'), '/a/b');
});

test('label comparison ignores case, punctuation and spacing', () => {
  assert.equal(normalizeText('  Create   Exam! '), 'create exam');
  assert.equal(normalizeText(null), '');
});
