import type { NextFunction, Request, Response } from 'express';
import type { PrismaClient } from '@tellann/db';
import jwt from 'jsonwebtoken';

/**
 * Caller identity and application ownership for this service.
 *
 * Deliberately a sibling of `services/report-engine/src/auth.ts` rather than a
 * shared package: every service in this repo verifies its own caller with its
 * own `jsonwebtoken` (see usage-tracker, onboarding-api, fdrs-api, billing-api),
 * and a shared middleware package would have to take on that dependency for
 * all of them.
 *
 * The gateway does not resolve identity for a dashboard request: it returns
 * early whenever there is no `Authorization: Bearer` header and injects no
 * `x-tellann-*` headers, so the cookie arrives unparsed. Every service that
 * enforces tenancy therefore verifies locally — see `services/usage-tracker`
 * and `services/onboarding-api`. This is that same guard, kept deliberately
 * self-contained rather than trusting anything the gateway may or may not have
 * added, because inbound `x-tellann-*` headers are never stripped from a
 * client request.
 */
export interface CallerRequest extends Request {
  user?: { id: string; email?: string };
  /** True when a trusted sibling service called, not a person. */
  internal?: boolean;
}

const JWT_SECRET = process.env.JWT_SECRET || 'tellann-default-jwt-secret-change-in-production';

function bearerOrCookieToken(req: Request): string {
  const authorization = req.headers.authorization;
  const bearer = authorization?.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  if (bearer) return bearer;
  const cookie = req.headers.cookie;
  if (!cookie) return '';
  const jar = Object.fromEntries(cookie.split(';').map((item) => {
    const separator = item.indexOf('=');
    return separator < 0 ? [item.trim(), ''] : [item.slice(0, separator).trim(), item.slice(separator + 1)];
  }));
  return jar.access_token || '';
}

export function createCallerGuards(prisma: PrismaClient, options: {
  serviceName: string;
  /** Env var holding the shared secret sibling services call with. */
  internalSecretEnv: string;
}) {
  let warnedAboutMissingSecret = false;

  /**
   * Internal service-to-service calls carry no user. They use the same shared
   * secret convention as `POST /billing/internal/billing-cycle`.
   *
   * In production an unset secret means internal callers are simply rejected —
   * an open door is never the safer default. Locally, where the secret is
   * usually unconfigured, an unauthenticated call is treated as internal so the
   * development stack keeps working, and says so loudly once.
   */
  function resolveInternal(req: Request): boolean {
    const configured = process.env[options.internalSecretEnv]?.trim();
    const presented = req.headers['x-tellann-internal-secret'];
    if (configured) return typeof presented === 'string' && presented === configured;
    if (process.env.NODE_ENV === 'production') return false;
    if (!warnedAboutMissingSecret) {
      warnedAboutMissingSecret = true;
      console.warn(
        `[${options.serviceName}] ${options.internalSecretEnv} is not set. `
        + 'Unauthenticated requests are being treated as internal service calls, '
        + 'which is only acceptable outside production.',
      );
    }
    return true;
  }

  function verifyCaller(req: CallerRequest, res: Response, next: NextFunction) {
    const token = bearerOrCookieToken(req);
    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET) as { sub?: string; email?: string };
        if (decoded.sub) {
          req.user = { id: decoded.sub, email: decoded.email };
          return next();
        }
      } catch {
        return res.status(401).json({ error: 'UNAUTHORIZED' });
      }
      return res.status(401).json({ error: 'UNAUTHORIZED' });
    }
    // An internal secret is only honoured when no user token was presented, so
    // a real session is always attributed to the person behind it.
    if (resolveInternal(req)) {
      req.internal = true;
      return next();
    }
    return res.status(401).json({ error: 'UNAUTHORIZED' });
  }

  /**
   * Asserts the caller belongs to the organization owning an application.
   *
   * Returns the resolved organization id, or null once it has answered the
   * request itself. A run or application the caller cannot see answers 404
   * rather than 403, matching the convention in `desktop-routes.ts`: the
   * existence of another tenant's resource is not something to confirm.
   */
  async function assertApplicationAccess(
    req: CallerRequest,
    res: Response,
    applicationId: string,
  ): Promise<{ organizationId: string | null } | null> {
    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      select: { organizationId: true },
    });
    if (!application) {
      res.status(404).json({ error: 'Application not found' });
      return null;
    }
    if (req.internal) return { organizationId: application.organizationId };
    // An application outside an organization predates tenancy and has no
    // membership to check against.
    if (!application.organizationId) return { organizationId: null };
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'UNAUTHORIZED' });
      return null;
    }
    const membership = await prisma.organizationMembership.findUnique({
      where: { userId_organizationId: { userId, organizationId: application.organizationId } },
      select: { id: true },
    });
    if (!membership) {
      res.status(404).json({ error: 'Application not found' });
      return null;
    }
    return { organizationId: application.organizationId };
  }

  /** Route-param form of `assertApplicationAccess`, never reading the body. */
  function requireApplicationAccess(param = 'id') {
    return async (req: CallerRequest, res: Response, next: NextFunction) => {
      const applicationId = req.params[param];
      if (!applicationId) return res.status(400).json({ error: 'APPLICATION_REQUIRED' });
      try {
        const access = await assertApplicationAccess(req, res, applicationId);
        if (!access) return;
        next();
      } catch (err) {
        console.error(`[${options.serviceName}] Application access check failed`, err);
        res.status(500).json({ error: 'Internal server error' });
      }
    };
  }

  return { verifyCaller, requireApplicationAccess, assertApplicationAccess };
}
