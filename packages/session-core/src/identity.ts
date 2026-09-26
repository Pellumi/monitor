import { createHash, createHmac, randomBytes } from 'node:crypto';
import { Prisma, type PrismaClient } from '@tellann/db';
import { depsLogger, type SessionCoreDeps } from './deps';

/**
 * Turning an asserted identity into a durable one.
 *
 * Every write here is a single `INSERT … ON CONFLICT` whose every clause is
 * `LEAST`/`GREATEST`/`COALESCE` or timestamp-guarded, and there is not one counter
 * anywhere. That is deliberate and load-bearing: Kafka replays with
 * `fromBeginning: true`, outbox delivery is at-least-once, and concurrent batches
 * for one session are normal, so applying the same assertion a hundred times or two
 * assertions out of order must converge to the same rows.
 */

export type IdentityMode = 'RAW' | 'HASHED' | 'DISABLED';

export interface PrivacyFloor {
  identityMode: IdentityMode;
  identitySalt: string;
  allowedTraitKeys: string[];
}

/** The default for an application that has never configured one. */
export const DEFAULT_IDENTITY_MODE: IdentityMode = 'HASHED';

export function generateIdentitySalt(): string {
  return randomBytes(32).toString('hex');
}

/**
 * The stable join key for an end user.
 *
 * Populated in every mode, including RAW, so a query matches the same rows before
 * and after a mode change and switching modes cannot fragment an identity. HMAC
 * rather than a plain digest so the per-application salt is a key, not a prefix an
 * attacker with the hash can brute-force around.
 */
export function hashExternalId(salt: string, externalId: string): string {
  return createHmac('sha256', salt).update(externalId).digest('hex');
}

/** A stable id for an anonymous browser, for logging without echoing the raw value. */
export function fingerprintAnonymousId(anonymousId: string): string {
  return createHash('sha256').update(anonymousId).digest('hex').slice(0, 16);
}

export interface AssertedIdentity {
  externalId: string | null;
  traits: Record<string, unknown> | null;
}

export interface FlooredIdentity {
  /** Null unless the mode is RAW. */
  externalId: string | null;
  /** Null only when there is no identity at all, or the mode is DISABLED. */
  externalIdHash: string | null;
  traits: Record<string, unknown> | null;
}

/**
 * Applies the application's privacy floor to an asserted identity.
 *
 * Runs before anything durable, and before the event reaches Kafka or a log line —
 * the SDK's `identify()` proposes, the server decides. This is the other half of
 * moving identity out of `metadata`: the sanitizer that used to (destructively)
 * cover traits no longer sees them, so the floor has to.
 */
export function applyPrivacyFloor(floor: PrivacyFloor, asserted: AssertedIdentity): FlooredIdentity {
  if (floor.identityMode === 'DISABLED' || !asserted.externalId) {
    return { externalId: null, externalIdHash: null, traits: null };
  }

  const externalIdHash = hashExternalId(floor.identitySalt, asserted.externalId);
  const allowed = new Set(floor.allowedTraitKeys);

  // An allow-list, not a deny-list. A deny-list is what produced the `userid`
  // collision: it can only block what someone thought of in advance.
  let traits: Record<string, unknown> | null = null;
  if (asserted.traits && allowed.size > 0) {
    const kept: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(asserted.traits)) {
      if (allowed.has(key)) kept[key] = value;
    }
    if (Object.keys(kept).length > 0) traits = kept;
  }

  return {
    externalId: floor.identityMode === 'RAW' ? asserted.externalId : null,
    externalIdHash,
    traits,
  };
}

// ─── Reading the floor, with a short cache ───────────────────────────────────

interface CachedFloor {
  floor: PrivacyFloor;
  expiresAt: number;
}

const floorCache = new Map<string, CachedFloor>();
const FLOOR_CACHE_TTL_MS = 60_000;

/**
 * The application's privacy floor, created on first use.
 *
 * Cached for a minute because this is on the ingest hot path. A tightened setting
 * therefore takes effect within a minute rather than instantly, which is the right
 * trade for a per-event lookup — and it only ever loosens what was already stored,
 * never retroactively exposes it.
 */
