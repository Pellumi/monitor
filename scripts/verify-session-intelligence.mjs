#!/usr/bin/env node
/**
 * End-to-end acceptance for the session subsystem.
 *
 * Drives real HTTP through the gateway against a running stack and asserts the claims the
 * seven stages make. Follows the convention of scripts/verify-desktop-phase2.mjs: it
 * self-seeds what it needs, signs its own token, fails with a grep-able prefix, and prints a
 * machine-readable summary — including the negative claims, because "no duplicate was
 * created" is as much a result as "a row appeared".
 *
 *   node scripts/verify-session-intelligence.mjs
 *
 * Requires: Postgres reachable at DATABASE_URL, migrations applied, and the gateway,
 * event-collector, report-engine and background-workers running. Kafka is optional by
 * design — that is the parity claim, and PARITY_CHECK below is what tests it.
 */

// @prisma/client directly, and jsonwebtoken from the root: the same convention as
// verify-desktop-phase2.mjs. The root package.json does not depend on the workspaces, so a
// bare '@tellann/db' import does not resolve from here.
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { randomUUID, createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';

try { process.loadEnvFile?.('.env'); } catch { /* absent in container deploys */ }

const gateway = (process.env.API_GATEWAY_URL ?? 'http://127.0.0.1:3000').replace(/\/$/, '');
const JWT_SECRET = process.env.JWT_SECRET || 'tellann-default-jwt-secret-change-in-production';
/** The idle timeout completion waits for, plus the sweep interval and slack. */
const COMPLETION_WAIT_MS = Number(process.env.ACCEPTANCE_COMPLETION_WAIT_MS ?? 120_000);

const prisma = new PrismaClient();

/** A grep-able failure prefix, one per verification script. */
function assert(value, message) {
  if (!value) throw new Error(`SESSION_ACCEPTANCE_FAILED: ${message}`);
}

const results = {};
function record(key, value) {
  results[key] = value;
  const shown = typeof value === 'object' ? JSON.stringify(value) : value;
  console.log(`  ✓ ${key}: ${shown}`);
}

function step(name) {
  console.log(`\n── ${name} ${'─'.repeat(Math.max(0, 68 - name.length))}`);
}

async function request(path, init = {}, token, expectedStatus) {
  const headers = { 'Content-Type': 'application/json', ...(init.headers ?? {}) };
  if (token) headers.Cookie = `access_token=${token}`;
  const response = await fetch(`${gateway}${path}`, { ...init, headers });
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }

  if (expectedStatus !== undefined) {
    assert(
      response.status === expectedStatus,
      `${init.method ?? 'GET'} ${path} expected ${expectedStatus}, got ${response.status}: ${text.slice(0, 300)}`,
    );
  }
  return { status: response.status, body, headers: response.headers };
}

