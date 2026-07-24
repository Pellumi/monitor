import { PrismaClient, PlanType, SubscriptionStatus } from '@sots/db';
import { Feature, PLAN_DEFINITIONS, type ResourceLimits, type SupportEntitlements, type PlanTypeKey } from '@sots/shared';

export interface ResolvedEntitlement {
  planType: PlanType;
  features: Record<Feature, boolean | string>;
  limits: ResourceLimits;
  support: SupportEntitlements;
}

export interface QuotaResult {
  allowed: boolean;
  metric: string;
  current: number;
  limit: number | null;
  planType: PlanType;
  resetAt?: Date;
}

export class EntitlementChecker {
  constructor(private prisma: PrismaClient) {}

  /**
   * Check if organization has access to a specific feature.
   */
  async canAccess(orgId: string, feature: Feature): Promise<boolean> {
    const subscription = await this.prisma.subscription.findUnique({
      where: { organizationId: orgId }
    });

    if (subscription) {
      // SOTS BSS Section 15: Restrict specific activities for suspended/cancelled/expired subscriptions
      if (
        subscription.status === SubscriptionStatus.SUSPENDED ||
        subscription.status === SubscriptionStatus.CANCELLED ||
        subscription.status === SubscriptionStatus.EXPIRED
      ) {
        const BLOCKED_WHEN_SUSPENDED = [
          Feature.APPLICATION_ONBOARDING,
          Feature.DEMONSTRATION_MODE,
          Feature.SESSION_RECORDING,
          Feature.REPORT_GENERATION,
        ];
        if (BLOCKED_WHEN_SUSPENDED.includes(feature)) {
          return false;
        }
      }
    }

    const entitlement = await this.getEntitlement(orgId);
    const resolvedFeatures = entitlement.features as Record<string, any>;
    return !!resolvedFeatures[feature];
  }

  /**
   * Check if organization can create another application.
   */
  async canCreateApplication(orgId: string): Promise<{ allowed: boolean; current: number; limit: number }> {
    const active = await this.isSubscriptionActive(orgId);
    if (!active) {
      return { allowed: false, current: 0, limit: 0 };
    }

    const entitlement = await this.getEntitlement(orgId);
    const limit = entitlement.limits.applications;
    
    const current = await this.prisma.application.count({
      where: { organizationId: orgId }
    });

    return {
      allowed: current < limit,
      current,
      limit
    };
  }

  /**
   * Check if organization can create another user (API Key).
   */
  async canCreateUser(orgId: string): Promise<{ allowed: boolean; current: number; limit: number }> {
    const active = await this.isSubscriptionActive(orgId);
    if (!active) {
      return { allowed: false, current: 0, limit: 0 };
    }

    const entitlement = await this.getEntitlement(orgId);
    const limit = entitlement.limits.users;

    const current = await this.prisma.apiKey.count({
      where: {
        environment: {
          application: {
            organizationId: orgId
          }
        },
        revokedAt: null
      }
    });

    return {
      allowed: current < limit,
      current,
      limit
    };
  }

  /** Organization users are active members plus currently usable invitations. */
  async canInviteMember(orgId: string): Promise<QuotaResult> {
    const entitlement = await this.getEntitlement(orgId);
    const now = new Date();
    const [members, invitations] = await Promise.all([
      this.prisma.organizationMembership.count({ where: { organizationId: orgId } }),
      this.prisma.organizationInvitation.count({
        where: { organizationId: orgId, acceptedAt: null, expiresAt: { gt: now } },
      }),
    ]);
    const current = members + invitations;
    return {
      allowed: current < entitlement.limits.users,
      metric: 'USERS',
      current,
      limit: entitlement.limits.users,
      planType: entitlement.planType,
    };
  }