export async function resolvePrivacyFloor(
  prisma: PrismaClient,
  applicationId: string,
  now: number = Date.now(),
): Promise<PrivacyFloor> {
  const cached = floorCache.get(applicationId);
  if (cached && cached.expiresAt > now) return cached.floor;

  const existing = await prisma.applicationPrivacySetting.findUnique({ where: { applicationId } });

  let floor: PrivacyFloor;
  if (existing) {
    floor = {
      identityMode: existing.identityMode as IdentityMode,
      identitySalt: existing.identitySalt,
      allowedTraitKeys: existing.allowedTraitKeys,
    };
  } else {
    // Created rather than defaulted in memory, so the salt is stable: a salt that
    // changed between calls would hash one person to many EndUser rows.
    const created = await prisma.applicationPrivacySetting.upsert({
      where: { applicationId },
      create: {
        applicationId,
        identityMode: DEFAULT_IDENTITY_MODE,
        identitySalt: generateIdentitySalt(),
        allowedTraitKeys: [],
      },
      update: {},
    });
    floor = {
      identityMode: created.identityMode as IdentityMode,
      identitySalt: created.identitySalt,
      allowedTraitKeys: created.allowedTraitKeys,
    };
  }

  floorCache.set(applicationId, { floor, expiresAt: now + FLOOR_CACHE_TTL_MS });
  return floor;
}

/** Drops the cache. For tests, and for the settings route after a change. */
export function clearPrivacyFloorCache(applicationId?: string): void {
  if (applicationId) floorCache.delete(applicationId);
  else floorCache.clear();
}

// ─── Stitching ───────────────────────────────────────────────────────────────

export interface IdentityAssertion {
  applicationId: string;
  sessionId: string;
  anonymousId: string | null;
  externalId: string | null;
  externalIdHash: string | null;
  traits: Record<string, unknown> | null;
  /** The EVENT timestamp, never now(): an out-of-order replay must not win. */
  at: Date;
}

export interface IdentityResolution {
  endUserId: string | null;
  /** True when a browser was linked to a person for the first time. */
  aliasCreated: boolean;
}

/**
 * Resolves an assertion into an `EndUser`, an alias, and a session attribution.
 *
 * Called for any event carrying `anonymousId` or an identity.
 */
export async function resolveIdentity(
  prisma: PrismaClient,
  assertion: IdentityAssertion,
): Promise<IdentityResolution> {
  const { applicationId, sessionId, anonymousId, externalIdHash, at } = assertion;

  // ── Anonymous-only ──────────────────────────────────────────────────────
  if (!externalIdHash) {
    if (!anonymousId) return { endUserId: null, aliasCreated: false };

    // A browser already known to belong to someone starts its next visit already
    // attributed, and the events that arrived before an identify() in this visit
    // resolve to the right person after the fact.
    const owner = await prisma.endUserAlias.findFirst({
      where: { applicationId, anonymousId },
      orderBy: { lastSeenAt: 'desc' },
      select: { endUserId: true },
    });
    if (!owner) return { endUserId: null, aliasCreated: false };

    // Only when the session has no identity yet: an explicit identify() during this
    // visit outranks whatever the browser was last known as.
    const { count } = await prisma.session.updateMany({
      where: { id: sessionId, endUserId: null },
      data: { endUserId: owner.endUserId },
    });
    return { endUserId: count > 0 ? owner.endUserId : null, aliasCreated: false };
  }

  // ── Identified ──────────────────────────────────────────────────────────
  const endUserId = await upsertEndUser(prisma, assertion);

  let aliasCreated = false;
  if (anonymousId) {
    aliasCreated = await claimAlias(prisma, applicationId, anonymousId, endUserId, at);
  }

  // Last-write-wins for the identity, first-write-wins for when identification
  // happened.
  await prisma.$executeRaw`
    UPDATE "Session"
       SET "endUserId"    = ${endUserId},
           "identifiedAt" = COALESCE("identifiedAt", ${at})
     WHERE "id" = ${sessionId}
       AND ("endUserId" IS NULL OR "endUserId" <> ${endUserId})
  `;

  return { endUserId, aliasCreated };
}

