import fs from 'node:fs';
import path from 'node:path';
import type { BranchPolicy, QaBranchSwitchResult, WorkspaceCompliance } from '@tellann/desktop-contracts';
import { isSafeBranchName } from '@tellann/project-intelligence';
import { runGit, tryGit } from './git-exec';

export type QaBranchCheckpoint = {
  workspaceRoot: string;
  previousBranch: string | null;
  baseRevision: string | null;
  stashRef: string | null;
  switchedTo: string;
  createdAt: string;
};

async function repositoryRoot(root: string): Promise<string | null> {
  const toplevel = await tryGit(root, ['rev-parse', '--show-toplevel']);
  if (!toplevel) return null;
  try {
    return fs.realpathSync.native(toplevel);
  } catch {
    return null;
  }
}

/** The attached folder must BE the repository root, not a subdirectory of one. */
async function assertRepositoryRoot(workspaceRoot: string): Promise<string> {
  const resolved = fs.realpathSync.native(path.resolve(workspaceRoot));
  const toplevel = await repositoryRoot(resolved);
  if (!toplevel) throw new Error('WORKSPACE_IS_NOT_A_GIT_REPOSITORY');
  if (path.normalize(toplevel).toLowerCase() !== path.normalize(resolved).toLowerCase()) {
    throw new Error('WORKSPACE_IS_NOT_REPOSITORY_ROOT');
  }
  return resolved;
}

export async function currentBranch(workspaceRoot: string): Promise<string | null> {
  return (await tryGit(workspaceRoot, ['symbolic-ref', '--quiet', '--short', 'HEAD'])) || null;
}

export async function isDirty(workspaceRoot: string): Promise<boolean> {
  const status = await tryGit(workspaceRoot, ['status', '--porcelain=v1', '--untracked-files=normal']);
  return Boolean(status);
}

/**
 * Decides whether one member's checkout satisfies the shared QA branch policy.
 *
 * Deliberately evaluated on-device so it still answers while offline, and
 * deliberately conservative: an unknown answer is never reported as a violation,
 * because blocking someone's run on a failed git call would be worse than
 * letting a non-compliant run through and flagging it on the next scan.
 */
export async function evaluateCompliance(input: {
  workspaceRoot: string;
  policy: BranchPolicy | null;
  agentCheckoutGranted: boolean;
  aheadCount?: number | null;
  behindCount?: number | null;
}): Promise<WorkspaceCompliance> {
  const { policy } = input;
  const base = {
    policy,
    aheadCount: input.aheadCount ?? null,
    behindCount: input.behindCount ?? null,
    agentCheckoutAllowed: Boolean(policy?.allowAgentCheckout),
    agentCheckoutGranted: input.agentCheckoutGranted,
  };

  if (!policy || !policy.bound) {
    return {
      ...base,
      status: 'NO_POLICY',
      currentBranch: null,
      requiredBranch: policy?.qaBranchName ?? null,
      dirty: false,
      blocksRun: false,
      message: 'No QA review branch is configured for this application yet.',
    };
  }

  let resolvedRoot: string;
  try {
    resolvedRoot = await assertRepositoryRoot(input.workspaceRoot);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return {
      ...base,
      status: 'NOT_A_REPOSITORY',
      currentBranch: null,
      requiredBranch: policy.qaBranchName,
      dirty: false,
      // A folder that is not a repository root cannot be put on a branch, so
      // blocking would leave the member with no way forward from inside Tellann.
      blocksRun: false,
      message: reason === 'WORKSPACE_IS_NOT_REPOSITORY_ROOT'
        ? 'This folder sits inside a Git repository rather than at its root. Attach the repository root to enforce the QA review branch.'
        : 'This folder is not a Git repository, so the QA review branch cannot be enforced.',
    };
  }

  const branch = await currentBranch(resolvedRoot);
  const dirty = await isDirty(resolvedRoot);

  if (branch === null) {
    return {
      ...base,
      status: 'UNKNOWN',
      currentBranch: null,
      requiredBranch: policy.qaBranchName,
      dirty,
      blocksRun: false,
      message: 'This repository has a detached HEAD, so its branch could not be determined.',
    };
  }

  if (branch === policy.qaBranchName) {
    const behind = base.behindCount;
    const drift = behind && behind > 0
      ? ` You are ${behind} commit${behind === 1 ? '' : 's'} behind the shared QA branch.`
      : '';
    return {
      ...base,
      status: 'COMPLIANT',
      currentBranch: branch,
      requiredBranch: policy.qaBranchName,
      dirty,
      blocksRun: false,
      message: `On the QA review branch ${policy.qaBranchName}.${drift}`,
    };
  }

  return {
    ...base,
    status: 'BRANCH_MISMATCH',
    currentBranch: branch,
    requiredBranch: policy.qaBranchName,
    dirty,
    blocksRun: policy.enforcement === 'BLOCK',
    message: `This workspace is on "${branch}" but QA work for this application must happen on "${policy.qaBranchName}".`,
  };
}

function stashMessage(now: Date): string {
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  return `tellann/qa-autostash-${stamp}`;
}

/**
 * Moves the workspace onto the QA review branch.
 *
 * Rules that make this safe to hand to an agent: uncommitted work is stashed and
 * the stash ref is returned so it is recoverable, never discarded; nothing is
 * force-checked-out, reset, deleted, or pushed; and a failed fetch degrades to a
 * local-only switch rather than aborting.
 */
