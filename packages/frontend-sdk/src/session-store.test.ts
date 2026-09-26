import assert from 'node:assert/strict';
import test from 'node:test';

// A storage stand-in installed before the module under test reads globalThis.
function installStorage(options: { session?: boolean; local?: boolean; throwOnWrite?: boolean } = {}) {
  const make = (enabled: boolean) => {
    if (!enabled) return undefined;
    const map = new Map<string, string>();
    return {
      getItem: (key: string) => map.get(key) ?? null,
      setItem: (key: string, value: string) => {
        if (options.throwOnWrite) throw new DOMException('QuotaExceededError');
        map.set(key, value);
      },
      removeItem: (key: string) => { map.delete(key); },
      _map: map,
    } as any;
  };
  (globalThis as any).sessionStorage = make(options.session ?? true);
  (globalThis as any).localStorage = make(options.local ?? true);
}

let counter = 0;
const newId = () => `id-${++counter}`;

async function freshModule() {
  // Re-imported per test so the module's view of globalThis is re-evaluated.
  const suffix = `?t=${Date.now()}-${Math.random()}`;
  return import(`./session-store.js${suffix}`);
}

test('a first visit starts a session and persists it', async () => {
  installStorage();
  const store = await freshModule();
  const first = store.resolveSession({ newId, now: () => 1_000 });

  assert.equal(first.isNew, true);
  assert.equal(first.reason, 'FIRST_VISIT');

  // The bug this pins: startSession() used to mint a fresh uuid on every page load
  // with nothing persisted, so one journey through a multi-page app became a dozen
  // disconnected sessions.
  const second = store.resolveSession({ newId, now: () => 2_000 });
  assert.equal(second.sessionId, first.sessionId, 'the next page load resumes the same session');
  assert.equal(second.isNew, false);
  assert.equal(second.reason, 'RESUMED');
});

test('a session abandoned past the inactivity window starts a new one', async () => {
  installStorage();
  const store = await freshModule();
  const first = store.resolveSession({ newId, now: () => 0 });
  const later = store.resolveSession({ newId, now: () => store.SESSION_INACTIVITY_MS + 1 });

  assert.notEqual(later.sessionId, first.sessionId);
  assert.equal(later.reason, 'EXPIRED');
});

test('activity inside the window keeps one session alive indefinitely', async () => {
  installStorage();
  const store = await freshModule();
  const first = store.resolveSession({ newId, now: () => 0 });

  let clock = 0;
  for (let step = 0; step < 5; step += 1) {
    clock += store.SESSION_INACTIVITY_MS - 1_000;
    const resumed = store.resolveSession({ newId, now: () => clock });
    assert.equal(resumed.sessionId, first.sessionId, `step ${step}`);
  }
});

test('signing in as a different person starts a new session', async () => {
  // Continuing would attribute two people's behaviour to one visit -- the shared
  // library terminal case.
  installStorage();
  const store = await freshModule();
  const asA = store.resolveSession({ newId, now: () => 1_000, identity: 'student-a' });
  const asB = store.resolveSession({ newId, now: () => 2_000, identity: 'student-b' });

  assert.notEqual(asB.sessionId, asA.sessionId);
  assert.equal(asB.reason, 'IDENTITY_CHANGED');
});

test('the same person resuming keeps their session', async () => {
  installStorage();
  const store = await freshModule();
  const first = store.resolveSession({ newId, now: () => 1_000, identity: 'student-a' });
  const again = store.resolveSession({ newId, now: () => 2_000, identity: 'student-a' });
  assert.equal(again.sessionId, first.sessionId);
});

test('a pinned session id wins, because a QA run must keep its correlation', async () => {
  installStorage();
  const store = await freshModule();
  const pinned = store.resolveSession({ newId, now: () => 1_000, pinnedId: 'run-session-1' });
  assert.equal(pinned.sessionId, 'run-session-1');
  assert.equal(pinned.reason, 'FORCED');
});

test('without usable storage it degrades to the old per-load behaviour, and says so', async () => {
  // A private window, blocked site data, or a sandboxed iframe. The reason is recorded
  // so the churn is visible in the data rather than looking like genuine session churn.
  installStorage({ session: false });
  const store = await freshModule();
  const first = store.resolveSession({ newId, now: () => 1_000 });
  const second = store.resolveSession({ newId, now: () => 1_100 });

  assert.equal(first.reason, 'NO_STORAGE');
  assert.notEqual(second.sessionId, first.sessionId);
});

test('a storage that exists but throws on write is treated as unusable', async () => {
  // Safari in private mode historically exposed the object and threw on setItem, so
  // presence is not usability.
  installStorage({ throwOnWrite: true });
  const store = await freshModule();
  const resolved = store.resolveSession({ newId, now: () => 1_000 });
  assert.equal(resolved.reason, 'NO_STORAGE');
});

test('the anonymous id is stable across page loads', async () => {
  installStorage();
  const store = await freshModule();
  const first = store.resolveAnonymousId(newId);
  const second = store.resolveAnonymousId(newId);
  assert.equal(second, first);
  assert.ok(first);
});

test('without localStorage the anonymous id is null, not a fresh value each load', async () => {
  // A new id per page load would look like a new browser every time and fill the alias
  // table with single-use rows -- worse than having none.
  installStorage({ local: false });
  const store = await freshModule();
  assert.equal(store.resolveAnonymousId(newId), null);
  assert.equal(store.resolveAnonymousId(newId), null);
});

test('clearing the session makes the next resolution a new one', async () => {
  installStorage();
  const store = await freshModule();
  const first = store.resolveSession({ newId, now: () => 1_000 });
  store.clearStoredSession();
  const after = store.resolveSession({ newId, now: () => 1_100 });
  assert.notEqual(after.sessionId, first.sessionId);
});

test('clearing the anonymous id forgets the browser', async () => {
  installStorage();
  const store = await freshModule();
  const first = store.resolveAnonymousId(newId);
  store.clearAnonymousId();
  assert.notEqual(store.resolveAnonymousId(newId), first);
});
