import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeInstrumentationTitle, resolveInstrumentationTitle } from './instrumentation-titles';

test('a setup task is named for what it does unless it has been renamed', () => {
  assert.equal(resolveInstrumentationTitle({ purpose: 'BOOTSTRAP' }), 'Initialisation');
  assert.equal(resolveInstrumentationTitle({ purpose: 'FLOW', flowId: 'flow-1' }, 'Checkout'), 'Checkout');
  // A Flow task that outlives its Flow still needs something to be called.
  assert.equal(resolveInstrumentationTitle({ purpose: 'FLOW', flowId: 'flow-1' }, null), 'Flow setup');
  assert.equal(resolveInstrumentationTitle({ purpose: 'FLOW', flowId: 'flow-1' }, '   '), 'Flow setup');
  // The operator's own wording wins over both.
  assert.equal(resolveInstrumentationTitle({ title: 'Connect storefront', purpose: 'BOOTSTRAP' }), 'Connect storefront');
  assert.equal(resolveInstrumentationTitle({ title: '   ', purpose: 'BOOTSTRAP' }), 'Initialisation');
});

test('a supplied title is trimmed and bounded, and an empty one falls back to the derived name', () => {
  assert.equal(normalizeInstrumentationTitle('  Connect   the storefront '), 'Connect the storefront');
  assert.equal(normalizeInstrumentationTitle(''), null);
  assert.equal(normalizeInstrumentationTitle('   '), null);
  assert.equal(normalizeInstrumentationTitle(null), null);
  assert.equal(normalizeInstrumentationTitle('x'.repeat(120)), 'x'.repeat(120));
  assert.equal(normalizeInstrumentationTitle('x'.repeat(121)), undefined);
  assert.equal(normalizeInstrumentationTitle(42), undefined);
  assert.equal(normalizeInstrumentationTitle(undefined), undefined);
});
