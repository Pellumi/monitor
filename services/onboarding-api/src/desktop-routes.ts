import crypto from 'crypto';
import { Router, raw, type NextFunction, type Request, type Response } from 'express';
import jwt from 'jsonwebtoken';
import {
  AuditAction,
  EnvironmentType,
  MemberRole,
  Prisma,
  PrismaClient,
  QAEvidenceScope,
  QAProtectedValueKind,
  QAReportJobStatus,
  QAReportStatus,
  QARunArtifactType,
  QACaptureTrack,
  QARunMode,
  QARunStatus,
  PrivacyClassification,
  processQaFlowBoundaryEvent,
  EmailCategory,
} from '@tellann/db';
import { NotificationEmailService, NotificationOrchestrator } from '@tellann/email';
import { CreateQARunAnnotationSchema, QAEvidenceEventSchema } from '@tellann/desktop-contracts';
import { Feature } from '@tellann/shared';
import type { EntitlementChecker } from '@tellann/entitlement-checker';
import type { StorageClient } from '@tellann/storage';
import {
  assertQaEncryptionConfigured,
  protectQaValue,
  reclassifyQaProtectedValue,
  revealQaValue,
  sanitizeQaMetadata,
  sanitizeQaUrl,
} from './qa-privacy';

type DesktopRequest = Request & { user?: { id: string; email: string } };
type Middleware = (req: DesktopRequest, res: Response, next: NextFunction) => unknown;

export function productionRunModeAllowed(environmentType: EnvironmentType, mode: QARunMode): boolean {
  return environmentType !== EnvironmentType.PRODUCTION || mode === QARunMode.OBSERVATION_ONLY;
}

/**
 * Who may reveal an encrypted ordinary value: the person who ran the capture,
 * plus organization Owners and Admins. Membership in the run's organization is
 * a precondition — a null role means the caller is not a member at all.
 */
