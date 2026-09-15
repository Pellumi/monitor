import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/**
 * The Git state a workspace was in when Tellann applied instrumentation.
 *
 * `GIT_BRANCH` means the branch and revision the changes were applied on were
 * recorded; `LOCAL` means Git state could not be read. Either way, undoing the
 * change restores files from the adapter's own file checkpoint, not from Git.
 */
export type InstrumentationCheckpoint = {
  kind: 'GIT_BRANCH' | 'LOCAL';
  /** The branch the changes were applied on (null on a detached HEAD). */
  branch: string | null;
  /** Kept for the patch record; equal to `branch`, since nothing is switched. */
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

/**
 * Records where instrumentation is about to be applied. It deliberately never
 * creates or switches a branch: QA work for an application happens on its QA
 * review branch, and moving the workspace to a per-run branch would take the
 * member off it (and fail the branch policy) the moment setup finished.
 */
export async function createInstrumentationCheckpoint(
  workspaceRoot: string,
): Promise<InstrumentationCheckpoint> {
  const root = fs.realpathSync.native(path.resolve(workspaceRoot));
  try {
    const repositoryRoot = fs.realpathSync.native(await git(root, ['rev-parse', '--show-toplevel']));
    if (path.normalize(repositoryRoot).toLowerCase() !== path.normalize(root).toLowerCase()) {
      return local('WORKSPACE_IS_NOT_REPOSITORY_ROOT');
    }
    const baseRevision = await git(root, ['rev-parse', 'HEAD']);
    const branch = (await git(root, ['symbolic-ref', '--quiet', '--short', 'HEAD']).catch(() => '')) || null;
    const dirty = Boolean(await git(root, ['status', '--porcelain=v1', '--untracked-files=normal']));
    return {
      kind: 'GIT_BRANCH',
      branch,
      previousBranch: branch,
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

