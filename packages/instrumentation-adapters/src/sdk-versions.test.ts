import assert from 'node:assert/strict';
import test from 'node:test';
import { isNpmVersionOutdated, isPyPiVersionOutdated } from './sdk-versions';

test('an npm SDK is outdated only when strictly behind a known latest', () => {
  assert.equal(isNpmVersionOutdated('1.2.0', '1.3.0'), true);
  assert.equal(isNpmVersionOutdated('1.3.0', '1.3.0'), false);
  assert.equal(isNpmVersionOutdated('1.4.0', '1.3.0'), false);
  // No registry answer (offline, unpublished, rate limited) is "unknown", not "outdated".
  assert.equal(isNpmVersionOutdated('1.2.0', null), false);
  // A `v`-prefixed or otherwise loosely-formed installed version still coerces to a comparable one.
  assert.equal(isNpmVersionOutdated('v1.2.0', '1.3.0'), true);
});

test('a PyPI SDK is outdated only when strictly behind a known latest, compared by PEP 440', () => {
  assert.equal(isPyPiVersionOutdated('0.9.0', '0.10.0'), true);
  assert.equal(isPyPiVersionOutdated('0.10.0', '0.10.0'), false);
  assert.equal(isPyPiVersionOutdated('0.11.0', '0.10.0'), false);
  assert.equal(isPyPiVersionOutdated('0.9.0', null), false);
  // A release candidate sorts behind its final release, the way PEP 440 orders them.
  assert.equal(isPyPiVersionOutdated('1.0.0rc1', '1.0.0'), true);
  // An unparsable string on either side is "unknown" rather than a thrown error.
  assert.equal(isPyPiVersionOutdated('not-a-version', '1.0.0'), false);
});
