import type { PrismaClient } from '@tellann/db';
import {
  detectFriction,
  outboxSink,
  runBehaviorRollup,
  type FrictionDetectionResult,
  type RollupResult,
  type SessionCoreDeps,
} from '@tellann/session-core';

/**
 * The daily pass that gives observed behaviour a time dimension.
 *
 * Runs over yesterday rather than today: a partial day would be rewritten on every tick and
 * any trend drawn from it would wobble for reasons that have nothing to do with the
 * application. Every write is an upsert keyed on the day, so a re-run is a no-op and a
 * backfill over already-computed days costs nothing but time.
 */

function coreDeps(prisma: PrismaClient): SessionCoreDeps {
  return { prisma, sink: outboxSink };
}

export async function runBehaviorRollupJob(prisma: PrismaClient): Promise<RollupResult> {
  // Two days, not one. A session that starts before midnight and completes after it is
  // facetted on the later day, so yesterday's rollup is only final once today has begun --
  // and re-running the day before is free.
  return runBehaviorRollup(coreDeps(prisma), { days: 2 });
}

export async function runFrictionDetectionJob(prisma: PrismaClient): Promise<FrictionDetectionResult> {
  // Seven days, so a finding reflects a pattern rather than one bad afternoon.
  return detectFriction(coreDeps(prisma), { windowDays: 7 });
}
