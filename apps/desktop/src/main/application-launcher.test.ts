import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { LocalApplicationLauncher, type LocalLaunchCommand } from './application-launcher';

const correlation = {
  endpoint: 'http://127.0.0.1:43210',
  relayToken: 'r'.repeat(48),
  runId: '00000000-0000-4000-8000-000000000001',
  sessionId: '00000000-0000-4000-8000-000000000002',
  traceId: '00000000-0000-4000-8000-000000000003',
  applicationId: '00000000-0000-4000-8000-000000000004',
  environmentId: '00000000-0000-4000-8000-000000000005',
  agentVersion: 'test',
};

function command(scriptName = 'dev'): LocalLaunchCommand {
  const manager = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  return { id: `package-script:${scriptName}`, label: `npm run ${scriptName}`, executable: manager, args: ['run', scriptName], cwd: '.', scriptName };
}

test('launches only an approved package script with run-scoped relay correlation', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tellann-launch-'));
  const output = path.join(root, 'correlation.json');
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ scripts: { dev: 'node server.js' } }));
  fs.writeFileSync(path.join(root, 'server.js'), `require('node:fs').writeFileSync(${JSON.stringify(output)}, JSON.stringify({ endpoint: process.env.TELLANN_RELAY_ENDPOINT, runId: process.env.TELLANN_RUN_ID, sessionId: process.env.TELLANN_SESSION_ID, traceId: process.env.TELLANN_TRACE_ID })); setInterval(() => {}, 1000);`);
  const launcher = new LocalApplicationLauncher();
  try {
    const result = await launcher.start(command(), root, correlation);
    assert.ok(result.pid > 0);
    assert.equal(result.approvalHash.length, 64);
    const deadline = Date.now() + 5_000;
    while (!fs.existsSync(output) && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    assert.equal(fs.existsSync(output), true, launcher.sanitizedOutput);
    assert.deepEqual(JSON.parse(fs.readFileSync(output, 'utf8')), {
      endpoint: correlation.endpoint,
      runId: correlation.runId,
      sessionId: correlation.sessionId,
      traceId: correlation.traceId,
    });
  } finally {
    await launcher.stop();
  }
  assert.equal(launcher.active, false);
});

test('rejects package scripts outside the scanner allowlist', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tellann-launch-reject-'));
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ scripts: { destroy: 'node destroy.js' } }));
  const launcher = new LocalApplicationLauncher();
  await assert.rejects(launcher.start(command('destroy'), root, correlation), /UNAPPROVED_APPLICATION_LAUNCH_COMMAND/);
});
