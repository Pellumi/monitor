import { describe, expect, it } from 'vitest';
import {
  Feature,
  FeatureTier,
  isReportFormatEntitled,
  reportFormatsForTier,
  resolveDefaultReportFormat,
} from './entitlements';
import { PLAN_DEFINITIONS } from './plans';

/** The resolved REPORT_EXPORT tier a plan grants, as EntitlementChecker would produce it. */
function exportTierFor(planType: keyof typeof PLAN_DEFINITIONS): boolean | string {
  const config = PLAN_DEFINITIONS[planType].features.find(
    (entry) => entry.feature === Feature.REPORT_EXPORT,
  );
  if (!config?.enabled) return false;
  return config.tier ?? true;
}

describe('report export formats by tier', () => {
  it('widens with the tier and never opens up on an unknown one', () => {
    expect(reportFormatsForTier(FeatureTier.ALL_FORMATS)).toEqual(['JSON', 'PDF', 'CSV', 'HTML']);
    expect(reportFormatsForTier(FeatureTier.JSON_PDF)).toEqual(['JSON', 'PDF']);
    expect(reportFormatsForTier(FeatureTier.JSON_ONLY)).toEqual(['JSON']);
    expect(reportFormatsForTier(FeatureTier.ADVANCED)).toEqual(['JSON']);
    expect(reportFormatsForTier(true)).toEqual(['JSON']);
  });

  it('entitles nothing when the plan has no export feature at all', () => {
    expect(reportFormatsForTier(false)).toEqual([]);
    expect(reportFormatsForTier(undefined)).toEqual([]);
    expect(isReportFormatEntitled('JSON', false)).toBe(false);
  });

  it('agrees with the export formats each plan advertises', () => {
    for (const plan of Object.values(PLAN_DEFINITIONS)) {
      expect(reportFormatsForTier(exportTierFor(plan.type))).toEqual(plan.exportFormats);
    }
  });

  it('holds Free to JSON only', () => {
    expect(reportFormatsForTier(exportTierFor('FREE'))).toEqual(['JSON']);
    expect(isReportFormatEntitled('pdf', exportTierFor('FREE'))).toBe(false);
    expect(isReportFormatEntitled('json', exportTierFor('FREE'))).toBe(true);
  });

  it('matches a requested format regardless of casing', () => {
    expect(isReportFormatEntitled('html', FeatureTier.ALL_FORMATS)).toBe(true);
    expect(isReportFormatEntitled('HtMl', FeatureTier.ALL_FORMATS)).toBe(true);
    expect(isReportFormatEntitled('xml', FeatureTier.ALL_FORMATS)).toBe(false);
  });
});

describe('resolveDefaultReportFormat', () => {
  it('uses the configured default when the plan still covers it', () => {
    expect(resolveDefaultReportFormat('HTML', FeatureTier.ALL_FORMATS)).toBe('HTML');
    expect(resolveDefaultReportFormat('pdf', FeatureTier.JSON_PDF)).toBe('PDF');
  });

  it('falls back to the best entitled format after a downgrade strands the value', () => {
    // A Team org that set HTML and dropped to Free keeps a stale column value.
    expect(resolveDefaultReportFormat('HTML', exportTierFor('FREE'))).toBe('JSON');
    expect(resolveDefaultReportFormat('CSV', FeatureTier.JSON_PDF)).toBe('JSON');
  });

  it('falls back to JSON when nothing is configured or entitled', () => {
    expect(resolveDefaultReportFormat(null, FeatureTier.ALL_FORMATS)).toBe('JSON');
    expect(resolveDefaultReportFormat(undefined, false)).toBe('JSON');
    expect(resolveDefaultReportFormat('PDF', false)).toBe('JSON');
  });
});
