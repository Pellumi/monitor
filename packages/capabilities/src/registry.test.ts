import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { Feature } from '@tellann/shared';
import { CAPABILITY_REGISTRY, getCapabilityDefinition } from './registry';
import { CAPABILITY_KEYS } from './types';

// Routes the dashboard sidebar currently renders (apps/dashboard/src/components/sidebar.tsx).
// Every one must be claimed by exactly one registry entry.
const SIDEBAR_ROUTES = [
  '/declare', '/graph', '/reconciliation', '/graph-drift', '/workflows',
  '/missing-states', '/missing-flows', '/sessions', '/endpoints', '/qa-runs', '/reports',
];

test('every capability key has exactly one registry entry', () => {
  const keys = CAPABILITY_REGISTRY.map((definition) => definition.key);
  assert.equal(new Set(keys).size, keys.length, 'duplicate registry keys');
  assert.deepEqual([...keys].sort(), [...CAPABILITY_KEYS].sort());
});

test('plan entitlements point at real Feature values', () => {
  const features = new Set<string>(Object.values(Feature));
  for (const definition of CAPABILITY_REGISTRY) {
    if (definition.entitlementKey === undefined) continue;
    assert.ok(features.has(definition.entitlementKey), `${definition.key} -> ${definition.entitlementKey}`);
  }
});

test('navigation routes are unique, absolute, and match the sidebar exactly', () => {
  const routes = CAPABILITY_REGISTRY.map((d) => d.navigation.route).filter((r): r is string => r !== null);
  assert.equal(new Set(routes).size, routes.length, 'a route is claimed twice');
  for (const route of routes) assert.ok(route.startsWith('/'), route);
  assert.deepEqual([...routes].sort(), [...SIDEBAR_ROUTES, '/'].sort());
});

test('applicability lists at least one effective type', () => {
  for (const definition of CAPABILITY_REGISTRY) {
    assert.ok(definition.applicability.types.length > 0, definition.key);
  }
});

test('a track is never both required connected and required absent in one mode rule', () => {
  for (const definition of CAPABILITY_REGISTRY) {
    for (const rule of definition.limitedModes) {
      const overlap = rule.whenConnected.filter((track) => rule.whenAbsent.includes(track));
      assert.deepEqual(overlap, [], `${definition.key} ${rule.mode}`);
    }
  }
});

test('browser-only capabilities never apply to a backend-only application', () => {
  for (const definition of CAPABILITY_REGISTRY) {
    const browserOnly = definition.notApplicableReason === 'NO_BROWSER_SURFACE';
    if (!browserOnly) continue;
    assert.ok(!definition.applicability.types.includes('BACKEND'), definition.key);
    assert.ok(definition.applicability.traitsAnyOf?.includes('browserSurface') ||
      definition.applicability.traitsAnyOf?.includes('managedBrowserRunnable'), definition.key);
  }
});

test('getCapabilityDefinition rejects unknown keys', () => {
  assert.throws(() => getCapabilityDefinition('NOT_A_CAPABILITY' as never), /Unknown capability/);
  assert.equal(getCapabilityDefinition('ENDPOINT_INTELLIGENCE').name, 'Endpoint Intelligence');
});
