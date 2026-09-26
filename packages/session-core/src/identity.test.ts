import assert from 'node:assert/strict';
import test from 'node:test';
import type { PrismaClient } from '@tellann/db';
import {
  DEFAULT_IDENTITY_MODE,
  applyPrivacyFloor,
  clearPrivacyFloorCache,
  hashExternalId,
  resolveIdentity,
  resolvePrivacyFloor,
  type PrivacyFloor,
} from './identity';

const SALT = 'a'.repeat(64);

function floor(overrides: Partial<PrivacyFloor> = {}): PrivacyFloor {
  return { identityMode: 'HASHED', identitySalt: SALT, allowedTraitKeys: [], ...overrides };
}

// ─── The floor ───────────────────────────────────────────────────────────────

test('HASHED is the default, so an SDK upgrade alone never starts storing PII', () => {
  // Moving identity into the envelope took traits out of the SDK sanitizer's reach.
  // If the default were RAW, upgrading the SDK would begin storing identifiers for an
  // application whose owner never visited a settings page.
  assert.equal(DEFAULT_IDENTITY_MODE, 'HASHED');
});

test('HASHED mode stores a hash and no identifier', () => {
  const result = applyPrivacyFloor(floor(), { externalId: 'student-42', traits: null });
  assert.equal(result.externalId, null);
  assert.equal(result.externalIdHash, hashExternalId(SALT, 'student-42'));
});

test('RAW mode stores the identifier and the hash', () => {
  // The hash is populated in every mode, so a query matches the same rows before and
  // after a mode change and switching modes cannot fragment an identity.
  const result = applyPrivacyFloor(floor({ identityMode: 'RAW' }), {
    externalId: 'student-42', traits: null,
  });
  assert.equal(result.externalId, 'student-42');
  assert.equal(result.externalIdHash, hashExternalId(SALT, 'student-42'));
});

test('DISABLED mode drops identity entirely', () => {
  const result = applyPrivacyFloor(floor({ identityMode: 'DISABLED' }), {
    externalId: 'student-42', traits: { email: 'a@b.test' },
  });
  assert.equal(result.externalId, null);
  assert.equal(result.externalIdHash, null);
  assert.equal(result.traits, null);
});

test('a trait outside the allow-list never reaches the database', () => {
  // An allow-list, not a deny-list. A deny-list can only block what someone thought of
  // in advance, which is exactly how the `userid` collision came about.
  const result = applyPrivacyFloor(floor({ identityMode: 'RAW', allowedTraitKeys: ['plan'] }), {
    externalId: 'student-42',
    traits: { plan: 'pro', email: 'student@school.test', ssn: '000-00-0000' },
  });
  assert.deepEqual(result.traits, { plan: 'pro' });
});

test('an empty allow-list means no traits at all, not all traits', () => {
  const result = applyPrivacyFloor(floor({ identityMode: 'RAW' }), {
    externalId: 'student-42', traits: { plan: 'pro' },
  });
  assert.equal(result.traits, null);
});

test('no asserted identity yields nothing, whatever the mode', () => {
  for (const identityMode of ['RAW', 'HASHED', 'DISABLED'] as const) {
    const result = applyPrivacyFloor(floor({ identityMode }), { externalId: null, traits: { a: 1 } });
    assert.equal(result.externalIdHash, null, identityMode);
    assert.equal(result.traits, null, identityMode);
  }
});

// ─── Hashing ─────────────────────────────────────────────────────────────────

test('the same id under the same salt always hashes the same', () => {
  // Stitching depends on this: a hash that varied per call would scatter one person
  // across many EndUser rows.
  assert.equal(hashExternalId(SALT, 'student-42'), hashExternalId(SALT, 'student-42'));
});

test('the same id under a different salt does not collide', () => {
  // Per-application salts, so one application cannot probe another's user directory by
  // hashing a guess.
  assert.notEqual(hashExternalId(SALT, 'student-42'), hashExternalId('b'.repeat(64), 'student-42'));
});

test('the hash is an HMAC, so the salt is a key rather than a prefix', () => {
  // A plain sha256(salt + id) is brute-forceable by anyone who learns the salt's
  // length and an id format. Pinned as a shape assertion rather than a re-derivation.
  const hash = hashExternalId(SALT, 'student-42');
  assert.match(hash, /^[0-9a-f]{64}$/);
  assert.notEqual(hash, hashExternalId(SALT, 'student-43'));
});

// ─── The floor's own resolution ──────────────────────────────────────────────

