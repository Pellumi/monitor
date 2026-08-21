import crypto from 'node:crypto';
import { Router, type NextFunction, type Request, type Response } from 'express';
import jwt from 'jsonwebtoken';
import { Prisma, type PrismaClient } from '@sots/db';
import { Feature } from '@sots/shared';
import type { EntitlementChecker } from '@sots/entitlement-checker';
import { InstrumentationPlanSchema, InstrumentationValidationResultSchema, type InstrumentationPlan } from '@sots/desktop-contracts';

type InstrumentationRequest = Request & { user?: { id: string; email: string } };
type Middleware = (req: InstrumentationRequest, res: Response, next: NextFunction) => unknown;
type CapabilityAction = 'APPLY' | 'ROLLBACK';
type CapabilityClaims = {
  kind: 'tellann-instrumentation-task';
  jti: string;
  action: CapabilityAction;
  planId: string;
  patchSetId?: string;
  workspaceId: string;
  deviceSessionId: string;
  approvalHash?: string;
};

const PLAN_STATUSES = new Set(['PROPOSED', 'APPROVED', 'APPLYING', 'APPLIED', 'VALIDATING', 'COMPLETED', 'VALIDATION_FAILED', 'STALE', 'REJECTED', 'FAILED', 'ROLLED_BACK']);
const ADAPTERS = new Set(['react-vite', 'nextjs', 'express', 'fastify', 'nestjs']);
const SDK_PACKAGES = new Set(['@sots/frontend-sdk', '@sots/backend-sdk']);
const PACKAGE_MANAGERS = new Set(['pnpm', 'pnpm.cmd', 'npm', 'npm.cmd', 'yarn', 'yarn.cmd', 'bun', 'bun.exe']);
const COMMAND_ENVIRONMENT_KEYS = new Set(['CI', 'NODE_ENV', 'NPM_CONFIG_REGISTRY', 'PATH', 'SystemRoot', 'TEMP', 'TMP', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'PNPM_HOME', 'HTTP_PROXY', 'HTTPS_PROXY', 'NO_PROXY']);

function hash(value: unknown): string {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function safeReason(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, 1_000) : null;
}

function boundedRelativePath(value: string): boolean {
  const normalized = value.replaceAll('\\', '/');
  return Boolean(normalized) && !normalized.startsWith('/') && !/^[a-z]:\//i.test(normalized)
    && !normalized.split('/').some((part) => part === '..' || part === '');
}

function validatePlanPolicy(plan: InstrumentationPlan): string | null {
  if (!ADAPTERS.has(plan.adapterId)) return 'UNSUPPORTED_INSTRUMENTATION_ADAPTER';
  if (!plan.approvedFileScopes.length || plan.approvedFileScopes.some((file) => !boundedRelativePath(file))) return 'INVALID_INSTRUMENTATION_FILE_SCOPE';
  if (plan.operations.some((operation) => !plan.approvedFileScopes.includes(operation.relativePath) || !boundedRelativePath(operation.relativePath))) return 'INSTRUMENTATION_OPERATION_OUTSIDE_SCOPE';
  if (plan.packageChanges.some((change) => !SDK_PACKAGES.has(change.packageName))) return 'UNAPPROVED_INSTRUMENTATION_PACKAGE';
  for (const command of plan.validationCommands) {
    if (!PACKAGE_MANAGERS.has(command.executable) || (command.cwd !== '.' && !boundedRelativePath(command.cwd))) return 'UNAPPROVED_INSTRUMENTATION_COMMAND';
    if (command.allowedEnvironmentKeys.some((key) => !COMMAND_ENVIRONMENT_KEYS.has(key))) return 'UNAPPROVED_INSTRUMENTATION_ENVIRONMENT';
    const allowed = command.id === 'install-sdk'
      ? ['add', 'install'].includes(command.args[0] ?? '') && command.args.length === 2 && /^@sots\/(frontend|backend)-sdk@/.test(command.args[1] ?? '')
      : command.id === 'validate-build' && command.args.length === 2 && command.args[0] === 'run' && command.args[1] === 'build';
    if (!allowed) return 'UNAPPROVED_INSTRUMENTATION_COMMAND';
  }
  return null;
}

