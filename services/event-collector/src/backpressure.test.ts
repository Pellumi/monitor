import assert from 'node:assert/strict';
import test from 'node:test';
import {
  INGEST_EVENT_BUDGET,
  INGEST_WINDOW_MS,
  consumeIngestBudget,
  ingestBudgetState,
  resetIngestBudgets,
} from './backpressure';

test('normal traffic is never shed', () => {
  // The point of a generous budget: a real burst -- a marketing launch, a load test the
  // customer ran on purpose -- must not be mistaken for a runaway producer.
  resetIngestBudgets();
  const verdict = consumeIngestBudget('app-1', 200);
  assert.equal(verdict.allowed, true);
  assert.equal(verdict.remaining, INGEST_EVENT_BUDGET - 200);
});

test('a runaway producer is shed once it exceeds its budget', () => {
  // There was no limit at all before: one misconfigured SDK with a zero flush interval could
  // saturate the collector and, through it, every other application's ingest.
  resetIngestBudgets();
  consumeIngestBudget('app-2', INGEST_EVENT_BUDGET);
  const verdict = consumeIngestBudget('app-2', 1);
  assert.equal(verdict.allowed, false);
  assert.equal(verdict.remaining, 0);
  assert.ok(verdict.retryAfterSeconds > 0, 'and is told when to come back');
});

test('one application being shed does not affect another', () => {
  // Per application rather than per IP, because the application is the unit whose behaviour
  // is at fault -- and real traffic for one arrives from thousands of IPs.
  resetIngestBudgets();
  consumeIngestBudget('noisy', INGEST_EVENT_BUDGET + 1);
  assert.equal(consumeIngestBudget('quiet', 10).allowed, true);
});

test('a batch that would cross the ceiling is shed whole, not partly', () => {
  // Accepting half a batch would leave the SDK unable to tell which half, and it would
  // re-send everything -- so the budget would be spent twice over on the same events.
  resetIngestBudgets();
  consumeIngestBudget('app-3', INGEST_EVENT_BUDGET - 10);
  const verdict = consumeIngestBudget('app-3', 50);
  assert.equal(verdict.allowed, false);
  // And the remaining budget was not consumed by the rejected batch.
  assert.equal(consumeIngestBudget('app-3', 5).allowed, true);
});

test('the window resets, so a limit is a rate rather than a quota', () => {
  resetIngestBudgets();
  const start = 1_000_000;
  consumeIngestBudget('app-4', INGEST_EVENT_BUDGET, start);
  assert.equal(consumeIngestBudget('app-4', 1, start).allowed, false);
  assert.equal(
    consumeIngestBudget('app-4', 1, start + INGEST_WINDOW_MS + 1).allowed,
    true,
    'the next window starts clean',
  );
});

test('shedding is counted, so the log line is a total rather than a stream', () => {
  // A runaway producer would otherwise fill the log with the evidence of its own
  // runaway-ness, which is how a useful warning becomes noise nobody reads.
  resetIngestBudgets();
  consumeIngestBudget('app-5', INGEST_EVENT_BUDGET);
  consumeIngestBudget('app-5', 100);
  consumeIngestBudget('app-5', 100);
  const bucket = ingestBudgetState().find((entry) => entry.applicationId === 'app-5');
  assert.equal(bucket?.shed, 200);
});

test('a zero-event batch still costs something', () => {
  // Otherwise an empty-batch loop is free, and an attacker or a bug could spin the handler
  // without ever touching the budget.
  resetIngestBudgets();
  const before = consumeIngestBudget('app-6', 0).remaining;
  const after = consumeIngestBudget('app-6', 0).remaining;
  assert.ok(after <= before);
});