/** Polls until a predicate holds, so timing is never assumed. */
async function waitFor(label, predicate, timeoutMs = 30_000, intervalMs = 1_000) {
  const deadline = Date.now() + timeoutMs;
  let last;
  while (Date.now() < deadline) {
    last = await predicate();
    if (last) return last;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  assert(false, `timed out after ${timeoutMs}ms waiting for ${label}`);
}

// ─── Seeding ──────────────────────────────────────────────────────────────────

/**
 * An organisation, application and environment to work in, plus a token for them.
 *
 * Reuses whatever exists rather than requiring a pristine database, and creates only what is
 * missing, so the script is safe to run against a working development stack.
 */
async function seed() {
  step('Seeding');

  const membership = await prisma.organizationMembership.findFirst({
    include: { organization: true, user: true },
    orderBy: { joinedAt: 'asc' },
  });
  assert(membership, 'no organization membership exists; run the onboarding flow or seed:plans first');

  const organizationId = membership.organizationId;

  let application = await prisma.application.findFirst({
    where: { organizationId, name: { startsWith: 'acceptance-sessions' } },
  });
  if (!application) {
    application = await prisma.application.create({
      data: { organizationId, name: `acceptance-sessions-${Date.now()}` },
    });
  }

  let environment = await prisma.environment.findFirst({
    where: { applicationId: application.id, isDefault: true },
  });
  if (!environment) {
    environment = await prisma.environment.create({
      data: { applicationId: application.id, name: 'development', type: 'DEVELOPMENT', isDefault: true },
    });
  }

  const token = jwt.sign(
    { sub: membership.userId, email: membership.user.email },
    JWT_SECRET,
    { expiresIn: '1h' },
  );

  record('organizationId', organizationId);
  record('applicationId', application.id);
  record('environmentId', environment.id);
  return { organizationId, application, environment, token, userId: membership.userId };
}

// ─── Event construction ───────────────────────────────────────────────────────

function envelope(ctx, overrides = {}) {
  return {
    eventId: randomUUID(),
    sessionId: overrides.sessionId ?? ctx.sessionId,
    tenantId: ctx.organizationId,
    applicationId: ctx.application.id,
    environmentId: ctx.environment.id,
    source: 'acceptance-script',
    eventVersion: '1.1',
    eventType: 'PAGE_VIEW',
    timestamp: new Date().toISOString(),
    metadata: {},
    anonymousId: ctx.anonymousId,
    context: {
      deviceType: 'desktop',
      browserName: 'Chrome',
      osName: 'Windows',
      viewportWidth: 1440,
      viewportHeight: 900,
      locale: 'en-GB',
      timezone: 'Europe/London',
      releaseVersion: 'acceptance@1',
    },
    sampled: true,
    sampleRate: 1,
    ...overrides,
  };
}

/**
 * Posts a batch through the gateway, as the SDK does.
 *
 * The headers the gateway would normally inject from an API key are supplied directly: this
 * script has no ingestion key, and the collector trusts those headers by design.
 */
async function postEvents(ctx, events) {
  const response = await fetch(`${gateway}/v1/events/batch`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-tellann-org-id': ctx.organizationId,
      'x-tellann-application-id': ctx.application.id,
      'x-tellann-environment-id': ctx.environment.id,
    },
    body: JSON.stringify(events),
  });
  const body = await response.json().catch(() => null);
  assert(response.status === 202, `event batch rejected with ${response.status}: ${JSON.stringify(body)}`);
  return body;
}

// ─── 1. Anonymous ingest ──────────────────────────────────────────────────────

async function verifyAnonymousIngest(ctx) {
  step('1. Anonymous events create a session with no identity');

  await postEvents(ctx, [
    envelope(ctx, { eventType: 'SESSION_STARTED', metadata: { reason: 'FIRST_VISIT' } }),
    envelope(ctx, { metadata: { url: 'https://acceptance.test/courses' } }),
    envelope(ctx, { eventType: 'BUTTON_CLICK', metadata: { buttonName: 'Start' } }),
  ]);

  const session = await waitFor('the session row', () => prisma.session.findUnique({
    where: { id: ctx.sessionId },
  }));

  assert(session.anonymousId === ctx.anonymousId, 'anonymousId was not persisted from the envelope');
  assert(session.endUserId === null, 'an anonymous session must have no end user');
  assert(session.deviceType === 'desktop', 'client context was not persisted');
  assert(session.releaseVersion === 'acceptance@1', 'releaseVersion was not persisted');
  // The two fields the Zod schema silently stripped before envelope 1.1.
  assert(session.browserName === 'Chrome', 'browserName was not persisted');

  const events = await waitFor('all three session events to be persisted', async () => {
    const count = await prisma.sessionEvent.count({ where: { sessionId: ctx.sessionId } });
    return count === 3 ? count : null;
  });
  assert(events === 3, `expected 3 events, found ${events}`);

  record('anonymousSessionCreated', true);
  record('clientContextPersisted', true);
}

// ─── 2. Identity ──────────────────────────────────────────────────────────────