export function createInstrumentationRouter(input: {
  prisma: PrismaClient;
  entitlementChecker: EntitlementChecker;
  verifyJwt: Middleware;
  verifyAppOwnership: Middleware;
  jwtSecret: string;
}) {
  const { prisma, entitlementChecker, verifyJwt, verifyAppOwnership, jwtSecret } = input;
  const router = Router();

  router.use('/v1/applications/:appId/instrumentation', verifyJwt, verifyAppOwnership);

  async function context(req: InstrumentationRequest, res: Response): Promise<{ id: string; organizationId: string } | null> {
    const application = await prisma.application.findUnique({ where: { id: req.params.appId }, select: { id: true, organizationId: true } });
    if (!application?.organizationId) {
      res.status(404).json({ error: 'Application not found' });
      return null;
    }
    if (!await entitlementChecker.canAccess(application.organizationId, Feature.AUTOMATED_INSTRUMENTATION)) {
      res.status(403).json({ error: 'FEATURE_NOT_ENTITLED', feature: Feature.AUTOMATED_INSTRUMENTATION });
      return null;
    }
    return { id: application.id, organizationId: application.organizationId };
  }

  async function planFor(req: InstrumentationRequest, res: Response) {
    const app = await context(req, res);
    if (!app) return null;
    const plan = await prisma.instrumentationPlan.findFirst({
      where: { id: req.params.planId, workspace: { applicationId: app.id, organizationId: app.organizationId } },
      include: { workspace: true, repositorySnapshot: true, patchSets: { orderBy: { createdAt: 'desc' } } },
    });
    if (!plan) res.status(404).json({ error: 'Instrumentation plan not found' });
    return plan;
  }

  function audit(organizationId: string, applicationId: string, userId: string, eventName: string, metadata: Record<string, unknown>) {
    return prisma.activationEvent.create({ data: { organizationId, applicationId, eventName, metadata: { ...metadata, userId } } });
  }

  async function capabilityFor(
    req: InstrumentationRequest,
    res: Response,
    action: CapabilityAction,
    planId: string,
    patchSetId?: string,
  ) {
    const token = req.get('x-tellann-instrumentation-capability');
    if (!token) {
      res.status(401).json({ error: 'INSTRUMENTATION_CAPABILITY_REQUIRED' });
      return null;
    }
    let claims: CapabilityClaims;
    try {
      claims = jwt.verify(token, jwtSecret) as CapabilityClaims;
    } catch {
      res.status(401).json({ error: 'INVALID_OR_EXPIRED_INSTRUMENTATION_CAPABILITY' });
      return null;
    }
    if (claims.kind !== 'tellann-instrumentation-task' || claims.action !== action || claims.planId !== planId || (patchSetId && claims.patchSetId !== patchSetId)) {
      res.status(403).json({ error: 'INSTRUMENTATION_CAPABILITY_SCOPE_MISMATCH' });
      return null;
    }
    const record = await prisma.instrumentationCapability.findFirst({
      where: {
        jtiHash: hash(claims.jti),
        planId,
        patchSetId: patchSetId ?? null,
        deviceSessionId: claims.deviceSessionId,
        action,
        consumedAt: null,
        expiresAt: { gt: new Date() },
        deviceSession: { userId: req.user!.id, revokedAt: null, expiresAt: { gt: new Date() } },
      },
    });
    if (!record) {
      res.status(401).json({ error: 'INSTRUMENTATION_CAPABILITY_REVOKED_OR_CONSUMED' });
      return null;
    }
    return { record, claims };
  }

  router.post('/v1/applications/:appId/instrumentation/detect', async (req: InstrumentationRequest, res: Response) => {
    const app = await context(req, res);
    if (!app) return;
    const workspace = await prisma.projectWorkspace.findFirst({ where: { id: String(req.body.workspaceId ?? ''), applicationId: app.id, organizationId: app.organizationId } });
    if (!workspace) return res.status(404).json({ error: 'Workspace not found' });
    const environment = req.body.environmentId ? await prisma.environment.findFirst({ where: { id: String(req.body.environmentId), applicationId: app.id } }) : null;
    if (req.body.environmentId && !environment) return res.status(404).json({ error: 'Environment not found' });
    res.json({ entitled: true, activeControlAllowed: environment?.type !== 'PRODUCTION', detections: Array.isArray(req.body.detections) ? req.body.detections : [] });
  });

  router.post('/v1/applications/:appId/instrumentation/plans', async (req: InstrumentationRequest, res: Response) => {
    const app = await context(req, res);
    if (!app) return;
    const parsedPlan = InstrumentationPlanSchema.safeParse(req.body.plan);
    if (!parsedPlan.success) return res.status(400).json({ error: 'INVALID_INSTRUMENTATION_PLAN', issues: parsedPlan.error.issues.map((issue) => issue.path.join('.')) });
    const plan = parsedPlan.data;
    const policyError = validatePlanPolicy(plan);
    if (policyError) return res.status(400).json({ error: policyError });
    const workspace = await prisma.projectWorkspace.findFirst({ where: { id: String(req.body.workspaceId ?? ''), applicationId: app.id, organizationId: app.organizationId } });
    if (!workspace) return res.status(404).json({ error: 'Workspace not found' });
    const snapshot = await prisma.repositorySnapshot.findFirst({ where: { id: String(req.body.repositorySnapshotId ?? ''), workspaceId: workspace.id } });
    if (!snapshot) return res.status(404).json({ error: 'Repository snapshot not found' });
    const environment = await prisma.environment.findFirst({ where: { id: String(req.body.environmentId ?? ''), applicationId: app.id } });
    if (!environment) return res.status(404).json({ error: 'Environment not found' });
    if (environment.type === 'PRODUCTION') return res.status(403).json({ error: 'PRODUCTION_OBSERVATION_ONLY' });
    if (plan.instrumentationPurpose === 'FLOW') {
      const version = await prisma.behaviorGraphVersion.findFirst({ where: { id: plan.flowVersionId ?? '', graphId: plan.flowId ?? '', graph: { applicationId: app.id, lifecycleStatus: 'PUBLISHED' } } });
      if (!version) return res.status(422).json({ error: 'PUBLISHED_FLOW_VERSION_REQUIRED' });
    }
    if (String(plan.repositoryFingerprint) !== snapshot.repositoryFingerprint || (plan.baseRevision ?? null) !== (snapshot.revision ?? null)) {
      return res.status(409).json({ error: 'STALE_INSTRUMENTATION_PLAN' });
    }
    const taskKey = String(plan.taskKey ?? '');
    if (!taskKey || taskKey.length < 32) return res.status(400).json({ error: 'INVALID_TASK_KEY' });
    const targetFileHashes = Object.fromEntries(plan.operations.map((operation: any) => [String(operation.relativePath), operation.expectedHash ?? null]));
    const record = await prisma.instrumentationPlan.upsert({
      where: { workspaceId_taskKey: { workspaceId: workspace.id, taskKey } },
      create: {
        id: typeof plan.id === 'string' ? plan.id : undefined,
        workspaceId: workspace.id, repositorySnapshotId: snapshot.id, createdByUserId: req.user!.id,
        environmentId: environment.id, deviceSessionId: typeof req.body.deviceSessionId === 'string' ? req.body.deviceSessionId : null,
        purpose: plan.instrumentationPurpose,
        flowId: plan.flowId ?? null,
        flowVersionId: plan.flowVersionId ?? null,
        taskKey, contractVersion: String(plan.contractVersion ?? '1.0'), manifestVersion: String(plan.manifestVersion ?? '1.0'),
        adapterId: String(plan.adapterId), adapterVersion: String(plan.adapterVersion), frameworkVersion: plan.frameworkVersion ?? null,
        supportedVersionRange: plan.supportedVersionRange ?? null, risk: String(plan.risk ?? 'MEDIUM'),
        approvedFileScopes: plan.approvedFileScopes.map(String), baseRevision: plan.baseRevision ?? null,
        repositoryFingerprint: String(plan.repositoryFingerprint), targetFileHashes, evidenceJson: plan.evidence ?? {},
        commandManifest: plan.validationCommands ?? [], eventMappingManifest: plan.operations.flatMap((operation: any) => operation.eventMappings ?? []),
        planJson: plan as unknown as Prisma.InputJsonValue, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1_000),
      },
      update: {},
    });
    await audit(app.organizationId, app.id, req.user!.id, 'INSTRUMENTATION_PLAN_CREATED', { planId: record.id, adapterId: record.adapterId, risk: record.risk });
    res.status(201).json(record);
  });

  router.get('/v1/applications/:appId/instrumentation/plans', async (req: InstrumentationRequest, res: Response) => {
    const app = await context(req, res);
    if (!app) return;
    const plans = await prisma.instrumentationPlan.findMany({
      where: { workspace: { applicationId: app.id, organizationId: app.organizationId } },
      include: { patchSets: { orderBy: { createdAt: 'desc' }, take: 1 } }, orderBy: { createdAt: 'desc' }, take: 100,
    });
    res.json(plans);
  });

  router.get('/v1/applications/:appId/instrumentation/plans/:planId', async (req: InstrumentationRequest, res: Response) => {
    const plan = await planFor(req, res);
    if (plan) res.json(plan);
  });

  router.post('/v1/applications/:appId/instrumentation/plans/:planId/approve', async (req: InstrumentationRequest, res: Response) => {
    const plan = await planFor(req, res);
    if (!plan) return;
    if (plan.status !== 'PROPOSED') return res.status(409).json({ error: 'PLAN_NOT_PROPOSED' });
    if (plan.expiresAt && plan.expiresAt.getTime() <= Date.now()) {
      await prisma.instrumentationPlan.update({ where: { id: plan.id }, data: { status: 'STALE', staleReasonSafe: 'Approval window expired' } });
      return res.status(409).json({ error: 'STALE_INSTRUMENTATION_PLAN' });
    }
    const environment = plan.environmentId ? await prisma.environment.findFirst({ where: { id: plan.environmentId, applicationId: req.params.appId } }) : null;
    if (environment?.type === 'PRODUCTION') return res.status(403).json({ error: 'PRODUCTION_OBSERVATION_ONLY' });
    const files = Array.isArray(req.body.approvedFileScopes) ? req.body.approvedFileScopes.map(String) : [];
    const commands = Array.isArray(req.body.approvedCommandIds) ? req.body.approvedCommandIds.map(String) : [];
    if (!files.length || files.some((file: string) => !plan.approvedFileScopes.includes(file))) return res.status(400).json({ error: 'APPROVED_SCOPE_OUTSIDE_PLAN' });
    const planJson = plan.planJson as any;
    const availableCommandIds = new Set((planJson.validationCommands ?? []).map((command: any) => String(command.id)));
    if (commands.some((id: string) => !availableCommandIds.has(id))) return res.status(400).json({ error: 'APPROVED_COMMAND_OUTSIDE_PLAN' });
    const approvalHash = hash({ planId: plan.id, taskKey: plan.taskKey, files: [...files].sort(), commands: [...commands].sort() });
    const approved = await prisma.instrumentationPlan.update({ where: { id: plan.id }, data: {
      status: 'APPROVED', approvedFileScopes: files, approvedCommandIds: commands, approvalHash,
      approvedByUserId: req.user!.id, approvedAt: new Date(),
    } });
    await audit(plan.workspace.organizationId, plan.workspace.applicationId, req.user!.id, 'INSTRUMENTATION_PLAN_APPROVED', { planId: plan.id, approvalHash });
    res.json(approved);
  });

  router.post('/v1/applications/:appId/instrumentation/plans/:planId/reject', async (req: InstrumentationRequest, res: Response) => {
    const plan = await planFor(req, res);
    if (!plan) return;
    if (!['PROPOSED', 'APPROVED'].includes(plan.status)) return res.status(409).json({ error: 'PLAN_CANNOT_BE_REJECTED' });
    const rejected = await prisma.instrumentationPlan.update({ where: { id: plan.id }, data: { status: 'REJECTED', rejectionReasonSafe: safeReason(req.body.reason), completedAt: new Date() } });
    await audit(plan.workspace.organizationId, plan.workspace.applicationId, req.user!.id, 'INSTRUMENTATION_PLAN_REJECTED', { planId: plan.id });
    res.json(rejected);
  });

  router.post('/v1/applications/:appId/instrumentation/plans/:planId/apply-intent', async (req: InstrumentationRequest, res: Response) => {
    const plan = await planFor(req, res);
    if (!plan) return;
    if (plan.status !== 'APPROVED' || !plan.approvalHash) return res.status(409).json({ error: 'PLAN_NOT_APPROVED' });
    const device = await prisma.deviceSession.findFirst({ where: { id: String(req.body.deviceSessionId ?? ''), userId: req.user!.id, revokedAt: null, expiresAt: { gt: new Date() } } });
    if (!device) return res.status(403).json({ error: 'ACTIVE_DEVICE_REQUIRED' });
    const jti = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1_000);
    const capability = jwt.sign({ kind: 'tellann-instrumentation-task', jti, action: 'APPLY', planId: plan.id, workspaceId: plan.workspaceId, deviceSessionId: device.id, approvalHash: plan.approvalHash }, jwtSecret, { expiresIn: '10m' });
    await prisma.instrumentationCapability.create({ data: { jtiHash: hash(jti), planId: plan.id, deviceSessionId: device.id, action: 'APPLY', expiresAt } });
    await prisma.instrumentationPlan.update({ where: { id: plan.id }, data: { status: 'APPLYING', deviceSessionId: device.id } });
    res.json({ capability, expiresInSeconds: 600, approvalHash: plan.approvalHash });
  });

  router.post('/v1/applications/:appId/instrumentation/plans/:planId/results', async (req: InstrumentationRequest, res: Response) => {
    const plan = await planFor(req, res);
    if (!plan) return;
    const result = req.body.result;
    if (!result || result.planId !== plan.id || !result.checkpointId || !result.diffHash || !Array.isArray(result.files)) return res.status(400).json({ error: 'INVALID_PATCH_RESULT' });
    const existing = plan.patchSets.find((item) => item.diffHash === String(result.diffHash));
    if (existing) return res.json(existing);
    if (!['APPLYING', 'APPLIED', 'VALIDATING'].includes(plan.status)) return res.status(409).json({ error: 'PLAN_NOT_APPLYING' });
    const capability = await capabilityFor(req, res, 'APPLY', plan.id);
    if (!capability) return;
    if (capability.claims.approvalHash !== plan.approvalHash || capability.claims.workspaceId !== plan.workspaceId) {
      return res.status(403).json({ error: 'INSTRUMENTATION_CAPABILITY_SCOPE_MISMATCH' });
    }
    const validation = req.body.validation ?? null;
    const checkpointKind = req.body.checkpointKind === 'GIT_BRANCH' ? 'GIT_BRANCH' : 'LOCAL';
    const checkpointMetadata = req.body.checkpointMetadata && typeof req.body.checkpointMetadata === 'object'
      ? req.body.checkpointMetadata
      : null;
    const status = validation ? (validation.valid ? 'COMPLETED' : 'VALIDATION_FAILED') : 'APPLIED';
    const patch = await prisma.$transaction(async (tx) => {
      const consumed = await tx.instrumentationCapability.updateMany({ where: { id: capability.record.id, consumedAt: null, expiresAt: { gt: new Date() } }, data: { consumedAt: new Date() } });
      if (consumed.count !== 1) throw new Error('INSTRUMENTATION_CAPABILITY_ALREADY_CONSUMED');
      const created = await tx.patchSet.create({ data: {
        workspaceId: plan.workspaceId, instrumentationPlanId: plan.id, baseRevision: result.baseRevision ?? null,
        checkpointId: String(result.checkpointId), checkpointKind, checkpointMetadata,
        manifestVersion: plan.manifestVersion, approvedScopeHash: plan.approvalHash, diffHash: String(result.diffHash),
        changedFileHashes: result.files, status: validation ? (validation.valid ? 'VALIDATED' : 'VALIDATION_FAILED') : 'APPLIED',
        commandResultsJson: Array.isArray(req.body.commandResults) ? req.body.commandResults : undefined,
        validationJson: validation, appliedByUserId: req.user!.id, appliedAt: new Date(), validatedAt: validation ? new Date() : null,
      } });
      await tx.instrumentationPlan.update({ where: { id: plan.id }, data: { status, validationJson: validation, completedAt: validation?.valid ? new Date() : null } });
      if (validation?.valid) {
        await tx.applicationOnboardingProgress.updateMany({
          where: { applicationId: plan.workspace.applicationId },
          data: { connectionMethodSelected: 'DESKTOP', sdkTargetsConfigured: true },
        });
      }
      return created;
    });
    await audit(plan.workspace.organizationId, plan.workspace.applicationId, req.user!.id, validation?.valid ? 'INSTRUMENTATION_VALIDATED' : 'INSTRUMENTATION_APPLIED', { planId: plan.id, patchSetId: patch.id, valid: validation?.valid ?? null });
    res.status(201).json(patch);
  });

  router.post('/v1/applications/:appId/instrumentation/plans/:planId/revalidate', async (req: InstrumentationRequest, res: Response) => {
    const plan = await planFor(req, res);
    if (!plan) return;
    if (!['APPLIED', 'COMPLETED', 'VALIDATION_FAILED'].includes(plan.status)) return res.status(409).json({ error: 'PLAN_NOT_REVALIDATABLE' });
    const device = await prisma.deviceSession.findFirst({ where: { id: String(req.body.deviceSessionId ?? ''), userId: req.user!.id, revokedAt: null, expiresAt: { gt: new Date() } } });
    if (!device || (plan.deviceSessionId && plan.deviceSessionId !== device.id)) return res.status(403).json({ error: 'ACTIVE_PLAN_DEVICE_REQUIRED' });
    const patch = plan.patchSets[0];
    if (!patch || String(req.body.checkpointId ?? '') !== patch.checkpointId || String(req.body.diffHash ?? '') !== patch.diffHash) {
      return res.status(409).json({ error: 'LOCAL_PATCH_IDENTITY_MISMATCH' });
    }
    const parsed = InstrumentationValidationResultSchema.safeParse(req.body.validation);
    if (!parsed.success) return res.status(400).json({ error: 'INVALID_INSTRUMENTATION_VALIDATION' });
    const commandResults = Array.isArray(req.body.commandResults) ? req.body.commandResults.slice(0, 20).map((command: any) => ({
      id: String(command?.id ?? '').slice(0, 100), purpose: String(command?.purpose ?? '').slice(0, 500), passed: command?.passed === true,
      exitCode: typeof command?.exitCode === 'number' ? command.exitCode : null, durationMs: Number(command?.durationMs ?? 0),
      output: String(command?.output ?? '').slice(-12_000),
    })) : [];
    const status = parsed.data.valid ? 'COMPLETED' : 'VALIDATION_FAILED';
    const updated = await prisma.$transaction(async (tx) => {
      await tx.patchSet.update({ where: { id: patch.id }, data: { status: parsed.data.valid ? 'VALIDATED' : 'VALIDATION_FAILED', validationJson: parsed.data, commandResultsJson: commandResults, validatedAt: new Date() } });
      const result = await tx.instrumentationPlan.update({ where: { id: plan.id }, data: { status, validationJson: parsed.data, completedAt: parsed.data.valid ? new Date() : null } });
      if (parsed.data.valid) {
        await tx.applicationOnboardingProgress.updateMany({
          where: { applicationId: plan.workspace.applicationId },
          data: { connectionMethodSelected: 'DESKTOP', sdkTargetsConfigured: true },
        });
      }
      return result;
    });
    await audit(plan.workspace.organizationId, plan.workspace.applicationId, req.user!.id, 'INSTRUMENTATION_VALIDATED', { planId: plan.id, patchSetId: patch.id, valid: parsed.data.valid, revalidation: true });
    res.json(updated);
  });

  router.post('/v1/applications/:appId/instrumentation/plans/:planId/fail', async (req: InstrumentationRequest, res: Response) => {
    const plan = await planFor(req, res);
    if (!plan) return;
    if (plan.status === 'FAILED') return res.json(plan);
    if (plan.status !== 'APPLYING') return res.status(409).json({ error: 'PLAN_NOT_APPLYING' });
    const capability = await capabilityFor(req, res, 'APPLY', plan.id);
    if (!capability) return;
    const reason = safeReason(req.body.reason) ?? 'Local instrumentation application failed';
    const failed = await prisma.$transaction(async (tx) => {
      const consumed = await tx.instrumentationCapability.updateMany({ where: { id: capability.record.id, consumedAt: null }, data: { consumedAt: new Date() } });
      if (consumed.count !== 1) throw new Error('INSTRUMENTATION_CAPABILITY_ALREADY_CONSUMED');
      return tx.instrumentationPlan.update({ where: { id: plan.id }, data: { status: 'FAILED', failureReasonSafe: reason, completedAt: new Date() } });
    });
    await audit(plan.workspace.organizationId, plan.workspace.applicationId, req.user!.id, 'INSTRUMENTATION_FAILED', { planId: plan.id, reason });
    res.json(failed);
  });

  router.post('/v1/applications/:appId/instrumentation/plans/:planId/rollback-intent', async (req: InstrumentationRequest, res: Response) => {
    const plan = await planFor(req, res);
    if (!plan) return;
    const patch = plan.patchSets[0];
    if (!patch || !['APPLIED', 'VALIDATED', 'VALIDATION_FAILED'].includes(patch.status)) return res.status(409).json({ error: 'PATCH_NOT_ROLLBACKABLE' });
    const device = await prisma.deviceSession.findFirst({ where: { id: String(req.body.deviceSessionId ?? ''), userId: req.user!.id, revokedAt: null, expiresAt: { gt: new Date() } } });
    if (!device) return res.status(403).json({ error: 'ACTIVE_DEVICE_REQUIRED' });
    const jti = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1_000);
    const capability = jwt.sign({ kind: 'tellann-instrumentation-task', jti, action: 'ROLLBACK', planId: plan.id, patchSetId: patch.id, workspaceId: plan.workspaceId, deviceSessionId: device.id }, jwtSecret, { expiresIn: '10m' });
    await prisma.instrumentationCapability.create({ data: { jtiHash: hash(jti), planId: plan.id, patchSetId: patch.id, deviceSessionId: device.id, action: 'ROLLBACK', expiresAt } });
    await prisma.patchSet.update({ where: { id: patch.id }, data: { status: 'ROLLING_BACK' } });
    res.json({ capability, patchSetId: patch.id, expiresInSeconds: 600 });
  });

  router.post('/v1/applications/:appId/instrumentation/plans/:planId/rollback-results', async (req: InstrumentationRequest, res: Response) => {
    const plan = await planFor(req, res);
    if (!plan) return;
    const patch = plan.patchSets.find((item) => item.id === req.body.patchSetId);
    if (patch?.status === 'ROLLED_BACK') return res.json({ success: true });
    if (!patch || patch.status !== 'ROLLING_BACK') return res.status(409).json({ error: 'PATCH_NOT_ROLLING_BACK' });
    const result = req.body.result;
    if (!result || typeof result.verified !== 'boolean') return res.status(400).json({ error: 'INVALID_ROLLBACK_RESULT' });
    const capability = await capabilityFor(req, res, 'ROLLBACK', plan.id, patch.id);
    if (!capability) return;
    await prisma.$transaction(async (tx) => {
      const consumed = await tx.instrumentationCapability.updateMany({ where: { id: capability.record.id, consumedAt: null, expiresAt: { gt: new Date() } }, data: { consumedAt: new Date() } });
      if (consumed.count !== 1) throw new Error('INSTRUMENTATION_CAPABILITY_ALREADY_CONSUMED');
      await tx.patchSet.update({ where: { id: patch.id }, data: {
        status: result.verified ? 'ROLLED_BACK' : 'ROLLBACK_FAILED', rollbackJson: result,
        failureReasonSafe: result.verified ? null : 'Rollback conflicts require manual review', rolledBackByUserId: req.user!.id, rolledBackAt: new Date(),
      } });
      await tx.instrumentationPlan.update({ where: { id: plan.id }, data: { status: result.verified ? 'ROLLED_BACK' : 'FAILED', completedAt: new Date() } });
    });
    await audit(plan.workspace.organizationId, plan.workspace.applicationId, req.user!.id, result.verified ? 'INSTRUMENTATION_ROLLED_BACK' : 'INSTRUMENTATION_FAILED', { planId: plan.id, patchSetId: patch.id, conflicts: result.conflicts?.length ?? 0 });
    res.json({ success: result.verified });
  });

  router.get('/v1/applications/:appId/instrumentation/manifests/:manifestId', async (req: InstrumentationRequest, res: Response) => {
    const app = await context(req, res);
    if (!app) return;
    const patch = await prisma.patchSet.findFirst({ where: { id: req.params.manifestId, workspace: { applicationId: app.id, organizationId: app.organizationId } }, include: { instrumentationPlan: true } });
    if (!patch) return res.status(404).json({ error: 'Instrumentation manifest not found' });
    res.json(patch);
  });

  return router;
}