  /** Demonstrations are metered per organization and subscription billing period. */
  async canStartDemonstration(orgId: string): Promise<QuotaResult> {
    const [entitlement, subscription] = await Promise.all([
      this.getEntitlement(orgId),
      this.prisma.subscription.findUnique({ where: { organizationId: orgId } }),
    ]);
    const limit = entitlement.limits.demoSessions;
    if (limit === null) {
      return { allowed: true, metric: 'DEMONSTRATIONS', current: 0, limit, planType: entitlement.planType };
    }
    const periodStart = subscription?.currentPeriodStart ?? new Date(0);
    const periodEnd = subscription?.currentPeriodEnd;
    const current = await this.prisma.demonstration.count({
      where: {
        application: { organizationId: orgId },
        startedAt: { gte: periodStart, ...(periodEnd ? { lt: periodEnd } : {}) },
      },
    });
    return {
      allowed: current < limit,
      metric: 'DEMONSTRATIONS',
      current,
      limit,
      planType: entitlement.planType,
      ...(periodEnd ? { resetAt: periodEnd } : {}),
    };
  }

  async canReserveStorage(orgId: string, additionalBytes: bigint): Promise<QuotaResult> {
    const entitlement = await this.getEntitlement(orgId);
    const aggregate = await this.prisma.storageLedgerEntry.aggregate({
      where: { organizationId: orgId, deletedAt: null },
      _sum: { bytes: true, reservedBytes: true },
    });
    const currentBytes = (aggregate._sum.bytes ?? 0n) + (aggregate._sum.reservedBytes ?? 0n);
    const limitBytes = BigInt(entitlement.limits.storageGb) * 1024n * 1024n * 1024n;
    return {
      allowed: currentBytes + additionalBytes <= limitBytes,
      metric: 'STORAGE_GB',
      current: Number(currentBytes) / 1024 / 1024 / 1024,
      limit: entitlement.limits.storageGb,
      planType: entitlement.planType,
    };
  }

  /**
   * Check if organization can create another environment for an application.
   */
  async canCreateEnvironment(applicationId: string): Promise<{ allowed: boolean; current: number; limit: number }> {
    const app = await this.prisma.application.findUnique({
      where: { id: applicationId },
      select: { organizationId: true }
    });

    if (!app || !app.organizationId) {
      return { allowed: false, current: 0, limit: 0 };
    }

    const orgId = app.organizationId;
    const active = await this.isSubscriptionActive(orgId);
    if (!active) {
      return { allowed: false, current: 0, limit: 0 };
    }

    const entitlement = await this.getEntitlement(orgId);
    const limit = entitlement.limits.maxEnvironmentsPerApp;

    const current = await this.prisma.environment.count({
      where: { applicationId }
    });

    return {
      allowed: current < limit,
      current,
      limit
    };
  }

  /**
   * Check if organization can create another API key for an environment.
   */
  async canCreateApiKey(environmentId: string): Promise<{ allowed: boolean; current: number; limit: number }> {
    const env = await this.prisma.environment.findUnique({
      where: { id: environmentId },
      select: {
        application: {
          select: { organizationId: true }
        }
      }
    });

    if (!env || !env.application.organizationId) {
      return { allowed: false, current: 0, limit: 0 };
    }

    const orgId = env.application.organizationId;
    const active = await this.isSubscriptionActive(orgId);
    if (!active) {
      return { allowed: false, current: 0, limit: 0 };
    }

    const entitlement = await this.getEntitlement(orgId);
    const limit = entitlement.limits.maxApiKeys;

    const current = await this.prisma.apiKey.count({
      where: { environmentId, revokedAt: null }
    });

    return {
      allowed: current < limit,
      current,
      limit
    };
  }