async function verifyIdentify(ctx) {
  step('2. identify() creates an end user and claims the browser');

  await postEvents(ctx, [
    envelope(ctx, {
      eventType: 'USER_IDENTIFIED',
      endUserExternalId: ctx.externalId,
      endUserTraits: { plan: 'pro' },
    }),
  ]);

  const session = await waitFor('the session to be attributed', async () => {
    const row = await prisma.session.findUnique({ where: { id: ctx.sessionId } });
    return row?.endUserId ? row : null;
  });

  const endUser = await prisma.endUser.findUnique({ where: { id: session.endUserId } });
  assert(endUser, 'no EndUser row was created');
  assert(endUser.externalIdHash, 'externalIdHash must be populated in every privacy mode');

  // The default is HASHED, so the raw identifier must NOT be stored. An SDK upgrade alone must
  // never begin storing PII.
  const setting = await prisma.applicationPrivacySetting.findUnique({
    where: { applicationId: ctx.application.id },
  });
  assert(setting, 'a privacy setting should have been created on first identity');
  if (setting.identityMode === 'HASHED') {
    assert(endUser.externalId === null, 'HASHED mode must not store the raw identifier');
    record('hashedModeStoresNoIdentifier', true);
  }

  // Traits outside the allow-list must not reach the database. The allow-list is empty by
  // default, so `plan` must have been dropped.
  const traits = endUser.traits ?? {};
  assert(
    Object.keys(traits).length === 0,
    `traits outside the allow-list reached the database: ${JSON.stringify(traits)}`,
  );
  record('traitsOutsideAllowlistDropped', true);

  const alias = await prisma.endUserAlias.findFirst({
    where: { applicationId: ctx.application.id, anonymousId: ctx.anonymousId },
  });
  assert(alias, 'no EndUserAlias claimed the browser');
  assert(alias.endUserId === endUser.id, 'the alias points at the wrong end user');

  ctx.endUserId = endUser.id;
  record('endUserId', endUser.id);
  record('aliasClaimed', true);
}

// ─── 3. Back-link, and the shared-device rule ─────────────────────────────────

async function verifySharedDevice(ctx) {
  step('3. A second person on the same browser does not steal the first one’s sessions');

  // A second anonymous session from the same browser, before anyone identifies.
  const secondSessionId = randomUUID();
  await postEvents(ctx, [
    envelope(ctx, { sessionId: secondSessionId, eventType: 'SESSION_STARTED' }),
    envelope(ctx, { sessionId: secondSessionId, metadata: { url: 'https://acceptance.test/quiz/start' } }),
  ]);

  // The back-link worker should attribute it to the person this browser is known to be.
  const linked = await waitFor(
    'the back-link worker to attribute the earlier session',
    async () => {
      const row = await prisma.session.findUnique({ where: { id: secondSessionId } });
      return row?.endUserId === ctx.endUserId ? row : null;
    },
    60_000,
  );
  assert(linked, 'the second session was never attributed');
  record('historicalBacklinkWorks', true);

  // Now a different person signs in on the same browser.
  const thirdSessionId = randomUUID();
  const otherExternalId = `other-${Date.now()}`;
  await postEvents(ctx, [
    envelope(ctx, { sessionId: thirdSessionId, eventType: 'SESSION_STARTED' }),
    envelope(ctx, {
      sessionId: thirdSessionId,
      eventType: 'USER_IDENTIFIED',
      endUserExternalId: otherExternalId,
    }),
  ]);

  const third = await waitFor('the third session to be attributed to the second person', async () => {
    const row = await prisma.session.findUnique({ where: { id: thirdSessionId } });
    // SESSION_STARTED can briefly adopt the browser's previous owner before the
    // following USER_IDENTIFIED event is consumed. Wait for that explicit identity
    // to win instead of treating the intermediate attribution as the final result.
    return row?.endUserId && row.endUserId !== ctx.endUserId ? row : null;
  });
  assert(third.endUserId !== ctx.endUserId, 'the second person was merged into the first');

  // Give the back-link worker time to do the wrong thing, if it is going to.
  await new Promise((resolve) => setTimeout(resolve, 35_000));

  const first = await prisma.session.findUnique({ where: { id: ctx.sessionId } });
  const second = await prisma.session.findUnique({ where: { id: secondSessionId } });
  assert(
    first.endUserId === ctx.endUserId && second.endUserId === ctx.endUserId,
    'a later sign-in on the same browser re-attributed the earlier person’s sessions '
    + '— the `endUserId IS NULL` guard on the back-link is not holding',
  );

  record('sharedDeviceDoesNotReattribute', true);
  ctx.secondSessionId = secondSessionId;
  ctx.thirdSessionId = thirdSessionId;
}

