import type { Request, Response, NextFunction } from 'express';
import { MemberRole, PrismaClient } from '@tellann/db';

// ─────────────────────────────────────────────────────────────
// Permission constants
// ─────────────────────────────────────────────────────────────

export const Permissions = {
  RULESET_READ: 'ruleset:read',
  RULESET_WRITE: 'ruleset:write',
  RULESET_PROMOTE: 'ruleset:promote',

  FLOW_READ: 'flow:read',
  FLOW_WRITE: 'flow:write',
  FLOW_DELETE: 'flow:delete',
  FLOW_COMPLETE: 'flow:complete',
  FLOW_REOPEN: 'flow:reopen',

  AI_DRAFT_CREATE: 'ai:draft:create',
  AI_SUGGESTION_CREATE: 'ai:suggestion:create',
  AI_SUGGESTION_ACCEPT: 'ai:suggestion:accept',

  GRAPH_VERSION_READ: 'graph_version:read',
  GRAPH_VERSION_WRITE: 'graph_version:write',
  GRAPH_VERSION_DELETE: 'graph_version:delete',

  REPORT_EXPORT: 'report:export',
  AUDIT_READ: 'audit:read',
  PROFILE_UPDATE: 'profile:update',
  PREFERENCES_UPDATE: 'preferences:update',
  NOTIFICATIONS_UPDATE: 'notifications:update',
  ORGANIZATION_READ: 'organization:read',
  ORGANIZATION_UPDATE: 'organization:update',
  ORGANIZATION_DELETE: 'organization:delete',
  MEMBERS_READ: 'members:read',
  MEMBERS_INVITE: 'members:invite',
  MEMBERS_UPDATE: 'members:update',
  MEMBERS_REMOVE: 'members:remove',
  ROLES_MANAGE: 'roles:manage',
  SECURITY_READ: 'security:read',
  SECURITY_MANAGE: 'security:manage',
  SSO_MANAGE: 'sso:manage',
  INGESTION_KEYS_READ: 'ingestion_keys:read',
  INGESTION_KEYS_CREATE: 'ingestion_keys:create',
  INGESTION_KEYS_ROTATE: 'ingestion_keys:rotate',
  INGESTION_KEYS_REVOKE: 'ingestion_keys:revoke',
  PRIVACY_READ: 'privacy:read',
  PRIVACY_MANAGE: 'privacy:manage',
  RETENTION_READ: 'retention:read',
  RETENTION_MANAGE: 'retention:manage',
  INTEGRATIONS_READ: 'integrations:read',
  INTEGRATIONS_MANAGE: 'integrations:manage',
  AUDIT_EXPORT: 'audit:export',
  BILLING_READ: 'billing:read',
  BILLING_MANAGE: 'billing:manage',
} as const;

export type Permission = (typeof Permissions)[keyof typeof Permissions];

// ─────────────────────────────────────────────────────────────
// Role permission matrix
// ─────────────────────────────────────────────────────────────

const ROLE_PERMISSIONS: Record<MemberRole, Permission[]> = {
  [MemberRole.OWNER]: Object.values(Permissions) as Permission[],
  [MemberRole.ADMIN]: Object.values(Permissions) as Permission[],
  [MemberRole.MEMBER]: [
    Permissions.FLOW_READ,
    Permissions.FLOW_WRITE,
    Permissions.FLOW_COMPLETE,
    Permissions.FLOW_REOPEN,
    Permissions.AI_DRAFT_CREATE,
    Permissions.AI_SUGGESTION_CREATE,
    Permissions.AI_SUGGESTION_ACCEPT,
    Permissions.GRAPH_VERSION_READ,
    Permissions.GRAPH_VERSION_WRITE,
    Permissions.RULESET_READ,
    Permissions.REPORT_EXPORT,
    Permissions.ORGANIZATION_READ,
    Permissions.MEMBERS_READ,
    Permissions.SECURITY_READ,
    Permissions.INGESTION_KEYS_READ,
    Permissions.INGESTION_KEYS_CREATE,
    Permissions.INGESTION_KEYS_ROTATE,
    Permissions.INGESTION_KEYS_REVOKE,
    Permissions.PRIVACY_READ,
    Permissions.RETENTION_READ,
    Permissions.INTEGRATIONS_READ,
    Permissions.BILLING_READ,
  ],
  [MemberRole.VIEWER]: [
    Permissions.FLOW_READ,
    Permissions.GRAPH_VERSION_READ,
    Permissions.RULESET_READ,
    Permissions.ORGANIZATION_READ,
    Permissions.MEMBERS_READ,
    Permissions.SECURITY_READ,
    Permissions.INGESTION_KEYS_READ,
    Permissions.PRIVACY_READ,
    Permissions.RETENTION_READ,
    Permissions.INTEGRATIONS_READ,
    Permissions.BILLING_READ,
  ],
};

