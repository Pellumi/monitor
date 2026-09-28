import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import type { CodebaseAnalysis, CodeEntity } from '@tellann/desktop-contracts';
import { analyzeCodebase } from '../index';

const WORKSPACE = '00000000-0000-4000-8000-000000000006';
const FINGERPRINT = 'e'.repeat(64);

function write(root: string, relative: string, content: string): void {
  const target = path.join(root, ...relative.split('/'));
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
}

function tmp(prefix: string): string {
  return fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
}

const named = (analysis: CodebaseAnalysis, type: CodeEntity['type']): CodeEntity[] => analysis.entities.filter((e) => e.type === type);
const routes = (analysis: CodebaseAnalysis): string[] => named(analysis, 'ui_route').map((e) => String(e.metadata.route));

/**
 * A React Router single-page app: a central route config with a nested, guarded admin route, a
 * dashboard with a link and a programmatic navigation, and a login form.
 */
function buildReactRouterFixture(): string {
  const root = tmp('tellann-navigation-');
  write(root, 'package.json', JSON.stringify({ name: 'spa', private: true, dependencies: { react: '^19.0.0', 'react-router-dom': '^6.0.0' } }));

  write(root, 'src/CourseDetails.tsx', [
    "export default function CourseDetails() { return null; }",
  ].join('\n'));

  write(root, 'src/AdminPanel.tsx', [
    "export default function AdminPanel() { return null; }",
  ].join('\n'));

  write(root, 'src/router.tsx', [
    "import { createBrowserRouter } from 'react-router-dom';",
    "import CourseDetails from './CourseDetails';",
    "import AdminPanel from './AdminPanel';",
    'export const router = createBrowserRouter([',
    "  { path: '/courses/:id', element: <CourseDetails/> },",
    '  {',
    "    path: '/admin',",
    '    element: <AdminPanel/>,',
    '    children: [',
    "      { path: 'reports', element: <AdminPanel/> },",
    '    ],',
    '  },',
    ']);',
  ].join('\n'));

  write(root, 'src/Dashboard.tsx', [
    "import { Link, useNavigate } from 'react-router-dom';",
    'export default function Dashboard() {',
    '  const navigate = useNavigate();',
    '  return (',
    '    <div>',
    "      <Link to=\"/courses/7\">My Course</Link>",
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

  return root;
}

let fixture: { root: string; analysis: CodebaseAnalysis } | null = null;
function analyze(): { root: string; analysis: CodebaseAnalysis } {
  if (!fixture) {
    const root = buildReactRouterFixture();
    fixture = { root, analysis: analyzeCodebase(root, WORKSPACE, FINGERPRINT).analysis };
  }
  return fixture;
}

test('a React Router route config produces ui_route entities, including nested children', () => {
  const { analysis } = analyze();
  assert.ok(routes(analysis).includes('/courses/{param}'));
  assert.ok(routes(analysis).includes('/admin'));
  assert.ok(routes(analysis).includes('/admin/reports'), 'a nested child route joins onto its parent path');
});

test('a route resolved through the checker is attached to the page component\'s own file', () => {
  const { analysis } = analyze();
  const courseRoute = named(analysis, 'ui_route').find((e) => e.metadata.route === '/courses/{param}')!;
  assert.match(courseRoute.path ?? '', /CourseDetails\.tsx$/);
  assert.equal(courseRoute.confidence, 1, 'resolved through the checker');
});

test('a <Link> becomes a navigation action, carrying its destination and a NAVIGATES_TO edge', () => {
  const { analysis } = analyze();
  const navActions = named(analysis, 'ui_action').filter((e) => e.metadata.event === 'navigate');
  const link = navActions.find((e) => e.metadata.href === '/courses/7');
  assert.ok(link, 'the Link should be recorded');
  assert.deepEqual(link!.metadata.labels, ['My Course']);
  assert.equal(link!.metadata.destination, '/courses/7');
  // The edge's own target is a best-effort id from the literal text; resolving a literal like
  // "/courses/7" against the declared "/courses/{param}" pattern is buildNavigationGraph's job
  // (navigation-graph.test.ts), not something extraction alone can promise.
  assert.ok(analysis.relationships.some((edge) => edge.type === 'NAVIGATES_TO' && edge.source === link!.id));
});

test('a useNavigate() call is recorded as programmatic navigation, with the button\'s own label', () => {
  const { analysis } = analyze();
  const navActions = named(analysis, 'ui_action').filter((e) => e.metadata.event === 'navigate');
  const programmatic = navActions.find((e) => e.name.startsWith('Admin'));
  assert.ok(programmatic, 'the navigate(...) call should be recorded');
  assert.deepEqual(programmatic!.metadata.labels, ['Admin']);
  const adminRoute = named(analysis, 'ui_route').find((e) => e.metadata.route === '/admin')!;
  assert.ok(analysis.relationships.some((edge) => edge.type === 'NAVIGATES_TO' && edge.source === programmatic!.id && edge.target === adminRoute.id));
});

test('router.push / history.push are recognised, but an unrelated array.push is not', () => {
  const root = tmp('tellann-nav-arraypush-');
  write(root, 'package.json', JSON.stringify({ name: 'app', private: true, dependencies: { react: '^19.0.0' } }));
  write(root, 'src/App.tsx', [
    'export default function App({ router, list }: any) {',
    "  const go = () => router.push('/next');",
    "  const addItem = () => list.push('/not-a-route');",
    '  return <button onClick={go}>Next</button>;',
    '}',
  ].join('\n'));
  const analysis = analyzeCodebase(root, WORKSPACE, FINGERPRINT).analysis;
  const navActions = named(analysis, 'ui_action').filter((e) => e.metadata.event === 'router.push');
  assert.equal(navActions.length, 1);
  assert.ok(!analysis.entities.some((e) => e.type === 'ui_action' && e.metadata.event === 'list.push'));
});

test('a <form> becomes a ui_form with its fields, and login forms are marked by their password field', () => {
  const { analysis } = analyze();
  const forms = named(analysis, 'ui_form');
  const login = forms.find((f) => f.metadata.hasPasswordField === true);
  assert.ok(login, 'the login form should be found');
  assert.equal((login!.metadata.fields as unknown[]).length, 2);
  const fieldNames = (login!.metadata.fields as Array<{ name: string | null }>).map((f) => f.name);
  assert.deepEqual(fieldNames.sort(), ['email', 'password']);
});

test('a form\'s plain submit button is found even with no onClick handler', () => {
  const { analysis } = analyze();
  const login = named(analysis, 'ui_form').find((f) => f.metadata.hasPasswordField === true)!;
  const submit = login.metadata.submitControl as { labels: string[] } | null;
  assert.ok(submit);
  assert.deepEqual(submit!.labels, ['Log in']);
});

test('a form\'s onSubmit handler is linked as HANDLED_BY', () => {
  const { analysis } = analyze();
  const login = named(analysis, 'ui_form').find((f) => f.metadata.hasPasswordField === true)!;
  assert.ok(analysis.relationships.some((edge) => edge.type === 'HANDLED_BY' && edge.source === login.id));
});

test('Next.js middleware guards the routes its matcher names', () => {
  const root = tmp('tellann-nav-middleware-');
  write(root, 'package.json', JSON.stringify({ name: 'web', private: true, dependencies: { next: '^15.0.0', react: '^19.0.0' } }));
  write(root, 'middleware.ts', [
    'export function middleware() { return; }',
    'export const config = { matcher: ["/dashboard/:path*"] };',
  ].join('\n'));
  write(root, 'app/dashboard/page.tsx', 'export default function Dashboard() { return null; }');
  write(root, 'app/public/page.tsx', 'export default function Public() { return null; }');
  const analysis = analyzeCodebase(root, WORKSPACE, FINGERPRINT).analysis;
  const guard = named(analysis, 'ui_guard').find((g) => g.metadata.source === 'middleware');
  assert.ok(guard);
  const dashboardRoute = named(analysis, 'ui_route').find((r) => r.metadata.route === '/dashboard')!;
  const publicRoute = named(analysis, 'ui_route').find((r) => r.metadata.route === '/public')!;
  assert.ok(analysis.relationships.some((edge) => edge.type === 'GUARDED_BY' && edge.source === dashboardRoute.id && edge.target === guard!.id));
  assert.ok(!analysis.relationships.some((edge) => edge.type === 'GUARDED_BY' && edge.source === publicRoute.id));
});

test('a layout\'s conditional redirect on an auth check is recorded as a guard on its section', () => {
  const root = tmp('tellann-nav-layout-guard-');
  write(root, 'package.json', JSON.stringify({ name: 'web', private: true, dependencies: { next: '^15.0.0', react: '^19.0.0' } }));
  write(root, 'app/admin/layout.tsx', [
    "import { redirect } from 'next/navigation';",
    'export default function AdminLayout({ children }: any) {',
    '  const session = getSession();',
    "  if (!session || session.role !== 'ADMIN') redirect('/login');",
    '  return children;',
    '}',
    'function getSession() { return null as any; }',
  ].join('\n'));
  write(root, 'app/admin/page.tsx', 'export default function Admin() { return null; }');
  const analysis = analyzeCodebase(root, WORKSPACE, FINGERPRINT).analysis;
  const guard = named(analysis, 'ui_guard').find((g) => g.metadata.source === 'layout');
  assert.ok(guard, 'a redirect guarded by an auth check should be found');
  assert.deepEqual(guard!.metadata.roles, ['ADMIN']);
  const adminRoute = named(analysis, 'ui_route').find((r) => r.metadata.route === '/admin')!;
  assert.ok(analysis.relationships.some((edge) => edge.type === 'GUARDED_BY' && edge.source === adminRoute.id && edge.target === guard!.id));
});

test('a layout redirect with no auth-related condition is not mistaken for a guard', () => {
  const root = tmp('tellann-nav-layout-noguard-');
  write(root, 'package.json', JSON.stringify({ name: 'web', private: true, dependencies: { next: '^15.0.0', react: '^19.0.0' } }));
  write(root, 'app/legacy/layout.tsx', [
    "import { redirect } from 'next/navigation';",
    'export default function LegacyLayout() {',
    "  if (Math.random() > 2) redirect('/new-place');",
    '  return null;',
    '}',
  ].join('\n'));
  const analysis = analyzeCodebase(root, WORKSPACE, FINGERPRINT).analysis;
  assert.equal(named(analysis, 'ui_guard').filter((g) => g.metadata.source === 'layout').length, 0);
});
