import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { scanWorkspace } from './index';

test('discovers launchable package scripts without executing repository code', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tellann-scan-'));
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({
    scripts: { dev: 'node side-effect.js', test: 'node test.js', destroy: 'node destroy.js' },
    dependencies: { react: '^19.0.0', vite: '^7.0.0' },
  }));
  fs.writeFileSync(path.join(root, 'package-lock.json'), '{}');
  fs.writeFileSync(path.join(root, 'side-effect.js'), `require('node:fs').writeFileSync('executed.txt', 'bad')`);
  const snapshot = scanWorkspace(root, { workspaceId: '00000000-0000-4000-8000-000000000001' });
  assert.deepEqual(snapshot.launchCommands?.map((command) => command.scriptName), ['dev']);
  assert.deepEqual(snapshot.suggestedApplicationUrls, [{
    url: 'http://localhost:5173', confidence: 0.82, source: 'Vite default',
  }]);
  assert.equal(fs.existsSync(path.join(root, 'executed.txt')), false);
});

test('prefers an explicit launch port and detected login route', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tellann-url-scan-'));
  fs.mkdirSync(path.join(root, 'src'));
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({
    scripts: { dev: 'vite --host 127.0.0.1 --port 4174' },
    dependencies: { react: '^19.0.0', vite: '^7.0.0' },
  }));
  fs.writeFileSync(path.join(root, 'package-lock.json'), '{}');
  fs.writeFileSync(path.join(root, 'src', 'routes.tsx'), `const login = { path: '/login' };`);
  const snapshot = scanWorkspace(root, { workspaceId: '00000000-0000-4000-8000-000000000002' });
  assert.deepEqual(snapshot.suggestedApplicationUrls?.[0], {
    url: 'http://localhost:4174/login', confidence: 0.98, source: 'package.json launch script',
  });
});
