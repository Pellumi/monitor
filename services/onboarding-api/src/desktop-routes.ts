import crypto from 'crypto';
import { Router, raw, type NextFunction, type Request, type Response } from 'express';
import jwt from 'jsonwebtoken';
import {
  EnvironmentType,
  PrismaClient,
  QARunArtifactType,
  QACaptureTrack,
  QARunMode,
  QARunStatus,
  PrivacyClassification,
} from '@tellann/db';
import { Feature } from '@tellann/shared';
import type { EntitlementChecker } from '@tellann/entitlement-checker';
import type { StorageClient } from '@tellann/storage';

type DesktopRequest = Request & { user?: { id: string; email: string } };
type Middleware = (req: DesktopRequest, res: Response, next: NextFunction) => unknown;

export function productionRunModeAllowed(environmentType: EnvironmentType, mode: QARunMode): boolean {
  return environmentType !== EnvironmentType.PRODUCTION || mode === QARunMode.OBSERVATION_ONLY;
}

const TERMINAL_STATUSES = new Set<QARunStatus>([
  QARunStatus.COMPLETED,
  QARunStatus.COMPLETED_INCOMPLETE,
  QARunStatus.FAILED,
  QARunStatus.CANCELLED,
]);

function safeArtifact(artifact: { bytes: bigint } & Record<string, unknown>) {
  return { ...artifact, bytes: artifact.bytes.toString() };
}

type RepositoryBindingRow = {
  applicationId: string;
  repositoryOriginHash: string | null;
  repositoryCloneUrl: string | null;
  qaBranchName: string;
  qaBranchBase: string;
  enforcement: 'WARN' | 'BLOCK';
  allowAgentCheckout: boolean;
};

/**
 * The wire shape every client evaluates its local checkout against. `bound` is
 * false until a repository has actually been attached, which is what lets the
 * desktop distinguish "no policy yet" from "policy says you are on the wrong
 * branch" without a second round trip.
 */
export function serializeBranchPolicy(applicationId: string, binding: RepositoryBindingRow | null) {
  if (!binding) {
    return {
      applicationId,
      repositoryOriginHash: null,
      repositoryCloneUrl: null,
      qaBranchName: 'tellann/qa-review',
      qaBranchBase: 'main',
      enforcement: 'WARN' as const,
      allowAgentCheckout: false,
      bound: false,
    };
  }
  return {
    applicationId,
    repositoryOriginHash: binding.repositoryOriginHash,
    repositoryCloneUrl: binding.repositoryCloneUrl,
    qaBranchName: binding.qaBranchName,
    qaBranchBase: binding.qaBranchBase,
    enforcement: binding.enforcement,
    allowAgentCheckout: binding.allowAgentCheckout,
    bound: true,
  };
}

