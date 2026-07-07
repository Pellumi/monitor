import { PrismaClient } from '@sots/db';
import type { Request, Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from './index';

/**
 * DB-backed system admin check.
 *
 * Replaces the legacy SYSTEM_ADMIN_USER_IDS env var approach.
 * A user is a system admin if there is an active SystemAdmin record
 * (revokedAt IS NULL) for their userId.
 */
export async function isSystemAdmin(
  prisma: PrismaClient,
  userId: string,
): Promise<boolean> {
  try {
    const record = await prisma.systemAdmin.findFirst({
      where: {
        userId,
        revokedAt: null,
      },
      select: { id: true },
    });
    return record !== null;
  } catch {
    return false;
  }
}

/**
 * Middleware factory. Requires the authenticated user to be an active
 * system admin (DB-backed). Responds with 403 if not.
 *
 * Usage:
 *   app.use('/v1/admin', makeRequireSystemAdmin(prisma));
 */
export function makeRequireSystemAdmin(prisma: PrismaClient) {
  return async function requireSystemAdmin(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    if (!req.user?.id) {
      res.status(401).json({ error: 'UNAUTHORIZED' });
      return;
    }
    const admin = await isSystemAdmin(prisma, req.user.id);
    if (!admin) {
      res.status(403).json({
        error: 'FORBIDDEN',
        message: 'System admin access required',
      });
      return;
    }
    next();
  };
}

/**
 * Helper: Grant system admin to a user.
 * Only callable programmatically (e.g. seed scripts, bootstrap route).
 */
export async function grantSystemAdmin(
  prisma: PrismaClient,
  params: {
    userId: string;
    grantedBy?: string | null;
    scope?: 'FULL' | 'RULESETS_ONLY' | 'READ_ONLY';
    notes?: string;
  },
): Promise<void> {
  await prisma.systemAdmin.upsert({
    where: { userId: params.userId },
    create: {
      userId: params.userId,
      grantedBy: params.grantedBy ?? null,
      scope: params.scope ?? 'FULL',
      notes: params.notes ?? null,
      revokedAt: null,
    },
    update: {
      scope: params.scope ?? 'FULL',
      grantedBy: params.grantedBy ?? null,
      notes: params.notes ?? null,
      revokedAt: null, // Re-activate if previously revoked
    },
  });
}

/**
 * Helper: Revoke system admin from a user.
 */
export async function revokeSystemAdmin(
  prisma: PrismaClient,
  userId: string,
): Promise<void> {
  await prisma.systemAdmin.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
