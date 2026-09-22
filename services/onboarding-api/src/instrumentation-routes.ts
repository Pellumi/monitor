import crypto from 'node:crypto';
import { Router, type NextFunction, type Request, type Response } from 'express';
import jwt from 'jsonwebtoken';
import { AuditAction, Prisma, type PrismaClient } from '@tellann/db';
import { Feature } from '@tellann/shared';
import type { EntitlementChecker } from '@tellann/entitlement-checker';
import { INSTRUMENTATION_FRAMEWORK_IDS, InstrumentationPlanSchema, InstrumentationValidationResultSchema, PYTHON_INSTRUMENTATION_FRAMEWORK_IDS, type InstrumentationPlan } from '@tellann/desktop-contracts';
import { flowInitializationResetOnRejection } from './instrumentation-flow-reset';
import { INITIALISATION_TITLE, normalizeInstrumentationTitle, resolveInstrumentationTitle } from './instrumentation-titles';

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
// Statuses a repeat propose for the same task key can safely resume. Anything else
// (STALE, REJECTED, FAILED, ROLLED_BACK) is terminal and must be superseded by a
// fresh plan rather than handed back.
const RESUMABLE_PLAN_STATUSES = new Set(['PROPOSED', 'APPROVED', 'APPLYING', 'APPLIED', 'VALIDATING', 'VALIDATION_FAILED', 'COMPLETED']);
const ADAPTERS = new Set<string>(INSTRUMENTATION_FRAMEWORK_IDS);
// A task that is mid-flight on someone's machine cannot be filed away: archiving
// it would hide the only place its progress and its rollback are reachable from.
const ARCHIVE_BLOCKING_STATUSES = new Set(['APPLYING', 'VALIDATING']);
const PYTHON_ADAPTERS = new Set<string>(PYTHON_INSTRUMENTATION_FRAMEWORK_IDS);

// What a plan is allowed to install and run, per runtime. A plan arrives from a
// desktop agent, so this is the server's own check on it rather than a repeat of
// one: the agent could be any version, and an approved plan authorizes a command
// to run on a member's machine.
const SDK_PACKAGES = new Set(['@tellann/frontend-sdk', '@tellann/backend-sdk']);
const PACKAGE_MANAGERS = new Set(['pnpm', 'pnpm.cmd', 'npm', 'npm.cmd', 'yarn', 'yarn.cmd', 'bun', 'bun.exe']);
const COMMAND_ENVIRONMENT_KEYS = new Set(['CI', 'NODE_ENV', 'NPM_CONFIG_REGISTRY', 'PATH', 'SystemRoot', 'TEMP', 'TMP', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'PNPM_HOME', 'HTTP_PROXY', 'HTTPS_PROXY', 'NO_PROXY']);

/** The one distribution the Python adapter installs, published to PyPI. */
const PYTHON_SDK_PACKAGES = new Set(['tellann']);
// `python` runs the install as `python -m pip`, which is pip's own documented
// invocation and the only one that is certain to target the interpreter the
// project uses. The rest are the managers a Python project declares itself with.
const PYTHON_PACKAGE_MANAGERS = new Set(['python', 'python3', 'poetry', 'uv', 'pdm', 'pipenv']);
const PYTHON_COMMAND_ENVIRONMENT_KEYS = new Set(['CI', 'PATH', 'SystemRoot', 'TEMP', 'TMP', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'HOME', 'VIRTUAL_ENV', 'CONDA_PREFIX', 'PYTHONPATH', 'PYTHONHOME', 'PIP_INDEX_URL', 'POETRY_HOME', 'UV_CACHE_DIR', 'HTTP_PROXY', 'HTTPS_PROXY', 'NO_PROXY']);
// `tellann` followed by a PEP 440 specifier, and nothing else - no URL, no path,
// no second requirement, no index or config flag smuggled in as the argument.
const PYTHON_SDK_REQUIREMENT = /^tellann(?:[=<>!~][=<>]?[\w.*+!-]+)(?:,[=<>!~][=<>]?[\w.*+!-]+)*$/;

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

/**
 * Whether one command a Python plan wants to run is one the adapter can emit.
 *
 * The shapes are exhaustive on purpose. `pip install` accepts a local path, a
 * URL and a second requirement as ordinary arguments, so allowing the verb and
 * trusting the rest would approve a great deal more than installing the SDK.
 */
