import crypto from 'node:crypto';
import http from 'node:http';
import type { AddressInfo } from 'node:net';

/**
 * A small LMS, and the Flow declared over it.
 *
 *   login -> dashboard -> courses -> course details -> new exam form -> exam created
 *
 * It exists so that Automated Run has one shared, ordinary application to be tested against
 * end to end (the acceptance script, the browser tests) instead of each test growing its own. It is
 * deliberately plain: client-side routing, a session cookie, a login form, a role-dependent control, a
 * form that POSTs, and a handful of switchable faults that make the application misbehave in the
 * specific ways the engine has to tell apart.
 *
 * It reports its state the way an instrumented application would, by pushing state keys onto
 * `window.__sdk`; the Flow's boundary is still decided by the real SDK in real runs, and nothing here
 * pretends to be one.
 */

export const LMS_USERS = {
  teacher: { email: 'teacher@lms.test', password: 'TeacherPass1!', role: 'TEACHER' },
  student: { email: 'student@lms.test', password: 'StudentPass1!', role: 'STUDENT' },
} as const;

/** The three shapes a Flow marker can take (see `@tellann/automation-engine`'s `sdk-signals`). */
export type LmsMarkerStyle = 'typed' | 'slug' | 'adapter';

/** The ids the Flow gives its states, which is how an instrumentation adapter's markers name them. */
export const LMS_STATE_IDS = { course_details: 's-course', exam_form: 's-form', exam_created: 's-created' } as const;

export interface LmsFaults {
  /** Saving an exam fails with a server error. The application prevents the step; the run did nothing wrong. */
  saveFails?: boolean;
  /** Saving an exam sends the user back to the course page instead of to the new exam. A step that goes round in a circle. */
  saveLoopsBack?: boolean;
  /** Saving an exam does nothing visible at all. */
  saveDoesNothing?: boolean;
  /** Logging in always fails, whatever the credentials. */
  loginRejects?: boolean;
  /** The "Create Exam" control is not rendered for anyone, so the declared transition has no control on the page. */
  hideCreateExam?: boolean;
  /**
   * The two controls say something else ("Add a new exam", "Publish") and the save button loses its test id: the
   * kind of copy change a redesign makes, which no label the code analysis found can survive.
   */
  renameLabels?: boolean;
  /**
   * The sign-in page carries a CAPTCHA widget: something that exists to tell software from people. A run must hand this
   * to a person and never touch the page: not the widget, and not the form beside it.
   */
  captchaOnLogin?: boolean;
}

export interface LmsRequest {
  method: string;
  path: string;
  body: string;
  cookie: string | null;
  at: number;
}

export interface LmsApp {
  url: string;
  origin: string;
  /** Every request the server received, in order. */
  readonly requests: LmsRequest[];
  /** Exams created through the API. */
  readonly exams: Array<{ id: number; title: string; by: string; fields: LmsRichFields }>;
  faults: LmsFaults;
  close(): Promise<void>;
}

/** What the rich form posts, as the server recorded it. */
export interface LmsRichFields {
  kind?: string;
  publish?: boolean;
  visibility?: string;
  due?: string;
  syllabus?: { name: string; size: number; text: string } | null;
}

export interface LmsOptions {
  port?: number;
  faults?: LmsFaults;
  /** How the page reports the Flow states it reaches. Default `typed`: the SDK's own calls. */
  markers?: LmsMarkerStyle;
  /** Puts a stable `data-tellann-action` anchor on the two controls, as approved instrumentation would. */
  anchors?: boolean;
  /**
   * The exam form also has a select, a checkbox, a radio group, a date and a file upload, so a run has to use every
   * kind of control a real form has. The exam the server records carries what each one held.
   */
  richForm?: boolean;
}

const COURSE_ID = 7;

