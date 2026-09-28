import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { ExecutionProfileSchema, type ExecutionProfile } from '@tellann/desktop-contracts';
import type { LocalLaunchCommand } from '../application-launcher';
import { approveProfile, executionProfileHash, isProfileApproved, proposeExecutionProfiles } from './execution-profile';

const APP_ID = '11111111-1111-4111-8111-111111111111';

const cmd = (scriptName: string, id = `package-script:${scriptName}`): LocalLaunchCommand =>
  ({ id, label: `npm run ${scriptName}`, executable: 'npm', args: ['run', scriptName], cwd: '.', scriptName });

const profile = (overrides: Partial<ExecutionProfile> = {}): ExecutionProfile => ({
  id: 'p1', applicationId: APP_ID, name: 'Dev', applicationUrl: 'http://localhost:5173/',
  processes: [{ name: 'web', launchCommandId: 'package-script:dev', readyCondition: { type: 'HTTP', url: 'http://localhost:5173/' }, readyTimeoutMs: 60_000 }],
  approvedHash: null, approvedAt: null,
  ...overrides,
});

const workspace = () => fs.mkdtempSync(path.join(os.tmpdir(), 'tellann-profile-'));

test('approval is a hash of what will actually run', () => {
  const root = workspace();
  const commands = [cmd('dev')];
  const hash = executionProfileHash(profile(), commands, root);
  assert.match(hash, /^[0-9a-f]{64}$/);
  assert.equal(executionProfileHash(profile(), commands, root), hash, 'stable');
});

test('anything that changes what runs invalidates the approval', () => {
  const root = workspace();
  const commands = [cmd('dev')];
  const approved = approveProfile(profile(), commands, root);
  assert.equal(isProfileApproved(approved, commands, root), true);

  // The command line behind the same id changed.
  assert.equal(isProfileApproved(approved, [{ ...cmd('dev'), args: ['run', 'dev', '--host'] }], root), false, 'args');
  assert.equal(isProfileApproved(approved, [{ ...cmd('dev'), executable: 'pnpm' }], root), false, 'executable');
  // Readiness, URL and timeouts are part of what was approved.
  assert.equal(isProfileApproved({ ...approved, applicationUrl: 'http://localhost:9999/' }, commands, root), false, 'url');
  assert.equal(isProfileApproved({ ...approved, processes: [{ ...approved.processes[0]!, readyTimeoutMs: 5_000 }] }, commands, root), false, 'timeout');
  assert.equal(isProfileApproved({ ...approved, processes: [{ ...approved.processes[0]!, readyCondition: { type: 'PORT', port: 5173 } }] }, commands, root), false, 'readiness');
  // A different checkout.
  assert.equal(isProfileApproved(approved, commands, workspace()), false, 'workspace');
});

test('an unapproved profile, or one whose command is gone, is not approved', () => {
  const root = workspace();
  assert.equal(isProfileApproved(profile(), [cmd('dev')], root), false);
  const approved = approveProfile(profile(), [cmd('dev')], root);
  assert.equal(isProfileApproved(approved, [], root), false, 'the script was removed');
  assert.throws(() => approveProfile(profile(), [], root), /no longer in this workspace/);
});

test('a profile that runs nothing is valid: it targets an application that is already up', () => {
  assert.equal(ExecutionProfileSchema.safeParse(profile({ processes: [] })).success, true);
  const root = workspace();
  const approved = approveProfile(profile({ processes: [] }), [], root);
  assert.equal(isProfileApproved(approved, [], root), true);
});

test('profile validation rejects duplicate process names and credentialed URLs', () => {
  const p = profile();
  const duplicated = { ...p, processes: [p.processes[0]!, p.processes[0]!] };
  assert.equal(ExecutionProfileSchema.safeParse(duplicated).success, false);
  assert.equal(ExecutionProfileSchema.safeParse(profile({ applicationUrl: 'http://user:pw@localhost:3000/' })).success, false);
  assert.equal(ExecutionProfileSchema.safeParse(profile({ applicationUrl: 'ftp://localhost/' })).success, false);
});

test('proposals prefer dev over start, wait on the most likely URL, and are never pre-approved', () => {
  const proposals = proposeExecutionProfiles({
    applicationId: APP_ID,
    launchCommands: [cmd('start'), cmd('preview'), cmd('dev')],
    suggestedApplicationUrls: [
      { url: 'http://localhost:3000/', confidence: 0.4, source: 'default' },
      { url: 'http://localhost:5173/', confidence: 0.9, source: 'vite.config.ts' },
    ],
  });
  assert.deepEqual(proposals.map((p) => p.profile.processes[0]!.launchCommandId), ['package-script:dev', 'package-script:start', 'package-script:preview']);
  for (const proposal of proposals) {
    assert.equal(proposal.profile.applicationUrl, 'http://localhost:5173/');
    assert.equal(proposal.profile.approvedHash, null);
    assert.equal(ExecutionProfileSchema.safeParse(proposal.profile).success, true);
  }
  assert.match(proposals[0]!.rationale, /vite\.config\.ts/);
});

test('with no URL to wait on there is nothing to propose, rather than a guess', () => {
  assert.deepEqual(proposeExecutionProfiles({ applicationId: APP_ID, launchCommands: [cmd('dev')], suggestedApplicationUrls: [] }), []);
});
