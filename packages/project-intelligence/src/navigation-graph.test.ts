import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { planPath } from '@tellann/automation-engine';
import type { CodebaseAnalysis } from '@tellann/desktop-contracts';
import { analyzeCodebase } from './codebase';
import { buildLoginEdge, buildNavigationGraph, proposeLoginForms } from './navigation-graph';

const WORKSPACE = '00000000-0000-4000-8000-000000000007';
const FINGERPRINT = 'd'.repeat(64);

function write(root: string, relative: string, content: string): void {
  const target = path.join(root, ...relative.split('/'));
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
}

function tmp(prefix: string): string {
  return fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
}

/**
 * A small LMS-shaped app: a dashboard links to a specific course by id (a literal href, the way
 * a real page renders one), and a button navigates programmatically to an admin section a
 * middleware guards. A login page sits alongside it, unlinked (the destination after logging in
 * is a runtime fact, not something extraction can discover — see `buildLoginEdge`).
 */
function buildFixture(): string {
  const root = tmp('tellann-navgraph-');
  write(root, 'package.json', JSON.stringify({ name: 'lms', private: true, dependencies: { react: '^19.0.0', 'react-router-dom': '^6.0.0' } }));

  write(root, 'src/CourseDetails.tsx', 'export default function CourseDetails() { return null; }');
  write(root, 'src/AdminPanel.tsx', 'export default function AdminPanel() { return null; }');
  write(root, 'src/router.tsx', [
    "import { createBrowserRouter } from 'react-router-dom';",
    "import CourseDetails from './CourseDetails';",
    "import AdminPanel from './AdminPanel';",
    "import Dashboard from './Dashboard';",
    "import Login from './Login';",
    'export const router = createBrowserRouter([',
    "  { path: '/dashboard', element: <Dashboard/> },",
    "  { path: '/courses/:id', element: <CourseDetails/> },",
    "  { path: '/admin', element: <AdminPanel/> },",
    "  { path: '/login', element: <Login/> },",
    ']);',
  ].join('\n'));

  write(root, 'src/Dashboard.tsx', [
    "import { Link, useNavigate } from 'react-router-dom';",
    'export default function Dashboard() {',
    '  const navigate = useNavigate();',
    '  return (',
    '    <div>',
    '      <Link to="/courses/7">Algebra I</Link>',
    "      <button onClick={() => navigate('/admin')}>Admin</button>",
    '    </div>',
    '  );',
    '}',
  ].join('\n'));

  write(root, 'src/Login.tsx', [
    'export default function Login() {',
    '  const onSubmit = (e: any) => { e.preventDefault(); };',
    '  return (',
    '    <form onSubmit={onSubmit}>',
    '      <input name="email" type="email" />',
    '      <input name="password" type="password" />',
    '      <button type="submit">Log in</button>',
    '    </form>',
    '  );',
    '}',
  ].join('\n'));

  write(root, 'middleware.ts', [
    'export function middleware() { return; }',
    'export const config = { matcher: ["/admin"] };',
  ].join('\n'));

  return root;
}

let cached: ReturnType<typeof analyzeCodebase>['analysis'] | null = null;
function analysis() {
  if (!cached) cached = analyzeCodebase(buildFixture(), WORKSPACE, FINGERPRINT).analysis;
  return cached;
}

test('the graph\'s nodes are every declared route', () => {
  const graph = buildNavigationGraph(analysis());
  for (const route of ['/dashboard', '/courses/{param}', '/admin', '/login']) {
    assert.ok(graph.nodes.includes(route), route);
  }
});

test('a literal link to a parameterized route resolves to the declared pattern, not a dead end', () => {
  const graph = buildNavigationGraph(analysis());
  const toCourse = graph.edges.find((edge) => edge.from === '/dashboard' && edge.to === '/courses/{param}');
  assert.ok(toCourse, 'the Link to /courses/7 should resolve onto /courses/{param}');
  assert.deepEqual(toCourse!.control?.labels, ['Algebra I']);
  assert.equal(toCourse!.kind, 'LINK');
  assert.equal(toCourse!.actionClass, 'READ');
});

