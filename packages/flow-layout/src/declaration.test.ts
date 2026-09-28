import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isSecretDataKey, parseDotenv, runDataHasValues, runDataKeys,
  requiresForm, requiresSpec, sameRequires, sameStateDeclaration, sameTransitionDeclaration, stateDeclarationForm, stateDeclarationSpec,
  suggestDataKey, transitionDeclarationForm, transitionDeclarationSpec, transitionDeclarationSummary,
} from './declaration.js';

test('a state form reads what is stored and saves what was typed', () => {
  const form = stateDeclarationForm({ recognizer: { routes: ['/courses/{param}'], headings: ['My courses'], texts: [] }, subFlowId: null, description: 'The list', actor: 'ADMIN' });
  assert.deepEqual(form, { routes: '/courses/{param}', headings: 'My courses', texts: '', subFlowId: '', description: 'The list', actor: 'ADMIN' });
  const spec = stateDeclarationSpec({ ...form, routes: '/courses/:id\n/courses/:id\n /learn ,/x' });
  assert.deepEqual(spec.recognizer, { routes: ['/courses/:id', '/learn', '/x'], headings: ['My courses'], texts: [] }, 'one per line or comma, no repeats');
});

test('emptying a state form clears the declaration rather than saving an empty one', () => {
  const spec = stateDeclarationSpec(stateDeclarationForm({}));
  assert.deepEqual(spec, { recognizer: null, subFlowId: null, description: null, actor: null });
});

test('a state form knows whether anything changed, whatever the whitespace', () => {
  const stored = stateDeclarationForm({ recognizer: { routes: ['/a'], headings: [], texts: [] } });
  assert.equal(sameStateDeclaration(stored, { ...stored, routes: ' /a \n' }), true);
  assert.equal(sameStateDeclaration(stored, { ...stored, routes: '/b' }), false);
});

test('a transition form reads control, inputs, effects and mode as stored', () => {
  const form = transitionDeclarationForm({
    control: { role: 'button', label: 'Create', testId: 'create' },
    expectedInput: [{ name: 'email', dataKey: 'ADMIN_EMAIL', role: 'PROTECTED' }, 'legacy', { nope: true }],
    expectedOutput: [{ method: 'post', route: '/api/courses', status: 201 }],
    mode: 'CONFIRM',
  });
  assert.deepEqual(form, {
    controlRole: 'button', controlLabel: 'Create', controlTestId: 'create',
    inputs: [{ name: 'email', dataKey: 'ADMIN_EMAIL', role: 'PROTECTED' }, { name: 'legacy', dataKey: 'legacy', role: 'PROVIDED' }],
    effects: [{ method: 'POST', route: '/api/courses', status: '201' }],
    mode: 'CONFIRM',
  });
});

test('a transition form saves only complete rows, and a control only when it names something', () => {
  const spec = transitionDeclarationSpec({
    controlRole: '', controlLabel: '', controlTestId: '',
    inputs: [{ name: 'title', dataKey: '', role: 'GENERATED' }, { name: '  ', dataKey: 'X', role: 'PROVIDED' }],
    effects: [{ method: 'POST', route: '/api/courses', status: '201' }, { method: 'GET', route: ' ', status: '' }],
    mode: 'AUTO',
  });
  assert.deepEqual(spec, { control: null, inputs: [{ name: 'title', role: 'GENERATED' }], effects: [{ method: 'POST', route: '/api/courses', status: 201 }], mode: 'AUTO' });
});

test('a control can be named by its label, its test id, or both, with or without a kind', () => {
  const base = { controlRole: '', controlLabel: '', controlTestId: '', inputs: [], effects: [], mode: 'AUTO' as const };
  assert.deepEqual(transitionDeclarationSpec({ ...base, controlLabel: 'Courses', controlRole: 'link' }).control, { role: 'link', label: 'Courses' });
  assert.deepEqual(transitionDeclarationSpec({ ...base, controlTestId: 'go' }).control, { testId: 'go' });
});

test('an unedited transition form is unchanged', () => {
  const stored = transitionDeclarationForm({ control: { label: 'Go' }, mode: 'MANUAL' });
  assert.equal(sameTransitionDeclaration(stored, { ...stored }), true);
  assert.equal(sameTransitionDeclaration(stored, { ...stored, mode: 'AUTO' }), false);
});

