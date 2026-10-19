import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_MAX_AGE_MS,
  MAX_SESSION_BYTES,
  deleteBrowserSession,
  deleteBrowserSessionsForApplication,
  deleteBrowserSessionsForPersona,
  normalizeOrigin,
  pruneExpiredBrowserSessions,
  readBrowserSession,
  writeBrowserSession,
} from './session-store';
import type { KeyValueStore } from './persona-store';

const APP_A = '11111111-1111-4111-8111-111111111111';
const APP_B = '22222222-2222-4222-8222-222222222222';
const STATE = '{"cookies":[{"name":"sid","value":"abc"}],"origins":[]}';

function memoryStore(): KeyValueStore & { keys(): string[] } {
  const backing = new Map<string, unknown>();
  return {
    read: <T>(key: string) => (backing.has(key) ? (backing.get(key) as T) : null),
    write: (key, value) => { backing.set(key, value); },
    list: (prefix) => [...backing.keys()].filter((key) => key.startsWith(prefix)),
    delete: (key) => { backing.delete(key); },
    keys: () => [...backing.keys()],
  };
}

const at = (iso: string) => () => new Date(iso);
const NOW = Date.parse('2026-02-01T12:00:00.000Z');

const identity = (over: Partial<{ applicationId: string; personaId: string; origin: string }> = {}) =>
  ({ applicationId: APP_A, personaId: 'p1', origin: 'https://staging.example.com', ...over });

test('a session written for one application, persona and origin is read back for exactly that', () => {
  const store = memoryStore();
  assert.equal(writeBrowserSession(identity(), STATE, { store, now: at('2026-02-01T11:00:00.000Z') }), true);

  assert.equal(readBrowserSession(identity(), { store, now: () => NOW })?.storageState, STATE);
  assert.equal(readBrowserSession(identity({ personaId: 'p2' }), { store, now: () => NOW }), null, 'another persona');
  assert.equal(readBrowserSession(identity({ applicationId: APP_B }), { store, now: () => NOW }), null, 'another application');
  assert.equal(readBrowserSession(identity({ origin: 'https://production.example.com' }), { store, now: () => NOW }), null, 'another deployment');
});

test('the key keeps the application in the clear and hashes the rest, so an origin cannot be read as key structure', () => {
  const store = memoryStore();
  writeBrowserSession(identity(), STATE, { store, now: at('2026-02-01T11:00:00.000Z') });
  const [key] = store.keys();
  assert.ok(key);
  assert.ok(key.startsWith(`automation-session:${APP_A}:`), 'per-application removal stays a prefix listing');
  assert.ok(!key.includes('staging.example.com'), 'the origin is not in the key');
  assert.ok(!key.includes('p1'), 'nor is the persona');
});

test('an address is matched by its origin, not by how it was typed', () => {
  assert.equal(normalizeOrigin('https://Staging.Example.com/app/'), 'https://staging.example.com');
  const store = memoryStore();
  writeBrowserSession(identity({ origin: 'https://staging.example.com/' }), STATE, { store, now: at('2026-02-01T11:00:00.000Z') });
  assert.ok(readBrowserSession(identity({ origin: 'https://STAGING.example.com/dashboard' }), { store, now: () => NOW }));
});

test('a session past its age is never offered, and is deleted as it is refused', () => {
  const store = memoryStore();
  writeBrowserSession(identity(), STATE, { store, now: at('2026-01-01T00:00:00.000Z') });
  assert.equal(store.keys().length, 1);

  assert.equal(readBrowserSession(identity(), { store, now: () => NOW }), null, 'a month old is not a session to trust');
  assert.deepEqual(store.keys(), [], 'and there is no reason to keep what will never be offered again');
});