const CLIENT = `
window.__sdk = [];
window.__markers = [];
const STATE_IDS = ${JSON.stringify(LMS_STATE_IDS)};
// The state keys the page has reached (\`__sdk\`), and the same thing as the application would really
// report it: a marker in one of three shapes (\`__markers\`).
const sdk = (key) => {
  window.__sdk.push(key);
  const style = window.__markerStyle || 'typed';
  if (style === 'slug') window.__markers.push({ flow: 'lms-flow', state: key.replace(/_/g, '-') });
  else if (style === 'adapter') window.__markers.push({ checkpointId: 'state:' + STATE_IDS[key], stateId: STATE_IDS[key], transitionId: null, terminalKind: null, flowInitializationId: 'init-1', source: 'tellann-adapter' });
  else window.__markers.push({ flowVersionId: 'lms-flow-v1', stateKey: key });
};
const root = document.getElementById('root');
const FAULTS = window.__faults || {};
let user = null;
function go(path) { history.pushState({}, '', path); render(); }
window.onpopstate = () => render();
async function boot() {
  try { const r = await fetch('/api/session'); user = r.ok ? await r.json() : null; } catch (e) { user = null; }
  render();
}
function page(html) { root.innerHTML = html; }
function render() {
  const path = location.pathname;
  const protectedPath = /^\\/(dashboard|courses)/.test(path);
  if (protectedPath && !user) { history.replaceState({}, '', '/login'); return render(); }
  if (path === '/' ) { history.replaceState({}, '', user ? '/dashboard' : '/login'); return render(); }
  if (path === '/login') {
    page('<h1>Sign in</h1>' + (FAULTS.captchaOnLogin ? '<div class="g-recaptcha" data-sitekey="fixture"><label><input type="checkbox" id="not-robot"/> I am not a robot</label></div>' : '') + '<form id="login"><label for="email">Email</label><input id="email" name="email" type="email"/>'
      + '<label for="password">Password</label><input id="password" name="password" type="password"/>'
      + '<button type="submit">Sign in</button><p id="login-error" role="alert"></p></form>');
    document.getElementById('login').onsubmit = async (event) => {
      event.preventDefault();
      const body = JSON.stringify({ email: document.getElementById('email').value, password: document.getElementById('password').value });
      const res = await fetch('/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body });
      if (res.ok) { user = await res.json(); go('/dashboard'); }
      else document.getElementById('login-error').textContent = 'Invalid credentials';
    };
    sdk('login');
  } else if (path === '/dashboard') {
    page('<h1>Dashboard</h1><a href="/courses" id="nav-courses">Courses</a>');
    bindLinks();
    sdk('dashboard');
  } else if (path === '/courses') {
    page('<h1>Courses</h1><a href="/courses/${COURSE_ID}">Algebra 101</a>');
    bindLinks();
    sdk('courses');
  } else if (path === '/courses/${COURSE_ID}') {
    const canCreate = user && user.role === 'TEACHER' && !FAULTS.hideCreateExam;
    const anchor = (id) => window.__anchors ? ' data-tellann-action="tellann:' + id + '"' : '';
    page('<h1>Course Details</h1><button>Students</button>'
      + (canCreate ? '<button id="create"' + anchor('t-create') + '>' + (FAULTS.renameLabels ? 'Add a new exam' : 'Create Exam') + '</button>' : '')
      + '<button disabled>Archive</button>');
    const create = document.getElementById('create');
    if (create) create.onclick = () => go('/courses/${COURSE_ID}/exams/new');
    sdk('course_details');
  } else if (path === '/courses/${COURSE_ID}/exams/new') {
    const saveAnchor = window.__anchors ? ' data-tellann-action="tellann:t-submit"' : '';
    const rich = window.__richForm ? (
      '<label for="kind">Exam type</label><select id="kind" name="kind"><option value="">Choose a type</option><option value="midterm">Midterm</option><option value="final">Final</option></select>'
      + '<label><input type="checkbox" id="publish" name="publish"/> Publish immediately</label>'
      + '<fieldset><legend>Visibility</legend><label><input type="radio" name="visibility" value="class"/> Class only</label><label><input type="radio" name="visibility" value="public"/> Public</label></fieldset>'
      + '<label for="due">Due date</label><input id="due" name="due" type="date"/>'
      + '<label for="syllabus">Syllabus</label><input id="syllabus" name="syllabus" type="file"/>'
    ) : '';
    page('<h1>New Exam</h1><label for="title">Title</label><input id="title" name="title"/>' + rich
      + '<button' + (FAULTS.renameLabels ? '' : ' data-testid="submit-exam"') + ' id="save"' + saveAnchor + '>' + (FAULTS.renameLabels ? 'Publish' : 'Save exam') + '</button><p id="save-error" role="alert"></p>');
    document.getElementById('save').onclick = async () => {
      if (FAULTS.saveDoesNothing) return;
      const title = document.getElementById('title').value;
      const payload = { title };
      if (window.__richForm) {
        const file = document.getElementById('syllabus').files[0];
        payload.kind = document.getElementById('kind').value;
        payload.publish = document.getElementById('publish').checked;
        payload.visibility = (document.querySelector('input[name=visibility]:checked') || {}).value || '';
        payload.due = document.getElementById('due').value;
        payload.syllabus = file ? { name: file.name, size: file.size, text: await file.text() } : null;
      }
      const res = await fetch('/api/exams', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
      if (!res.ok) { document.getElementById('save-error').textContent = 'Could not save the exam'; return; }
      const created = await res.json();
      go(FAULTS.saveLoopsBack ? '/courses/${COURSE_ID}' : '/courses/${COURSE_ID}/exams/' + created.id);
    };
    sdk('exam_form');
  } else if (/^\\/courses\\/${COURSE_ID}\\/exams\\/\\d+$/.test(path)) {
    page('<h1>Exam created</h1><p>Your exam is ready.</p>');
    sdk('exam_created');
  } else {
    page('<h1>Not found</h1>');
  }
}
function bindLinks() {
  for (const link of root.querySelectorAll('a[href^="/"]')) {
    link.onclick = (event) => { event.preventDefault(); go(link.getAttribute('href')); };
  }
}
boot();
`;

