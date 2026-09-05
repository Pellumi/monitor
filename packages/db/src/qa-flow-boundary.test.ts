import assert from 'node:assert/strict';
import test from 'node:test';
import type { PrismaClient } from '@prisma/client';
import { normalizeQaFlowKey, processQaFlowBoundaryEvent } from './qa-flow-boundary';

type FakeRun = Record<string, any>;

/**
 * Minimal in-memory stand-in for the slice of Prisma the boundary machine uses.
 * `$transaction` runs the callback directly, which is enough to exercise the
 * decision logic; concurrency is the database's contract, not this function's.
 */
function fakePrisma(run: FakeRun | null) {
  const progressEvents = new Map<string, any>();
  const client = {
    async $transaction(fn: (tx: any) => Promise<any>) { return fn(tx); },
  } as unknown as PrismaClient;
  const tx = {
    qARun: {
      async findUnique() { return run; },
      async update({ data }: { data: Record<string, any> }) {
        for (const [key, value] of Object.entries(data)) {
          if (value !== undefined) (run as FakeRun)[key] = value;
        }
        return run;
      },
    },
    qARunProgressEvent: {
      async findUnique({ where }: { where: { id: string } }) {
        return progressEvents.get(where.id) ?? null;
      },
      async create({ data }: { data: Record<string, any> }) {
        if (progressEvents.has(data.id)) throw new Error('UNIQUE_VIOLATION');
        progressEvents.set(data.id, { ...data, runId: data.runId });
        return progressEvents.get(data.id);
      },
    },
  };
  return { client, progressEvents };
}

const FLOW_VERSION = 'version-1';

function buildRun(overrides: FakeRun = {}): FakeRun {
  return {
    id: 'run-1',
    status: 'WAITING_FOR_INITIAL',
    expectedGraphVersionId: FLOW_VERSION,
    initialStateKey: 'sign_in',
    terminalStateKeys: ['order_confirmed'],
    lastObservedStateKey: null,
    boundaryStartedAt: null,
    boundaryCompletedAt: null,
    expectedGraphVersion: {
      snapshot: {
        states: [
          { behaviorKey: 'sign_in' },
          { behaviorKey: 'cart' },
          { behaviorKey: 'order_confirmed' },
        ],
        transitions: [
          { fromStateKey: 'sign_in', toStateKey: 'cart' },
          { fromStateKey: 'cart', toStateKey: 'order_confirmed' },
        ],
      },
    },
    ...overrides,
  };
}

async function submit(prisma: PrismaClient, input: Record<string, any>) {
  return processQaFlowBoundaryEvent(prisma, 'run-1', {
    eventId: input.eventId ?? crypto.randomUUID(),
    eventType: input.eventType,
    flowVersionId: input.flowVersionId ?? FLOW_VERSION,
    stateKey: input.stateKey,
    fromStateKey: input.fromStateKey ?? null,
    toStateKey: input.toStateKey ?? null,
    action: input.action ?? null,
    timestamp: input.timestamp ?? null,
    metadata: input.metadata ?? {},
  });
}

test('normalizes flow keys to a stable comparison form', () => {
  assert.equal(normalizeQaFlowKey('Sign In'), 'sign_in');
  assert.equal(normalizeQaFlowKey('  order-confirmed! '), 'order_confirmed');
  assert.equal(normalizeQaFlowKey(undefined), '');
});

test('an accepted initial event opens the boundary', async () => {
  const run = buildRun();
  const { client } = fakePrisma(run);
  const result = await submit(client, { eventType: 'FLOW_INITIAL_STATE', stateKey: 'sign_in' });
  assert.equal(result.kind, 'ACCEPTED');
  assert.equal(result.phase, 'IN_FLOW');
  assert.equal(result.shouldStop, false);
  assert.ok(run.boundaryStartedAt, 'the run must record when the boundary opened');
  assert.equal(run.status, 'RECORDING');
});

test('detailed capture stays closed until an accepted initial event', async () => {
  const run = buildRun();
  const { client } = fakePrisma(run);
  const result = await submit(client, { eventType: 'FLOW_STATE_REACHED', stateKey: 'cart' });
  assert.equal(result.kind, 'QUARANTINED');
  assert.equal(result.reason, 'BEFORE_INITIAL_BOUNDARY');
  assert.equal(result.phase, 'PRE_BOUNDARY');
  assert.equal(run.boundaryStartedAt, null);
});

test('an initial event for a different state does not open the boundary', async () => {
  const run = buildRun();
  const { client } = fakePrisma(run);
  const result = await submit(client, { eventType: 'FLOW_INITIAL_STATE', stateKey: 'cart' });
  assert.equal(result.reason, 'BEFORE_INITIAL_BOUNDARY');
  assert.equal(run.boundaryStartedAt, null);
});

