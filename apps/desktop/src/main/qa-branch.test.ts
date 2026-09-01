import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import type { BranchPolicy } from '@tellann/desktop-contracts';
import { evaluateCompliance, restoreWorkspaceBranch, switchToQaBranch } from './qa-branch';

function git(root: string, ...args: string[]) {
  return execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', windowsHide: true }).trim();
}

function fixture(): string {
  const root = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'tellann-qa-branch-')));
  git(root, 'init');
  git(root, 'config', 'user.email', 'test@tellann.local');
  git(root, 'config', 'user.name', 'Tellann Test');
  fs.writeFileSync(path.join(root, 'tracked.txt'), 'original');
  git(root, 'add', 'tracked.txt');
  git(root, 'commit', '-m', 'fixture');
  return root;
}

const policy = (overrides: Partial<BranchPolicy> = {}): BranchPolicy => ({
  applicationId: '00000000-0000-4000-8000-000000000000',
  repositoryOriginHash: null,
  repositoryCloneUrl: null,
  qaBranchName: 'tellann/qa-review',
  qaBranchBase: 'main',
  enforcement: 'WARN',
  allowAgentCheckout: true,
  bound: true,
  ...overrides,
});

test('reports a mismatch when the member is off the QA review branch, and blocks only under BLOCK', async () => {
  const root = fixture();

  const warned = await evaluateCompliance({
    workspaceRoot: root,
    policy: policy(),
    agentCheckoutGranted: false,
  });
  assert.equal(warned.status, 'BRANCH_MISMATCH');
  assert.equal(warned.requiredBranch, 'tellann/qa-review');
  assert.equal(warned.blocksRun, false);

  const blocked = await evaluateCompliance({
    workspaceRoot: root,
    policy: policy({ enforcement: 'BLOCK' }),
    agentCheckoutGranted: false,
  });
  assert.equal(blocked.blocksRun, true);
});

test('an unbound policy is never reported as a violation', async () => {
  const root = fixture();
  const compliance = await evaluateCompliance({
    workspaceRoot: root,
    policy: policy({ bound: false }),
    agentCheckoutGranted: false,
  });
  assert.equal(compliance.status, 'NO_POLICY');
  assert.equal(compliance.blocksRun, false);
});

test('a folder that is not a repository root is flagged but never blocks the member', async () => {
  const root = fixture();
  fs.mkdirSync(path.join(root, 'packages', 'app'), { recursive: true });

  const compliance = await evaluateCompliance({
    workspaceRoot: path.join(root, 'packages', 'app'),
    policy: policy({ enforcement: 'BLOCK' }),
    agentCheckoutGranted: false,
  });
  assert.equal(compliance.status, 'NOT_A_REPOSITORY');
  assert.equal(compliance.blocksRun, false);
});

test('switching to the QA branch stashes uncommitted work rather than discarding it', async () => {
  const root = fixture();
  const previousBranch = git(root, 'branch', '--show-current');
  fs.writeFileSync(path.join(root, 'tracked.txt'), 'dirty user change');
  fs.writeFileSync(path.join(root, 'untracked.txt'), 'keep me');

  const { result, checkpoint } = await switchToQaBranch(root, policy());

  assert.equal(result.switched, true);
  assert.equal(result.branch, 'tellann/qa-review');
  assert.equal(result.previousBranch, previousBranch);
  assert.equal(result.createdBranch, true);
  assert.ok(result.stashRef, 'a stash ref must be recorded so the work is recoverable');
  assert.equal(git(root, 'branch', '--show-current'), 'tellann/qa-review');

  // The switch is clean, and nothing the member had was destroyed.
  assert.equal(fs.readFileSync(path.join(root, 'tracked.txt'), 'utf8'), 'original');
  assert.match(git(root, 'stash', 'list'), /tellann\/qa-autostash-/);

  // ...and the recorded checkpoint takes them all the way back.
  assert.ok(checkpoint);
  const restored = await restoreWorkspaceBranch(checkpoint!);
  assert.equal(restored.restored, true);
  assert.equal(restored.branch, previousBranch);
  assert.equal(restored.stashRestored, true);
  assert.equal(git(root, 'branch', '--show-current'), previousBranch);
  assert.equal(fs.readFileSync(path.join(root, 'tracked.txt'), 'utf8'), 'dirty user change');
  assert.equal(fs.readFileSync(path.join(root, 'untracked.txt'), 'utf8'), 'keep me');
});

test('a clean workspace already on the QA branch is compliant and switching is a no-op', async () => {
  const root = fixture();
  await switchToQaBranch(root, policy());

  const compliance = await evaluateCompliance({
    workspaceRoot: root,
    policy: policy({ enforcement: 'BLOCK' }),
    agentCheckoutGranted: true,
  });
  assert.equal(compliance.status, 'COMPLIANT');
  assert.equal(compliance.blocksRun, false);

  const again = await switchToQaBranch(root, policy());
  assert.equal(again.result.switched, false);
  assert.equal(again.result.reason, 'ALREADY_ON_QA_BRANCH');
});

test('a branch name that git would read as an option is refused', async () => {
  const root = fixture();
  const { result } = await switchToQaBranch(root, policy({ qaBranchName: '--upload-pack=touch owned' }));
  assert.equal(result.switched, false);
  assert.equal(result.reason, 'UNSAFE_QA_BRANCH_NAME');
  assert.doesNotMatch(git(root, 'branch', '--show-current'), /upload-pack/);
});
