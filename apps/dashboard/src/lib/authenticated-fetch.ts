'use client';

let refreshPromise: Promise<boolean> | null = null;
let redirectStarted = false;

async function refreshSession(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = fetch('/api-gateway/auth/refresh', {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
    })
      .then((response) => response.ok)
      .catch(() => false)
      .finally(() => {
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
 * Refresh requests are shared across concurrent callers so rotating refresh tokens
 * cannot race each other. A genuine refresh failure is the only condition that
 * sends the browser back to the login page.
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

  const refreshed = await refreshSession();
  if (!refreshed) {
    redirectToLogin();
    return response;
  }

  const retriedResponse = await fetch(requestForAttempt(input), {
    ...init,
    credentials: init?.credentials ?? 'same-origin',
  });

  if (retriedResponse.status === 401) {
    redirectToLogin();
  }

  return retriedResponse;
}

