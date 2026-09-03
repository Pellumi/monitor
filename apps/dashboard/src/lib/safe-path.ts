/**
 * Narrows a redirect target to somewhere inside this app.
 *
 * `from` values arrive from query strings, so they are attacker-controlled and
 * are the classic open-redirect vector: a crafted sign-in link would otherwise
 * hand a freshly authenticated user to another origin. Anything that could
 * leave this origin — an absolute URL, a protocol-relative `//host`, a
 * backslash the browser normalises to a slash — is discarded rather than
 * repaired, so a redirect can only ever land on our own routes.
 *
 * Shared by the middleware and the sign-in page, and deliberately free of
 * server-only imports so both bundles can use it.
 */
export function safeInternalPath(raw: string | null | undefined): string | null {
  if (!raw || !raw.startsWith('/')) return null;
  if (raw.startsWith('//') || raw.startsWith('/\\')) return null;
  return raw;
}