test('a mismatched flow version is quarantined', async () => {
  const run = buildRun();
  const { client } = fakePrisma(run);
  const result = await submit(client, {
    eventType: 'FLOW_INITIAL_STATE', stateKey: 'sign_in', flowVersionId: 'some-other-version',
  });
  assert.equal(result.reason, 'FLOW_VERSION_MISMATCH');
  assert.equal(result.accepted, false);
});

test('a state absent from the immutable snapshot is quarantined', async () => {
  const run = buildRun();
  const { client } = fakePrisma(run);
  const result = await submit(client, { eventType: 'FLOW_INITIAL_STATE', stateKey: 'not_declared' });
  assert.equal(result.reason, 'UNKNOWN_STATE');
});

test('a duplicate event is idempotent and never double-applies', async () => {
  const run = buildRun();
  const { client, progressEvents } = fakePrisma(run);
  const first = await submit(client, { eventId: 'evt-1', eventType: 'FLOW_INITIAL_STATE', stateKey: 'sign_in' });
  const second = await submit(client, { eventId: 'evt-1', eventType: 'FLOW_INITIAL_STATE', stateKey: 'sign_in' });
  assert.equal(first.kind, 'ACCEPTED');
  assert.equal(second.kind, 'DUPLICATE');
  assert.equal(second.duplicate, true);
  assert.equal(progressEvents.size, 1, 'a replay must not create a second progress event');
});

test('an out-of-order transition is quarantined', async () => {
  const run = buildRun();
  const { client } = fakePrisma(run);
  await submit(client, { eventType: 'FLOW_INITIAL_STATE', stateKey: 'sign_in' });
  const result = await submit(client, {
    eventType: 'FLOW_TRANSITION', stateKey: 'order_confirmed', fromStateKey: 'cart',
  });
  assert.equal(result.reason, 'OUT_OF_ORDER_TRANSITION');
  assert.equal(run.lastObservedStateKey, 'sign_in', 'a rejected event must not advance the run');
});

test('a transition absent from the declared graph is quarantined', async () => {
  const run = buildRun();
  const { client } = fakePrisma(run);
  await submit(client, { eventType: 'FLOW_INITIAL_STATE', stateKey: 'sign_in' });
  const result = await submit(client, {
    eventType: 'FLOW_TRANSITION', stateKey: 'order_confirmed', fromStateKey: 'sign_in',
  });
  assert.equal(result.reason, 'UNKNOWN_TRANSITION');
});

test('a declared transition advances the run', async () => {
  const run = buildRun();
  const { client } = fakePrisma(run);
  await submit(client, { eventType: 'FLOW_INITIAL_STATE', stateKey: 'sign_in' });
  const result = await submit(client, {
    eventType: 'FLOW_TRANSITION', stateKey: 'cart', fromStateKey: 'sign_in', action: 'CONTINUE',
  });
  assert.equal(result.kind, 'ACCEPTED');
  assert.equal(run.lastObservedStateKey, 'cart');
  assert.equal(result.shouldStop, false);
});

test('only a declared terminal state finalizes the run', async () => {
  const run = buildRun();
  const { client } = fakePrisma(run);
  await submit(client, { eventType: 'FLOW_INITIAL_STATE', stateKey: 'sign_in' });
  const undeclared = await submit(client, { eventType: 'FLOW_TERMINAL_STATE', stateKey: 'cart' });
  assert.equal(undeclared.reason, 'UNDECLARED_TERMINAL_STATE');
  assert.equal(undeclared.shouldStop, false);
  assert.equal(run.boundaryCompletedAt, null);

  const declared = await submit(client, { eventType: 'FLOW_TERMINAL_STATE', stateKey: 'order_confirmed' });
  assert.equal(declared.kind, 'ACCEPTED');
  assert.equal(declared.shouldStop, true, 'the desktop finalizes only on a server-confirmed terminal');
  assert.ok(run.boundaryCompletedAt);
  assert.equal(run.completionReason, 'TERMINAL_STATE_REACHED');
});

test('an accepted terminal finalizes exactly once', async () => {
  const run = buildRun();
  const { client } = fakePrisma(run);
  await submit(client, { eventType: 'FLOW_INITIAL_STATE', stateKey: 'sign_in' });
  await submit(client, { eventId: 'terminal', eventType: 'FLOW_TERMINAL_STATE', stateKey: 'order_confirmed' });
  // A replay of the same terminal reports shouldStop so a retrying client
  // converges, but a *new* event after the boundary closed is quarantined.
  const replay = await submit(client, { eventId: 'terminal', eventType: 'FLOW_TERMINAL_STATE', stateKey: 'order_confirmed' });
  assert.equal(replay.kind, 'DUPLICATE');
  assert.equal(replay.shouldStop, true);

  const afterwards = await submit(client, { eventType: 'FLOW_STATE_REACHED', stateKey: 'cart' });
  assert.equal(afterwards.reason, 'AFTER_TERMINAL_BOUNDARY');
});