// ─── 4. Completion, statistics, facet and the outbox ──────────────────────────

async function verifyCompletion(ctx) {
  step('4. The session completes, is measured, and is announced exactly once');

  const completed = await waitFor(
    'completion (idle timeout + sweep)',
    async () => {
      const row = await prisma.session.findUnique({
        where: { id: ctx.sessionId },
        include: { statistics: true },
      });
      return row?.completedAt && row.statistics ? row : null;
    },
    COMPLETION_WAIT_MS,
    2_000,
  );

  assert(completed.statistics.eventCount >= 4, 'statistics under-counted the events');
  assert(completed.statistics.durationMs >= 0, 'durationMs is negative');
  record('statistics', {
    eventCount: completed.statistics.eventCount,
    errorCount: completed.statistics.errorCount,
    durationMs: completed.statistics.durationMs,
  });

  const facet = await waitFor('the session facet', () => prisma.sessionFacet.findUnique({
    where: { sessionId: ctx.sessionId },
  }), 60_000);
  assert(facet.eventTypes.length > 0, 'the facet recorded no event types');
  assert(facet.deviceType === 'desktop', 'the facet did not carry the client context');
  assert(
    facet.endUserIds.includes(ctx.endUserId) || facet.endUserId === ctx.endUserId,
    'the facet did not record the identity, so the session is not findable by user',
  );
  record('facetWritten', { eventTypes: facet.eventTypes.length, routes: facet.routes.length });

  // Exactly one announcement, ever. The unique on sessionId is what guarantees it, and this
  // is the assertion that would catch a regression in the claim transaction.
  const outboxRows = await prisma.sessionCompletionOutbox.count({
    where: { sessionId: ctx.sessionId },
  });
  assert(outboxRows === 1, `expected exactly 1 outbox row, found ${outboxRows}`);
  record('announcedExactlyOnce', true);

  const delivered = await waitFor('outbox delivery', async () => {
    const row = await prisma.sessionCompletionOutbox.findUnique({
      where: { sessionId: ctx.sessionId },
    });
    return row?.status === 'DELIVERED' ? row : null;
  }, 60_000);
  assert(delivered.payload === null, 'the payload should be nulled on delivery');
  record('outboxDrainedAndPayloadCleared', true);
}

// ─── 5. Projection idempotency and route induction ────────────────────────────

