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

function branchName(now: Date): string {
  const timestamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  return `tellann/instrument-${timestamp}-${crypto.randomBytes(3).toString('hex')}`;
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

export async function createInstrumentationCheckpoint(workspaceRoot: string): Promise<InstrumentationCheckpoint> {
  const root = fs.realpathSync.native(path.resolve(workspaceRoot));
  try {
    const repositoryRoot = fs.realpathSync.native(await git(root, ['rev-parse', '--show-toplevel']));
    if (path.normalize(repositoryRoot).toLowerCase() !== path.normalize(root).toLowerCase()) {
      return local('WORKSPACE_IS_NOT_REPOSITORY_ROOT');
    }
    const baseRevision = await git(root, ['rev-parse', 'HEAD']);
    const previousBranch = (await git(root, ['symbolic-ref', '--quiet', '--short', 'HEAD']).catch(() => '')) || null;
    const dirty = Boolean(await git(root, ['status', '--porcelain=v1', '--untracked-files=normal']));
    const branch = branchName(new Date());
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

