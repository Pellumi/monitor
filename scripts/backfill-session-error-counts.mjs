#!/usr/bin/env node
/**
 * Recomputes `SessionStatistic.errorCount` for existing sessions.
 *
 * Statistics used to count only `ERROR_EVENT`, so a session full of
 * `UNHANDLED_EXCEPTION`, `SERVER_ERROR`, `CLIENT_ERROR` or `ERROR_OCCURRED`
 * reported zero errors in the dashboard and an empty Errors panel in the
 * replay. The engine now counts every error-shaped type, but rows written
 * before that are still wrong and nothing recomputes them on its own.
 *
 * Idempotent and re-runnable: it writes only where the stored count differs
 * from the recomputed one.
 *
 *   node scripts/backfill-session-error-counts.mjs [--dry-run] [--batch 500]
 */
import { PrismaClient } from '@tellann/db';
import { ERROR_EVENT_TYPES } from '@tellann/shared';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const batchIndex = args.indexOf('--batch');
const batchSize = batchIndex >= 0 ? Number(args[batchIndex + 1]) || 500 : 500;

const prisma = new PrismaClient();

async function main() {
  console.log(
    `[backfill] recomputing error counts over ${ERROR_EVENT_TYPES.join(', ')}`
    + `${dryRun ? ' (dry run)' : ''}`,
  );

  let cursor = null;
  let scanned = 0;
  let corrected = 0;

  for (;;) {
    const statistics = await prisma.sessionStatistic.findMany({
      take: batchSize,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: 'asc' },
      select: { id: true, sessionId: true, errorCount: true },
    });
    if (!statistics.length) break;
    cursor = statistics[statistics.length - 1].id;

    for (const statistic of statistics) {
      scanned += 1;
      const errorCount = await prisma.sessionEvent.count({
        where: { sessionId: statistic.sessionId, eventType: { in: [...ERROR_EVENT_TYPES] } },
      });
      if (errorCount === statistic.errorCount) continue;
      corrected += 1;
      if (dryRun) {
        console.log(`[backfill] ${statistic.sessionId}: ${statistic.errorCount} -> ${errorCount}`);
        continue;
      }
      await prisma.sessionStatistic.update({ where: { id: statistic.id }, data: { errorCount } });
    }
    console.log(`[backfill] scanned ${scanned}, corrected ${corrected}`);
  }

  console.log(
    `[backfill] complete: ${corrected} of ${scanned} session statistic rows `
    + `${dryRun ? 'would be' : 'were'} corrected`,
  );
}

main()
  .catch((error) => {
    console.error('[backfill] failed', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
