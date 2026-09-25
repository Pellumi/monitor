import { describe, expect, it } from 'vitest';
import {
  FeatureTier,
  REPORT_EXPORT_FORMATS,
  isReportFormatEntitled,
  reportFormatsForTier,
} from './entitlements';

describe('reportFormatsForTier', () => {
  it('maps each REPORT_EXPORT tier to its documented format set', () => {
    expect(reportFormatsForTier(FeatureTier.ALL_FORMATS)).toEqual(['JSON', 'PDF', 'CSV', 'HTML']);
    expect(reportFormatsForTier(FeatureTier.JSON_PDF)).toEqual(['JSON', 'PDF']);
    expect(reportFormatsForTier(FeatureTier.JSON_ONLY)).toEqual(['JSON']);
  });

  it('treats an enabled but untiered entitlement as JSON only', () => {
    expect(reportFormatsForTier(true)).toEqual(['JSON']);
  });

  it('offers no formats when the feature is not entitled', () => {
    // Regression: a `['json']` fallback here renders an export button the
    // report engine answers with 403 FEATURE_NOT_ENTITLED.
    expect(reportFormatsForTier(false)).toEqual([]);
    expect(reportFormatsForTier(undefined)).toEqual([]);
    expect(reportFormatsForTier(null)).toEqual([]);
    expect(reportFormatsForTier('')).toEqual([]);
  });

  it('only ever returns known formats', () => {
    for (const tier of [FeatureTier.ALL_FORMATS, FeatureTier.JSON_PDF, FeatureTier.JSON_ONLY, true]) {
      for (const format of reportFormatsForTier(tier)) {
        expect(REPORT_EXPORT_FORMATS).toContain(format);
      }
    }
  });
});

describe('isReportFormatEntitled', () => {
  it('agrees with reportFormatsForTier for every tier and format pair', () => {
    const tiers = [FeatureTier.ALL_FORMATS, FeatureTier.JSON_PDF, FeatureTier.JSON_ONLY, true, false, undefined];
    for (const tier of tiers) {
      const allowed = reportFormatsForTier(tier);
      for (const format of REPORT_EXPORT_FORMATS) {
        expect(isReportFormatEntitled(format, tier)).toBe(allowed.includes(format));
      }
    }
  });

  it('normalises format casing', () => {
    expect(isReportFormatEntitled('PDF', FeatureTier.ALL_FORMATS)).toBe(true);
    expect(isReportFormatEntitled('Csv', FeatureTier.JSON_PDF)).toBe(false);
  });

  it('rejects unknown formats', () => {
    expect(isReportFormatEntitled('xlsx', FeatureTier.ALL_FORMATS)).toBe(false);
  });
});
