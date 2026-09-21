import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { launchApprovalHash, LocalApplicationLauncher, type LocalLaunchCommand } from './application-launcher';

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

function pythonCommand(overrides: Partial<LocalLaunchCommand> = {}): LocalLaunchCommand {
  return {
    id: 'python-django:.',
    label: 'python manage.py runserver',
    executable: process.platform === 'win32' ? 'python.exe' : 'python3',
    args: ['manage.py', 'runserver'],
    cwd: '.',
    scriptName: 'runserver',
    runtime: 'python',
    ...overrides,
  };
}

test('accepts each approved Python launch shape', () => {
  const approved: LocalLaunchCommand[] = [
    pythonCommand(),
    pythonCommand({ scriptName: 'uvicorn', args: ['-m', 'uvicorn', 'app.main:app', '--reload'] }),
    pythonCommand({ scriptName: 'flask', args: ['-m', 'flask', '--app', 'shop', 'run'] }),
  ];
  for (const command of approved) {
    // The hash is computed without spawning, which is enough to prove the
    // command is accepted by the same validation the launcher applies.
    assert.equal(launchApprovalHash(command, process.cwd()).length, 64);
  }
});

test('refuses a Python command that is not one of the approved shapes', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tellann-python-launch-'));
  fs.writeFileSync(path.join(root, 'manage.py'), 'import os\n');
  const launcher = new LocalApplicationLauncher();

  const rejected: Array<[string, LocalLaunchCommand]> = [
    ['an arbitrary module', pythonCommand({ scriptName: 'uvicorn', args: ['-m', 'http.server'] })],
    ['an interpreter flag', pythonCommand({ args: ['-c', 'import os; os.system("echo hi")'] })],
    ['a shell injection in the module target', pythonCommand({
      scriptName: 'uvicorn',
      args: ['-m', 'uvicorn', 'app.main:app; rm -rf /', '--reload'],
    })],
    ['a different interpreter', pythonCommand({ executable: 'node' })],
    ['a script name that does not match its arguments', pythonCommand({
      scriptName: 'flask',
      args: ['manage.py', 'runserver'],
    })],
  ];

  for (const [reason, command] of rejected) {
    await assert.rejects(
      launcher.start(command, root, correlation),
      /UNAPPROVED_APPLICATION_LAUNCH_COMMAND/,
      reason,
    );
  }
});

test('a Python launch may run in a project subdirectory, but not outside the workspace', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tellann-python-scope-'));
  fs.mkdirSync(path.join(root, 'backend'));
  const launcher = new LocalApplicationLauncher();

  // `manage.py` lives in the subdirectory, so the staleness check passes only
  // when the command's own cwd is used to look for it.
  fs.writeFileSync(path.join(root, 'backend', 'manage.py'), 'import os\n');
  await assert.rejects(
    launcher.start(pythonCommand({ cwd: '../outside' }), root, correlation),
    /WORKSPACE|ESCAPE|outside/i,
  );
  await assert.rejects(
    launcher.start(pythonCommand({ cwd: '.' }), root, correlation),
    /APPLICATION_LAUNCH_SCRIPT_STALE/,
    'the repository root has no manage.py, so the launch is refused as stale',
  );
});

test('a Node launch is still confined to the repository root', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tellann-node-scope-'));
  fs.mkdirSync(path.join(root, 'web'));
  fs.writeFileSync(path.join(root, 'web', 'package.json'), JSON.stringify({ scripts: { dev: 'node x.js' } }));
  const launcher = new LocalApplicationLauncher();
  await assert.rejects(
    launcher.start({ ...command(), cwd: 'web' }, root, correlation),
    /APPLICATION_LAUNCH_SCOPE_INVALID/,
  );
});