test('age is measured from when it last worked, so a run that used it successfully refreshes it', () => {
  const store = memoryStore();
  const justInside = new Date(NOW - DEFAULT_MAX_AGE_MS + 60_000).toISOString();
  writeBrowserSession(identity(), STATE, { store, now: () => new Date(justInside) });
  assert.ok(readBrowserSession(identity(), { store, now: () => NOW }), 'still inside its age');

  // What a successful run does: capture again and rewrite.
  writeBrowserSession(identity(), STATE, { store, now: () => new Date(NOW) });
  assert.ok(readBrowserSession(identity(), { store, now: () => NOW + DEFAULT_MAX_AGE_MS - 60_000 }));
});

test('a record whose stored identity does not match is refused rather than replayed', () => {
  const store = memoryStore();
  writeBrowserSession(identity(), STATE, { store, now: at('2026-02-01T11:00:00.000Z') });
  const [key] = store.keys();
  // However it got there — a hash collision, a hand-edited store — a record for someone else is not this session.
  store.write(key!, { applicationId: APP_A, personaId: 'somebody-else', origin: 'https://staging.example.com', storageState: STATE, capturedAt: new Date(NOW).toISOString() });
  assert.equal(readBrowserSession(identity(), { store, now: () => NOW }), null);
});

test('a session too large to be worth keeping is not kept, and the run simply signs in next time', () => {
  const store = memoryStore();
  const huge = `{"cookies":[],"origins":[{"localStorage":[{"name":"x","value":"${'y'.repeat(MAX_SESSION_BYTES)}"}]}]}`;
  assert.equal(writeBrowserSession(identity(), huge, { store }), false);
  assert.deepEqual(store.keys(), []);
  assert.equal(writeBrowserSession(identity(), '', { store }), false, 'nor is an empty one worth a record');
});

test('sessions can be removed per persona and per application', () => {
  const store = memoryStore();
  const now = at('2026-02-01T11:00:00.000Z');
  writeBrowserSession(identity({ personaId: 'p1', origin: 'https://a.example.com' }), STATE, { store, now });
  writeBrowserSession(identity({ personaId: 'p1', origin: 'https://b.example.com' }), STATE, { store, now });
  writeBrowserSession(identity({ personaId: 'p2' }), STATE, { store, now });
  writeBrowserSession(identity({ applicationId: APP_B }), STATE, { store, now });

  assert.equal(deleteBrowserSessionsForPersona(APP_A, 'p1', store), 2, 'both of that persona, whichever address');
  assert.ok(readBrowserSession(identity({ personaId: 'p2' }), { store, now: () => NOW }), 'the other persona is untouched');
  assert.ok(readBrowserSession(identity({ applicationId: APP_B }), { store, now: () => NOW }), 'so is the other application');

  assert.equal(deleteBrowserSessionsForApplication(APP_A, store), 1);
  assert.ok(readBrowserSession(identity({ applicationId: APP_B }), { store, now: () => NOW }));
});

test('deleting one session leaves the others alone', () => {
  const store = memoryStore();
  const now = at('2026-02-01T11:00:00.000Z');
  writeBrowserSession(identity(), STATE, { store, now });
  writeBrowserSession(identity({ origin: 'https://other.example.com' }), STATE, { store, now });
  deleteBrowserSession(identity(), store);
  assert.equal(readBrowserSession(identity(), { store, now: () => NOW }), null);
  assert.ok(readBrowserSession(identity({ origin: 'https://other.example.com' }), { store, now: () => NOW }));
});

test('pruning drops everything past its age, and anything whose age cannot be read at all', () => {
  const store = memoryStore();
  writeBrowserSession(identity({ personaId: 'fresh' }), STATE, { store, now: () => new Date(NOW - 60_000) });
  writeBrowserSession(identity({ personaId: 'stale' }), STATE, { store, now: at('2026-01-01T00:00:00.000Z') });
  store.write(`automation-session:${APP_A}:deadbeef`, { personaId: 'broken', origin: 'https://x', storageState: STATE, capturedAt: 'not a date' });

  assert.equal(pruneExpiredBrowserSessions({ store, now: () => NOW }), 2);
  assert.ok(readBrowserSession(identity({ personaId: 'fresh' }), { store, now: () => NOW }));
});
