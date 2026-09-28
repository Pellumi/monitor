import assert from 'node:assert/strict';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import test from 'node:test';
import { AutomationLimitsSchema } from '@tellann/desktop-contracts';
import { runAutomation } from '@tellann/automation-engine';
import type { AutomationEvent, AutomationPorts, ExecutableContract } from '@tellann/automation-engine';
import { chromium } from 'playwright';
import type { Browser, Page } from 'playwright';
import { PageAutomationDriver } from './automation-driver';

/**
 * These tests drive a real headless Chromium against a small single-page LMS served over HTTP.
 * The application is deliberately ordinary: client-side routing, a form that POSTs, a request
 * that never finishes, controls that appear only for some users. It reports its state through
 * `window.__sdk`, standing in for the Tellann SDK marker the real application would fire.
 */

const APP = `<!doctype html><html><head><title>LMS</title></head><body><div id="root"></div><script>
window.__sdk = [];
const root = document.getElementById('root');
const sdk = (key) => window.__sdk.push(key);
const params = new URLSearchParams(location.search);
const role = params.get('role') || 'teacher';
function go(path) { history.pushState({}, '', path); render(); }
function render() {
  const path = location.pathname;
  root.innerHTML = '';
  if (path === '/courses/7') {
    root.innerHTML = '<h1>Course Details</h1><button>Students</button>'
      + (role === 'teacher' ? '<button id="create">Create Exam</button>' : '')
      + '<button disabled>Archive</button><button style="display:none">Secret admin</button>';
    const create = document.getElementById('create');
    if (create) create.onclick = () => go('/courses/7/exams/new');
    sdk('course_details');
  } else if (path === '/courses/7/exams/new') {
    root.innerHTML = '<h1>New Exam</h1><label for="t">Title</label><input id="t" name="title"/>'
      + '<button data-testid="submit-exam" id="save">Save exam</button><p id="error"></p>';
    document.getElementById('save').onclick = async () => {
      const title = document.getElementById('t').value;
      const res = await fetch('/api/exams', { method: 'POST', body: JSON.stringify({ title }) });
      if (res.ok) { const body = await res.json(); go('/courses/7/exams/' + body.id); }
      else document.getElementById('error').textContent = 'Could not save';
    };
    sdk('exam_form');
  } else if (/^\\/courses\\/7\\/exams\\/\\d+$/.test(path)) {
    root.innerHTML = '<h1>Exam created</h1>';
    sdk('exam_created');
  }
  if (params.get('poll')) fetch('/api/never-ends').catch(() => {});
}
window.onpopstate = render;
render();
</script></body></html>`;

interface Fixture { baseUrl: string; posts: string[]; close: () => Promise<void>; failNextPost: boolean }

async function startApp(): Promise<Fixture> {
  const fixture = { posts: [] as string[], failNextPost: false } as Fixture;
  const pending = new Set<http.ServerResponse>();
  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://x');
    if (url.pathname === '/api/exams' && req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', () => {
        fixture.posts.push(body);
        // A real network hop, so "the request is in flight" is observable.
        setTimeout(() => {
          if (fixture.failNextPost) { res.writeHead(500); res.end('nope'); return; }
          res.writeHead(201, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ id: 42 }));
        }, 150);
      });
      return;
    }
    if (url.pathname === '/api/never-ends') { pending.add(res); return; } // a long-poll that never answers
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(APP);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  fixture.baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  fixture.close = async () => {
    for (const res of pending) res.destroy();
    await new Promise<void>((resolve) => { server.closeAllConnections(); server.close(() => resolve()); });
  };
  return fixture;
}

let browser: Browser;
test.before(async () => { browser = await chromium.launch({ headless: true }); });
test.after(async () => { await browser.close(); });

async function withPage<T>(run: (page: Page, app: Fixture) => Promise<T>): Promise<T> {
  const app = await startApp();
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    return await run(page, app);
  } finally {
    await context.close();
    await app.close();
  }
}

const driverFor = (page: Page, overrides: Partial<ConstructorParameters<typeof PageAutomationDriver>[1]> = {}) => new PageAutomationDriver(page, {
  sdkStates: () => page.evaluate(() => (window as unknown as { __sdk: string[] }).__sdk.slice()),
  beforeAction: () => { void page.evaluate(() => { (window as unknown as { __sdk: string[] }).__sdk = []; }).catch(() => undefined); },
  quietMs: 100,
  ...overrides,
});

const state = (key: string, extra: Partial<ExecutableContract['states'][number]> = {}): ExecutableContract['states'][number] => ({
  key, name: key, role: 'NORMAL', terminalKind: null, routePatterns: [], requiredElements: [], optionalElements: [],
  sdkStateSignals: [key], expectedApi: [], codeRefs: [], derivation: 'RESOLVED', ...extra,
});
const control = (labels: string[], extra: Partial<ExecutableContract['transitions'][number]['control'] & object> = {}) => ({
  labels, testId: null, domId: null, element: null, event: null, actionAnchor: null, href: null, ...extra,
});

