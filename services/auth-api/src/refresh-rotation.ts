/**
 * Refresh-token rotation classification.
 *
 * Kept apart from index.ts so it can be exercised without booting the service or
 * a database — the whole point of the grace window is a set of timing edges, and
 * those are only cheap to test in isolation.
 */

/**
 * How long a just-superseded refresh token stays usable.
 *
 * Rotating a token the instant a new one is issued cannot distinguish a request
 * that raced the rotation — a second tab, an in-flight retry, a reload landing
 * mid-rotation — from a stolen token, and the honest client loses either way.
 * Inside this window the presenter is handed a fresh pair off the same session
 * row; outside it, presenting a superseded token is unambiguous reuse.
 */
export const REFRESH_GRACE_MS = Number(process.env.AUTH_REFRESH_GRACE_MS || 30_000);

export interface RotatableSession {
  refreshTokenHash: string;
  previousRefreshTokenHash: string | null;
  rotatedAt: Date | null;
  revokedAt: Date | null;
  expiresAt: Date;
}

export type RotationLookup<T> =
  | { status: 'CURRENT' | 'GRACE' | 'REUSED'; session: T }
  | { status: 'UNKNOWN'; session: null };

/**
 * Classifies a presented refresh token against the session that owns it, so the
 * caller can tell "still valid", "raced a rotation" and "replayed after the
 * grace window" apart. `revokedAt`/`expiresAt` are checked here so an already
 * dead session never reads as reuse — there is nothing left to revoke, and
 * reporting theft for an ordinary expiry would be noise.
 */
export function classifyRotation<T extends RotatableSession>(
  session: T | null,
  presentedHash: string,
  now: Date = new Date(),
): RotationLookup<T> {
  if (!session || session.revokedAt || session.expiresAt <= now) {
    return { status: 'UNKNOWN', session: null };
  }
  if (session.refreshTokenHash === presentedHash) {
    return { status: 'CURRENT', session };
  }
  const rotatedAt = session.rotatedAt?.getTime() ?? 0;
  if (now.getTime() - rotatedAt <= REFRESH_GRACE_MS) {
    return { status: 'GRACE', session };
  }
  return { status: 'REUSED', session };
}
