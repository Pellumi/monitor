import { AuditAction, PrismaClient } from '@sots/db';

/**
 * Writes a single entry to the AuditLog table.
 *
 * IMPORTANT: This function swallows its own errors intentionally.
 * Audit log write failures must NEVER cause the primary API operation to fail.
 * All errors are logged to console for observability.
 */
export async function writeAuditLog(
  prisma: PrismaClient,
  params: {
    action: AuditAction;
    userId?: string | null;
    organizationId?: string | null;
    applicationId?: string | null;
    ipAddress?: string | null;
    userAgent?: string | null;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        action: params.action,
        userId: params.userId ?? null,
        organizationId: params.organizationId ?? null,
        ipAddress: params.ipAddress ?? null,
        userAgent: params.userAgent ?? null,
        metadata: {
          ...(params.applicationId ? { applicationId: params.applicationId } : {}),
          ...(params.metadata ?? {}),
        },
      },
    });
  } catch (err) {
    // Intentional swallow — audit failures must not break primary operations
    console.error('[audit] Failed to write audit log', {
      action: params.action,
      userId: params.userId,
      organizationId: params.organizationId,
      err,
    });
  }
}

/**
 * Helper to extract audit context from an Express Request object.
 */
export function extractAuditContext(req: {
  ip?: string;
  headers: Record<string, string | string[] | undefined>;
}): { ipAddress: string | null; userAgent: string | null } {
  return {
    ipAddress: (req.headers['x-forwarded-for'] as string) || req.ip || null,
    userAgent: (req.headers['user-agent'] as string) || null,
  };
}
