import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const consoleSource = await readFile(new URL('src/components/try-it-panel.tsx', root), 'utf8');
const sidebarSource = await readFile(new URL('src/components/side-bar.tsx', root), 'utf8');
const manifestSource = await readFile(new URL('src/generated/docs-manifest.ts', root), 'utf8');

test('interactive console has no default or persisted credential', () => {
  assert.match(consoleSource, /useState\(''\)/);
  assert.doesNotMatch(consoleSource, /localStorage|sessionStorage|DEFAULT_API_KEY|localhost:3000/);
});

test('interactive console encodes parameters, validates JSON, confirms mutations, and supports cancellation', () => {
  assert.match(consoleSource, /encodeURIComponent/);
  assert.match(consoleSource, /JSON\.parse/);
  assert.match(consoleSource, /Confirm API mutation/);
  assert.match(consoleSource, /AbortController/);
  assert.match(consoleSource, /status === 'planned'/);
});

test('navigation state uses the versioned v1 key and active-page accessibility', () => {
  assert.match(sidebarSource, /tellann-docs:nav:v1/);
  assert.match(sidebarSource, /aria-current/);
  assert.match(sidebarSource, /aria-expanded/);
});

test('generated manifest carries canonical metadata for all pages', () => {
  assert.equal((manifestSource.match(/"sourcePath":/g) || []).length, 277);
  assert.match(manifestSource, /"status": "planned"/);
  assert.match(manifestSource, /"plans": \[\s*"enterprise"/);
});
