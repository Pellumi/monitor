import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export type InstrumentationCheckpoint = {
  kind: 'GIT_BRANCH' | 'LOCAL';
  branch: string | null;
  previousBranch: string | null;
  baseRevision: string | null;
  dirty: boolean;
  reason: string | null;
  createdAt: string;
};

async function git(root: string, args: string[]): Promise<string> {
  const result = await execFileAsync('git', ['-C', root, ...args], {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 15_000,
    maxBuffer: 1024 * 1024,
    env: {
      PATH: process.env.PATH,
      SystemRoot: process.env.SystemRoot,
      WINDIR: process.env.WINDIR,
      HOME: process.env.HOME,
      USERPROFILE: process.env.USERPROFILE,
    },
  });
  return String(result.stdout ?? '').trim();
}

// Instrumentation branches live under the QA review branch when the application
// has one, so a run cannot quietly escape the branch policy into an unrelated
// namespace. Falls back to the flat name when no policy applies.
function branchName(now: Date, qaBranchName?: string | null): string {
  const timestamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const suffix = `instrument-${timestamp}-${crypto.randomBytes(3).toString('hex')}`;
  const prefix = qaBranchName && /^(?!-)(?!.*\.\.)[A-Za-z0-9._\/-]{1,200}$/.test(qaBranchName)
    ? qaBranchName
    : 'tellann';
  return `${prefix}/${suffix}`;
}

function local(reason: string, details?: Partial<InstrumentationCheckpoint>): InstrumentationCheckpoint {
  return {
    kind: 'LOCAL',
    branch: null,
    previousBranch: null,
    baseRevision: null,
    dirty: false,
    reason,
    createdAt: new Date().toISOString(),
    ...details,
  };
}

export async function createInstrumentationCheckpoint(
  workspaceRoot: string,
  qaBranchName?: string | null,
): Promise<InstrumentationCheckpoint> {
  const root = fs.realpathSync.native(path.resolve(workspaceRoot));
  try {
    const repositoryRoot = fs.realpathSync.native(await git(root, ['rev-parse', '--show-toplevel']));
    if (path.normalize(repositoryRoot).toLowerCase() !== path.normalize(root).toLowerCase()) {
      return local('WORKSPACE_IS_NOT_REPOSITORY_ROOT');
    }
    const baseRevision = await git(root, ['rev-parse', 'HEAD']);
    const previousBranch = (await git(root, ['symbolic-ref', '--quiet', '--short', 'HEAD']).catch(() => '')) || null;
    const dirty = Boolean(await git(root, ['status', '--porcelain=v1', '--untracked-files=normal']));
    const branch = branchName(new Date(), qaBranchName);
    await git(root, ['switch', '-c', branch]);
    return {
      kind: 'GIT_BRANCH',
      branch,
      previousBranch,
      baseRevision,
      dirty,
      reason: null,
      createdAt: new Date().toISOString(),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return local(`GIT_CHECKPOINT_UNAVAILABLE:${message.slice(0, 300)}`);
  }
}

