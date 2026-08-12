import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveDesktopUpdatePolicy } from './update-policy';

test('desktop updates stay disabled for development, missing feeds, and insecure feeds', () => {
  assert.deepEqual(resolveDesktopUpdatePolicy({ packaged: false, updateUrl: 'https://updates.example.test' }), { enabled: false, reason: 'DEVELOPMENT_BUILD' });
  assert.deepEqual(resolveDesktopUpdatePolicy({ packaged: true }), { enabled: false, reason: 'UPDATE_URL_NOT_CONFIGURED' });
  assert.deepEqual(resolveDesktopUpdatePolicy({ packaged: true, updateUrl: 'http://updates.example.test' }), { enabled: false, reason: 'HTTPS_UPDATE_URL_REQUIRED' });
  assert.deepEqual(resolveDesktopUpdatePolicy({ packaged: true, updateUrl: 'not-a-url' }), { enabled: false, reason: 'HTTPS_UPDATE_URL_REQUIRED' });
});

test('desktop updates allow only approved release channels over HTTPS', () => {
  assert.deepEqual(resolveDesktopUpdatePolicy({ packaged: true, updateUrl: 'https://updates.example.test/releases', channel: 'beta' }), {
    enabled: true, url: 'https://updates.example.test/releases', channel: 'beta',
  });
  assert.deepEqual(resolveDesktopUpdatePolicy({ packaged: true, updateUrl: 'https://updates.example.test', channel: 'nightly' }), { enabled: false, reason: 'INVALID_UPDATE_CHANNEL' });
});
