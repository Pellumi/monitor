import { Prisma, PrismaClient } from '@tellann/db';

/**
 * The protected values of a run that the reader can actually reveal.
 *
 * A protected value only has something to reveal when it was stored encrypted:
 * an `ORDINARY` value with its ciphertext. Pseudonymized identifiers and
 * secrets are one-way by design, so listing them would be a column of rows that
 * can only ever say "not revealable". They are left out here rather than shown
 * and disabled.
 */

export const PROTECTED_VALUE_PARTS = ['requestBody', 'responseBody', 'query', 'other'] as const;
export type ProtectedValuePart = (typeof PROTECTED_VALUE_PARTS)[number];

export type ProtectedValueFilters = {
  runId: string;
  page: number;
  pageSize: number;
  query?: string;
  part?: ProtectedValuePart;
  method?: string;
};

export type ProtectedValueItem = {
  id: string;
  keyPath: string;
  displayValue: string;
  valueLength: number;
  eventType: string;
  route: string | null;
  method: string | null;
  statusCode: number | null;
  occurredAt: string;
};

type RawRow = Omit<ProtectedValueItem, 'occurredAt'> & { occurredAt: Date };

function literalContainsPattern(value: string): string {
  return `%${value.replace(/[\\%_]/g, '\\$&')}%`;
}

const REVEALABLE = Prisma.sql`pv."kind" = 'ORDINARY' AND pv."ciphertext" IS NOT NULL AND pv."iv" IS NOT NULL AND pv."authTag" IS NOT NULL`;
const ROUTE = Prisma.sql`COALESCE(ev."metadata"->>'route', ev."normalizedRoute")`;

function partPredicate(part: ProtectedValuePart): Prisma.Sql {
  if (part === 'other') {
    return Prisma.sql`pv."keyPath" NOT LIKE 'requestBody%' AND pv."keyPath" NOT LIKE 'responseBody%' AND pv."keyPath" NOT LIKE 'query%'`;
  }
  return Prisma.sql`pv."keyPath" LIKE ${`${part}%`}`;
}

export async function findRevealableProtectedValues(
  prisma: PrismaClient,
  filters: ProtectedValueFilters,
): Promise<{ items: ProtectedValueItem[]; total: number }> {
  const clauses: Prisma.Sql[] = [Prisma.sql`ev."runId" = ${filters.runId}`, REVEALABLE];
  if (filters.part) clauses.push(partPredicate(filters.part));
  if (filters.method) clauses.push(Prisma.sql`UPPER(COALESCE(ev."metadata"->>'method', '')) = ${filters.method.toUpperCase()}`);
  const query = filters.query?.trim();
  if (query) {
    const pattern = literalContainsPattern(query.slice(0, 200));
    clauses.push(Prisma.sql`CONCAT_WS(' ', pv."keyPath", ${ROUTE}, ev."metadata"->>'method', ev."eventType") ILIKE ${pattern} ESCAPE '\\'`);
  }
  const where = Prisma.sql`WHERE ${Prisma.join(clauses, ' AND ')}`;
  const offset = (filters.page - 1) * filters.pageSize;

  const [rows, totals] = await Promise.all([
    prisma.$queryRaw<RawRow[]>(Prisma.sql`
      SELECT
        pv."id",
        pv."keyPath",
        pv."displayValue",
        pv."valueLength",
        ev."eventType",
        ${ROUTE} AS "route",
        ev."metadata"->>'method' AS "method",
        (CASE WHEN ev."metadata"->>'statusCode' ~ '^[0-9]{3}$' THEN (ev."metadata"->>'statusCode')::int END) AS "statusCode",
        ev."occurredAt"
      FROM "QARunProtectedValue" AS pv
      JOIN "QARunEvidenceEvent" AS ev ON ev."id" = pv."evidenceEventId"
      ${where}
      ORDER BY ev."occurredAt" DESC, pv."keyPath" ASC, pv."id" ASC
      LIMIT ${filters.pageSize}
      OFFSET ${offset}
    `),
    prisma.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
      SELECT COUNT(*)::bigint AS "count"
      FROM "QARunProtectedValue" AS pv
      JOIN "QARunEvidenceEvent" AS ev ON ev."id" = pv."evidenceEventId"
      ${where}
    `),
  ]);

  return {
    items: rows.map((row) => ({ ...row, occurredAt: row.occurredAt.toISOString() })),
    total: Number(totals[0]?.count ?? 0),
  };
}
