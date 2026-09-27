import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ALWAYS_BLOCKED_SELECTORS,
  DEFAULT_REPLAY_MODE,
  HARD_MAX_CHUNK_BYTES,
  resolveEffectiveReplayConfig,
  type ReplaySettingRow,
} from './replay-config';

function setting(overrides: Partial<ReplaySettingRow> = {}): ReplaySettingRow {
  return {
    mode: 'ERROR',
    maskAllInputs: true,
    maskAllText: false,
    blockSelectors: [],
    maskSelectors: [],
    recordCanvas: false,
    recordCrossOriginIframes: false,
    sampleRate: 1,
    maxChunkBytes: 2 * 1024 * 1024,
    bufferSeconds: 30,
    ...overrides,
  };
}

test('ERROR is the default mode, not ALWAYS', () => {
  // ALWAYS is 5-20 MB compressed for a ten-minute session, which at any real traffic is
  // the largest single line in the storage ledger. ERROR records the session that broke.
  assert.equal(DEFAULT_REPLAY_MODE, 'ERROR');
  assert.equal(resolveEffectiveReplayConfig(null, { entitled: true }).mode, 'ERROR');
});

test('an unentitled plan is OFF whatever the setting says', () => {
  // So a downgrade stops capture by itself, without anyone editing a setting -- and the
  // ingest route refuses the chunks, which is the enforcement that is actually real.
  const config = resolveEffectiveReplayConfig(setting({ mode: 'ALWAYS' }), { entitled: false });
  assert.equal(config.mode, 'OFF');
});

test('an application with no setting still gets masked inputs', () => {
  const config = resolveEffectiveReplayConfig(null, { entitled: true });
  assert.equal(config.maskAllInputs, true);
});

test('the always-blocked selectors are unioned in, never replaced', () => {
  // These mirror the SDK's own shouldIgnore predicate, so recording and event tracking
  // cannot disagree about what is sensitive -- a disagreement would mean an element
  // excluded from click tracking still had its text in the DOM recording.
  const config = resolveEffectiveReplayConfig(setting({ blockSelectors: ['.my-widget'] }), { entitled: true });
  for (const selector of ALWAYS_BLOCKED_SELECTORS) {
    assert.ok(config.blockSelectors.includes(selector), selector);
  }
  assert.ok(config.blockSelectors.includes('.my-widget'));
});

test('a password input is blocked even when the application clears its block list', () => {
  const config = resolveEffectiveReplayConfig(setting({ blockSelectors: [] }), { entitled: true });
  assert.ok(config.blockSelectors.includes('input[type="password"]'));
});

test('the plan caps the sample rate the application asked for', () => {
  const config = resolveEffectiveReplayConfig(
    setting({ sampleRate: 1 }),
    { entitled: true, planLimits: { replaySampleRate: 0.1 } },
  );
  assert.equal(config.sampleRate, 0.1);
});

test('the application may ask for less than the plan allows', () => {
  const config = resolveEffectiveReplayConfig(
    setting({ sampleRate: 0.05 }),
    { entitled: true, planLimits: { replaySampleRate: 0.5 } },
  );
  assert.equal(config.sampleRate, 0.05, 'strictness wins in both directions');
});

test('chunk size is capped regardless of configuration', () => {
  const config = resolveEffectiveReplayConfig(
    setting({ maxChunkBytes: 999 * 1024 * 1024 }),
    { entitled: true },
  );
  assert.equal(config.maxChunkBytes, HARD_MAX_CHUNK_BYTES);
});

test('the buffer window is bounded at both ends', () => {
  assert.equal(resolveEffectiveReplayConfig(setting({ bufferSeconds: 1 }), { entitled: true }).bufferSeconds, 5);
  assert.equal(resolveEffectiveReplayConfig(setting({ bufferSeconds: 9_999 }), { entitled: true }).bufferSeconds, 120);
});

test('the profile hash is a function of meaning, not of ordering', () => {
  // Otherwise a reordered block list would invalidate every recording in flight and force
  // every client to restart, for no change at all.
  const a = resolveEffectiveReplayConfig(setting({ blockSelectors: ['.a', '.b'] }), { entitled: true });
  const b = resolveEffectiveReplayConfig(setting({ blockSelectors: ['.b', '.a'] }), { entitled: true });
  assert.equal(a.profileHash, b.profileHash);
});

test('a genuine change to masking changes the hash', () => {
  // Which is what makes the 409 attestation work: a client recording under the old rules
  // is told to re-fetch, so a tightening takes effect within one chunk interval instead of
  // at the customer's next deploy.
  const before = resolveEffectiveReplayConfig(setting({ maskAllText: false }), { entitled: true });
  const after = resolveEffectiveReplayConfig(setting({ maskAllText: true }), { entitled: true });
  assert.notEqual(before.profileHash, after.profileHash);
});

test('turning the mode off changes the hash too', () => {
  const on = resolveEffectiveReplayConfig(setting({ mode: 'ALWAYS' }), { entitled: true });
  const off = resolveEffectiveReplayConfig(setting({ mode: 'OFF' }), { entitled: true });
  assert.notEqual(on.profileHash, off.profileHash);
});

test('canvas and cross-origin iframes are off unless asked for', () => {
  // Both materially increase payload size and what is captured, so neither is a default.
  const config = resolveEffectiveReplayConfig(null, { entitled: true });
  assert.equal(config.recordCanvas, false);
  assert.equal(config.recordCrossOriginIframes, false);
});
