import { createHash } from "node:crypto";
import type { KeyValueStore } from "./persona-store";
import { localKeyValueStore } from "./persona-store";

/**
 * The browser session an Automated Run signed in with, kept for the next run.
 *
 * Without this, every run starts from an empty browser, so every run signs in again. For a persona
 * whose credentials Tellann can type that only costs a few seconds. For a persona that signs in by
 * hand — single sign-on, a one-time code, a CAPTCHA — it costs a *person*, every single time, which
 * is the difference between a Flow that can be run unattended and one that cannot.
 *
 * What is kept is Playwright's `storageState`: the cookies and per-origin web storage of the browser
 * the run drove. That is a bearer of the signed-in session, so:
 *
 *   - it is written through `local-store`, which encrypts every value with the operating system's
 *     own key store (`safeStorage`), and is never uploaded, never put in an artifact and never
 *     recorded as evidence;
 *   - it is scoped to one application, one persona and one origin, so a session for staging is never
 *     replayed against a different deployment of the same application;
 *   - it has an age. A stored session is trusted for `DEFAULT_MAX_AGE_MS` and then thrown away
 *     unseen, because a session that has sat unused for a day is more likely to be rejected than
 *     accepted, and being rejected mid-run is worse than signing in;
 *   - it is discarded the moment it does not work (see `run-executor`), and the run then signs in
 *     from nothing rather than retrying with something known to be bad.
 *
 * A successful run re-captures and rewrites it, which refreshes both the rotated cookies inside it
 * and its age. The age is therefore "how long since this session last demonstrably worked", not
 * "how long since a person typed a password" — which is the question actually worth asking.
 */

export interface StoredBrowserSession {
  applicationId: string;
  personaId: string;
  /** The application origin the session belongs to, e.g. `https://staging.example.com`. */
  origin: string;
  /** Playwright's `storageState()`, as JSON. Encrypted at rest by `local-store`. */
  storageState: string;
  capturedAt: string;
}

export interface BrowserSessionIdentity {
  applicationId: string;
  personaId: string;
  origin: string;
}

const SESSION_PREFIX = "automation-session:";

/** How long a stored session is trusted since it last worked. */
export const DEFAULT_MAX_AGE_MS = 12 * 60 * 60 * 1_000;

/**
 * A session blob is already far larger than anything else in this store, and a page that writes
 * megabytes into web storage should not be able to grow it without bound. Past this it is not kept,
 * and the next run signs in — which is the same behaviour as having no session at all.
 */
export const MAX_SESSION_BYTES = 512 * 1_024;

/**
 * One session per application, persona and origin. The origin carries `:` and `/`, which the store's
 * prefix listing would read as key structure, so it is hashed — the application id stays in the clear
 * so every session of one application can still be found and removed together.
 */
function sessionKey(identity: BrowserSessionIdentity): string {
  const digest = createHash("sha256")
    .update(JSON.stringify([identity.personaId, normalizeOrigin(identity.origin)]))
    .digest("hex");
  return `${SESSION_PREFIX}${identity.applicationId}:${digest}`;
}

/** Scheme and host, lowercased, with no trailing slash: what decides whether two addresses share a session. */
export function normalizeOrigin(value: string): string {
  try {
    return new URL(value).origin.toLowerCase();
  } catch {
    return value.trim().toLowerCase().replace(/\/+$/, "");
  }
}

/**
 * The stored session for this identity, or null when there is none, it is for something else, or it is
 * older than `maxAgeMs`. An expired one is deleted as it is read: there is no reason to keep something
 * that will never be offered again.
 */
export function readBrowserSession(
  identity: BrowserSessionIdentity,
  options: { maxAgeMs?: number; now?: () => number; store?: KeyValueStore } = {},
): StoredBrowserSession | null {
  const store = options.store ?? localKeyValueStore;
  const key = sessionKey(identity);
  const stored = store.read<StoredBrowserSession>(key);
  if (!stored || typeof stored.storageState !== "string" || stored.storageState.length === 0) return null;
  // A hash collision, or a record written for something else, must never be replayed as this identity's session.
  if (stored.personaId !== identity.personaId || normalizeOrigin(stored.origin) !== normalizeOrigin(identity.origin)) return null;
  const age = (options.now ?? Date.now)() - Date.parse(stored.capturedAt);
  if (!Number.isFinite(age) || age < 0 || age > (options.maxAgeMs ?? DEFAULT_MAX_AGE_MS)) {
    store.delete(key);
    return null;
  }
  return stored;
}

/** Keep a session for the next run. A blob too large to be worth keeping is not kept, and says so. */
export function writeBrowserSession(
  identity: BrowserSessionIdentity,
  storageState: string,
  options: { now?: () => Date; store?: KeyValueStore } = {},
): boolean {
  if (storageState.length === 0 || Buffer.byteLength(storageState, "utf8") > MAX_SESSION_BYTES) return false;
  const store = options.store ?? localKeyValueStore;
  store.write(sessionKey(identity), {
    applicationId: identity.applicationId,
    personaId: identity.personaId,
    origin: normalizeOrigin(identity.origin),
    storageState,
    capturedAt: (options.now ?? (() => new Date()))().toISOString(),
  } satisfies StoredBrowserSession);
  return true;
}

export function deleteBrowserSession(identity: BrowserSessionIdentity, store: KeyValueStore = localKeyValueStore): void {
  store.delete(sessionKey(identity));
}

/**
 * Every stored session of one application, for when the thing a session depends on changes: the persona's
 * credentials were edited, or it was deleted. Keyed by application in the clear, so this is a prefix listing.
 */
export function deleteBrowserSessionsForApplication(applicationId: string, store: KeyValueStore = localKeyValueStore): number {
  const keys = store.list(`${SESSION_PREFIX}${applicationId}:`);
  for (const key of keys) store.delete(key);
  return keys.length;
}

/** Sessions of one persona, whichever origin they are for. Read to check, because the persona is inside the value. */
export function deleteBrowserSessionsForPersona(
  applicationId: string,
  personaId: string,
  store: KeyValueStore = localKeyValueStore,
): number {
  let removed = 0;
  for (const key of store.list(`${SESSION_PREFIX}${applicationId}:`)) {
    if (store.read<StoredBrowserSession>(key)?.personaId !== personaId) continue;
    store.delete(key);
    removed += 1;
  }
  return removed;
}

/**
 * Drop every session past its age, across every application. Run at launch so expired sessions do not
 * sit encrypted on disk until something happens to ask for them.
 */
export function pruneExpiredBrowserSessions(
  options: { maxAgeMs?: number; now?: () => number; store?: KeyValueStore } = {},
): number {
  const store = options.store ?? localKeyValueStore;
  const now = (options.now ?? Date.now)();
  const maxAgeMs = options.maxAgeMs ?? DEFAULT_MAX_AGE_MS;
  let removed = 0;
  for (const key of store.list(SESSION_PREFIX)) {
    const stored = store.read<StoredBrowserSession>(key);
    const age = stored ? now - Date.parse(stored.capturedAt) : Number.NaN;
    if (!Number.isFinite(age) || age < 0 || age > maxAgeMs) {
      store.delete(key);
      removed += 1;
    }
  }
  return removed;
}
