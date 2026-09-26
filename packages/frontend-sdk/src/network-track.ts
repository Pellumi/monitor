import type { EventType } from './event-types.js';

/**
 * Client-side network capture, and the correlation header that makes the backend SDK
 * work without the customer wiring anything.
 *
 * Nothing patched `fetch` or `XMLHttpRequest` before, so `API_REQUEST` existed only
 * where a customer had also installed the backend SDK — which is why most replay
 * views show "API Calls (0)". Worse, the backend SDK has always read
 * `x-tellann-session-id` to correlate a request with a frontend session
 * (`integrations/express/index.ts`), and nothing on the frontend ever sent it. The
 * join both halves were built for has never happened by default.
 *
 * Two rules keep this from becoming a privacy or a recursion problem:
 *
 *  - Only same-origin requests and explicitly allowed hosts are touched. A request
 *    to a third party gets no Tellann header, because the session id is ours to know
 *    and not theirs, and no event, because it is not the client's application.
 *  - Tellann's own ingest calls are skipped, or every flush would record itself and
 *    the buffer would never drain.
 */

export interface NetworkTrackConfig {
  /** The telemetry endpoint, so the SDK does not observe its own traffic. */
  endpoint: string;
  /** Extra origins that count as "the application" — an API on another subdomain. */
  allowedOrigins?: string[];
  /** Emits the event. Kept as a callback so this module holds no SDK reference. */
  track: (eventType: EventType, metadata: Record<string, unknown>) => void;
  /** The current session id, read at call time because it changes between sessions. */
  sessionId: () => string | null;
}

function originOf(url: string): string | null {
  try {
    return new URL(url, globalThis.location?.href ?? 'http://localhost').origin;
  } catch {
    return null;
  }
}

function resolveUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  if (typeof Request !== 'undefined' && input instanceof Request) return input.url;
  return String(input);
}

/** Strips query values and the fragment: a path is telemetry, a query is often data. */
function safePath(url: string): string {
  try {
    const parsed = new URL(url, globalThis.location?.href ?? 'http://localhost');
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return url.split('?')[0].slice(0, 500);
  }
}

class OriginPolicy {
  private readonly allowed: Set<string>;
  private readonly ingestOrigin: string | null;

  constructor(config: NetworkTrackConfig) {
    this.allowed = new Set<string>();
    const own = globalThis.location?.origin;
    if (own) this.allowed.add(own);
    for (const origin of config.allowedOrigins ?? []) {
      const normalized = originOf(origin);
      if (normalized) this.allowed.add(normalized);
    }
    this.ingestOrigin = originOf(config.endpoint);
  }

  /** Whether this request belongs to the application being observed. */
  observes(url: string): boolean {
    const origin = originOf(url);
    if (!origin) return false;
    // Never observe our own ingest: a flush that records itself never converges.
    if (this.ingestOrigin && origin === this.ingestOrigin) return false;
    return this.allowed.has(origin);
  }
}

export function setupNetworkTracking(config: NetworkTrackConfig): () => void {
  const policy = new OriginPolicy(config);
  const cleanups: Array<() => void> = [];

  // ── fetch ────────────────────────────────────────────────────────────────
  const originalFetch = globalThis.fetch;
  if (typeof originalFetch === 'function') {
    const patched: typeof globalThis.fetch = async (input, init) => {
      const url = resolveUrl(input);
      if (!policy.observes(url)) return originalFetch(input as RequestInfo, init);

      const method = (init?.method
        ?? (typeof Request !== 'undefined' && input instanceof Request ? input.method : 'GET')
      ).toUpperCase();

      // Inject the correlation header the backend SDK already reads. Done by building
      // a Headers object from whatever was supplied, so a caller's own headers — in
      // any of the three shapes the fetch API accepts — survive.
      const sessionId = config.sessionId();
      let nextInit = init;
      if (sessionId) {
        try {
          const headers = new Headers(
            init?.headers
            ?? (typeof Request !== 'undefined' && input instanceof Request ? input.headers : undefined),
          );
          if (!headers.has('x-tellann-session-id')) headers.set('x-tellann-session-id', sessionId);
          nextInit = { ...init, headers };
        } catch {
          // A runtime without Headers, or a frozen init: send the request unchanged
          // rather than failing it.
          nextInit = init;
        }
      }

      const startedAt = Date.now();
      try {
        const response = await originalFetch(input as RequestInfo, nextInit);
        config.track('API_REQUEST', {
          endpoint: safePath(url),
          method,
          statusCode: response.status,
          durationMs: Date.now() - startedAt,
          source: 'fetch',
        });
        return response;
      } catch (error) {
        // A network failure has no status code. Reporting 0 would be indistinguishable
        // from a real response, so it is named instead.
        config.track('API_REQUEST', {
          endpoint: safePath(url),
          method,
          statusCode: 0,
          durationMs: Date.now() - startedAt,
          source: 'fetch',
          failed: true,
          failureReason: error instanceof Error ? error.message.slice(0, 200) : 'network error',
        });
        throw error;
      }
    };

    globalThis.fetch = patched;
    cleanups.push(() => { globalThis.fetch = originalFetch; });
  }

  // ── XMLHttpRequest ───────────────────────────────────────────────────────
  // Still worth patching: every major HTTP client older than fetch uses it, and axios
  // used it by default in the browser until very recently.
  const XHR = globalThis.XMLHttpRequest;
  if (typeof XHR === 'function') {
    const originalOpen = XHR.prototype.open;
    const originalSend = XHR.prototype.send;
    const state = new WeakMap<XMLHttpRequest, { url: string; method: string; startedAt: number }>();

    XHR.prototype.open = function patchedOpen(
      this: XMLHttpRequest,
      method: string,
      url: string | URL,
      ...rest: unknown[]
    ) {
      const resolved = typeof url === 'string' ? url : url.toString();
      if (policy.observes(resolved)) {
        state.set(this, { url: resolved, method: String(method).toUpperCase(), startedAt: 0 });
      }
      return (originalOpen as any).call(this, method, url, ...rest);
    } as typeof XHR.prototype.open;

    XHR.prototype.send = function patchedSend(this: XMLHttpRequest, ...args: unknown[]) {
      const tracked = state.get(this);
      if (tracked) {
        tracked.startedAt = Date.now();
        const sessionId = config.sessionId();
        if (sessionId) {
          try { this.setRequestHeader('x-tellann-session-id', sessionId); } catch { /* wrong state */ }
        }
        this.addEventListener('loadend', () => {
          config.track('API_REQUEST', {
            endpoint: safePath(tracked.url),
            method: tracked.method,
            statusCode: this.status,
            durationMs: Date.now() - tracked.startedAt,
            source: 'xhr',
            ...(this.status === 0 ? { failed: true, failureReason: 'network error or aborted' } : {}),
          });
          state.delete(this);
        }, { once: true });
      }
      return (originalSend as any).apply(this, args);
    } as typeof XHR.prototype.send;

    cleanups.push(() => {
      XHR.prototype.open = originalOpen;
      XHR.prototype.send = originalSend;
    });
  }

  return () => { for (const cleanup of cleanups) cleanup(); };
}