const contract = (): ExecutableContract => ({
  flowVersionId: 'v1', flowHash: 'h', analysisIdentity: null, initialStateKey: 'course_details',
  states: [
    state('course_details', { role: 'INITIAL', routePatterns: ['/courses/{param}'] }),
    state('exam_form', { routePatterns: ['/courses/{param}/exams/new'] }),
    state('exam_created', { role: 'TERMINAL', terminalKind: 'SUCCESS', routePatterns: ['/courses/{param}/exams/{param}'] }),
  ],
  transitions: [
    { id: 't-create', from: 'course_details', to: 'exam_form', action: 'Create Exam', control: control(['Create Exam'], { element: 'button' }), inputs: [], actionClass: 'CLIENT_STATE_MUTATION', expectedApi: [], codeRefs: [], derivation: 'RESOLVED' },
    {
      id: 't-submit', from: 'exam_form', to: 'exam_created', action: 'Save exam', control: control(['Save exam'], { testId: 'submit-exam' }),
      inputs: [{ name: 'title', label: 'Title', dataKey: 'examTitle' }], actionClass: 'SERVER_MUTATION',
      expectedApi: [{ method: 'POST', route: '/api/exams', expectStatus: null }], codeRefs: [], derivation: 'RESOLVED',
    },
  ],
});

function run(page: Page, app: Fixture, driver: PageAutomationDriver, overrides: Record<string, unknown> = {}) {
  const events: AutomationEvent[] = [];
  const ports: AutomationPorts = {
    snapshot: () => driver.snapshot(),
    act: (action) => driver.act(action),
    settle: (expected) => driver.settle(expected),
    emit: (event) => events.push(event),
    now: () => Date.now(),
    health: async () => driver.health(),
    data: (key) => (key === 'examTitle' ? { value: 'Automated QA Exam', secret: false } : undefined),
  };
  return runAutomation(ports, {
    contract: contract(), targetStateKey: 'exam_created', environment: 'DEVELOPMENT', applicationOrigin: app.baseUrl,
    limits: AutomationLimitsSchema.parse({ maxDurationMs: 60_000 }), ...overrides,
  }).then((result) => ({ result, events }));
}

test('the semantic snapshot reports roles, names, labels, and whether controls are usable', async () => {
  await withPage(async (page, app) => {
    await page.goto(`${app.baseUrl}/courses/7`);
    const snapshot = await driverFor(page).snapshot();
    assert.equal(snapshot.path, '/courses/7');
    assert.deepEqual(snapshot.headings, ['Course Details']);
    const byName = (name: string) => snapshot.elements.find((e) => e.name === name);
    assert.equal(byName('Create Exam')?.role, 'button');
    assert.equal(byName('Create Exam')?.visible, true);
    assert.equal(byName('Create Exam')?.enabled, true);
    assert.equal(byName('Archive')?.enabled, false, 'disabled');
    assert.equal(byName('Secret admin')?.visible, false, 'display:none');
    assert.deepEqual(snapshot.sdkStates, ['course_details']);
  });
});

test('form controls are identified by their label and field name', async () => {
  await withPage(async (page, app) => {
    await page.goto(`${app.baseUrl}/courses/7/exams/new`);
    const { elements } = await driverFor(page).snapshot();
    const input = elements.find((e) => e.fieldName === 'title')!;
    assert.equal(input.label, 'Title');
    assert.equal(input.role, 'textbox');
    assert.equal(input.name, 'Title');
    assert.equal(elements.find((e) => e.testId === 'submit-exam')?.name, 'Save exam');
  });
});

test('a snapshot does not modify the application DOM', async () => {
  await withPage(async (page, app) => {
    await page.goto(`${app.baseUrl}/courses/7`);
    const before = await page.evaluate(() => document.documentElement.outerHTML);
    await driverFor(page).snapshot();
    assert.equal(await page.evaluate(() => document.documentElement.outerHTML), before);
  });
});

test('the engine drives the real application from the initial state to the terminal state', async () => {
  await withPage(async (page, app) => {
    await page.goto(`${app.baseUrl}/courses/7`);
    const { result, events } = await run(page, app, driverFor(page));
    assert.equal(result.stopReason, 'TERMINAL_STATE_REACHED', result.detail ?? '');
    assert.deepEqual(result.states.map((s) => s.stateKey), ['course_details', 'exam_form', 'exam_created']);
    assert.equal(app.posts.length, 1, 'the exam was created exactly once');
    assert.equal(JSON.parse(app.posts[0]!).title, 'Automated QA Exam', 'the field was filled from run data');
    assert.equal(new URL(page.url()).pathname, '/courses/7/exams/42');
    assert.ok(events.some((e) => e.type === 'QA_AUTOMATION_TERMINAL_STATE_REACHED'));
  });
});

test('a failing server call is performed once, never retried, and reported as not advancing', async () => {
  await withPage(async (page, app) => {
    app.failNextPost = true;
    await page.goto(`${app.baseUrl}/courses/7`);
    const { result } = await run(page, app, driverFor(page));
    assert.equal(result.stopReason, 'TRANSITION_DID_NOT_ADVANCE');
    assert.equal(app.posts.length, 1, 'a mutation that may have happened is never repeated');
    assert.equal(await page.textContent('#error'), 'Could not save');
  });
});