test('a guarded route carries its guard on the edge that leads to it', () => {
  const graph = buildNavigationGraph(analysis());
  const toAdmin = graph.edges.find((edge) => edge.to === '/admin');
  assert.ok(toAdmin);
  assert.ok(toAdmin!.guard, 'the middleware guard should be attached');
  assert.equal(toAdmin!.guard!.requiresAuth, true);
});

test('the built graph is actually plannable end to end', () => {
  const graph = buildNavigationGraph(analysis());
  const result = planPath({ graph, fromPath: '/dashboard', toRoute: '/courses/{param}', persona: { authenticated: false, roles: [] }, environment: 'STAGING' });
  assert.ok(result.ok, !result.ok ? JSON.stringify(result.failure) : undefined);
});

test('an unauthenticated persona cannot plan through the guarded admin route', () => {
  const graph = buildNavigationGraph(analysis());
  const result = planPath({ graph, fromPath: '/dashboard', toRoute: '/admin', persona: { authenticated: false, roles: [] }, environment: 'STAGING' });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.failure.kind, 'BLOCKED_BY_GUARD');
});

test('buildLoginEdge finds the login form on the named route and its submit control', () => {
  const edge = buildLoginEdge(analysis(), '/login', '/dashboard');
  assert.ok(edge);
  assert.equal(edge!.from, '/login');
  assert.equal(edge!.to, '/dashboard');
  assert.equal(edge!.kind, 'FORM_SUBMIT');
  assert.equal(edge!.actionClass, 'SERVER_MUTATION');
  assert.deepEqual(edge!.control?.labels, ['Log in']);
  assert.deepEqual(edge!.login?.map((input) => input.dataKey).sort(), ['email', 'password']);
});

test('buildLoginEdge finds nothing on a route with no password field', () => {
  assert.equal(buildLoginEdge(analysis(), '/dashboard', '/dashboard'), null);
  assert.equal(buildLoginEdge(analysis(), '/nowhere', '/dashboard'), null);
});

test('a graph with a login edge lets the entry sequence plan through it, end to end', async () => {
  const { seekInitialState } = await import('@tellann/automation-engine');
  const graph = buildNavigationGraph(analysis());
  const loginEdge = buildLoginEdge(analysis(), '/login', '/dashboard')!;
  graph.edges.push(loginEdge);

  let page = '/login';
  const filled: Record<string, string> = {};
  const app = {
    async snapshot() {
      if (page === '/login') {
        return {
          url: 'http://localhost/login', path: '/login', title: null, headings: [], sdkStates: [], requests: [], errorCount: 0,
          elements: [
            { ref: 'email', tag: 'input', role: 'textbox', name: null, label: null, testId: null, domId: null, href: null, actionAnchor: null, fieldName: 'email', inputType: 'email', visible: true, enabled: true },
            { ref: 'password', tag: 'input', role: 'textbox', name: null, label: null, testId: null, domId: null, href: null, actionAnchor: null, fieldName: 'password', inputType: 'password', visible: true, enabled: true },
            { ref: 'submit', tag: 'button', role: 'button', name: 'Log in', label: null, testId: null, domId: null, href: null, actionAnchor: null, fieldName: null, inputType: null, visible: true, enabled: true },
          ],
        };
      }
      return { url: 'http://localhost/dashboard', path: '/dashboard', title: null, headings: [], elements: [], sdkStates: [], requests: [], errorCount: 0 };
    },
    async act(action: { kind: string; ref?: string; value?: string }) {
      if (action.kind === 'FILL' && action.ref && action.value !== undefined) filled[action.ref] = action.value;
      if (action.kind === 'CLICK' && action.ref === 'submit') page = '/dashboard';
      return { ok: true };
    },
    async settle() { return this.snapshot(); },
  };

  const result = await seekInitialState(app as any, graph, '/dashboard', 'STAGING', {
    persona: {
      id: 'p1', applicationId: '11111111-1111-4111-8111-111111111111', name: 'Teacher', roles: [], authenticated: true, authMethod: 'PASSWORD',
      credentials: [{ field: 'email', value: 'teacher@test.dev' }, { field: 'password', value: 'hunter2' }],
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    },
  });
  assert.ok(result.ok, !result.ok ? result.detail : undefined);
  assert.deepEqual(filled, { email: 'teacher@test.dev', password: 'hunter2' });
});

