import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import type { ExecutionProfile } from '@tellann/desktop-contracts';
import type { LocalLaunchCommand } from '../application-launcher';
import { approveProfile } from './execution-profile';
import { ProjectRunner, defaultProbes } from './project-runner';
import type { ManagedProcess, RunnerEvent, RunnerProbes } from './project-runner';

const APP_ID = '11111111-1111-4111-8111-111111111111';
const correlation = {
  endpoint: 'http://127.0.0.1:43210', relayToken: 'r'.repeat(48),
  runId: '00000000-0000-4000-8000-000000000001', sessionId: '00000000-0000-4000-8000-000000000002',
  traceId: '00000000-0000-4000-8000-000000000003', applicationId: APP_ID,
  environmentId: '00000000-0000-4000-8000-000000000005', agentVersion: 'test',
};

const cmd = (scriptName: string): LocalLaunchCommand =>
  ({ id: `package-script:${scriptName}`, label: `npm run ${scriptName}`, executable: 'npm', args: ['run', scriptName], cwd: '.', scriptName });

const workspace = () => fs.mkdtempSync(path.join(os.tmpdir(), 'tellann-runner-'));

class FakeProcess implements ManagedProcess {
  private alive = false;
  /** Set to make the process die as soon as it has started, deterministically. */
  crashed = false;
  get active(): boolean { return this.alive && !this.crashed; }
  set active(value: boolean) { this.alive = value; }
  sanitizedOutput = '';
  started = false;
  stopped = false;
  constructor(private readonly log: string[], readonly name: string, private readonly onStart?: (self: FakeProcess) => void | Promise<void>) {}
  async start(): Promise<{ pid: number }> {
    this.log.push(`start:${this.name}`);
    await this.onStart?.(this);
    this.active = true;
    this.started = true;
    return { pid: 1234 };
  }
  async stop(): Promise<void> {
    this.log.push(`stop:${this.name}`);
    this.active = false;
    this.stopped = true;
  }
}

/** Probes whose answers the test controls. */
function scriptedProbes(answers: { port?: (port: number) => boolean; http?: (url: string) => boolean } = {}): RunnerProbes {
  return {
    port: async (port) => answers.port?.(port) ?? true,
    http: async (url) => answers.http?.(url) ?? true,
  };
}

interface Rig { runner: ProjectRunner; log: string[]; processes: FakeProcess[]; events: RunnerEvent[]; clock: { now: number } }

function rig(options: { probes?: RunnerProbes; onStart?: (name: string, self: FakeProcess) => void | Promise<void> } = {}): Rig {
  const log: string[] = [];
  const processes: FakeProcess[] = [];
  const clock = { now: 0 };
  const names = ['api', 'web', 'worker'];
  const runner = new ProjectRunner({
    createProcess: () => {
      const name = names[processes.length]!;
      const proc = new FakeProcess(log, name, options.onStart ? (self) => options.onStart!(name, self) : undefined);
      processes.push(proc);
      return proc;
    },
    probes: options.probes ?? scriptedProbes(),
    // Time advances only when the runner waits, so timeouts are exercised without sleeping.
    sleep: async (ms) => { clock.now += ms; },
    now: () => clock.now,
    pollMs: 100,
    applicationReadyTimeoutMs: 1_000,
  });
  return { runner, log, processes, events: [], clock };
}

function twoProcessProfile(root: string, overrides: Partial<ExecutionProfile> = {}) {
  const commands = [cmd('dev'), cmd('start')];
  const profile = approveProfile({
    id: 'p', applicationId: APP_ID, name: 'Full stack', applicationUrl: 'http://localhost:5173/',
    processes: [
      { name: 'api', launchCommandId: 'package-script:start', readyCondition: { type: 'PORT', port: 4000 }, readyTimeoutMs: 5_000 },
      { name: 'web', launchCommandId: 'package-script:dev', readyCondition: { type: 'HTTP', url: 'http://localhost:5173/' }, readyTimeoutMs: 5_000 },
    ],
    approvedHash: null, approvedAt: null, ...overrides,
  }, commands, root);
  return { commands, profile };
}

