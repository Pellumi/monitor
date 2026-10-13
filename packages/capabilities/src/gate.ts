import type { PrismaClient } from '@tellann/db';
import type { Feature } from '@tellann/shared';
import { CAPABILITY_REGISTRY } from './registry';
import { capabilityVisibleToAllMembers } from './access';
import { enforcementFor } from './enforce';
import type { RolloutFlags } from './flags';
import { createArchitectureStore } from './prisma-store';
import { RESOLVER_VERSION, type CapabilityResolution } from './resolver';
import { buildCapabilityBasis, type CapabilityBasis } from './basis';
import { recomputeCapabilities, type RecomputeInput } from './service';
import type { CapabilityKey } from './types';

// ─────────────────────────────────────────────────────────────
// Enforcement for protected API routes (doc §23, plan Phase G).
//
// Each engine builds one resolver from its own Prisma client and entitlement check, then guards
// its routes with `requireCapability`. The decision comes from `enforcementFor`, so every service
// maps the same state to the same HTTP outcome.
//
// Enforcement is off unless CAPABILITIES_ENFORCE is set, so routes keep today's behaviour until
// the rollout turns it on.
// ─────────────────────────────────────────────────────────────

export type CapabilityResolverFn = (applicationId: string, key: CapabilityKey) => Promise<CapabilityResolution>;

/** Builds the resolver for one service. `canAccess` is the service's entitlement check. */
export function createCapabilityResolver(input: {
  prisma: PrismaClient;
  canAccess: (organizationId: string, feature: Feature) => Promise<boolean>;
  flags: RolloutFlags;
  now?: () => Date;
}): CapabilityResolverFn {
  const store = createArchitectureStore(input.prisma);
  const features = [...new Set(CAPABILITY_REGISTRY.map((d) => d.entitlementKey).filter((k): k is Feature => k !== undefined))];

  return async (applicationId, key) => {
    const application = await input.prisma.application.findUnique({
      where: { id: applicationId },
      select: { organizationId: true },
    });
    if (!application?.organizationId) throw new Error(`Application ${applicationId} has no organization`);

    const allowed = new Set<Feature>();
    for (const feature of features) {
      if (await input.canAccess(application.organizationId, feature)) allowed.add(feature);
    }
    const recomputeInput: RecomputeInput = {
      applicationId,
      planAllows: (feature) => allowed.has(feature),
      // Owner membership is enforced by the route guard; per-capability RBAC is not modelled yet.
      canView: () => capabilityVisibleToAllMembers(),
      flags: input.flags,
      resolverVersion: RESOLVER_VERSION,
      now: input.now?.() ?? new Date(),
    };
    const result = await recomputeCapabilities(store, recomputeInput);
    return result.resolutions[key];
  };
}

export interface GateRequest {
  params: Record<string, string | undefined>;
}

export interface GateResponse {
  status(code: number): GateResponse;
  json(body: unknown): unknown;
}

/**
 * Express-compatible guard for one capability. With enforcement off it passes straight through.
 * With enforcement on, a state maps to exactly one outcome (see `enforcementFor`).
 */
export function requireCapability(
  resolve: CapabilityResolverFn,
  key: CapabilityKey,
  flags: RolloutFlags,
  options: { applicationIdParam?: string } = {},
) {
  const param = options.applicationIdParam ?? 'id';
  return async (req: GateRequest, res: GateResponse, next: (error?: unknown) => void) => {
    if (!flags.enforce) return next();
    const applicationId = req.params[param];
    if (!applicationId) return res.status(400).json({ error: 'APPLICATION_ID_REQUIRED' });

    let resolution: CapabilityResolution;
    try {
      resolution = await resolve(applicationId, key);
    } catch (error) {
      return next(error);
    }
    const decision = enforcementFor(resolution);
    switch (decision.action) {
      case 'PROCEED':
        return next();
      case 'TYPED_EMPTY':
        return res.status(200).json({ capability: key, state: resolution.state, reason: decision.reason, empty: true });
      case 'REJECT':
        return res.status(decision.status).json({
          error: 'CAPABILITY_UNAVAILABLE',
          capability: key,
          state: resolution.state,
          reason: decision.reason ?? null,
        });
    }
  };
}

/**
 * Builds the capability basis a report is stamped with. Uses the same resolution path as the API,
 * so a report and the dashboard cannot disagree about what was available at generation time.
 */
export async function applicationCapabilityBasis(input: {
  prisma: PrismaClient;
  canAccess: (organizationId: string, feature: Feature) => Promise<boolean>;
  flags: RolloutFlags;
  applicationId: string;
  now?: Date;
}): Promise<CapabilityBasis | null> {
  const application = await input.prisma.application.findUnique({
    where: { id: input.applicationId },
    select: { organizationId: true },
  });
  if (!application?.organizationId) return null;

  const store = createArchitectureStore(input.prisma);
  const features = [...new Set(CAPABILITY_REGISTRY.map((d) => d.entitlementKey).filter((k): k is Feature => k !== undefined))];
  const allowed = new Set<Feature>();
  for (const feature of features) {
    if (await input.canAccess(application.organizationId, feature)) allowed.add(feature);
  }
  const now = input.now ?? new Date();
  const result = await recomputeCapabilities(store, {
    applicationId: input.applicationId,
    planAllows: (feature) => allowed.has(feature),
    canView: () => capabilityVisibleToAllMembers(),
    flags: input.flags,
    resolverVersion: RESOLVER_VERSION,
    now,
  });
  const revisions = await store.listRevisions(input.applicationId);
  const counts = await store.getEvidence(input.applicationId);
  return buildCapabilityBasis({
    resolverVersion: RESOLVER_VERSION,
    architectureRevisionNumber: revisions.at(-1)?.revisionNumber ?? null,
    resolutions: result.resolutions,
    counts,
    stampedAt: now,
  });
}
