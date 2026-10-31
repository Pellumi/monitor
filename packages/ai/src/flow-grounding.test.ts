import { describe, expect, it } from 'vitest';
import { normalizeWorkflowLanguage } from './flow-language';
import { groundInDocument } from './flow-grounding';

const DOCUMENT = [
  'This is the sample flow for an admin onboarding and creating a course on the system',
  'The admin opens the system and lands on the login page, they input their email and password to be authenticated.',
  'On successful authentication, they are carried to their dashboard.',
  'On their dashboard sidebar, they will see the Courses link, which they will click to be navigated to the Courses page.',
  'They will then click on the "Create A Course" button to create the course, a modal will appear.',
  'The admin will the input the course title and the course code and click "Create" to create the course.',
  'On successful course creation their Course Overview page will refresh to show the new course created.',
].join(' ');

/** What a live model actually returned for the document above once it was told to include what the document states. */
const modelAnswer = () => normalizeWorkflowLanguage({
  key: 'ADMIN_ONBOARDING', name: 'Admin onboarding and course creation',
  requires: { actor: 'ADMIN', environments: ['dev'], data: ['ADMIN_EMAIL', 'ADMIN_PASSWORD', 'SEED_TOKEN'] },
  states: [
    { name: 'GUEST' },
    { name: 'LOGIN_PAGE', recognizer: { routes: ['/login'] } },
    { name: 'DASHBOARD', recognizer: { routes: ['/dashboard'], headings: ['Dashboard'] } },
    { name: 'COURSES_PAGE', recognizer: { routes: ['/courses'] } },
    { name: 'CREATE_COURSE_MODAL' },
    { name: 'COURSE_OVERVIEW_PAGE', recognizer: { routes: ['/courses/{param}'] } },
  ],
  transitions: [
    { from: 'GUEST', to: 'LOGIN_PAGE', action: 'OPEN_APP', control: { role: 'link', label: 'Open App' } },
    { from: 'LOGIN_PAGE', to: 'DASHBOARD', action: 'SUBMIT_CREDENTIALS', control: { role: 'button', label: 'Login' }, inputs: [{ name: 'email', dataKey: 'ADMIN_EMAIL', role: 'PROTECTED' }, { name: 'password', dataKey: 'ADMIN_PASSWORD', role: 'PROTECTED' }, { name: 'otp', dataKey: 'ADMIN_OTP', role: 'PROTECTED' }] },
    { from: 'DASHBOARD', to: 'COURSES_PAGE', action: 'CLICK_COURSES_LINK', control: { role: 'link', label: 'Courses' } },
    { from: 'COURSES_PAGE', to: 'CREATE_COURSE_MODAL', action: 'CLICK_CREATE_COURSE', control: { role: 'button', label: 'Create A Course' } },
    { from: 'CREATE_COURSE_MODAL', to: 'COURSE_OVERVIEW_PAGE', action: 'SUBMIT_FORM', control: { role: 'button', label: 'Create' }, inputs: [{ name: 'course title', dataKey: 'COURSE_TITLE', role: 'GENERATED' }, { name: 'course code', dataKey: 'COURSE_CODE', role: 'GENERATED' }], effects: ['POST /api/courses -> 201'] },
  ],
});

