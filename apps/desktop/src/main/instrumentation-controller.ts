import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createRequire } from 'node:module';
import { app } from 'electron';
import { resolveWithinWorkspace, validateStructuredCommand } from '@sots/agent-policy';
import type { RepositorySnapshotSummary } from '@sots/desktop-contracts';
import {
  createApprovalHash,
  detectAdapters,
  getAdapter,
  refreshPatchResult,
  validateInstrumentationPlan,
  type ApprovedInstrumentationTask,
  type FrameworkId,
  type InstrumentationPlan,
  type LocalProjectContext,
  type PatchResult,
  type StructuredCommand,
  type ValidationResult,
} from '@sots/instrumentation-adapters';
import type { DesktopCloudClient } from './cloud-client';
import { readLocalState, writeLocalState } from './local-store';
import { createInstrumentationCheckpoint, type InstrumentationCheckpoint } from './git-checkpoint';

const execFileAsync = promisify(execFile);

export type SelectedWorkspace = {
  applicationId: string;
  localId: string;
  cloudId: string;
  snapshotId: string;
  root: string;
  snapshot: RepositorySnapshotSummary;
};

type EnvironmentContext = {
  applicationId: string;
  environmentId: string;
  environmentType: 'DEVELOPMENT' | 'STAGING' | 'PRODUCTION';
};

type LocalApproval = {
  planId: string;
  applicationId: string;
  environmentId: string;
  environmentType: EnvironmentContext['environmentType'];
  files: string[];
  commandIds: string[];
  approvalHash: string;
};

export type CommandResult = {
  id: string;
  purpose: string;
  passed: boolean;
  exitCode: number | null;
  durationMs: number;
  output: string;
};

function assertUuid(value: unknown, name: string): asserts value is string {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new Error(`INVALID_${name.toUpperCase()}`);
  }
}

function safeOutput(value: unknown): string {
  return String(value ?? '')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
    .replace(/(bearer\s+)[a-z0-9._~+\/-]+=*/gi, '$1[REDACTED]')
    .replace(/((?:auth|password|secret|token|api[-_]?key)\s*[=:]\s*)[^\s]+/gi, '$1[REDACTED]')
    .replace(/(https?:\/\/)[^\s/@:]+:[^\s/@]+@/gi, '$1[REDACTED]@')
    .slice(-12_000);
}

function resolveCommand(command: StructuredCommand): { executable: string; args: string[] } {
  const manager = command.executable.replace(/\.cmd$/i, '');
  if (process.platform !== 'win32' || !['pnpm', 'npm', 'yarn'].includes(manager)) {
    return { executable: command.executable, args: command.args };
  }
  const where = require('node:child_process').execFileSync('where.exe', [`${manager}.cmd`], {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 5_000,
  }) as string;
  const launchers = where.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
  const relativeCli = manager === 'pnpm' ? ['node_modules', 'pnpm', 'bin', 'pnpm.cjs']
    : manager === 'npm' ? ['node_modules', 'npm', 'bin', 'npm-cli.js']
      : ['node_modules', 'yarn', 'bin', 'yarn.js'];
  for (const launcher of launchers) {
    const cli = path.join(path.dirname(launcher), ...relativeCli);
    if (fs.existsSync(cli)) return { executable: process.execPath, args: [cli, ...command.args] };
  }
  throw new Error(`SAFE_${manager.toUpperCase()}_EXECUTABLE_NOT_FOUND`);
}

async function runCommand(command: StructuredCommand, workspaceRoot: string): Promise<CommandResult> {
  validateStructuredCommand(command, workspaceRoot);
  const cwd = resolveWithinWorkspace(workspaceRoot, command.cwd);
  const resolved = resolveCommand(command);
  const env = Object.fromEntries(command.allowedEnvironmentKeys.flatMap((key) => {
    const value = process.env[key];
    return value === undefined ? [] : [[key, value]];
  }));
  const started = Date.now();
  try {
    const result = await execFileAsync(resolved.executable, resolved.args, {
      cwd, env, timeout: command.timeoutMs, windowsHide: true, maxBuffer: 2 * 1024 * 1024,
    });
    return { id: command.id, purpose: command.purpose, passed: true, exitCode: 0, durationMs: Date.now() - started, output: safeOutput(`${result.stdout}\n${result.stderr}`) };
  } catch (error) {
    const failure = error as { code?: number | string; stdout?: string; stderr?: string; message?: string };
    return {
      id: command.id, purpose: command.purpose, passed: false,
      exitCode: typeof failure.code === 'number' ? failure.code : null,
      durationMs: Date.now() - started,
      output: safeOutput(`${failure.stdout ?? ''}\n${failure.stderr ?? ''}\n${failure.message ?? ''}`),
    };
  }
}

