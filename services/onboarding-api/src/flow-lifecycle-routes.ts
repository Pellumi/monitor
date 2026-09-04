import { Router, type NextFunction, type Request, type Response } from 'express';
import type { PrismaClient } from '@tellann/db';
import { analyzeFlowInitialization, buildManualRoadmap, calculateCheckpointCoverage, evaluateCodeScanCoverage } from './flow-initialization-analysis';
import { sdkReadiness } from './sdk-setup-routes';
import { enrichFlowCodeReview } from './flow-review-enrichment';

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

  function scheduleReportEnrichment(initializationId: string, report: Record<string, any>, baseProvenance: Record<string, unknown>) {
    void enrichFlowCodeReview(report)
      .then((enriched) => prisma.flowInitialization.update({ where: { id: initializationId }, data: {
        stage: 'REVIEW_READY', codeReviewReport: enriched.report as any, reportProvenance: { ...baseProvenance, ...enriched.provenance, completedAt: new Date().toISOString() },
      } }))
      .catch((error) => prisma.flowInitialization.update({ where: { id: initializationId }, data: {
        stage: 'REVIEW_READY', reportProvenance: { ...baseProvenance, engine: 'RULES_FALLBACK', aiErrorSafe: String(error instanceof Error ? error.message : error).slice(0, 500), completedAt: new Date().toISOString() },
      } }).catch(() => undefined));
  }

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
    const readiness = await sdkReadiness(prisma, flow.applicationId, environment.id);
    if (!readiness.connected || !readiness.installationTestPassed) {
      return res.status(428).json({ error: 'TELLANN_SDK_INITIALIZATION_REQUIRED', readiness, setupUrl: `/applications/${flow.applicationId}/sdk-setup?environmentId=${environment.id}` });
    }
    const binding = await prisma.flowProjectBinding.upsert({
      where: { flowVersionId_workspaceId_environmentId: { flowVersionId: version.id, workspaceId: workspace.id, environmentId: environment.id } },
      create: { organizationId: workspace.organizationId, applicationId: flow.applicationId, flowId: flow.id, flowVersionId: version.id, workspaceId: workspace.id, environmentId: environment.id, status: 'INITIALIZING' },
      update: { status: 'INITIALIZING' },
    });
    const existing = await prisma.flowInitialization.findUnique({
      where: { bindingId_flowVersionId: { bindingId: binding.id, flowVersionId: version.id } },
      include: { scan: true },
    });
    if (existing?.scan.repositorySnapshotId === repository.id && !['FAILED', 'ROLLED_BACK'].includes(existing.status)) {
      return res.status(200).json({ binding, scan: existing.scan, initialization: existing, codeReviewReport: existing.codeReviewReport, idempotent: true });
    }
    let analysis: ReturnType<typeof analyzeFlowInitialization>;
    try {
      analysis = analyzeFlowInitialization(version.snapshot as any, repository as any, version.id, String((version as any).graphHash ?? ''), flow.name);
    } catch (error) {
      await prisma.flowProjectBinding.update({ where: { id: binding.id }, data: { status: 'FAILED' } });
      return res.status(422).json({ error: error instanceof Error ? error.message : 'FLOW_ANALYSIS_FAILED' });
    }
    const { manifest, report } = analysis;
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
    const roadmapRevision = (existing?.roadmapRevision ?? 0) + 1;
    const initialization = await prisma.flowInitialization.upsert({
      where: { bindingId_flowVersionId: { bindingId: binding.id, flowVersionId: version.id } },
      create: { organizationId: workspace.organizationId, applicationId: flow.applicationId, flowId: flow.id, flowVersionId: version.id, bindingId: binding.id, scanId: scan.id, instrumentationPlanId: typeof req.body.instrumentationPlanId === 'string' ? req.body.instrumentationPlanId : null, stage: 'SCANNING', manifestVersion: manifest.version, manifest: manifest as any, reportProvenance: { engine: report.engine, repositorySnapshotId: repository.id, graphHash: manifest.graphHash, status: 'ENRICHING' }, roadmapRevision, manualRoadmap: buildManualRoadmap(manifest, roadmapRevision, report) as any, codeReviewReport: report as any },
      update: { scanId: scan.id, instrumentationPlanId: typeof req.body.instrumentationPlanId === 'string' ? req.body.instrumentationPlanId : undefined, stage: 'SCANNING', manifestVersion: manifest.version, manifest: manifest as any, reportProvenance: { engine: report.engine, repositorySnapshotId: repository.id, graphHash: manifest.graphHash, status: 'ENRICHING' }, roadmapRevision, manualRoadmap: buildManualRoadmap(manifest, roadmapRevision, report) as any, verification: undefined, codeReviewReport: report as any, status: 'PROPOSED', failureReasonSafe: null },
    });
    scheduleReportEnrichment(initialization.id, report, { repositorySnapshotId: repository.id, graphHash: manifest.graphHash });
    await prisma.flowProjectBinding.update({ where: { id: binding.id }, data: { currentScanId: scan.id } });
    return res.status(201).json({ binding, scan, initialization, codeReviewReport: report });
  });

  async function ownedInitialization(req: FlowRequest, res: Response) {
    const initialization = await prisma.flowInitialization.findFirst({
      where: { id: req.params.initializationId, flow: { application: { organization: { memberships: { some: { userId: req.user!.id } } } } } },
      include: { binding: true, scan: true, flowVersion: true, flow: true },
    });
    if (!initialization) res.status(404).json({ error: 'FLOW_INITIALIZATION_NOT_FOUND' });
    return initialization;
  }

  router.get('/flow-initializations/:initializationId', async (req: FlowRequest, res: Response) => {
    const initialization = await ownedInitialization(req, res);
    if (initialization) res.json(initialization);
  });

  router.get('/flow-initializations/:initializationId/report', async (req: FlowRequest, res: Response) => {
    const initialization = await ownedInitialization(req, res);
    if (initialization) res.json({ initializationId: initialization.id, report: initialization.codeReviewReport, provenance: initialization.reportProvenance });
  });

  router.get('/flow-initializations/:initializationId/roadmap', async (req: FlowRequest, res: Response) => {
    const initialization = await ownedInitialization(req, res);
    if (initialization) res.json({ initializationId: initialization.id, roadmap: initialization.manualRoadmap, verification: initialization.verification });
  });

  router.post('/flow-initializations/:initializationId/mode', async (req: FlowRequest, res: Response) => {
    const initialization = await ownedInitialization(req, res);
    if (!initialization) return;
    const mode = req.body?.mode === 'MANUAL' ? 'MANUAL' : req.body?.mode === 'AUTOMATED' ? 'AUTOMATED' : null;
    if (!mode) return res.status(400).json({ error: 'INVALID_FLOW_INITIALIZATION_MODE' });
    const stage = mode === 'MANUAL' ? 'ROADMAP_READY' : 'AWAITING_APPROVAL';
    const updated = await prisma.flowInitialization.update({ where: { id: initialization.id }, data: { mode, stage } });
    return res.json(updated);
  });

  router.post('/flow-initializations/:initializationId/analyze', async (req: FlowRequest, res: Response) => {
    const initialization = await ownedInitialization(req, res);
    if (!initialization) return;
    const repository = await prisma.repositorySnapshot.findFirst({ where: { id: initialization.scan.repositorySnapshotId, workspaceId: initialization.binding.workspaceId } });
    if (!repository) return res.status(404).json({ error: 'REPOSITORY_SNAPSHOT_NOT_FOUND' });
    try {
      const { manifest, report } = analyzeFlowInitialization(initialization.flowVersion.snapshot as any, repository as any, initialization.flowVersionId, String((initialization.flowVersion as any).graphHash ?? ''), initialization.flow?.name);
      const roadmapRevision = initialization.roadmapRevision + 1;
      const updated = await prisma.flowInitialization.update({ where: { id: initialization.id }, data: {
        stage: 'SCANNING', manifest: manifest as any, codeReviewReport: report as any,
        reportProvenance: { engine: report.engine, repositorySnapshotId: repository.id, graphHash: manifest.graphHash, status: 'ENRICHING' },
        roadmapRevision, manualRoadmap: buildManualRoadmap(manifest, roadmapRevision, report) as any,
      } });
      scheduleReportEnrichment(initialization.id, report, { repositorySnapshotId: repository.id, graphHash: manifest.graphHash });
      return res.json(updated);
    } catch (error) {
      return res.status(422).json({ error: error instanceof Error ? error.message : 'FLOW_ANALYSIS_FAILED' });
    }
  });

  router.post('/flow-initializations/:initializationId/roadmap/:stepId/progress', async (req: FlowRequest, res: Response) => {
    const initialization = await ownedInitialization(req, res);
    if (!initialization) return;
    if (initialization.mode !== 'MANUAL') return res.status(409).json({ error: 'MANUAL_INITIALIZATION_REQUIRED' });
    const roadmap = initialization.manualRoadmap as any;
    if (!roadmap || !Array.isArray(roadmap.steps)) return res.status(409).json({ error: 'MANUAL_ROADMAP_NOT_READY' });
    const step = roadmap.steps.find((item: any) => item.id === req.params.stepId);
    if (!step) return res.status(404).json({ error: 'ROADMAP_STEP_NOT_FOUND' });
    if (step.status === 'VERIFIED') return res.json({ roadmap, verification: initialization.verification });
    step.status = req.body?.completed === false ? 'PENDING' : 'DONE';
    step.userCompletedAt = req.body?.completed === false ? null : new Date().toISOString();
    const updated = await prisma.flowInitialization.update({ where: { id: initialization.id }, data: { manualRoadmap: roadmap } });
    return res.json({ roadmap: updated.manualRoadmap, verification: updated.verification });
  });

  router.post('/flow-initializations/:initializationId/verification/start', async (req: FlowRequest, res: Response) => {
    const initialization = await ownedInitialization(req, res);
    if (!initialization) return;
    if (!initialization.mode) return res.status(409).json({ error: 'FLOW_INITIALIZATION_MODE_REQUIRED' });
    const startedAt = new Date().toISOString();
    const manifest = initialization.manifest as any;
    const verification = { status: 'WAITING_FOR_INITIAL', startedAt, observedCheckpointIds: [], missingCheckpointIds: (manifest?.checkpoints ?? []).filter((item: any) => item.required).map((item: any) => item.id), reachedTerminalStateIds: [], orderingErrors: [], verifiedPath: [], lastEventAt: null };
    const updated = await prisma.flowInitialization.update({ where: { id: initialization.id }, data: { stage: 'AWAITING_TELEMETRY', verification } });
    return res.status(201).json({ initializationId: updated.id, verification: updated.verification });
  });

  /**
   * Initialize a flow from markers found in the attached project, without waiting
   * for the user to run their app. The desktop app performs the search locally —
   * source never leaves the device — and posts the marker hits here; this route is
   * what decides whether they satisfy the declared boundaries.
   */
  router.post('/flow-initializations/:initializationId/verification/code-scan', async (req: FlowRequest, res: Response) => {
    const initialization = await ownedInitialization(req, res);
    if (!initialization) return;
    if (!initialization.mode) return res.status(409).json({ error: 'FLOW_INITIALIZATION_MODE_REQUIRED' });
    const manifest = initialization.manifest as any;
    if (!manifest?.checkpoints?.length) return res.status(409).json({ error: 'FLOW_MANIFEST_NOT_READY' });
    const matches = records(req.body?.matches).map((match) => ({
      file: String(match.file ?? ''),
      line: Number(match.line) || 0,
      eventType: typeof match.eventType === 'string' ? match.eventType : null,
      flow: typeof match.flow === 'string' ? match.flow : null,
      state: typeof match.state === 'string' ? match.state : null,
      transition: typeof match.transition === 'string' ? match.transition : null,
      checkpointId: typeof match.checkpointId === 'string' ? match.checkpointId : null,
    }));
    const verification = evaluateCodeScanCoverage(manifest, matches, new Date().toISOString());
    const completed = verification.status === 'COMPLETED';
    const roadmap = initialization.manualRoadmap as any;
    if (roadmap?.steps) {
      roadmap.steps = roadmap.steps.map((step: any) => verification.observedCheckpointIds.includes(step.checkpointId)
        ? { ...step, status: 'VERIFIED', verificationEvidence: verification.codeEvidence.filter((item) => item.checkpointId === step.checkpointId) }
        : step);
    }
    const [updated] = await prisma.$transaction([
      prisma.flowInitialization.update({ where: { id: initialization.id }, data: {
        verification: verification as any, manualRoadmap: roadmap ?? undefined,
        ...(completed ? { status: 'COMPLETED', stage: 'COMPLETED', completedAt: new Date() } : {}),
      } }),
      ...(completed ? [prisma.flowProjectBinding.update({ where: { id: initialization.bindingId }, data: { status: 'ACTIVE', initializedAt: new Date() } })] : []),
    ]);
    // A scan that found no boundary marker is a normal outcome the user acts on,
    // not a failed request: the caller needs the resolved verification either way,
    // so the outcome travels in the body rather than in the status code.
    return res.json({
      initializationId: updated.id,
      completed,
      verification: updated.verification,
      roadmap: updated.manualRoadmap,
      initialization: updated,
      missingCheckpointIds: verification.missingCheckpointIds,
    });
  });

  router.get('/flow-initializations/:initializationId/verification', async (req: FlowRequest, res: Response) => {
    const initialization = await ownedInitialization(req, res);
    if (!initialization) return;
    const manifest = initialization.manifest as any;
    const current = initialization.verification as any;
    if (!manifest || !current?.startedAt) return res.json({ initializationId: initialization.id, verification: current });
    const events = await prisma.sessionEvent.findMany({ where: {
      session: { applicationId: initialization.applicationId, environmentId: initialization.binding.environmentId },
      timestamp: { gte: new Date(current.startedAt) },
    }, orderBy: { timestamp: 'asc' }, take: 2000 });
    const checkpointIds = new Set((manifest.checkpoints ?? []).map((item: any) => item.id));
    const observed = events.flatMap((event) => {
      const metadata = event.metadata as any;
      const checkpointId = typeof metadata?.checkpointId === 'string' ? metadata.checkpointId : null;
      return checkpointId && checkpointIds.has(checkpointId) ? [{ checkpointId, timestamp: event.timestamp.toISOString(), eventId: event.id, sessionId: event.sessionId }] : [];
    });
    const verification = calculateCheckpointCoverage(manifest, observed, current.startedAt);
    const observedIds = verification.observedCheckpointIds;
    const completed = verification.status === 'COMPLETED';
    const roadmap = initialization.manualRoadmap as any;
    if (roadmap?.steps) roadmap.steps = roadmap.steps.map((step: any) => observedIds.includes(step.checkpointId) ? { ...step, status: 'VERIFIED', verificationEvidence: observed.filter((item) => item.checkpointId === step.checkpointId) } : step);
    const [updated] = await prisma.$transaction([
      prisma.flowInitialization.update({ where: { id: initialization.id }, data: { verification, manualRoadmap: roadmap ?? undefined, ...(completed ? { status: 'COMPLETED', stage: 'COMPLETED', completedAt: new Date() } : {}) } }),
      ...(completed ? [prisma.flowProjectBinding.update({ where: { id: initialization.bindingId }, data: { status: 'ACTIVE', initializedAt: new Date() } })] : []),
    ]);
    return res.json({ initializationId: updated.id, verification: updated.verification, roadmap: updated.manualRoadmap });
  });

  router.post('/flow-initializations/:initializationId/approve', async (req: FlowRequest, res: Response) => {
    const initialization = await ownedInitialization(req, res);
    if (!initialization) return;
    const instrumentationPlanId = typeof req.body?.instrumentationPlanId === 'string' ? req.body.instrumentationPlanId : initialization.instrumentationPlanId;
    if (!instrumentationPlanId) return res.status(400).json({ error: 'FLOW_INSTRUMENTATION_PLAN_REQUIRED' });
    const plan = await prisma.instrumentationPlan.findFirst({ where: { id: instrumentationPlanId, workspace: { applicationId: initialization.applicationId }, flowId: initialization.flowId, flowVersionId: initialization.flowVersionId, purpose: 'FLOW' } });
    if (!plan) return res.status(404).json({ error: 'MATCHING_FLOW_INSTRUMENTATION_PLAN_NOT_FOUND' });
    const updated = await prisma.flowInitialization.update({ where: { id: initialization.id }, data: { mode: 'AUTOMATED', stage: 'AWAITING_APPROVAL', instrumentationPlanId, status: 'APPROVED', approvedByUserId: req.user!.id, approvedAt: new Date() } });
    return res.json({ ...updated, next: initialization.instrumentationPlanId ? `/v1/applications/${initialization.applicationId}/instrumentation/plans/${initialization.instrumentationPlanId}/apply-intent` : null });
  });

  router.post('/flow-initializations/:initializationId/apply', async (req: FlowRequest, res: Response) => {
    const initialization = await ownedInitialization(req, res);
    if (!initialization) return;
    if (initialization.status !== 'APPROVED' && initialization.status !== 'APPLYING') return res.status(409).json({ error: 'FLOW_INITIALIZATION_NOT_APPROVED' });
    const patch = await prisma.patchSet.findFirst({ where: { id: String(req.body.patchSetId ?? ''), workspaceId: initialization.binding.workspaceId, instrumentationPlanId: initialization.instrumentationPlanId ?? undefined } });
    if (!patch) return res.status(404).json({ error: 'VALIDATED_FLOW_PATCH_NOT_FOUND' });
    const updated = await prisma.flowInitialization.update({ where: { id: initialization.id }, data: { status: 'VALIDATING', stage: 'APPLYING', patchSetId: patch.id } });
    return res.json(updated);
  });

  router.post('/flow-initializations/:initializationId/validate', async (req: FlowRequest, res: Response) => {
    const initialization = await ownedInitialization(req, res);
    if (!initialization) return;
    const patch = initialization.patchSetId ? await prisma.patchSet.findUnique({ where: { id: initialization.patchSetId } }) : null;
    const valid = patch?.status === 'VALIDATED' || req.body.observationOnly === true;
    if (!valid) return res.status(422).json({ error: 'FLOW_MARKER_VALIDATION_FAILED', patchStatus: patch?.status ?? null });
    const validation = { valid: true, structuralChecks: req.body.checkpointReachability ?? null, runtimeVerificationRequired: true, validatedAt: new Date().toISOString() };
    const updated = await prisma.flowInitialization.update({ where: { id: initialization.id }, data: { stage: 'AWAITING_TELEMETRY', validation } });
    if (patch?.id) await prisma.flowProjectBinding.update({ where: { id: initialization.bindingId }, data: { currentPatchSetId: patch.id } });
    return res.json(updated);
  });

  router.post('/flow-bindings/:bindingId/rescans', async (req: FlowRequest, res: Response) => {
    const binding = await prisma.flowProjectBinding.findFirst({
      where: { id: req.params.bindingId, flow: { application: { organization: { memberships: { some: { userId: req.user!.id } } } } } },
      include: { flowVersion: true, flow: true, scans: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });
    if (!binding) return res.status(404).json({ error: 'FLOW_BINDING_NOT_FOUND' });
    if (binding.status !== 'ACTIVE') return res.status(409).json({ error: 'FLOW_BINDING_NOT_ACTIVE' });
    const previous = binding.scans[0];
    if (!previous) return res.status(409).json({ error: 'INITIAL_FLOW_SCAN_REQUIRED' });
    const repository = await prisma.repositorySnapshot.findFirst({ where: { id: String(req.body.repositorySnapshotId ?? ''), workspaceId: binding.workspaceId } });
    if (!repository) return res.status(404).json({ error: 'REPOSITORY_SNAPSHOT_NOT_FOUND' });
    const { report } = analyzeFlowInitialization(binding.flowVersion.snapshot as any, repository as any, binding.flowVersionId, String((binding.flowVersion as any).graphHash ?? ''), binding.flow?.name);
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
