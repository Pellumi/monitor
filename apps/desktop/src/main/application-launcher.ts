import fs from 'node:fs';
import path from 'node:path';
import { execFile, spawn, type ChildProcess } from 'node:child_process';
import { createHash } from 'node:crypto';
import { resolveWithinWorkspace } from '@sots/agent-policy';

export type LocalLaunchCommand = {
  id: string;
  label: string;
  executable: string;
  args: string[];
  cwd: string;
  scriptName: string;
};

export type LaunchCorrelation = {
  endpoint: string;
  relayToken: string;
  runId: string;
  sessionId: string;
  traceId: string;
  applicationId: string;
  environmentId: string;
  agentVersion: string;
};

export type PermanentLaunchEnvironment = {
  endpoint: string;
  ingestionKey: string;
  applicationId: string;
  environmentId: string;
};

const ALLOWED_MANAGERS = new Set(['npm', 'pnpm', 'yarn', 'bun']);
const ALLOWED_SCRIPTS = new Set(['dev', 'start', 'serve', 'preview']);

function safeOutput(value: string): string {
  return value
    .replace(/(bearer\s+)[a-z0-9._~+\/-]+=*/gi, '$1[REDACTED]')
    .replace(/((?:auth|password|secret|token|api[-_]?key)\s*[=:]\s*)[^\s]+/gi, '$1[REDACTED]')
    .slice(-24_000);
}

async function resolveExecutable(command: LocalLaunchCommand): Promise<{ executable: string; args: string[] }> {
  const manager = command.executable.replace(/\.(cmd|exe)$/i, '');
  if (!ALLOWED_MANAGERS.has(manager) || command.args.length !== 2 || command.args[0] !== 'run' || command.args[1] !== command.scriptName || !ALLOWED_SCRIPTS.has(command.scriptName)) {
    throw new Error('UNAPPROVED_APPLICATION_LAUNCH_COMMAND');
  }
  if (process.platform !== 'win32' || manager === 'bun') return { executable: command.executable, args: command.args };
  const whereOutput = await new Promise<string>((resolve, reject) => execFile('where.exe', [`${manager}.cmd`], {
    encoding: 'utf8', windowsHide: true, timeout: 60_000,
  }, (error, stdout) => error ? reject(error) : resolve(stdout)));
  const launchers = whereOutput.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
  const cliParts = manager === 'pnpm'
    ? ['node_modules', 'pnpm', 'bin', 'pnpm.cjs']
    : manager === 'npm'
      ? ['node_modules', 'npm', 'bin', 'npm-cli.js']
      : ['node_modules', 'yarn', 'bin', 'yarn.js'];
  for (const launcher of launchers) {
    const cli = path.join(path.dirname(launcher), ...cliParts);
    const nodeExecutable = path.join(path.dirname(launcher), 'node.exe');
    if (fs.existsSync(cli) && fs.existsSync(nodeExecutable)) return { executable: nodeExecutable, args: [cli, ...command.args] };
  }
  throw new Error(`SAFE_${manager.toUpperCase()}_EXECUTABLE_NOT_FOUND`);
}

export function launchApprovalHash(command: LocalLaunchCommand, workspaceRoot: string): string {
  return createHash('sha256').update(JSON.stringify({
    workspaceRoot: fs.realpathSync.native(workspaceRoot),
    id: command.id,
    executable: command.executable,
    args: command.args,
    cwd: command.cwd,
  })).digest('hex');
}

export class LocalApplicationLauncher {
  private child: ChildProcess | null = null;
  private output = '';

  get active(): boolean { return Boolean(this.child && this.child.exitCode === null); }
  get sanitizedOutput(): string { return safeOutput(this.output); }

