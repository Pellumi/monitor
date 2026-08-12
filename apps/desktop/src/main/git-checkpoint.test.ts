import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { createInstrumentationCheckpoint } from './git-checkpoint';

function git(root: string, ...args: string[]) {
  return execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', windowsHide: true }).trim();
}

test('creates a bounded Tellann branch while preserving dirty workspace changes', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tellann-git-checkpoint-'));
  git(root, 'init');
  git(root, 'config', 'user.email', 'test@tellann.local');
  git(root, 'config', 'user.name', 'Tellann Test');
  fs.writeFileSync(path.join(root, 'tracked.txt'), 'original');
  git(root, 'add', 'tracked.txt');
  git(root, 'commit', '-m', 'fixture');
  const previousBranch = git(root, 'branch', '--show-current');
  fs.writeFileSync(path.join(root, 'tracked.txt'), 'dirty user change');
  fs.writeFileSync(path.join(root, 'untracked.txt'), 'keep me');

  const checkpoint = await createInstrumentationCheckpoint(root);

  assert.equal(checkpoint.kind, 'GIT_BRANCH');
  assert.equal(checkpoint.previousBranch, previousBranch);
  assert.equal(checkpoint.dirty, true);
  assert.match(checkpoint.branch ?? '', /^tellann\/instrument-/);
  assert.equal(git(root, 'branch', '--show-current'), checkpoint.branch);
  assert.equal(fs.readFileSync(path.join(root, 'tracked.txt'), 'utf8'), 'dirty user change');
  assert.equal(fs.readFileSync(path.join(root, 'untracked.txt'), 'utf8'), 'keep me');
});

test('uses a local checkpoint when the approved workspace is only a repository subdirectory', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tellann-git-checkpoint-'));
  git(root, 'init');
  git(root, 'config', 'user.email', 'test@tellann.local');
  git(root, 'config', 'user.name', 'Tellann Test');
  fs.writeFileSync(path.join(root, 'tracked.txt'), 'original');
  fs.mkdirSync(path.join(root, 'packages', 'app'), { recursive: true });
  git(root, 'add', '.');
  git(root, 'commit', '-m', 'fixture');

  const checkpoint = await createInstrumentationCheckpoint(path.join(root, 'packages', 'app'));

  assert.equal(checkpoint.kind, 'LOCAL');
  assert.equal(checkpoint.reason, 'WORKSPACE_IS_NOT_REPOSITORY_ROOT');
  assert.doesNotMatch(git(root, 'branch', '--show-current'), /^tellann\/instrument-/);
});