test('a control the persona cannot see is reported as not found, without clicking anything', async () => {
  await withPage(async (page, app) => {
    await page.goto(`${app.baseUrl}/courses/7?role=student`);
    const { result, events } = await run(page, app, driverFor(page));
    assert.equal(result.stopReason, 'EXPECTED_TRANSITION_NOT_FOUND');
    assert.equal(new URL(page.url()).pathname, '/courses/7', 'the page was not navigated away');
    assert.equal(events.find((e) => e.type === 'QA_AUTOMATION_ACTION_BLOCKED')?.data.reason, 'CONTROL_NOT_FOUND');
  });
});

test('settling does not wait for a request that never finishes', async () => {
  await withPage(async (page, app) => {
    await page.goto(`${app.baseUrl}/courses/7?poll=1`);
    const driver = driverFor(page, { backgroundAfterMs: 300 });
    const started = Date.now();
    const snapshot = await driver.settle('course_details');
    // networkidle would hang here. The long-poll is background traffic once it has been in flight a while.
    assert.ok(Date.now() - started < 4_000, `settled in ${Date.now() - started}ms`);
    assert.deepEqual(snapshot.sdkStates, ['course_details']);
  });
});

test('settling does not stall on a state that never reports through the SDK', async () => {
  await withPage(async (page, app) => {
    await page.goto(`${app.baseUrl}/courses/7`);
    const started = Date.now();
    await driverFor(page, { sdkGraceMs: 400 }).settle('a_state_that_never_reports');
    assert.ok(Date.now() - started < 3_000);
  });
});

test('a ref survives the application re-rendering its DOM between snapshot and click', async () => {
  await withPage(async (page, app) => {
    await page.goto(`${app.baseUrl}/courses/7`);
    const driver = driverFor(page);
    const snapshot = await driver.snapshot();
    const create = snapshot.elements.find((e) => e.name === 'Create Exam')!;
    // A framework replaces the nodes wholesale, as React does on a key change.
    await page.evaluate(() => {
      const root = document.getElementById('root')!;
      const html = root.innerHTML;
      root.innerHTML = '';
      root.innerHTML = html;
      document.getElementById('create')!.onclick = () => { history.pushState({}, '', '/courses/7/exams/new'); document.title = 'moved'; };
    });
    const outcome = await driver.act({ kind: 'CLICK', ref: create.ref });
    assert.equal(outcome.ok, true);
    assert.equal(new URL(page.url()).pathname, '/courses/7/exams/new');
  });
});

test('acting on an element that has gone is reported, not thrown', async () => {
  await withPage(async (page, app) => {
    await page.goto(`${app.baseUrl}/courses/7`);
    const driver = driverFor(page);
    const snapshot = await driver.snapshot();
    const create = snapshot.elements.find((e) => e.name === 'Create Exam')!;
    await page.evaluate(() => document.getElementById('create')!.remove());
    const outcome = await driver.act({ kind: 'CLICK', ref: create.ref });
    assert.equal(outcome.ok, false);
  });
});

test('a failed fill never echoes the value it was given', async () => {
  await withPage(async (page, app) => {
    await page.goto(`${app.baseUrl}/courses/7`);
    const driver = driverFor(page, { actionTimeoutMs: 500 });
    const snapshot = await driver.snapshot();
    const disabled = snapshot.elements.find((e) => e.name === 'Archive')!;
    const outcome = await driver.act({ kind: 'FILL', ref: disabled.ref, value: 'hunter2-secret', secret: true });
    assert.equal(outcome.ok, false);
    assert.ok(!JSON.stringify(outcome).includes('hunter2'));
  });
});

test('requests are reported with their canonical route and status, since the last action', async () => {
  await withPage(async (page, app) => {
    await page.goto(`${app.baseUrl}/courses/7/exams/new`);
    const driver = driverFor(page);
    let snapshot = await driver.snapshot();
    await driver.act({ kind: 'FILL', ref: snapshot.elements.find((e) => e.fieldName === 'title')!.ref, value: 'x', secret: false });
    snapshot = await driver.snapshot();
    await driver.act({ kind: 'CLICK', ref: snapshot.elements.find((e) => e.testId === 'submit-exam')!.ref });
    const after = await driver.settle('exam_created');
    const post = after.requests.find((r) => r.method === 'POST');
    assert.equal(post?.route, '/api/exams');
    assert.equal(post?.status, 201);
    assert.equal(post?.completed, true);
    // A new action starts a new window.
    await driver.act({ kind: 'NAVIGATE', url: `${app.baseUrl}/courses/7` });
    assert.equal((await driver.snapshot()).requests.some((r) => r.method === 'POST'), false);
  });
});

test('a closed page reads as a browser crash', async () => {
  await withPage(async (page, app) => {
    await page.goto(`${app.baseUrl}/courses/7`);
    const driver = driverFor(page);
    assert.equal(driver.health(), 'OK');
    await page.close();
    assert.equal(driver.health(), 'BROWSER_CRASHED');
  });
});
