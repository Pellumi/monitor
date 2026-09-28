import assert from 'node:assert/strict';
import test from 'node:test';
import { LMS_INITIAL_ROUTE, LMS_STATE_IDS, LMS_USERS, lmsFlow, lmsNavigation, startLmsApp } from './index';
import type { LmsApp } from './index';

async function withApp<T>(run: (app: LmsApp) => Promise<T>, faults = {}): Promise<T> {
  const app = await startLmsApp({ faults });
  try {
    return await run(app);
  } finally {
    await app.close();
  }
}

async function login(app: LmsApp, user: keyof typeof LMS_USERS = 'teacher'): Promise<string> {
  const response = await fetch(`${app.origin}/api/login`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: LMS_USERS[user].email, password: LMS_USERS[user].password }),
  });
  assert.equal(response.status, 200);
  const cookie = /lms_session=[a-f0-9]+/.exec(response.headers.get('set-cookie') ?? '')?.[0];
  assert.ok(cookie, 'a session cookie is issued');
  return cookie!;
}

const post = (app: LmsApp, cookie: string | null, body: unknown) => fetch(`${app.origin}/api/exams`, {
  method: 'POST', headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) }, body: JSON.stringify(body),
});

test('the application serves its single page from every path, on loopback', async () => {
  await withApp(async (app) => {
    assert.match(app.url, /^http:\/\/127\.0\.0\.1:\d+\/login$/);
    for (const path of ['/', '/login', '/courses/7', '/courses/7/exams/new']) {
      const response = await fetch(`${app.origin}${path}`);
      assert.equal(response.status, 200, path);
      assert.match(await response.text(), /<div id="root">/);
    }
  });
});

test('a session exists only after a successful login, and is an HttpOnly cookie', async () => {
  await withApp(async (app) => {
    assert.equal((await fetch(`${app.origin}/api/session`)).status, 401);
    const bad = await fetch(`${app.origin}/api/login`, { method: 'POST', body: JSON.stringify({ email: LMS_USERS.teacher.email, password: 'wrong' }) });
    assert.equal(bad.status, 401);
    const good = await fetch(`${app.origin}/api/login`, {
      method: 'POST', body: JSON.stringify({ email: LMS_USERS.teacher.email, password: LMS_USERS.teacher.password }),
    });
    assert.match(good.headers.get('set-cookie') ?? '', /HttpOnly/);
    const cookie = /lms_session=[a-f0-9]+/.exec(good.headers.get('set-cookie') ?? '')![0];
    const session = await fetch(`${app.origin}/api/session`, { headers: { cookie } });
    assert.deepEqual(await session.json(), { email: LMS_USERS.teacher.email, role: 'TEACHER' });
  });
});

test('only a teacher may create an exam, and only with a title', async () => {
  await withApp(async (app) => {
    assert.equal((await post(app, null, { title: 'x' })).status, 401);
    const student = await login(app, 'student');
    assert.equal((await post(app, student, { title: 'x' })).status, 403, 'the role decides, not the UI');
    const teacher = await login(app, 'teacher');
    assert.equal((await post(app, teacher, { title: '   ' })).status, 422);
    const created = await post(app, teacher, { title: 'Midterm' });
    assert.equal(created.status, 201);
    assert.deepEqual(await created.json(), { id: 41 });
    assert.deepEqual(app.exams, [{ id: 41, title: 'Midterm', by: LMS_USERS.teacher.email }]);
  });
});

test('faults are switchable while the application runs', async () => {
  await withApp(async (app) => {
    const teacher = await login(app);
    app.faults.saveFails = true;
    assert.equal((await post(app, teacher, { title: 'x' })).status, 500);
    app.faults.saveFails = false;
    assert.equal((await post(app, teacher, { title: 'x' })).status, 201);
    app.faults.loginRejects = true;
    const rejected = await fetch(`${app.origin}/api/login`, {
      method: 'POST', body: JSON.stringify({ email: LMS_USERS.teacher.email, password: LMS_USERS.teacher.password }),
    });
    assert.equal(rejected.status, 401, 'correct credentials are still refused');
  });
});

test('every request is recorded, so a test can prove what was and was not sent', async () => {
  await withApp(async (app) => {
    await fetch(`${app.origin}/login`);
    await login(app);
    assert.deepEqual(app.requests.map((request) => `${request.method} ${request.path}`), ['GET /login', 'POST /api/login']);
    assert.ok(app.requests[1]!.body.includes(LMS_USERS.teacher.password), 'the server saw the password: the point is what the *client* keeps of it');
  });
});

test('the declared Flow is consistent with the application it describes', () => {
  const flow = lmsFlow();
  const ids = new Set(flow.flow.states.map((state) => state.id));
  assert.equal(flow.flow.states.filter((state) => state.role === 'INITIAL').length, 1);
  assert.ok(flow.flow.transitions.every((t) => ids.has(t.fromStateId) && ids.has(t.toStateId)));
  const entities = new Set(flow.code.entities.map((entity) => entity.id));
  assert.ok(flow.checkpoints.every((checkpoint) => checkpoint.mapping.entityId && entities.has(checkpoint.mapping.entityId)), 'every checkpoint maps to a real entity');
  assert.ok(flow.code.relationships.every((edge) => entities.has(edge.source) && entities.has(edge.target)));
});

test('the navigation graph leads from the login page to the Flow\'s first state, and login is explicit', () => {
  const graph = lmsNavigation();
  assert.ok(graph.nodes.includes('/login') && graph.nodes.includes('/courses/{param}'));
  assert.equal(LMS_INITIAL_ROUTE, '/courses/7');
  const login = graph.edges.filter((edge) => edge.login);
  assert.equal(login.length, 1);
  assert.deepEqual(login[0]!.login!.map((field) => field.dataKey), ['email', 'password']);
  const targets = graph.edges.filter((edge) => !edge.login).map((edge) => `${edge.from}->${edge.to}`);
  assert.deepEqual(targets, ['/dashboard->/courses', '/courses->/courses/{param}']);
});

test('a role can be required for the course pages, for tests of what a persona is allowed to reach', () => {
  const open = lmsNavigation().edges.find((edge) => edge.id === 'nav-course')!;
  assert.deepEqual(open.guard!.roles, []);
  const closed = lmsNavigation({ courseRoles: ['TEACHER'] }).edges.find((edge) => edge.id === 'nav-course')!;
  assert.deepEqual(closed.guard!.roles, ['TEACHER']);
});

test('the page is told how to report its states, and the state ids match the Flow', async () => {
  for (const style of ['typed', 'slug', 'adapter'] as const) {
    const app = await startLmsApp({ markers: style });
    try {
      const html = await (await fetch(`${app.origin}/login`)).text();
      assert.ok(html.includes(`window.__markerStyle = "${style}"`), style);
    } finally {
      await app.close();
    }
  }
  const flowIds = lmsFlow().flow.states.map((state) => state.id).sort();
  assert.deepEqual(Object.values(LMS_STATE_IDS).sort(), flowIds, 'an adapter marker names a state that exists in the Flow');
  assert.deepEqual(lmsFlow().flow.states.map((state) => state.behaviorKey).sort(), Object.keys(LMS_STATE_IDS).sort());
});
