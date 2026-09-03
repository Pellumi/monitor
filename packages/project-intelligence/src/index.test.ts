import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import test from 'node:test';
import { analyzeCodebase, buildSanitizedSourceArchive, scanWorkspace } from './index';

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

test('builds a deterministic evidence graph and feature projection without executing code', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tellann-analysis-'));
  fs.mkdirSync(path.join(root, 'src'));
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'checkout-api', dependencies: { express: '^5.0.0', '@prisma/client': '^5.0.0', stripe: '^17.0.0' } }));
  fs.writeFileSync(path.join(root, '.env'), 'STRIPE_SECRET_KEY=must-not-leave-device');
  fs.writeFileSync(path.join(root, 'src', 'checkout.ts'), `
    import express from 'express';
    const app = express();
    const prisma: any = {};
    const stripe: any = {};
    app.post('/checkout', async function checkout() {
      await prisma.order.create({ data: {} });
      await stripe.paymentIntents.create({ amount: 100 });
    });
  `);
  const workspaceId = '00000000-0000-4000-8000-000000000005';
  const first = analyzeCodebase(root, workspaceId, 'f'.repeat(64));
  const second = analyzeCodebase(root, workspaceId, 'f'.repeat(64));
  assert.equal(first.graphVersion, second.graphVersion);
  assert.ok(first.entities.some((entity) => entity.type === 'endpoint' && entity.name === 'POST /checkout'));
  assert.ok(first.relationships.some((edge) => edge.type === 'WRITES'));
  assert.ok(first.relationships.some((edge) => edge.type === 'CALLS_EXTERNAL'));
  assert.ok(first.features.some((feature) => feature.name === 'POST /checkout'));
  const archive = buildSanitizedSourceArchive(root);
  const decoded = require('node:zlib').gunzipSync(archive.buffer).toString('utf8');
  assert.equal(decoded.includes('STRIPE_SECRET_KEY'), false);
  assert.equal(decoded.includes('/checkout'), true);
});
