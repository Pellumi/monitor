import assert from 'node:assert/strict';
import test from 'node:test';
import { anchorAiSuggestion, isInFlow, normalize, resolveFindingScope } from './qa-report-worker';

const KNOWN = {
  evidenceIds: new Set(['evidence-1', 'evidence-2']),
  findingIds: new Set(['finding-1']),
  stateKeys: new Set(['sign_in', 'cart']),
  transitionKeys: new Set(['sign_in>cart']),
};

function suggestion(overrides: Partial<{
  evidenceIds: string[];
  affectedState: string | null;
  affectedTransition: string | null;
}> = {}) {
  return {
    suggestedAction: 'Do the thing',
    evidenceIds: [] as string[],
    affectedState: null as string | null,
    affectedTransition: null as string | null,
    ...overrides,
  };
}

test('an absent finding scope resolves from the run boundary, never to in-Flow by default', () => {
  assert.equal(resolveFindingScope(null, false), 'PRE_BOUNDARY');
  assert.equal(resolveFindingScope(undefined, false), 'PRE_BOUNDARY');
  assert.equal(resolveFindingScope(null, true), 'IN_FLOW');
  assert.equal(resolveFindingScope('PRE_BOUNDARY', true), 'PRE_BOUNDARY', 'an explicit scope always wins');
  assert.equal(resolveFindingScope('IN_FLOW', false), 'IN_FLOW');
});

test('out-of-Flow findings are excluded from the in-Flow section', () => {
  assert.equal(isInFlow({ scope: 'PRE_BOUNDARY' }), false);
  assert.equal(isInFlow({ scope: 'IN_FLOW' }), true);
  // Absence findings (a declared state never reached) belong to the Flow and
  // carry no scope of their own.
  assert.equal(isInFlow({}), true);
});

test('invented evidence ids are stripped from AI output', () => {
  const result = anchorAiSuggestion(
    suggestion({ evidenceIds: ['evidence-1', 'totally-made-up'], affectedState: 'sign_in' }),
    KNOWN,
  );
  assert.deepEqual(result?.evidenceIds, ['evidence-1']);
});

test('a finding id is an acceptable evidence anchor', () => {
  const result = anchorAiSuggestion(suggestion({ evidenceIds: ['finding-1'] }), KNOWN);
  assert.deepEqual(result?.evidenceIds, ['finding-1']);
});

test('an invented state or transition is dropped rather than published', () => {
  const result = anchorAiSuggestion(
    suggestion({
      evidenceIds: ['evidence-2'],
      affectedState: 'checkout_step_9',
      affectedTransition: 'cart>order_confirmed',
    }),
    KNOWN,
  );
  assert.equal(result?.affectedState, null);
  assert.equal(result?.affectedTransition, null);
  assert.deepEqual(result?.evidenceIds, ['evidence-2'], 'the real anchor survives');
});

test('a declared state anchor is kept and normalized', () => {
  const result = anchorAiSuggestion(suggestion({ affectedState: 'Sign In' }), KNOWN);
  assert.equal(result?.affectedState, 'sign_in');
});

test('a suggestion with no verifiable anchor at all is discarded', () => {
  assert.equal(anchorAiSuggestion(suggestion(), KNOWN), null);
  assert.equal(
    anchorAiSuggestion(suggestion({
      evidenceIds: ['made-up'], affectedState: 'nope', affectedTransition: 'a>b',
    }), KNOWN),
    null,
    'every reference being invented means the suggestion is not evidence-backed',
  );
});

test('normalize produces the comparison form used across the report', () => {
  assert.equal(normalize('Sign In'), 'sign_in');
  assert.equal(normalize('  Order-Confirmed! '), 'order_confirmed');
  assert.equal(normalize(null), '');
});
