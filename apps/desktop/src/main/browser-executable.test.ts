import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import { packagedBrowserExecutable } from './browser-executable';

test('resolves the staged Linux Chromium executable', () => {
  assert.equal(
    packagedBrowserExecutable('/opt/Tellann/resources', 'linux'),
    path.join('/opt/Tellann/resources', 'chromium', 'browser', 'chrome'),
  );
});

test('resolves the staged Windows Chromium executable', () => {
  assert.equal(
    packagedBrowserExecutable('C:\\Tellann\\resources', 'win32'),
    path.join('C:\\Tellann\\resources', 'chromium', 'browser', 'chrome.exe'),
  );
});