function shell(faults: LmsFaults, markers: LmsMarkerStyle, extras: { anchors: boolean; richForm: boolean }): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>LMS</title></head><body><div id="root"></div>`
    + `<script>window.__faults = ${JSON.stringify(faults)}; window.__markerStyle = ${JSON.stringify(markers)}; window.__anchors = ${extras.anchors}; window.__richForm = ${extras.richForm};</script><script>${CLIENT}</script></body></html>`;
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => resolve(body));
  });
}

function json(res: http.ServerResponse, status: number, value: unknown, headers: Record<string, string> = {}): void {
  res.writeHead(status, { 'content-type': 'application/json', ...headers });
  res.end(JSON.stringify(value));
}

export async function startLmsApp(options: LmsOptions = {}): Promise<LmsApp> {
  const sessions = new Map<string, { email: string; role: string }>();
  const requests: LmsRequest[] = [];
  const exams: LmsApp['exams'] = [];
  let nextExamId = 41;
  const app: LmsApp = { url: '', origin: '', requests, exams, faults: { ...options.faults }, close: async () => undefined };

  const sessionOf = (req: http.IncomingMessage) => {
    const match = /(?:^|;\s*)lms_session=([a-f0-9]+)/.exec(req.headers.cookie ?? '');
    return match ? sessions.get(match[1]!) ?? null : null;
  };

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://lms.local');
    const body = req.method === 'GET' ? '' : await readBody(req);
    requests.push({ method: req.method ?? 'GET', path: url.pathname, body, cookie: req.headers.cookie ?? null, at: Date.now() });

    if (url.pathname === '/api/session') {
      const user = sessionOf(req);
      return user ? json(res, 200, user) : json(res, 401, { error: 'UNAUTHENTICATED' });
    }
    if (url.pathname === '/api/login' && req.method === 'POST') {
      let parsed: { email?: string; password?: string } = {};
      try { parsed = JSON.parse(body); } catch { /* falls through to rejection */ }
      const match = Object.values(LMS_USERS).find((candidate) => candidate.email === parsed.email && candidate.password === parsed.password);
      if (!match || app.faults.loginRejects) return json(res, 401, { error: 'INVALID_CREDENTIALS' });
      const token = crypto.randomBytes(16).toString('hex');
      const user = { email: match.email, role: match.role };
      sessions.set(token, user);
      return json(res, 200, user, { 'set-cookie': `lms_session=${token}; HttpOnly; Path=/; SameSite=Lax` });
    }
    if (url.pathname === '/api/exams' && req.method === 'POST') {
      const user = sessionOf(req);
      if (!user) return json(res, 401, { error: 'UNAUTHENTICATED' });
      if (user.role !== 'TEACHER') return json(res, 403, { error: 'FORBIDDEN' });
      if (app.faults.saveFails) return json(res, 500, { error: 'INTERNAL' });
      let title = '';
      let fields: LmsRichFields = {};
      try {
        const parsed = JSON.parse(body);
        title = String(parsed.title ?? '').trim();
        if (options.richForm) {
          fields = { kind: String(parsed.kind ?? ''), publish: parsed.publish === true, visibility: String(parsed.visibility ?? ''), due: String(parsed.due ?? ''), syllabus: parsed.syllabus ?? null };
        }
      } catch { /* empty title */ }
      if (!title) return json(res, 422, { error: 'TITLE_REQUIRED' });
      // A rich form is refused unless it is complete, the way a real one would be: a run that skipped a control finds out here.
      if (options.richForm && (!fields.kind || !fields.visibility || !fields.due || !fields.syllabus)) return json(res, 422, { error: 'FORM_INCOMPLETE' });
      const exam = { id: nextExamId, title, by: user.email, fields };
      nextExamId += 1;
      exams.push(exam);
      return json(res, 201, { id: exam.id });
    }
    if (url.pathname.startsWith('/api/')) return json(res, 404, { error: 'NOT_FOUND' });
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(shell(app.faults, options.markers ?? 'typed', { anchors: options.anchors === true, richForm: options.richForm === true }));
  });

  await new Promise<void>((resolve) => server.listen(options.port ?? 0, '127.0.0.1', resolve));
  const port = (server.address() as AddressInfo).port;
  app.origin = `http://127.0.0.1:${port}`;
  app.url = `${app.origin}/login`;
  app.close = () => new Promise<void>((resolve) => { server.closeAllConnections(); server.close(() => resolve()); });
  return app;
}