test('events for a terminal run are refused, not recorded', async () => {
  const run = buildRun({ status: 'COMPLETED', boundaryStartedAt: new Date() });
  const { client, progressEvents } = fakePrisma(run);
  const result = await submit(client, { eventType: 'FLOW_STATE_REACHED', stateKey: 'cart' });
  assert.equal(result.kind, 'RUN_TERMINAL');
  assert.equal(progressEvents.size, 0);
});

test('a paused run quarantines events instead of advancing', async () => {
  const run = buildRun({ status: 'PAUSED', boundaryStartedAt: new Date(), lastObservedStateKey: 'sign_in' });
  const { client } = fakePrisma(run);
  const result = await submit(client, { eventType: 'FLOW_TRANSITION', stateKey: 'cart', fromStateKey: 'sign_in' });
  assert.equal(result.reason, 'RUN_PAUSED');
  assert.equal(run.lastObservedStateKey, 'sign_in');
});

test('an unsupported event type never reaches the boundary logic', async () => {
  const run = buildRun();
  const { client } = fakePrisma(run);
  const result = await submit(client, { eventType: 'PAGE_VIEW', stateKey: 'sign_in' });
  assert.equal(result.reason, 'UNSUPPORTED_FLOW_EVENT');
});

test('missing identifying context is rejected before anything is applied', async () => {
  const run = buildRun();
  const { client } = fakePrisma(run);
  const result = await submit(client, { eventType: 'FLOW_INITIAL_STATE', stateKey: '', flowVersionId: '' });
  assert.equal(result.reason, 'FLOW_EVENT_CONTEXT_REQUIRED');
  assert.equal(run.boundaryStartedAt, null);
});

test('a second initial event after the boundary opened is quarantined', async () => {
  const run = buildRun();
  const { client } = fakePrisma(run);
  await submit(client, { eventType: 'FLOW_INITIAL_STATE', stateKey: 'sign_in' });
  const result = await submit(client, { eventType: 'FLOW_INITIAL_STATE', stateKey: 'sign_in' });
  assert.equal(result.reason, 'INITIAL_BOUNDARY_ALREADY_ACCEPTED');
});

test('a missing run is reported rather than throwing', async () => {
  const { client } = fakePrisma(null);
  const result = await submit(client, { eventType: 'FLOW_INITIAL_STATE', stateKey: 'sign_in' });
  assert.equal(result.kind, 'NOT_FOUND');
  assert.equal(result.run, null);
});

test('frontend and backend SDK events advance the same run', async () => {
  // Both callers go through this one function with the run credential, so a
  // backend-confirmed transition is indistinguishable from a frontend one.
  const run = buildRun();
  const { client } = fakePrisma(run);
  await submit(client, { eventType: 'FLOW_INITIAL_STATE', stateKey: 'sign_in' });
  const fromBackend = await submit(client, {
    eventType: 'FLOW_TRANSITION', stateKey: 'cart', fromStateKey: 'sign_in',
  });
  assert.equal(fromBackend.kind, 'ACCEPTED');
  const fromFrontend = await submit(client, {
    eventType: 'FLOW_TERMINAL_STATE', stateKey: 'order_confirmed',
  });
  assert.equal(fromFrontend.kind, 'ACCEPTED');
  assert.equal(fromFrontend.shouldStop, true);
});

test('key normalization is lenient about formatting but not about identity', async () => {
  // Emitting `Sign In`, `sign-in` or `SIGN_IN` must all resolve to the one
  // declared key, so instrumentation is not forced to match punctuation.
  for (const variant of ['sign_in', 'Sign In', 'sign-in', 'SIGN_IN']) {
    const run = buildRun();
    const { client } = fakePrisma(run);
    const result = await submit(client, { eventType: 'FLOW_INITIAL_STATE', stateKey: variant });
    assert.equal(result.kind, 'ACCEPTED', variant);
  }
  // A route that is not a declared state remains unknown, however it is spelled.
  const run = buildRun();
  const { client } = fakePrisma(run);
  const result = await submit(client, { eventType: 'FLOW_INITIAL_STATE', stateKey: '/checkout/step-2' });
  assert.equal(result.reason, 'UNKNOWN_STATE');
});