export async function switchToQaBranch(
  workspaceRoot: string,
  policy: BranchPolicy,
): Promise<{ result: QaBranchSwitchResult; checkpoint: QaBranchCheckpoint | null }> {
  const failed = (reason: string): { result: QaBranchSwitchResult; checkpoint: null } => ({
    result: {
      switched: false, branch: null, previousBranch: null, baseRevision: null,
      stashRef: null, createdBranch: false, fetched: false, reason,
    },
    checkpoint: null,
  });

  if (!isSafeBranchName(policy.qaBranchName)) return failed('UNSAFE_QA_BRANCH_NAME');
  if (policy.qaBranchBase && !isSafeBranchName(policy.qaBranchBase)) return failed('UNSAFE_QA_BASE_BRANCH_NAME');

  let root: string;
  try {
    root = await assertRepositoryRoot(workspaceRoot);
  } catch (error) {
    return failed(error instanceof Error ? error.message : String(error));
  }

  const previousBranch = await currentBranch(root);
  if (previousBranch === policy.qaBranchName) {
    return {
      result: {
        switched: false, branch: policy.qaBranchName, previousBranch, baseRevision: null,
        stashRef: null, createdBranch: false, fetched: false, reason: 'ALREADY_ON_QA_BRANCH',
      },
      checkpoint: null,
    };
  }

  const baseRevision = await tryGit(root, ['rev-parse', 'HEAD']);

  // Stash before anything else: a switch that would overwrite local work must
  // never be attempted, and the ref is recorded so the member can get it back.
  let stashRef: string | null = null;
  if (await isDirty(root)) {
    const label = stashMessage(new Date());
    const stashed = await tryGit(root, ['stash', 'push', '--include-untracked', '--message', label]);
    if (stashed === null) return failed('STASH_FAILED_LOCAL_CHANGES_PRESERVED');
    stashRef = (await tryGit(root, ['rev-parse', 'stash@{0}'])) ?? label;
  }

  const fetched = (await tryGit(root, ['fetch', '--quiet', 'origin', policy.qaBranchName])) !== null;

  const localRef = `refs/heads/${policy.qaBranchName}`;
  const remoteRef = `refs/remotes/origin/${policy.qaBranchName}`;
  const localExists = (await tryGit(root, ['rev-parse', '--verify', '--quiet', localRef])) !== null;
  const remoteExists = (await tryGit(root, ['rev-parse', '--verify', '--quiet', remoteRef])) !== null;

  let createdBranch = false;
  try {
    if (localExists) {
      await runGit(root, ['switch', '--', policy.qaBranchName]);
    } else if (remoteExists) {
      await runGit(root, ['switch', '--create', policy.qaBranchName, '--track', `origin/${policy.qaBranchName}`]);
      createdBranch = true;
    } else {
      const baseRef = `refs/remotes/origin/${policy.qaBranchBase}`;
      const baseTracked = Boolean(policy.qaBranchBase)
        && (await tryGit(root, ['rev-parse', '--verify', '--quiet', baseRef])) !== null;
      const startPoint = baseTracked ? `origin/${policy.qaBranchBase}` : 'HEAD';
      await runGit(root, ['switch', '--create', policy.qaBranchName, startPoint]);
      createdBranch = true;
    }
  } catch (error) {
    // The switch failed, so restore the member's uncommitted work immediately
    // rather than leaving it parked in a stash they did not ask for.
    if (stashRef) await tryGit(root, ['stash', 'pop']);
    const message = error instanceof Error ? error.message : String(error);
    return failed(`SWITCH_FAILED:${message.slice(0, 300)}`);
  }

  return {
    result: {
      switched: true,
      branch: policy.qaBranchName,
      previousBranch,
      baseRevision,
      stashRef,
      createdBranch,
      fetched,
      reason: null,
    },
    checkpoint: {
      workspaceRoot: root,
      previousBranch,
      baseRevision,
      stashRef,
      switchedTo: policy.qaBranchName,
      createdAt: new Date().toISOString(),
    },
  };
}

/** Undoes a switchToQaBranch: back to the previous branch, stash reapplied. */
export async function restoreWorkspaceBranch(checkpoint: QaBranchCheckpoint): Promise<{
  restored: boolean;
  branch: string | null;
  stashRestored: boolean;
  reason: string | null;
}> {
  const { previousBranch } = checkpoint;
  if (!previousBranch || !isSafeBranchName(previousBranch)) {
    return { restored: false, branch: null, stashRestored: false, reason: 'NO_PREVIOUS_BRANCH_RECORDED' };
  }

  let root: string;
  try {
    root = await assertRepositoryRoot(checkpoint.workspaceRoot);
  } catch (error) {
    return {
      restored: false, branch: null, stashRestored: false,
      reason: error instanceof Error ? error.message : String(error),
    };
  }

  // Refuse rather than clobber: work created since the switch is not ours to move.
  if (await isDirty(root)) {
    return {
      restored: false, branch: null, stashRestored: false,
      reason: 'WORKSPACE_HAS_UNCOMMITTED_CHANGES',
    };
  }

  try {
    await runGit(root, ['switch', '--', previousBranch]);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { restored: false, branch: null, stashRestored: false, reason: `SWITCH_FAILED:${message.slice(0, 300)}` };
  }

  const stashRestored = checkpoint.stashRef
    ? (await tryGit(root, ['stash', 'pop'])) !== null
    : false;

  return { restored: true, branch: previousBranch, stashRestored, reason: null };
}
