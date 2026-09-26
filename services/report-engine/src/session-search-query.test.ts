import assert from 'node:assert/strict';
import test from 'node:test';
import { Prisma } from '@tellann/db';
import {
  buildClauses,
  decodeCursor,
  encodeCursor,
  likePattern,
  queryBool,
  queryInt,
  queryInts,
  queryList,
  type SessionSearchFilters,
} from './session-search-query';

function filters(overrides: Partial<SessionSearchFilters> = {}): SessionSearchFilters {
  return { applicationId: 'app-1', environmentId: 'env-1', limit: 20, ...overrides };
}

/** The rendered SQL of a clause set, for asserting which predicate was produced. */
function sqlOf(clauses: Prisma.Sql[]): string {
  return Prisma.join(clauses, ' AND ').strings.join('?');
}

function valuesOf(clauses: Prisma.Sql[]): unknown[] {
  return Prisma.join(clauses, ' AND ').values;
}

// ─── Scope is never optional ──────────────────────────────────────────────────

test('every query is scoped to the application from the path', () => {
  const clauses = buildClauses(filters());
  assert.match(sqlOf(clauses), /"applicationId" = /);
  assert.ok(valuesOf(clauses).includes('app-1'));
});

test('an environment scope is applied when one is resolved', () => {
  // Without it, development, staging and production sessions interleave with nothing on
  // the row to tell them apart -- which is why every sibling endpoint scopes too.
  assert.match(sqlOf(buildClauses(filters())), /"environmentId" = /);
  assert.doesNotMatch(sqlOf(buildClauses(filters({ environmentId: null }))), /"environmentId" = /);
});

// ─── Each filter, in isolation ────────────────────────────────────────────────

test('an end-user filter matches the terminal identity or anyone seen in the session', () => {
  // Session.endUserId is the LAST identity asserted. A user who signed out halfway
  // through was still there, and that session is exactly the one a support engineer is
  // looking for -- so the array is checked too.
  const sql = sqlOf(buildClauses(filters({ endUser: 'user-1' })));
  assert.match(sql, /"endUserId" = /);
  assert.match(sql, /"endUserIds" @> ARRAY/);
});

test('presence filters use array containment, which is what the GIN indexes answer', () => {
  for (const [key, column] of [
    ['eventType', 'eventTypes'],
    ['stateName', 'stateNames'],
    ['workflowName', 'workflowNames'],
    ['route', 'routes'],
  ] as const) {
    const sql = sqlOf(buildClauses(filters({ [key]: ['X'] } as any)));
    assert.match(sql, new RegExp(`"${column}" @> `), key);
  }
});

test('a status class reads the precomputed maximum rather than scanning the array', () => {
  assert.match(sqlOf(buildClauses(filters({ statusClass: '5xx' }))), /"maxStatusCode" >= 500/);
  assert.match(sqlOf(buildClauses(filters({ statusClass: '4xx' }))), /"maxStatusCode" BETWEEN 400 AND 499/);
});

test('abandoned and hasError distinguish false from absent', () => {
  // `false` is a real filter ("show me the ones that finished"), not the same as not
  // filtering at all. A truthiness check would collapse the two.
  assert.match(sqlOf(buildClauses(filters({ abandoned: true }))), /"abandoned" = TRUE/);
  assert.match(sqlOf(buildClauses(filters({ abandoned: false }))), /"abandoned" = FALSE/);
  assert.doesNotMatch(sqlOf(buildClauses(filters())), /"abandoned"/);

  assert.match(sqlOf(buildClauses(filters({ hasError: true }))), /"errorCount" > 0/);
  assert.match(sqlOf(buildClauses(filters({ hasError: false }))), /"errorCount" = 0/);
});

test('free text uses websearch_to_tsquery, which cannot be made to throw', () => {
  // to_tsquery raises on malformed input, so a typo in a search box would be a 500.
  // websearch_to_tsquery accepts whatever a person types.
  assert.match(sqlOf(buildClauses(filters({ q: 'checkout "credit card" -test' }))), /websearch_to_tsquery/);
});

test('a duration range produces two bounded comparisons', () => {
  const sql = sqlOf(buildClauses(filters({ minDurationMs: 1_000, maxDurationMs: 60_000 })));
  assert.match(sql, /"durationMs" >= /);
  assert.match(sql, /"durationMs" <= /);
});

