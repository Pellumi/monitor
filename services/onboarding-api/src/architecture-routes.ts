import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import type { PrismaClient } from '@tellann/db';
import { AuditAction } from '@tellann/db';
import { writeAuditLog, extractAuditContext } from '@tellann/authz';
import {
  applyEvidence,
  capabilityVisibleToAllMembers,
  CAPABILITY_REGISTRY,
  createArchitectureStore,
  confirmArchitecture,
  ArchitectureError,
  readRolloutFlags,
  recomputeCapabilities,
  recordArchitectureProjection,
  resolveNavigation,
  selectWorkspace,
  RESOLVER_VERSION,
  type CapabilityKey,
  type EvidenceCountKey,
} from '@tellann/capabilities';
import { ApplicationArchitectureProjectionSchema } from '@tellann/desktop-contracts';
import type { EntitlementChecker } from '@tellann/entitlement-checker';
import type { Feature } from '@tellann/shared';

type ArchitectureRequest = Request & { user?: { id: string; email: string } };
type Middleware = (req: ArchitectureRequest, res: Response, next: NextFunction) => unknown;

/** Desktop- and dashboard-facing counts. Bounded so a bad client cannot inflate a summary in one call. */
const COUNT_DELTA_LIMIT = 1_000_000;
const EvidenceDeltaSchema = z.object({
  frontendEventCount: z.number().int().min(0).max(COUNT_DELTA_LIMIT).optional(),
  backendEventCount: z.number().int().min(0).max(COUNT_DELTA_LIMIT).optional(),
  browserEventCount: z.number().int().min(0).max(COUNT_DELTA_LIMIT).optional(),
  sessionCount: z.number().int().min(0).max(COUNT_DELTA_LIMIT).optional(),
  runCount: z.number().int().min(0).max(COUNT_DELTA_LIMIT).optional(),
  inFlowEventCount: z.number().int().min(0).max(COUNT_DELTA_LIMIT).optional(),
  endpointCount: z.number().int().min(0).max(COUNT_DELTA_LIMIT).optional(),
  observedStateCount: z.number().int().min(0).max(COUNT_DELTA_LIMIT).optional(),
  observedWorkflowCount: z.number().int().min(0).max(COUNT_DELTA_LIMIT).optional(),
  declaredFlowCount: z.number().int().min(0).max(COUNT_DELTA_LIMIT).optional(),
  behaviorGraphVersion: z.string().max(64).nullable().optional(),
});

const WorkspaceSchema = z.object({
  workspaceRoot: z.string().min(1).max(1024),
});

const ConfirmationSchema = z.object({
  confirmedType: z.enum(['FRONTEND', 'BACKEND', 'MIXED']),
});

/**
 * Architecture profile, evidence and capability routes (doc §22). Every handler is scoped to the
 * application's owner. Capability decisions are the same resolver the rest of the API uses.
 */
