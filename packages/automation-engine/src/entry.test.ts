import assert from 'node:assert/strict';
import test from 'node:test';
import { replayEntryRecipe, seekInitialState } from './entry';
import type { EntryPorts } from './entry';
import type { NavigationEdge, NavigationGraph } from './planner';
import { control, element, snapshot } from './test-fixtures';
import type { ActionOutcome, AutomationAction, SemanticElement, SemanticSnapshot } from './types';
import type { TestPersona } from '@tellann/desktop-contracts';

interface Page { path: string; elements: SemanticElement[] }

/** A minimal site implementing only what the entry sequence needs: snapshot, act, settle. */
class FakeSite implements EntryPorts {
  private key: string;
  private fills: Record<string, string> = {};
  readonly actions: AutomationAction[] = [];

  constructor(
    private readonly pages: Record<string, Page>,
    start: string,
    private readonly clicks: Record<string, string | ((fills: Record<string, string>) => string)>,
  ) {
    this.key = start;
  }

  private view(): SemanticSnapshot {
    const page = this.pages[this.key]!;
    return snapshot({ path: page.path, elements: page.elements });
  }

  async snapshot(): Promise<SemanticSnapshot> {
    return this.view();
  }

  async act(action: AutomationAction): Promise<ActionOutcome> {
    this.actions.push(action);
    if (action.kind === 'FILL') this.fills[action.ref] = action.value;
    if (action.kind === 'CLICK') {
      const target = this.clicks[action.ref];
      const destination = typeof target === 'function' ? target(this.fills) : target;
      if (destination) this.key = destination;
    }
    return { ok: true };
  }

  async settle(): Promise<SemanticSnapshot> {
    return this.view();
  }
}

const edge = (overrides: Partial<NavigationEdge> & { id: string; from: string; to: string }): NavigationEdge => ({
  kind: 'LINK', actionClass: 'READ', confidence: 1, control: control(), guard: null,
  evidence: { file: 'app.tsx', symbol: null, line: null },
  ...overrides,
});

const LOGIN_PAGE: Page = {
  path: '/login',
  elements: [
    element({ ref: 'email-field', tag: 'input', role: 'textbox', fieldName: 'email', label: 'Email' }),
    element({ ref: 'password-field', tag: 'input', role: 'textbox', inputType: 'password', fieldName: 'password', label: 'Password' }),
    element({ ref: 'submit', testId: 'login-submit', name: 'Log in' }),
  ],
};

function buildGraph(): { graph: NavigationGraph; site: () => FakeSite } {
  const graph: NavigationGraph = {
    nodes: ['/login', '/dashboard', '/courses/7', '/admin'],
    edges: [
      edge({
        id: 'login', from: '/login', to: '/dashboard', kind: 'FORM_SUBMIT', actionClass: 'SERVER_MUTATION',
        control: control({ testId: 'login-submit' }),
        login: [{ name: 'email', label: null, dataKey: 'email' }, { name: 'password', label: null, dataKey: 'password' }],
      }),
      edge({ id: 'to-course', from: '/dashboard', to: '/courses/7', control: control({ labels: ['My Course'] }) }),
      edge({
        id: 'to-admin', from: '/dashboard', to: '/admin', control: control({ labels: ['Admin'] }),
        guard: { requiresAuth: true, roles: ['ADMIN'], confidence: 0.9 },
      }),
    ],
  };
  const site = () => new FakeSite(
    {
      login: LOGIN_PAGE,
      dashboard: { path: '/dashboard', elements: [element({ ref: 'course-link', name: 'My Course' }), element({ ref: 'admin-link', name: 'Admin' })] },
      course: { path: '/courses/7', elements: [] },
      admin: { path: '/admin', elements: [] },
    },
    'login',
    {
      submit: (fills) => (fills['email-field'] === 'teacher@test.dev' && fills['password-field'] === 'hunter2' ? 'dashboard' : 'login'),
      'course-link': 'course',
      'admin-link': 'admin',
    },
  );
  return { graph, site };
}

