import { describe, expect, it } from 'vitest';
import {
  assignFlowRoles,
  compactActionName,
  compactStateName,
  lintWorkflowLanguage,
  normalizeWorkflowLanguage,
} from './flow-language';
import { deriveJourneyFromProse } from './flow-prose';

// The document that produced a wall of sentence-length steps.
const SAMPLE_DOCUMENT = [
  'This is the sample flow for an admin onboarding and creating a course on the system',
  'The admin opens the system and lands on the login page, they input their email and password to be authenticated.',
  'On successful authentication, they are carried to their dashboard.',
  'On their dashboard sidebar, they will see the Courses link, which they will click to be navigated to the Courses page.',
  'They will then click on the "Create A Course" button to create the course, a modal will appear.',
  'The admin will the input the course title and the course code and click "Create" to create the course.',
  'On successful course creation their Course Overview page will refresh to show the new course created.',
].join(' ');

describe('compactStateName', () => {
  it('leaves an already-short key alone', () => {
    expect(compactStateName('LOGIN_PAGE')).toBe('LOGIN_PAGE');
    expect(compactStateName('Course Overview Page')).toBe('COURSE_OVERVIEW_PAGE');
    expect(compactStateName('guest')).toBe('GUEST');
  });

  it('reduces a sentence to the place it names', () => {
    expect(compactStateName('The admin opens the system and lands on the login page')).toBe('LOGIN_PAGE');
    expect(compactStateName('On successful authentication, they are carried to their dashboard')).toBe('DASHBOARD');
    expect(compactStateName('their Course Overview page will refresh to show the new course')).toBe('COURSE_OVERVIEW_PAGE');
  });

  it('never returns a name longer than a short key', () => {
    const name = compactStateName('They will then click on the create a course button to create the course and see something happen');
    expect(name.length).toBeLessThanOrEqual(32);
    expect(name.split('_').length).toBeLessThanOrEqual(4);
  });
});

describe('compactActionName', () => {
  it('keeps verb-phrase keys and replaces generic filler with a destination', () => {
    expect(compactActionName('CLICK_COURSES_LINK')).toBe('CLICK_COURSES_LINK');
    expect(compactActionName('NEXT', 'DASHBOARD')).toBe('GO_TO_DASHBOARD');
    expect(compactActionName('', 'COURSES_PAGE')).toBe('GO_TO_COURSES_PAGE');
    expect(compactActionName('click the Courses link')).toBe('CLICK_COURSES_LINK');
  });
});

describe('deriveJourneyFromProse', () => {
  const journey = deriveJourneyFromProse([{ id: 'e1', text: SAMPLE_DOCUMENT }])!;

  it('finds the places the user arrives at, in order, and no sentences', () => {
    expect(journey.states.map((state) => state.key)).toEqual([
      'GUEST', 'LOGIN_PAGE', 'DASHBOARD', 'COURSES_PAGE', 'CREATE_COURSE_MODAL', 'COURSE_OVERVIEW_PAGE',
    ]);
    for (const state of journey.states) expect(state.key!.length).toBeLessThanOrEqual(32);
  });

  it('names what the user does between them', () => {
    expect(journey.transitions.map((t) => `${t.from} -${t.action}-> ${t.to}`)).toEqual([
      'GUEST -OPEN_APP-> LOGIN_PAGE',
      'LOGIN_PAGE -SUBMIT_CREDENTIALS-> DASHBOARD',
      'DASHBOARD -CLICK_COURSES_LINK-> COURSES_PAGE',
      'COURSES_PAGE -CLICK_CREATE_COURSE-> CREATE_COURSE_MODAL',
      'CREATE_COURSE_MODAL -SUBMIT_FORM-> COURSE_OVERVIEW_PAGE',
    ]);
  });

  it('records when a step only applies on success', () => {
    const conditions = journey.transitions.map((transition) => transition.condition);
    expect(conditions).toEqual([undefined, 'ON_SUCCESS', undefined, undefined, 'ON_SUCCESS']);
  });

  const render = (text: string) => {
    const found = deriveJourneyFromProse([{ id: 'e', text }])!;
    const flow = normalizeWorkflowLanguage({ key: 'W', name: 'W', states: found.states, transitions: found.transitions });
    return flow.transitions.map((t) => `${t.from} -${t.action}${t.condition ? `(${t.condition})` : ''}-> ${t.to}`);
  };

  it('models a failure shown on a screen as a branch that returns to it', () => {
    expect(render('A customer opens the store and lands on the product list page. They click the Checkout button and are taken to the payment page. They enter their card details and click "Pay now". If the payment is declined, an error message is shown on the payment page. On successful payment they see the order confirmation page.')).toEqual([
      'START -OPEN_APP-> PRODUCT_LIST_PAGE',
      'PRODUCT_LIST_PAGE -CLICK_CHECKOUT-> PAYMENT_PAGE',
      'PAYMENT_PAGE -SUBMIT_FORM(ON_FAILURE)-> PAYMENT_ERROR',
      'PAYMENT_ERROR -RETRY-> PAYMENT_PAGE',
      'PAYMENT_PAGE -SUBMIT_FORM(ON_SUCCESS)-> ORDER_CONFIRMATION_PAGE',
    ]);
  });

  it('reads a numbered list without the numbers', () => {
    expect(render('1. User goes to the registration page\n2. User fills in name, email and password and clicks the Sign up button\n3. A verification screen is displayed')).toEqual([
      'START -GO_TO_REGISTRATION_PAGE-> REGISTRATION_PAGE',
      'REGISTRATION_PAGE -SUBMIT_CREDENTIALS-> VERIFICATION_SCREEN',
    ]);
  });

  it('gives up honestly on text with no journey in it', () => {
    expect(deriveJourneyFromProse([{ id: 'e', text: 'Our platform is fast, secure and loved by teams everywhere.' }])).toBeNull();
  });
});