export function canRevealProtectedValue(input: {
  requestingUserId: string;
  runCreatedByUserId: string;
  role: MemberRole | null;
}): boolean {
  if (input.role === null) return false;
  return input.requestingUserId === input.runCreatedByUserId
    || input.role === MemberRole.OWNER
    || input.role === MemberRole.ADMIN;
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
  /**
   * Per-process reveal throttle. Swept on write so an operator who reveals a
   * handful of values across many runs cannot grow the map without bound; the
   * durable record of every reveal is the QA_EVIDENCE_REVEALED audit entry.
   */
  const revealAttempts = new Map<string, number[]>();
  const REVEAL_WINDOW_MS = 60_000;

  function sweepRevealAttempts(now: number): void {
    for (const [key, timestamps] of revealAttempts) {
      const live = timestamps.filter((timestamp) => now - timestamp < REVEAL_WINDOW_MS);
      if (live.length) revealAttempts.set(key, live);
      else revealAttempts.delete(key);
    }
  }

  /** The caller's role in the organisation that owns this application, if any. */
  async function orgRoleForApp(userId: string, appId: string): Promise<MemberRole | null> {
    const application = await prisma.application.findUnique({
      where: { id: appId },
      select: { organizationId: true },
    });
    if (!application?.organizationId) return null;
    const membership = await prisma.organizationMembership.findUnique({
      where: { userId_organizationId: { userId, organizationId: application.organizationId } },
      select: { role: true },
    });
    return membership?.role ?? null;
  }

  const canManageBranchPolicy = (role: MemberRole | null) =>
    role === MemberRole.OWNER || role === MemberRole.ADMIN;

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
        progressEvents: { orderBy: { occurredAt: 'asc' } },
        findings: { include: { evidence: { include: { artifact: true } } } },
        report: true,
        annotations: {
          include: {
            author: { select: { id: true, displayName: true, avatarUrl: true } },
            mentions: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  }

  /**
   * Tenant-scoped run lookup that loads only the columns the high-frequency
   * capture endpoints need. `authorizedRun` eagerly hydrates every artifact,
   * progress event, finding and annotation, which is far too expensive for
   * paths hit every couple of seconds for the whole length of a run.
   */
  async function authorizedRunLite(runId: string, userId: string) {
    return prisma.qARun.findFirst({
      where: { id: runId, organization: { memberships: { some: { userId } } } },
      select: {
        id: true,
        organizationId: true,
        applicationId: true,
        environmentId: true,
        createdByUserId: true,
        status: true,
        boundaryStartedAt: true,
        boundaryCompletedAt: true,
        completionReason: true,
        lastObservedStateKey: true,
        environment: { select: { id: true, type: true } },
        report: { select: { id: true, status: true, failureReasonSafe: true, generatedAt: true } },
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

  // Codebase intelligence endpoints live in their own router; see
  // createCodebaseRouter in codebase-routes.ts.

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
      const [binding, role] = await Promise.all([
        prisma.applicationRepositoryBinding.findUnique({
          where: { applicationId: req.params.appId },
        }),
        orgRoleForApp(req.user!.id, req.params.appId),
      ]);
      res.json({
        ...serializeBranchPolicy(req.params.appId, binding),
        canManageBranchPolicy: canManageBranchPolicy(role),
      });
    },
  );

  /**
   * Turns agent-performed branch switching on or off for the whole application.
   * Owner/Admin only: this is the org-wide policy the per-workspace grant sits
   * under, so a regular member must not be able to widen it for everyone else.
   * Deliberately scoped to just this flag; the branch names and enforcement mode
   * stay in the dashboard's fuller policy editor.
   */
  router.put(
    '/applications/:appId/branch-policy',
    verifyJwt,
    verifyAppOwnership,
    async (req: DesktopRequest, res: Response) => {
      const role = await orgRoleForApp(req.user!.id, req.params.appId);
      if (!canManageBranchPolicy(role)) {
        return res.status(403).json({
          error: 'FORBIDDEN_NOT_ORG_MANAGER',
          message: 'Only an Owner or Admin can change the QA branch policy.',
        });
      }

      const { allowAgentCheckout } = req.body ?? {};
      if (typeof allowAgentCheckout !== 'boolean') {
        return res.status(400).json({
          error: 'INVALID_ALLOW_AGENT_CHECKOUT',
          message: 'allowAgentCheckout must be true or false.',
        });
      }

      const binding = await prisma.applicationRepositoryBinding.upsert({
        where: { applicationId: req.params.appId },
        create: { applicationId: req.params.appId, allowAgentCheckout, updatedByUserId: req.user!.id },
        update: { allowAgentCheckout, updatedByUserId: req.user!.id },
      });
      res.json({
        ...serializeBranchPolicy(req.params.appId, binding),
        canManageBranchPolicy: true,
      });
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
        captureVersion,
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
          browserMetadata: { captureVersion: captureVersion === '2.0' ? '2.0' : '1.0' },
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
    const groupedEvidence = await prisma.qARunEvidenceEvent.groupBy({
      by: ['eventType'],
      where: { runId: run.id },
      _count: { _all: true },
    });
    res.json({
      ...run,
      synchronizationStatus: run.report?.status === QAReportStatus.FAILED ? 'FAILED' : run.report ? 'SYNCHRONIZED' : 'PENDING',
      reportStatus: run.report?.status ?? null,
      evidenceCounts: Object.fromEntries(groupedEvidence.map((item) => [item.eventType, item._count._all])),
      annotationCount: run.annotations.length,
      artifacts: run.artifacts.map(safeArtifact),
      findings: run.findings.map((finding) => ({
        ...finding,
        evidence: finding.evidence.map((link) => ({ ...link, artifact: safeArtifact(link.artifact) })),
      })),
    });
  });

  router.post('/qa-runs/:runId/evidence-events/batch', verifyJwt, async (req: DesktopRequest, res: Response) => {
    const run = await authorizedRunLite(req.params.runId, req.user!.id);
    if (!run) return res.status(404).json({ error: 'QA run not found' });
    const rawEvents = Array.isArray(req.body?.events) ? req.body.events : Array.isArray(req.body) ? req.body : [];
    const batchBytes = Buffer.byteLength(JSON.stringify(rawEvents));
    if (batchBytes > 5 * 1024 * 1024) {
      await prisma.browserFinding.upsert({
        where: { runId_dedupeKey: { runId: run.id, dedupeKey: 'capture-degraded:batch-size' } },
        create: {
          runId: run.id, category: 'CAPTURE_DEGRADED', severity: 'HIGH', confidence: 1,
          title: 'Evidence batch exceeded the capture limit',
          description: 'A desktop evidence batch was larger than 5 MB and was rejected explicitly.',
          reproductionSteps: [], recommendation: 'Repeat the run after reducing captured payload size.',
          scope: run.boundaryStartedAt ? QAEvidenceScope.IN_FLOW : QAEvidenceScope.PRE_BOUNDARY,
          dedupeKey: 'capture-degraded:batch-size', generatorSource: 'RULES',
        },
        update: {},
      });
      return res.status(413).json({ error: 'EVIDENCE_BATCH_TOO_LARGE', captureDegraded: true });
    }
    if (!rawEvents.length || rawEvents.length > 500) return res.status(400).json({ error: 'EVIDENCE_BATCH_INVALID' });
    const parsed = (rawEvents as unknown[]).map((event) => QAEvidenceEventSchema.safeParse(event));
    const firstInvalid = parsed.find((result) => !result.success);
    if (firstInvalid && !firstInvalid.success) {
      return res.status(400).json({ error: 'EVIDENCE_EVENT_INVALID', details: firstInvalid.error.flatten() });
    }
    const events = parsed.map((result) => result.success ? result.data : null).filter(Boolean) as Array<ReturnType<typeof QAEvidenceEventSchema.parse>>;
    if (events.some((event) => event.runId !== run.id || event.applicationId !== run.applicationId || event.environmentId !== run.environmentId)) {
      return res.status(403).json({ error: 'EVIDENCE_CONTEXT_MISMATCH' });
    }
    const production = run.environment.type === EnvironmentType.PRODUCTION;
    if (production && events.some((event) => event.protectedValues.some((value) => value.value !== undefined))) {
      return res.status(422).json({ error: 'PRODUCTION_PROTECTED_VALUES_REJECTED', captureDegraded: true });
    }
    // Fail closed rather than persisting under a derived fallback key that the
    // reveal endpoint would later refuse to decrypt.
    try {
      assertQaEncryptionConfigured();
    } catch {
      return res.status(503).json({ error: 'QA_EVIDENCE_ENCRYPTION_NOT_CONFIGURED' });
    }
    const oversized = events.find((event) => Buffer.byteLength(JSON.stringify(event)) > 32 * 1024);
    if (oversized) {
      await prisma.browserFinding.upsert({
        where: { runId_dedupeKey: { runId: run.id, dedupeKey: `capture-degraded:event-size:${oversized.eventId}` } },
        create: {
          runId: run.id, category: 'CAPTURE_DEGRADED', severity: 'MEDIUM', confidence: 1,
          title: 'Evidence event exceeded the capture limit', description: 'One evidence event exceeded 32 KB and was rejected explicitly.',
          reproductionSteps: [], recommendation: 'Reduce captured structured values and repeat the affected step.', scope: oversized.scope,
          dedupeKey: `capture-degraded:event-size:${oversized.eventId}`, generatorSource: 'RULES',
        }, update: {},
      });
      return res.status(413).json({ error: 'EVIDENCE_EVENT_TOO_LARGE', eventId: oversized.eventId, captureDegraded: true });
    }
    let inserted = 0;
    let duplicates = 0;
    // Each event is its own short transaction rather than one interactive
    // transaction spanning up to 500 events: that shape blew past the default
    // interactive-transaction timeout, and its check-then-insert raced a
    // concurrent retry of the same batch into a P2002 that surfaced as a 500.
    // A unique-violation here simply means the event already landed, which is
    // exactly what an idempotent re-upload should report.
    for (const event of events) {
      const sanitized = sanitizeQaMetadata(event.metadata, { production });
      // Client-declared kinds are a hint, never the decision: re-derive the
      // server floor so a recorder that mislabels a password as ORDINARY
      // cannot get it encrypted-and-revealable.
      const supplied = event.protectedValues
        .map((value) => reclassifyQaProtectedValue({
          keyPath: value.keyPath,
          kind: value.kind,
          value: value.value,
          valueLength: value.valueLength ?? value.value?.length ?? 0,
        }))
        .map((value) => protectQaValue(value, { production }));
      const protectedValues = [...sanitized.protectedValues, ...supplied]
        .filter((value) => !production || value.kind === 'SECRET')
        .slice(0, 100);
      try {
        await prisma.qARunEvidenceEvent.create({
          data: {
            runId: run.id,
            eventId: event.eventId,
            sessionId: event.sessionId,
            traceId: event.traceId,
            localSequence: event.localSequence,
            eventType: event.eventType,
            source: event.source,
            scope: event.scope,
            privacyClassification: event.privacyClassification,
            pageUrl: sanitizeQaUrl(event.pageUrl),
            normalizedRoute: event.normalizedRoute,
            acceptedFlowStateKey: event.acceptedFlowStateKey,
            viewport: event.viewport ?? undefined,
            interactionGroupId: event.interactionGroupId,
            causedByEventId: event.causedByEventId,
            metadata: sanitized.metadata as Prisma.InputJsonValue,
            occurredAt: new Date(event.timestamp),
            protectedValues: {
              create: protectedValues.map((value) => ({
                keyPath: value.keyPath,
                kind: value.kind as QAProtectedValueKind,
                displayValue: value.displayValue,
                valueLength: value.valueLength,
                fingerprint: value.fingerprint,
                keyVersion: value.keyVersion,
                iv: value.iv,
                ciphertext: value.ciphertext,
                authTag: value.authTag,
              })),
            },
          },
        });
        inserted += 1;
      } catch (error) {
        // P2002 on (runId, eventId) or (runId, sessionId, localSequence):
        // this event is already durable, so the re-upload is a no-op.
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          duplicates += 1;
          continue;
        }
        throw error;
      }
    }
    return res.status(202).json({ accepted: inserted, duplicates, rejected: 0 });
  });

  /**
   * Minimal boundary projection for the desktop's in-run poll. The full run
   * detail payload is far too heavy to fetch every couple of seconds for the
   * whole length of a capture.
   */
  router.get('/qa-runs/:runId/boundary-status', verifyJwt, async (req: DesktopRequest, res: Response) => {
    const run = await authorizedRunLite(req.params.runId, req.user!.id);
    if (!run) return res.status(404).json({ error: 'QA run not found' });
    res.json({
      runId: run.id,
      status: run.status,
      boundaryStartedAt: run.boundaryStartedAt,
      boundaryCompletedAt: run.boundaryCompletedAt,
      completionReason: run.completionReason,
      lastObservedStateKey: run.lastObservedStateKey,
    });
  });

  router.get('/qa-runs/:runId/evidence-summary', verifyJwt, async (req: DesktopRequest, res: Response) => {
    const run = await authorizedRun(req.params.runId, req.user!.id);
    if (!run) return res.status(404).json({ error: 'QA run not found' });
    const [byType, byScope, protectedValueCount] = await Promise.all([
      prisma.qARunEvidenceEvent.groupBy({ by: ['eventType'], where: { runId: run.id }, _count: { _all: true } }),
      prisma.qARunEvidenceEvent.groupBy({ by: ['scope'], where: { runId: run.id }, _count: { _all: true } }),
      prisma.qARunProtectedValue.count({ where: { evidenceEvent: { runId: run.id } } }),
    ]);
    res.json({
      runId: run.id,
      counts: Object.fromEntries(byType.map((item) => [item.eventType, item._count._all])),
      scopes: Object.fromEntries(byScope.map((item) => [item.scope, item._count._all])),
      protectedValueCount,
      captureDegraded: run.findings.some((finding) => finding.category === 'CAPTURE_DEGRADED'),
      reportStatus: run.report?.status ?? null,
    });
  });

  router.get('/qa-runs/:runId/mentionable-members', verifyJwt, async (req: DesktopRequest, res: Response) => {
    const run = await authorizedRunLite(req.params.runId, req.user!.id);
    if (!run) return res.status(404).json({ error: 'QA run not found' });
    const query = String(req.query.q ?? '').trim().slice(0, 100);
    const memberships = await prisma.organizationMembership.findMany({
      where: {
        organizationId: run.organizationId,
        userId: { not: req.user!.id },
        user: {
          deletedAt: null,
          ...(query ? { displayName: { contains: query, mode: 'insensitive' } } : {}),
        },
      },
      select: { role: true, user: { select: { id: true, displayName: true, avatarUrl: true } } },
      orderBy: { user: { displayName: 'asc' } },
      take: 20,
    });
    res.json(memberships.map((membership) => ({
      id: membership.user.id,
      displayName: membership.user.displayName || 'Tellann member',
      avatarUrl: membership.user.avatarUrl,
      role: membership.role,
    })));
  });

  router.post('/qa-runs/:runId/annotations', verifyJwt, async (req: DesktopRequest, res: Response) => {
    const run = await authorizedRun(req.params.runId, req.user!.id);
    if (!run) return res.status(404).json({ error: 'QA run not found' });
    const parsed = CreateQARunAnnotationSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'ANNOTATION_INVALID', details: parsed.error.flatten() });
    const input = parsed.data;
    const mentionedUserIds = [...new Set(input.mentionedUserIds)].filter((id) => id !== req.user!.id);
    const acceptedMembers = mentionedUserIds.length ? await prisma.organizationMembership.findMany({
      where: { organizationId: run.organizationId, userId: { in: mentionedUserIds }, user: { deletedAt: null } },
      select: { user: { select: { id: true, displayName: true } } },
    }) : [];
    if (acceptedMembers.length !== mentionedUserIds.length) {
      return res.status(422).json({ error: 'ANNOTATION_MENTION_INVALID' });
    }
    const annotation = await prisma.qARunAnnotation.create({
      data: {
        runId: run.id,
        authorId: req.user!.id,
        scope: input.scope,
        flowStateKey: input.flowStateKey,
        pageUrl: sanitizeQaUrl(input.pageUrl) || input.normalizedRoute,
        normalizedRoute: input.normalizedRoute,
        comment: input.comment,
        // The accessible name is derived from rendered text, so annotating a
        // profile row or invoice line can otherwise pull a real name, email or
        // phone number straight into the report. Run it through the same
        // classifier as every other captured value.
        elementFingerprint: sanitizeQaMetadata(
          { ...input.elementFingerprint, frameUrl: sanitizeQaUrl(input.elementFingerprint.frameUrl) ?? '' },
          { production: run.environment.type === EnvironmentType.PRODUCTION },
        ).metadata as Prisma.InputJsonValue,
        documentBounds: input.documentBounds ?? undefined,
        viewportBounds: input.viewportBounds,
        windowResolution: input.windowResolution,
        screenshotArtifactId: input.screenshotArtifactId,
        mentions: {
          create: acceptedMembers.map((membership) => ({
            userId: membership.user.id,
            displayNameSnapshot: membership.user.displayName || 'Tellann member',
          })),
        },
      },
      include: {
        author: { select: { id: true, displayName: true, avatarUrl: true } },
        mentions: true,
      },
    });
    res.status(201).json(annotation);
  });

  router.get('/qa-runs/:runId/annotations', verifyJwt, async (req: DesktopRequest, res: Response) => {
    const run = await authorizedRun(req.params.runId, req.user!.id);
    if (!run) return res.status(404).json({ error: 'QA run not found' });
    res.json(run.annotations);
  });

  router.get('/qa-runs/:runId/report-status', verifyJwt, async (req: DesktopRequest, res: Response) => {
    const run = await authorizedRunLite(req.params.runId, req.user!.id);
    if (!run) return res.status(404).json({ error: 'QA run not found' });
    if (!run.report) return res.status(202).json({ runId: run.id, status: 'PENDING', progress: 0, retryEligible: false });
    const progressByStatus: Record<string, number> = { PENDING: 10, RECONCILING: 30, ANALYZING: 55, GENERATING: 80, READY: 100, FAILED: 100 };
    res.status(run.report.status === QAReportStatus.READY ? 200 : 202).json({
      runId: run.id,
      reportId: run.report.id,
      status: run.report.status,
      progress: progressByStatus[run.report.status] ?? 0,
      retryEligible: run.report.status === QAReportStatus.FAILED,
      failureReason: run.report.failureReasonSafe,
      generatedAt: run.report.generatedAt,
    });
  });

  router.post('/qa-runs/:runId/report/retry', verifyJwt, async (req: DesktopRequest, res: Response) => {
    const run = await authorizedRun(req.params.runId, req.user!.id);
    if (!run) return res.status(404).json({ error: 'QA run not found' });
    if (!run.report || run.report.status !== QAReportStatus.FAILED) return res.status(409).json({ error: 'REPORT_NOT_RETRYABLE' });
    await prisma.$transaction([
      prisma.qAReport.update({ where: { id: run.report.id }, data: { status: QAReportStatus.PENDING, failureReasonSafe: null } }),
      prisma.qAReportGenerationJob.upsert({
        where: { reportId: run.report.id },
        create: { reportId: run.report.id, status: QAReportJobStatus.QUEUED },
        update: { status: QAReportJobStatus.QUEUED, attempts: 0, scheduledAt: new Date(), startedAt: null, completedAt: null, failureReasonSafe: null },
      }),
    ]);
    res.status(202).json({ reportId: run.report.id, status: QAReportStatus.PENDING });
  });

  router.post('/qa-runs/:runId/protected-values/:valueId/reveal', verifyJwt, async (req: DesktopRequest, res: Response) => {
    const run = await authorizedRun(req.params.runId, req.user!.id);
    if (!run) return res.status(404).json({ error: 'QA run not found' });
    const membership = await prisma.organizationMembership.findUnique({
      where: { userId_organizationId: { userId: req.user!.id, organizationId: run.organizationId } },
      select: { role: true },
    });
    const authorized = canRevealProtectedValue({
      requestingUserId: req.user!.id,
      runCreatedByUserId: run.createdByUserId,
      role: membership?.role ?? null,
    });
    if (!authorized) return res.status(403).json({ error: 'PROTECTED_VALUE_REVEAL_FORBIDDEN' });
    const now = Date.now();
    const rateKey = `${req.user!.id}:${run.id}`;
    sweepRevealAttempts(now);
    const recent = (revealAttempts.get(rateKey) ?? []).filter((timestamp) => now - timestamp < REVEAL_WINDOW_MS);
    if (recent.length >= 10) return res.status(429).json({ error: 'REVEAL_RATE_LIMITED' });
    recent.push(now);
    revealAttempts.set(rateKey, recent);
    const protectedValue = await prisma.qARunProtectedValue.findFirst({
      where: { id: req.params.valueId, evidenceEvent: { runId: run.id } },
    });
    if (!protectedValue) return res.status(404).json({ error: 'PROTECTED_VALUE_NOT_FOUND' });
    let value: string | null;
    try {
      value = revealQaValue(protectedValue);
    } catch {
      return res.status(503).json({ error: 'QA_EVIDENCE_ENCRYPTION_NOT_CONFIGURED' });
    }
    if (value === null) return res.status(409).json({ error: 'PROTECTED_VALUE_NOT_REVEALABLE' });
    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        organizationId: run.organizationId,
        action: AuditAction.QA_EVIDENCE_REVEALED,
        metadata: { runId: run.id, protectedValueId: protectedValue.id, evidenceEventId: protectedValue.evidenceEventId },
      },
    });
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Pragma', 'no-cache');
    res.json({ id: protectedValue.id, value });
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
    const metadata = req.body?.metadata && typeof req.body.metadata === 'object' ? req.body.metadata : {};
    const eventId = typeof req.body?.eventId === 'string' ? req.body.eventId : '';
    const eventType = String(req.body?.eventType ?? '');
    const flowVersionId = String(req.body?.flowVersionId ?? metadata.flowVersionId ?? '');
    const stateKey = String(req.body?.stateKey ?? metadata.stateKey ?? req.body?.toStateKey ?? metadata.toStateKey ?? '');
    if (!eventId || !stateKey || !eventType || !flowVersionId) {
      return res.status(400).json({ error: 'FLOW_EVENT_CONTEXT_REQUIRED', message: 'eventId, eventType, flowVersionId, and stateKey are required' });
    }
    const result = await processQaFlowBoundaryEvent(prisma, run.id, {
      eventId,
      eventType,
      flowVersionId,
      stateKey,
      fromStateKey: req.body?.fromStateKey ?? metadata.fromStateKey,
      toStateKey: req.body?.toStateKey ?? metadata.toStateKey,
      action: req.body?.action ?? metadata.action,
      timestamp: req.body?.timestamp,
      metadata,
    });
    if (result.kind === 'RUN_TERMINAL') return res.status(409).json({ error: result.reason });
    return res.status(result.accepted ? 200 : 202).json(result);
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
        INSPECT_SCREENSHOT: 'image/png',
        SANITIZED_FINAL_SCREENSHOT: 'image/png',
        PLAYWRIGHT_TRACE: 'application/zip',
        ACCESSIBILITY_SNAPSHOT: 'text/plain; charset=utf-8',
        CONSOLE_LOG: 'application/json',
        NETWORK_LOG: 'application/json',
        RUN_MANIFEST: 'application/json',
      };
      const extensions: Record<QARunArtifactType, string> = {
        SCREENSHOT: 'png',
        INSPECT_SCREENSHOT: 'png',
        SANITIZED_FINAL_SCREENSHOT: 'png',
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
    const initialAccepted = run.progressEvents.find((event) => event.accepted && event.eventType === 'FLOW_INITIAL_STATE');
    const terminalAccepted = run.progressEvents.find((event) => event.accepted && event.eventType === 'FLOW_TERMINAL_STATE');
    const boundaryStartMs = initialAccepted?.occurredAt.getTime() ?? run.boundaryStartedAt?.getTime() ?? null;
    const boundaryEndMs = terminalAccepted?.occurredAt.getTime() ?? run.boundaryCompletedAt?.getTime() ?? null;
    const observations = boundaryStartMs === null ? [] : allObservations.filter((item: any) => {
      const timestamp = new Date(String(item?.timestamp ?? 0)).getTime();
      return Number.isFinite(timestamp) && timestamp >= boundaryStartMs && (boundaryEndMs === null || timestamp <= boundaryEndMs);
    });
    const scopedStateNames = new Set(observations.map((item: any) => normalizeBoundaryKey(item?.stateName ?? item?.behaviorKey)));
    const observedTransitions = allObservedTransitions.filter((item: any) => scopedStateNames.has(normalizeBoundaryKey(item?.fromState)) && scopedStateNames.has(normalizeBoundaryKey(item?.toState)));
    const terminalBoundaryConfirmed = Boolean(terminalAccepted || (run.completionReason === 'TERMINAL_STATE_REACHED' && run.boundaryCompletedAt));
    const completionReason = terminalBoundaryConfirmed
      ? 'TERMINAL_STATE_REACHED'
      : req.body?.completionReason === 'TIMEOUT' || (run.timeoutAt && run.timeoutAt.getTime() <= Date.now())
        ? 'TIMEOUT'
        : initialAccepted ? 'MANUAL_STOP_BEFORE_TERMINAL' : 'MANUAL_STOP_BEFORE_INITIAL';
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

    const completed = await prisma.$transaction(async (tx) => {
      const updated = await tx.qARun.update({
        where: { id: run.id },
        data: {
        status: completedStatus,
        endedAt,
        boundaryStartedAt: run.boundaryStartedAt,
        boundaryCompletedAt: run.boundaryCompletedAt,
        lastObservedStateKey: observations.length ? String((observations[observations.length - 1] as any).behaviorKey ?? (observations[observations.length - 1] as any).stateName ?? '') : null,
        completionReason,
        browserMetadata: req.body?.browserMetadata ?? undefined,
        artifactManifest: req.body?.artifactManifest ?? undefined,
        },
      });
      const report = await tx.qAReport.upsert({
        where: { runId: run.id },
        create: { runId: run.id, status: QAReportStatus.PENDING, schemaVersion: '2.0' },
        update: {},
      });
      await tx.qAReportGenerationJob.upsert({
        where: { reportId: report.id },
        create: { reportId: report.id, status: QAReportJobStatus.QUEUED },
        update: {},
      });
      return tx.qARun.update({ where: { id: updated.id }, data: { reportId: report.id } });
    });
    await prisma.notificationEvent.create({ data:
      { organizationId: completed.organizationId, applicationId: completed.applicationId, eventType: 'QA_RUN_COMPLETED', severity: completedStatus === QARunStatus.COMPLETED ? 'INFO' : 'WARNING', payload: { runId: completed.id, flowId: completed.flowId, flowVersionId: completed.expectedGraphVersionId, completionReason, reportStatus: 'PENDING' } },
    });
    // In-app notification for the person who ran the capture. Idempotent on the
    // run id, so a replayed completion after a desktop restart never notifies
    // twice. The desktop also shows this locally the instant Chromium closes;
    // this is the durable record for the notification centre.
    if (terminalBoundaryConfirmed) {
      try {
        await new NotificationOrchestrator({ prisma, emailService: new NotificationEmailService(prisma) })
          .createNotification({
            organizationId: completed.organizationId,
            applicationId: completed.applicationId,
            runId: completed.id,
            type: 'QA_TERMINAL_REACHED',
            category: EmailCategory.REPORTS,
            severity: 'INFO',
            title: 'Terminal state reached',
            body: 'Chromium was closed and your QA report is being prepared.',
            deepLink: `/applications/${completed.applicationId}/qa-runs/${completed.id}`,
            sourceEventType: 'QA_TERMINAL_REACHED',
            sourceEventId: completed.id,
            recipients: [{ userId: completed.createdByUserId }],
          });
      } catch {
        // A notification failure must never fail an otherwise complete run.
      }
    }
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
