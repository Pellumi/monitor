import assert from 'node:assert/strict';
import test from 'node:test';
import { buildTrend, NO_TREND, type TrendBasis } from './qa-run-trend';

const BASIS: TrendBasis = {
  comparedToRunId: 'prior-run',
  comparedToRunAt: '2026-01-01T00:00:00.000Z',
  comparisonScope: 'SAME_FLOW',
  flowVersionChanged: false,
  sameEnvironment: true,
};

function finding(overrides: Partial<{ dedupeKey: string | null; category: string | null; severity: string; title: string }> = {}) {
  return {
    dedupeKey: 'a11y:color-contrast:/settings',
    category: 'ACCESSIBILITY_VIOLATION',
    severity: 'MEDIUM',
    title: 'Elements must meet minimum color contrast ratio thresholds',
    ...overrides,
  };
}

test('NO_TREND carries its basis even though nothing was compared', () => {
  const outcome = NO_TREND(BASIS);
  assert.equal(outcome.available, false);
  assert.equal(outcome.status, 'NO_PRIOR_RUN');
  assert.deepEqual(outcome.basis, BASIS);
  assert.deepEqual(outcome.new, []);
  assert.deepEqual(outcome.resolved, []);
  assert.deepEqual(outcome.stillPresent, []);
});

test('a finding present only in the current run is new', () => {
  const outcome = buildTrend(
    [finding({ dedupeKey: 'vital:CLS:/login' })],
    [],
    BASIS,
  );
  assert.equal(outcome.newCount, 1);
  assert.equal(outcome.resolvedCount, 0);
  assert.equal(outcome.stillPresentCount, 0);
  assert.equal(outcome.new[0].dedupeKey, 'vital:CLS:/login');
});

test('a finding present only in the prior run is resolved', () => {
  const outcome = buildTrend(
    [],
    [finding({ dedupeKey: 'request:POST:/login:401' })],
    BASIS,
  );
  assert.equal(outcome.resolvedCount, 1);
  assert.equal(outcome.newCount, 0);
  assert.equal(outcome.resolved[0].dedupeKey, 'request:POST:/login:401');
});

test('a finding present in both runs is still present, not new and not resolved', () => {
  const outcome = buildTrend(
    [finding({ dedupeKey: 'a11y:color-contrast:/settings' })],
    [finding({ dedupeKey: 'a11y:color-contrast:/settings' })],
    BASIS,
  );
  assert.equal(outcome.stillPresentCount, 1);
  assert.equal(outcome.newCount, 0);
  assert.equal(outcome.resolvedCount, 0);
});

test('a mixed set of new, resolved and persisting findings is categorised correctly', () => {
  const outcome = buildTrend(
    [
      finding({ dedupeKey: 'a11y:color-contrast:/settings' }), // persists
      finding({ dedupeKey: 'vital:CLS:/login' }), // new
    ],
    [
      finding({ dedupeKey: 'a11y:color-contrast:/settings' }), // persists
      finding({ dedupeKey: 'request:POST:/login:401' }), // resolved
    ],
    BASIS,
  );
  assert.equal(outcome.newCount, 1);
  assert.equal(outcome.resolvedCount, 1);
  assert.equal(outcome.stillPresentCount, 1);
});

test('findings with no dedupeKey never participate in the comparison', () => {
  const outcome = buildTrend(
    [finding({ dedupeKey: null })],
    [finding({ dedupeKey: null })],
    BASIS,
  );
  assert.equal(outcome.newCount, 0);
  assert.equal(outcome.resolvedCount, 0);
  assert.equal(outcome.stillPresentCount, 0);
});

test('an empty prior run (first comparable run) reports everything current as new', () => {
  const outcome = buildTrend(
    [finding({ dedupeKey: 'a11y:button-name:/course/:id' })],
    [],
    BASIS,
  );
  assert.equal(outcome.newCount, 1);
  assert.equal(outcome.resolvedCount, 0);
});
