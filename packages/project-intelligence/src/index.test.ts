import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import test from 'node:test';
import { scanWorkspace, workingTreeIdentity } from './index';

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

test('uses a portable fingerprint and exposes only a credential-free GitHub clone URL', () => {
  const first = fs.mkdtempSync(path.join(os.tmpdir(), 'tellann-repo-a-'));
  const second = fs.mkdtempSync(path.join(os.tmpdir(), 'tellann-repo-b-'));
  for (const root of [first, second]) {
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ dependencies: { react: '^19.0.0' } }));
    execFileSync('git', ['init'], { cwd: root, stdio: 'ignore' });
    execFileSync('git', ['remote', 'add', 'origin', 'https://secret-token@github.com/Tellann/Monitor.git'], { cwd: root });
  }
  const firstSnapshot = scanWorkspace(first, { workspaceId: '00000000-0000-4000-8000-000000000003' });
  const secondSnapshot = scanWorkspace(second, { workspaceId: '00000000-0000-4000-8000-000000000004' });
  assert.equal(firstSnapshot.repositoryFingerprint, secondSnapshot.repositoryFingerprint);
  assert.equal(firstSnapshot.repositoryOriginHash, secondSnapshot.repositoryOriginHash);
  assert.equal(firstSnapshot.repositoryCloneUrl, 'https://github.com/tellann/monitor.git');
  assert.equal(firstSnapshot.repositoryCloneUrl?.includes('secret-token'), false);
});

test('a dirty checkout still has a stable identity that changes when the tree does', () => {
  // Without this, a checkout with uncommitted work could never be recognised as
  // the one that was already analysed: repositoryFingerprint folds in the
  // revision, so it is identical for every possible set of local edits at a
  // commit. Anything relying on it had to re-analyse — and re-ask for upload
  // consent — on every single run.
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tellann-dirty-scan-'));
  const git = (...args: string[]) =>
    execFileSync('git', ['-C', root, ...args], { stdio: ['ignore', 'pipe', 'ignore'] });
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'dirty', dependencies: { react: '^19.0.0' } }));
  fs.writeFileSync(path.join(root, 'app.js'), 'export const a = 1;\n');
  git('init', '-q');
  git('config', 'user.email', 'test@example.com');
  git('config', 'user.name', 'Test');
  git('add', '.');
  git('commit', '-q', '-m', 'initial');

  const options = { workspaceId: '00000000-0000-4000-8000-000000000009' };
  const clean = scanWorkspace(root, options);
  assert.equal(clean.dirty, false);
  assert.equal(typeof clean.workingTreeHash, 'string');
  assert.equal(scanWorkspace(root, options).workingTreeHash, clean.workingTreeHash, 'an unchanged tree is stable');

  // An uncommitted edit is a different tree...
  fs.writeFileSync(path.join(root, 'app.js'), 'export const a = 2;\n');
  const dirty = scanWorkspace(root, options);
  assert.equal(dirty.dirty, true);
  assert.notEqual(dirty.workingTreeHash, clean.workingTreeHash);
  assert.equal(dirty.repositoryFingerprint, clean.repositoryFingerprint, 'the commit-level fingerprint cannot see this');

  // ...but the *same* uncommitted edit is the same tree, which is what makes a
  // dirty checkout usable without re-analysing it every time.
  assert.equal(scanWorkspace(root, options).workingTreeHash, dirty.workingTreeHash);

  // A new untracked file changes it too.
  fs.writeFileSync(path.join(root, 'extra.js'), 'export const b = 3;\n');
  assert.notEqual(scanWorkspace(root, options).workingTreeHash, dirty.workingTreeHash);
});

test('the standalone working-tree identity agrees with the one the scan records', () => {
  // The desktop records this value when an analysis starts and recomputes it on
  // the next launch to decide whether that analysis still describes the folder.
  // If the two ever disagreed, every launch would look like a changed tree and
  // re-analyse — so agreement is the whole point, not an implementation detail.
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tellann-identity-'));
  const git = (...args: string[]) =>
    execFileSync('git', ['-C', root, ...args], { stdio: ['ignore', 'pipe', 'ignore'] });
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'identity', dependencies: { react: '^19.0.0' } }));
  fs.writeFileSync(path.join(root, 'app.js'), 'export const a = 1;\n');
  git('init', '-q');
  git('config', 'user.email', 'test@example.com');
  git('config', 'user.name', 'Test');
  git('add', '.');
  git('commit', '-q', '-m', 'initial');

  const options = { workspaceId: '00000000-0000-4000-8000-00000000000a' };
  assert.equal(workingTreeIdentity(root), scanWorkspace(root, options).workingTreeHash, 'clean tree');

  fs.writeFileSync(path.join(root, 'app.js'), 'export const a = 2;\n');
  const dirty = workingTreeIdentity(root);
  assert.equal(dirty, scanWorkspace(root, options).workingTreeHash, 'dirty tree');

  // Asking twice without touching anything is the "came back to the app" case.
  assert.equal(workingTreeIdentity(root), dirty, 'stable while nothing changes');

  // And it moves the moment the tree does.
  fs.writeFileSync(path.join(root, 'app.js'), 'export const a = 3;\n');
  assert.notEqual(workingTreeIdentity(root), dirty, 'a further edit is a different tree');
});
