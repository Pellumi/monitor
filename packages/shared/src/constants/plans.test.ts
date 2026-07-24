import { describe, expect, it } from 'vitest';
import { Feature, FeatureTier } from './entitlements';
import { getOrderedPlans, PLAN_DEFINITIONS } from './plans';

describe('pricing catalog contract', () => {
  it('contains the six approved plans in commercial order', () => {
    expect(getOrderedPlans().map((plan) => plan.type)).toEqual([
      'FREE', 'LOCAL', 'SOLO', 'TEAM', 'BUSINESS', 'ENTERPRISE',
    ]);
    expect(Object.keys(PLAN_DEFINITIONS)).toHaveLength(6);
  });

  it('keeps Local Nigeria-only, NGN-only, and between Free and Solo', () => {
    const local = PLAN_DEFINITIONS.LOCAL;
    expect(local.rank).toBe(1);
    expect(local.eligibleCountries).toEqual(['NG']);
    expect(local.supportedCurrencies).toEqual(['NGN']);
    expect(local.supportedProviders).toEqual(['PAYSTACK']);
    expect(local.pricing).toMatchObject({ monthlyNgn: 2_000_000, annualNgn: 20_000_000, monthlyUsd: null });
    expect(local.limits).toMatchObject({ applications: 2, users: 2, storageGb: 10, retentionDays: 30 });
    expect(local.exportFormats).toEqual(['JSON', 'PDF']);
  });

  it('preserves the documented export and governance boundaries', () => {
    const exportTier = (type: keyof typeof PLAN_DEFINITIONS) =>
      PLAN_DEFINITIONS[type].features.find((item) => item.feature === Feature.REPORT_EXPORT)?.tier;
    expect(exportTier('FREE')).toBe(FeatureTier.JSON_ONLY);
    expect(exportTier('LOCAL')).toBe(FeatureTier.JSON_PDF);
    expect(exportTier('SOLO')).toBe(FeatureTier.ALL_FORMATS);
    expect(PLAN_DEFINITIONS.TEAM.features.find((item) => item.feature === Feature.TEAM_COLLABORATION)?.enabled).toBe(true);
    expect(PLAN_DEFINITIONS.BUSINESS.features.find((item) => item.feature === Feature.API_ACCESS)?.enabled).toBe(true);
    expect(PLAN_DEFINITIONS.ENTERPRISE.features.find((item) => item.feature === Feature.SSO)?.enabled).toBe(true);
  });

  it('does not expose placeholder enterprise limits as public contract values', () => {
    expect(PLAN_DEFINITIONS.ENTERPRISE.contactSales).toBe(true);
    expect(PLAN_DEFINITIONS.ENTERPRISE.pricing.monthlyUsd).toBeNull();
  });
});
