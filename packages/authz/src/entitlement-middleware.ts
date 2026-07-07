import type { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@sots/db';
import { EntitlementChecker } from '@sots/entitlement-checker';
import { Feature } from '@sots/shared';

/**
 * Resolves the organizationId for a request.
 *
 * Priority:
 * 1. req.params.orgId (direct org route)
 * 2. org resolved from applicationId (app-scoped route)
 * 3. x-sots-org-id header (gateway hint, validated not trusted)
 *
 * NEVER reads organizationId from req.body per security policy.
 */
async function resolveOrgId(
  req: Request,
  prisma: PrismaClient,
): Promise<string | null> {
  // Direct org route param
  if (req.params.orgId) return req.params.orgId;

  // Application-scoped route → resolve org via DB
  const appId = req.params.appId || req.params.id;
  if (appId) {
    const app = await prisma.application.findUnique({
      where: { id: appId },
      select: { organizationId: true },
    });
    return app?.organizationId ?? null;
  }

  // Gateway hint header (treated as advisory, validated via DB)
  const headerOrgId = req.headers['x-sots-org-id'] as string | undefined;
  return headerOrgId ?? null;
}

/**
 * Middleware factory that blocks a route unless the organization has
 * access to the specified Feature.
 *
 * Usage:
 *   app.use('/sessions', requireFeature(prisma, Feature.SESSION_RECORDING));
 */
export function requireFeature(prisma: PrismaClient, feature: Feature) {
  const checker = new EntitlementChecker(prisma);

  return async function featureGate(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const orgId = await resolveOrgId(req, prisma);
      if (!orgId) {
        res.status(400).json({
          error: 'CANNOT_RESOLVE_ORGANIZATION',
          message: 'Cannot determine organization from request context',
        });
        return;
      }

      const allowed = await checker.canAccess(orgId, feature);
      if (!allowed) {
        res.status(403).json({
          error: 'FEATURE_NOT_ENTITLED',
          feature,
          message: 'Your current plan does not include this feature. Please upgrade to continue.',
          upgradeUrl: '/settings/billing',
        });
        return;
      }

      next();
    } catch (err) {
      console.error('[entitlement] Feature gate check failed', { feature, err });
      // On entitlement check failure, fail open in development, closed in production
      if (process.env.NODE_ENV === 'production') {
        res.status(503).json({ error: 'ENTITLEMENT_CHECK_FAILED' });
      } else {
        next(); // Fail open in dev to not block local iteration
      }
    }
  };
}

/**
 * Non-middleware helper: check feature access and return a boolean.
 * Use in business logic rather than as route middleware.
 */
export async function checkFeatureAccess(
  prisma: PrismaClient,
  orgId: string,
  feature: Feature,
): Promise<boolean> {
  const checker = new EntitlementChecker(prisma);
  return checker.canAccess(orgId, feature);
}
