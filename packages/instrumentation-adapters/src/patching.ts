import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { resolveWithinWorkspace } from '@tellann/agent-policy';
import {
  currentGitRevision,
  fileHash,
  hash,
  validateInstrumentationPlan,
  type ApprovedInstrumentationTask,
  type FrameworkId,
  type InstrumentationPlan,
  type LocalProjectContext,
  type PatchFileResult,
  type PatchResult,
  type RollbackResult,
} from './contracts';

/**
 * The safety envelope around applying an instrumentation plan.
 *
 * Every adapter - whichever language it writes - has to make the same
 * promises: nothing is written to a production environment, nothing is written
 * outside the files the user approved, nothing is written if the repository
 * moved under the plan, and whatever is written can be put back. Those checks
 * live here in one copy, because two copies of a security check are one copy
 * and one liability: a fix applied to the adapter someone happened to be
 * editing would silently leave the other one wrong.
 *
 * What differs between adapters - how a dependency is declared, how a module
 * is generated, how a call is inserted - stays in the adapter, between
 * `beginPatch` and `finalizePatch`.
 */

export type PatchSession = {
  plan: InstrumentationPlan;
  checkpointId: string;
  checkpointRoot: string;
  /** Contents of every touched file before anything was written. */
  before: Map<string, string | null>;
};

/**
 * Validate a plan against the workspace and back up every file it touches.
 *
 * Throws before writing anything if any check fails, so a refused plan leaves
 * the working tree exactly as it was.
 */
export function beginPatch(
  input: LocalProjectContext,
  task: ApprovedInstrumentationTask,
  adapterId: FrameworkId,
): PatchSession {
  if (input.environmentType === 'PRODUCTION') throw new Error('PRODUCTION_OBSERVATION_ONLY');
  const plan = validateInstrumentationPlan(task.plan);
  if (plan.adapterId !== adapterId) throw new Error('ADAPTER_PLAN_MISMATCH');
  if (
    plan.repositoryFingerprint !== input.snapshot.repositoryFingerprint
    || plan.baseRevision !== input.snapshot.revision
  ) throw new Error('STALE_INSTRUMENTATION_PLAN');
  if (plan.baseRevision && currentGitRevision(input.workspaceRoot) !== plan.baseRevision) {
    throw new Error('STALE_INSTRUMENTATION_BASE_REVISION');
  }

  const approved = new Set(task.approvedFileScopes);
  if (plan.operations.some((operation) =>
    !approved.has(operation.relativePath) || !plan.approvedFileScopes.includes(operation.relativePath))) {
    throw new Error('TASK_SCOPE_EXPANSION_DENIED');
  }
  const expectedApprovalHash = hash(JSON.stringify({
    planId: plan.id,
    taskKey: plan.taskKey,
    files: [...approved].sort(),
    commands: [...task.approvedCommandIds].sort(),
  }));
  if (task.approvalHash !== expectedApprovalHash) throw new Error('INVALID_TASK_APPROVAL');
  for (const operation of plan.operations) {
    if (fileHash(input.workspaceRoot, operation.relativePath) !== operation.expectedHash) {
      throw new Error(`STALE_TARGET_FILE:${operation.relativePath}`);
    }
  }

  fs.mkdirSync(task.checkpointDirectory, { recursive: true });
  const checkpointId = crypto.randomUUID();
  const checkpointRoot = path.join(task.checkpointDirectory, checkpointId);
  fs.mkdirSync(checkpointRoot, { recursive: true });

  const before = new Map<string, string | null>();
  for (const operation of plan.operations) {
    const target = resolveWithinWorkspace(input.workspaceRoot, operation.relativePath);
    const original = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : null;
    before.set(operation.relativePath, original);
    const backupTarget = path.join(checkpointRoot, operation.relativePath.replaceAll('/', path.sep));
    fs.mkdirSync(path.dirname(backupTarget), { recursive: true });
    // A file that did not exist is recorded as absent, so rolling back removes
    // it rather than leaving an empty file where there was nothing.
    if (original !== null) fs.writeFileSync(backupTarget, original);
    else fs.writeFileSync(`${backupTarget}.tellann-absent`, 'absent');
  }

  return { plan, checkpointId, checkpointRoot, before };
}

