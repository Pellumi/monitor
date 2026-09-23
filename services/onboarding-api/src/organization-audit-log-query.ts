import { AuditAction, Prisma, PrismaClient } from '@tellann/db';

export type OrganizationAuditLogFilters = {
  organizationId: string;
  page: number;
  limit: number;
  query?: string;
  action?: AuditAction;
  from?: Date;
  to?: Date;
};

type RawAuditLogEntry = {
  id: string;
  userId: string | null;
  organizationId: string | null;
  action: AuditAction;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: Prisma.JsonValue | null;
  createdAt: Date;
  userEmail: string | null;
  userDisplayName: string | null;
};

export type OrganizationAuditLogEntry = Omit<RawAuditLogEntry, 'userEmail' | 'userDisplayName'> & {
  user: { email: string; displayName: string | null } | null;
};

export function parseAuditLogTimestamp(value: unknown, field: 'from' | 'to'): Date | undefined {
  if (typeof value !== 'string' || value.trim() === '') return undefined;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`INVALID_${field.toUpperCase()}`);
  }
  return parsed;
}

function literalContainsPattern(value: string): string {
  return `%${value.replace(/[\\%_]/g, '\\$&')}%`;
}

export async function findOrganizationAuditLogs(
  prisma: PrismaClient,
  filters: OrganizationAuditLogFilters,
): Promise<{ data: OrganizationAuditLogEntry[]; total: number }> {
  const clauses: Prisma.Sql[] = [Prisma.sql`audit."organizationId" = ${filters.organizationId}`];

  if (filters.action) clauses.push(Prisma.sql`audit."action"::text = ${filters.action}`);
  if (filters.from) clauses.push(Prisma.sql`audit."createdAt" >= ${filters.from}`);
  if (filters.to) clauses.push(Prisma.sql`audit."createdAt" <= ${filters.to}`);

  const query = filters.query?.trim();
  if (query) {
    const pattern = literalContainsPattern(query);
    const actionPattern = literalContainsPattern(query.replace(/[\s-]+/g, '_'));
    clauses.push(Prisma.sql`(
      audit."id" ILIKE ${pattern} ESCAPE '\\'
      OR COALESCE(audit."userId", '') ILIKE ${pattern} ESCAPE '\\'
      OR audit."action"::text ILIKE ${actionPattern} ESCAPE '\\'
      OR COALESCE(audit."ipAddress", '') ILIKE ${pattern} ESCAPE '\\'
      OR COALESCE(audit."userAgent", '') ILIKE ${pattern} ESCAPE '\\'
      OR COALESCE(audit."metadata"::text, '') ILIKE ${pattern} ESCAPE '\\'
      OR COALESCE(actor."email", '') ILIKE ${pattern} ESCAPE '\\'
      OR COALESCE(actor."displayName", '') ILIKE ${pattern} ESCAPE '\\'
    )`);
  }

  const where = Prisma.sql`WHERE ${Prisma.join(clauses, ' AND ')}`;
  const offset = (filters.page - 1) * filters.limit;

  const [rows, totals] = await Promise.all([
    prisma.$queryRaw<RawAuditLogEntry[]>(Prisma.sql`
      SELECT
        audit."id",
        audit."userId",
        audit."organizationId",
        audit."action",
        audit."ipAddress",
        audit."userAgent",
        audit."metadata",
        audit."createdAt",
        actor."email" AS "userEmail",
        actor."displayName" AS "userDisplayName"
      FROM "AuditLog" AS audit
      LEFT JOIN "User" AS actor ON actor."id" = audit."userId"
      ${where}
      ORDER BY audit."createdAt" DESC
      LIMIT ${filters.limit}
      OFFSET ${offset}
    `),
    prisma.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
      SELECT COUNT(*)::bigint AS "count"
      FROM "AuditLog" AS audit
      LEFT JOIN "User" AS actor ON actor."id" = audit."userId"
      ${where}
    `),
  ]);

  return {
    data: rows.map(({ userEmail, userDisplayName, ...entry }) => ({
      ...entry,
      user: userEmail ? { email: userEmail, displayName: userDisplayName } : null,
    })),
    total: Number(totals[0]?.count ?? 0),
  };
}