export function createArchitectureRouter(input: {
  prisma: PrismaClient;
  verifyJwt: Middleware;
  verifyAppOwnership: Middleware;
  entitlementChecker: EntitlementChecker;
}) {
  const { prisma, verifyJwt, verifyAppOwnership, entitlementChecker } = input;
  const router = Router();
  const store = createArchitectureStore(prisma);
  const guarded = [verifyJwt, verifyAppOwnership];

  async function organizationFor(applicationId: string): Promise<string | null> {
    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      select: { organizationId: true },
    });
    return application?.organizationId ?? null;
  }

  /** Entitlements are checked once per request, not once per capability. */
  async function allowedFeatures(organizationId: string): Promise<Set<Feature>> {
    const features = new Set<Feature>();
    const keys = new Set(CAPABILITY_REGISTRY.map((d) => d.entitlementKey).filter((k): k is Feature => k !== undefined));
    for (const feature of keys) {
      if (await entitlementChecker.canAccess(organizationId, feature)) features.add(feature);
    }
    return features;
  }

  /**
   * Resolution results are cached briefly per application. Writes made through this API drop the
   * entry at once; writes from other services (the worker) are seen within the TTL.
   */
  const resolutionCache = new Map<string, { at: number; result: Awaited<ReturnType<typeof recomputeCapabilities>> }>();
  const RESOLUTION_TTL_MS = 30_000;

  function invalidate(applicationId: string) {
    resolutionCache.delete(applicationId);
  }

  async function resolveFor(applicationId: string, organizationId: string) {
    const cached = resolutionCache.get(applicationId);
    if (cached && Date.now() - cached.at < RESOLUTION_TTL_MS) return cached.result;
    const result = await resolveUncached(applicationId, organizationId);
    resolutionCache.set(applicationId, { at: Date.now(), result });
    return result;
  }

  async function resolveUncached(applicationId: string, organizationId: string) {
    const allowed = await allowedFeatures(organizationId);
    return recomputeCapabilities(store, {
      applicationId,
      planAllows: (feature) => allowed.has(feature),
      // Read access policy lives in access.ts; membership is enforced by verifyAppOwnership.
      canView: () => capabilityVisibleToAllMembers(),
      flags: readRolloutFlags(process.env),
      resolverVersion: RESOLVER_VERSION,
      now: new Date(),
    });
  }

  function auditFor(req: ArchitectureRequest) {
    return extractAuditContext(req);
  }

  router.post('/applications/:appId/analysis-projections', ...guarded, async (req: ArchitectureRequest, res) => {
    const parsed = ApplicationArchitectureProjectionSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'INVALID_PROJECTION', issues: parsed.error.issues.slice(0, 10) });
    const organizationId = await organizationFor(req.params.appId);
    if (!organizationId) return res.status(404).json({ error: 'Application not found' });

    const result = await recordArchitectureProjection(store, {
      applicationId: req.params.appId,
      organizationId,
      projection: parsed.data,
      now: new Date(),
    });
    invalidate(req.params.appId);
    await resolveFor(req.params.appId, organizationId);
    return res.status(result.status === 'UNCHANGED' ? 200 : 201).json(result);
  });

  router.get('/applications/:appId/architecture', ...guarded, async (req: ArchitectureRequest, res) => {
    const profile = await store.getProfile(req.params.appId);
    if (!profile) return res.json({ state: 'UNKNOWN_PENDING', detectedType: null, confirmedType: null, effectiveType: 'UNKNOWN' });
    return res.json({
      state: profile.state,
      detectedType: profile.detectedType,
      confirmedType: profile.confirmedType,
      effectiveType: profile.effectiveType,
      confidence: profile.confidence,
      traits: profile.traits,
      frameworks: profile.frameworks,
      workspaceRoot: profile.workspaceRoot,
      workspaceCandidates: profile.workspaceCandidates,
      reviewRequired: profile.reviewRequired,
      analysisSnapshotId: profile.analysisSnapshotId,
      detectorVersion: profile.detectorVersion,
      detectedAt: profile.detectedAt,
      confirmedAt: profile.confirmedAt,
    });
  });

  router.patch('/applications/:appId/architecture/confirmation', ...guarded, async (req: ArchitectureRequest, res) => {
    const parsed = ConfirmationSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'INVALID_CONFIRMATION' });
    const organizationId = await organizationFor(req.params.appId);
    if (!organizationId) return res.status(404).json({ error: 'Application not found' });

    try {
      const result = await confirmArchitecture(store, {
        applicationId: req.params.appId,
        userId: req.user!.id,
        confirmedType: parsed.data.confirmedType,
        now: new Date(),
      });
      const { ipAddress, userAgent } = auditFor(req);
      void writeAuditLog(prisma, {
        action: result.action === 'CORRECTED' ? AuditAction.APPLICATION_ARCHITECTURE_CORRECTED : AuditAction.APPLICATION_ARCHITECTURE_CONFIRMED,
        userId: req.user!.id,
        organizationId,
        applicationId: req.params.appId,
        ipAddress,
        userAgent,
        metadata: {
          detectedType: result.profile.detectedType,
          confirmedType: result.profile.confirmedType,
          previousEffectiveType: result.previousEffectiveType,
        },
      });
      invalidate(req.params.appId);
      await resolveFor(req.params.appId, organizationId);
      return res.json({ action: result.action, effectiveType: result.profile.effectiveType, confirmedType: result.profile.confirmedType });
    } catch (error) {
      if (error instanceof ArchitectureError) {
        return res.status(error.code === 'NOT_ANALYSED' ? 409 : 400).json({ error: error.code, message: error.message });
      }
      throw error;
    }
  });

  router.patch('/applications/:appId/architecture/workspace', ...guarded, async (req: ArchitectureRequest, res) => {
    const parsed = WorkspaceSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'INVALID_WORKSPACE' });
    try {
      const profile = await selectWorkspace(store, { applicationId: req.params.appId, workspaceRoot: parsed.data.workspaceRoot, now: new Date() });
      invalidate(req.params.appId);
      // The choice takes effect on the next analysis, which detects that workspace.
      return res.json({ workspaceRoot: profile.workspaceRoot, candidates: profile.workspaceCandidates, reanalysisRequired: true });
    } catch (error) {
      if (error instanceof ArchitectureError) {
        return res.status(error.code === 'NOT_ANALYSED' ? 409 : 400).json({ error: error.code, message: error.message });
      }
      throw error;
    }
  });

  router.get('/applications/:appId/architecture/history', ...guarded, async (req: ArchitectureRequest, res) => {
    const revisions = await store.listRevisions(req.params.appId);
    return res.json({
      revisions: revisions.map((revision) => ({
        revisionNumber: revision.revisionNumber,
        detectedType: revision.detectedType,
        confirmedType: revision.confirmedType,
        reason: revision.reason,
        analysisSnapshotId: revision.analysisSnapshotId,
        detectorVersion: revision.detectorVersion,
        createdAt: revision.createdAt,
      })),
    });
  });

  router.get('/applications/:appId/evidence-summary', ...guarded, async (req: ArchitectureRequest, res) => {
    const counts = await store.getEvidence(req.params.appId);
    return res.json(counts ?? { frontendEventCount: 0, backendEventCount: 0, browserEventCount: 0, sessionCount: 0, runCount: 0, inFlowEventCount: 0, endpointCount: 0, observedStateCount: 0, observedWorkflowCount: 0, declaredFlowCount: 0, behaviorGraphVersion: null });
  });

  /**
   * Internal: records evidence deltas from the event pipeline. Recomputes only when a new evidence
   * source appears (doc §33). Not exposed to dashboard users; mounted for service-to-service writes.
   */
  router.post('/applications/:appId/evidence-deltas', ...guarded, async (req: ArchitectureRequest, res) => {
    const parsed = EvidenceDeltaSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'INVALID_EVIDENCE_DELTA' });
    const organizationId = await organizationFor(req.params.appId);
    if (!organizationId) return res.status(404).json({ error: 'Application not found' });
    const { behaviorGraphVersion, ...counts } = parsed.data;
    const transitions = await applyEvidence(store, {
      applicationId: req.params.appId,
      delta: counts as Partial<Record<EvidenceCountKey, number>>,
      behaviorGraphVersion,
    });
    if (transitions.length > 0) {
      invalidate(req.params.appId);
      await resolveFor(req.params.appId, organizationId);
    }
    return res.json({ transitions });
  });

  router.get('/applications/:appId/capabilities', ...guarded, async (req: ArchitectureRequest, res) => {
    const organizationId = await organizationFor(req.params.appId);
    if (!organizationId) return res.status(404).json({ error: 'Application not found' });
    const flags = readRolloutFlags(process.env);
    const result = await resolveFor(req.params.appId, organizationId);
    // Every routed capability, including hidden ones, so the sidebar can remove a link the
    // resolver hides without guessing from what is absent.
    const routes = Object.fromEntries(
      CAPABILITY_REGISTRY
        .filter((definition) => definition.navigation.route !== null)
        .map((definition) => {
          const resolution = result.resolutions[definition.key];
          return [definition.navigation.route as string, {
            key: definition.key,
            state: resolution.state,
            reason: resolution.reason ?? null,
            locked: resolution.state === 'PLAN_LOCKED',
          }];
        }),
    );
    return res.json({
      resolverVersion: RESOLVER_VERSION,
      uiEnabled: flags.ui,
      enforceEnabled: flags.enforce,
      capabilities: result.resolutions,
      navigation: resolveNavigation(result.resolutions),
      routes,
      reviewRequired: result.reviewRequired,
    });
  });

  return router;
}