export function createDesktopRouter(input: {
  prisma: PrismaClient;
  entitlementChecker: EntitlementChecker;
  verifyJwt: Middleware;
  verifyAppOwnership: Middleware;
  jwtSecret: string;
  storage: StorageClient;
}) {
  const { prisma, entitlementChecker, verifyJwt, verifyAppOwnership, jwtSecret, storage } = input;
  const router = Router();

  async function authorizedRun(runId: string, userId: string) {
    return prisma.qARun.findFirst({
      where: { id: runId, organization: { memberships: { some: { userId } } } },
      include: {
        environment: true,
        workspace: true,
        repositorySnapshot: true,
        expectedGraphVersion: true,
        flow: true,
        flowBinding: true,
        flowInitialization: true,
        flowScan: true,
        flowDrift: true,
        artifacts: true,
        findings: { include: { evidence: { include: { artifact: true } } } },
      },
    });
  }

  async function markDemonstrationCompleted(run: {
    id: string;
    organizationId: string;
    applicationId: string;
    environmentId: string;
  }) {
    await prisma.$transaction(async (tx) => {
      const progress = await tx.applicationOnboardingProgress.findUnique({
        where: { applicationId: run.applicationId },
        select: { demonstrationCompleted: true },
      });
      if (!progress || progress.demonstrationCompleted) return;
      const updated = await tx.applicationOnboardingProgress.updateMany({
        where: { applicationId: run.applicationId, demonstrationCompleted: false },
        data: { demonstrationCompleted: true },
      });
      if (updated.count === 1) {
        await tx.activationEvent.create({
          data: {
            organizationId: run.organizationId,
            applicationId: run.applicationId,
            environmentId: run.environmentId,
            eventName: 'DEMO_COMPLETED',
            metadata: { source: 'DESKTOP_QA_RUN', runId: run.id },
          },
        });
      }
    });
  }

  router.post(
    '/applications/:appId/workspaces',
    verifyJwt,
    verifyAppOwnership,
    async (req: DesktopRequest, res: Response) => {
      const { appId } = req.params;
      const {
        opaqueLocalId, repositoryFingerprint, repositoryOriginHash, repositoryCloneUrl,
        portableManifestIdentity, detectedStack, packageManager,
      } = req.body ?? {};
      if (!opaqueLocalId || !repositoryFingerprint) {
        return res.status(400).json({ error: 'opaqueLocalId and repositoryFingerprint are required' });
      }
      if (req.body.absolutePath || req.body.path || req.body.workspaceRoot) {
        return res.status(400).json({ error: 'Absolute local paths must not be uploaded' });
      }
      if (repositoryCloneUrl) {
        try {
          const cloneUrl = new URL(String(repositoryCloneUrl));
          if (cloneUrl.protocol !== 'https:' || cloneUrl.hostname.toLowerCase() !== 'github.com' || cloneUrl.username || cloneUrl.password) {
            return res.status(400).json({ error: 'Only credential-free GitHub HTTPS clone URLs are accepted' });
          }
        } catch {
          return res.status(400).json({ error: 'Invalid repository clone URL' });
        }
      }

      const application = await prisma.application.findUnique({
        where: { id: appId },
        select: { organizationId: true },
      });
      if (!application?.organizationId) return res.status(404).json({ error: 'Application not found' });

      const incomingOrigin = repositoryOriginHash ? String(repositoryOriginHash) : null;
      const incomingManifest = portableManifestIdentity ? String(portableManifestIdentity) : null;

      let binding = await prisma.applicationRepositoryBinding.findUnique({
        where: { applicationId: appId },
      });

      if (!binding) {
        // The first member to attach a folder establishes what repository this
        // application is, and inherits the default QA branch policy.
        binding = await prisma.applicationRepositoryBinding.create({
          data: {
            applicationId: appId,
            repositoryOriginHash: incomingOrigin,
            repositoryCloneUrl: repositoryCloneUrl ? String(repositoryCloneUrl) : null,
            portableManifestIdentity: incomingManifest,
            boundByUserId: req.user!.id,
          },
        });
      } else if (binding.repositoryOriginHash && incomingOrigin && binding.repositoryOriginHash !== incomingOrigin) {
        // Only a positive contradiction is rejected. A missing origin hash is not
        // evidence of a wrong folder: the repository may have no GitHub remote,
        // or name its remote something other than "origin".
        return res.status(409).json({
          error: 'REPOSITORY_MISMATCH',
          message: 'This folder belongs to a different repository than the one this application is bound to.',
          expectedCloneUrl: binding.repositoryCloneUrl,
        });
      } else if (!binding.repositoryOriginHash && incomingOrigin) {
        // Backfill the strong identity once any member supplies one.
        binding = await prisma.applicationRepositoryBinding.update({
          where: { applicationId: appId },
          data: {
            repositoryOriginHash: incomingOrigin,
            repositoryCloneUrl: repositoryCloneUrl ? String(repositoryCloneUrl) : binding.repositoryCloneUrl,
          },
        });
      }

      const workspace = await prisma.projectWorkspace.upsert({
        where: {
          applicationId_createdByUserId_opaqueLocalId: {
            applicationId: appId,
            createdByUserId: req.user!.id,
            opaqueLocalId: String(opaqueLocalId),
          },
        },
        create: {
          organizationId: application.organizationId,
          applicationId: appId,
          createdByUserId: req.user!.id,
          opaqueLocalId: String(opaqueLocalId),
          repositoryFingerprint: String(repositoryFingerprint),
          repositoryOriginHash: incomingOrigin ?? undefined,
          repositoryCloneUrl: repositoryCloneUrl ? String(repositoryCloneUrl) : undefined,
          portableManifestIdentity: incomingManifest ?? undefined,
          detectedStack: detectedStack ?? undefined,
          packageManager: packageManager ? String(packageManager) : undefined,
          trustStatus: 'READ_ONLY',
          lastScannedAt: new Date(),
        },
        update: {
          repositoryFingerprint: String(repositoryFingerprint),
          repositoryOriginHash: incomingOrigin ?? undefined,
          repositoryCloneUrl: repositoryCloneUrl ? String(repositoryCloneUrl) : undefined,
          portableManifestIdentity: incomingManifest ?? undefined,
          detectedStack: detectedStack ?? undefined,
          packageManager: packageManager ? String(packageManager) : undefined,
          lastScannedAt: new Date(),
        },
      });
      res.status(201).json({ ...workspace, branchPolicy: serializeBranchPolicy(appId, binding) });
    },
  );

  router.post(
    '/applications/:appId/repository-snapshots',
    verifyJwt,
    verifyAppOwnership,
    async (req: DesktopRequest, res: Response) => {
      const {
        workspaceId, revision, branch, dirty, repositoryFingerprint, frameworkSummary,
        routeSummary, endpointSummary, documentationSummary, manifestHashes,
        scannerVersion, redactionSummary, upstreamBranch, aheadCount, behindCount,
      } = req.body ?? {};
      if (!workspaceId || !repositoryFingerprint || !scannerVersion) {
        return res.status(400).json({
          error: 'workspaceId, repositoryFingerprint, and scannerVersion are required',
        });
      }

      const workspace = await prisma.projectWorkspace.findFirst({
        where: { id: String(workspaceId), applicationId: req.params.appId },
      });
      if (!workspace) return res.status(404).json({ error: 'Workspace not found' });

      const snapshot = await prisma.repositorySnapshot.create({
        data: {
          workspaceId: workspace.id,
          revision: revision ? String(revision) : undefined,
          branch: branch ? String(branch) : undefined,
          dirty: Boolean(dirty),
          repositoryFingerprint: String(repositoryFingerprint),
          frameworkSummary: frameworkSummary ?? {},
          routeSummary: routeSummary ?? {},
          endpointSummary: endpointSummary ?? {},
          documentationSummary: documentationSummary ?? {},
          manifestHashes: manifestHashes ?? {},
          scannerVersion: String(scannerVersion),
          redactionSummary: redactionSummary ?? {},
          upstreamBranch: upstreamBranch ? String(upstreamBranch) : undefined,
          aheadCount: Number.isInteger(aheadCount) ? Number(aheadCount) : undefined,
          behindCount: Number.isInteger(behindCount) ? Number(behindCount) : undefined,
        },
      });
      res.status(201).json(snapshot);
    },
  );

  router.get(
    '/applications/:appId/workspaces',
    verifyJwt,
    verifyAppOwnership,
    async (req: DesktopRequest, res: Response) => {
      const workspaces = await prisma.projectWorkspace.findMany({
        where: { applicationId: req.params.appId },
        include: {
          snapshots: { orderBy: { createdAt: 'desc' }, take: 1 },
          permissions: { where: { revokedAt: null } },
        },
        orderBy: { updatedAt: 'desc' },
      });
      res.json(workspaces.map((workspace) => ({
        id: workspace.id,
        createdByUserId: workspace.createdByUserId,
        // Lets a client show "your workspace" without a second lookup. Two members
        // attaching the same repository now own separate rows.
        isMine: workspace.createdByUserId === req.user!.id,
        opaqueLocalId: workspace.opaqueLocalId,
        portableManifestIdentity: workspace.portableManifestIdentity,
        repositoryFingerprint: workspace.repositoryFingerprint,
        repositoryOriginHash: workspace.repositoryOriginHash,
        repositoryCloneUrl: workspace.repositoryCloneUrl,
        detectedStack: workspace.detectedStack,
        packageManager: workspace.packageManager,
        trustStatus: workspace.trustStatus,
        lastScannedAt: workspace.lastScannedAt,
        latestSnapshot: workspace.snapshots[0] ?? null,
        permissions: workspace.permissions,
      })));
    },
  );

  /** The QA branch policy every member's local checkout is measured against. */
  router.get(
    '/applications/:appId/branch-policy',
    verifyJwt,
    verifyAppOwnership,
    async (req: DesktopRequest, res: Response) => {
      const binding = await prisma.applicationRepositoryBinding.findUnique({
        where: { applicationId: req.params.appId },
      });
      res.json(serializeBranchPolicy(req.params.appId, binding));
    },
  );

  /**
   * Grants Tellann permission to move THIS member's own workspace onto the QA
   * branch. Deliberately narrow: only over a workspace the caller owns, only
   * while the organisation allows agent checkout, and only for a bounded window.
   */
  router.post(
    '/applications/:appId/workspaces/:workspaceId/qa-branch-grant',
    verifyJwt,
    verifyAppOwnership,
    async (req: DesktopRequest, res: Response) => {
      const workspace = await prisma.projectWorkspace.findFirst({
        where: { id: req.params.workspaceId, applicationId: req.params.appId },
      });
      if (!workspace) return res.status(404).json({ error: 'Workspace not found' });
      if (workspace.createdByUserId !== req.user!.id) {
        return res.status(403).json({
          error: 'FORBIDDEN',
          message: 'You can only grant workspace access on your own machine.',
        });
      }

      const binding = await prisma.applicationRepositoryBinding.findUnique({
        where: { applicationId: req.params.appId },
      });
      if (!binding?.allowAgentCheckout) {
        return res.status(403).json({
          error: 'AGENT_CHECKOUT_DISABLED',
          message: 'An Owner or Admin has not enabled agent-performed branch switching for this application.',
        });
      }

      const requestedMinutes = Number(req.body?.expiresInMinutes);
      const minutes = Number.isFinite(requestedMinutes)
        ? Math.min(Math.max(Math.trunc(requestedMinutes), 5), 24 * 60)
        : 60;

      // Supersede any earlier grant so a workspace never carries two live ones.
      await prisma.permissionGrant.updateMany({
        where: { workspaceId: workspace.id, permissionType: 'MANAGE_QA_BRANCH', revokedAt: null },
        data: { revokedAt: new Date() },
      });

      const grant = await prisma.permissionGrant.create({
        data: {
          workspaceId: workspace.id,
          grantedByUserId: req.user!.id,
          permissionType: 'MANAGE_QA_BRANCH',
          fileScopes: [],
          commandScopes: ['git fetch', 'git switch', 'git stash'],
          purpose: `Switch this workspace to the QA review branch ${binding.qaBranchName}.`,
          expiresAt: new Date(Date.now() + minutes * 60_000),
        },
      });
      res.status(201).json(grant);
    },
  );

  router.delete(
    '/applications/:appId/workspaces/:workspaceId/qa-branch-grant',
    verifyJwt,
    verifyAppOwnership,
    async (req: DesktopRequest, res: Response) => {
      const workspace = await prisma.projectWorkspace.findFirst({
        where: { id: req.params.workspaceId, applicationId: req.params.appId },
      });
      if (!workspace) return res.status(404).json({ error: 'Workspace not found' });
      if (workspace.createdByUserId !== req.user!.id) {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'You can only revoke your own grants.' });
      }
      const { count } = await prisma.permissionGrant.updateMany({
        where: { workspaceId: workspace.id, permissionType: 'MANAGE_QA_BRANCH', revokedAt: null },
        data: { revokedAt: new Date() },
      });
      res.json({ revoked: count });
    },
  );

  router.get(
    '/applications/:appId/repository-snapshots',
    verifyJwt,
    verifyAppOwnership,
    async (req: DesktopRequest, res: Response) => {
      const snapshots = await prisma.repositorySnapshot.findMany({
        where: { workspace: { applicationId: req.params.appId } },
        orderBy: { createdAt: 'desc' },
        take: Math.min(Math.max(Number(req.query.limit) || 25, 1), 100),
      });
      res.json(snapshots);
    },
  );

  router.post(
    '/applications/:appId/qa-runs',
    verifyJwt,
    verifyAppOwnership,
    async (req: DesktopRequest, res: Response) => {
      const {
        environmentId, workspaceId, deviceSessionId, repositorySnapshotId,
        flowId, flowBindingId, flowInitializationId, flowScanId, flowDriftId,
        expectedGraphVersionId, patchSetId, mode = QARunMode.GUIDED, captureTracks = ['FRONTEND'], targetUrl, retryOfRunId, timeoutSeconds,
      } = req.body ?? {};
      if (!environmentId || !targetUrl || !flowId || !flowBindingId || !flowInitializationId || !flowScanId || !expectedGraphVersionId) {
        return res.status(400).json({ error: 'FLOW_SCOPED_RUN_CONTEXT_REQUIRED', message: 'environmentId, targetUrl, flowId, flowBindingId, flowInitializationId, flowScanId, and expectedGraphVersionId are required' });
      }
      try {
        const target = new URL(String(targetUrl));
        if (!['http:', 'https:'].includes(target.protocol)) throw new Error();
      } catch {
        return res.status(400).json({ error: 'targetUrl must be an http(s) URL' });
      }

      const environment = await prisma.environment.findFirst({
        where: { id: String(environmentId), applicationId: req.params.appId },
        include: { application: { select: { organizationId: true } } },
      });
      if (!environment?.application.organizationId) {
        return res.status(404).json({ error: 'Environment not found' });
      }
      if (!Object.values(QARunMode).includes(mode)) {
        return res.status(400).json({ error: 'Invalid QA run mode' });
      }
      const normalizedTracks = Array.isArray(captureTracks) ? [...new Set(captureTracks)] : [];
      if (!normalizedTracks.length || normalizedTracks.some((track) => !Object.values(QACaptureTrack).includes(track))) {
        return res.status(400).json({ error: 'INVALID_QA_CAPTURE_TRACKS' });
      }
      if (!productionRunModeAllowed(environment.type, mode)) {
        return res.status(403).json({
          error: 'PRODUCTION_ACTIVE_CONTROL_BLOCKED',
          message: 'Production environments support observation-only runs.',
        });
      }
      if (!await entitlementChecker.canAccess(environment.application.organizationId, Feature.DESKTOP_GUIDED_RUNS)) {
        return res.status(403).json({
          error: 'FEATURE_NOT_ENTITLED',
          feature: Feature.DESKTOP_GUIDED_RUNS,
        });
      }

      const [workspace, snapshot, expectedGraphVersion, patchSet, binding, initialization, flowScan, flowDrift] = await Promise.all([
        workspaceId
          ? prisma.projectWorkspace.findFirst({ where: { id: String(workspaceId), applicationId: req.params.appId } })
          : null,
        repositorySnapshotId
          ? prisma.repositorySnapshot.findFirst({
              where: { id: String(repositorySnapshotId), workspace: { applicationId: req.params.appId } },
            })
          : null,
        expectedGraphVersionId
          ? prisma.behaviorGraphVersion.findFirst({ where: { id: String(expectedGraphVersionId), graph: { applicationId: req.params.appId, graphType: 'DECLARED' } } })
          : null,
        patchSetId
          ? prisma.patchSet.findFirst({ where: { id: String(patchSetId), workspace: { applicationId: req.params.appId }, status: 'VALIDATED' } })
          : workspaceId
            ? prisma.patchSet.findFirst({ where: { workspaceId: String(workspaceId), status: 'VALIDATED' }, orderBy: { createdAt: 'desc' } })
            : null,
        prisma.flowProjectBinding.findFirst({ where: { id: String(flowBindingId), flowId: String(flowId), flowVersionId: String(expectedGraphVersionId), applicationId: req.params.appId, environmentId: environment.id, status: 'ACTIVE' } }),
        prisma.flowInitialization.findFirst({ where: { id: String(flowInitializationId), bindingId: String(flowBindingId), flowVersionId: String(expectedGraphVersionId), status: 'COMPLETED' } }),
        prisma.flowScan.findFirst({ where: { id: String(flowScanId), bindingId: String(flowBindingId), flowVersionId: String(expectedGraphVersionId), status: 'COMPLETED' } }),
        flowDriftId ? prisma.flowDrift.findFirst({ where: { id: String(flowDriftId), flowId: String(flowId), flowVersionId: String(expectedGraphVersionId), currentScanId: String(flowScanId) } }) : null,
      ]);
      if (workspaceId && !workspace) return res.status(404).json({ error: 'Workspace not found' });
      if (repositorySnapshotId && !snapshot) {
        return res.status(404).json({ error: 'Repository snapshot not found' });
      }
      if (expectedGraphVersionId && !expectedGraphVersion) return res.status(404).json({ error: 'Expected graph version not found' });
      if (patchSetId && !patchSet) return res.status(404).json({ error: 'Validated instrumentation manifest not found' });
      if (!binding || !initialization || !flowScan || (flowDriftId && !flowDrift)) return res.status(409).json({ error: 'ACTIVE_FLOW_INITIALIZATION_REQUIRED' });

      const versionSnapshot = expectedGraphVersion!.snapshot as any;
      const expectedStates = Array.isArray(versionSnapshot?.states) ? versionSnapshot.states : [];
      const initialState = expectedStates.find((state: any) => state.role === 'INITIAL');
      const terminalStates = expectedStates.filter((state: any) => state.role === 'TERMINAL');
      if (!initialState || terminalStates.length === 0) return res.status(422).json({ error: 'FLOW_BOUNDARIES_INVALID' });
      const stateKey = (state: any) => String(state.behaviorKey ?? state.stateName ?? state.name ?? '').trim();

      const run = await prisma.qARun.create({
        data: {
          organizationId: environment.application.organizationId,
          applicationId: req.params.appId,
          environmentId: environment.id,
          workspaceId: workspace?.id,
          deviceSessionId: deviceSessionId ? String(deviceSessionId) : undefined,
          repositorySnapshotId: snapshot?.id,
          expectedGraphVersionId: expectedGraphVersion?.id,
          flowId: String(flowId),
          flowBindingId: binding.id,
          flowInitializationId: initialization.id,
          flowScanId: flowScan.id,
          flowDriftId: flowDrift?.id,
          patchSetId: patchSet?.id,
          createdByUserId: req.user!.id,
          mode,
          captureTracks: normalizedTracks,
          initialStateKey: stateKey(initialState),
          terminalStateKeys: terminalStates.map(stateKey),
          timeoutAt: Number(timeoutSeconds) > 0 ? new Date(Date.now() + Math.min(Number(timeoutSeconds), 86_400) * 1_000) : undefined,
          targetUrl: String(targetUrl),
          retryOfRunId: retryOfRunId ? String(retryOfRunId) : undefined,
        },
      });
      res.status(201).json(run);
    },
  );

  router.get(
    '/applications/:appId/qa-runs',
    verifyJwt,
    verifyAppOwnership,
    async (req: DesktopRequest, res: Response) => {
      const runs = await prisma.qARun.findMany({
        where: { applicationId: req.params.appId },
        include: {
          environment: { select: { id: true, name: true, type: true } },
          _count: { select: { artifacts: true, findings: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: Math.min(Math.max(Number(req.query.limit) || 50, 1), 100),
      });
      res.json(runs);
    },
  );

  router.get('/qa-runs/:runId', verifyJwt, async (req: DesktopRequest, res: Response) => {
    const run = await authorizedRun(req.params.runId, req.user!.id);
    if (!run) return res.status(404).json({ error: 'QA run not found' });
    res.json({
      ...run,
      artifacts: run.artifacts.map(safeArtifact),
      findings: run.findings.map((finding) => ({
        ...finding,
        evidence: finding.evidence.map((link) => ({ ...link, artifact: safeArtifact(link.artifact) })),
      })),
    });
  });

  router.post('/qa-runs/:runId/start', verifyJwt, async (req: DesktopRequest, res: Response) => {
    const run = await authorizedRun(req.params.runId, req.user!.id);
    if (!run) return res.status(404).json({ error: 'QA run not found' });
    if (TERMINAL_STATUSES.has(run.status)) return res.status(409).json({ error: 'QA run is terminal' });
    const updated = await prisma.qARun.update({
      where: { id: run.id },
      data: { status: QARunStatus.WAITING_FOR_INITIAL, startedAt: run.startedAt ?? new Date() },
    });
    res.json(updated);
  });

  router.post('/qa-runs/:runId/boundary-events', verifyJwt, async (req: DesktopRequest, res: Response) => {
    const run = await authorizedRun(req.params.runId, req.user!.id);
    if (!run) return res.status(404).json({ error: 'QA run not found' });
    if (TERMINAL_STATUSES.has(run.status)) return res.status(409).json({ error: 'QA run is terminal' });
    const normalize = (value: unknown) => String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    const stateKey = normalize(req.body?.stateKey ?? req.body?.stateName);
    if (!stateKey) return res.status(400).json({ error: 'STATE_KEY_REQUIRED' });
    const snapshot = run.expectedGraphVersion?.snapshot as any;
    const expectedStates = Array.isArray(snapshot?.states) ? snapshot.states : [];
    const knownKeys = new Set(expectedStates.map((state: any) => normalize(state.behaviorKey ?? state.stateName ?? state.name)));
    const initialKey = normalize(run.initialStateKey);
    const terminals = new Set(run.terminalStateKeys.map(normalize));
    const waiting = !run.boundaryStartedAt && run.status !== QARunStatus.RECORDING;
    const accepted = knownKeys.has(stateKey) && (!waiting || stateKey === initialKey);
    const reason = !knownKeys.has(stateKey) ? 'OUTSIDE_FLOW_SCOPE' : waiting && stateKey !== initialKey ? 'BEFORE_INITIAL_BOUNDARY' : null;
    const eventId = typeof req.body?.eventId === 'string' ? req.body.eventId : crypto.randomUUID();
    await prisma.qARunProgressEvent.upsert({
      where: { id: eventId },
      create: { id: eventId, runId: run.id, eventType: String(req.body?.eventType ?? 'STATE_ENTERED'), stateKey, accepted, reason, metadata: req.body?.metadata ?? undefined, occurredAt: req.body?.timestamp ? new Date(String(req.body.timestamp)) : new Date() },
      update: {},
    });
    if (!accepted) return res.status(202).json({ accepted: false, quarantined: true, reason, shouldStop: false });

    const now = new Date();
    const terminalReached = terminals.has(stateKey);
    const updated = await prisma.qARun.update({ where: { id: run.id }, data: {
      status: terminalReached ? QARunStatus.PROCESSING : QARunStatus.RECORDING,
      boundaryStartedAt: run.boundaryStartedAt ?? now,
      boundaryCompletedAt: terminalReached ? now : undefined,
      lastObservedStateKey: stateKey,
      completionReason: terminalReached ? 'TERMINAL_STATE_REACHED' : undefined,
    } });
    return res.json({ accepted: true, shouldStop: terminalReached, run: updated });
  });

  router.post('/qa-runs/:runId/pause', verifyJwt, async (req: DesktopRequest, res: Response) => {
    const run = await authorizedRun(req.params.runId, req.user!.id);
    if (!run) return res.status(404).json({ error: 'QA run not found' });
    if (!new Set<QARunStatus>([QARunStatus.WAITING_FOR_INITIAL, QARunStatus.RECORDING, QARunStatus.RUNNING]).has(run.status)) return res.status(409).json({ error: 'QA run is not active' });
    res.json(await prisma.qARun.update({
      where: { id: run.id },
      data: { status: QARunStatus.PAUSED },
    }));
  });

  router.post('/qa-runs/:runId/resume', verifyJwt, async (req: DesktopRequest, res: Response) => {
    const run = await authorizedRun(req.params.runId, req.user!.id);
    if (!run) return res.status(404).json({ error: 'QA run not found' });
    if (run.status !== QARunStatus.PAUSED) return res.status(409).json({ error: 'QA run is not paused' });
    res.json(await prisma.qARun.update({
      where: { id: run.id },
      data: { status: run.boundaryStartedAt ? QARunStatus.RECORDING : QARunStatus.WAITING_FOR_INITIAL },
    }));
  });

  router.post('/qa-runs/:runId/cancel', verifyJwt, async (req: DesktopRequest, res: Response) => {
    const run = await authorizedRun(req.params.runId, req.user!.id);
    if (!run) return res.status(404).json({ error: 'QA run not found' });
    if (TERMINAL_STATUSES.has(run.status)) return res.status(409).json({ error: 'QA run is terminal' });
    res.json(await prisma.qARun.update({
      where: { id: run.id },
      data: {
        status: QARunStatus.CANCELLED,
        endedAt: new Date(),
        failureReasonSafe: String(req.body?.reason ?? 'Cancelled by user').slice(0, 500),
      },
    }));
  });

  router.post('/qa-runs/:runId/retry', verifyJwt, async (req: DesktopRequest, res: Response) => {
    const run = await authorizedRun(req.params.runId, req.user!.id);
    if (!run) return res.status(404).json({ error: 'QA run not found' });
    if (!TERMINAL_STATUSES.has(run.status)) return res.status(409).json({ error: 'QA run is not terminal' });
    const retried = await prisma.qARun.create({
      data: {
        organizationId: run.organizationId,
        applicationId: run.applicationId,
        environmentId: run.environmentId,
        workspaceId: run.workspaceId,
        deviceSessionId: run.deviceSessionId,
        repositorySnapshotId: run.repositorySnapshotId,
        expectedGraphVersionId: run.expectedGraphVersionId,
        flowId: run.flowId,
        flowBindingId: run.flowBindingId,
        flowInitializationId: run.flowInitializationId,
        flowScanId: run.flowScanId,
        flowDriftId: run.flowDriftId,
        patchSetId: run.patchSetId,
        createdByUserId: req.user!.id,
        mode: run.mode,
        captureTracks: run.captureTracks,
        initialStateKey: run.initialStateKey,
        terminalStateKeys: run.terminalStateKeys,
        targetUrl: run.targetUrl,
        browserMetadata: run.browserMetadata ?? undefined,
        retryOfRunId: run.id,
      },
    });
    res.status(201).json(retried);
  });

  router.post('/qa-runs/:runId/credentials', verifyJwt, async (req: DesktopRequest, res: Response) => {
    const run = await authorizedRun(req.params.runId, req.user!.id);
    if (!run) return res.status(404).json({ error: 'QA run not found' });
    if (TERMINAL_STATUSES.has(run.status)) return res.status(409).json({ error: 'QA run is terminal' });

    const credential = jwt.sign({
      kind: 'tellann-run-ingestion',
      runId: run.id,
      organizationId: run.organizationId,
      applicationId: run.applicationId,
      environmentId: run.environmentId,
      sessionId: typeof req.body?.sessionId === 'string' ? req.body.sessionId : undefined,
      traceId: typeof req.body?.traceId === 'string' ? req.body.traceId : undefined,
      nonce: crypto.randomUUID(),
    }, jwtSecret, {
      subject: req.user!.id,
      expiresIn: '1h',
      issuer: 'tellann-onboarding-api',
      audience: 'event-collector',
    });
    res.json({ credential, expiresInSeconds: 3600, runId: run.id });
  });

  router.post(
    '/qa-runs/:runId/artifacts/:checksum/content',
    verifyJwt,
    raw({ type: 'application/octet-stream', limit: '50mb' }),
    async (req: DesktopRequest, res: Response) => {
      const run = await authorizedRun(req.params.runId, req.user!.id);
      if (!run) return res.status(404).json({ error: 'QA run not found' });
      if (TERMINAL_STATUSES.has(run.status)) return res.status(409).json({ error: 'QA run is terminal' });
      if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
        return res.status(400).json({ error: 'Artifact content is required' });
      }
      const checksum = crypto.createHash('sha256').update(req.body).digest('hex');
      if (checksum !== req.params.checksum) {
        return res.status(422).json({ error: 'ARTIFACT_CHECKSUM_MISMATCH' });
      }
      const artifactType = String(req.headers['x-tellann-artifact-type'] ?? '') as QARunArtifactType;
      if (!Object.values(QARunArtifactType).includes(artifactType)) {
        return res.status(400).json({ error: 'Invalid artifact type' });
      }
      if (
        artifactType === QARunArtifactType.PLAYWRIGHT_TRACE
        && !await entitlementChecker.canAccess(run.organizationId, Feature.BROWSER_TRACE_CAPTURE)
      ) {
        return res.status(403).json({ error: 'FEATURE_NOT_ENTITLED', feature: Feature.BROWSER_TRACE_CAPTURE });
      }
      const privacy = String(
        req.headers['x-tellann-privacy-classification'] ?? PrivacyClassification.INTERNAL,
      ) as PrivacyClassification;
      if (!Object.values(PrivacyClassification).includes(privacy)) {
        return res.status(400).json({ error: 'Invalid privacy classification' });
      }
      const contentTypes: Record<QARunArtifactType, string> = {
        SCREENSHOT: 'image/png',
        PLAYWRIGHT_TRACE: 'application/zip',
        ACCESSIBILITY_SNAPSHOT: 'text/plain; charset=utf-8',
        CONSOLE_LOG: 'application/json',
        NETWORK_LOG: 'application/json',
        RUN_MANIFEST: 'application/json',
      };
      const extensions: Record<QARunArtifactType, string> = {
        SCREENSHOT: 'png',
        PLAYWRIGHT_TRACE: 'zip',
        ACCESSIBILITY_SNAPSHOT: 'txt',
        CONSOLE_LOG: 'json',
        NETWORK_LOG: 'json',
        RUN_MANIFEST: 'json',
      };
      const objectKey = [
        'qa-runs',
        run.organizationId,
        run.applicationId,
        run.id,
        `${checksum}.${extensions[artifactType]}`,
      ].join('/');
      try {
        const uploaded = await storage.uploadAndPresign(
          objectKey,
          req.body,
          contentTypes[artifactType],
          15 * 60,
        );
        const artifact = await prisma.$transaction(async (tx) => {
          const stored = await tx.qARunArtifact.upsert({
            where: { runId_checksum: { runId: run.id, checksum } },
            create: {
              runId: run.id,
              artifactType,
              privacyClassification: privacy,
              objectKey,
              bytes: BigInt(req.body.length),
              checksum,
              capturedAt: req.headers['x-tellann-captured-at']
                ? new Date(String(req.headers['x-tellann-captured-at'])) : new Date(),
              metadata: { approved: true, storageAdapter: uploaded.adapter },
            },
            update: {
              artifactType,
              privacyClassification: privacy,
              objectKey,
              bytes: BigInt(req.body.length),
              metadata: { approved: true, storageAdapter: uploaded.adapter },
            },
          });
          await tx.storageLedgerEntry.upsert({
            where: { objectKey },
            create: {
              organizationId: run.organizationId,
              objectKey,
              ownerType: 'QA_RUN',
              ownerId: run.id,
              category: artifactType,
              bytes: BigInt(req.body.length),
            },
            update: { bytes: BigInt(req.body.length), deletedAt: null },
          });
          return stored;
        });
        res.status(201).json({ ...safeArtifact(artifact), downloadUrl: uploaded.url });
      } catch (error) {
        console.error('[DesktopArtifacts] Upload failed', error);
        res.status(503).json({ error: 'ARTIFACT_UPLOAD_FAILED', retryable: true });
      }
    },
  );

  router.post('/qa-runs/:runId/artifacts', verifyJwt, async (req: DesktopRequest, res: Response) => {
    const run = await authorizedRun(req.params.runId, req.user!.id);
    if (!run) return res.status(404).json({ error: 'QA run not found' });
    const artifacts = Array.isArray(req.body?.artifacts) ? req.body.artifacts : [];
    const findings = Array.isArray(req.body?.findings) ? req.body.findings : [];

    const createdArtifacts = await Promise.all(artifacts.map((artifact: Record<string, unknown>) =>
      prisma.qARunArtifact.upsert({
        where: { runId_checksum: { runId: run.id, checksum: String(artifact.checksum) } },
        create: {
          runId: run.id,
          artifactType: (artifact.artifactType ?? artifact.type) as QARunArtifactType,
          privacyClassification: (artifact.privacyClassification as PrivacyClassification) ?? PrivacyClassification.INTERNAL,
          objectKey: artifact.objectKey ? String(artifact.objectKey) : undefined,
          bytes: BigInt(String(artifact.bytes ?? 0)),
          checksum: String(artifact.checksum),
          capturedAt: artifact.capturedAt ? new Date(String(artifact.capturedAt)) : new Date(),
          metadata: (artifact.metadata as object) ?? undefined,
        },
        update: {
          objectKey: artifact.objectKey ? String(artifact.objectKey) : undefined,
          metadata: (artifact.metadata as object) ?? undefined,
        },
      })
    ));
    const artifactIds = new Map(createdArtifacts.map((artifact) => [artifact.checksum, artifact.id]));
    const createdFindings = await Promise.all(findings.map((finding: Record<string, unknown>) =>
      prisma.browserFinding.create({
        data: {
          runId: run.id,
          category: String(finding.category),
          severity: String(finding.severity),
          confidence: Number(finding.confidence),
          title: String(finding.title),
          description: String(finding.description),
          url: finding.url ? String(finding.url) : undefined,
          viewport: (finding.viewport as object) ?? undefined,
          reproductionSteps: (finding.reproductionSteps as object) ?? [],
          recommendation: finding.recommendation ? String(finding.recommendation) : undefined,
          relatedWorkflowId: finding.relatedWorkflowId ? String(finding.relatedWorkflowId) : undefined,
          relatedStateName: finding.relatedStateName ? String(finding.relatedStateName) : undefined,
          evidence: {
            create: (Array.isArray(finding.evidenceChecksums) ? finding.evidenceChecksums : [])
              .flatMap((checksum) => {
                const artifactId = artifactIds.get(String(checksum));
                return artifactId ? [{ artifactId }] : [];
              }),
          },
        },
      })
    ));
    res.status(201).json({
      artifacts: createdArtifacts.map(safeArtifact),
      findings: createdFindings,
    });
  });

  router.post('/qa-runs/:runId/complete', verifyJwt, async (req: DesktopRequest, res: Response) => {
    const run = await authorizedRun(req.params.runId, req.user!.id);
    if (!run) return res.status(404).json({ error: 'QA run not found' });
    if (run.status === QARunStatus.COMPLETED || run.status === QARunStatus.COMPLETED_INCOMPLETE) {
      await markDemonstrationCompleted(run);
      return res.json(run);
    }
    if (TERMINAL_STATUSES.has(run.status)) return res.status(409).json({ error: 'QA run is terminal' });
    const allObservations = Array.isArray(req.body?.observations) ? req.body.observations : [];
    const allObservedTransitions = Array.isArray(req.body?.observedTransitions) ? req.body.observedTransitions : [];
    const normalizeBoundaryKey = (value: unknown) => String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    const initialKey = normalizeBoundaryKey(run.initialStateKey);
    const terminalKeys = new Set(run.terminalStateKeys.map(normalizeBoundaryKey));
    const initialIndex = allObservations.findIndex((item: any) => normalizeBoundaryKey(item?.behaviorKey ?? item?.stateName) === initialKey);
    const terminalOffset = initialIndex >= 0
      ? allObservations.slice(initialIndex).findIndex((item: any) => terminalKeys.has(normalizeBoundaryKey(item?.behaviorKey ?? item?.stateName)))
      : -1;
    const terminalIndex = terminalOffset >= 0 ? initialIndex + terminalOffset : -1;
    const observations = initialIndex >= 0 ? allObservations.slice(initialIndex, terminalIndex >= 0 ? terminalIndex + 1 : undefined) : [];
    const scopedStateNames = new Set(observations.map((item: any) => normalizeBoundaryKey(item?.stateName ?? item?.behaviorKey)));
    const observedTransitions = allObservedTransitions.filter((item: any) => scopedStateNames.has(normalizeBoundaryKey(item?.fromState)) && scopedStateNames.has(normalizeBoundaryKey(item?.toState)));
    const terminalBoundaryConfirmed = terminalIndex >= 0 || (run.completionReason === 'TERMINAL_STATE_REACHED' && Boolean(run.boundaryCompletedAt));
    const completionReason = terminalBoundaryConfirmed
      ? 'TERMINAL_STATE_REACHED'
      : req.body?.completionReason === 'TIMEOUT' || (run.timeoutAt && run.timeoutAt.getTime() <= Date.now())
        ? 'TIMEOUT'
        : 'MANUAL_STOP_BEFORE_TERMINAL';
    const completedStatus = terminalBoundaryConfirmed ? QARunStatus.COMPLETED : QARunStatus.COMPLETED_INCOMPLETE;
    const sessionId = typeof req.body?.sessionId === 'string' ? req.body.sessionId : crypto.randomUUID();
    const traceId = typeof req.body?.traceId === 'string' ? req.body.traceId : null;
    const startedAt = run.startedAt ?? new Date();
    const endedAt = new Date();

    if (observations.length > 0) {
      await prisma.$transaction(async (tx) => {
        await tx.session.upsert({
          where: { id: sessionId },
          create: {
            id: sessionId,
            applicationId: run.applicationId,
            environmentId: run.environmentId,
            tenantId: run.organizationId,
            qaRunId: run.id,
            traceId,
            startTime: startedAt,
            endTime: endedAt,
          },
          update: { qaRunId: run.id, traceId, endTime: endedAt },
        });
        const stateByName = new Map<string, { id: string }>();
        for (const raw of observations.slice(0, 500)) {
          const observation = raw as Record<string, unknown>;
          const stateName = String(observation.stateName ?? '').replace(/[^A-Z0-9_]/gi, '_').slice(0, 100);
          if (!stateName) continue;
          let state = await tx.state.findFirst({ where: { applicationId: run.applicationId, name: stateName } });
          state = state
            ? await tx.state.update({ where: { id: state.id }, data: { visitCount: { increment: 1 } } })
            : await tx.state.create({
                data: {
                  applicationId: run.applicationId,
                  name: stateName,
                  category: String(observation.category ?? 'NAVIGATION'),
                  visitCount: 1,
                },
              });
          stateByName.set(stateName, state);
          const eventId = String(observation.eventId ?? crypto.randomUUID());
          const timestamp = new Date(String(observation.timestamp ?? endedAt.toISOString()));
          await tx.sessionEvent.upsert({
            where: { id: eventId },
            create: {
              id: eventId,
              sessionId,
              eventType: 'BROWSER_STATE_OBSERVED',
              eventVersion: '1.0',
              source: 'DESKTOP_BROWSER',
              timestamp,
              metadata: {
                stateName,
                url: String(observation.url ?? '').slice(0, 2000),
                title: String(observation.title ?? '').slice(0, 200),
                runId: run.id,
                traceId,
              },
            },
            update: {},
          });
          await tx.stateObservation.create({ data: { stateId: state.id, sessionId, eventId, timestamp } });
        }
        for (const raw of observedTransitions.slice(0, 500)) {
          const transitionInput = raw as Record<string, unknown>;
          const fromName = String(transitionInput.fromState ?? '').replace(/[^A-Z0-9_]/gi, '_').slice(0, 100);
          const toName = String(transitionInput.toState ?? '').replace(/[^A-Z0-9_]/gi, '_').slice(0, 100);
          const fromState = stateByName.get(fromName);
          const toState = stateByName.get(toName);
          if (!fromState || !toState) continue;
          const action = String(transitionInput.action ?? 'NAVIGATE').slice(0, 100);
          let transition = await tx.transition.findFirst({
            where: {
              applicationId: run.applicationId,
              fromStateId: fromState.id,
              toStateId: toState.id,
              action,
            },
          });
          transition = transition
            ? await tx.transition.update({ where: { id: transition.id }, data: { frequency: { increment: 1 } } })
            : await tx.transition.create({
                data: {
                  applicationId: run.applicationId,
                  fromStateId: fromState.id,
                  toStateId: toState.id,
                  action,
                  frequency: 1,
                },
              });
          await tx.transitionObservation.create({
            data: {
              transitionId: transition.id,
              sessionId,
              fromEventId: String(transitionInput.fromEventId),
              toEventId: String(transitionInput.toEventId),
              timestamp: new Date(String(transitionInput.timestamp ?? endedAt.toISOString())),
            },
          });
        }
        await tx.sessionStatistic.upsert({
          where: { sessionId },
          create: {
            sessionId,
            eventCount: observations.length,
            errorCount: run.findings.filter((finding) => finding.severity === 'CRITICAL' || finding.severity === 'HIGH').length,
            durationMs: Math.max(0, endedAt.getTime() - startedAt.getTime()),
          },
          update: {
            eventCount: observations.length,
            durationMs: Math.max(0, endedAt.getTime() - startedAt.getTime()),
          },
        });
      });
    }

    const completed = await prisma.qARun.update({
      where: { id: run.id },
      data: {
        status: completedStatus,
        endedAt,
        boundaryStartedAt: run.boundaryStartedAt ?? (initialIndex >= 0 ? new Date(String(observations[0]?.timestamp ?? endedAt.toISOString())) : null),
        boundaryCompletedAt: run.boundaryCompletedAt ?? (terminalIndex >= 0 ? new Date(String(observations[observations.length - 1]?.timestamp ?? endedAt.toISOString())) : null),
        lastObservedStateKey: observations.length ? String((observations[observations.length - 1] as any).behaviorKey ?? (observations[observations.length - 1] as any).stateName ?? '') : null,
        completionReason,
        browserMetadata: req.body?.browserMetadata ?? undefined,
        artifactManifest: req.body?.artifactManifest ?? undefined,
      },
    });
    await prisma.notificationEvent.createMany({ data: [
      { organizationId: completed.organizationId, applicationId: completed.applicationId, eventType: 'QA_RUN_COMPLETED', severity: completedStatus === QARunStatus.COMPLETED ? 'INFO' : 'WARNING', payload: { runId: completed.id, flowId: completed.flowId, flowVersionId: completed.expectedGraphVersionId, completionReason } },
      { organizationId: completed.organizationId, applicationId: completed.applicationId, eventType: 'FLOW_QA_REPORT_READY', severity: completedStatus === QARunStatus.COMPLETED ? 'INFO' : 'WARNING', payload: { runId: completed.id, flowId: completed.flowId, reportUrl: `/qa-runs/${completed.id}` } },
    ] });
    await markDemonstrationCompleted(completed);
    res.json(completed);
  });

  router.get('/qa-runs/:runId/artifacts/:artifactId/download', verifyJwt, async (req: DesktopRequest, res: Response) => {
    const run = await authorizedRun(req.params.runId, req.user!.id);
    if (!run) return res.status(404).json({ error: 'QA run not found' });
    const artifact = run.artifacts.find((candidate) => candidate.id === req.params.artifactId);
    if (!artifact?.objectKey) return res.status(404).json({ error: 'Artifact content not available' });
    try {
      res.json({ url: await storage.presign(artifact.objectKey, 15 * 60), expiresInSeconds: 900 });
    } catch {
      res.status(503).json({ error: 'ARTIFACT_DOWNLOAD_UNAVAILABLE' });
    }
  });

  router.get('/qa-runs/:runId/artifacts', verifyJwt, async (req: DesktopRequest, res: Response) => {
    const run = await authorizedRun(req.params.runId, req.user!.id);
    if (!run) return res.status(404).json({ error: 'QA run not found' });
    res.json(run.artifacts.map(safeArtifact));
  });

  router.get('/qa-runs/:runId/findings', verifyJwt, async (req: DesktopRequest, res: Response) => {
    const run = await authorizedRun(req.params.runId, req.user!.id);
    if (!run) return res.status(404).json({ error: 'QA run not found' });
    res.json(run.findings.map((finding) => ({
      ...finding,
      evidence: finding.evidence.map((link) => ({
        ...link,
        artifact: safeArtifact(link.artifact),
      })),
    })));
  });

  router.get('/qa-runs/:runId/observed-graph', verifyJwt, async (req: DesktopRequest, res: Response) => {
    const run = await authorizedRun(req.params.runId, req.user!.id);
    if (!run) return res.status(404).json({ error: 'QA run not found' });
    const sessionIds = await prisma.session.findMany({
      where: { qaRunId: run.id },
      select: { id: true },
    }).then((sessions) => sessions.map((session) => session.id));
    const [states, transitions] = await Promise.all([
      prisma.stateObservation.findMany({
        where: { sessionId: { in: sessionIds } },
        include: { state: true },
        orderBy: { timestamp: 'asc' },
      }),
      prisma.transitionObservation.findMany({
        where: { sessionId: { in: sessionIds } },
        include: { transition: { include: { fromState: true, toState: true } } },
        orderBy: { timestamp: 'asc' },
      }),
    ]);
    res.json({
      runId: run.id,
      sessions: sessionIds,
      states: states.map((item) => ({
        id: item.state.id,
        name: item.state.name,
        category: item.state.category,
        sessionId: item.sessionId,
        timestamp: item.timestamp,
      })),
      transitions: transitions.map((item) => ({
        id: item.transition.id,
        from: item.transition.fromState.name,
        to: item.transition.toState.name,
        action: item.transition.action,
        sessionId: item.sessionId,
        timestamp: item.timestamp,
      })),
    });
  });

  router.get('/qa-runs/:runId/replay', verifyJwt, async (req: DesktopRequest, res: Response) => {
    const run = await authorizedRun(req.params.runId, req.user!.id);
    if (!run) return res.status(404).json({ error: 'QA run not found' });
    const sessions = await prisma.session.findMany({
      where: { qaRunId: run.id },
      include: { events: { orderBy: { timestamp: 'asc' } }, statistics: true },
      orderBy: { startTime: 'asc' },
    });
    res.json({
      runId: run.id,
      sessions,
      artifacts: run.artifacts.map(safeArtifact),
      findings: run.findings,
    });
  });

  router.get('/qa-runs/:runId/reconciliation', verifyJwt, async (req: DesktopRequest, res: Response) => {
    const run = await authorizedRun(req.params.runId, req.user!.id);
    if (!run) return res.status(404).json({ error: 'QA run not found' });
    const reports = await prisma.reconciliationReport.findMany({
      where: {
        applicationId: run.applicationId,
        environmentId: run.environmentId,
        ...(run.expectedGraphVersion?.graphId ? { flowId: run.expectedGraphVersion.graphId } : {}),
      },
      include: { flow: { select: { id: true, name: true, version: true } } },
      orderBy: { generatedAt: 'desc' },
      take: 50,
    });
    res.json({ runId: run.id, expectedGraphVersionId: run.expectedGraphVersionId, reports });
  });

  router.post('/qa-runs/:runId/fail', verifyJwt, async (req: DesktopRequest, res: Response) => {
    const run = await authorizedRun(req.params.runId, req.user!.id);
    if (!run) return res.status(404).json({ error: 'QA run not found' });
    if (run.status === QARunStatus.FAILED) return res.json(run);
    if (TERMINAL_STATUSES.has(run.status)) return res.status(409).json({ error: 'QA run is terminal' });
    const failed = await prisma.qARun.update({
      where: { id: run.id },
      data: {
        status: QARunStatus.FAILED,
        endedAt: new Date(),
        failureReasonSafe: String(req.body?.failureReasonSafe ?? 'Desktop run failed').slice(0, 500),
      },
    });
    res.json(failed);
  });

  return router;
}