// ---------------------------------------------------------------------------
// The Flow declared over it
// ---------------------------------------------------------------------------

/**
 * The published Flow, its mapping to code, and the code analysis it maps into, in the structural
 * shapes `compileExecutableContract` reads. The "code" is what a real analysis of this application
 * would contain: the routes, the controls and what they call. Nothing here is derived from the
 * application at run time; it is the declaration a person would have made and the analysis a scan
 * would have produced.
 */
export function lmsFlow(options: { richForm?: boolean } = {}) {
  const state = (id: string, name: string, role: 'INITIAL' | 'NORMAL' | 'TERMINAL', terminalKind: string | null = null) =>
    ({ id, stateName: name, behaviorKey: name, role, terminalKind });
  const route = (id: string, path: string, file: string) => ({
    id, type: 'ui_route', name: path, path: file, metadata: { route: path },
  });
  const action = (id: string, file: string, metadata: Record<string, unknown>) => ({
    id, type: 'ui_action', name: String(metadata.symbol ?? id), path: file, metadata,
  });

  return {
    flowVersionId: 'lms-flow-v1',
    flow: {
      states: [
        state('s-course', 'course_details', 'INITIAL'),
        state('s-form', 'exam_form', 'NORMAL'),
        state('s-created', 'exam_created', 'TERMINAL', 'SUCCESS'),
      ],
      transitions: [
        { id: 't-create', fromStateId: 's-course', toStateId: 's-form', action: 'Create Exam' },
        {
          id: 't-submit', fromStateId: 's-form', toStateId: 's-created', action: 'Save exam',
          expectedInput: [
            { name: 'title', label: 'Title', dataKey: 'examTitle' },
            ...(options.richForm ? [
              { name: 'kind', label: 'Exam type', dataKey: 'examKind' },
              { name: 'publish', label: 'Publish immediately', dataKey: 'publishNow' },
              { name: 'visibility', label: 'Visibility', dataKey: 'visibility' },
              { name: 'due', label: 'Due date', dataKey: 'dueDate' },
              { name: 'syllabus', label: 'Syllabus', dataKey: 'syllabus' },
            ] : []),
          ],
        },
      ],
    },
    checkpoints: [
      { id: 'state:s-course', mapping: { status: 'RESOLVED' as const, entityId: 'route-course', file: 'src/pages/CourseDetails.tsx', symbol: 'CourseDetails' } },
      { id: 'state:s-form', mapping: { status: 'RESOLVED' as const, entityId: 'route-form', file: 'src/pages/NewExam.tsx', symbol: 'NewExam' } },
      { id: 'state:s-created', mapping: { status: 'RESOLVED' as const, entityId: 'route-created', file: 'src/pages/ExamCreated.tsx', symbol: 'ExamCreated' } },
      { id: 'transition:t-create', mapping: { status: 'RESOLVED' as const, entityId: 'action-create', file: 'src/pages/CourseDetails.tsx', symbol: 'CreateExamButton' } },
      { id: 'transition:t-submit', mapping: { status: 'RESOLVED' as const, entityId: 'action-save', file: 'src/pages/NewExam.tsx', symbol: 'SaveExamButton' } },
    ],
    code: {
      entities: [
        route('route-course', `/courses/{param}`, 'src/pages/CourseDetails.tsx'),
        route('route-form', `/courses/{param}/exams/new`, 'src/pages/NewExam.tsx'),
        route('route-created', `/courses/{param}/exams/{param}`, 'src/pages/ExamCreated.tsx'),
        action('action-create', 'src/pages/CourseDetails.tsx', { symbol: 'CreateExamButton', labels: ['Create Exam'], element: 'button', event: 'onClick' }),
        action('action-save', 'src/pages/NewExam.tsx', { symbol: 'SaveExamButton', labels: ['Save exam'], testId: 'submit-exam', element: 'button', event: 'onClick' }),
        { id: 'endpoint-exams', type: 'endpoint', name: 'POST /api/exams', path: 'src/server/exams.ts', metadata: { method: 'POST', route: '/api/exams' } },
      ],
      relationships: [
        { source: 'action-save', target: 'endpoint-exams', type: 'CALLS', confidence: 1 },
      ],
    },
  };
}