function pythonCommandAllowed(command: InstrumentationPlan['validationCommands'][number]): boolean {
  const { args } = command;
  if (command.id === 'install-sdk') {
    // `python -m pip install <requirement>`, for pip and for Conda.
    if (args.length === 4) {
      return args[0] === '-m' && args[1] === 'pip' && args[2] === 'install'
        && PYTHON_SDK_REQUIREMENT.test(args[3] ?? '');
    }
    // `poetry add`, `uv add`, `pdm add`, `pipenv install`.
    return args.length === 2 && ['add', 'install'].includes(args[0] ?? '')
      && PYTHON_SDK_REQUIREMENT.test(args[1] ?? '');
  }
  // Byte-compiles the tree to prove instrumentation did not break the syntax.
  // It imports nothing, so it never executes the project's own code.
  return command.id === 'compile-check'
    && args.length === 4
    && args[0] === '-m' && args[1] === 'compileall' && args[2] === '-q' && args[3] === '.';
}

function validatePlanPolicy(plan: InstrumentationPlan): string | null {
  if (!ADAPTERS.has(plan.adapterId)) return 'UNSUPPORTED_INSTRUMENTATION_ADAPTER';
  if (!plan.approvedFileScopes.length || plan.approvedFileScopes.some((file) => !boundedRelativePath(file))) return 'INVALID_INSTRUMENTATION_FILE_SCOPE';
  if (plan.operations.some((operation) => !plan.approvedFileScopes.includes(operation.relativePath) || !boundedRelativePath(operation.relativePath))) return 'INSTRUMENTATION_OPERATION_OUTSIDE_SCOPE';

  // A Python plan installs a PyPI distribution with a Python package manager and
  // needs the interpreter's own environment variables. Judging it against the
  // npm allowlist rejected every correctly formed Django, Flask, FastAPI and
  // Starlette plan as an unapproved package.
  const python = PYTHON_ADAPTERS.has(plan.adapterId);
  const packages = python ? PYTHON_SDK_PACKAGES : SDK_PACKAGES;
  const managers = python ? PYTHON_PACKAGE_MANAGERS : PACKAGE_MANAGERS;
  const environmentKeys = python ? PYTHON_COMMAND_ENVIRONMENT_KEYS : COMMAND_ENVIRONMENT_KEYS;

  if (plan.packageChanges.some((change) => !packages.has(change.packageName))) return 'UNAPPROVED_INSTRUMENTATION_PACKAGE';
  for (const command of plan.validationCommands) {
    if (!managers.has(command.executable) || (command.cwd !== '.' && !boundedRelativePath(command.cwd))) return 'UNAPPROVED_INSTRUMENTATION_COMMAND';
    if (command.allowedEnvironmentKeys.some((key) => !environmentKeys.has(key))) return 'UNAPPROVED_INSTRUMENTATION_ENVIRONMENT';
    const allowed = python
      ? pythonCommandAllowed(command)
      : command.id === 'install-sdk'
        ? ['add', 'install'].includes(command.args[0] ?? '') && command.args.length === 2 && /^@tellann\/(frontend|backend)-sdk@/.test(command.args[1] ?? '')
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

  /**
   * Record an operator action in the organisation's audit history.
   *
   * Activation events above measure onboarding; they are not what Settings →
   * Audit Logs reads. Renaming, archiving and restoring are deliberate acts on
   * a governed record, so they are written where an administrator reviewing the
   * organisation will actually find them.
   */
  function auditLog(
    req: InstrumentationRequest,
    organizationId: string,
    action: AuditAction,
    metadata: Record<string, unknown>,
  ) {
    return prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        organizationId,
        action,
        ipAddress: req.ip ?? null,
        userAgent: req.get('user-agent') ?? null,
        metadata: metadata as Prisma.InputJsonValue,
      },
    });
  }

  /**
   * Attach each task's display name.
   *
   * A Flow task is named after its Flow, so the names are looked up in one
   * query for the whole page rather than per row; a task the operator renamed
   * already carries its own title and needs no lookup at all.
   */
  async function withTitles<T extends { title?: string | null; purpose?: string | null; flowId?: string | null }>(plans: T[]) {
    const flowIds = [...new Set(plans.filter((plan) => !plan.title?.trim() && plan.flowId).map((plan) => plan.flowId as string))];
    const flows = flowIds.length
      ? await prisma.behaviorGraph.findMany({ where: { id: { in: flowIds } }, select: { id: true, name: true } })
      : [];
    const names = new Map(flows.map((flow) => [flow.id, flow.name]));
    return plans.map((plan) => ({ ...plan, title: resolveInstrumentationTitle(plan, plan.flowId ? names.get(plan.flowId) : null) }));
  }

  /**
   * Search tasks by the title the operator sees, not only the one stored.
   *
   * Most tasks have no stored title — theirs is derived from what the task does
   * — so a plain `title contains` would find almost nothing. The derived names
   * are folded into the query instead: "init" matches every initialisation
   * task, and a Flow's name matches the tasks that set that Flow up.
   */
  async function titleSearch(applicationId: string, query: string): Promise<Prisma.InstrumentationPlanWhereInput> {
    const conditions: Prisma.InstrumentationPlanWhereInput[] = [{ title: { contains: query, mode: 'insensitive' } }];
    if (INITIALISATION_TITLE.toLowerCase().includes(query.toLowerCase())) {
      conditions.push({ title: null, purpose: 'BOOTSTRAP' });
    }
    const flows = await prisma.behaviorGraph.findMany({
      where: { applicationId, name: { contains: query, mode: 'insensitive' } },
      select: { id: true },
      take: 200,
    });
    if (flows.length) conditions.push({ title: null, flowId: { in: flows.map((flow) => flow.id) } });
    return { OR: conditions };
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
    const createData = {
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
    } satisfies Prisma.InstrumentationPlanUncheckedCreateInput;
    // The task key is deterministic from the repository state, so a resumable plan
    // for the same key is handed back unchanged (idempotent propose). A plan that has
    // reached a terminal state — rolled back, rejected, or failed — is finished: it is
    // moved aside (its id stays valid for history) so a fresh PROPOSED plan can be
    // minted and the operator can review and apply setup again instead of landing on
    // a dead task.
    const existing = await prisma.instrumentationPlan.findUnique({
      where: { workspaceId_taskKey: { workspaceId: workspace.id, taskKey } },
    });
    const record = !existing
      ? await prisma.instrumentationPlan.create({ data: createData })
      : RESUMABLE_PLAN_STATUSES.has(existing.status)
        ? existing
        : await prisma.$transaction(async (tx) => {
            await tx.instrumentationPlan.update({
              where: { id: existing.id },
              data: { taskKey: `${taskKey}:superseded:${existing.id}` },
            });
            return tx.instrumentationPlan.create({ data: createData });
          });
    await audit(app.organizationId, app.id, req.user!.id, 'INSTRUMENTATION_PLAN_CREATED', { planId: record.id, adapterId: record.adapterId, risk: record.risk });
    res.status(201).json(record);
  });

  /**
   * List setup tasks, filtered the way the operator asked for them.
   *
   * `archived` decides which shelf is being read: the working list by default,
   * the archive with `true`, and both with `all`. Everything else narrows that
   * shelf — by title, status, framework, or the window the task was created in.
   */
  router.get('/v1/applications/:appId/instrumentation/plans', async (req: InstrumentationRequest, res: Response) => {
    const app = await context(req, res);
    if (!app) return;
    const query = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 200) : '';
    const status = typeof req.query.status === 'string' ? req.query.status.trim().toUpperCase() : '';
    const adapterId = typeof req.query.adapterId === 'string' ? req.query.adapterId.trim() : '';
    const archived = typeof req.query.archived === 'string' ? req.query.archived.trim().toLowerCase() : 'false';
    if (status && !PLAN_STATUSES.has(status)) return res.status(400).json({ error: 'INVALID_INSTRUMENTATION_STATUS' });
    if (adapterId && !ADAPTERS.has(adapterId)) return res.status(400).json({ error: 'INVALID_INSTRUMENTATION_ADAPTER' });
    if (!['true', 'false', 'all'].includes(archived)) return res.status(400).json({ error: 'INVALID_ARCHIVED_FILTER' });
    // A date-only `to` means "up to the end of that day", which is what someone
    // picking a range in a date field means by it.
    const from = typeof req.query.from === 'string' && req.query.from.trim() ? new Date(req.query.from.trim()) : null;
    const rawTo = typeof req.query.to === 'string' ? req.query.to.trim() : '';
    const to = rawTo ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(rawTo) ? `${rawTo}T23:59:59.999Z` : rawTo) : null;
    if ((from && Number.isNaN(from.getTime())) || (to && Number.isNaN(to.getTime()))) {
      return res.status(400).json({ error: 'INVALID_INSTRUMENTATION_DATE_RANGE' });
    }
    const where: Prisma.InstrumentationPlanWhereInput = {
      workspace: { applicationId: app.id, organizationId: app.organizationId },
      ...(archived === 'all' ? {} : archived === 'true' ? { archivedAt: { not: null } } : { archivedAt: null }),
      ...(status ? { status: status as never } : {}),
      ...(adapterId ? { adapterId } : {}),
      ...(from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
      ...(query ? await titleSearch(app.id, query) : {}),
    };
    const plans = await prisma.instrumentationPlan.findMany({
      where,
      include: { patchSets: { orderBy: { createdAt: 'desc' }, take: 1 } }, orderBy: { createdAt: 'desc' }, take: 100,
    });
    res.json(await withTitles(plans));
  });

  router.get('/v1/applications/:appId/instrumentation/plans/:planId', async (req: InstrumentationRequest, res: Response) => {
    const plan = await planFor(req, res);
    if (plan) res.json((await withTitles([plan]))[0]);
  });

  /** Rename a setup task. An empty title restores the derived one. */
  router.patch('/v1/applications/:appId/instrumentation/plans/:planId', async (req: InstrumentationRequest, res: Response) => {
    const plan = await planFor(req, res);
    if (!plan) return;
    const title = normalizeInstrumentationTitle(req.body?.title);
    if (title === undefined) return res.status(400).json({ error: 'INVALID_INSTRUMENTATION_TITLE' });
    const previous = (await withTitles([plan]))[0].title;
    const updated = await prisma.instrumentationPlan.update({ where: { id: plan.id }, data: { title } });
    const [serialized] = await withTitles([{ ...updated, patchSets: plan.patchSets }]);
    if (serialized.title !== previous) {
      await auditLog(req, plan.workspace.organizationId, AuditAction.INSTRUMENTATION_RENAMED, {
        planId: plan.id, applicationId: plan.workspace.applicationId, adapterId: plan.adapterId,
        purpose: plan.purpose, previousTitle: previous, title: serialized.title, derived: title === null,
      });
      await audit(plan.workspace.organizationId, plan.workspace.applicationId, req.user!.id, 'INSTRUMENTATION_RENAMED', { planId: plan.id, title: serialized.title });
    }
    res.json(serialized);
  });

  /**
   * Archive a setup task: it keeps its history and can be restored, but it
   * leaves every working list — including the manifests a QA run can be started
   * against, which is the point of filing one away.
   */
  router.post('/v1/applications/:appId/instrumentation/plans/:planId/archive', async (req: InstrumentationRequest, res: Response) => {
    const plan = await planFor(req, res);
    if (!plan) return;
    if (ARCHIVE_BLOCKING_STATUSES.has(plan.status)) return res.status(409).json({ error: 'PLAN_IN_PROGRESS' });
    if (plan.archivedAt) return res.json((await withTitles([plan]))[0]);
    const updated = await prisma.instrumentationPlan.update({
      where: { id: plan.id },
      data: { archivedAt: new Date(), archivedByUserId: req.user!.id },
    });
    const [serialized] = await withTitles([{ ...updated, patchSets: plan.patchSets }]);
    await auditLog(req, plan.workspace.organizationId, AuditAction.INSTRUMENTATION_ARCHIVED, {
      planId: plan.id, applicationId: plan.workspace.applicationId, adapterId: plan.adapterId,
      purpose: plan.purpose, status: plan.status, title: serialized.title,
    });
    await audit(plan.workspace.organizationId, plan.workspace.applicationId, req.user!.id, 'INSTRUMENTATION_ARCHIVED', { planId: plan.id, title: serialized.title });
    res.json(serialized);
  });

  /** Restore an archived setup task to the working list. */
  router.post('/v1/applications/:appId/instrumentation/plans/:planId/restore', async (req: InstrumentationRequest, res: Response) => {
    const plan = await planFor(req, res);
    if (!plan) return;
    if (!plan.archivedAt) return res.json((await withTitles([plan]))[0]);
    const updated = await prisma.instrumentationPlan.update({
      where: { id: plan.id },
      data: { archivedAt: null, archivedByUserId: null },
    });
    const [serialized] = await withTitles([{ ...updated, patchSets: plan.patchSets }]);
    await auditLog(req, plan.workspace.organizationId, AuditAction.INSTRUMENTATION_RESTORED, {
      planId: plan.id, applicationId: plan.workspace.applicationId, adapterId: plan.adapterId,
      purpose: plan.purpose, status: plan.status, title: serialized.title,
      archivedAt: plan.archivedAt.toISOString(),
    });
    await audit(plan.workspace.organizationId, plan.workspace.applicationId, req.user!.id, 'INSTRUMENTATION_RESTORED', { planId: plan.id, title: serialized.title });
    res.json(serialized);
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
    // The plan and the Flow initialization waiting on it change together, so a
    // Flow is never left on the automatic path behind a plan that is closed.
    const reset = flowInitializationResetOnRejection(plan);
    const { rejected, flowInitializationsReset } = await prisma.$transaction(async (tx) => {
      const rejected = await tx.instrumentationPlan.update({ where: { id: plan.id }, data: { status: 'REJECTED', rejectionReasonSafe: safeReason(req.body.reason), completedAt: new Date() } });
      const flowInitializationsReset = reset ? (await tx.flowInitialization.updateMany(reset)).count : 0;
      return { rejected, flowInitializationsReset };
    });
    await audit(plan.workspace.organizationId, plan.workspace.applicationId, req.user!.id, 'INSTRUMENTATION_PLAN_REJECTED', { planId: plan.id, flowInitializationsReset });
    res.json({ ...rejected, flowInitializationsReset });
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
