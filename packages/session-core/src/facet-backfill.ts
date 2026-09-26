import { depsLogger, type SessionCoreDeps } from './deps';
import { SESSION_FACET_VERSION, computeSessionFacet, type SessionRowForFacet } from './facets';
import { loadSessionEvents } from './load-session';
import { computeStatistics } from './complete-session';

/**
 * Builds facets for sessions that completed without one.
 *
 * Two jobs, both necessary. It backfills the existing corpus, which is otherwise
 * unsearchable — every session completed before SessionFacet existed. And it is what
 * lets a new facet field ship later: bump SESSION_FACET_VERSION and the stale rows are
 * rebuilt at a rate-limited pace, instead of needing 500k sessions re-completed.
 */

export interface FacetBackfillResult {
  candidates: number;
  rebuilt: number;
  skipped: number;
  failed: number;
}

export async function backfillSessionFacets(
  deps: SessionCoreDeps,
  options: { batchSize?: number } = {},
): Promise<FacetBackfillResult> {
  const { prisma } = deps;
  const logger = depsLogger(deps);
  const batchSize = options.batchSize ?? 200;

  // Rides the `Session_facet_stale_idx` partial index, so this stays proportional to
  // the work outstanding rather than to the size of the corpus.
  const candidates = await prisma.session.findMany({
    where: {
      completedAt: { not: null },
      OR: [{ facetVersion: null }, { facetVersion: { lt: SESSION_FACET_VERSION } }],
    },
    select: {
      id: true, applicationId: true, environmentId: true, tenantId: true, qaRunId: true,
      anonymousId: true, endUserId: true, deviceType: true, browserName: true,
      osName: true, releaseVersion: true, sampleRate: true,
    },
    orderBy: { completedAt: 'desc' },
    take: batchSize,
  });

  const result: FacetBackfillResult = {
    candidates: candidates.length, rebuilt: 0, skipped: 0, failed: 0,
  };

  for (const session of candidates) {
    try {
      const events = await loadSessionEvents(prisma, session.id);
      if (events.length === 0) {
        // A completed session with no events cannot be summarised. Stamp it so the
        // candidate query stops returning it every tick.
        await prisma.session.update({
          where: { id: session.id },
          data: { facetVersion: SESSION_FACET_VERSION },
        });
        result.skipped += 1;
        continue;
      }

      const facet = computeSessionFacet({
        session: session as SessionRowForFacet,
        events,
        statistics: computeStatistics(events),
      });

      // The flow-shaped fields are deliberately left alone: only the graph projection
      // knows them, and overwriting them with empty arrays here would erase a correct
      // enrichment. They are set by projectSessionIntoGraph.
      await prisma.$transaction([
        prisma.sessionFacet.upsert({
          where: { sessionId: session.id },
          create: facet,
          update: facet,
        }),
        prisma.session.update({
          where: { id: session.id },
          data: { facetVersion: facet.facetVersion },
        }),
      ]);
      result.rebuilt += 1;
    } catch (err) {
      // One unsummarisable session must not stop the backfill for every other one.
      result.failed += 1;
      logger.error(`[session-core] Facet backfill failed for ${session.id}`, err);
    }
  }

  if (result.rebuilt || result.failed) {
    logger.log(
      `[session-core] Backfilled ${result.rebuilt} facet(s) `
      + `(candidates=${result.candidates} skipped=${result.skipped} failed=${result.failed})`,
    );
  }
  return result;
}