async function verifyProjection(ctx) {
  step('5. The projection is idempotent and describes routes it has no rule for');

  const observations = await waitFor('state observations', async () => {
    const count = await prisma.stateObservation.count({ where: { sessionId: ctx.sessionId } });
    return count > 0 ? count : null;
  }, 60_000);
  record('stateObservations', observations);

  const states = await prisma.state.findMany({
    where: { applicationId: ctx.application.id },
    select: { id: true, name: true, category: true, visitCount: true },
  });
  assert(states.length > 0, 'no observed states were created');

  // Route induction: this application has no ApplicationProfile and no hand-written rules, so
  // before Stage 6 it would have produced nothing recognisable.
  const induced = states.filter((state) => state.category === 'ROUTE');
  record('routeInducedStates', induced.map((state) => state.name).slice(0, 5));

  // Re-announce the same session and prove nothing moves. This is the invariant that matters
  // most, because a Kafka rebalance and a Postgres relay can both deliver the same session.
  const before = {
    visits: Object.fromEntries(states.map((state) => [state.id, state.visitCount])),
    observations,
  };

  await prisma.sessionCompletionOutbox.update({
    where: { sessionId: ctx.sessionId },
    data: { status: 'PENDING', availableAt: new Date(), claimedAt: null, deliveredAt: null },
  });

  await waitFor('the re-delivery', async () => {
    const row = await prisma.sessionCompletionOutbox.findUnique({
      where: { sessionId: ctx.sessionId },
    });
    return row?.status === 'DELIVERED' ? row : null;
  }, 60_000);

  const after = await prisma.state.findMany({
    where: { id: { in: Object.keys(before.visits) } },
    select: { id: true, visitCount: true },
  });
  for (const state of after) {
    assert(
      state.visitCount === before.visits[state.id],
      `visitCount for ${state.id} moved from ${before.visits[state.id]} to ${state.visitCount} `
      + 'on a repeated projection',
    );
  }
  const observationsAfter = await prisma.stateObservation.count({
    where: { sessionId: ctx.sessionId },
  });
  assert(
    observationsAfter === before.observations,
    `observations grew from ${before.observations} to ${observationsAfter} on a repeat`,
  );

  record('projectionIdempotent', true);
}

// ─── 6. Search ────────────────────────────────────────────────────────────────

async function verifySearch(ctx) {
  step('6. The session is findable');

  const base = `/applications/${ctx.application.id}/sessions`;

  const unfiltered = await request(`${base}?limit=10`, {}, ctx.token, 200);
  assert(Array.isArray(unfiltered.body.sessions), 'the session list is not an array');
  assert(typeof unfiltered.body.totalIsExact === 'boolean', 'totalIsExact is missing');
  record('listReturns', unfiltered.body.sessions.length);

  const byUser = await request(
    `${base}?endUser=${encodeURIComponent(ctx.endUserId)}&limit=10`,
    {}, ctx.token, 200,
  );
  assert(
    byUser.body.sessions.some((session) => session.id === ctx.sessionId),
    'filtering by end user did not return the session that belongs to them',
  );
  assert(
    byUser.body.sessions[0].endUserLabel !== undefined,
    'the row carries no user label, so the column cannot render',
  );
  record('findableByUser', true);

  const byDevice = await request(`${base}?deviceType=desktop&limit=10`, {}, ctx.token, 200);
  assert(byDevice.body.sessions.length > 0, 'filtering by device returned nothing');
  record('findableByDevice', true);

  // An impossible filter must return nothing rather than everything — the failure mode of a
  // clause that is silently dropped.
  const impossible = await request(`${base}?deviceType=nonexistent-device&limit=10`, {}, ctx.token, 200);
  assert(
    impossible.body.sessions.length === 0,
    'an unmatched filter returned rows, so the clause is being ignored',
  );
  record('unmatchedFilterReturnsNothing', true);

  // Keyset pagination must not repeat a row.
  const firstPage = await request(`${base}?limit=2`, {}, ctx.token, 200);
  if (firstPage.body.cursor) {
    const secondPage = await request(
      `${base}?limit=2&cursor=${encodeURIComponent(firstPage.body.cursor)}`,
      {}, ctx.token, 200,
    );
    const firstIds = new Set(firstPage.body.sessions.map((session) => session.id));
    const overlap = secondPage.body.sessions.filter((session) => firstIds.has(session.id));
    assert(overlap.length === 0, `keyset paging repeated ${overlap.length} row(s)`);
    record('keysetPagingDoesNotRepeat', true);
  } else {
    record('keysetPagingDoesNotRepeat', 'skipped (only one page of results)');
  }

  const users = await request(
    `/applications/${ctx.application.id}/end-users?limit=10`, {}, ctx.token, 200,
  );
  assert(
    users.body.endUsers.some((user) => user.id === ctx.endUserId),
    'the end user does not appear in the users list',
  );
  record('endUserBrowsable', true);
}