export function roleHasPermission(role: MemberRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function permissionsForRole(role: MemberRole): Permission[] {
  return [...(ROLE_PERMISSIONS[role] ?? [])];
}

// ─────────────────────────────────────────────────────────────
// Extended request type
// ─────────────────────────────────────────────────────────────

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    isSystemAdmin?: boolean;
  };
}

// ─────────────────────────────────────────────────────────────
// System admin check
//
// DB-backed check — see packages/authz/src/system-admin.ts
// Legacy env-var approach (SYSTEM_ADMIN_USER_IDS) is DEPRECATED.
// Use makeRequireSystemAdmin(prisma) from system-admin.ts instead.
// ─────────────────────────────────────────────────────────────

/** @deprecated Use makeRequireSystemAdmin(prisma) from './system-admin' */
function isSystemAdminLegacy(userId: string): boolean {
  const adminIds = (process.env.SYSTEM_ADMIN_USER_IDS || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
  return adminIds.includes(userId);
}

// ─────────────────────────────────────────────────────────────
// Middleware factories
// ─────────────────────────────────────────────────────────────

/**
 * Requires an authenticated user (JWT already decoded into req.user).
 * Use after verifyJwt.
 */
export function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): void {
  if (!req.user?.id) {
    res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
    return;
  }
  next();
}

/**
 * @deprecated Use makeRequireSystemAdmin(prisma) from './system-admin'.
 * This synchronous version is kept for backward compatibility during migration.
 * It uses the legacy SYSTEM_ADMIN_USER_IDS env var.
 */
export function requireSystemAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): void {
  if (!req.user?.id) {
    res.status(401).json({ error: 'UNAUTHORIZED' });
    return;
  }
  if (!isSystemAdminLegacy(req.user.id)) {
    res.status(403).json({ error: 'FORBIDDEN', message: 'System admin access required' });
    return;
  }
  next();
}

/**
 * Middleware factory. Verifies the authenticated user is a member of the
 * given organization. The organizationId is resolved from route params,
 * then query params, then never from the request body alone.
 */
