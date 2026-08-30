import assert from 'node:assert/strict';
import test from 'node:test';
import { EnvironmentType, QARunMode } from '@tellann/db';
import { productionRunModeAllowed } from './desktop-routes';

test('cloud policy permits only observation-only QA runs in production', () => {
  assert.equal(productionRunModeAllowed(EnvironmentType.PRODUCTION, QARunMode.OBSERVATION_ONLY), true);
  assert.equal(productionRunModeAllowed(EnvironmentType.PRODUCTION, QARunMode.GUIDED), false);
  assert.equal(productionRunModeAllowed(EnvironmentType.PRODUCTION, QARunMode.ASSISTED), false);
  assert.equal(productionRunModeAllowed(EnvironmentType.STAGING, QARunMode.GUIDED), true);
});
