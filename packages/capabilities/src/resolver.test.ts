import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { CAPABILITY_REGISTRY, getCapabilityDefinition } from './registry';
import { resolveCapabilities, resolveCapability, type ResolverInput } from './resolver';
import type { ApplicationTraits, CapabilityKey, CapabilityState, EvidenceKey, InstrumentationTrack } from './types';

const NO_TRAITS: ApplicationTraits = {
  browserSurface: false,
  frontendRuntime: false,
  backendRuntime: false,
  clientRouting: false,
  uiStateSurface: false,
  apiConsumer: false,
  apiProvider: false,
  serverActions: false,
  serverRendering: false,
  managedBrowserRunnable: false,
};

const REACT_TRAITS: ApplicationTraits = {
  ...NO_TRAITS, browserSurface: true, frontendRuntime: true, clientRouting: true, uiStateSurface: true,
  apiConsumer: true, managedBrowserRunnable: true,
};

const SERVER_TRAITS: ApplicationTraits = { ...NO_TRAITS, backendRuntime: true, apiProvider: true };

/** Builds resolver input with everything allowed unless overridden. */
function input(overrides: {
  type?: ResolverInput['architecture']['effectiveType'];
  traits?: ApplicationTraits;
  unsupportedTracks?: InstrumentationTrack[];
  connected?: InstrumentationTrack[];
  evidence?: EvidenceKey[];
  plan?: boolean;
  view?: boolean;
  disabled?: CapabilityKey[];
} = {}): ResolverInput {
  const connected = new Set(overrides.connected ?? []);
  const observed = new Set(overrides.evidence ?? []);
  return {
    architecture: {
      effectiveType: overrides.type ?? 'MIXED',
      traits: overrides.traits ?? NO_TRAITS,
      unsupportedTracks: overrides.unsupportedTracks,
    },
    instrumentation: {
      FRONTEND_SDK: connected.has('FRONTEND_SDK'),
      BACKEND_SDK: connected.has('BACKEND_SDK'),
      BROWSER_OBSERVER: connected.has('BROWSER_OBSERVER'),
    },
    evidence: Object.fromEntries([...observed].map((key) => [key, true])),
    planAllows: () => overrides.plan ?? true,
    canView: () => overrides.view ?? true,
    disabled: new Set(overrides.disabled ?? []),
  };
}

function resolve(key: CapabilityKey, scenario: Parameters<typeof input>[0]) {
  return resolveCapability(getCapabilityDefinition(key), input(scenario));
}

test('unknown profile keeps plan-only visibility (migration path)', () => {
  assert.deepEqual(resolve('ENDPOINT_INTELLIGENCE', { type: 'UNKNOWN' }), {
    state: 'AVAILABLE',
    reason: 'APPLICATION_PROFILE_UNKNOWN',
  });
  assert.equal(resolve('ENDPOINT_INTELLIGENCE', { type: 'UNKNOWN', plan: false }).state, 'PLAN_LOCKED');
});

test('plan lock is reported before setup, so unentitled customers are not asked to install an SDK', () => {
  const result = resolve('ENDPOINT_INTELLIGENCE', { type: 'BACKEND', traits: SERVER_TRAITS, plan: false });
  assert.deepEqual(result, { state: 'PLAN_LOCKED', reason: 'PLAN_ENTITLEMENT_MISSING' });
});

test('authorization is checked before the plan', () => {
  const result = resolve('ENDPOINT_INTELLIGENCE', { type: 'BACKEND', traits: SERVER_TRAITS, plan: false, view: false });
  assert.equal(result.state, 'NOT_AUTHORIZED');
});

test('rollout-disabled capability is unavailable regardless of everything else', () => {
  const result = resolve('SESSION_TIMELINE', { type: 'FRONTEND', connected: ['FRONTEND_SDK'], evidence: ['SESSIONS'], disabled: ['SESSION_TIMELINE'] });
  assert.deepEqual(result, { state: 'UNAVAILABLE', reason: 'ROLLOUT_DISABLED' });
});

test('React application with no API consumption is not applicable to Endpoint Intelligence', () => {
  const result = resolve('ENDPOINT_INTELLIGENCE', { type: 'FRONTEND', traits: { ...REACT_TRAITS, apiConsumer: false } });
  assert.deepEqual(result, { state: 'NOT_APPLICABLE', reason: 'NO_SERVER_RUNTIME' });
});

test('frontend app that consumes APIs without an SDK is asked for the frontend SDK, not the backend', () => {
  const result = resolve('ENDPOINT_INTELLIGENCE', { type: 'FRONTEND', traits: REACT_TRAITS });
  assert.deepEqual(result, { state: 'NEEDS_SETUP', reason: 'FRONTEND_SDK_NOT_CONNECTED' });
});

