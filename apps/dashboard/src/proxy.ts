import { NextRequest, NextResponse } from 'next/server';
import { safeInternalPath } from '@/lib/safe-path';

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - api (api routes, including the /api-gateway rewrite)
     *
     * `/auth` is deliberately matched: the sign-in page itself needs a decision
     * about visitors who already hold a session.
     */
    '/((?!_next/static|_next/image|favicon.ico|api).*)',
  ],
};

/** The only /auth route this middleware makes a decision about. */
const LOGIN_PATH = '/auth/login';

/**
 * Set on the login URL by anything that sends an authenticated-looking browser
 * back to sign in. Without it, a session whose cookies survive but whose server
 * state is gone would bounce between the login page and the app forever.
 */
const REAUTH_PARAM = 'reauth';

/**
 * Parameters that give the sign-in page work to do beyond authenticating —
 * completing a desktop authorization, claiming an invitation. Redirecting a
 * signed-in visitor away from those would abandon the flow they followed the
 * link for, so the page is left to handle them.
 */
const STANDALONE_FLOW_PARAMS = ['desktopRequest', 'invite'];

/**
 * Files served straight out of `public/` — the logo and favicons among them.
 * They are not pages, and redirecting them to the sign-in HTML leaves a
 * signed-out visitor looking at a login screen with broken images.
 */
const STATIC_ASSET = /\.[a-z0-9]+$/i;

export function proxy(request: NextRequest) {
  const { pathname, search, searchParams } = request.nextUrl;

  if (STATIC_ASSET.test(pathname)) return NextResponse.next();

  const accessToken = request.cookies.get('access_token')?.value;
  const refreshToken = request.cookies.get('refresh_token')?.value;
  // The access token cookie expires with the token it carries, so a signed-in
  // browser routinely holds only the refresh token. Presence of either means
  // "has a session to try", not "is authenticated" — the API decides that.
  const hasSession = Boolean(accessToken || refreshToken);

  if (pathname.startsWith('/auth')) {
    // Sign-out, desktop hand-off and the rest of /auth must stay reachable
    // whatever the cookie state.
    if (pathname !== LOGIN_PATH) return NextResponse.next();
    if (!hasSession || searchParams.has(REAUTH_PARAM)) return NextResponse.next();
    if (STANDALONE_FLOW_PARAMS.some((param) => searchParams.has(param))) {
      return NextResponse.next();
    }

    // Already signed in: continue to wherever they were headed instead of
    // asking for credentials again.
    const destination = new URL(
      safeInternalPath(searchParams.get('from')) ?? '/',
      request.url,
    );
    destination.searchParams.set('notice', 'already-signed-in');
    return NextResponse.redirect(destination);
  }

  if (!hasSession) {
    const loginUrl = new URL(LOGIN_PATH, request.url);
    // Round-trips the full target, query string included, so a deep link
    // survives the detour through sign-in.
    loginUrl.searchParams.set('from', `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}