  async start(command: LocalLaunchCommand, workspaceRoot: string, correlation: LaunchCorrelation): Promise<{ pid: number; approvalHash: string }> {
    if (this.active) throw new Error('LOCAL_APPLICATION_ALREADY_RUNNING');
    if (command.cwd !== '.') throw new Error('APPLICATION_LAUNCH_SCOPE_INVALID');
    const cwd = resolveWithinWorkspace(workspaceRoot, command.cwd);
    const packageJson = JSON.parse(fs.readFileSync(resolveWithinWorkspace(workspaceRoot, 'package.json'), 'utf8')) as { scripts?: Record<string, unknown> };
    if (typeof packageJson.scripts?.[command.scriptName] !== 'string') throw new Error('APPLICATION_LAUNCH_SCRIPT_STALE');
    const resolved = await resolveExecutable(command);
    this.output = '';
    const child = spawn(resolved.executable, resolved.args, {
      cwd,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        TELLANN_RELAY_ENDPOINT: correlation.endpoint,
        TELLANN_RUN_CREDENTIAL: correlation.relayToken,
        TELLANN_RUN_ID: correlation.runId,
        TELLANN_SESSION_ID: correlation.sessionId,
        TELLANN_TRACE_ID: correlation.traceId,
        TELLANN_APPLICATION_ID: correlation.applicationId,
        TELLANN_ENVIRONMENT_ID: correlation.environmentId,
        TELLANN_AGENT_VERSION: correlation.agentVersion,
      },
    });
    this.child = child;
    child.stdout?.on('data', (chunk) => { this.output = `${this.output}${String(chunk)}`.slice(-48_000); });
    child.stderr?.on('data', (chunk) => { this.output = `${this.output}${String(chunk)}`.slice(-48_000); });
    const earlyExit = await new Promise<number | null>((resolve) => {
      const timer = setTimeout(() => resolve(null), 750);
      child.once('exit', (code) => { clearTimeout(timer); resolve(code ?? 1); });
      child.once('error', () => { clearTimeout(timer); resolve(1); });
    });
    if (earlyExit !== null) {
      this.child = null;
      throw new Error(`LOCAL_APPLICATION_LAUNCH_FAILED:${earlyExit}:${this.sanitizedOutput}`);
    }
    if (!child.pid) throw new Error('LOCAL_APPLICATION_PID_MISSING');
    return { pid: child.pid, approvalHash: launchApprovalHash(command, workspaceRoot) };
  }

  async startPermanent(command: LocalLaunchCommand, workspaceRoot: string, environment: PermanentLaunchEnvironment): Promise<{ pid: number; approvalHash: string }> {
    if (this.active) throw new Error('LOCAL_APPLICATION_ALREADY_RUNNING');
    const cwd = resolveWithinWorkspace(workspaceRoot, command.cwd);
    const packageJson = JSON.parse(fs.readFileSync(resolveWithinWorkspace(cwd, 'package.json'), 'utf8')) as { scripts?: Record<string, unknown> };
    if (typeof packageJson.scripts?.[command.scriptName] !== 'string') throw new Error('APPLICATION_LAUNCH_SCRIPT_STALE');
    const resolved = await resolveExecutable(command);
    this.output = '';
    const child = spawn(resolved.executable, resolved.args, {
      cwd,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        TELLANN_GATEWAY_URL: environment.endpoint,
        TELLANN_INGESTION_KEY: environment.ingestionKey,
        TELLANN_APPLICATION_ID: environment.applicationId,
        TELLANN_ENVIRONMENT_ID: environment.environmentId,
        NEXT_PUBLIC_TELLANN_GATEWAY_URL: environment.endpoint,
        NEXT_PUBLIC_TELLANN_INGESTION_KEY: environment.ingestionKey,
        NEXT_PUBLIC_TELLANN_APPLICATION_ID: environment.applicationId,
        NEXT_PUBLIC_TELLANN_ENVIRONMENT_ID: environment.environmentId,
        VITE_TELLANN_GATEWAY_URL: environment.endpoint,
        VITE_TELLANN_INGESTION_KEY: environment.ingestionKey,
        VITE_TELLANN_APPLICATION_ID: environment.applicationId,
        VITE_TELLANN_ENVIRONMENT_ID: environment.environmentId,
      },
    });
    this.child = child;
    child.stdout?.on('data', (chunk) => { this.output = `${this.output}${String(chunk)}`.slice(-48_000); });
    child.stderr?.on('data', (chunk) => { this.output = `${this.output}${String(chunk)}`.slice(-48_000); });
    const earlyExit = await new Promise<number | null>((resolve) => {
      const timer = setTimeout(() => resolve(null), 750);
      child.once('exit', (code) => { clearTimeout(timer); resolve(code ?? 1); });
      child.once('error', () => { clearTimeout(timer); resolve(1); });
    });
    if (earlyExit !== null) {
      this.child = null;
      throw new Error(`LOCAL_APPLICATION_LAUNCH_FAILED:${earlyExit}:${this.sanitizedOutput}`);
    }
    if (!child.pid) throw new Error('LOCAL_APPLICATION_PID_MISSING');
    return { pid: child.pid, approvalHash: launchApprovalHash(command, workspaceRoot) };
  }

  async stop(): Promise<void> {
    const child = this.child;
    this.child = null;
    if (!child || child.exitCode !== null || !child.pid) return;
    if (process.platform === 'win32') {
      await new Promise<void>((resolve) => execFile('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true }, () => resolve()));
    } else {
      child.kill('SIGTERM');
    }
  }
}