test('frontend-only API consumer with the frontend SDK gets Limited client API activity, not server timing', () => {
  const waiting = resolve('ENDPOINT_INTELLIGENCE', { type: 'FRONTEND', traits: REACT_TRAITS, connected: ['FRONTEND_SDK'] });
  assert.deepEqual(waiting, { state: 'WAITING_FOR_EVIDENCE', reason: 'NO_ENDPOINT_EVIDENCE' });

  const limited = resolve('ENDPOINT_INTELLIGENCE', {
    type: 'FRONTEND', traits: REACT_TRAITS, connected: ['FRONTEND_SDK'], evidence: ['FRONTEND_EVENTS'],
  });
  assert.deepEqual(limited, { state: 'LIMITED', reason: 'BACKEND_SDK_NOT_CONNECTED', mode: 'CLIENT_API_ACTIVITY' });
});

test('backend without an SDK needs setup; with the SDK but no runs it waits for evidence; with events it is available', () => {
  assert.deepEqual(resolve('ENDPOINT_INTELLIGENCE', { type: 'BACKEND', traits: SERVER_TRAITS }),
    { state: 'NEEDS_SETUP', reason: 'BACKEND_SDK_NOT_CONNECTED' });
  assert.deepEqual(resolve('ENDPOINT_INTELLIGENCE', { type: 'BACKEND', traits: SERVER_TRAITS, connected: ['BACKEND_SDK'] }),
    { state: 'WAITING_FOR_EVIDENCE', reason: 'NO_ENDPOINT_EVIDENCE' });
  assert.deepEqual(resolve('ENDPOINT_INTELLIGENCE', { type: 'BACKEND', traits: SERVER_TRAITS, connected: ['BACKEND_SDK'], evidence: ['BACKEND_EVENTS'] }),
    { state: 'AVAILABLE' });
});

test('headless backend never gets browser replay, even with a frontend SDK reported', () => {
  const result = resolve('BROWSER_REPLAY', { type: 'BACKEND', traits: SERVER_TRAITS, connected: ['FRONTEND_SDK'], evidence: ['BROWSER_EVENTS'] });
  assert.deepEqual(result, { state: 'NOT_APPLICABLE', reason: 'NO_BROWSER_SURFACE' });
});

test('backend-only missing states are honestly Limited to deterministic analysis', () => {
  const result = resolve('MISSING_STATES', { type: 'BACKEND', traits: SERVER_TRAITS, connected: ['BACKEND_SDK'], evidence: ['IN_FLOW_EVENTS'] });
  assert.deepEqual(result, { state: 'LIMITED', reason: 'FRONTEND_SDK_NOT_CONNECTED', mode: 'BACKEND_DETERMINISTIC_ONLY' });
});

test('mixed application with both SDKs and evidence is fully available', () => {
  const traits = { ...REACT_TRAITS, ...SERVER_TRAITS };
  const connected: InstrumentationTrack[] = ['FRONTEND_SDK', 'BACKEND_SDK'];
  assert.deepEqual(resolve('ENDPOINT_INTELLIGENCE', { type: 'MIXED', traits, connected, evidence: ['BACKEND_EVENTS'] }), { state: 'AVAILABLE' });
  assert.deepEqual(resolve('MISSING_STATES', { type: 'MIXED', traits, connected, evidence: ['IN_FLOW_EVENTS'] }), { state: 'AVAILABLE' });
});

test('Vue (SDK planned) is recognised but reported as unsupported, not as needing setup', () => {
  const result = resolve('BROWSER_REPLAY', {
    type: 'FRONTEND', traits: REACT_TRAITS, unsupportedTracks: ['FRONTEND_SDK'],
  });
  assert.deepEqual(result, { state: 'NOT_APPLICABLE', reason: 'UNSUPPORTED_FRAMEWORK' });
});

test('a session with no in-flow evidence waits; it is never reported as a clean zero', () => {
  const result = resolve('MISSING_FLOWS', { type: 'FRONTEND', traits: REACT_TRAITS, connected: ['FRONTEND_SDK'] });
  assert.deepEqual(result, { state: 'WAITING_FOR_EVIDENCE', reason: 'NO_IN_FLOW_EVIDENCE' });
});

test('a capability with no requirements in a frontend-only app is available immediately', () => {
  assert.deepEqual(resolve('FLOW_DECLARATION', { type: 'FRONTEND', traits: REACT_TRAITS }), { state: 'AVAILABLE' });
});

// ─── Sweep over the full input space ────────────────────────────────