describe('groundInDocument', () => {
  const { workflow, dropped } = groundInDocument(modelAnswer(), DOCUMENT);

  it('drops a route the document never writes, so it cannot override what the code says', () => {
    expect(workflow.states.every((state) => !state.recognizer)).toBe(true);
    expect(dropped.filter((issue) => /route/.test(issue.message)).map((issue) => issue.target).sort())
      .toEqual(['COURSES_PAGE', 'COURSE_OVERVIEW_PAGE', 'DASHBOARD', 'LOGIN_PAGE']);
    expect(dropped.find((issue) => /heading/.test(issue.message))?.target).toBe('DASHBOARD');
  });

  it('keeps a control the document names as a control, and drops one that is only a word in a sentence', () => {
    const labels = workflow.transitions.map((transition) => transition.control?.label);
    expect(labels).toEqual([undefined, undefined, 'Courses', 'Create A Course', 'Create']);
    expect(dropped.map((issue) => issue.message)).toEqual(expect.arrayContaining([
      expect.stringContaining('“Open App”'),
      expect.stringContaining('“Login”'),
    ]));
  });

  it('keeps the fields the document mentions and drops one it does not', () => {
    const inputs = workflow.transitions.flatMap((transition) => (transition.inputs ?? []).map((input) => input.name));
    expect(inputs).toEqual(['email', 'password', 'course title', 'course code']);
    expect(dropped.some((issue) => /“otp”/.test(issue.message))).toBe(true);
  });

  it('drops a request the document never writes', () => {
    expect(workflow.transitions.every((transition) => !transition.effects)).toBe(true);
    expect(dropped.some((issue) => /POST \/api\/courses/.test(issue.message))).toBe(true);
  });

  it('keeps the account the document names, drops an environment it never names, and keeps keys only for inputs that survived', () => {
    expect(workflow.requires).toEqual({ actor: 'ADMIN', environments: [], data: ['ADMIN_EMAIL', 'ADMIN_PASSWORD'] });
  });

  it('reports what it left out as warnings a reviewer can read', () => {
    expect(dropped.length).toBeGreaterThan(5);
    for (const issue of dropped) {
      expect(issue.code).toBe('UNSUPPORTED_DETAIL');
      expect(issue.severity).toBe('WARNING');
      expect(issue.message).toMatch(/was left out/);
    }
  });
});

describe('groundInDocument keeps what the document really says', () => {
  const text = 'The user lands on the login page at /login titled "Sign in". They click the Sign in button, which sends POST /api/session returning 200. In staging only.';
  const flow = normalizeWorkflowLanguage({
    key: 'W', name: 'W', requires: { environments: ['staging'] },
    states: [{ name: 'GUEST' }, { name: 'LOGIN_PAGE', recognizer: { route: '/Login/', heading: 'Sign in' } }, { name: 'HOME' }],
    transitions: [
      { from: 'GUEST', to: 'LOGIN_PAGE', action: 'OPEN_APP' },
      { from: 'LOGIN_PAGE', to: 'HOME', action: 'CLICK_SIGN_IN', control: { role: 'button', label: 'Sign in' }, effects: ['POST /api/session -> 200'] },
    ],
  });

  it('keeps a route, heading, control, request and environment that are written', () => {
    const { workflow, dropped } = groundInDocument(flow, text);
    expect(dropped).toEqual([]);
    expect(workflow.states[1].recognizer).toEqual({ routes: ['/login'], headings: ['Sign in'], texts: [] });
    expect(workflow.transitions[1].control).toEqual({ role: 'button', label: 'Sign in' });
    expect(workflow.transitions[1].effects).toEqual([{ method: 'POST', route: '/api/session', status: 200 }]);
    expect(workflow.requires?.environments).toEqual(['STAGING']);
  });

  it('with no text to check against, drops what would silently override the code and keeps the rest', () => {
    const { workflow, dropped } = groundInDocument(flow, null);
    expect(workflow.states[1].recognizer).toBeUndefined();
    expect(workflow.transitions[1].effects).toBeUndefined();
    expect(workflow.requires).toBeUndefined();
    expect(workflow.transitions[1].control).toEqual({ role: 'button', label: 'Sign in' });
    expect(dropped.length).toBeGreaterThan(0);
  });
});

