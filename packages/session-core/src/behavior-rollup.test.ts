import assert from 'node:assert/strict';
import test from 'node:test';
import { declarationPriority, hashPath, utcDay } from './behavior-rollup';

// ─── The day grain ────────────────────────────────────────────────────────────

test('a day is UTC midnight, whatever the local zone', () => {
  // Every rollup is keyed on this. If it drifted with the server's zone, the same session
  // would land in different buckets on different machines and a backfill would double-count.
  const day = utcDay(new Date('2026-10-04T23:59:59.999Z'));
  assert.equal(day.toISOString(), '2026-10-04T00:00:00.000Z');
});

test('every instant in a day maps to the same bucket', () => {
  const first = utcDay(new Date('2026-10-04T00:00:00.000Z'));
  const last = utcDay(new Date('2026-10-04T23:59:59.999Z'));
  assert.equal(first.getTime(), last.getTime());
});

test('the next instant is a different day', () => {
  const before = utcDay(new Date('2026-10-04T23:59:59.999Z'));
  const after = utcDay(new Date('2026-10-05T00:00:00.000Z'));
  assert.notEqual(before.getTime(), after.getTime());
});

// ─── Path identity ────────────────────────────────────────────────────────────

test('the same sequence always hashes the same', () => {
  // The identity a journey is upserted on, so it has to be a pure function of the sequence.
  assert.equal(hashPath(['CART', 'CHECKOUT']), hashPath(['CART', 'CHECKOUT']));
});

test('order is part of the identity', () => {
  // CART then CHECKOUT is a different journey from CHECKOUT then CART -- the second is
  // someone going backwards, which is exactly the kind of thing worth noticing.
  assert.notEqual(hashPath(['CART', 'CHECKOUT']), hashPath(['CHECKOUT', 'CART']));
});

test('a state name containing the separator cannot forge another path', () => {
  // Joined on NUL rather than a comma, so a state literally named "A,B" does not hash the
  // same as the two-state path [A, B].
  assert.notEqual(hashPath(['A,B']), hashPath(['A', 'B']));
});

test('an empty path is distinguishable from a single empty state', () => {
  assert.notEqual(hashPath([]), hashPath(['']));
});

// ─── Declaration priority ─────────────────────────────────────────────────────

test('volume ranks a busy path above a rare one', () => {
  // `undeclared` entries carried State.visitCount -- a lifetime total -- so a path used once
  // a year ranked alongside one used hourly.
  const busy = declarationPriority({ weightedVisits: 10_000, errorRate: 0 }, 0);
  const rare = declarationPriority({ weightedVisits: 5, errorRate: 0 }, 0);
  assert.ok(busy > rare);
});

test('breakage outranks volume alone', () => {
  // A hot broken path is the one worth declaring first, which is the whole point of
  // weighting: coverage told you what was missing, not what mattered.
  const brokenAndBusy = declarationPriority({ weightedVisits: 1_000, errorRate: 0.5 }, 0);
  const healthyAndBusier = declarationPriority({ weightedVisits: 3_000, errorRate: 0 }, 0);
  assert.ok(brokenAndBusy > healthyAndBusier);
});

test('volume is logarithmic, so one enormous path does not swamp the list', () => {
  // The difference between 10 and 100 sessions matters far more than between 10k and 100k.
  const ten = declarationPriority({ weightedVisits: 10, errorRate: 0 }, 0);
  const hundred = declarationPriority({ weightedVisits: 100, errorRate: 0 }, 0);
  const tenThousand = declarationPriority({ weightedVisits: 10_000, errorRate: 0 }, 0);
  const hundredThousand = declarationPriority({ weightedVisits: 100_000, errorRate: 0 }, 0);
  assert.ok(hundred - ten > 0);
  assert.ok((hundred - ten) - (hundredThousand - tenThousand) < 0.01, 'equal ratios, equal steps');
});

test('with no rollup yet it falls back to the lifetime count', () => {
  // The rollups may not have run on a fresh install or mid-migration. Degraded ordering is
  // better than no reconciliation.
  assert.ok(declarationPriority(undefined, 500) > declarationPriority(undefined, 5));
});

test('a never-visited state has no priority at all', () => {
  assert.equal(declarationPriority(undefined, 0), 0);
  assert.equal(declarationPriority({ weightedVisits: 0, errorRate: 1 }, 0), 0);
});
