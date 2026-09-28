import assert from 'node:assert/strict';
import test from 'node:test';
import { assignFlowRoles } from '@tellann/ai';
import { mergeAcceptedWorkflows } from './accepted-workflows';

const keep = (ids: unknown, fallback: string[]) => (Array.isArray(ids) ? (ids as string[]) : fallback);

function accept(workflows: any[]) {
  const merged = mergeAcceptedWorkflows(workflows, keep, ['e0']);
  const states = assignFlowRoles(merged.states, merged.transitions);
  return { states, transitions: merged.transitions };
}

test('an old sentence-named draft is accepted as short states and actions with roles', () => {
  const { states, transitions } = accept([{
    key: 'SAMPLE_COURSE_CREATION_FLOW', name: 'Sample course creation flow',
    states: [
      { key: 'SAMPLE_1', name: 'The admin opens the system and lands on the login page, they input their email and password' },
      { key: 'SAMPLE_2', name: 'On successful authentication, they are carried to their dashboard' },
      { key: 'SAMPLE_3', name: 'On their dashboard sidebar, they will see the Courses link, which they will click to be navigated to the Courses page' },
    ],
    transitions: [{ from: 'SAMPLE_1', to: 'SAMPLE_2', action: 'NEXT' }, { from: 'SAMPLE_2', to: 'SAMPLE_3', action: 'NEXT' }],
  }]);
  assert.deepEqual(states.map((state) => state.key), ['LOGIN_PAGE', 'DASHBOARD', 'COURSES_PAGE']);
  assert.deepEqual(states.map((state) => state.role), ['INITIAL', 'NORMAL', 'TERMINAL']);
  assert.deepEqual(transitions.map((transition) => transition.action), ['GO_TO_DASHBOARD', 'GO_TO_COURSES_PAGE']);
  assert.ok(states.every((state) => state.key.length <= 32), 'no state name carries the workflow key');
});

test('two journeys that meet at a shared state join into one flow with one start', () => {
  const { states, transitions } = accept([
    {
      key: 'SIGN_IN', name: 'Sign in',
      states: [
        { name: 'GUEST', role: 'INITIAL' }, { name: 'LOGIN_PAGE' }, { name: 'DASHBOARD', role: 'TERMINAL', terminalKind: 'SUCCESS' },
      ],
      transitions: [{ from: 'GUEST', to: 'LOGIN_PAGE', action: 'OPEN_APP' }, { from: 'LOGIN_PAGE', to: 'DASHBOARD', action: 'SUBMIT_CREDENTIALS' }],
    },
    {
      key: 'CREATE_COURSE', name: 'Create a course',
      states: [
        { name: 'DASHBOARD', role: 'INITIAL' }, { name: 'COURSES_PAGE' }, { name: 'COURSE_CREATED', role: 'TERMINAL', terminalKind: 'SUCCESS' },
      ],
      transitions: [{ from: 'DASHBOARD', to: 'COURSES_PAGE', action: 'CLICK_COURSES_LINK' }, { from: 'COURSES_PAGE', to: 'COURSE_CREATED', action: 'SUBMIT_FORM' }],
    },
  ]);
  assert.deepEqual(states.map((state) => `${state.key}:${state.role}`), [
    'GUEST:INITIAL', 'LOGIN_PAGE:NORMAL', 'DASHBOARD:NORMAL', 'COURSES_PAGE:NORMAL', 'COURSE_CREATED:TERMINAL',
  ]);
  assert.equal(states.find((state) => state.key === 'COURSE_CREATED')?.terminalKind, 'SUCCESS');
  assert.equal(transitions.length, 4);
});