test('processes start in profile order, each waited on until ready, and stop in reverse', async () => {
  const root = workspace();
  const { commands, profile } = twoProcessProfile(root);
  const r = rig();
  const events: RunnerEvent[] = [];
  const result = await r.runner.start({ profile, commands, workspaceRoot: root, correlation, onEvent: (e) => events.push(e) });
  assert.deepEqual(result, { ok: true, started: ['api', 'web'] });
  assert.deepEqual(events.map((e) => `${e.process}:${e.phase}`), ['api:STARTED', 'api:READY', 'web:STARTED', 'web:READY']);
  assert.equal(r.runner.health(), 'OK');

  await r.runner.stop((e) => events.push(e));
  assert.deepEqual(r.log, ['start:api', 'start:web', 'stop:web', 'stop:api'], 'reverse order');
  await r.runner.stop();
  assert.equal(r.log.length, 4, 'stopping twice does nothing more');
});

test('a process is not ready until its own predicate holds', async () => {
  const root = workspace();
  const { commands, profile } = twoProcessProfile(root);
  let portOpenAt = 3;
  let polls = 0;
  const r = rig({ probes: scriptedProbes({ port: () => ++polls >= portOpenAt }) });
  const result = await r.runner.start({ profile, commands, workspaceRoot: root, correlation });
  assert.equal(result.ok, true);
  assert.equal(polls, 3, 'it polled until the port opened, not once and not on a timer');
  // The web process must not have started before the api was ready.
  assert.deepEqual(r.log.slice(0, 2), ['start:api', 'start:web']);
});

test('a process that exits before it is ready fails the start immediately and tears everything down', async () => {
  const root = workspace();
  const { commands, profile } = twoProcessProfile(root);
  const r = rig({
    probes: scriptedProbes({ http: () => false }),
    // The web process starts, then dies with output.
    onStart: (name, self) => { if (name === 'web') { self.sanitizedOutput = 'Error: Cannot find module vite'; self.crashed = true; } },
  });
  const started = r.runner.start({ profile, commands, workspaceRoot: root, correlation });
  const result = await started;
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.stopReason, 'APPLICATION_START_FAILED');
    assert.match(result.detail, /web exited before it was ready/);
    assert.match(result.detail, /Cannot find module vite/, 'the process output is in the evidence');
  }
  assert.deepEqual(r.log.filter((l) => l.startsWith('stop:')), ['stop:web', 'stop:api'], 'the api that did come up was stopped too');
});

test('a process that never becomes ready times out', async () => {
  const root = workspace();
  const { commands, profile } = twoProcessProfile(root);
  const r = rig({ probes: scriptedProbes({ port: () => false }) });
  const result = await r.runner.start({ profile, commands, workspaceRoot: root, correlation });
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.detail, /api did not become ready in time/);
  assert.equal(r.log.includes('stop:api'), true);
});

test('LOG readiness waits for the pattern in the process output', async () => {
  const root = workspace();
  const commands = [cmd('dev')];
  const profile = approveProfile({
    id: 'p', applicationId: APP_ID, name: 'Dev', applicationUrl: 'http://localhost:5173/',
    processes: [{ name: 'web', launchCommandId: 'package-script:dev', readyCondition: { type: 'LOG', pattern: 'Local:\\s+http' }, readyTimeoutMs: 5_000 }],
    approvedHash: null, approvedAt: null,
  }, commands, root);
  const r = rig();
  // The output appears a few polls after the process starts.
  let ticks = 0;
  const original = r.runner as unknown as { deps: { sleep: (ms: number) => Promise<void> } };
  const sleep = original.deps.sleep;
  original.deps.sleep = async (ms) => { await sleep(ms); if (++ticks === 3) r.processes[0]!.sanitizedOutput = '  Local:   http://localhost:5173/'; };
  const result = await r.runner.start({ profile, commands, workspaceRoot: root, correlation });
  assert.equal(result.ok, true);
  assert.equal(ticks >= 3, true);
});

test('an unapproved profile starts nothing', async () => {
  const root = workspace();
  const { commands, profile } = twoProcessProfile(root);
  const r = rig();
  const result = await r.runner.start({ profile: { ...profile, approvedHash: null }, commands, workspaceRoot: root, correlation });
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.detail, /not approved/);
  assert.deepEqual(r.log, []);
});

test('a profile whose command changed since approval starts nothing', async () => {
  const root = workspace();
  const { commands, profile } = twoProcessProfile(root);
  const r = rig();
  const edited = commands.map((c) => (c.id === 'package-script:dev' ? { ...c, args: ['run', 'dev', '--host', '0.0.0.0'] } : c));
  const result = await r.runner.start({ profile, commands: edited, workspaceRoot: root, correlation });
  assert.equal(result.ok, false);
  assert.deepEqual(r.log, [], 'nothing was spawned from a command nobody approved');
});

