import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import type { ApplicationArchitectureProjection } from '@tellann/desktop-contracts';
import { toResolverInput, unsupportedInstrumentation } from './bridge';
import { enforcementFor } from './enforce';
import { resolveNavigation, type NavigationItem } from './navigation';
import { resolveCapabilities, type CapabilityResolutionMap } from './resolver';
import type { ApplicationTraits } from './types';

const REACT_TRAITS: ApplicationTraits = {
  browserSurface: true, frontendRuntime: true, backendRuntime: false, clientRouting: true,
  uiStateSurface: false, apiConsumer: true, apiProvider: false, serverActions: false,
  serverRendering: false, managedBrowserRunnable: true,
};

const SERVER_TRAITS: ApplicationTraits = {
  browserSurface: false, frontendRuntime: false, backendRuntime: true, clientRouting: false,
  uiStateSurface: false, apiConsumer: false, apiProvider: true, serverActions: false,
  serverRendering: false, managedBrowserRunnable: false,
};

function projection(overrides: Partial<ApplicationArchitectureProjection> = {}): ApplicationArchitectureProjection {
  return {
    detectedType: 'FRONTEND',
    confidence: 'HIGH',
    scores: { frontend: 90, backend: 0 },
    traits: REACT_TRAITS,
    frameworks: [{ id: 'react', version: '18.2.0', sdkSupport: 'SUPPORTED' }],
    routeTemplates: [],
    workspaceRoot: '.',
    analysisSnapshotId: 'snap-1',
    detectorVersion: '1',
    warnings: [],
    ...overrides,
  };
}

const ALLOW = { planAllows: () => true, canView: () => true };

function navItems(resolutions: CapabilityResolutionMap): NavigationItem[] {
  return resolveNavigation(resolutions).flatMap((section) => section.items);
}

test('confirmed type overrides the detected type for resolution; the detected type is left untouched', () => {
  const stored = projection({ detectedType: 'FRONTEND' });
  const input = toResolverInput({ projection: stored, confirmedType: 'MIXED', instrumentation: {}, evidence: {}, ...ALLOW });
  assert.equal(input.architecture.effectiveType, 'MIXED');
  assert.equal(stored.detectedType, 'FRONTEND');
});

test('no projection means UNKNOWN, which keeps the legacy plan-only path', () => {
  const input = toResolverInput({ projection: null, instrumentation: {}, evidence: {}, ...ALLOW });
  assert.equal(input.architecture.effectiveType, 'UNKNOWN');
  assert.deepEqual(resolveCapabilities(input).ENDPOINT_INTELLIGENCE, {
    state: 'AVAILABLE',
    reason: 'APPLICATION_PROFILE_UNKNOWN',
  });
});

test('a planned SDK track becomes an unsupported instrumentation track only when no supported framework shares it', () => {
  const vue = projection({ frameworks: [{ id: 'vue', version: '3.4.0', sdkSupport: 'PLANNED' }] });
  assert.deepEqual(unsupportedInstrumentation(vue), ['FRONTEND_SDK']);

  const mixedTrack = projection({
    frameworks: [
      { id: 'vue', version: null, sdkSupport: 'PLANNED' },
      { id: 'react', version: null, sdkSupport: 'SUPPORTED' },
    ],
  });
  assert.deepEqual(unsupportedInstrumentation(mixedTrack), []);
});

test('Vue application gets an explained browser replay, not a setup prompt', () => {
  const vue = projection({ frameworks: [{ id: 'vue', version: '3.4.0', sdkSupport: 'PLANNED' }] });
  const input = toResolverInput({ projection: vue, instrumentation: {}, evidence: {}, ...ALLOW });
  assert.deepEqual(resolveCapabilities(input).BROWSER_REPLAY, {
    state: 'NOT_APPLICABLE',
    reason: 'UNSUPPORTED_FRAMEWORK',
  });
});

test('React app with the frontend SDK and no runs: flow declaration and waiting items are shown, with states', () => {
  const input = toResolverInput({
    projection: projection(),
    instrumentation: { FRONTEND_SDK: true },
    evidence: {},
    ...ALLOW,
  });
  const items = navItems(resolveCapabilities(input));
  const byRoute = new Map(items.map((item) => [item.route, item]));

  assert.equal(byRoute.get('/declare')?.state, 'AVAILABLE', 'flow declaration needs no telemetry');
  assert.equal(byRoute.get('/endpoints')?.state, 'WAITING_FOR_EVIDENCE', 'frontend API consumer waits for API activity');
  assert.equal(byRoute.get('/sessions')?.state, 'WAITING_FOR_EVIDENCE');
  assert.equal(byRoute.get('/qa-runs')?.state, 'WAITING_FOR_EVIDENCE', 'managed browser app can be walked through');
});

