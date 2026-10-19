import type { PersonaApiLogin, PersonaSessionSeed, TestPersona } from "@tellann/desktop-contracts";

/**
 * A session that came from somewhere other than signing in.
 *
 * Two ways in, one destination. A `SEEDED` persona carries the cookies and storage entries outright; an `API`
 * persona says how to ask the application for them. Either way the result is Playwright's `storageState` — the
 * same thing a kept session is — so the browser is handed a session before it opens a page and no sign-in form
 * is ever involved. That is what makes a Flow behind single sign-on runnable with nobody present.
 *
 * Everything here is a bearer of the session. It is built in the main process, handed straight to the browser,
 * and never written to an artifact, never recorded as evidence and never uploaded. The values are registered as
 * protected before the browser opens, exactly as a typed password is.
 */

/** A session cookie by default: it belongs to this run, not to the machine. */
const SESSION_COOKIE_EXPIRY = -1;

export interface StorageStateCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires: number;
  httpOnly: boolean;
  secure: boolean;
  sameSite: "Strict" | "Lax" | "None";
}

export interface StorageState {
  cookies: StorageStateCookie[];
  origins: Array<{ origin: string; localStorage: Array<{ name: string; value: string }> }>;
}

/**
 * The supplied session as a browser would hold it. A cookie with no domain of its own gets the host of the
 * address the run is pointed at, which is what somebody pasting a session cookie means by it; `secure` follows
 * the scheme, because a secure cookie handed to an `http://` origin is one the browser would silently drop.
 */
export function storageStateFromSeed(seed: PersonaSessionSeed, targetUrl: string): StorageState {
  const url = new URL(targetUrl);
  const secure = url.protocol === "https:";
  return {
    cookies: seed.cookies.map((cookie) => ({
      name: cookie.name,
      value: cookie.value,
      domain: cookie.domain ?? url.hostname,
      path: cookie.path ?? "/",
      expires: SESSION_COOKIE_EXPIRY,
      httpOnly: false,
      secure,
      sameSite: "Lax" as const,
    })),
    origins: seed.storage.length > 0
      ? [{ origin: url.origin, localStorage: seed.storage.map((entry) => ({ name: entry.key, value: entry.value })) }]
      : [],
  };
}

/** Every value a supplied session is made of, for registration as protected before anything opens. */
export function suppliedSessionValues(persona: TestPersona | null): string[] {
  const seed = persona?.sessionSeed;
  if (!seed) return [];
  return [...seed.cookies.map((cookie) => cookie.value), ...seed.storage.map((entry) => entry.value)]
    .filter((value) => value.length > 0);
}

export type ApiSessionResult =
  | { ok: true; storageState: StorageState; token: string }
  | { ok: false; detail: string };

/** What `fetchApiSession` needs from the outside world, so it can be tested without a server. */
export type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body: string; signal?: AbortSignal }) => Promise<{
  ok: boolean;
  status: number;
  text(): Promise<string>;
}>;

const REQUEST_TIMEOUT_MS = 15_000;
/** A token is a token. An answer larger than this is not one, and is not worth reading into memory. */
const MAX_RESPONSE_BYTES = 256 * 1_024;

/**
 * Ask the application for a session: post the credentials where the persona says, read the token out of the
 * answer, and put it where the application looks for it.
 *
 * Deliberately not a general HTTP client. One method, a JSON body, a JSON answer, and a token at a named path —
 * which is the shape every team's own test setup already uses. Anything else, and the honest answer is that
 * Tellann could not get a session, not that it tried something clever.
 */
export async function fetchApiSession(
  apiLogin: PersonaApiLogin,
  persona: TestPersona,
  targetUrl: string,
  fetchImpl: FetchLike = globalThis.fetch as unknown as FetchLike,
): Promise<ApiSessionResult> {
  let url: URL;
  try {
    url = new URL(apiLogin.url, targetUrl);
  } catch {
    return { ok: false, detail: `"${apiLogin.url}" is not an address this run can ask for a session.` };
  }
  if (!["http:", "https:"].includes(url.protocol)) {
    return { ok: false, detail: "A session can only be fetched over http or https." };
  }

  const body = fillCredentials(apiLogin.body, persona);
  if (!body.ok) return { ok: false, detail: body.detail };

  let answer: Awaited<ReturnType<FetchLike>>;
  try {
    answer = await fetchImpl(url.toString(), {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: body.value,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    // Never the error's own text beyond its first line: a failed request can quote the body it sent.
    return { ok: false, detail: `The request for a session did not complete: ${firstLine(error)}` };
  }
  if (!answer.ok) {
    // The status, and nothing else. A rejected sign-in's body routinely echoes what was sent.
    return { ok: false, detail: `${url.origin}${url.pathname} answered ${answer.status} rather than giving a session.` };
  }

  const text = (await answer.text().catch(() => "")).slice(0, MAX_RESPONSE_BYTES);
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, detail: "The answer was not JSON, so there was nowhere to read a token from." };
  }
  const token = readPath(parsed, apiLogin.tokenPath);
  if (typeof token !== "string" || token.length === 0) {
    return { ok: false, detail: `There is no token at "${apiLogin.tokenPath}" in the answer.` };
  }

  const seed: PersonaSessionSeed = apiLogin.target.kind === "COOKIE"
    ? { cookies: [{ name: apiLogin.target.name, value: token }], storage: [] }
    : { cookies: [], storage: [{ key: apiLogin.target.name, value: token }] };
  return { ok: true, storageState: storageStateFromSeed(seed, targetUrl), token };
}

/**
 * `{{email}}` becomes the persona's stored `email`. A placeholder with nothing behind it fails the request
 * rather than sending the literal `{{password}}` to somebody's sign-in endpoint.
 */
function fillCredentials(template: string, persona: TestPersona): { ok: true; value: string } | { ok: false; detail: string } {
  const missing: string[] = [];
  const filled = template.replace(/\{\{\s*([A-Za-z0-9_.-]{1,100})\s*\}\}/g, (_match, field: string) => {
    const credential = persona.credentials.find((candidate) => candidate.field.toLowerCase() === field.toLowerCase());
    if (!credential) {
      missing.push(field);
      return "";
    }
    // Into a JSON body, so it is escaped as JSON: a password with a quote in it must not break the request.
    return JSON.stringify(credential.value).slice(1, -1);
  });
  return missing.length > 0
    ? { ok: false, detail: `This persona has no stored ${missing.join(" or ")} to send.` }
    : { ok: true, value: filled };
}

/** `data.accessToken` out of a parsed JSON answer. Arrays are addressed by index, as a path naturally reads. */
function readPath(value: unknown, path: string): unknown {
  let current = value;
  for (const segment of path.split(".")) {
    if (segment.length === 0) continue;
    if (current === null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

function firstLine(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return (message.split(/\r?\n/)[0] ?? "").slice(0, 200);
}