// ─── Combination ──────────────────────────────────────────────────────────────

test('filters combine with AND, so each one narrows', () => {
  const clauses = buildClauses(filters({
    endUser: 'user-1',
    hasError: true,
    stateName: ['EXAM_CREATE'],
    deviceType: ['mobile'],
    abandoned: true,
  }));
  const sql = sqlOf(clauses);
  assert.ok(clauses.length >= 6, 'application, environment and each filter');
  assert.match(sql, /"endUserId" = /);
  assert.match(sql, /"errorCount" > 0/);
  assert.match(sql, /"stateNames" @> /);
  assert.match(sql, /"deviceType" = ANY/);
  assert.match(sql, /"abandoned" = TRUE/);
});

test('no filters means scope only, not an empty WHERE', () => {
  // An empty clause list would render `WHERE ` and fail to parse.
  assert.equal(buildClauses(filters({ environmentId: null })).length, 1);
});

// ─── Injection and escaping ───────────────────────────────────────────────────

test('user text is parameterised, never interpolated', () => {
  const hostile = "'; DROP TABLE \"Session\"; --";
  const clauses = buildClauses(filters({ endUser: hostile, errorContains: hostile }));
  assert.doesNotMatch(sqlOf(clauses), /DROP TABLE/);
  assert.ok(valuesOf(clauses).includes(hostile), 'it travels as a bound value');
});

test('a percent in a search term is a literal percent, not a wildcard', () => {
  // Otherwise searching for "100%" matches everything.
  assert.equal(likePattern('100%'), '%100\\%%');
  assert.equal(likePattern('a_b'), '%a\\_b%');
  assert.equal(likePattern('back\\slash'), '%back\\\\slash%');
});

// ─── Cursor ───────────────────────────────────────────────────────────────────

test('a cursor round-trips', () => {
  const startTime = new Date('2026-09-29T12:00:00.000Z');
  const decoded = decodeCursor(encodeCursor({ startTime, id: 'session-1' }));
  assert.equal(decoded?.sessionId, 'session-1');
  assert.equal(decoded?.startTime.toISOString(), startTime.toISOString());
});

test('a malformed cursor is ignored rather than throwing', () => {
  // A stale or hand-edited cursor must degrade to the first page, not a 500.
  assert.equal(decodeCursor('not-base64!!'), null);
  assert.equal(decodeCursor(Buffer.from('{}', 'utf8').toString('base64url')), null);
  assert.equal(decodeCursor(Buffer.from('["nope","x"]', 'utf8').toString('base64url')), null);
});

test('the cursor is a tuple, because startTime alone is not unique', () => {
  // Two sessions completing in the same millisecond is routine under load. A cursor on
  // startTime alone would skip one of them or return it twice.
  const at = new Date('2026-09-29T12:00:00.000Z');
  assert.notEqual(encodeCursor({ startTime: at, id: 'a' }), encodeCursor({ startTime: at, id: 'b' }));
});

// ─── Query-string coercion ────────────────────────────────────────────────────

test('a list accepts repetition or a comma-separated value', () => {
  assert.deepEqual(queryList('a,b,c'), ['a', 'b', 'c']);
  assert.deepEqual(queryList(['a', 'b']), ['a', 'b']);
  assert.deepEqual(queryList(' a , , b '), ['a', 'b'], 'blanks dropped');
  assert.equal(queryList(''), undefined);
  assert.equal(queryList(undefined), undefined);
});

test('a list is capped, so a hostile query cannot build an unbounded array literal', () => {
  const huge = Array.from({ length: 500 }, (_, i) => `v${i}`);
  assert.equal(queryList(huge)?.length, 50);
});

test('integers drop what is not a number instead of producing NaN', () => {
  assert.deepEqual(queryInts('404,500,abc'), [404, 500]);
  assert.equal(queryInts('abc'), undefined);
  assert.equal(queryInt('42'), 42);
  assert.equal(queryInt('abc'), undefined);
  assert.equal(queryInt(''), undefined);
});

test('a boolean distinguishes false from unset', () => {
  assert.equal(queryBool('true'), true);
  assert.equal(queryBool('1'), true);
  assert.equal(queryBool('false'), false);
  assert.equal(queryBool('0'), false);
  assert.equal(queryBool(''), undefined);
  assert.equal(queryBool(undefined), undefined);
  assert.equal(queryBool('maybe'), undefined);
});