/** Where the application starts the browser, and where the Flow begins: the difference is the pre-boundary walk. */
export const LMS_INITIAL_ROUTE = `/courses/${COURSE_ID}`;

/** A navigation edge in the shape the engine's planner reads (`NavigationEdge`), kept structural so this package has no dependencies. */
export interface LmsNavEdge {
  id: string;
  from: string;
  to: string;
  kind: 'LINK' | 'FORM_SUBMIT';
  actionClass: 'READ' | 'CLIENT_STATE_MUTATION';
  confidence: number;
  control: { labels: string[]; testId: string | null; domId: string | null; element: string | null; event: string | null; actionAnchor: string | null; href: string | null };
  guard: { requiresAuth: boolean; roles: string[]; confidence: number } | null;
  login?: Array<{ name: string; label: string | null; dataKey: string }>;
  evidence: { file: string; symbol: string | null; line: number | null };
}

/** The application's navigation graph, as a scan would report it: how a person gets from the login page to the Flow's first state. */
export function lmsNavigation(options: { courseRoles?: string[] } = {}): { nodes: string[]; edges: LmsNavEdge[] } {
  const control = (label: string, extra: Partial<LmsNavEdge['control']> = {}): LmsNavEdge['control'] => ({
    labels: [label], testId: null, domId: null, element: 'a', event: null, actionAnchor: null, href: null, ...extra,
  });
  const edge = (id: string, from: string, to: string, extra: Partial<LmsNavEdge> & Pick<LmsNavEdge, 'control'>): LmsNavEdge => ({
    id, from, to, kind: 'LINK', actionClass: 'READ', confidence: 1, guard: null,
    evidence: { file: 'src/App.tsx', symbol: id, line: null }, ...extra,
  });
  return {
    nodes: ['/login', '/dashboard', '/courses', `/courses/{param}`],
    edges: [
      edge('nav-login', '/login', '/dashboard', {
        kind: 'FORM_SUBMIT', actionClass: 'CLIENT_STATE_MUTATION',
        control: { labels: ['Sign in'], testId: null, domId: null, element: 'button', event: 'onSubmit', actionAnchor: null, href: null },
        login: [{ name: 'email', label: 'Email', dataKey: 'email' }, { name: 'password', label: 'Password', dataKey: 'password' }],
      }),
      edge('nav-courses', '/dashboard', '/courses', { control: control('Courses', { href: '/courses' }), guard: { requiresAuth: true, roles: [], confidence: 1 } }),
      edge('nav-course', '/courses', `/courses/{param}`, { control: control('Algebra 101', { href: `/courses/${COURSE_ID}` }), guard: { requiresAuth: true, roles: options.courseRoles ?? [], confidence: 1 } }),
    ],
  };
}
