'use client';

/**
 * Outcome of a refresh attempt. `TRANSIENT` exists because a refresh that never
 * reached a verdict — a dropped connection, a gateway 502 while auth-api
 * restarts, a rate-limit 429 — says nothing about whether the session is still
 * good, and must not be answered by signing the user out.
 */
type RefreshOutcome = 'REFRESHED' | 'SESSION_INVALID' | 'TRANSIENT';

const REFRESH_RETRY_DELAYS_MS = [250, 1_000];

let refreshPromise: Promise<RefreshOutcome> | null = null;
let redirectStarted = false;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function attemptRefresh(): Promise<RefreshOutcome> {
  let response: Response;
  try {
    response = await fetch('/api-gateway/auth/refresh', {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
    });
  } catch {
    return 'TRANSIENT';
  }

  if (response.ok) return 'REFRESHED';
  // Only the auth service's own verdicts end a session. Everything else —
  // 429 from the gateway limiter, 5xx, a proxy error page — is infrastructure.
  if (response.status === 401 || response.status === 403) return 'SESSION_INVALID';
  return 'TRANSIENT';
}

/**
 * Renews the session, retrying a refresh that failed for infrastructure reasons
 * before giving up. Concurrent callers share one attempt so rotating refresh
 * tokens cannot race each other.
 */
async function refreshSession(): Promise<RefreshOutcome> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      let outcome = await attemptRefresh();
      for (const delay of REFRESH_RETRY_DELAYS_MS) {
        if (outcome !== 'TRANSIENT') break;
        await sleep(delay);
        outcome = await attemptRefresh();
      }
      return outcome;
    })().finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
}

function redirectToLogin() {
  if (typeof window === 'undefined' || redirectStarted) return;

  redirectStarted = true;
  const from = `${window.location.pathname}${window.location.search}`;
  const loginUrl = new URL('/auth/login', window.location.origin);
  loginUrl.searchParams.set('from', from);
  window.location.assign(loginUrl.toString());
}

function requestForAttempt(input: RequestInfo | URL): RequestInfo | URL {
  return input instanceof Request ? input.clone() : input;
}

/**
 * Fetches a protected dashboard resource and renews an expired access token once.
 *
 * Only a refresh the auth service actively rejected sends the browser back to
 * the login page. A refresh that could not be completed leaves the original 401
 * to the caller, so a blip surfaces as a failed request the page can retry
 * rather than as a lost session.
 */
export async function authenticatedFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const response = await fetch(requestForAttempt(input), {
    ...init,
    credentials: init?.credentials ?? 'same-origin',
  });

  if (response.status !== 401) {
    return response;
  }

  const outcome = await refreshSession();
  if (outcome !== 'REFRESHED') {
    if (outcome === 'SESSION_INVALID') redirectToLogin();
    return response;
  }

  const retriedResponse = await fetch(requestForAttempt(input), {
    ...init,
    credentials: init?.credentials ?? 'same-origin',
  });

  // A 401 on a request carrying a token minted moments ago is a real rejection,
  // not an expiry.
  if (retriedResponse.status === 401) {
    redirectToLogin();
  }

  return retriedResponse;
}
