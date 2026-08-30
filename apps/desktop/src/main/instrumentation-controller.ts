import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createRequire } from 'node:module';
import { app, shell } from 'electron';
import { resolveWithinWorkspace, validateStructuredCommand } from '@tellann/agent-policy';
import type { RepositorySnapshotSummary } from '@tellann/desktop-contracts';
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
} from '@tellann/instrumentation-adapters';
import type { DesktopCloudClient } from './cloud-client';
import { readLocalState, writeLocalState } from './local-store';
import { createInstrumentationCheckpoint, type InstrumentationCheckpoint } from './git-checkpoint';
import type { LocalApplicationLauncher } from './application-launcher';

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
  instrumentationPurpose?: 'BOOTSTRAP' | 'FLOW';
  flowId?: string;
  flowVersionId?: string;
  flowInitializationId?: string;
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

function safeOutput(value: unknown, workspaceRoot?: string): string {
  let output = String(value ?? '')
    .replace(/\u001b\[[0-?]*[ -\/]*[@-~]/g, '')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
    .replace(/(bearer\s+)[a-z0-9._~+\/-]+=*/gi, '$1[REDACTED]')
    .replace(/((?:auth|password|secret|token|api[-_]?key)\s*[=:]\s*)[^\s]+/gi, '$1[REDACTED]')
    .replace(/(https?:\/\/)[^\s/@:]+:[^\s/@]+@/gi, '$1[REDACTED]@');
  if (workspaceRoot) {
    output = output.replaceAll(workspaceRoot, '<workspace>').replaceAll(workspaceRoot.replaceAll('\\', '/'), '<workspace>');
  }
  return output.slice(-12_000);
}

function isTellannRelatedBuildFailure(output: string): boolean {
  return [
    /(?:cannot find module|failed to resolve).*@tellann\/(?:frontend|backend)-sdk/i,
    /(?:src[\\/])?tellann\.[cm]?[jt]sx?/i,
    /tellann:generated/i,
    /\bTELLANN(?:\.|\s|$)/,
    /TELLANN_(?:GATEWAY|INGESTION|APPLICATION|ENVIRONMENT)/,
  ].some((pattern) => pattern.test(output));
}

function validationCheckForCommand(result: CommandResult): ValidationResult['checks'][number] {
  if (result.id === 'validate-build' && result.passed) {
    const warningCount = (result.output.match(/\bwarning\b|\(\s*!\s*\)/gi) ?? []).length;
    return {
      name: 'command:validate-build', passed: true,
      output: warningCount
        ? `Project build completed successfully with ${warningCount} non-blocking bundler warning${warningCount === 1 ? '' : 's'}. See Project build health for guidance.`
        : 'Project build completed successfully.',
    };
  }
  if (result.id === 'validate-build' && !result.passed && !isTellannRelatedBuildFailure(result.output)) {
    return {
      name: 'project-build-warning',
      passed: true,
      output: 'Tellann checks passed, but the application build has errors that do not reference the Tellann SDK or generated configuration. The original diagnostics are available under Project build health.',
    };
  }
  return { name: `command:${result.id}`, passed: result.passed, output: result.output };
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
    const nodeExecutable = path.join(path.dirname(launcher), 'node.exe');
    if (fs.existsSync(cli) && fs.existsSync(nodeExecutable)) return { executable: nodeExecutable, args: [cli, ...command.args] };
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
    return { id: command.id, purpose: command.purpose, passed: true, exitCode: 0, durationMs: Date.now() - started, output: safeOutput(`${result.stdout}\n${result.stderr}`, workspaceRoot) };
  } catch (error) {
    const failure = error as { code?: number | string; stdout?: string; stderr?: string; message?: string };
    return {
      id: command.id, purpose: command.purpose, passed: false,
      exitCode: typeof failure.code === 'number' ? failure.code : null,
      durationMs: Date.now() - started,
      output: safeOutput(`${failure.stdout ?? ''}\n${failure.stderr ?? ''}\n${failure.message ?? ''}`, workspaceRoot),
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

function currentHash(root: string, relativePath: string): string | null {
  const target = resolveWithinWorkspace(root, relativePath);
  return fs.existsSync(target) ? crypto.createHash('sha256').update(fs.readFileSync(target)).digest('hex') : null;
}

function mergeEnvironmentFile(existing: string, values: Record<string, string>): string {
  const lines = existing ? existing.replace(/\r\n/g, '\n').split('\n') : [];
  for (const [key, value] of Object.entries(values)) {
    const next = `${key}=${value}`;
    const index = lines.findIndex((line) => line.startsWith(`${key}=`));
    if (index >= 0) lines[index] = next;
    else lines.push(next);
  }
  return `${lines.filter(Boolean).join('\n')}\n`;
}

export class InstrumentationController {
  constructor(
    private readonly cloud: DesktopCloudClient,
    private readonly workspace: (applicationId: string) => SelectedWorkspace | null,
    private readonly launcher?: LocalApplicationLauncher,
  ) {}

  private selected(applicationId: string): SelectedWorkspace {
    const workspace = this.workspace(applicationId);
    if (!workspace || workspace.applicationId !== applicationId) throw new Error('MATCHING_WORKSPACE_SELECTION_REQUIRED');
    resolveWithinWorkspace(workspace.root, '.');
    return workspace;
  }

  private context(workspace: SelectedWorkspace, environmentType: EnvironmentContext['environmentType'], flow?: Pick<EnvironmentContext, 'instrumentationPurpose' | 'flowId' | 'flowVersionId' | 'flowInitializationId'> & { flowManifest?: any }): LocalProjectContext {
    return { workspaceRoot: workspace.root, snapshot: workspace.snapshot, environmentType, instrumentationPurpose: flow?.instrumentationPurpose ?? 'BOOTSTRAP', flowId: flow?.flowId, flowVersionId: flow?.flowVersionId, flowInitializationId: flow?.flowInitializationId, flowManifest: flow?.flowManifest };
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
    const initialization = input.instrumentationPurpose === 'FLOW' && input.flowInitializationId
      ? await this.cloud.flowInitialization(input.flowInitializationId)
      : null;
    const plan = await getAdapter(input.adapterId).propose(this.context(workspace, input.environmentType, { ...input, flowManifest: initialization?.manifest }));
    const packageManifest = plan.operations.find((operation) => operation.id === 'package-sdk')?.relativePath ?? 'package.json';
    const packageRoot = path.posix.dirname(packageManifest) === '.' ? '' : path.posix.dirname(packageManifest);
    const envFile = packageRoot ? `${packageRoot}/.env.local` : '.env.local';
    const ignoreFile = packageRoot ? `${packageRoot}/.gitignore` : '.gitignore';
    plan.operations.push(
      { id: 'tellann-local-environment', kind: fs.existsSync(resolveWithinWorkspace(workspace.root, envFile)) ? 'UPDATE_SOURCE' : 'CREATE_FILE', relativePath: envFile, symbol: null, transformId: 'tellann.environment.local', transformVersion: plan.adapterVersion, expectedHash: currentHash(workspace.root, envFile), description: 'Write environment-scoped Tellann credentials to a local ignored environment file', eventMappings: [] },
      { id: 'tellann-environment-ignore', kind: fs.existsSync(resolveWithinWorkspace(workspace.root, ignoreFile)) ? 'UPDATE_SOURCE' : 'CREATE_FILE', relativePath: ignoreFile, symbol: null, transformId: 'tellann.environment.gitignore', transformVersion: plan.adapterVersion, expectedHash: currentHash(workspace.root, ignoreFile), description: 'Ensure the local Tellann environment file is excluded from Git', eventMappings: [] },
    );
    plan.approvedFileScopes = [...new Set([...plan.approvedFileScopes, envFile, ignoreFile])];
    plan.taskKey = crypto.createHash('sha256').update(JSON.stringify({ base: plan.taskKey, environmentId: input.environmentId, envFile, ignoreFile })).digest('hex');
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
    const context = this.context(workspace, approval.environmentType);
    let appliedPatch: PatchResult | null = null;
    try {
    const task: ApprovedInstrumentationTask = {
      plan, approvedFileScopes: approval.files, approvedCommandIds: approval.commandIds,
      approvalHash: approval.approvalHash,
      checkpointDirectory: path.join(app.getPath('userData'), 'instrumentation-checkpoints', workspace.localId),
    };
    const checkpoint = await createInstrumentationCheckpoint(workspace.root);
    writeLocalState(`instrumentation-checkpoint:${planId}`, checkpoint);
    let patch = await getAdapter(plan.adapterId).apply(context, task);
    appliedPatch = patch;
    const setup = await this.cloud.sdkSetup(applicationId, approval.environmentId);
    const credential = await this.cloud.issueSetupKey(applicationId, approval.environmentId);
    const envOperation = plan.operations.find((operation) => operation.id === 'tellann-local-environment');
    const ignoreOperation = plan.operations.find((operation) => operation.id === 'tellann-environment-ignore');
    if (!envOperation || !ignoreOperation) throw new Error('PERMANENT_SETUP_ENVIRONMENT_SCOPE_MISSING');
    const frontend = plan.adapterId === 'react-vite' || plan.adapterId === 'nextjs';
    const prefix = plan.adapterId === 'nextjs' ? 'NEXT_PUBLIC_' : plan.adapterId === 'react-vite' ? 'VITE_' : '';
    const environmentValues = frontend
      ? { [`${prefix}TELLANN_GATEWAY_URL`]: String(setup.gatewayEndpoint), [`${prefix}TELLANN_INGESTION_KEY`]: credential.rawKey, [`${prefix}TELLANN_APPLICATION_ID`]: applicationId, [`${prefix}TELLANN_ENVIRONMENT_ID`]: approval.environmentId }
      : { TELLANN_GATEWAY_URL: String(setup.gatewayEndpoint), TELLANN_INGESTION_KEY: credential.rawKey, TELLANN_APPLICATION_ID: applicationId, TELLANN_ENVIRONMENT_ID: approval.environmentId };
    const envTarget = resolveWithinWorkspace(workspace.root, envOperation.relativePath);
    fs.mkdirSync(path.dirname(envTarget), { recursive: true });
    fs.writeFileSync(envTarget, mergeEnvironmentFile(fs.existsSync(envTarget) ? fs.readFileSync(envTarget, 'utf8') : '', environmentValues));
    const ignoreTarget = resolveWithinWorkspace(workspace.root, ignoreOperation.relativePath);
    fs.mkdirSync(path.dirname(ignoreTarget), { recursive: true });
    const ignoreSource = fs.existsSync(ignoreTarget) ? fs.readFileSync(ignoreTarget, 'utf8') : '';
    if (!ignoreSource.split(/\r?\n/).includes('.env.local')) fs.writeFileSync(ignoreTarget, `${ignoreSource.trimEnd()}${ignoreSource.trim() ? '\n' : ''}.env.local\n`);
    patch = refreshPatchResult(context, patch);
    appliedPatch = patch;
    const commands = plan.validationCommands.filter((command) => approval.commandIds.includes(command.id));
    const commandResults: CommandResult[] = [];
    for (const command of commands) {
      const result = await runCommand(command, workspace.root);
      commandResults.push(result);
      if (!result.passed) break;
    }
    patch = refreshPatchResult(context, patch);
    appliedPatch = patch;
    const validation = await getAdapter(plan.adapterId).validate(context, patch);
    validation.checks.push(installedSdkCheck(plan, workspace.root));
    for (const command of commandResults) validation.checks.push(validationCheckForCommand(command));
    validation.valid = validation.checks.every((check) => check.passed);
    let telemetryVerified = false;
    const launchCommand = workspace.snapshot.launchCommands?.[0];
    if (validation.valid && launchCommand && this.launcher) {
      await this.launcher.startPermanent(launchCommand, workspace.root, { endpoint: String(setup.gatewayEndpoint), ingestionKey: credential.rawKey, applicationId, environmentId: approval.environmentId });
      try {
        if (frontend && typeof setup.baseUrl === 'string') {
          const target = new URL(setup.baseUrl);
          if (!['http:', 'https:'].includes(target.protocol)) throw new Error('INVALID_SETUP_TARGET_URL');
          const healthDeadline = Date.now() + 30_000;
          while (Date.now() < healthDeadline) {
            try { const response = await fetch(target); if (response.ok) break; } catch { /* wait for the approved local process */ }
            await new Promise((resolve) => setTimeout(resolve, 1_000));
          }
          await shell.openExternal(target.toString());
        }
        const deadline = Date.now() + 45_000;
        while (Date.now() < deadline) {
          const latest = await this.cloud.sdkSetup(applicationId, approval.environmentId);
          const latestReadiness = latest.readiness as Record<string, unknown> | undefined;
          if (latestReadiness?.installationTestPassed === true) { telemetryVerified = true; break; }
          await new Promise((resolve) => setTimeout(resolve, 2_000));
        }
      } finally {
        await this.launcher.stop();
      }
      validation.checks.push({ name: 'telemetry-verification', passed: telemetryVerified, output: telemetryVerified ? 'TELLANN_ONBOARDING_TEST received' : 'Application started but no onboarding test event was observed before timeout' });
      validation.valid = validation.checks.every((check) => check.passed);
    }
    const localResult = {
      patch,
      commandResults,
      validation,
      checkpoint,
      cloudPatchIdentity: { checkpointId: patch.checkpointId, diffHash: patch.diffHash },
    };
    writeLocalState(`instrumentation-result:${planId}`, localResult);
    const cloudResult = await this.cloud.submitInstrumentationResult(applicationId, planId, intent.capability, patch, validation, commandResults, checkpoint);
    return { patch, commandResults, validation, checkpoint, telemetryVerified, cloud: cloudResult };
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Local instrumentation application failed';
      if (appliedPatch) await getAdapter(plan.adapterId).rollback(context, refreshPatchResult(context, appliedPatch)).catch(() => undefined);
      await this.cloud.failInstrumentation(applicationId, planId, intent.capability, reason).catch(() => undefined);
      throw error;
    }
  }

  async validate(applicationId: string, planId: string) {
    const workspace = this.selected(applicationId);
    const plan = this.localPlan(planId);
    const approval = this.localApproval(planId);
    const stored = readLocalState<{
      patch: PatchResult;
      commandResults?: CommandResult[];
      cloudPatchIdentity?: { checkpointId?: string; diffHash?: string };
      [key: string]: unknown;
    }>(`instrumentation-result:${planId}`);
    if (!stored) throw new Error('LOCAL_PATCH_RESULT_NOT_FOUND');
    const patch = refreshPatchResult(this.context(workspace, approval.environmentType), stored.patch);
    const validation = await getAdapter(plan.adapterId).validate(this.context(workspace, approval.environmentType), patch);
    validation.checks.push(installedSdkCheck(plan, workspace.root));
    const commandResults: CommandResult[] = [];
    for (const command of plan.validationCommands.filter((item) => item.id !== 'install-sdk' && approval.commandIds.includes(item.id))) {
      const result = await runCommand(command, workspace.root);
      commandResults.push(result);
      validation.checks.push(validationCheckForCommand(result));
    }
    validation.valid = validation.checks.every((check) => check.passed);
    let cloudPatchIdentity = stored.cloudPatchIdentity;
    if (!cloudPatchIdentity?.checkpointId || !cloudPatchIdentity.diffHash) {
      const cloudPlan = await this.cloud.instrumentationPlan(applicationId, planId) as { patchSets?: Array<{ checkpointId?: string; diffHash?: string }> };
      const latestCloudPatch = cloudPlan.patchSets?.[0];
      if (!latestCloudPatch?.checkpointId || !latestCloudPatch.diffHash) throw new Error('CLOUD_PATCH_IDENTITY_NOT_FOUND');
      cloudPatchIdentity = { checkpointId: latestCloudPatch.checkpointId, diffHash: latestCloudPatch.diffHash };
    }
    writeLocalState(`instrumentation-result:${planId}`, {
      ...stored,
      patch,
      commandResults,
      validation,
      cloudPatchIdentity,
      revalidatedAt: new Date().toISOString(),
    });
    const checkpointId = cloudPatchIdentity.checkpointId;
    const diffHash = cloudPatchIdentity.diffHash;
    if (!checkpointId || !diffHash) throw new Error('CLOUD_PATCH_IDENTITY_NOT_FOUND');
    await this.cloud.revalidateInstrumentation(applicationId, planId, {
      checkpointId,
      diffHash,
      validation,
      commandResults,
    });
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