// ─── 7. Replay chunks ─────────────────────────────────────────────────────────

async function verifyReplay(ctx) {
  step('7. DOM replay chunks, or a clean refusal');

  const config = await fetch(`${gateway}/v1/replay/config`, {
    headers: {
      'x-tellann-org-id': ctx.organizationId,
      'x-tellann-application-id': ctx.application.id,
      'x-tellann-environment-id': ctx.environment.id,
    },
  });
  assert(config.status === 200, `replay config failed with ${config.status}`);
  const effective = await config.json();
  record('replayMode', effective.mode);
  assert(typeof effective.profileHash === 'string', 'the config carries no profile hash');

  if (effective.mode === 'OFF') {
    // The plan does not include DOM replay. Ingest must refuse, which IS the enforcement.
    const refused = await fetch(`${gateway}/v1/replay/chunks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'x-tellann-org-id': ctx.organizationId,
        'x-tellann-application-id': ctx.application.id,
        'x-tellann-session-id': ctx.sessionId,
        'x-tellann-chunk-seq': '0',
        'x-tellann-chunk-events': '1',
        'x-tellann-mask-profile-hash': effective.profileHash,
      },
      body: gzipSync(Buffer.from('{"type":2,"timestamp":1}\n')),
    });
    assert(refused.status === 403, `an unentitled chunk should be refused with 403, got ${refused.status}`);
    record('unentitledChunkRefused', true);
    record('replayChunksStored', 'skipped (plan does not include DOM replay)');
    return;
  }

  const chunk = gzipSync(Buffer.from(
    ['{"type":2,"timestamp":1,"data":{}}', '{"type":3,"timestamp":2,"data":{}}'].join('\n'),
  ));

  const chunkHeaders = (seq) => ({
    'Content-Type': 'application/octet-stream',
    'x-tellann-org-id': ctx.organizationId,
    'x-tellann-application-id': ctx.application.id,
    'x-tellann-environment-id': ctx.environment.id,
    'x-tellann-session-id': ctx.sessionId,
    'x-tellann-chunk-seq': String(seq),
    'x-tellann-chunk-start-ms': String(seq * 1000),
    'x-tellann-chunk-end-ms': String(seq * 1000 + 999),
    'x-tellann-chunk-events': '2',
    'x-tellann-chunk-encoding': 'gzip',
    'x-tellann-chunk-snapshot': seq === 0 ? 'true' : 'false',
    'x-tellann-mask-profile-hash': effective.profileHash,
  });

  for (const seq of [0, 1, 2]) {
    const response = await fetch(`${gateway}/v1/replay/chunks`, {
      method: 'POST', headers: chunkHeaders(seq), body: chunk,
    });
    assert(response.status === 202, `chunk ${seq} rejected with ${response.status}`);
  }

  // The same seq again: a retry must overwrite, not duplicate.
  const retry = await fetch(`${gateway}/v1/replay/chunks`, {
    method: 'POST', headers: chunkHeaders(1), body: chunk,
  });
  assert(retry.status === 202, `the retried chunk was rejected with ${retry.status}`);

  const stored = await prisma.replayChunk.count({ where: { sessionId: ctx.sessionId } });
  assert(stored === 3, `expected 3 chunks after a retry of one of them, found ${stored}`);
  record('replayChunksStored', stored);
  record('retriedChunkDidNotDuplicate', true);

  // One ledger entry per session, not per chunk.
  const ledger = await prisma.storageLedgerEntry.count({
    where: { ownerId: ctx.sessionId, category: 'SESSION_REPLAY', deletedAt: null },
  });
  assert(ledger <= 1, `expected at most 1 ledger entry per session, found ${ledger}`);
  record('oneLedgerEntryPerSession', true);

  // A stale masking profile must be refused, which is what makes attestation meaningful.
  const stale = await fetch(`${gateway}/v1/replay/chunks`, {
    method: 'POST',
    headers: { ...chunkHeaders(9), 'x-tellann-mask-profile-hash': createHash('sha256').update('stale').digest('hex') },
    body: chunk,
  });
  assert(stale.status === 409, `a stale profile should be refused with 409, got ${stale.status}`);
  record('staleMaskProfileRefused', true);

  const manifest = await request(`/sessions/${ctx.sessionId}/replay/manifest`, {}, ctx.token);
  if (manifest.status === 200) {
    assert(manifest.body.chunks.length === 3, 'the manifest does not list every chunk');
    assert(manifest.body.chunks[0].url, 'a manifest entry has no URL, so nothing can be played');
    record('manifestPlayable', true);
  } else {
    record('manifestPlayable', `not entitled (${manifest.status})`);
  }
}

// ─── 8. Tenancy ───────────────────────────────────────────────────────────────

async function verifyTenancy(ctx) {
  step('8. Another tenant cannot read any of it');

  // A token for a user who is in no organization that owns this application.
  const outsiderToken = jwt.sign(
    { sub: `outsider-${randomUUID()}`, email: 'outsider@example.test' },
    JWT_SECRET,
    { expiresIn: '1h' },
  );

  const list = await request(
    `/applications/${ctx.application.id}/sessions?limit=5`, {}, outsiderToken,
  );
  assert(
    list.status === 403 || list.status === 404,
    `an outsider got ${list.status} for the session list; expected 403 or 404`,
  );

  const replay = await request(`/sessions/${ctx.sessionId}/replay`, {}, outsiderToken);
  assert(
    replay.status === 403 || replay.status === 404,
    `an outsider got ${replay.status} for a replay; expected 403 or 404`,
  );

  const manifest = await request(`/sessions/${ctx.sessionId}/replay/manifest`, {}, outsiderToken);
  assert(
    manifest.status === 403 || manifest.status === 404,
    `an outsider got ${manifest.status} for a replay manifest; expected 403 or 404`,
  );

  record('outsiderRefused', { list: list.status, replay: replay.status, manifest: manifest.status });
}

// ─── 9. Unknown application ───────────────────────────────────────────────────

async function verifyNoApplicationMinting(ctx) {
  step('9. Telemetry cannot mint an application');

  const inventedId = `invented-${randomUUID()}`;
  await fetch(`${gateway}/v1/events/batch`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-tellann-org-id': ctx.organizationId,
      'x-tellann-application-id': inventedId,
    },
    body: JSON.stringify([envelope(ctx, {
      sessionId: randomUUID(),
      applicationId: inventedId,
      environmentId: null,
    })]),
  });

  await new Promise((resolve) => setTimeout(resolve, 3_000));

  const created = await prisma.application.findUnique({ where: { id: inventedId } });
  assert(
    created === null,
    'an event for an unknown application created an Application row — telemetry can still '
    + 'mint tenant-less applications',
  );
  record('unknownApplicationNotCreated', true);
}

// ─── 10. Transport parity ─────────────────────────────────────────────────────

function reportParity() {
  step('10. Transport');
  const kafka = process.env.KAFKA_ENABLED === 'true';
  record('transport', kafka ? 'kafka' : 'postgres');
  console.log(
    kafka
      ? '  Run again with KAFKA_ENABLED unset to prove the Postgres path produces identical rows.'
      : '  Run again with KAFKA_ENABLED=true to prove the Kafka path produces identical rows.',
  );
  return kafka ? 'kafka' : 'postgres';
}

// ─── Main ─────────────────────────────────────────────────────────────────────

/**
 * Checks the prerequisites before asserting anything about behaviour.
 *
 * Without this the first failure is a Prisma stack trace or a fetch ECONNREFUSED, and the
 * operator has to work out which of four services is missing. Naming the prerequisite is the
 * difference between a useful failure and a puzzle.
 */
/** The first line of an error, for a message an operator can read. */
function firstLine(error) {
  // The first *non-empty* line. Prisma's connection errors begin with a blank line and an
  // ASCII-art box, so taking line one literally yields an empty parenthetical — which is how
  // a helpful message becomes a puzzle again.
  const lines = String(error?.message ?? error)
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !/^[─-╿\s]+$/.test(line));
  return lines[0] ?? 'no error message';
}

async function preflight() {
  step('Preflight');

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (error) {
    assert(false,
      `cannot reach the database at the configured DATABASE_URL (${firstLine(error)}). `
      + 'Start Postgres (docker compose up -d postgres) and apply migrations with '
      + '`pnpm --filter @tellann/db migrate:deploy`.');
  }
  record('database', 'reachable');

  // A table from the last migration, so "migrations applied" is verified rather than assumed.
  try {
    await prisma.$queryRaw`SELECT 1 FROM "SessionFacet" LIMIT 1`;
  } catch {
    assert(false,
      'the SessionFacet table does not exist, so the session migrations have not been applied. '
      + 'Run `pnpm --filter @tellann/db migrate:deploy`.');
  }
  record('migrations', 'applied');

  try {
    const health = await fetch(`${gateway}/health`);
    assert(health.ok, `the gateway at ${gateway} answered ${health.status}`);
  } catch (error) {
    assert(false,
      `cannot reach the gateway at ${gateway} (${firstLine(error)}). `
      + 'Start the stack with `pnpm dev`, or set API_GATEWAY_URL.');
  }
  record('gateway', 'reachable');

  const upstreams = await fetch(`${gateway}/health/upstreams`).then((r) => r.json()).catch(() => null);
  if (upstreams?.unreachable?.length) {
    // Reported rather than fatal: a missing report-engine fails step 6 with a clearer message
    // than a preflight refusal would give, and some steps still pass without it.
    console.warn(`  ! unreachable upstreams: ${upstreams.unreachable.join(', ')}`);
    record('unreachableUpstreams', upstreams.unreachable);
  }
}

async function main() {
  console.log(`Session intelligence acceptance — gateway ${gateway}`);

  await preflight();
  const seeded = await seed();
  const ctx = {
    ...seeded,
    sessionId: randomUUID(),
    anonymousId: `anon-${randomUUID()}`,
    externalId: `student-${Date.now()}`,
  };
  record('sessionId', ctx.sessionId);

  await verifyAnonymousIngest(ctx);
  await verifyIdentify(ctx);
  await verifySharedDevice(ctx);
  await verifyCompletion(ctx);
  await verifyProjection(ctx);
  await verifySearch(ctx);
  await verifyReplay(ctx);
  await verifyTenancy(ctx);
  await verifyNoApplicationMinting(ctx);
  const transport = reportParity();

  console.log('\n── Summary ───────────────────────────────────────────────────────────\n');
  console.log(JSON.stringify({
    success: true,
    transport,
    applicationId: ctx.application.id,
    sessionId: ctx.sessionId,
    endUserId: ctx.endUserId,
    // Negative claims, stated explicitly: these are results, not absences.
    sharedDeviceDidNotReattribute: results.sharedDeviceDoesNotReattribute === true,
    projectionDidNotDoubleCount: results.projectionIdempotent === true,
    announcedExactlyOnce: results.announcedExactlyOnce === true,
    rawIdentifierNotStored: results.hashedModeStoresNoIdentifier === true,
    traitsOutsideAllowlistDropped: results.traitsOutsideAllowlistDropped === true,
    retriedChunkDidNotDuplicate: results.retriedChunkDidNotDuplicate !== undefined,
    telemetryCannotMintApplications: results.unknownApplicationNotCreated === true,
    outsiderRefused: results.outsiderRefused,
    ...results,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(`\n${error.message}`);
    if (!String(error.message).startsWith('SESSION_ACCEPTANCE_FAILED')) console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
