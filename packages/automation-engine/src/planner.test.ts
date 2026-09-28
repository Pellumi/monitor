import assert from 'node:assert/strict';
import test from 'node:test';
import { edgeCost, guardSatisfied, nodeForPath, planPath } from './planner';
import type { NavigationEdge, NavigationGraph } from './planner';
import { control } from './test-fixtures';

const edge = (overrides: Partial<NavigationEdge> & { id: string; from: string; to: string }): NavigationEdge => ({
  kind: 'LINK', actionClass: 'READ', confidence: 1, control: control(), guard: null,
  evidence: { file: 'src/app.tsx', symbol: null, line: null },
  ...overrides,
});

// login -> dashboard -> courses -> course details; plus a costly shortcut and an admin-only route.
const graph: NavigationGraph = {
  nodes: ['/login', '/dashboard', '/courses', '/courses/{param}', '/admin', '/settings'],
  edges: [
    edge({ id: 'login', from: '/login', to: '/dashboard', kind: 'FORM_SUBMIT', actionClass: 'SERVER_MUTATION' }),
    edge({ id: 'to-courses', from: '/dashboard', to: '/courses' }),
    edge({ id: 'to-course', from: '/courses', to: '/courses/{param}' }),
    edge({ id: 'admin-link', from: '/dashboard', to: '/admin', guard: { requiresAuth: true, roles: ['ADMIN'], confidence: 0.95 } }),
    edge({ id: 'admin-course', from: '/admin', to: '/courses/{param}' }),
  ],
};

const teacher = { authenticated: true, roles: ['TEACHER'] };
const plan = (fromPath: string, toRoute: string, overrides: Partial<Parameters<typeof planPath>[0]> = {}) =>
  planPath({ graph, fromPath, toRoute, persona: teacher, environment: 'STAGING', ...overrides });

test('the planner logs in, then walks to the course', () => {
  const result = plan('/login', '/courses/{param}');
  assert.ok(result.ok);
  if (result.ok) assert.deepEqual(result.steps.map((step) => step.id), ['login', 'to-courses', 'to-course']);
});

test('a concrete path resolves to its route node, preferring the most specific pattern', () => {
  assert.equal(nodeForPath(graph, '/courses/17'), '/courses/{param}');
  assert.equal(nodeForPath(graph, '/courses'), '/courses');
  assert.equal(nodeForPath(graph, '/nowhere'), null);
});

test('already there is a plan with no steps', () => {
  const result = plan('/courses/9', '/courses/{param}');
  assert.ok(result.ok);
  if (result.ok) assert.equal(result.steps.length, 0);
});

test('a doubtful edge costs more than a certain one', () => {
  assert.ok(edgeCost(edge({ id: 'a', from: 'x', to: 'y', confidence: 0.4 })) > edgeCost(edge({ id: 'b', from: 'x', to: 'y', confidence: 1 })));
  assert.ok(edgeCost(edge({ id: 'a', from: 'x', to: 'y', actionClass: 'SERVER_MUTATION' })) > edgeCost(edge({ id: 'b', from: 'x', to: 'y' })));
});

test('a cheaper, more certain route is preferred over a shorter, doubtful one', () => {
  const g: NavigationGraph = {
    nodes: ['/a', '/b', '/c', '/d'],
    edges: [
      edge({ id: 'direct-guess', from: '/a', to: '/d', kind: 'CLICK', confidence: 0.1 }),
      edge({ id: 'ab', from: '/a', to: '/b' }), edge({ id: 'bc', from: '/b', to: '/c' }), edge({ id: 'cd', from: '/c', to: '/d' }),
    ],
  };
  const result = planPath({ graph: g, fromPath: '/a', toRoute: '/d', persona: teacher, environment: 'STAGING' });
  assert.ok(result.ok);
  if (result.ok) assert.deepEqual(result.steps.map((step) => step.id), ['ab', 'bc', 'cd']);
});

test('a guard the persona does not satisfy is routed around when another route exists', () => {
  assert.equal(guardSatisfied(graph.edges.find((e) => e.id === 'admin-link')!, teacher), false);
  const result = plan('/dashboard', '/courses/{param}');
  assert.ok(result.ok);
  if (result.ok) assert.ok(!result.steps.some((step) => step.id === 'admin-link'));
});

test('when the only route is behind a guard the persona fails, the failure says so', () => {
  const guardedOnly: NavigationGraph = { nodes: ['/dashboard', '/admin'], edges: [graph.edges[3]!] };
  const result = planPath({ graph: guardedOnly, fromPath: '/dashboard', toRoute: '/admin', persona: teacher, environment: 'STAGING' });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.failure.kind, 'BLOCKED_BY_GUARD');
    if (result.failure.kind === 'BLOCKED_BY_GUARD') assert.deepEqual(result.failure.blockedBy.map((e) => e.id), ['admin-link']);
  }
  const asAdmin = planPath({ graph: guardedOnly, fromPath: '/dashboard', toRoute: '/admin', persona: { authenticated: true, roles: ['admin'] }, environment: 'STAGING' });
  assert.ok(asAdmin.ok, 'role comparison is case-insensitive');
});

test('an unauthenticated persona cannot cross an auth guard', () => {
  const g: NavigationGraph = { nodes: ['/a', '/b'], edges: [edge({ id: 'ab', from: '/a', to: '/b', guard: { requiresAuth: true, roles: [], confidence: 1 } })] };
  assert.equal(planPath({ graph: g, fromPath: '/a', toRoute: '/b', persona: { authenticated: false, roles: [] }, environment: 'STAGING' }).ok, false);
  assert.ok(planPath({ graph: g, fromPath: '/a', toRoute: '/b', persona: teacher, environment: 'STAGING' }).ok);
});

test('a guess about a guard is a cost, not a wall', () => {
  const doubtful = edge({ id: 'ab', from: '/a', to: '/b', guard: { requiresAuth: true, roles: ['ADMIN'], confidence: 0.3 } });
  const g: NavigationGraph = { nodes: ['/a', '/b'], edges: [doubtful] };
  assert.equal(guardSatisfied(doubtful, teacher), true);
  assert.ok(planPath({ graph: g, fromPath: '/a', toRoute: '/b', persona: teacher, environment: 'STAGING' }).ok);
});

test('a route that needs a forbidden action is reported as blocked by policy, not missing', () => {
  const g: NavigationGraph = { nodes: ['/a', '/b'], edges: [edge({ id: 'wipe', from: '/a', to: '/b', kind: 'CLICK', actionClass: 'DESTRUCTIVE' })] };
  const result = planPath({ graph: g, fromPath: '/a', toRoute: '/b', persona: teacher, environment: 'STAGING' });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.failure.kind, 'BLOCKED_BY_POLICY');
  assert.ok(planPath({ graph: g, fromPath: '/a', toRoute: '/b', persona: teacher, environment: 'STAGING', policy: { approvedClasses: ['DESTRUCTIVE'] } }).ok);
});

test('a target with no route to it is unreachable, distinct from unknown', () => {
  const g: NavigationGraph = { nodes: ['/a', '/island'], edges: [] };
  const result = planPath({ graph: g, fromPath: '/a', toRoute: '/island', persona: teacher, environment: 'STAGING' });
  assert.equal(!result.ok && result.failure.kind, 'NO_PATH');
  assert.equal(!plan('/nowhere', '/courses').ok && (plan('/nowhere', '/courses') as { failure: { kind: string } }).failure.kind, 'UNKNOWN_START');
  assert.equal((plan('/login', '/missing') as { failure: { kind: string } }).failure.kind, 'UNKNOWN_TARGET');
});