test('a process that fails to launch fails the start and stops what was already running', async () => {
  const root = workspace();
  const { commands, profile } = twoProcessProfile(root);
  const r = rig({ onStart: (name) => { if (name === 'web') throw new Error('LOCAL_APPLICATION_LAUNCH_FAILED:1:npm ERR! missing script'); } });
  const result = await r.runner.start({ profile, commands, workspaceRoot: root, correlation });
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.detail, /The process exited on start: 1:npm ERR! missing script/);
  assert.equal(r.log.includes('stop:api'), true);
});

test('a crash after a successful start is reported as the application crashing', async () => {
  const root = workspace();
  const { commands, profile } = twoProcessProfile(root);
  const r = rig();
  await r.runner.start({ profile, commands, workspaceRoot: root, correlation });
  assert.equal(r.runner.health(), 'OK');
  r.processes[1]!.active = false;
  assert.equal(r.runner.health(), 'APPLICATION_CRASHED');
  await r.runner.stop();
});

test('a profile with no processes still requires the application URL to answer', async () => {
  const root = workspace();
  const profile = approveProfile({ id: 'p', applicationId: APP_ID, name: 'Staging', applicationUrl: 'https://staging.example.test/', processes: [], approvedHash: null, approvedAt: null }, [], root);
  const up = rig();
  assert.deepEqual(await up.runner.start({ profile, commands: [], workspaceRoot: root, correlation }), { ok: true, started: [] });
  const down = rig({ probes: scriptedProbes({ http: () => false }) });
  const result = await down.runner.start({ profile, commands: [], workspaceRoot: root, correlation });
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.detail, /did not answer/);
});

test('one runner runs one application at a time', async () => {
  const root = workspace();
  const { commands, profile } = twoProcessProfile(root);
  const r = rig();
  await r.runner.start({ profile, commands, workspaceRoot: root, correlation });
  const again = await r.runner.start({ profile, commands, workspaceRoot: root, correlation });
  assert.equal(again.ok, false);
  await r.runner.stop();
});

test('the default probes tell an open port and an answering server from a closed one', async () => {
  const server = http.createServer((_req, res) => { res.writeHead(404); res.end(); });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  try {
    assert.equal(await defaultProbes.port(port), true);
    assert.equal(await defaultProbes.http(`http://127.0.0.1:${port}/`), true, 'a 404 is still an application that is up');
    assert.equal(await defaultProbes.http(`http://127.0.0.1:${port}/`, 200), false, 'unless an exact status was required');
  } finally {
    await new Promise<void>((resolve) => { server.closeAllConnections(); server.close(() => resolve()); });
  }
  const closed = await new Promise<number>((resolve) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = (s.address() as AddressInfo).port; s.close(() => resolve(p)); }); });
  assert.equal(await defaultProbes.port(closed), false);
  assert.equal(await defaultProbes.http(`http://127.0.0.1:${closed}/`), false);
});

test('end to end: the real launcher spawns a real server, and readiness is the port opening', async () => {
  const root = workspace();
  const port = await new Promise<number>((resolve) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = (s.address() as AddressInfo).port; s.close(() => resolve(p)); }); });
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ scripts: { dev: 'node server.js' } }));
  // Slow to come up on purpose: readiness has to wait for the predicate, not the process start.
  fs.writeFileSync(path.join(root, 'server.js'), `setTimeout(() => require('node:http').createServer((q, s) => s.end('ok')).listen(${port}, '127.0.0.1'), 800); setInterval(() => {}, 1000);`);
  const manager = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const commands: LocalLaunchCommand[] = [{ id: 'package-script:dev', label: 'npm run dev', executable: manager, args: ['run', 'dev'], cwd: '.', scriptName: 'dev' }];
  const profile = approveProfile({
    id: 'p', applicationId: APP_ID, name: 'Dev', applicationUrl: `http://127.0.0.1:${port}/`,
    processes: [{ name: 'web', launchCommandId: 'package-script:dev', readyCondition: { type: 'PORT', port }, readyTimeoutMs: 30_000 }],
    approvedHash: null, approvedAt: null,
  }, commands, root);
  const runner = new ProjectRunner();
  const events: RunnerEvent[] = [];
  try {
    const result = await runner.start({ profile, commands, workspaceRoot: root, correlation, onEvent: (e) => events.push(e) });
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.deepEqual(events.map((e) => e.phase), ['STARTED', 'READY']);
    assert.equal(await defaultProbes.http(`http://127.0.0.1:${port}/`, 200), true, 'the application really is up');
    assert.equal(runner.health(), 'OK');
  } finally {
    await runner.stop();
  }
  assert.equal(await defaultProbes.port(port), false, 'and it is really gone after stop');
});