/** Put every backed-up file back. Used when applying a plan throws part way. */
export function restorePatch(input: LocalProjectContext, session: PatchSession): void {
  for (const relativePath of session.before.keys()) {
    const target = resolveWithinWorkspace(input.workspaceRoot, relativePath);
    const backup = path.join(session.checkpointRoot, relativePath.replaceAll('/', path.sep));
    if (fs.existsSync(`${backup}.tellann-absent`)) fs.rmSync(target, { force: true });
    else {
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(backup, target);
    }
  }
}

/** Record what the write actually changed, and write the checkpoint manifest. */
export function finalizePatch(
  input: LocalProjectContext,
  task: ApprovedInstrumentationTask,
  session: PatchSession,
): PatchResult {
  const files: PatchFileResult[] = [];
  const diffParts: string[] = [];
  for (const relativePath of session.before.keys()) {
    const target = resolveWithinWorkspace(input.workspaceRoot, relativePath);
    const exists = fs.existsSync(target);
    const content = exists ? fs.readFileSync(target, 'utf8') : '';
    const original = session.before.get(relativePath) ?? null;
    const changed = original === null ? exists : original !== content;
    files.push({
      relativePath,
      beforeHash: original === null ? null : hash(original),
      afterHash: hash(content),
      changed,
    });
    if (changed) {
      diffParts.push(`--- a/${relativePath}\n+++ b/${relativePath}\n@@ Tellann instrumentation @@\n-${original ?? ''}\n+${content}`);
    }
  }
  const diff = diffParts.join('\n');
  const appliedAt = new Date().toISOString();
  fs.writeFileSync(
    path.join(session.checkpointRoot, 'manifest.json'),
    JSON.stringify({
      planId: session.plan.id,
      checkpointId: session.checkpointId,
      files,
      baseRevision: session.plan.baseRevision,
      appliedAt,
    }, null, 2),
  );
  return {
    planId: session.plan.id,
    checkpointId: session.checkpointId,
    checkpointDirectory: task.checkpointDirectory,
    baseRevision: session.plan.baseRevision,
    files,
    changedFiles: files.filter((file) => file.changed).map((file) => file.relativePath),
    diff,
    diffHash: hash(diff),
    appliedAt,
  };
}

/**
 * Undo an applied patch.
 *
 * A file the user edited after instrumentation is reported as a conflict and
 * left alone: rolling it back would discard their work, which is a worse
 * outcome than leaving one instrumented file in place.
 */
export function rollbackPatch(input: LocalProjectContext, result: PatchResult): RollbackResult {
  const checkpointRoot = path.join(result.checkpointDirectory, result.checkpointId);
  const rolledBackFiles: string[] = [];
  const conflicts: RollbackResult['conflicts'] = [];

  for (const file of result.files) {
    const target = resolveWithinWorkspace(input.workspaceRoot, file.relativePath);
    const currentHash = fileHash(input.workspaceRoot, file.relativePath);
    const unchangedAbsent = !file.changed && file.beforeHash === null && currentHash === null;
    if (!unchangedAbsent && currentHash !== file.afterHash) {
      conflicts.push({
        relativePath: file.relativePath,
        reason: 'File changed after Tellann instrumentation; rollback would overwrite user work',
      });
      continue;
    }
    const backup = path.join(checkpointRoot, file.relativePath.replaceAll('/', path.sep));
    if (fs.existsSync(`${backup}.tellann-absent`)) fs.rmSync(target, { force: true });
    else {
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(backup, target);
    }
    rolledBackFiles.push(file.relativePath);
  }

  const verified = conflicts.length === 0 && result.files.every((file) => {
    const backup = path.join(checkpointRoot, file.relativePath.replaceAll('/', path.sep));
    return fs.existsSync(`${backup}.tellann-absent`)
      ? !fs.existsSync(resolveWithinWorkspace(input.workspaceRoot, file.relativePath))
      : fileHash(input.workspaceRoot, file.relativePath) === hash(fs.readFileSync(backup));
  });

  return { rolledBackFiles, conflicts, verified };
}

/** Every touched file still holds exactly what instrumentation left there. */
export function hashChecks(
  input: LocalProjectContext,
  result: PatchResult,
): Array<{ name: string; passed: boolean; output: string }> {
  return result.files.map((file) => {
    const current = fileHash(input.workspaceRoot, file.relativePath);
    const unchangedAbsent = !file.changed && file.beforeHash === null && current === null;
    const passed = unchangedAbsent || current === file.afterHash;
    return {
      name: `hash:${file.relativePath}`,
      passed,
      output: passed ? 'Expected instrumented hash present' : 'File changed after instrumentation',
    };
  });
}
