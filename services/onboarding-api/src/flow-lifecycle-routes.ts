import { Router, type NextFunction, type Request, type Response } from 'express';
import type { PrismaClient } from '@sots/db';

type FlowRequest = Request & { user?: { id: string; email: string } };
type Middleware = (req: FlowRequest, res: Response, next: NextFunction) => unknown;

function records(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object') : [];
}

function keys(value: unknown, candidates: string[]): Set<string> {
  const result = new Set<string>();
  for (const item of records(value)) {
    for (const candidate of candidates) {
      const entry = item[candidate];
      if (typeof entry === 'string' && entry.trim()) {
        result.add(entry.trim().toLowerCase());
        break;
      }
    }
  }
  return result;
}

function conformanceReport(snapshot: any, repository: any) {
  const states = records(snapshot?.states ?? snapshot?.nodes);
  const transitions = records(snapshot?.transitions ?? snapshot?.edges);
  const routeKeys = keys(repository?.routeSummary, ['path', 'route', 'name']);
  const endpointKeys = keys(repository?.endpointSummary, ['path', 'route', 'name']);
  const searchable = new Set([...routeKeys, ...endpointKeys]);
  const stateFindings = states.map((state) => {
    const name = String(state.behaviorKey ?? state.stateName ?? state.name ?? '').toLowerCase();
    const matched = [...searchable].some((candidate) => name && (candidate.includes(name) || name.includes(candidate)));
    return { stateId: state.id, stateName: state.stateName ?? state.name, implemented: matched, confidence: matched ? 0.75 : 0.35 };
  });
  const transitionFindings = transitions.map((transition) => ({
    transitionId: transition.id,
    action: transition.action ?? null,
    implemented: Boolean(transition.endpointRef || transition.componentRef),
    confidence: transition.endpointRef || transition.componentRef ? 0.8 : 0.3,
  }));
  const missingStates = stateFindings.filter((item) => !item.implemented);
  const incompleteTransitions = transitionFindings.filter((item) => !item.implemented);
  return {
    kind: 'FLOW_CODE_REVIEW',
    generatedAt: new Date().toISOString(),
    stateFindings,
    transitionFindings,
    missingStates,
    incompleteTransitions,
    uncoveredTerminalOutcomes: states.filter((state) => state.role === 'TERMINAL' && missingStates.some((item) => item.stateId === state.id)),
    routeMappings: [...routeKeys],
    endpointMappings: [...endpointKeys],
    instrumentationCoverage: { mappedStates: stateFindings.length - missingStates.length, totalStates: states.length },
    limitations: ['Static repository evidence is confidence-scored and must be confirmed by a boundary-aware QA run.'],
  };
}

function setDiff(previous: Set<string>, current: Set<string>) {
  return {
    added: [...current].filter((item) => !previous.has(item)),
    removed: [...previous].filter((item) => !current.has(item)),
    unchanged: [...current].filter((item) => previous.has(item)),
  };
}

