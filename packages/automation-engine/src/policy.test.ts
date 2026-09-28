import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyAction, evaluateAction, evaluateNavigation, isRetrySafe } from './policy';

const evidence = (overrides: Partial<Parameters<typeof classifyAction>[0]> = {}) => ({
  methods: [], labels: [], isNavigation: false, handlerTraced: false, submitsForm: false, ...overrides,
});

test('production blocks everything, including what an approval would allow elsewhere', () => {
  for (const actionClass of ['READ', 'CLIENT_STATE_MUTATION', 'SERVER_MUTATION', 'EXTERNAL_SIDE_EFFECT', 'DESTRUCTIVE'] as const) {
    const decision = evaluateAction(actionClass, 'PRODUCTION', { approvedClasses: [actionClass] });
    assert.equal(decision.allowed, false, actionClass);
    if (!decision.allowed) assert.equal(decision.reason, 'PRODUCTION_BLOCKED');
  }
});

test('development and staging permit reads and ordinary mutations, and block the dangerous classes', () => {
  for (const environment of ['DEVELOPMENT', 'STAGING'] as const) {
    assert.equal(evaluateAction('READ', environment).allowed, true);
    assert.equal(evaluateAction('CLIENT_STATE_MUTATION', environment).allowed, true);
    assert.equal(evaluateAction('SERVER_MUTATION', environment).allowed, true);
    assert.equal(evaluateAction('DESTRUCTIVE', environment).allowed, false);
    assert.equal(evaluateAction('EXTERNAL_SIDE_EFFECT', environment).allowed, false);
  }
});

test('the developer can approve a specific class for a run', () => {
  assert.equal(evaluateAction('EXTERNAL_SIDE_EFFECT', 'STAGING', { approvedClasses: ['EXTERNAL_SIDE_EFFECT'] }).allowed, true);
  assert.equal(evaluateAction('DESTRUCTIVE', 'STAGING', { approvedClasses: ['EXTERNAL_SIDE_EFFECT'] }).allowed, false);
});

test('navigation stays on the application origin unless the origin was approved', () => {
  const origin = 'http://localhost:3000';
  assert.equal(evaluateNavigation('http://localhost:3000/courses', origin).allowed, true);
  assert.equal(evaluateNavigation('/courses', origin).allowed, true, 'relative');
  const external = evaluateNavigation('https://checkout.stripe.com/pay/cs_1', origin);
  assert.equal(external.allowed, false);
  assert.equal(evaluateNavigation('https://auth.example.test/login', origin, { approvedOrigins: ['https://auth.example.test'] }).allowed, true);
  assert.equal(evaluateNavigation('http://localhost:3001/', origin).allowed, false, 'a different port is a different origin');
});

test('classification takes the most dangerous reading the evidence supports', () => {
  assert.equal(classifyAction(evidence({ methods: ['DELETE'] })), 'DESTRUCTIVE');
  assert.equal(classifyAction(evidence({ labels: ['Delete course'] })), 'DESTRUCTIVE');
  assert.equal(classifyAction(evidence({ labels: ['Pay now'] })), 'EXTERNAL_SIDE_EFFECT');
  assert.equal(classifyAction(evidence({ methods: ['post'] })), 'SERVER_MUTATION');
  assert.equal(classifyAction(evidence({ submitsForm: true })), 'SERVER_MUTATION');
  assert.equal(classifyAction(evidence({ methods: ['POST'], labels: ['Delete'] })), 'DESTRUCTIVE', 'the label still counts');
});

test('a plain link is a read; a traced GET is a read', () => {
  assert.equal(classifyAction(evidence({ isNavigation: true })), 'READ');
  assert.equal(classifyAction(evidence({ methods: ['GET'], handlerTraced: true })), 'READ');
});

test('no evidence about a button is never read as a read', () => {
  assert.equal(classifyAction(evidence()), 'CLIENT_STATE_MUTATION');
  assert.equal(classifyAction(evidence({ handlerTraced: true })), 'CLIENT_STATE_MUTATION');
  assert.equal(classifyAction(evidence({ labels: ['Create Exam'] })), 'CLIENT_STATE_MUTATION');
});

test('only reads and client state changes are retried', () => {
  assert.equal(isRetrySafe('READ'), true);
  assert.equal(isRetrySafe('CLIENT_STATE_MUTATION'), true);
  for (const actionClass of ['SERVER_MUTATION', 'EXTERNAL_SIDE_EFFECT', 'DESTRUCTIVE'] as const) {
    assert.equal(isRetrySafe(actionClass), false, actionClass);
  }
});