test('a state one journey ends in stays an ending when nothing continues from it', () => {
  const { states } = accept([{
    key: 'LOGIN', name: 'Login',
    states: [{ name: 'GUEST', role: 'INITIAL' }, { name: 'LOGIN_ERROR', category: 'ERROR', role: 'TERMINAL', terminalKind: 'FAILURE' }, { name: 'DASHBOARD', role: 'TERMINAL' }],
    transitions: [{ from: 'GUEST', to: 'LOGIN_ERROR', action: 'SUBMIT_CREDENTIALS', condition: 'ON_FAILURE' }, { from: 'GUEST', to: 'DASHBOARD', action: 'SUBMIT_CREDENTIALS', condition: 'ON_SUCCESS' }],
  }]);
  assert.equal(states.find((state) => state.key === 'LOGIN_ERROR')?.terminalKind, 'FAILURE');
  assert.equal(states.find((state) => state.key === 'DASHBOARD')?.terminalKind, 'SUCCESS');
});

test('evidence from both journeys is kept on a shared state', () => {
  const merged = mergeAcceptedWorkflows([
    { key: 'A', name: 'A', evidenceIds: ['e1'], states: [{ name: 'GUEST' }, { name: 'DASHBOARD', evidenceIds: ['e1'] }], transitions: [{ from: 'GUEST', to: 'DASHBOARD', action: 'OPEN_APP' }] },
    { key: 'B', name: 'B', evidenceIds: ['e2'], states: [{ name: 'DASHBOARD', evidenceIds: ['e2'] }, { name: 'COURSES_PAGE' }], transitions: [{ from: 'DASHBOARD', to: 'COURSES_PAGE', action: 'CLICK_COURSES_LINK' }] },
  ], keep, ['e0']);
  assert.deepEqual(merged.states.find((state) => state.key === 'DASHBOARD')?.evidenceIds.sort(), ['e1', 'e2']);
});

test('the specification travels with the accepted flow, and requirements are merged', () => {
  const merged = mergeAcceptedWorkflows([
    {
      key: 'SIGN_IN', name: 'Sign in', requires: { actor: 'admin', environments: ['dev', 'stage'] },
      states: [{ name: 'GUEST' }, { name: 'LOGIN_PAGE', recognizer: { route: '/login' } }, { name: 'DASHBOARD' }],
      transitions: [
        { from: 'GUEST', to: 'LOGIN_PAGE', action: 'OPEN_APP' },
        { from: 'LOGIN_PAGE', to: 'DASHBOARD', action: 'SUBMIT_CREDENTIALS', control: { role: 'button', label: 'Sign in' }, inputs: [{ name: 'password', dataKey: 'ADMIN_PASSWORD' }] },
      ],
    },
    {
      key: 'CREATE_COURSE', name: 'Create a course', requires: { environments: ['dev'] },
      states: [{ name: 'DASHBOARD', recognizer: { heading: 'Dashboard' } }, { name: 'COURSES_PAGE' }],
      transitions: [{ from: 'DASHBOARD', to: 'COURSES_PAGE', action: 'CLICK_DELETE_COURSES' }],
    },
  ], keep, ['e0']);
  const login = merged.states.find((state) => state.key === 'LOGIN_PAGE')!;
  assert.deepEqual(login.recognizer, { routes: ['/login'], headings: [], texts: [] });
  const dashboard = merged.states.find((state) => state.key === 'DASHBOARD')!;
  assert.deepEqual(dashboard.recognizer, { routes: [], headings: ['Dashboard'], texts: [] }, 'a recognizer declared by the later journey is kept when the first had none');
  assert.deepEqual(merged.transitions[1].control, { role: 'button', label: 'Sign in' });
  assert.equal((merged.transitions[1].inputs as any[])[0].role, 'PROTECTED');
  assert.equal(merged.transitions[2].mode, 'CONFIRM', 'a delete nobody marked is asked about');
  // The flow can only run where every journey in it can, and asks for everything any of them needs.
  assert.deepEqual(merged.requires, { actor: 'ADMIN', environments: ['DEVELOPMENT'], data: ['ADMIN_PASSWORD'] });
});