export function createFlowLifecycleRouter(input: {
  prisma: PrismaClient;
  verifyJwt: Middleware;
  verifyAppOwnership: Middleware;
}) {
  const { prisma, verifyJwt, verifyAppOwnership } = input;
  const router = Router();

  router.use('/applications/:appId/connections', verifyJwt, verifyAppOwnership);
  router.use('/flows/:flowId', verifyJwt);
  router.use('/flow-initializations/:initializationId', verifyJwt);
  router.use('/flow-bindings/:bindingId', verifyJwt);

  async function ownedFlow(req: FlowRequest, res: Response, flowId: string) {
    const flow = await prisma.behaviorGraph.findFirst({
      where: { id: flowId, application: { organization: { memberships: { some: { userId: req.user!.id } } } } },
      include: { versions: { orderBy: { version: 'desc' } } },
    });
    if (!flow) res.status(404).json({ error: 'FLOW_NOT_FOUND' });
    return flow;
  }

  router.post('/applications/:appId/connections', async (req: FlowRequest, res: Response) => {
    const application = await prisma.application.findUnique({ where: { id: req.params.appId } });
    if (!application?.organizationId) return res.status(404).json({ error: 'APPLICATION_NOT_FOUND' });
    const workspace = await prisma.projectWorkspace.findFirst({ where: { id: String(req.body.workspaceId ?? ''), applicationId: application.id, organizationId: application.organizationId } });
    const environment = await prisma.environment.findFirst({ where: { id: String(req.body.environmentId ?? ''), applicationId: application.id } });
    if (!workspace || !environment) return res.status(404).json({ error: 'WORKSPACE_OR_ENVIRONMENT_NOT_FOUND' });
    const connection = await prisma.projectConnection.upsert({
      where: { workspaceId_environmentId: { workspaceId: workspace.id, environmentId: environment.id } },
      create: {
        organizationId: application.organizationId,
        applicationId: application.id,
        workspaceId: workspace.id,
        environmentId: environment.id,
        createdByUserId: req.user!.id,
        detectedStack: req.body.detectedStack ?? workspace.detectedStack ?? undefined,
        sdkTargets: req.body.sdkTargets ?? undefined,
      },
      update: { detectedStack: req.body.detectedStack ?? workspace.detectedStack ?? undefined, sdkTargets: req.body.sdkTargets ?? undefined },
    });
    return res.status(201).json({ ...connection, bootstrapContract: { allowedEvents: ['TELLANN_INITIALIZED'], flowMarkersAllowed: false } });
  });

  router.post('/applications/:appId/connections/:connectionId/verify', async (req: FlowRequest, res: Response) => {
    if (req.body.eventName !== 'TELLANN_INITIALIZED') return res.status(422).json({ error: 'BOOTSTRAP_EVENT_REQUIRED' });
    const connection = await prisma.projectConnection.findFirst({ where: { id: req.params.connectionId, applicationId: req.params.appId } });
    if (!connection) return res.status(404).json({ error: 'CONNECTION_NOT_FOUND' });
    const now = new Date();
    return res.json(await prisma.projectConnection.update({ where: { id: connection.id }, data: {
      initializationEventVerified: true,
      initializationEventAt: connection.initializationEventAt ?? now,
      connectedAt: connection.connectedAt ?? now,
      lastVerifiedAt: now,
    } }));
  });

  router.post('/flows/:flowId/initializations', async (req: FlowRequest, res: Response) => {
    const flow = await ownedFlow(req, res, req.params.flowId);
    if (!flow) return;
    const versionId = String(req.body.flowVersionId ?? flow.publishedVersionId ?? '');
    const version = flow.versions.find((item) => item.id === versionId);
    if (!version || flow.lifecycleStatus !== 'PUBLISHED') return res.status(409).json({ error: 'PUBLISHED_FLOW_VERSION_REQUIRED' });
    const workspace = await prisma.projectWorkspace.findFirst({ where: { id: String(req.body.workspaceId ?? ''), applicationId: flow.applicationId } });
    const environment = await prisma.environment.findFirst({ where: { id: String(req.body.environmentId ?? ''), applicationId: flow.applicationId } });
    const repository = await prisma.repositorySnapshot.findFirst({ where: { id: String(req.body.repositorySnapshotId ?? ''), workspaceId: workspace?.id ?? '' } });
    if (!workspace || !environment || !repository) return res.status(404).json({ error: 'FLOW_INITIALIZATION_CONTEXT_NOT_FOUND' });
    if (environment.type === 'PRODUCTION') return res.status(403).json({ error: 'PRODUCTION_OBSERVATION_ONLY' });
    const binding = await prisma.flowProjectBinding.upsert({
      where: { flowVersionId_workspaceId_environmentId: { flowVersionId: version.id, workspaceId: workspace.id, environmentId: environment.id } },
      create: { organizationId: workspace.organizationId, applicationId: flow.applicationId, flowId: flow.id, flowVersionId: version.id, workspaceId: workspace.id, environmentId: environment.id, status: 'INITIALIZING' },
      update: { status: 'INITIALIZING' },
    });
    const report = conformanceReport(version.snapshot, repository);
    const scan = await prisma.flowScan.create({ data: {
      organizationId: workspace.organizationId,
      applicationId: flow.applicationId,
      flowId: flow.id,
      flowVersionId: version.id,
      bindingId: binding.id,
      repositorySnapshotId: repository.id,
      kind: 'INITIALIZATION',
      status: 'COMPLETED',
      scannerVersion: repository.scannerVersion,
      detectedRoutes: repository.routeSummary as any,
      detectedEndpoints: repository.endpointSummary as any,
      detectedComponents: repository.frameworkSummary as any,
      conformanceFindings: report as any,
      startedAt: new Date(),
      completedAt: new Date(),
    } });
    const initialization = await prisma.flowInitialization.upsert({
      where: { bindingId_flowVersionId: { bindingId: binding.id, flowVersionId: version.id } },
      create: { organizationId: workspace.organizationId, applicationId: flow.applicationId, flowId: flow.id, flowVersionId: version.id, bindingId: binding.id, scanId: scan.id, instrumentationPlanId: typeof req.body.instrumentationPlanId === 'string' ? req.body.instrumentationPlanId : null, codeReviewReport: report as any },
      update: { scanId: scan.id, instrumentationPlanId: typeof req.body.instrumentationPlanId === 'string' ? req.body.instrumentationPlanId : undefined, codeReviewReport: report as any, status: 'PROPOSED' },
    });
    await prisma.flowProjectBinding.update({ where: { id: binding.id }, data: { currentScanId: scan.id } });
    return res.status(201).json({ binding, scan, initialization, codeReviewReport: report });
  });

  async function ownedInitialization(req: FlowRequest, res: Response) {
    const initialization = await prisma.flowInitialization.findFirst({
      where: { id: req.params.initializationId, flow: { application: { organization: { memberships: { some: { userId: req.user!.id } } } } } },
      include: { binding: true },
    });
    if (!initialization) res.status(404).json({ error: 'FLOW_INITIALIZATION_NOT_FOUND' });
    return initialization;
  }

  router.post('/flow-initializations/:initializationId/approve', async (req: FlowRequest, res: Response) => {
    const initialization = await ownedInitialization(req, res);
    if (!initialization) return;
    const instrumentationPlanId = typeof req.body?.instrumentationPlanId === 'string' ? req.body.instrumentationPlanId : initialization.instrumentationPlanId;
    if (!instrumentationPlanId) return res.status(400).json({ error: 'FLOW_INSTRUMENTATION_PLAN_REQUIRED' });
    const plan = await prisma.instrumentationPlan.findFirst({ where: { id: instrumentationPlanId, workspace: { applicationId: initialization.applicationId }, flowId: initialization.flowId, flowVersionId: initialization.flowVersionId, purpose: 'FLOW' } });
    if (!plan) return res.status(404).json({ error: 'MATCHING_FLOW_INSTRUMENTATION_PLAN_NOT_FOUND' });
    const updated = await prisma.flowInitialization.update({ where: { id: initialization.id }, data: { instrumentationPlanId, status: 'APPROVED', approvedByUserId: req.user!.id, approvedAt: new Date() } });
    return res.json({ ...updated, next: initialization.instrumentationPlanId ? `/v1/applications/${initialization.applicationId}/instrumentation/plans/${initialization.instrumentationPlanId}/apply-intent` : null });
  });

  router.post('/flow-initializations/:initializationId/apply', async (req: FlowRequest, res: Response) => {
    const initialization = await ownedInitialization(req, res);
    if (!initialization) return;
    if (initialization.status !== 'APPROVED' && initialization.status !== 'APPLYING') return res.status(409).json({ error: 'FLOW_INITIALIZATION_NOT_APPROVED' });
    const patch = await prisma.patchSet.findFirst({ where: { id: String(req.body.patchSetId ?? ''), workspaceId: initialization.binding.workspaceId, instrumentationPlanId: initialization.instrumentationPlanId ?? undefined } });
    if (!patch) return res.status(404).json({ error: 'VALIDATED_FLOW_PATCH_NOT_FOUND' });
    const updated = await prisma.flowInitialization.update({ where: { id: initialization.id }, data: { status: 'VALIDATING', patchSetId: patch.id } });
    return res.json(updated);
  });

  router.post('/flow-initializations/:initializationId/validate', async (req: FlowRequest, res: Response) => {
    const initialization = await ownedInitialization(req, res);
    if (!initialization) return;
    const patch = initialization.patchSetId ? await prisma.patchSet.findUnique({ where: { id: initialization.patchSetId } }) : null;
    const valid = patch?.status === 'VALIDATED' || req.body.observationOnly === true;
    if (!valid) return res.status(422).json({ error: 'FLOW_MARKER_VALIDATION_FAILED', patchStatus: patch?.status ?? null });
    const validation = { valid: true, checkpointReachability: req.body.checkpointReachability ?? null, validatedAt: new Date().toISOString() };
    const [updated] = await prisma.$transaction([
      prisma.flowInitialization.update({ where: { id: initialization.id }, data: { status: 'COMPLETED', validation, completedAt: new Date() } }),
      prisma.flowProjectBinding.update({ where: { id: initialization.bindingId }, data: { status: 'ACTIVE', currentPatchSetId: patch?.id ?? null, initializedAt: new Date() } }),
    ]);
    return res.json(updated);
  });

  router.post('/flow-bindings/:bindingId/rescans', async (req: FlowRequest, res: Response) => {
    const binding = await prisma.flowProjectBinding.findFirst({
      where: { id: req.params.bindingId, flow: { application: { organization: { memberships: { some: { userId: req.user!.id } } } } } },
      include: { flowVersion: true, scans: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });
    if (!binding) return res.status(404).json({ error: 'FLOW_BINDING_NOT_FOUND' });
    if (binding.status !== 'ACTIVE') return res.status(409).json({ error: 'FLOW_BINDING_NOT_ACTIVE' });
    const previous = binding.scans[0];
    if (!previous) return res.status(409).json({ error: 'INITIAL_FLOW_SCAN_REQUIRED' });
    const repository = await prisma.repositorySnapshot.findFirst({ where: { id: String(req.body.repositorySnapshotId ?? ''), workspaceId: binding.workspaceId } });
    if (!repository) return res.status(404).json({ error: 'REPOSITORY_SNAPSHOT_NOT_FOUND' });
    const report = conformanceReport(binding.flowVersion.snapshot, repository);
    const scan = await prisma.flowScan.create({ data: {
      organizationId: binding.organizationId, applicationId: binding.applicationId, flowId: binding.flowId, flowVersionId: binding.flowVersionId,
      bindingId: binding.id, repositorySnapshotId: repository.id, parentScanId: previous.id, kind: 'RESCAN', status: 'COMPLETED', scannerVersion: repository.scannerVersion,
      detectedRoutes: repository.routeSummary as any, detectedEndpoints: repository.endpointSummary as any, detectedComponents: repository.frameworkSummary as any,
      conformanceFindings: report as any, startedAt: new Date(), completedAt: new Date(),
    } });
    const previousRoutes = keys(previous.detectedRoutes, ['path', 'route', 'name']);
    const currentRoutes = keys(repository.routeSummary, ['path', 'route', 'name']);
    const previousEndpoints = keys(previous.detectedEndpoints, ['path', 'route', 'name']);
    const currentEndpoints = keys(repository.endpointSummary, ['path', 'route', 'name']);
    const previousConformance = previous.conformanceFindings ?? {};
    const currentConformance = report;
    const drift = await prisma.flowDrift.create({ data: {
      organizationId: binding.organizationId, applicationId: binding.applicationId, flowId: binding.flowId, flowVersionId: binding.flowVersionId,
      previousScanId: previous.id, currentScanId: scan.id,
      implementationDiff: { routes: setDiff(previousRoutes, currentRoutes), endpoints: setDiff(previousEndpoints, currentEndpoints), repositoryFingerprintChanged: previous.repositorySnapshotId !== repository.id },
      previousConformance: previousConformance as any, currentConformance: currentConformance as any,
      remediationAlignment: { improvedMissingStates: Math.max(0, Number((previousConformance as any)?.missingStates?.length ?? 0) - report.missingStates.length) },
      regressions: report.missingStates.filter((item) => !records((previousConformance as any)?.missingStates).some((old) => old.stateId === item.stateId)) as any,
      expectedFlowImpact: { flowVersionId: binding.flowVersionId, requiresRebase: false },
    } });
    await prisma.flowProjectBinding.update({ where: { id: binding.id }, data: { currentScanId: scan.id, lastRescannedAt: new Date() } });
    return res.status(201).json({ scan, drift, codeReviewReport: report });
  });

  return router;
}