test('backend-only application: browser-only navigation disappears, backend navigation remains', () => {
  const backend = projection({
    detectedType: 'BACKEND',
    scores: { frontend: 0, backend: 90 },
    traits: SERVER_TRAITS,
    frameworks: [{ id: 'express', version: '4.19.0', sdkSupport: 'SUPPORTED' }],
  });
  const input = toResolverInput({
    projection: backend,
    instrumentation: { BACKEND_SDK: true },
    evidence: { BACKEND_EVENTS: true, ENDPOINT_EVENTS: true, IN_FLOW_EVENTS: true },
    ...ALLOW,
  });
  const routes = navItems(resolveCapabilities(input)).map((item) => item.route);

  assert.ok(!routes.includes('/qa-runs'), 'no managed browser run for a headless service');
  assert.ok(routes.includes('/endpoints'), 'endpoint intelligence applies to a server');
  assert.ok(routes.includes('/missing-states'), 'missing states are offered as deterministic-only');
  assert.ok(routes.includes('/sessions'), 'session timeline remains for a backend');
});

test('plan-locked items stay in navigation, marked locked, so the upgrade path is visible', () => {
  const input = toResolverInput({
    projection: projection(),
    instrumentation: { FRONTEND_SDK: true },
    evidence: {},
    planAllows: () => false,
    canView: () => true,
  });
  const flow = navItems(resolveCapabilities(input)).find((item) => item.key === 'FLOW_DECLARATION');
  assert.ok(flow, 'locked item is shown, not hidden');
  assert.equal(flow.state, 'PLAN_LOCKED');
  assert.equal(flow.locked, true);
});

test('an item the user may not view is removed from navigation', () => {
  const input = toResolverInput({
    projection: projection(),
    instrumentation: { FRONTEND_SDK: true },
    evidence: {},
    planAllows: () => true,
    canView: (key) => key !== 'QA_RUNS',
  });
  const routes = navItems(resolveCapabilities(input)).map((item) => item.route);
  assert.ok(!routes.includes('/qa-runs'));
});

test('enforcement: each state maps to exactly one HTTP decision', () => {
  const cases: Array<[Parameters<typeof enforcementFor>[0], ReturnType<typeof enforcementFor>]> = [
    [{ state: 'AVAILABLE' }, { action: 'PROCEED' }],
    [
      { state: 'LIMITED', reason: 'BACKEND_SDK_NOT_CONNECTED', mode: 'CLIENT_API_ACTIVITY' },
      { action: 'PROCEED', mode: 'CLIENT_API_ACTIVITY' },
    ],
    [
      { state: 'NEEDS_SETUP', reason: 'BACKEND_SDK_NOT_CONNECTED' },
      { action: 'TYPED_EMPTY', reason: 'BACKEND_SDK_NOT_CONNECTED' },
    ],
    [
      { state: 'WAITING_FOR_EVIDENCE', reason: 'NO_ENDPOINT_EVIDENCE' },
      { action: 'TYPED_EMPTY', reason: 'NO_ENDPOINT_EVIDENCE' },
    ],
    [
      { state: 'PLAN_LOCKED', reason: 'PLAN_ENTITLEMENT_MISSING' },
      { action: 'REJECT', status: 402, reason: 'PLAN_ENTITLEMENT_MISSING' },
    ],
    [
      { state: 'NOT_AUTHORIZED', reason: 'ROLE_PERMISSION_MISSING' },
      { action: 'REJECT', status: 403, reason: 'ROLE_PERMISSION_MISSING' },
    ],
    [
      { state: 'NOT_APPLICABLE', reason: 'NO_SERVER_RUNTIME' },
      { action: 'REJECT', status: 404, reason: 'NO_SERVER_RUNTIME' },
    ],
    [
      { state: 'UNAVAILABLE', reason: 'CAPABILITY_NOT_SHIPPED' },
      { action: 'REJECT', status: 404, reason: 'CAPABILITY_NOT_SHIPPED' },
    ],
  ];
  for (const [resolution, expected] of cases) {
    assert.deepEqual(enforcementFor(resolution), expected, resolution.state);
  }
});

test('navigation never contains a hidden state', () => {
  const resolutions = resolveCapabilities(toResolverInput({
    projection: projection(),
    instrumentation: { FRONTEND_SDK: true },
    evidence: {},
    ...ALLOW,
  }));
  for (const item of navItems(resolutions)) {
    assert.ok(!['NOT_APPLICABLE', 'UNAVAILABLE', 'NOT_AUTHORIZED'].includes(item.state), item.key);
  }
});
