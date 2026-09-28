import { describe, expect, it } from 'vitest';
import { normalizeWorkflowLanguage } from './flow-language';
import { deriveJourneyFromProse } from './flow-prose';
import {
  canonicalRoutePattern, inferStepMode, sanitizeControl, sanitizeEffects, sanitizeInputs, sanitizeMode, sanitizeRecognizer, sanitizeRequires, sanitizeSubFlow,
} from './flow-spec';

describe('canonicalRoutePattern', () => {
  it('writes every dynamic segment the way the run compares routes', () => {
    expect(canonicalRoutePattern('/Courses/:id/Exams/[examId]?tab=1#top')).toBe('/courses/{param}/exams/{param}');
    expect(canonicalRoutePattern('https://app.example.com/login/')).toBe('/login');
    expect(canonicalRoutePattern('/items/<int:pk>/edit')).toBe('/items/{param}/edit');
    expect(canonicalRoutePattern('/')).toBe('/');
  });
  it('refuses what is not a path', () => {
    for (const value of ['login', '', 'two words', 42, null]) expect(canonicalRoutePattern(value)).toBeUndefined();
  });
});

describe('sanitizeRecognizer', () => {
  it('keeps canonical routes and short headings, and drops the rest', () => {
    expect(sanitizeRecognizer({ routes: ['/login', 'nonsense', '/login/'], headings: [' Sign  in ', ''], texts: ['Welcome back'] }))
      .toEqual({ routes: ['/login'], headings: ['Sign in'], texts: ['Welcome back'] });
    expect(sanitizeRecognizer({ routes: [] })).toBeUndefined();
    expect(sanitizeRecognizer('x')).toBeUndefined();
  });
});

describe('sanitizeControl', () => {
  it('reads a role from the words people use for it', () => {
    expect(sanitizeControl({ role: 'Anchor', label: 'Courses' })).toEqual({ role: 'link', label: 'Courses' });
    expect(sanitizeControl({ role: 'weird', label: 'Save', testId: 'save-btn' })).toEqual({ label: 'Save', testId: 'save-btn' });
    expect(sanitizeControl({ role: 'button' })).toBeUndefined();
  });
});

describe('sanitizeInputs', () => {
  it('never lets a credential be an ordinary value', () => {
    const [password, email, title] = sanitizeInputs([
      { name: 'Password', dataKey: 'ADMIN_PASSWORD', role: 'PROVIDED' },
      { name: 'email', dataKey: 'ADMIN_EMAIL', role: 'PROTECTED' },
      { name: 'Course title', role: 'GENERATED' },
    ]);
    expect(password.role).toBe('PROTECTED');
    expect(email.role).toBe('PROTECTED');
    expect(title).toEqual({ name: 'Course title', dataKey: 'COURSE_TITLE', role: 'GENERATED' });
  });
  it('derives a data key from the field name and drops duplicates and unsafe keys', () => {
    const inputs = sanitizeInputs(['Due date', { name: 'due date' }, { name: 'x', dataKey: '../etc' }]);
    expect(inputs.map((input) => input.dataKey)).toEqual(['DUE_DATE', 'X']);
  });
});

describe('sanitizeEffects', () => {
  it('reads objects and the short written form, and rejects anything that is not a request', () => {
    expect(sanitizeEffects(['POST /courses -> 201', { method: 'delete', route: '/api/courses/:id', status: '204' }, 'GO /nowhere', { method: 'POST', route: 'courses' }]))
      .toEqual([{ method: 'POST', route: '/courses', status: 201 }, { method: 'DELETE', route: '/api/courses/{param}', status: 204 }]);
  });
  it('ignores a status that is not a status', () => {
    expect(sanitizeEffects([{ method: 'GET', route: '/x', status: 99 }])).toEqual([{ method: 'GET', route: '/x' }]);
  });
});

describe('step mode', () => {
  it('only accepts the three modes', () => {
    expect(sanitizeMode('confirm')).toBe('CONFIRM');
    expect(sanitizeMode('automatic')).toBeUndefined();
  });
  it('asks a person for what automation must not do alone or cannot undo', () => {
    expect(inferStepMode({ action: 'ENTER_OTP_CODE' })).toBe('MANUAL');
    expect(inferStepMode({ action: 'CONTINUE_WITH_SSO' })).toBe('MANUAL');
    expect(inferStepMode({ action: 'CLICK_DELETE_COURSE' })).toBe('CONFIRM');
    expect(inferStepMode({ action: 'CONFIRM_PAYMENT' })).toBe('CONFIRM');
    expect(inferStepMode({ action: 'SUBMIT_FORM', effects: [{ method: 'DELETE', route: '/x' }] })).toBe('CONFIRM');
    expect(inferStepMode({ action: 'CLICK_COURSES_LINK' })).toBe('AUTO');
    expect(inferStepMode({ action: 'CLICK_CREATE_COURSE' })).toBe('AUTO');
  });
});

