import assert from 'node:assert/strict';
import test from 'node:test';
import { EnvironmentType, QARunMode } from '@tellann/db';
import { firstNonEmptyValue, productionRunModeAllowed } from './desktop-routes';

test('cloud policy permits only observation-only QA runs in production', () => {
  assert.equal(productionRunModeAllowed(EnvironmentType.PRODUCTION, QARunMode.OBSERVATION_ONLY), true);
  assert.equal(productionRunModeAllowed(EnvironmentType.PRODUCTION, QARunMode.GUIDED), false);
  assert.equal(productionRunModeAllowed(EnvironmentType.PRODUCTION, QARunMode.ASSISTED), false);
  assert.equal(productionRunModeAllowed(EnvironmentType.STAGING, QARunMode.GUIDED), true);
});

test('boundary field resolution treats an empty string as absent', () => {
  // The desktop sends every field every time. For a marker written as
  // `{ flow, state }` it has no stateKey to send and sends `''` — which a `??`
  // chain would accept, refusing the event before the boundary saw the marker.
  const metadata: Record<string, unknown> = { flow: 'onboarding-flow', state: 'guest' };
  assert.equal(
    firstNonEmptyValue('', metadata.stateKey, undefined, metadata.toStateKey, metadata.state),
    'guest',
  );
  assert.equal(firstNonEmptyValue('   ', 'guest'), 'guest');
  assert.equal(firstNonEmptyValue('explicit', 'guest'), 'explicit');
  assert.equal(firstNonEmptyValue(null, undefined, ''), '');
});
