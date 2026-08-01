import path from 'node:path';
import fs from 'node:fs';

export type StructuredCommand = {
  executable: string;
  args: string[];
  cwd: string;
  timeoutMs: number;
  allowedEnvironmentKeys: string[];
};

const PROHIBITED_EXECUTABLES = new Set(['cmd', 'cmd.exe', 'powershell', 'powershell.exe', 'pwsh', 'bash', 'sh']);

export function resolveWithinWorkspace(workspaceRoot: string, candidate: string): string {
  const root = fs.realpathSync.native(workspaceRoot);
  const absolute = path.resolve(root, candidate);
  const existingParent = fs.existsSync(absolute)
    ? fs.realpathSync.native(absolute)
    : fs.realpathSync.native(path.dirname(absolute));
  const relative = path.relative(root, existingParent);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('PATH_OUTSIDE_WORKSPACE');
  }
  return absolute;
}

export function validateStructuredCommand(command: StructuredCommand, workspaceRoot: string): StructuredCommand {
  if (!command.executable || PROHIBITED_EXECUTABLES.has(command.executable.toLowerCase())) {
    throw new Error('SHELL_EXECUTION_NOT_ALLOWED');
  }
  if (!Number.isFinite(command.timeoutMs) || command.timeoutMs < 1_000 || command.timeoutMs > 30 * 60_000) {
    throw new Error('INVALID_COMMAND_TIMEOUT');
  }
  resolveWithinWorkspace(workspaceRoot, command.cwd);
  if (command.args.some((arg) => arg.includes('\0') || /[\r\n]/.test(arg))) {
    throw new Error('INVALID_COMMAND_ARGUMENT');
  }
  return command;
}

export function assertEnvironmentActionAllowed(
  environmentType: 'DEVELOPMENT' | 'STAGING' | 'PRODUCTION',
  action: 'OBSERVE' | 'LAUNCH_PROCESS' | 'INTERACT' | 'INSTRUMENT',
): void {
  if (environmentType === 'PRODUCTION' && action !== 'OBSERVE') {
    throw new Error('PRODUCTION_OBSERVATION_ONLY');
  }
}