describe('sanitizeRequires', () => {
  it('understands environment names people use and adds what the inputs need', () => {
    const requires = sanitizeRequires(
      { actor: 'Admin', environments: ['dev', 'stage', 'nowhere'], data: ['ADMIN_EMAIL'] },
      [{ name: 'password', dataKey: 'ADMIN_PASSWORD', role: 'PROTECTED' }, { name: 'title', dataKey: 'TITLE', role: 'GENERATED' }],
    );
    expect(requires).toEqual({ actor: 'ADMIN', environments: ['DEVELOPMENT', 'STAGING'], data: ['ADMIN_EMAIL', 'ADMIN_PASSWORD'] });
    expect(sanitizeRequires({})).toBeUndefined();
  });
});

describe('sanitizeSubFlow', () => {
  it('takes a flow id or a name, and nothing else', () => {
    expect(sanitizeSubFlow('SIGN_IN')).toEqual({ name: 'SIGN_IN' });
    expect(sanitizeSubFlow({ flowId: '0b5d8a3e-7f06-4e6e-9a54-3c4a6a1f0c11' })).toEqual({ flowId: '0b5d8a3e-7f06-4e6e-9a54-3c4a6a1f0c11' });
    expect(sanitizeSubFlow({ flowId: 'not-an-id' })).toBeUndefined();
  });
});

describe('the specification through the flow language', () => {
  it('normalises every field on a workflow and leaves AUTO implicit', () => {
    const flow = normalizeWorkflowLanguage({
      key: 'W', name: 'W',
      requires: { actor: 'admin', environments: ['dev'] },
      states: [
        { name: 'GUEST' },
        { name: 'LOGIN_PAGE', recognizer: { route: '/login', heading: 'Sign in' } },
        { name: 'SIGN_IN_DONE', subFlow: 'SIGN_IN' },
      ],
      transitions: [
        { from: 'GUEST', to: 'LOGIN_PAGE', action: 'OPEN_APP' },
        { from: 'LOGIN_PAGE', to: 'SIGN_IN_DONE', action: 'SUBMIT_CREDENTIALS', control: { role: 'button', label: 'Sign in' }, inputs: [{ name: 'password' }], effects: ['POST /api/session -> 200'] },
      ],
    });
    expect(flow.requires).toEqual({ actor: 'ADMIN', environments: ['DEVELOPMENT'], data: ['PASSWORD'] });
    expect(flow.states[1].recognizer).toEqual({ routes: ['/login'], headings: ['Sign in'], texts: [] });
    expect(flow.states[2].subFlow).toEqual({ name: 'SIGN_IN' });
    expect(flow.transitions[0].mode).toBeUndefined();
    expect(flow.transitions[1]).toMatchObject({
      control: { role: 'button', label: 'Sign in' },
      inputs: [{ name: 'password', dataKey: 'PASSWORD', role: 'PROTECTED' }],
      effects: [{ method: 'POST', route: '/api/session', status: 200 }],
    });
  });

  it('keeps a mode the person chose and infers one only when none was chosen', () => {
    const flow = normalizeWorkflowLanguage({
      key: 'W', name: 'W',
      states: [{ name: 'A' }, { name: 'B' }, { name: 'C' }],
      transitions: [
        { from: 'A', to: 'B', action: 'CLICK_DELETE_ACCOUNT', mode: 'AUTO' },
        { from: 'B', to: 'C', action: 'CLICK_DELETE_ACCOUNT' },
      ],
    });
    // Declared AUTO is kept as AUTO (absent), and an unmarked delete is inferred CONFIRM.
    expect(flow.transitions.map((transition) => transition.mode)).toEqual([undefined, 'CONFIRM']);
  });
});

describe('the no-AI extractor fills the specification only from the text', () => {
  const journey = deriveJourneyFromProse([{
    id: 'e',
    text: 'The admin opens the app and lands on the login page at /login. They input their email and password to sign in. On success they are carried to the dashboard. They click the Courses link and are taken to the Courses page. They click the "Create A Course" button and a modal appears. They input the course title and the course code and click "Create" which sends POST /api/courses returning 201, then the Course Overview page is shown.',
  }])!;

  it('reads the control a person operates, with the text exactly as written', () => {
    const controls = journey.transitions.map((transition) => transition.control);
    expect(controls).toContainEqual({ role: 'link', label: 'Courses' });
    expect(controls).toContainEqual({ role: 'button', label: 'Create A Course' });
  });

  it('marks credentials protected and free text generated', () => {
    const byRole = journey.transitions.flatMap((transition) => transition.inputs ?? []).map((input) => `${input.name}:${input.role}`);
    expect(byRole).toEqual(['email:PROTECTED', 'password:PROTECTED', 'course title:GENERATED', 'course code:GENERATED']);
  });

  it('reads a route and an endpoint only because the text wrote them', () => {
    expect(journey.states.find((state) => state.key === 'LOGIN_PAGE')?.recognizer).toEqual({ routes: ['/login'], headings: [], texts: [] });
    expect(journey.states.find((state) => state.key === 'DASHBOARD')?.recognizer).toBeUndefined();
    const effects = journey.transitions.flatMap((transition) => transition.effects ?? []);
    expect(effects).toEqual([{ method: 'POST', route: '/api/courses', status: 201 }]);
  });

  it('says who the journey signs in as', () => {
    expect(journey.requires?.actor).toBe('ADMIN');
  });
});
