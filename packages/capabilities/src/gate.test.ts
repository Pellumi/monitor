import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { readRolloutFlags } from './flags';
import { requireCapability, type CapabilityResolverFn, type GateResponse } from './gate';
import type { CapabilityResolution } from './resolver';
import type { CapabilityKey } from './types';

function fakeResponse() {
  const sent: { status: number; body: unknown } = { status: 200, body: undefined };
  const res: GateResponse = {
    status(code) { sent.status = code; return res; },
    json(body) { sent.body = body; return body; },
  };
  return { res, sent };
}

const ENFORCING = readRolloutFlags({ CAPABILITIES_ENFORCE: '1' });
const PASSIVE = readRolloutFlags({});

function gateWith(resolution: CapabilityResolution | Error, flags = ENFORCING) {
  const resolve: CapabilityResolverFn = async () => {
    if (resolution instanceof Error) throw resolution;
    return resolution;
  };
  return requireCapability(resolve, 'ENDPOINT_INTELLIGENCE' as CapabilityKey, flags);
}

async function run(middleware: ReturnType<typeof gateWith>, params: Record<string, string | undefined> = { id: 'app-1' }) {
  const { res, sent } = fakeResponse();
  let nextCalled = false;
  let nextError: unknown;
  await middleware({ params }, res, (error) => { nextCalled = true; nextError = error; });
  return { nextCalled, nextError, sent };
}

test('enforcement off: the request passes through untouched, whatever the state', async () => {
  const result = await run(gateWith({ state: 'PLAN_LOCKED', reason: 'PLAN_ENTITLEMENT_MISSING' }, PASSIVE));
  assert.equal(result.nextCalled, true);
  assert.equal(result.sent.body, undefined);
});

test('AVAILABLE proceeds', async () => {
  const result = await run(gateWith({ state: 'AVAILABLE' }));
  assert.equal(result.nextCalled, true);
});

test('LIMITED proceeds (the handler scopes its answer to the mode)', async () => {
  const result = await run(gateWith({ state: 'LIMITED', reason: 'BACKEND_SDK_NOT_CONNECTED', mode: 'CLIENT_API_ACTIVITY' }));
  assert.equal(result.nextCalled, true);
});

test('NEEDS_SETUP answers 200 with an explained empty payload, never a zero-filled metric', async () => {
  const result = await run(gateWith({ state: 'NEEDS_SETUP', reason: 'BACKEND_SDK_NOT_CONNECTED' }));
  assert.equal(result.nextCalled, false);
  assert.equal(result.sent.status, 200);
  assert.deepEqual(result.sent.body, { capability: 'ENDPOINT_INTELLIGENCE', state: 'NEEDS_SETUP', reason: 'BACKEND_SDK_NOT_CONNECTED', empty: true });
});

test('PLAN_LOCKED answers 402', async () => {
  const result = await run(gateWith({ state: 'PLAN_LOCKED', reason: 'PLAN_ENTITLEMENT_MISSING' }));
  assert.equal(result.sent.status, 402);
});

test('NOT_AUTHORIZED answers 403', async () => {
  const result = await run(gateWith({ state: 'NOT_AUTHORIZED', reason: 'ROLE_PERMISSION_MISSING' }));
  assert.equal(result.sent.status, 403);
});

test('NOT_APPLICABLE answers 404 with the reason, not a bare not-found', async () => {
  const result = await run(gateWith({ state: 'NOT_APPLICABLE', reason: 'NO_SERVER_RUNTIME' }));
  assert.equal(result.sent.status, 404);
  assert.deepEqual(result.sent.body, { error: 'CAPABILITY_UNAVAILABLE', capability: 'ENDPOINT_INTELLIGENCE', state: 'NOT_APPLICABLE', reason: 'NO_SERVER_RUNTIME' });
});

test('a missing application id is a 400, not a silent pass', async () => {
  const result = await run(gateWith({ state: 'AVAILABLE' }), {});
  assert.equal(result.nextCalled, false);
  assert.equal(result.sent.status, 400);
});

test('a resolver failure is passed to the error handler, never allowed through', async () => {
  const failure = new Error('database unavailable');
  const result = await run(gateWith(failure));
  assert.equal(result.nextCalled, true);
  assert.equal(result.nextError, failure);
  assert.equal(result.sent.body, undefined);
});