test('an application with no setting gets one created, so the salt is stable', () => {
  // Defaulting in memory instead would give a different salt per process, hashing one
  // person to many rows.
  const created: any[] = [];
  const prisma = {
    applicationPrivacySetting: {
      async findUnique() { return null; },
      async upsert({ create }: { create: any }) {
        created.push(create);
        return { ...create };
      },
    },
  } as unknown as PrismaClient;

  clearPrivacyFloorCache();
  return resolvePrivacyFloor(prisma, 'app-1').then((resolved) => {
    assert.equal(resolved.identityMode, 'HASHED');
    assert.match(resolved.identitySalt, /^[0-9a-f]{64}$/);
    assert.equal(created.length, 1);
  });
});

test('the floor is cached, so ingest does not read it per event', async () => {
  let reads = 0;
  const prisma = {
    applicationPrivacySetting: {
      async findUnique() {
        reads += 1;
        return { identityMode: 'RAW', identitySalt: SALT, allowedTraitKeys: ['plan'] };
      },
      async upsert({ create }: { create: any }) { return { ...create }; },
    },
  } as unknown as PrismaClient;

  clearPrivacyFloorCache();
  await resolvePrivacyFloor(prisma, 'app-cache', 1_000);
  await resolvePrivacyFloor(prisma, 'app-cache', 2_000);
  assert.equal(reads, 1);

  // And it does expire, so a tightened setting takes effect without a deploy.
  await resolvePrivacyFloor(prisma, 'app-cache', 1_000 + 61_000);
  assert.equal(reads, 2);
});

// ─── Anonymous adoption ──────────────────────────────────────────────────────

function anonymousWorld(options: {
  alias?: { endUserId: string } | null;
  sessionHasIdentity?: boolean;
} = {}) {
  const updates: any[] = [];
  const prisma = {
    endUserAlias: {
      async findFirst() { return options.alias ?? null; },
    },
    session: {
      async updateMany({ where, data }: { where: any; data: any }) {
        // Model the `endUserId: null` guard the real query carries.
        if (where.endUserId === null && options.sessionHasIdentity) return { count: 0 };
        updates.push({ where, data });
        return { count: 1 };
      },
    },
  } as unknown as PrismaClient;
  return { prisma, updates };
}

test('a known browser starts its next visit already attributed', async () => {
  // This is what makes the events that arrive before an identify() resolve to the
  // right person, and a returning visitor identified from their first page view.
  const { prisma, updates } = anonymousWorld({ alias: { endUserId: 'user-1' } });
  const result = await resolveIdentity(prisma, {
    applicationId: 'app-1', sessionId: 'session-1', anonymousId: 'anon-1',
    externalId: null, externalIdHash: null, traits: null, at: new Date(),
  });

  assert.equal(result.endUserId, 'user-1');
  assert.equal(updates.length, 1);
  assert.equal(updates[0].where.endUserId, null, 'guarded on the session having no identity yet');
});

test('an explicit identify in this visit outranks what the browser was last known as', async () => {
  const { prisma } = anonymousWorld({ alias: { endUserId: 'user-1' }, sessionHasIdentity: true });
  const result = await resolveIdentity(prisma, {
    applicationId: 'app-1', sessionId: 'session-1', anonymousId: 'anon-1',
    externalId: null, externalIdHash: null, traits: null, at: new Date(),
  });
  assert.equal(result.endUserId, null, 'the session keeps the identity it already has');
});

test('an unknown browser stays anonymous', async () => {
  const { prisma, updates } = anonymousWorld({ alias: null });
  const result = await resolveIdentity(prisma, {
    applicationId: 'app-1', sessionId: 'session-1', anonymousId: 'anon-new',
    externalId: null, externalIdHash: null, traits: null, at: new Date(),
  });
  assert.equal(result.endUserId, null);
  assert.equal(updates.length, 0);
});

test('an event with neither an anonymous id nor an identity does no identity work', async () => {
  const { prisma, updates } = anonymousWorld({ alias: { endUserId: 'user-1' } });
  const result = await resolveIdentity(prisma, {
    applicationId: 'app-1', sessionId: 'session-1', anonymousId: null,
    externalId: null, externalIdHash: null, traits: null, at: new Date(),
  });
  assert.deepEqual(result, { endUserId: null, aliasCreated: false });
  assert.equal(updates.length, 0);
});

/*
 * Deliberately NOT unit-tested here, and covered by
 * scripts/verify-session-intelligence.mjs against a real Postgres instead:
 *
 *  - convergence under replay (applying one batch three times leaves identical rows)
 *  - the shared-device rule: anon1 identifies as A, then as B, and A's earlier
 *    sessions stay A's
 *  - trait merge ordering under an out-of-order replay
 *
 * All three live in the SQL -- LEAST/GREATEST/COALESCE, `xmax = 0`, and the
 * `endUserId IS NULL` guard on the back-link. A fake that modelled those clauses
 * would be asserting against a re-implementation of the thing under test, which
 * proves nothing about what Postgres will actually do.
 */
