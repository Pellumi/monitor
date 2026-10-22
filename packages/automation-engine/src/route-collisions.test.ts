import assert from 'node:assert/strict';
import test from 'node:test';
import { findRouteCollisions } from './route-collisions';
import { state } from './test-fixtures';

test('non-colliding routes produce no findings', () => {
  const states = [
    state({ key: 'course_form', role: 'NORMAL', routePatterns: ['/courses/new'] }),
    state({ key: 'course_created', role: 'TERMINAL', terminalKind: 'SUCCESS', routePatterns: ['/courses/{param}/confirmation'] }),
  ];
  assert.deepEqual(findRouteCollisions(states), []);
});

test('colliding routes with no other declared evidence are reported as undisambiguated and critical', () => {
  const states = [
    state({
      key: 'course_form', role: 'NORMAL', routePatterns: ['/courses/{param}'],
      sdkStateSignals: [], requiredElements: [],
    }),
    state({
      key: 'course_overview', role: 'TERMINAL', terminalKind: 'SUCCESS', routePatterns: ['/courses/{param}'],
      sdkStateSignals: [], requiredElements: [],
    }),
  ];
  const findings = findRouteCollisions(states);
  assert.equal(findings.length, 1);
  assert.equal(findings[0]!.code, 'ROUTE_COLLISION_UNDISAMBIGUATED');
  assert.equal(findings[0]!.severity, 'CRITICAL');
  assert.deepEqual(findings[0]!.stateKeys, ['course_overview', 'course_form']);
});

test('colliding routes with distinct declared SDK signals are reported as disambiguated and informational', () => {
  const states = [
    state({
      key: 'course_form', role: 'NORMAL', routePatterns: ['/courses/{param}'],
      sdkStateSignals: ['course_form'], requiredElements: [],
    }),
    state({
      key: 'course_overview', role: 'TERMINAL', terminalKind: 'SUCCESS', routePatterns: ['/courses/{param}'],
      sdkStateSignals: ['course_overview'], requiredElements: [],
    }),
  ];
  const findings = findRouteCollisions(states);
  assert.equal(findings.length, 1);
  assert.equal(findings[0]!.code, 'ROUTE_COLLISION_DISAMBIGUATED');
  assert.equal(findings[0]!.severity, 'INFO');
});

test('colliding routes with distinct declared headings are reported as disambiguated', () => {
  const states = [
    state({
      key: 'course_form', role: 'NORMAL', routePatterns: ['/courses/{param}'],
      sdkStateSignals: [], requiredElements: [], headings: ['Edit Course'],
    }),
    state({
      key: 'course_overview', role: 'TERMINAL', terminalKind: 'SUCCESS', routePatterns: ['/courses/{param}'],
      sdkStateSignals: [], requiredElements: [], headings: ['Course Overview'],
    }),
  ];
  const findings = findRouteCollisions(states);
  assert.equal(findings.length, 1);
  assert.equal(findings[0]!.code, 'ROUTE_COLLISION_DISAMBIGUATED');
});

test('identical declared evidence on both sides does not count as disambiguating', () => {
  const states = [
    state({
      key: 'course_form', role: 'NORMAL', routePatterns: ['/courses/{param}'],
      sdkStateSignals: ['shared'], requiredElements: [], headings: ['Course'],
    }),
    state({
      key: 'course_overview', role: 'TERMINAL', terminalKind: 'SUCCESS', routePatterns: ['/courses/{param}'],
      sdkStateSignals: ['shared'], requiredElements: [], headings: ['Course'],
    }),
  ];
  const findings = findRouteCollisions(states);
  assert.equal(findings.length, 1);
  assert.equal(findings[0]!.code, 'ROUTE_COLLISION_UNDISAMBIGUATED');
});

test('a wildcard pattern against a literal one still collides', () => {
  const states = [
    state({ key: 'course_form', role: 'NORMAL', routePatterns: ['/courses/new'], sdkStateSignals: [] }),
    state({ key: 'course_overview', role: 'TERMINAL', terminalKind: 'SUCCESS', routePatterns: ['/courses/{param}'], sdkStateSignals: [] }),
  ];
  const findings = findRouteCollisions(states);
  assert.equal(findings.length, 1);
  assert.equal(findings[0]!.code, 'ROUTE_COLLISION_UNDISAMBIGUATED');
});

test('two non-terminal states colliding is not this check\'s concern', () => {
  const states = [
    state({ key: 'a', role: 'NORMAL', routePatterns: ['/courses/{param}'], sdkStateSignals: [] }),
    state({ key: 'b', role: 'NORMAL', routePatterns: ['/courses/{param}'], sdkStateSignals: [] }),
  ];
  assert.deepEqual(findRouteCollisions(states), []);
});
