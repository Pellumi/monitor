import assert from 'node:assert/strict';
import test from 'node:test';
import { derivedQaRunTitle, normalizeQaRunTitle, resolveQaRunTitle } from './qa-run-titles';

test('an untitled run is named for its environment and start date', () => {
  assert.equal(
    derivedQaRunTitle({ environmentName: 'Development', startedAt: '2026-09-23T10:15:00.000Z', createdAt: '2026-09-23T10:00:00.000Z' }),
    'Development · 2026-09-23',
  );
  // A run that never started yet is dated from when it was created.
  assert.equal(
    derivedQaRunTitle({ environmentName: 'Staging', startedAt: null, createdAt: '2026-09-22T08:00:00.000Z' }),
    'Staging · 2026-09-22',
  );
  assert.equal(
    derivedQaRunTitle({ environmentName: null, startedAt: null, createdAt: '2026-09-22T08:00:00.000Z' }),
    'QA run · 2026-09-22',
  );
});

test('the operator\'s own title wins over the derived one', () => {
  assert.equal(
    resolveQaRunTitle({ title: 'Checkout smoke test', environmentName: 'Production', startedAt: null, createdAt: '2026-09-23T00:00:00.000Z' }),
    'Checkout smoke test',
  );
  assert.equal(
    resolveQaRunTitle({ title: '   ', environmentName: 'Production', startedAt: null, createdAt: '2026-09-23T00:00:00.000Z' }),
    'Production · 2026-09-23',
  );
});

test('a supplied title is trimmed and bounded, and an empty one clears back to derived', () => {
  assert.equal(normalizeQaRunTitle('  Checkout smoke test  '), 'Checkout smoke test');
  assert.equal(normalizeQaRunTitle(''), null);
  assert.equal(normalizeQaRunTitle('   '), null);
  assert.equal(normalizeQaRunTitle('x'.repeat(200)), 'x'.repeat(200));
  assert.equal(normalizeQaRunTitle('x'.repeat(201)), undefined);
  assert.equal(normalizeQaRunTitle(42), undefined);
  assert.equal(normalizeQaRunTitle(undefined), undefined);
});