function installedSdkCheck(plan: InstrumentationPlan, root: string): ValidationResult['checks'][number] {
  const packageName = plan.packageChanges[0]?.packageName;
  if (!packageName) return { name: 'sdk-installed', passed: false, output: 'No SDK package declared by the plan' };
  const packageOperation = plan.operations.find((operation) => operation.id === 'package-sdk');
  const packageManifest = packageOperation
    ? resolveWithinWorkspace(root, packageOperation.relativePath)
    : path.join(root, 'package.json');
  try {
    createRequire(packageManifest).resolve(`${packageName}/package.json`);
    return { name: 'sdk-installed', passed: true, output: `${packageName} resolves from the project` };
  } catch {
    return { name: 'sdk-installed', passed: false, output: `${packageName} is declared but cannot be resolved from the project` };
  }
}

export class InstrumentationController {
  constructor(
    private readonly cloud: DesktopCloudClient,
    private readonly workspace: () => SelectedWorkspace | null,
  ) {}

  private selected(applicationId: string): SelectedWorkspace {
    const workspace = this.workspace();
    if (!workspace || workspace.applicationId !== applicationId) throw new Error('MATCHING_WORKSPACE_SELECTION_REQUIRED');
    resolveWithinWorkspace(workspace.root, '.');
    return workspace;
  }

  private context(workspace: SelectedWorkspace, environmentType: EnvironmentContext['environmentType']): LocalProjectContext {
    return { workspaceRoot: workspace.root, snapshot: workspace.snapshot, environmentType };
  }

  async detect(input: EnvironmentContext) {
    const workspace = this.selected(input.applicationId);
    const detections = detectAdapters(this.context(workspace, input.environmentType));
    return this.cloud.detectInstrumentation(input.applicationId, {
      workspaceId: workspace.cloudId, environmentId: input.environmentId, detections,
    });
  }

  async propose(input: EnvironmentContext & { adapterId: FrameworkId }) {
    if (input.environmentType === 'PRODUCTION') throw new Error('PRODUCTION_OBSERVATION_ONLY');
    const workspace = this.selected(input.applicationId);
    const plan = await getAdapter(input.adapterId).propose(this.context(workspace, input.environmentType));
    writeLocalState(`instrumentation-plan:${plan.id}`, plan);
    return this.cloud.createInstrumentationPlan(input.applicationId, {
      workspaceId: workspace.cloudId,
      repositorySnapshotId: workspace.snapshotId,
      environmentId: input.environmentId,
      deviceSessionId: String(this.cloud.getSession().deviceSessionId),
      plan,
    });
  }

  list(applicationId: string) {
    assertUuid(applicationId, 'application_id');
    return this.cloud.instrumentationPlans(applicationId);
  }

  get(applicationId: string, planId: string) {
    assertUuid(applicationId, 'application_id');
    assertUuid(planId, 'plan_id');
    return this.cloud.instrumentationPlan(applicationId, planId);
  }

  localResult(applicationId: string, planId: string) {
    this.selected(applicationId);
    assertUuid(planId, 'plan_id');
    return readLocalState<Record<string, unknown>>(`instrumentation-result:${planId}`);
  }

  async approve(input: EnvironmentContext & { planId: string; approvedFileScopes: string[]; approvedCommandIds: string[] }) {
    if (input.environmentType === 'PRODUCTION') throw new Error('PRODUCTION_OBSERVATION_ONLY');
    const plan = this.localPlan(input.planId);
    const approvalHash = createApprovalHash(plan, input.approvedFileScopes, input.approvedCommandIds);
    const approved = await this.cloud.approveInstrumentation(input.applicationId, input.planId, input);
    if (String(approved.approvalHash) !== approvalHash) throw new Error('CLOUD_APPROVAL_HASH_MISMATCH');
    const local: LocalApproval = {
      planId: input.planId, applicationId: input.applicationId, environmentId: input.environmentId,
      environmentType: input.environmentType, files: input.approvedFileScopes,
      commandIds: input.approvedCommandIds, approvalHash,
    };
    writeLocalState(`instrumentation-approval:${input.planId}`, local);
    return approved;
  }

  async reject(applicationId: string, planId: string, reason?: string) {
    assertUuid(applicationId, 'application_id');
    assertUuid(planId, 'plan_id');
    return this.cloud.rejectInstrumentation(applicationId, planId, reason);
  }

