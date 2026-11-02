import assert from 'node:assert/strict';
import test from 'node:test';
import { riskTierOf } from './autonomous-risk';

test('every action class maps to exactly one risk tier, danger non-decreasing with ActionClass order', () => {
  assert.equal(riskTierOf('READ'), 'READ_ONLY');
  assert.equal(riskTierOf('CLIENT_STATE_MUTATION'), 'REVERSIBLE');
  assert.equal(riskTierOf('SERVER_MUTATION'), 'STATE_CHANGING');
  assert.equal(riskTierOf('EXTERNAL_SIDE_EFFECT'), 'HIGH_IMPACT');
  assert.equal(riskTierOf('DESTRUCTIVE'), 'HIGH_IMPACT');
});