const teacher: TestPersona = {
  id: 'p1', applicationId: '11111111-1111-4111-8111-111111111111', name: 'Teacher', roles: ['TEACHER'], authenticated: true, authMethod: 'PASSWORD',
  credentials: [{ field: 'email', value: 'teacher@test.dev' }, { field: 'password', value: 'hunter2' }],
  createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
};
const wrongPassword: TestPersona = { ...teacher, credentials: [{ field: 'email', value: 'teacher@test.dev' }, { field: 'password', value: 'nope' }] };
const guest: TestPersona = { ...teacher, roles: [], authenticated: false, credentials: [] };
const admin: TestPersona = { ...teacher, roles: ['ADMIN'] };

test('already at the initial route needs no navigation at all', async () => {
  const { graph, site } = buildGraph();
  const app = new FakeSite({ course: { path: '/courses/7', elements: [] } }, 'course', {});
  void site;
  const result = await seekInitialState(app, graph, '/courses/7', 'STAGING', { persona: teacher });
  assert.ok(result.ok);
  assert.equal(app.actions.length, 0);
});

test('logs in with the persona\'s credentials and reaches a route behind login', async () => {
  const { graph, site } = buildGraph();
  const app = site();
  const result = await seekInitialState(app, graph, '/courses/7', 'STAGING', { persona: teacher });
  assert.ok(result.ok, !result.ok ? result.detail : undefined);
  if (result.ok) assert.equal(result.snapshot.path, '/courses/7');
  assert.deepEqual(app.actions.filter((a) => a.kind === 'FILL').map((a) => (a as { value: string }).value), ['teacher@test.dev', 'hunter2']);
});

test('wrong credentials are reported as a failed authentication, not a missing route', async () => {
  const { graph, site } = buildGraph();
  const app = site();
  const result = await seekInitialState(app, graph, '/courses/7', 'STAGING', { persona: wrongPassword });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.stopReason, 'AUTHENTICATION_FAILED');
    assert.match(result.detail, /login/);
  }
  // It never got as far as clicking anything past the login form.
  assert.ok(!app.actions.some((a) => a.kind === 'CLICK' && a.ref === 'course-link'));
});

test('a guest persona is never sent through a login form, even though one exists', async () => {
  const { graph, site } = buildGraph();
  const app = site();
  const result = await seekInitialState(app, graph, '/courses/7', 'STAGING', { persona: guest });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.stopReason, 'INITIAL_STATE_UNREACHABLE');
  assert.equal(app.actions.length, 0, 'nothing was typed or clicked');
});

test('a route needing a role the persona lacks is authorization-blocked, after logging in', async () => {
  const { graph, site } = buildGraph();
  const app = site();
  const result = await seekInitialState(app, graph, '/admin', 'STAGING', { persona: teacher });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.stopReason, 'AUTHORIZATION_BLOCKED');
    assert.match(result.detail, /TEACHER|this persona/);
  }
  // Login did happen (it is a precondition for even knowing the guard is the problem)...
  assert.ok(app.actions.some((a) => a.kind === 'CLICK' && a.ref === 'submit'));
  // ...but the admin link was never clicked, since the plan never included it.
  assert.ok(!app.actions.some((a) => a.kind === 'CLICK' && a.ref === 'admin-link'));
});

test('an admin persona reaches the guarded route', async () => {
  const { graph, site } = buildGraph();
  const app = site();
  const result = await seekInitialState(app, graph, '/admin', 'STAGING', { persona: admin });
  assert.ok(result.ok, !result.ok ? result.detail : undefined);
});