async function upsertEndUser(prisma: PrismaClient, assertion: IdentityAssertion): Promise<string> {
  const traitsJson = JSON.stringify(assertion.traits ?? {});
  const hasTraits = assertion.traits !== null && Object.keys(assertion.traits).length > 0;

  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    INSERT INTO "EndUser" (
      "id", "applicationId", "externalId", "externalIdHash",
      "traits", "traitsUpdatedAt", "firstSeenAt", "lastSeenAt", "createdAt", "updatedAt"
    ) VALUES (
      gen_random_uuid()::text, ${assertion.applicationId}, ${assertion.externalId},
      ${assertion.externalIdHash}, ${traitsJson}::jsonb,
      ${hasTraits ? assertion.at : null}, ${assertion.at}, ${assertion.at}, NOW(), NOW()
    )
    ON CONFLICT ("applicationId", "externalIdHash") DO UPDATE SET
      "firstSeenAt" = LEAST   ("EndUser"."firstSeenAt", EXCLUDED."firstSeenAt"),
      "lastSeenAt"  = GREATEST("EndUser"."lastSeenAt",  EXCLUDED."lastSeenAt"),
      -- A mode switched from HASHED to RAW fills in the identifier; one switched the
      -- other way leaves what is already there rather than pretending to erase it.
      "externalId"  = COALESCE(EXCLUDED."externalId", "EndUser"."externalId"),
      "traits" = CASE
        WHEN EXCLUDED."traitsUpdatedAt" IS NULL THEN "EndUser"."traits"
        WHEN "EndUser"."traitsUpdatedAt" IS NULL
          OR EXCLUDED."traitsUpdatedAt" >= "EndUser"."traitsUpdatedAt"
          THEN "EndUser"."traits" || EXCLUDED."traits"
        ELSE "EndUser"."traits"
      END,
      "traitsUpdatedAt" = GREATEST(
        COALESCE("EndUser"."traitsUpdatedAt", EXCLUDED."traitsUpdatedAt"),
        EXCLUDED."traitsUpdatedAt"),
      "updatedAt" = NOW()
    RETURNING "id"
  `;
  return rows[0].id;
}

async function claimAlias(
  prisma: PrismaClient,
  applicationId: string,
  anonymousId: string,
  endUserId: string,
  at: Date,
): Promise<boolean> {
  const rows = await prisma.$queryRaw<Array<{ needsBacklink: boolean; inserted: boolean }>>`
    INSERT INTO "EndUserAlias" ("id", "applicationId", "anonymousId", "endUserId", "firstSeenAt", "lastSeenAt")
    VALUES (gen_random_uuid()::text, ${applicationId}, ${anonymousId}, ${endUserId}, ${at}, ${at})
    ON CONFLICT ("applicationId", "anonymousId", "endUserId") DO UPDATE SET
      "firstSeenAt" = LEAST   ("EndUserAlias"."firstSeenAt", EXCLUDED."firstSeenAt"),
      "lastSeenAt"  = GREATEST("EndUserAlias"."lastSeenAt",  EXCLUDED."lastSeenAt")
    RETURNING ("EndUserAlias"."backlinkedAt" IS NULL) AS "needsBacklink", (xmax = 0) AS "inserted"
  `;
  return rows[0]?.inserted === true;
}

// ─── Historical back-link ────────────────────────────────────────────────────

export interface BacklinkResult {
  aliasesProcessed: number;
  sessionsLinked: number;
}

const BACKLINK_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const BACKLINK_PAGE_SIZE = 500;

/**
 * Attributes a browser's earlier anonymous sessions to the person it turned out to
 * belong to.
 *
 * Enqueued rather than done inline, because a kiosk or a bot with a pinned
 * `localStorage` can have thousands of prior sessions and an unbounded write inside
 * the ingest path is not acceptable. The *current* session is linked inline by
 * `resolveIdentity`, so the UI is never wrong about the session being looked at.
 *
 * `endUserId IS NULL` is the most important condition in this file. Without it, a
 * library terminal where twenty students sign in one after another would have every
 * one of its sessions re-attributed to whoever signed in last.
 */
export async function backlinkAnonymousSessions(
  deps: SessionCoreDeps,
  options: { limit?: number; now?: Date; windowMs?: number } = {},
): Promise<BacklinkResult> {
  const { prisma } = deps;
  const logger = depsLogger(deps);
  const now = options.now ?? (deps.now ? deps.now() : new Date());
  const windowStart = new Date(now.getTime() - (options.windowMs ?? BACKLINK_WINDOW_MS));

  const pending = await prisma.endUserAlias.findMany({
    where: { backlinkedAt: null },
    orderBy: { firstSeenAt: 'asc' },
    take: options.limit ?? 50,
  });

  const result: BacklinkResult = { aliasesProcessed: 0, sessionsLinked: 0 };

  for (const alias of pending) {
    let linkedForAlias = 0;
    // Paged, so one popular anonymousId cannot hold a transaction open over
    // thousands of rows.
    for (;;) {
      const affected = await prisma.$executeRaw`
        UPDATE "Session"
           SET "endUserId" = ${alias.endUserId}
         WHERE "id" IN (
           SELECT "id" FROM "Session"
            WHERE "applicationId" = ${alias.applicationId}
              AND "anonymousId"   = ${alias.anonymousId}
              AND "endUserId" IS NULL
              AND "startTime" > ${windowStart}
            ORDER BY "startTime" DESC
            LIMIT ${BACKLINK_PAGE_SIZE}
         )
      `;
      linkedForAlias += affected;
      if (affected < BACKLINK_PAGE_SIZE) break;
    }

    await prisma.endUserAlias.update({
      where: { id: alias.id },
      data: { backlinkedAt: now },
    });

    result.aliasesProcessed += 1;
    result.sessionsLinked += linkedForAlias;
  }

  if (result.sessionsLinked) {
    logger.log(
      `[session-core] Back-linked ${result.sessionsLinked} session(s) `
      + `across ${result.aliasesProcessed} alias(es)`,
    );
  }
  return result;
}

/**
 * Removes end users with no sessions left.
 *
 * Retention deletes sessions but not `EndUser`, which is directory data rather than
 * behavioural data. Left alone entirely it would accumulate rows describing people
 * whose every session has expired.
 */
export async function pruneOrphanedEndUsers(
  deps: SessionCoreDeps,
  options: { limit?: number } = {},
): Promise<number> {
  const orphans = await deps.prisma.endUser.findMany({
    where: { sessions: { none: {} } },
    select: { id: true },
    take: options.limit ?? 500,
  });
  if (orphans.length === 0) return 0;

  await deps.prisma.endUser.deleteMany({ where: { id: { in: orphans.map((row) => row.id) } } });
  depsLogger(deps).log(`[session-core] Pruned ${orphans.length} orphaned end user(s)`);
  return orphans.length;
}

/**
 * Erases one end user and everything derived from them.
 *
 * Time-based retention cannot answer a data-subject request, so this exists to.
 * Returns what it removed for the audit record the caller writes.
 */
export async function eraseEndUser(
  prisma: PrismaClient,
  applicationId: string,
  endUserId: string,
): Promise<{ sessions: number; events: number; endUserDeleted: boolean }> {
  const sessions = await prisma.session.findMany({
    where: { applicationId, endUserId },
    select: { id: true },
  });
  const sessionIds = sessions.map((session) => session.id);

  if (sessionIds.length > 0) {
    await prisma.$transaction([
      prisma.stateObservation.deleteMany({ where: { sessionId: { in: sessionIds } } }),
      prisma.transitionObservation.deleteMany({ where: { sessionId: { in: sessionIds } } }),
      prisma.workflowExecution.deleteMany({ where: { sessionId: { in: sessionIds } } }),
      prisma.sessionCompletionOutbox.deleteMany({ where: { sessionId: { in: sessionIds } } }),
      prisma.sessionEvent.deleteMany({ where: { sessionId: { in: sessionIds } } }),
      prisma.sessionStatistic.deleteMany({ where: { sessionId: { in: sessionIds } } }),
      prisma.session.deleteMany({ where: { id: { in: sessionIds } } }),
    ]);
  }

  const { count } = await prisma.endUser.deleteMany({ where: { id: endUserId, applicationId } });
  return { sessions: sessionIds.length, events: 0, endUserDeleted: count > 0 };
}

/** Narrow re-export so callers do not need Prisma's namespace for a Json write. */
export const jsonNull = Prisma.DbNull;
