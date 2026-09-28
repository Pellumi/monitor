import assert from 'node:assert/strict';
import test from 'node:test';
import {
  checkRunDataAvailability, classifyRunDataValue, materializeRunData, missingRunDataKeys,
  personaCredentialData, personaForPlanner, personaRequiresLogin, protectedValueFor, runDataFingerprint, runDataPort,
} from './persona';
import { lmsContract } from './test-fixtures';
import type { RunDataSet, TestPersona } from '@tellann/desktop-contracts';

const dataSet = (values: RunDataSet['values']): RunDataSet => ({
  id: 'd1', applicationId: '11111111-1111-4111-8111-111111111111', name: 'LMS data',
  values, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
});

const persona = (overrides: Partial<TestPersona> = {}): TestPersona => ({
  id: 'p1', applicationId: '11111111-1111-4111-8111-111111111111', name: 'Teacher',
  roles: ['TEACHER'], authenticated: true, authMethod: 'PASSWORD', credentials: [{ field: 'email', value: 'teacher@test.dev' }, { field: 'password', value: 'hunter2' }],
  createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), ...overrides,
});

test('a literal generator is returned verbatim', () => {
  const materialized = materializeRunData(dataSet([{ key: 'examTitle', generator: { kind: 'LITERAL', value: 'Automated QA Exam' }, secret: false }]));
  assert.deepEqual(materialized.get('examTitle'), { value: 'Automated QA Exam', secret: false });
});

test('a future timestamp is computed from the given clock, not the wall clock', () => {
  const now = () => 1_700_000_000_000;
  const materialized = materializeRunData(dataSet([{ key: 'dueDate', generator: { kind: 'FUTURE_TIMESTAMP', offsetMs: 86_400_000 }, secret: false }]), now);
  assert.equal(materialized.get('dueDate')?.value, new Date(now() + 86_400_000).toISOString());
});

test('a unique-suffix value is different every materialization, so two runs never collide', () => {
  const generator = { key: 'slug', generator: { kind: 'UNIQUE_SUFFIX' as const, prefix: 'qa-exam-' }, secret: false };
  const first = materializeRunData(dataSet([generator])).get('slug')!.value;
  const second = materializeRunData(dataSet([generator])).get('slug')!.value;
  assert.notEqual(first, second);
  assert.match(first, /^qa-exam-[0-9a-f]{8}$/);
});

test('secrecy comes from the data set, not the generator kind', () => {
  const materialized = materializeRunData(dataSet([{ key: 'password', generator: { kind: 'LITERAL', value: 'hunter2' }, secret: true }]));
  assert.equal(materialized.get('password')?.secret, true);
});

test('no data set materializes to nothing, cleanly', () => {
  assert.equal(materializeRunData(null).size, 0);
  assert.equal(materializeRunData(undefined).size, 0);
});

test('the engine data port looks up materialized values and nothing else', () => {
  const materialized = materializeRunData(dataSet([{ key: 'examTitle', generator: { kind: 'LITERAL', value: 'x' }, secret: false }]));
  const port = runDataPort(materialized);
  assert.deepEqual(port('examTitle'), { value: 'x', secret: false });
  assert.equal(port('missing'), undefined);
});

test('missing run data keys are every contract input the data set has no value for', () => {
  const contract = lmsContract();
  assert.deepEqual(missingRunDataKeys(contract, new Map()), ['examTitle']);
  const supplied = materializeRunData(dataSet([{ key: 'examTitle', generator: { kind: 'LITERAL', value: 'x' }, secret: false }]));
  assert.deepEqual(missingRunDataKeys(contract, supplied), []);
});

test('preflight availability fails fast with every missing key named, before any action', () => {
  const result = checkRunDataAvailability(lmsContract(), new Map());
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.stopReason, 'TEST_DATA_UNAVAILABLE');
    assert.deepEqual(result.missingKeys, ['examTitle']);
    assert.match(result.detail, /examTitle/);
  }
  const supplied = materializeRunData(dataSet([{ key: 'examTitle', generator: { kind: 'LITERAL', value: 'x' }, secret: false }]));
  assert.deepEqual(checkRunDataAvailability(lmsContract(), supplied), { ok: true });
});

test('the planner persona is built from the session state, never from the identity\'s own authenticated flag', () => {
  // A persona whose identity always logs in, but this particular session has not yet.
  assert.deepEqual(personaForPlanner(persona(), false), { authenticated: false, roles: ['TEACHER'] });
  assert.deepEqual(personaForPlanner(persona(), true), { authenticated: true, roles: ['TEACHER'] });
  assert.deepEqual(personaForPlanner(null, true), { authenticated: true, roles: [] });
});

test('only the identity says whether a persona ever logs in at all', () => {
  assert.equal(personaRequiresLogin(persona()), true);
  assert.equal(personaRequiresLogin(persona({ authenticated: false })), false);
  assert.equal(personaRequiresLogin(null), false);
});

test('credential lookup is by field name, and values are always marked secret', () => {
  const data = personaCredentialData(persona());
  assert.deepEqual(data('email'), { value: 'teacher@test.dev', secret: true });
  assert.deepEqual(data('password'), { value: 'hunter2', secret: true });
  assert.equal(data('nope'), undefined);
  assert.equal(personaCredentialData(null)('email'), undefined);
});

test('a value the data set marked secret is always classified SECRET, whatever it looks like', () => {
  assert.equal(classifyRunDataValue('note', 'plain text', true), 'SECRET');
});

test('a direct identifier is recognised by its key name or its shape, even when not marked secret', () => {
  assert.equal(classifyRunDataValue('studentEmail', 'anything', false), 'DIRECT_IDENTIFIER');
  assert.equal(classifyRunDataValue('contact', 'person@example.com', false), 'DIRECT_IDENTIFIER');
  assert.equal(classifyRunDataValue('phone', '+1 (555) 123-4567', false), 'DIRECT_IDENTIFIER');
  assert.equal(classifyRunDataValue('examTitle', 'Automated QA Exam', false), 'ORDINARY');
});

test('a protected-value record withholds the value only when it is SECRET', () => {
  assert.deepEqual(protectedValueFor('password', 'hunter2', true), { keyPath: 'password', kind: 'SECRET', value: undefined, valueLength: 7 });
  assert.deepEqual(protectedValueFor('examTitle', 'Automated QA Exam', false), { keyPath: 'examTitle', kind: 'ORDINARY', value: 'Automated QA Exam', valueLength: 17 });
  assert.equal(protectedValueFor('email', 'a@b.com', false).kind, 'DIRECT_IDENTIFIER');
});

test('the run-data fingerprint is stable, differs when values differ, and never carries a secret value', () => {
  const a = materializeRunData(dataSet([{ key: 'examTitle', generator: { kind: 'LITERAL', value: 'x' }, secret: false }, { key: 'password', generator: { kind: 'LITERAL', value: 'hunter2' }, secret: true }]));
  const b = materializeRunData(dataSet([{ key: 'examTitle', generator: { kind: 'LITERAL', value: 'x' }, secret: false }, { key: 'password', generator: { kind: 'LITERAL', value: 'different' }, secret: true }]));
  assert.equal(runDataFingerprint(a), runDataFingerprint(a));
  assert.equal(runDataFingerprint(a), runDataFingerprint(b), 'a secret value never changes the fingerprint');
  const c = materializeRunData(dataSet([{ key: 'examTitle', generator: { kind: 'LITERAL', value: 'y' }, secret: false }]));
  assert.notEqual(runDataFingerprint(a), runDataFingerprint(c));
});