test('an already-authenticated session skips login entirely', async () => {
  const { graph } = buildGraph();
  const app = new FakeSite(
    { dashboard: { path: '/dashboard', elements: [element({ ref: 'course-link', name: 'My Course' })] }, course: { path: '/courses/7', elements: [] } },
    'dashboard',
    { 'course-link': 'course' },
  );
  const result = await seekInitialState(app, graph, '/courses/7', 'STAGING', { persona: teacher, sessionAuthenticated: true });
  assert.ok(result.ok);
  assert.ok(!app.actions.some((a) => a.kind === 'FILL'), 'no credentials were ever needed');
});

test('an already-authenticated session with the wrong role is blocked without attempting to log in again', async () => {
  const { graph } = buildGraph();
  const app = new FakeSite({ dashboard: { path: '/dashboard', elements: [element({ ref: 'admin-link', name: 'Admin' })] } }, 'dashboard', { 'admin-link': 'admin' });
  const result = await seekInitialState(app, graph, '/admin', 'STAGING', { persona: teacher, sessionAuthenticated: true });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.stopReason, 'AUTHORIZATION_BLOCKED');
  assert.equal(app.actions.length, 0);
});

test('with no login in the application, an unreachable route is reported plainly', async () => {
  const graph: NavigationGraph = { nodes: ['/dashboard', '/somewhere'], edges: [] };
  const app = new FakeSite({ dashboard: { path: '/dashboard', elements: [] } }, 'dashboard', {});
  const result = await seekInitialState(app, graph, '/somewhere', 'STAGING', { persona: teacher });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.stopReason, 'INITIAL_STATE_UNREACHABLE');
    assert.match(result.detail, /no login|no declared route/i);
  }
});

test('landing somewhere other than the planned destination is reported, not silently accepted', async () => {
  const graph: NavigationGraph = {
    nodes: ['/dashboard', '/courses/7'],
    edges: [{ ...edge({ id: 'broken-link', from: '/dashboard', to: '/courses/7', control: control({ labels: ['My Course'] }) }) }],
  };
  // Clicking "My Course" actually goes nowhere useful.
  const app = new FakeSite(
    { dashboard: { path: '/dashboard', elements: [element({ ref: 'course-link', name: 'My Course' })] }, elsewhere: { path: '/elsewhere', elements: [] } },
    'dashboard',
    { 'course-link': 'elsewhere' },
  );
  const result = await seekInitialState(app, graph, '/courses/7', 'STAGING', { persona: teacher });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.stopReason, 'INITIAL_STATE_UNREACHABLE');
    assert.match(result.detail, /elsewhere/);
  }
});

test('replaying a recorded recipe performs the same steps and lands where they said it would', async () => {
  const { graph } = buildGraph();
  const app = new FakeSite(
    { dashboard: { path: '/dashboard', elements: [element({ ref: 'course-link', name: 'My Course' })] }, course: { path: '/courses/7', elements: [] } },
    'dashboard',
    { 'course-link': 'course' },
  );
  const steps = graph.edges.filter((e) => e.id === 'to-course');
  const result = await replayEntryRecipe(app, steps, 'STAGING');
  assert.ok(result.ok, !result.ok ? result.detail : undefined);
  if (result.ok) assert.equal(result.snapshot.path, '/courses/7');
});

test('a recorded step whose class the current environment forbids is refused before anything runs', async () => {
  const { graph } = buildGraph();
  const app = new FakeSite({ dashboard: { path: '/dashboard', elements: [] } }, 'dashboard', {});
  const destructive = graph.edges.map((e) => (e.id === 'to-course' ? { ...e, actionClass: 'DESTRUCTIVE' as const } : e)).filter((e) => e.id === 'to-course');
  const result = await replayEntryRecipe(app, destructive, 'STAGING');
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.detail, /DESTRUCTIVE/);
  assert.equal(app.actions.length, 0);
});