  /**
   * Get the full resolved entitlement object for an organization.
   * Auto-resolves if it does not yet exist.
   */
  async getEntitlement(orgId: string): Promise<ResolvedEntitlement> {
    let entitlement = await this.prisma.entitlement.findUnique({
      where: { organizationId: orgId }
    });

    if (!entitlement) {
      await this.resolveEntitlement(orgId);
      entitlement = await this.prisma.entitlement.findUnique({
        where: { organizationId: orgId }
      });
      if (!entitlement) {
        throw new Error(`Failed to resolve entitlement for organization: ${orgId}`);
      }
    }

    // PLAN_DEFINITIONS is the runtime authority. Repair denormalized entitlement
    // rows created from incomplete/stale database feature flags before returning
    // them. Enterprise overrides are resolved separately and must not be erased.
    const canonicalPlan = PLAN_DEFINITIONS[entitlement.planType as PlanTypeKey];
    if (canonicalPlan) {
      const subscription = await this.prisma.subscription.findUnique({
        where: { organizationId: orgId },
        select: { enterpriseOverrides: true, plan: { select: { type: true } } },
      });
      const storedFeatures = entitlement.features as Record<string, boolean | string>;
      const storedLimits = entitlement.limits as unknown as ResourceLimits;
      const canonicalFeatures = Object.fromEntries(
        canonicalPlan.features.map((item) => [item.feature, item.enabled ? item.tier || true : false]),
      ) as Record<string, boolean | string>;
      const featureDrift = Object.values(Feature).some(
        (feature) => storedFeatures[feature] !== canonicalFeatures[feature],
      );
      const limitDrift = (Object.keys(canonicalPlan.limits) as Array<keyof ResourceLimits>).some(
        (key) => storedLimits[key] !== canonicalPlan.limits[key],
      );
      const planDrift = subscription?.plan.type !== entitlement.planType;

      if (!subscription?.enterpriseOverrides && (featureDrift || limitDrift || planDrift)) {
        await this.resolveEntitlement(orgId);
        entitlement = await this.prisma.entitlement.findUnique({
          where: { organizationId: orgId },
        });
        if (!entitlement) {
          throw new Error(`Failed to repair entitlement for organization: ${orgId}`);
        }
      }
    }

    return {
      planType: entitlement.planType,
      features: entitlement.features as any,
      limits: entitlement.limits as any,
      support: entitlement.support as any,
    };
  }

  /**
   * Re-resolves organization entitlements from its subscription and plan definitions,
   * merging any enterprise/custom overrides and persisting the output denormalized.
   */
  async resolveEntitlement(orgId: string): Promise<void> {
    let subscription = await this.prisma.subscription.findUnique({
      where: { organizationId: orgId },
      include: { plan: { include: { featureFlags: true } } },
    });

    // If subscription doesn't exist, auto-create a FREE subscription (ES Section 12)
    if (!subscription) {
      let freePlan = await this.prisma.plan.findUnique({
        where: { type: PlanType.FREE },
        include: { featureFlags: true },
      });

      // Fallback in case plans are not yet seeded
      if (!freePlan) {
        freePlan = await this.prisma.plan.create({
          data: {
            type: PlanType.FREE,
            name: 'Free',
            description: 'Free tier',
            maxApplications: 1,
            maxEnvironmentsPerApp: 1,
            maxApiKeys: 1,
            maxUsers: 1,
            maxStorageGb: 1,
            retentionDays: 14,
            maxDemoSessions: 10,
            isPublic: true,
            sortOrder: 0,
          },
          include: { featureFlags: true },
        });
      }

      subscription = await this.prisma.subscription.create({
        data: {
          organizationId: orgId,
          planId: freePlan.id,
          status: SubscriptionStatus.ACTIVE,
          currentPeriodEnd: new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000), // 100 years
        },
        include: { plan: { include: { featureFlags: true } } },
      });
    }

    const staticPlan = PLAN_DEFINITIONS[subscription.plan.type as PlanTypeKey];

    // Resolve features from the canonical catalog. Database feature flags are a
    // synchronized query representation, not a second source of truth.
    const features = {} as Record<Feature, boolean | string>;
    for (const key of Object.values(Feature)) {
      features[key] = false;
    }
    if (staticPlan) {
      for (const feature of staticPlan.features) {
        features[feature.feature] = feature.enabled ? feature.tier || true : false;
      }
    } else {
      for (const ff of subscription.plan.featureFlags) {
        const featureKey = ff.feature as Feature;
        features[featureKey] = ff.enabled ? ff.tier || true : false;
      }
    }

