import assert from 'node:assert/strict';
import test from 'node:test';
import { EnvironmentType } from '@sots/db';
import { normalizeEnvironmentBaseUrl, normalizeEnvironmentName } from './environment-policy';

test('normalizes safe environment base URLs', () => {
  assert.equal(normalizeEnvironmentBaseUrl(' http://localhost:3010/ ', EnvironmentType.DEVELOPMENT), 'http://localhost:3010');
  assert.equal(normalizeEnvironmentBaseUrl('https://staging.example.com/app/', EnvironmentType.STAGING), 'https://staging.example.com/app');
  assert.equal(normalizeEnvironmentBaseUrl('', EnvironmentType.DEVELOPMENT), null);
});

test('rejects unsafe or ambiguous environment base URLs', () => {
  assert.throws(() => normalizeEnvironmentBaseUrl('ftp://example.com', EnvironmentType.STAGING), /HTTP or HTTPS/);
  assert.throws(() => normalizeEnvironmentBaseUrl('https://user:pass@example.com', EnvironmentType.STAGING), /credentials/);
  assert.throws(() => normalizeEnvironmentBaseUrl('https://example.com?a=1', EnvironmentType.STAGING), /query string/);
  assert.throws(() => normalizeEnvironmentBaseUrl('http://example.com', EnvironmentType.PRODUCTION), /HTTPS/);
});

test('normalizes and bounds environment names', () => {
  assert.equal(normalizeEnvironmentName('  Staging  '), 'Staging');
  assert.throws(() => normalizeEnvironmentName('   '), /required/);
  assert.throws(() => normalizeEnvironmentName('x'.repeat(81)), /80 characters/);
});
