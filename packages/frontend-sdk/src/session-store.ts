/**
 * Session continuity across page loads.
 *
 * `startSession()` used to do `this.sessionId = uuidv4()` with nothing persisted, so
 * every page load — every hard navigation in a multi-page app, every reload — minted
 * a new session. One user journey became a dozen disconnected four-event sessions,
 * and the server's 30-second idle timeout closed each of them mid-task.
 *
 * Two different lifetimes, so two different stores:
 *
 *  - the session id lives in `sessionStorage`, which is per tab and dies with it.
 *    Two tabs are two visits, which is the honest reading.
 *  - the anonymous id lives in `localStorage`, so a returning browser can be
 *    recognised and its earlier sessions attributed once someone identifies.
 *
 * Every access is wrapped: in a private window, with site data blocked, or inside a
 * sandboxed iframe, the accessor can throw on *read*, not just on write. When that
 * happens the SDK degrades to exactly the old per-load behaviour rather than failing
 * to initialise.
 */

const SESSION_KEY = 'tellann_session';
const ANONYMOUS_KEY = 'tellann_anonymous_id';

/** A session ends after this much inactivity, matching the server's idle timeout
 *  plus enough slack that a reader pausing to read a page is still one session. */
export const SESSION_INACTIVITY_MS = 30 * 60 * 1000;

interface StoredSession {
  id: string;
  /** Last activity, so an abandoned tab resumed hours later starts a new session. */
  at: number;
  /** The identity in force when the session was stored, so a sign-in as a different
   *  person starts a new session rather than blending two people's behaviour. */
  identity?: string | null;
}

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** A storage that is present and actually usable, or null. */
function safeStore(kind: 'session' | 'local'): Store | null {
  try {
    const store = kind === 'session' ? globalThis.sessionStorage : globalThis.localStorage;
    if (!store) return null;
    // Presence is not usability: Safari in private mode historically exposed the
    // object and threw on setItem.
    const probe = '__tellann_probe__';
    store.setItem(probe, '1');
    store.removeItem(probe);
    return store;
  } catch {
    return null;
  }
}

function readJson<T>(store: Store | null, key: string): T | null {
  if (!store) return null;
  try {
    const raw = store.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJson(store: Store | null, key: string, value: unknown): void {
  if (!store) return;
  try {
    store.setItem(key, JSON.stringify(value));
  } catch {
    // A full or read-only quota must not break tracking.
  }
}

export interface SessionResolution {
  sessionId: string;
  /** True when this call began a new session, so the caller emits SESSION_STARTED. */
  isNew: boolean;
  /** Why, for the SESSION_STARTED metadata and for diagnosing session counts. */
  reason: 'FIRST_VISIT' | 'RESUMED' | 'EXPIRED' | 'IDENTITY_CHANGED' | 'NO_STORAGE' | 'FORCED';
}

export interface SessionStoreOptions {
  newId: () => string;
  now?: () => number;
  /** A session id pinned by config — a QA run supplies one and must keep it. */
  pinnedId?: string | null;
  inactivityMs?: number;
}

/**
 * The session this page load belongs to, resuming the tab's session when there is
 * one and it is still fresh.
 */
export function resolveSession(
  options: SessionStoreOptions & { identity?: string | null },
): SessionResolution {
  const now = options.now ? options.now() : Date.now();
  const inactivityMs = options.inactivityMs ?? SESSION_INACTIVITY_MS;

  if (options.pinnedId) {
    return { sessionId: options.pinnedId, isNew: true, reason: 'FORCED' };
  }

  const store = safeStore('session');
  if (!store) {
    // Exactly the old behaviour, and named so it is visible in the data rather than
    // looking like genuine churn.
    return { sessionId: options.newId(), isNew: true, reason: 'NO_STORAGE' };
  }

  const stored = readJson<StoredSession>(store, SESSION_KEY);
  const identity = options.identity ?? null;

  if (stored?.id) {
    if (now - stored.at > inactivityMs) {
      const sessionId = options.newId();
      writeJson(store, SESSION_KEY, { id: sessionId, at: now, identity });
      return { sessionId, isNew: true, reason: 'EXPIRED' };
    }
    // A stored identity that differs from the current one means someone signed out
    // and someone else signed in. Continuing the session would attribute two
    // people's behaviour to one visit.
    if ((stored.identity ?? null) !== identity && stored.identity !== undefined) {
      const sessionId = options.newId();
      writeJson(store, SESSION_KEY, { id: sessionId, at: now, identity });
      return { sessionId, isNew: true, reason: 'IDENTITY_CHANGED' };
    }
    writeJson(store, SESSION_KEY, { id: stored.id, at: now, identity: stored.identity ?? identity });
    return { sessionId: stored.id, isNew: false, reason: 'RESUMED' };
  }

  const sessionId = options.newId();
  writeJson(store, SESSION_KEY, { id: sessionId, at: now, identity });
  return { sessionId, isNew: true, reason: 'FIRST_VISIT' };
}

/** Refreshes the activity stamp, so a long session is not expired mid-use. */
export function touchSession(now: number = Date.now()): void {
  const store = safeStore('session');
  const stored = readJson<StoredSession>(store, SESSION_KEY);
  if (stored?.id) writeJson(store, SESSION_KEY, { ...stored, at: now });
}

/** Records the identity in force, so the next page load can detect a change. */
export function rememberIdentity(identity: string | null, now: number = Date.now()): void {
  const store = safeStore('session');
  const stored = readJson<StoredSession>(store, SESSION_KEY);
  if (stored?.id) writeJson(store, SESSION_KEY, { ...stored, at: now, identity });
}

/** Ends the stored session so the next call starts a fresh one. */
export function clearStoredSession(): void {
  const store = safeStore('session');
  try { store?.removeItem(SESSION_KEY); } catch { /* nothing to do */ }
}

/**
 * The browser's stable anonymous id, minted on first use.
 *
 * Without usable `localStorage` this returns null rather than a per-load random
 * value: a fresh id on every page load would be worse than none at all, because it
 * would look like a new browser each time and the alias table would fill with
 * single-use rows.
 */
export function resolveAnonymousId(newId: () => string): string | null {
  const store = safeStore('local');
  if (!store) return null;

  try {
    const existing = store.getItem(ANONYMOUS_KEY);
    if (existing) return existing;
    const anonymousId = newId();
    store.setItem(ANONYMOUS_KEY, anonymousId);
    return anonymousId;
  } catch {
    return null;
  }
}

/** Forgets the browser. For a sign-out, and for a consent withdrawal. */
export function clearAnonymousId(): void {
  const store = safeStore('local');
  try { store?.removeItem(ANONYMOUS_KEY); } catch { /* nothing to do */ }
}
