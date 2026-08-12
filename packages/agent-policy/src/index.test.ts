import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { assertEnvironmentActionAllowed, resolveWithinWorkspace, validateStructuredCommand } from './index';

test('allows a nested not-yet-created path under the approved workspace', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tellann-policy-'));
  assert.equal(resolveWithinWorkspace(root, 'src/generated/tellann.ts'), path.join(root, 'src/generated/tellann.ts'));
});

test('rejects traversal through an existing ancestor outside the workspace', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tellann-policy-'));
  assert.throws(() => resolveWithinWorkspace(root, '..\\outside\\file.ts'), /PATH_OUTSIDE_WORKSPACE/);
});

test('rejects a Windows junction that resolves outside the approved workspace', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tellann-policy-'));
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'tellann-outside-'));
  const junction = path.join(root, 'linked-outside');
  fs.symlinkSync(outside, junction, 'junction');
  assert.throws(() => resolveWithinWorkspace(root, 'linked-outside/file.ts'), /PATH_OUTSIDE_WORKSPACE/);
});

test('structured commands reject shell executables even when an absolute path is supplied', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tellann-policy-'));
  assert.throws(() => validateStructuredCommand({
    executable: 'C:\\Windows\\System32\\cmd.exe', args: ['/c', 'echo unsafe'], cwd: root,
    timeoutMs: 10_000, allowedEnvironmentKeys: [],
  }, root), /SHELL_EXECUTION_NOT_ALLOWED/);
  assert.throws(() => validateStructuredCommand({
    executable: 'npm.cmd', args: ['run', 'build\r\nwhoami'], cwd: root,
    timeoutMs: 10_000, allowedEnvironmentKeys: [],
  }, root), /INVALID_COMMAND_ARGUMENT/);
});

test('structured commands enforce timeout, working directory, and environment allowlists', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tellann-policy-'));
  const valid = { executable: 'npm.cmd', args: ['run', 'build'], cwd: root, timeoutMs: 10_000, allowedEnvironmentKeys: ['CI', 'NODE_ENV'] };
  assert.deepEqual(validateStructuredCommand(valid, root), valid);
  assert.throws(() => validateStructuredCommand({ ...valid, timeoutMs: 50 }, root), /INVALID_COMMAND_TIMEOUT/);
  assert.throws(() => validateStructuredCommand({ ...valid, cwd: path.dirname(root) }, root), /PATH_OUTSIDE_WORKSPACE/);
  assert.throws(() => validateStructuredCommand({ ...valid, allowedEnvironmentKeys: ['NODE_ENV=production'] }, root), /INVALID_ENVIRONMENT_ALLOWLIST/);
});

test('production permits observation but blocks launch, interaction, and instrumentation', () => {
  assert.doesNotThrow(() => assertEnvironmentActionAllowed('PRODUCTION', 'OBSERVE'));
  for (const action of ['LAUNCH_PROCESS', 'INTERACT', 'INSTRUMENT'] as const) {
    assert.throws(() => assertEnvironmentActionAllowed('PRODUCTION', action), /PRODUCTION_OBSERVATION_ONLY/);
  }
});