describe('topology grounding: a state or transition cited but not found is dropped entirely', () => {
  const text = 'The user lands on the login page. They click Sign in, which takes them to the dashboard.';
  const flow = (extra: { stateEvidence?: string; transitionEvidence?: string }) => normalizeWorkflowLanguage({
    key: 'W', name: 'W',
    states: [
      { name: 'GUEST' },
      { name: 'LOGIN_PAGE' },
      { name: 'DASHBOARD', evidence: extra.stateEvidence },
    ],
    transitions: [
      { from: 'GUEST', to: 'LOGIN_PAGE', action: 'OPEN_APP' },
      { from: 'LOGIN_PAGE', to: 'DASHBOARD', action: 'CLICK_SIGN_IN', evidence: extra.transitionEvidence },
    ],
  });

  it('keeps a state and transition whose evidence is actually written', () => {
    const { workflow, dropped } = groundInDocument(flow({ stateEvidence: 'the dashboard', transitionEvidence: 'click Sign in' }), text);
    expect(workflow.states.map((state) => state.key)).toEqual(['GUEST', 'LOGIN_PAGE', 'DASHBOARD']);
    expect(workflow.transitions).toHaveLength(2);
    expect(dropped).toEqual([]);
  });

  it('drops a state whose cited evidence is not in the text, and the transitions left dangling by it', () => {
    const { workflow, dropped } = groundInDocument(flow({ stateEvidence: 'the billing portal', transitionEvidence: 'click Sign in' }), text);
    expect(workflow.states.map((state) => state.key)).toEqual(['GUEST', 'LOGIN_PAGE']);
    expect(workflow.transitions).toHaveLength(1);
    expect(dropped.some((issue) => issue.code === 'UNSUPPORTED_TOPOLOGY' && issue.target === 'DASHBOARD')).toBe(true);
    expect(dropped.some((issue) => issue.message.includes('endpoint was removed'))).toBe(true);
  });

  it('drops a transition whose cited evidence is not in the text, leaving both endpoint states', () => {
    const { workflow, dropped } = groundInDocument(flow({ stateEvidence: 'the dashboard', transitionEvidence: 'press the rocket button' }), text);
    expect(workflow.states.map((state) => state.key)).toEqual(['GUEST', 'LOGIN_PAGE', 'DASHBOARD']);
    expect(workflow.transitions).toHaveLength(1);
    expect(dropped.some((issue) => issue.code === 'UNSUPPORTED_TOPOLOGY' && issue.target === 'LOGIN_PAGE → DASHBOARD')).toBe(true);
  });

  it('is opt-in: a state or transition with no evidence is never dropped by this check', () => {
    const { workflow, dropped } = groundInDocument(flow({}), text);
    expect(workflow.states).toHaveLength(3);
    expect(workflow.transitions).toHaveLength(2);
    expect(dropped).toEqual([]);
  });

  it('with no text to check against, keeps everything regardless of evidence', () => {
    const { workflow, dropped } = groundInDocument(flow({ stateEvidence: 'the billing portal', transitionEvidence: 'press the rocket button' }), null);
    expect(workflow.states).toHaveLength(3);
    expect(workflow.transitions).toHaveLength(2);
    expect(dropped).toEqual([]);
  });
});

describe('what counts as a heading', () => {
  const flow = (heading: string) => normalizeWorkflowLanguage({
    key: 'W', name: 'W',
    states: [{ name: 'GUEST' }, { name: 'PAGE', recognizer: { headings: [heading] } }],
    transitions: [{ from: 'GUEST', to: 'PAGE', action: 'OPEN_APP' }],
  });

  it('accepts a heading the document introduces as a title, quoted or not', () => {
    expect(groundInDocument(flow('Sign in'), 'The page is titled Sign in and asks for a password.').workflow.states[1].recognizer?.headings).toEqual(['Sign in']);
    expect(groundInDocument(flow('Sign in'), 'The heading says "Sign in".').workflow.states[1].recognizer?.headings).toEqual(['Sign in']);
    expect(groundInDocument(flow('My courses'), 'They see a page called My courses.').workflow.states[1].recognizer?.headings).toEqual(['My courses']);
  });

  it('refuses a heading that is only a word the document happens to use', () => {
    const { workflow, dropped } = groundInDocument(flow('Dashboard'), 'They are carried to their dashboard.');
    expect(workflow.states[1].recognizer).toBeUndefined();
    expect(dropped[0]!.message).toMatch(/never gives the page that heading/);
  });
});