  async apply(applicationId: string, planId: string) {
    const workspace = this.selected(applicationId);
    const plan = this.localPlan(planId);
    const approval = this.localApproval(planId);
    if (approval.applicationId !== applicationId || approval.environmentType === 'PRODUCTION') throw new Error('INVALID_LOCAL_APPROVAL_SCOPE');
    if (plan.validationCommands.some((command) => command.id === 'install-sdk') && !approval.commandIds.includes('install-sdk')) {
      throw new Error('SDK_INSTALL_COMMAND_APPROVAL_REQUIRED');
    }
    const intent = await this.cloud.instrumentationApplyIntent(applicationId, planId);
    if (intent.approvalHash !== approval.approvalHash) throw new Error('CLOUD_APPROVAL_HASH_MISMATCH');
    try {
    const task: ApprovedInstrumentationTask = {
      plan, approvedFileScopes: approval.files, approvedCommandIds: approval.commandIds,
      approvalHash: approval.approvalHash,
      checkpointDirectory: path.join(app.getPath('userData'), 'instrumentation-checkpoints', workspace.localId),
    };
    const context = this.context(workspace, approval.environmentType);
    const checkpoint = await createInstrumentationCheckpoint(workspace.root);
    writeLocalState(`instrumentation-checkpoint:${planId}`, checkpoint);
    let patch = await getAdapter(plan.adapterId).apply(context, task);
    const commands = plan.validationCommands.filter((command) => approval.commandIds.includes(command.id));
    const commandResults: CommandResult[] = [];
    for (const command of commands) {
      const result = await runCommand(command, workspace.root);
      commandResults.push(result);
      if (!result.passed) break;
    }
    patch = refreshPatchResult(context, patch);
    const validation = await getAdapter(plan.adapterId).validate(context, patch);
    validation.checks.push(installedSdkCheck(plan, workspace.root));
    for (const command of commandResults) validation.checks.push({ name: `command:${command.id}`, passed: command.passed, output: command.output });
    validation.valid = validation.checks.every((check) => check.passed);
    writeLocalState(`instrumentation-result:${planId}`, { patch, commandResults, validation, checkpoint });
    const cloudResult = await this.cloud.submitInstrumentationResult(applicationId, planId, intent.capability, patch, validation, commandResults, checkpoint);
    return { patch, commandResults, validation, checkpoint, cloud: cloudResult };
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Local instrumentation application failed';
      await this.cloud.failInstrumentation(applicationId, planId, intent.capability, reason).catch(() => undefined);
      throw error;
    }
  }

  async validate(applicationId: string, planId: string) {
    const workspace = this.selected(applicationId);
    const plan = this.localPlan(planId);
    const approval = this.localApproval(planId);
    const stored = readLocalState<{ patch: PatchResult }>(`instrumentation-result:${planId}`);
    if (!stored) throw new Error('LOCAL_PATCH_RESULT_NOT_FOUND');
    const patch = refreshPatchResult(this.context(workspace, approval.environmentType), stored.patch);
    const validation = await getAdapter(plan.adapterId).validate(this.context(workspace, approval.environmentType), patch);
    validation.checks.push(installedSdkCheck(plan, workspace.root));
    validation.valid = validation.checks.every((check) => check.passed);
    return validation;
  }

  async rollback(applicationId: string, planId: string) {
    const workspace = this.selected(applicationId);
    const plan = this.localPlan(planId);
    const approval = this.localApproval(planId);
    const stored = readLocalState<{ patch: PatchResult }>(`instrumentation-result:${planId}`);
    if (!stored) throw new Error('LOCAL_PATCH_RESULT_NOT_FOUND');
    const intent = await this.cloud.instrumentationRollbackIntent(applicationId, planId);
    const result = await getAdapter(plan.adapterId).rollback(this.context(workspace, approval.environmentType), stored.patch);
    await this.cloud.submitInstrumentationRollback(applicationId, planId, intent.patchSetId, intent.capability, result);
    writeLocalState(`instrumentation-rollback:${planId}`, { ...result, rolledBackAt: new Date().toISOString() });
    return result;
  }

  checkpoint(applicationId: string, planId: string): InstrumentationCheckpoint | null {
    this.selected(applicationId);
    assertUuid(planId, 'plan_id');
    return readLocalState<InstrumentationCheckpoint>(`instrumentation-checkpoint:${planId}`);
  }

  private localPlan(planId: string): InstrumentationPlan {
    assertUuid(planId, 'plan_id');
    const value = readLocalState<InstrumentationPlan>(`instrumentation-plan:${planId}`);
    if (!value) throw new Error('LOCAL_INSTRUMENTATION_PLAN_NOT_FOUND');
    return validateInstrumentationPlan(value);
  }

  private localApproval(planId: string): LocalApproval {
    const value = readLocalState<LocalApproval>(`instrumentation-approval:${planId}`);
    if (!value) throw new Error('LOCAL_INSTRUMENTATION_APPROVAL_NOT_FOUND');
    return value;
  }
}