test('a data key is suggested from the field, and a credential is prefixed with who signs in', () => {
  assert.equal(suggestDataKey('course title'), 'COURSE_TITLE');
  assert.equal(suggestDataKey('dueDate'), 'DUE_DATE');
  assert.equal(suggestDataKey('email', 'admin'), 'ADMIN_EMAIL');
  assert.equal(suggestDataKey('ADMIN_password', 'admin'), 'ADMIN_PASSWORD', 'not prefixed twice');
  assert.equal(suggestDataKey('title', 'admin'), 'TITLE', 'only credentials are prefixed');
  assert.equal(suggestDataKey('  '), '');
});

test('a step is summarised in a few plain facts', () => {
  assert.deepEqual(transitionDeclarationSummary({}), []);
  assert.deepEqual(transitionDeclarationSummary({
    control: { role: 'button', label: 'Create' },
    expectedInput: [{ name: 'a' }, { name: 'password', role: 'PROTECTED' }],
    expectedOutput: [{ method: 'POST', route: '/api/courses', status: 201 }],
    mode: 'MANUAL',
  }), ['button "Create"', '2 inputs (secret)', 'POST /api/courses → 201', 'you do this']);
});

test('what a flow requires round-trips, and emptying it clears it', () => {
  const form = requiresForm({ actor: 'ADMIN', environments: ['DEVELOPMENT'], data: ['ADMIN_EMAIL', 'SEED'] });
  assert.deepEqual(form, { actor: 'ADMIN', environments: ['DEVELOPMENT'], data: 'ADMIN_EMAIL\nSEED' });
  assert.deepEqual(requiresSpec(form), { actor: 'ADMIN', environments: ['DEVELOPMENT'], data: ['ADMIN_EMAIL', 'SEED'] });
  assert.equal(requiresSpec({ actor: ' ', environments: [], data: '\n' }), null);
  assert.equal(sameRequires(form, { ...form, data: 'ADMIN_EMAIL, SEED' }), true);
});

test('a .env file is read line by line, with quotes, exports and comments', () => {
  const parsed = parseDotenv([
    '# admin sign-in',
    'ADMIN_EMAIL=admin@school.test',
    'ADMIN_PASSWORD="New Pass#word\\"1"',
    "export SEED='a b'",
    'PLAIN=value # trailing note',
    'HASHED=abc#def',
    'EMPTY=',
    'not an assignment',
    'ADMIN_EMAIL=later@school.test',
    '',
  ].join('\r\n'));
  assert.deepEqual(parsed.entries, [
    { key: 'ADMIN_EMAIL', value: 'later@school.test' },
    { key: 'ADMIN_PASSWORD', value: 'New Pass#word"1' },
    { key: 'SEED', value: 'a b' },
    { key: 'PLAIN', value: 'value' },
    { key: 'HASHED', value: 'abc#def' },
    { key: 'EMPTY', value: '' },
  ]);
  assert.equal(parsed.skipped, 1);
});

test('a flow keeps only the key of a pasted KEY=value line, never the value', () => {
  assert.deepEqual(runDataKeys('ADMIN_EMAIL=a@b.test\nADMIN_PASSWORD="NewPassword"\nSEED, OTHER'), ['ADMIN_EMAIL', 'ADMIN_PASSWORD', 'SEED', 'OTHER']);
  assert.deepEqual(requiresSpec({ actor: '', environments: [], data: 'ADMIN_PASSWORD=NewPassword' }), { environments: [], data: ['ADMIN_PASSWORD'] });
  assert.equal(runDataHasValues('ADMIN_PASSWORD=NewPassword'), true);
  assert.equal(runDataHasValues('ADMIN_PASSWORD=\nADMIN_EMAIL'), false);
});

test('passwords, tokens and keys are treated as secret without asking', () => {
  for (const key of ['ADMIN_PASSWORD', 'db_passwd', 'API_KEY', 'authToken', 'CLIENT_SECRET']) assert.equal(isSecretDataKey(key), true, key);
  for (const key of ['ADMIN_EMAIL', 'COURSE_TITLE', 'SEED']) assert.equal(isSecretDataKey(key), false, key);
});