export function makeRequireOrgMembership(prisma: PrismaClient) {
  return async function requireOrgMembership(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    const orgId = req.params.orgId || req.params.id;
    if (!orgId) {
      next();
      return;
    }
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'UNAUTHORIZED' });
      return;
    }
    try {
      const membership = await prisma.organizationMembership.findUnique({
        where: { userId_organizationId: { userId, organizationId: orgId } },
      });
      if (!membership) {
        res.status(403).json({ error: 'FORBIDDEN', message: 'Not a member of this organization' });
        return;
      }
      next();
    } catch (err) {
      console.error('[authz] requireOrgMembership error', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
}

/**
 * Middleware factory. Verifies the authenticated user has the required role
 * in the organization resolved from the route param.
 */
export function makeRequireOrgRole(prisma: PrismaClient, allowedRoles: MemberRole[]) {
  return async function requireOrgRole(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    const orgId = req.params.orgId || req.params.id;
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'UNAUTHORIZED' });
      return;
    }
    if (!orgId) {
      res.status(400).json({ error: 'BAD_REQUEST', message: 'Organization ID required' });
      return;
    }
    try {
      const membership = await prisma.organizationMembership.findUnique({
        where: { userId_organizationId: { userId, organizationId: orgId } },
      });
      if (!membership) {
        res.status(403).json({ error: 'FORBIDDEN', message: 'Not a member of this organization' });
        return;
      }
      if (!allowedRoles.includes(membership.role)) {
        res.status(403).json({
          error: 'FORBIDDEN',
          message: `Requires one of: ${allowedRoles.join(', ')}`,
        });
        return;
      }
      next();
    } catch (err) {
      console.error('[authz] requireOrgRole error', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
}

/** Requires a settings permission for the organization resolved from route params. */
export function makeRequireOrgPermission(prisma: PrismaClient, permission: Permission) {
  return async function requireOrgPermission(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    const orgId = req.params.orgId || req.params.id;
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'UNAUTHORIZED' });
      return;
    }
    if (!orgId) {
      res.status(400).json({ error: 'BAD_REQUEST', message: 'Organization ID required' });
      return;
    }
    const membership = await prisma.organizationMembership.findUnique({
      where: { userId_organizationId: { userId, organizationId: orgId } },
    });
    if (!membership || !roleHasPermission(membership.role, permission)) {
      res.status(403).json({ error: 'FORBIDDEN', message: `Requires permission: ${permission}` });
      return;
    }
    next();
  };
}

/**
 * Middleware factory. Verifies the authenticated user has the required
 * permission in the organization that owns the application.
 *
 * The applicationId is resolved from route params only — never body.
 */
export function makeRequireApplicationAccess(prisma: PrismaClient, permission: Permission) {
  return async function requireApplicationAccess(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    const appId = req.params.appId || req.params.id;
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'UNAUTHORIZED' });
      return;
    }
    if (!appId) {
      next();
      return;
    }
    try {
      const app = await prisma.application.findUnique({
        where: { id: appId },
        select: { organizationId: true },
      });
      if (!app) {
        res.status(404).json({ error: 'Application not found' });
        return;
      }
      if (!app.organizationId) {
        res.status(400).json({ error: 'Application has no organization' });
        return;
      }
      const membership = await prisma.organizationMembership.findUnique({
        where: { userId_organizationId: { userId, organizationId: app.organizationId } },
      });
      if (!membership) {
        res.status(403).json({ error: 'FORBIDDEN', message: 'Not a member of the organization owning this application' });
        return;
      }
      if (!roleHasPermission(membership.role, permission)) {
        res.status(403).json({
          error: 'FORBIDDEN',
          message: `Requires permission: ${permission}`,
        });
        return;
      }
      next();
    } catch (err) {
      console.error('[authz] requireApplicationAccess error', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
}

/**
 * Helper (non-middleware). Resolves membership for a given org + user.
 * Returns null if not a member.
 */
export async function resolveOrgMembership(
  prisma: PrismaClient,
  userId: string,
  organizationId: string,
) {
  return prisma.organizationMembership.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
  });
}

/**
 * Helper (non-middleware). Resolves organization ID from an application ID.
 * Returns null if not found.
 */
export async function resolveApplicationOrg(
  prisma: PrismaClient,
  applicationId: string,
): Promise<string | null> {
  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    select: { organizationId: true },
  });
  return app?.organizationId ?? null;
}

// ─────────────────────────────────────────────────────────────
// Re-exports from sub-modules
// ─────────────────────────────────────────────────────────────
export { writeAuditLog, extractAuditContext } from './audit';
export {
  isSystemAdmin,
  makeRequireSystemAdmin,
  grantSystemAdmin,
  revokeSystemAdmin,
} from './system-admin';
export { requireFeature, checkFeatureAccess } from './entitlement-middleware';