test('a recipe that no longer matches the application fails cleanly rather than acting on a guess', async () => {
  const { graph } = buildGraph();
  // The application changed: clicking "My Course" now goes nowhere useful.
  const app = new FakeSite(
    { dashboard: { path: '/dashboard', elements: [element({ ref: 'course-link', name: 'My Course' })] }, elsewhere: { path: '/elsewhere', elements: [] } },
    'dashboard',
    { 'course-link': 'elsewhere' },
  );
  const steps = graph.edges.filter((e) => e.id === 'to-course');
  const result = await replayEntryRecipe(app, steps, 'STAGING');
  assert.equal(result.ok, false);
});

test('a stale label falls back to whatever live control actually leads to the declared destination', async () => {
  const { graph } = buildGraph();
  // The code says "My Course", but the page has since been relabelled to "Open Course" — same href, though.
  const app = new FakeSite(
    { dashboard: { path: '/dashboard', elements: [element({ ref: 'course-link', name: 'Open Course', href: 'http://localhost/courses/7' })] }, course: { path: '/courses/7', elements: [] } },
    'dashboard',
    { 'course-link': 'course' },
  );
  const result = await seekInitialState(app, graph, '/courses/7', 'STAGING', { persona: teacher, sessionAuthenticated: true });
  assert.ok(result.ok, !result.ok ? result.detail : undefined);
  assert.equal(app.actions.length, 1);
});

test('two live candidates leading to the same destination is not a fallback, it is a failure', async () => {
  const { graph } = buildGraph();
  const app = new FakeSite(
    {
      dashboard: {
        path: '/dashboard',
        elements: [
          element({ ref: 'a', name: 'Open Course', href: 'http://localhost/courses/7' }),
          element({ ref: 'b', name: 'Also Course', href: 'http://localhost/courses/7' }),
        ],
      },
      course: { path: '/courses/7', elements: [] },
    },
    'dashboard',
    { a: 'course', b: 'course' },
  );
  const result = await seekInitialState(app, graph, '/courses/7', 'STAGING', { persona: teacher, sessionAuthenticated: true });
  assert.equal(result.ok, false);
  assert.equal(app.actions.length, 0);
});

test('the live-DOM fallback is never used for a login edge: a href match is not a credentialed form', async () => {
  const { graph, site } = buildGraph();
  const app = site();
  // Remove the login submit's testId/label match entirely so resolveStep fails on it, and add an
  // unrelated href that happens to point at /dashboard — this must never be treated as "logging in".
  const noMatch = new FakeSite(
    {
      login: { path: '/login', elements: [{ ...LOGIN_PAGE.elements[0]! }, { ...LOGIN_PAGE.elements[1]! }, element({ ref: 'decoy', name: 'Learn more', href: 'http://localhost/dashboard' })] },
      dashboard: { path: '/dashboard', elements: [] },
    },
    'login',
    { decoy: 'dashboard' },
  );
  void app;
  const result = await seekInitialState(noMatch, graph, '/courses/7', 'STAGING', { persona: teacher });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.stopReason, 'INITIAL_STATE_UNREACHABLE');
  assert.equal(noMatch.actions.length, 0, 'the decoy link was never clicked in place of logging in');
});

test('the fallback is not offered when the control was found but ambiguous, or when data was the problem', async () => {
  // CONTROL_AMBIGUOUS and DATA_UNAVAILABLE are not "the graph is stale" — the fallback only ever
  // applies to CONTROL_NOT_FOUND.
  const graph: NavigationGraph = {
    nodes: ['/a', '/b'],
    edges: [edge({ id: 'ab', from: '/a', to: '/b', control: control({ labels: ['Go'] }) })],
  };
  const app = new FakeSite(
    { a: { path: '/a', elements: [element({ ref: 'x', name: 'Go' }), element({ ref: 'y', name: 'Go' })] }, b: { path: '/b', elements: [] } },
    'a',
    {},
  );
  const result = await seekInitialState(app, graph, '/b', 'STAGING', { persona: teacher });
  assert.equal(result.ok, false);
  assert.equal(app.actions.length, 0);
});