    // Resolve limits from the same canonical catalog when the plan is known.
    const limits: ResourceLimits = staticPlan
      ? { ...staticPlan.limits }
      : {
          applications: subscription.plan.maxApplications,
          users: subscription.plan.maxUsers,
          storageGb: subscription.plan.maxStorageGb,
          retentionDays: subscription.plan.retentionDays,
          demoSessions: subscription.plan.maxDemoSessions,
          maxEnvironmentsPerApp: subscription.plan.maxEnvironmentsPerApp,
          maxApiKeys: subscription.plan.maxApiKeys,
        };

    // Resolve support (from static definitions)
    const support: SupportEntitlements = staticPlan ? { ...staticPlan.support } : {
      communitySupport: true,
      emailSupport: false,
      priorityEmailSupport: false,
      dedicatedSuccessManager: false,
      architectureAssistance: false,
      enterpriseSla: false,
    };

    // Merge Enterprise Overrides
    if (subscription.enterpriseOverrides && typeof subscription.enterpriseOverrides === 'object') {
      const overrides = subscription.enterpriseOverrides as any;

      // Structured overrides
      if (overrides.features && typeof overrides.features === 'object') {
        for (const [k, v] of Object.entries(overrides.features)) {
          features[k as Feature] = v as boolean | string;
        }
      }
      if (overrides.limits && typeof overrides.limits === 'object') {
        for (const [k, v] of Object.entries(overrides.limits)) {
          (limits as any)[k] = v;
        }
      }
      if (overrides.support && typeof overrides.support === 'object') {
        for (const [k, v] of Object.entries(overrides.support)) {
          (support as any)[k] = v;
        }
      }

      // Flat overrides fallback
      for (const [key, value] of Object.entries(overrides)) {
        if (key === 'features' || key === 'limits' || key === 'support') continue;
        if (key in features) {
          features[key as Feature] = value as boolean | string;
        } else if (key in limits) {
          (limits as any)[key] = value;
        } else if (key.startsWith('max') || key === 'retentionDays') {
          const limitKey = key.replace('max', '').toLowerCase();
          if (limitKey === 'applications') limits.applications = value as number;
          if (limitKey === 'users') limits.users = value as number;
          if (limitKey === 'storagegb') limits.storageGb = value as number;
          if (limitKey === 'demosessions') limits.demoSessions = value as number;
          if (key === 'retentionDays') limits.retentionDays = value as number;
          if (limitKey === 'maxenvironmentsperapp' || limitKey === 'environmentsperapp') limits.maxEnvironmentsPerApp = value as number;
          if (limitKey === 'maxapikeys' || limitKey === 'apikeys') limits.maxApiKeys = value as number;
        }
      }
    }

    // Upsert resolved entitlement in database
    await this.prisma.entitlement.upsert({
      where: { organizationId: orgId },
      create: {
        organizationId: orgId,
        planType: subscription.plan.type,
        features: features as any,
        limits: limits as any,
        support: support as any,
      },
      update: {
        planType: subscription.plan.type,
        features: features as any,
        limits: limits as any,
        support: support as any,
        updatedAt: new Date(),
      }
    });
  }

  /**
   * Check if subscription status is active or in trial/grace period.
   */
  async isSubscriptionActive(orgId: string): Promise<boolean> {
    const subscription = await this.prisma.subscription.findUnique({
      where: { organizationId: orgId }
    });

    if (!subscription) {
      try {
        await this.resolveEntitlement(orgId);
        const sub = await this.prisma.subscription.findUnique({
          where: { organizationId: orgId }
        });
        const activeStatuses = [
          SubscriptionStatus.ACTIVE,
          SubscriptionStatus.TRIAL,
          SubscriptionStatus.GRACE_PERIOD,
          SubscriptionStatus.PAST_DUE
        ] as string[];
        return sub ? activeStatuses.includes(sub.status) : false;
      } catch {
        return false;
      }
    }

    const activeStatuses = [
      SubscriptionStatus.ACTIVE,
      SubscriptionStatus.TRIAL,
      SubscriptionStatus.GRACE_PERIOD,
      SubscriptionStatus.PAST_DUE
    ] as string[];
    return activeStatuses.includes(subscription.status);
  }
}