describe('normalizeWorkflowLanguage', () => {
  it('turns sentence states into compact ones and re-points transitions', () => {
    const workflow = normalizeWorkflowLanguage({
      key: 'COURSE', name: 'Course creation',
      states: [
        { key: 'S1', name: 'The admin opens the system and lands on the login page' },
        { key: 'S2', name: 'On successful authentication, they are carried to their dashboard' },
      ],
      transitions: [{ from: 'S1', to: 'S2', action: 'NEXT' }, { from: 'S1', to: 'MISSING', action: 'X' }],
    });
    expect(workflow.states.map((state) => state.name)).toEqual(['LOGIN_PAGE', 'DASHBOARD']);
    expect(workflow.states[0].description).toContain('lands on the login page');
    expect(workflow.transitions).toEqual([{ from: 'LOGIN_PAGE', to: 'DASHBOARD', action: 'GO_TO_DASHBOARD' }]);
    expect(workflow.states.map((state) => state.role)).toEqual(['INITIAL', 'TERMINAL']);
    expect(workflow.states[1].terminalKind).toBe('SUCCESS');
  });

  it('keeps two different states that compact to the same name apart', () => {
    const workflow = normalizeWorkflowLanguage({
      key: 'W', name: 'W',
      states: [{ name: 'Login page' }, { name: 'They land on the login page again' }],
      transitions: [{ from: 'Login page', to: 'They land on the login page again', action: 'RETRY_LOGIN' }],
    });
    expect(new Set(workflow.states.map((state) => state.name)).size).toBe(2);
  });

  it('produces a flow that lints clean', () => {
    const journey = deriveJourneyFromProse([{ id: 'e1', text: SAMPLE_DOCUMENT }])!;
    const workflow = normalizeWorkflowLanguage({ key: 'C', name: 'C', states: journey.states, transitions: journey.transitions });
    expect(lintWorkflowLanguage(workflow)).toEqual([]);
  });
});

describe('assignFlowRoles', () => {
  it('demotes extra initial states and marks failures as failure endings', () => {
    const states = assignFlowRoles(
      [
        { key: 'A', name: 'A', role: 'INITIAL' },
        { key: 'B', name: 'B', role: 'INITIAL' },
        { key: 'LOGIN_FAILED', name: 'LOGIN_FAILED', category: 'ERROR' },
      ],
      [{ from: 'A', to: 'B' }, { from: 'B', to: 'LOGIN_FAILED' }],
    );
    expect(states.map((state) => state.role)).toEqual(['INITIAL', 'NORMAL', 'TERMINAL']);
    expect(states[2].terminalKind).toBe('FAILURE');
  });
});

describe('lintWorkflowLanguage', () => {
  it('flags sentence names, generic actions and unreachable states', () => {
    const codes = lintWorkflowLanguage({
      key: 'W', name: 'W',
      states: [
        { key: 'START', name: 'START', role: 'INITIAL' },
        { key: 'THE_ADMIN_LANDS_ON_THE_LOGIN_PAGE_AND_TYPES', name: 'x', role: 'TERMINAL' },
        { key: 'ORPHAN', name: 'ORPHAN', role: 'NORMAL' },
      ],
      transitions: [{ from: 'START', to: 'THE_ADMIN_LANDS_ON_THE_LOGIN_PAGE_AND_TYPES', action: 'NEXT' }],
    }).map((issue) => issue.code);
    expect(codes).toEqual(expect.arrayContaining(['STATE_NAME_NOT_COMPACT', 'ACTION_GENERIC', 'UNREACHABLE_STATE', 'DEAD_END_STATE']));
  });
});