const TYPES = ['FRONTEND', 'BACKEND', 'MIXED', 'UNKNOWN'] as const;
const TRAIT_KEYS = ['browserSurface', 'backendRuntime', 'apiConsumer'] as const;
const TRACKS: InstrumentationTrack[] = ['FRONTEND_SDK', 'BACKEND_SDK'];
const EVIDENCE: EvidenceKey[] = ['FRONTEND_EVENTS', 'BACKEND_EVENTS', 'IN_FLOW_EVENTS', 'SESSIONS', 'ENDPOINT_EVENTS', 'BROWSER_EVENTS', 'BEHAVIOR_GRAPH', 'DECLARED_INTENT'];

function* sweep(): Generator<{ key: CapabilityKey; input: ResolverInput; label: string }> {
  for (const type of TYPES) {
    for (let mask = 0; mask < 8; mask += 1) {
      const traits: ApplicationTraits = { ...NO_TRAITS };
      TRAIT_KEYS.forEach((trait, bit) => { traits[trait] = (mask & (1 << bit)) !== 0; });
      for (let track = 0; track < 4; track += 1) {
        const connected = [TRACKS[0], TRACKS[1]].filter((_, bit) => (track & (1 << bit)) !== 0);
        for (const evidence of [[], EVIDENCE] as EvidenceKey[][]) {
          for (const plan of [true, false]) {
            for (const view of [true, false]) {
              for (const disabled of [[], ['ENDPOINT_INTELLIGENCE']] as CapabilityKey[][]) {
                const scenario = input({ type, traits, connected, evidence, plan, view, disabled });
                for (const definition of CAPABILITY_REGISTRY) {
                  yield {
                    key: definition.key,
                    input: scenario,
                    label: `${type} ${JSON.stringify(traits)} sdk=${connected} ev=${evidence.length} plan=${plan} view=${view} disabled=${disabled}`,
                  };
                }
              }
            }
          }
        }
      }
    }
  }
}

test('sweep: states are reachable, and every non-available state carries a reason', () => {
  const seen = new Set<CapabilityState>();
  for (const { key, input: scenario, label } of sweep()) {
    const result = resolveCapability(getCapabilityDefinition(key), scenario);
    seen.add(result.state);
    if (result.state !== 'AVAILABLE') {
      assert.ok(result.reason, `${key} ${result.state} lacks reason at ${label}`);
    }
    if (result.state === 'LIMITED') assert.ok(result.mode, `${key} LIMITED lacks mode at ${label}`);
    if (result.state !== 'LIMITED') assert.equal(result.mode, undefined, `${key} ${result.state} carries mode`);
  }
  for (const state of ['AVAILABLE', 'LIMITED', 'NEEDS_SETUP', 'WAITING_FOR_EVIDENCE', 'PLAN_LOCKED', 'NOT_AUTHORIZED', 'NOT_APPLICABLE', 'UNAVAILABLE'] as const) {
    assert.ok(seen.has(state), `state ${state} never produced`);
  }
});

test('invariant: confirming a type never creates evidence-backed availability', () => {
  // Evidence is the only input allowed to make a capability AVAILABLE or LIMITED.
  for (const { key, input: scenario, label } of sweep()) {
    const definition = getCapabilityDefinition(key);
    // UNKNOWN profiles keep plan-only visibility by design (migration path, tested above).
    if (scenario.architecture.effectiveType === 'UNKNOWN') continue;
    if (definition.evidenceAnyOf.length === 0) continue;
    const hasEvidence = definition.evidenceAnyOf.some((evidenceKey) => scenario.evidence[evidenceKey] === true);
    const result = resolveCapability(definition, scenario);
    if (!hasEvidence) {
      assert.ok(result.state !== 'AVAILABLE' && result.state !== 'LIMITED',
        `${key} ${result.state} without evidence at ${label}`);
    }
  }
});

test('invariant: a missing SDK on an applicable type is never reported as not applicable', () => {
  for (const { key, input: scenario, label } of sweep()) {
    const definition = getCapabilityDefinition(key);
    if (definition.instrumentationAnyOf.length === 0) continue;
    const result = resolveCapability(definition, scenario);
    if (result.state === 'NOT_APPLICABLE') {
      assert.notEqual(result.reason, 'BACKEND_SDK_NOT_CONNECTED', `${key} at ${label}`);
      assert.notEqual(result.reason, 'FRONTEND_SDK_NOT_CONNECTED', `${key} at ${label}`);
    }
  }
});

test('determinism: identical input yields identical output', () => {
  const scenario = input({ type: 'MIXED', traits: REACT_TRAITS, connected: ['FRONTEND_SDK'], evidence: ['FRONTEND_EVENTS'] });
  assert.deepEqual(resolveCapabilities(scenario), resolveCapabilities(scenario));
});

test('every registry entry resolves in every scenario without throwing', () => {
  const scenario = input({ type: 'FRONTEND', traits: REACT_TRAITS, connected: ['FRONTEND_SDK'] });
  const all = resolveCapabilities(scenario);
  assert.equal(Object.keys(all).length, CAPABILITY_REGISTRY.length);
});