// -- proposing a login -----------------------------------------------------------


function analysisWith(entities: Array<Record<string, unknown>>): CodebaseAnalysis {
  return { entities: entities.map((entity) => ({ language: null, endLine: null, evidence: [], ...entity })), relationships: [] } as unknown as CodebaseAnalysis;
}
const page = (id: string, file: string, route: string) => ({ id, type: 'ui_route', name: route, path: file, startLine: 1, confidence: 0.9, metadata: { route } });
const form = (id: string, file: string, fields: string[]) => ({
  id, type: 'ui_form', name: id, path: file, startLine: 5, confidence: 0.9,
  metadata: { hasPasswordField: true, fields: fields.map((name) => ({ name, label: null })) },
});

test('a sign-in form is proposed with where it was found and why, and nothing is chosen for the person', () => {
  const proposals = proposeLoginForms(analysisWith([page('r1', 'src/Login.tsx', '/login'), form('f1', 'src/Login.tsx', ['email', 'password'])]));
  assert.equal(proposals.length, 1);
  assert.equal(proposals[0]!.route, '/login');
  assert.deepEqual(proposals[0]!.fields, ['email', 'password']);
  assert.match(proposals[0]!.rationale, /src\/Login\.tsx has a form with a password field \(email, password\), on the page served at \/login/);
});

test('a sign-up form is marked down against a sign-in one, so the likelier answer comes first', () => {
  const proposals = proposeLoginForms(analysisWith([
    page('r1', 'src/Register.tsx', '/register'), form('f1', 'src/Register.tsx', ['firstName', 'email', 'password', 'confirmPassword']),
    page('r2', 'src/Login.tsx', '/login'), form('f2', 'src/Login.tsx', ['email', 'password']),
  ]));
  assert.deepEqual(proposals.map((p) => p.route), ['/login', '/register']);
  assert.ok(proposals[0]!.confidence > proposals[1]!.confidence);
  assert.match(proposals[1]!.rationale, /may be a sign-up form/);
});

test('an address that does not look like a sign-in page says so', () => {
  const [proposal] = proposeLoginForms(analysisWith([page('r1', 'src/Account.tsx', '/settings/security'), form('f1', 'src/Account.tsx', ['currentPassword', 'newPassword'])]));
  assert.match(proposal!.rationale, /does not look like a sign-in page/);
  assert.ok(proposal!.confidence < 0.5);
});

test('a form with no password field, or on no known route, proposes nothing', () => {
  assert.deepEqual(proposeLoginForms(analysisWith([page('r1', 'src/Contact.tsx', '/contact'), { ...form('f1', 'src/Contact.tsx', ['email']), metadata: { hasPasswordField: false, fields: [] } }])), []);
  assert.deepEqual(proposeLoginForms(analysisWith([form('f1', 'src/Orphan.tsx', ['email', 'password'])])), []);
});

test('a proposal is something buildLoginEdge accepts once a person has confirmed it', () => {
  const analysis = analysisWith([page('r1', 'src/Login.tsx', '/login'), form('f1', 'src/Login.tsx', ['email', 'password'])]);
  const [proposal] = proposeLoginForms(analysis);
  const edge = buildLoginEdge(analysis, proposal!.route, '/dashboard');
  assert.ok(edge);
  assert.deepEqual(edge!.login!.map((field) => field.dataKey), ['email', 'password']);
});
