import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EntitlementChecker } from './index';
import { Feature } from '@sots/shared';
import { PlanType, SubscriptionStatus } from '@sots/db';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeFeatureMap(enabled: Feature[]): Record<Feature, boolean> {
  const map = {} as Record<Feature, boolean>;
  for (const f of Object.values(Feature)) map[f] = false;
  for (const f of enabled) map[f] = true;
  return map;
}

function makeEntitlement(features: Feature[]) {
  return {
    organizationId: 'org-1',
    planType: PlanType.SOLO,
    features: makeFeatureMap(features),
    limits: {
      applications: 3,
      users: 10,
      storageGb: 10,
      retentionDays: 30,
      demoSessions: 100,
      maxEnvironmentsPerApp: 3,
      maxApiKeys: 5,
    },
    support: {
      communitySupport: true,
      emailSupport: true,
      priorityEmailSupport: false,
      dedicatedSuccessManager: false,
      architectureAssistance: false,
      enterpriseSla: false,
    },
    updatedAt: new Date(),
  };
}

function makeSubscription(status: SubscriptionStatus = SubscriptionStatus.ACTIVE) {
  return {
    id: 'sub-1',
    organizationId: 'org-1',
    planId: 'plan-1',
    status,
    currentPeriodEnd: new Date(Date.now() + 86_400_000 * 30),
    enterpriseOverrides: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    plan: {
      id: 'plan-1',
      type: PlanType.SOLO,
      name: 'Starter',
      description: null,
      maxApplications: 3,
      maxEnvironmentsPerApp: 3,
      maxApiKeys: 5,
      maxUsers: 10,
      maxStorageGb: 10,
      retentionDays: 30,
      maxDemoSessions: 100,
      isPublic: true,
      sortOrder: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      featureFlags: [],
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Mock prisma
// ─────────────────────────────────────────────────────────────────────────────

function makePrisma(overrides: Partial<{
  entitlement: any;
  subscription: any;
  applicationOrgId: string | null;
  applicationCount: number;
  apiKeyCount: number;
  environmentCount: number;
}> = {}) {
  const {
    entitlement = null,
    subscription = makeSubscription(),
    applicationOrgId = 'org-1',
    applicationCount = 2,
    apiKeyCount = 1,
    environmentCount = 1,
  } = overrides;

  return {
    entitlement: {
      findUnique: vi.fn().mockResolvedValue(entitlement),
      upsert: vi.fn().mockResolvedValue(entitlement),
    },
    subscription: {
      findUnique: vi.fn().mockResolvedValue(subscription),
      create: vi.fn().mockResolvedValue(subscription),
    },
    plan: {
      findUnique: vi.fn().mockResolvedValue(subscription?.plan ?? null),
      create: vi.fn().mockResolvedValue(subscription?.plan ?? null),
    },
    application: {
      findUnique: vi.fn().mockResolvedValue(
        applicationOrgId ? { organizationId: applicationOrgId } : null
      ),
      count: vi.fn().mockResolvedValue(applicationCount),
    },
    apiKey: {
      count: vi.fn().mockResolvedValue(apiKeyCount),
    },
    environment: {
      findUnique: vi.fn().mockResolvedValue({
        application: { organizationId: applicationOrgId },
      }),
      count: vi.fn().mockResolvedValue(environmentCount),
    },
  } as any;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('EntitlementChecker.canAccess', () => {
  it('returns true when entitlement row has feature enabled', async () => {
    const prisma = makePrisma({
      entitlement: makeEntitlement([Feature.SESSION_RECORDING, Feature.REPORT_GENERATION]),
    });
    const checker = new EntitlementChecker(prisma);
    expect(await checker.canAccess('org-1', Feature.SESSION_RECORDING)).toBe(true);
  });

  it('returns false when feature is not in entitlement', async () => {
    const prisma = makePrisma({
      entitlement: makeEntitlement([Feature.DEMONSTRATION_MODE]),
    });
    const checker = new EntitlementChecker(prisma);
    expect(await checker.canAccess('org-1', Feature.COVERAGE_ANALYSIS)).toBe(false);
  });

  it('blocks SESSION_RECORDING when subscription is SUSPENDED', async () => {
    const prisma = makePrisma({
      entitlement: makeEntitlement([Feature.SESSION_RECORDING]),
      subscription: makeSubscription(SubscriptionStatus.SUSPENDED),
    });
    const checker = new EntitlementChecker(prisma);
    expect(await checker.canAccess('org-1', Feature.SESSION_RECORDING)).toBe(false);
  });

  it('blocks REPORT_GENERATION when subscription is CANCELLED', async () => {
    const prisma = makePrisma({
      entitlement: makeEntitlement([Feature.REPORT_GENERATION]),
      subscription: makeSubscription(SubscriptionStatus.CANCELLED),
    });
    const checker = new EntitlementChecker(prisma);
    expect(await checker.canAccess('org-1', Feature.REPORT_GENERATION)).toBe(false);
  });

  it('does NOT block ENDPOINT_INTELLIGENCE when subscription is SUSPENDED', async () => {
    // ENDPOINT_INTELLIGENCE is not in BLOCKED_WHEN_SUSPENDED list
    const prisma = makePrisma({
      entitlement: makeEntitlement([Feature.ENDPOINT_INTELLIGENCE]),
      subscription: makeSubscription(SubscriptionStatus.SUSPENDED),
    });
    const checker = new EntitlementChecker(prisma);
    expect(await checker.canAccess('org-1', Feature.ENDPOINT_INTELLIGENCE)).toBe(true);
  });

  it('resolves entitlement from subscription when entitlement row missing', async () => {
    const prisma = makePrisma({ entitlement: null });
    // After upsert, findUnique returns the resolved entitlement
    prisma.entitlement.findUnique
      .mockResolvedValueOnce(null)          // first call: missing
      .mockResolvedValue(makeEntitlement([Feature.SESSION_RECORDING])); // after resolve
    const checker = new EntitlementChecker(prisma);
    expect(await checker.canAccess('org-1', Feature.SESSION_RECORDING)).toBe(true);
  });
});

describe('EntitlementChecker.canCreateApplication', () => {
  it('allows when count is below limit', async () => {
    const prisma = makePrisma({
      entitlement: makeEntitlement([]),
      applicationCount: 1,
    });
    // getEntitlement path
    prisma.entitlement.findUnique.mockResolvedValue(makeEntitlement([]));
    const checker = new EntitlementChecker(prisma);
    const result = await checker.canCreateApplication('org-1');
    expect(result.allowed).toBe(true);
    expect(result.current).toBe(1);
    expect(result.limit).toBe(3);
  });

  it('blocks when count equals limit', async () => {
    const prisma = makePrisma({
      entitlement: makeEntitlement([]),
      applicationCount: 3,
    });
    prisma.entitlement.findUnique.mockResolvedValue(makeEntitlement([]));
    const checker = new EntitlementChecker(prisma);
    const result = await checker.canCreateApplication('org-1');
    expect(result.allowed).toBe(false);
    expect(result.current).toBe(3);
  });

  it('blocks entirely when subscription is inactive', async () => {
    const prisma = makePrisma({
      subscription: makeSubscription(SubscriptionStatus.EXPIRED),
    });
    const checker = new EntitlementChecker(prisma);
    const result = await checker.canCreateApplication('org-1');
    expect(result.allowed).toBe(false);
  });
});

describe('EntitlementChecker.isSubscriptionActive', () => {
  it('returns true for ACTIVE subscription', async () => {
    const prisma = makePrisma({ subscription: makeSubscription(SubscriptionStatus.ACTIVE) });
    const checker = new EntitlementChecker(prisma);
    expect(await checker.isSubscriptionActive('org-1')).toBe(true);
  });

  it('returns true for TRIAL subscription', async () => {
    const prisma = makePrisma({ subscription: makeSubscription(SubscriptionStatus.TRIAL) });
    const checker = new EntitlementChecker(prisma);
    expect(await checker.isSubscriptionActive('org-1')).toBe(true);
  });

  it('returns true for GRACE_PERIOD subscription', async () => {
    const prisma = makePrisma({ subscription: makeSubscription(SubscriptionStatus.GRACE_PERIOD) });
    const checker = new EntitlementChecker(prisma);
    expect(await checker.isSubscriptionActive('org-1')).toBe(true);
  });

  it('returns false for SUSPENDED subscription', async () => {
    const prisma = makePrisma({ subscription: makeSubscription(SubscriptionStatus.SUSPENDED) });
    const checker = new EntitlementChecker(prisma);
    expect(await checker.isSubscriptionActive('org-1')).toBe(false);
  });

  it('returns false for CANCELLED subscription', async () => {
    const prisma = makePrisma({ subscription: makeSubscription(SubscriptionStatus.CANCELLED) });
    const checker = new EntitlementChecker(prisma);
    expect(await checker.isSubscriptionActive('org-1')).toBe(false);
  });
});

describe('EntitlementChecker.canCreateApiKey', () => {
  it('allows when under limit', async () => {
    const prisma = makePrisma({ apiKeyCount: 2 });
    prisma.entitlement.findUnique.mockResolvedValue(makeEntitlement([]));
    const checker = new EntitlementChecker(prisma);
    const result = await checker.canCreateApiKey('env-1');
    expect(result.allowed).toBe(true);
    expect(result.limit).toBe(5);
  });

  it('blocks at limit', async () => {
    const prisma = makePrisma({ apiKeyCount: 5 });
    prisma.entitlement.findUnique.mockResolvedValue(makeEntitlement([]));
    const checker = new EntitlementChecker(prisma);
    const result = await checker.canCreateApiKey('env-1');
    expect(result.allowed).toBe(false);
  });
});

describe('EntitlementChecker.resolveEntitlement — enterprise overrides', () => {
  it('applies flat feature override from enterpriseOverrides', async () => {
    const sub = makeSubscription();
    sub.enterpriseOverrides = {
      [Feature.ENDPOINT_INTELLIGENCE]: true,
      [Feature.SSO]: true,
    } as any;

    const prisma = makePrisma({ subscription: sub, entitlement: null });
    let upsertArg: any;
    prisma.entitlement.upsert.mockImplementation(({ create }: any) => {
      upsertArg = create;
      return Promise.resolve(create);
    });
    prisma.entitlement.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValue(upsertArg);

    const checker = new EntitlementChecker(prisma);
    await checker.resolveEntitlement('org-1');

    expect(prisma.entitlement.upsert).toHaveBeenCalled();
  });

  it('applies structured limits override', async () => {
    const sub = makeSubscription();
    sub.enterpriseOverrides = { limits: { applications: 999 } } as any;

    const prisma = makePrisma({ subscription: sub, entitlement: null });
    let upsertArg: any;
    prisma.entitlement.upsert.mockImplementation(({ create }: any) => {
      upsertArg = create;
      return Promise.resolve(create);
    });

    const checker = new EntitlementChecker(prisma);
    await checker.resolveEntitlement('org-1');

    expect(upsertArg.limits.applications).toBe(999);
  });
});
