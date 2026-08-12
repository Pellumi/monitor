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
  let existingAncestor = absolute;
  while (!fs.existsSync(existingAncestor)) {
    const parent = path.dirname(existingAncestor);
    if (parent === existingAncestor) throw new Error('PATH_OUTSIDE_WORKSPACE');
    existingAncestor = parent;
  }
  const canonicalAncestor = fs.realpathSync.native(existingAncestor);
  const relative = path.relative(root, canonicalAncestor);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('PATH_OUTSIDE_WORKSPACE');
  }
  return absolute;
}

export function validateStructuredCommand(command: StructuredCommand, workspaceRoot: string): StructuredCommand {
  const executable = command.executable.trim();
  const executableName = path.basename(executable).toLowerCase();
  if (!executable || /[\0\r\n]/.test(executable) || PROHIBITED_EXECUTABLES.has(executableName)) {
    throw new Error('SHELL_EXECUTION_NOT_ALLOWED');
  }
  if (!Number.isFinite(command.timeoutMs) || command.timeoutMs < 1_000 || command.timeoutMs > 30 * 60_000) {
    throw new Error('INVALID_COMMAND_TIMEOUT');
  }
  resolveWithinWorkspace(workspaceRoot, command.cwd);
  if (command.args.length > 1_000 || command.args.some((arg) => arg.length > 32_768 || arg.includes('\0') || /[\r\n]/.test(arg))) {
    throw new Error('INVALID_COMMAND_ARGUMENT');
  }
  if (new Set(command.allowedEnvironmentKeys).size !== command.allowedEnvironmentKeys.length
    || command.allowedEnvironmentKeys.some((key) => !/^[A-Za-z_][A-Za-z0-9_]*$/.test(key))) {
    throw new Error('INVALID_ENVIRONMENT_ALLOWLIST');
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
