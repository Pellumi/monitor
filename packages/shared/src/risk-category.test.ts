import { describe, expect, it } from 'vitest';
import { deriveRiskCategoryBreakdown } from './risk-category';

describe('deriveRiskCategoryBreakdown', () => {
  it('reports NOT_MEASURED for every category whose track was never enabled', () => {
    const breakdown = deriveRiskCategoryBreakdown([], [], {});
    expect(breakdown.ACCESSIBILITY.status).toBe('NOT_MEASURED');
    expect(breakdown.ACCESSIBILITY.reason).toMatch(/Frontend capture track/);
    expect(breakdown.BACKEND_ERRORS.status).toBe('NOT_MEASURED');
    expect(breakdown.BACKEND_ERRORS.reason).toMatch(/Backend capture track/);
  });

  it('reports INSUFFICIENT_EVIDENCE when the track is enabled but the category never got a chance to run', () => {
    // FRONTEND enabled, but no QA_ACCESSIBILITY_SCAN event: the run never
    // reached a point where the axe-core scan fired.
    const breakdown = deriveRiskCategoryBreakdown([], ['FRONTEND'], { QA_ROUTE_CHANGED: 3 });
    expect(breakdown.ACCESSIBILITY.status).toBe('INSUFFICIENT_EVIDENCE');
    expect(breakdown.ACCESSIBILITY.count).toBe(0);
    // FRONTEND_ERRORS' precursor (QA_ROUTE_CHANGED) is present, so it should
    // read MEASURED even with zero findings.
    expect(breakdown.FRONTEND_ERRORS.status).toBe('MEASURED');
  });

  it('reports MEASURED with a zero count for a category that ran clean', () => {
    const breakdown = deriveRiskCategoryBreakdown(
      [],
      ['FRONTEND', 'BACKEND'],
      { QA_ACCESSIBILITY_SCAN: 2, QA_ROUTE_CHANGED: 5, QA_PAGE_PERFORMANCE: 5, QA_REQUEST: 10, QA_BACKEND_REQUEST: 4 },
    );
    for (const id of ['ACCESSIBILITY', 'FRONTEND_ERRORS', 'FRONTEND_PERFORMANCE', 'NETWORK_FAILURES', 'BACKEND_ERRORS', 'BACKEND_PERFORMANCE'] as const) {
      expect(breakdown[id].status).toBe('MEASURED');
      expect(breakdown[id].count).toBe(0);
      expect(breakdown[id].reason).toBeNull();
    }
  });

  it('is MEASURED whenever a finding exists, independent of the precursor heuristic', () => {
    // No precursor events recorded at all, but a finding exists - direct
    // proof of measurement must win over the heuristic.
    const breakdown = deriveRiskCategoryBreakdown(
      [{ category: 'ACCESSIBILITY_VIOLATION', severity: 'HIGH' }],
      ['FRONTEND'],
      {},
    );
    expect(breakdown.ACCESSIBILITY.status).toBe('MEASURED');
    expect(breakdown.ACCESSIBILITY.count).toBe(1);
    expect(breakdown.ACCESSIBILITY.bySeverity.HIGH).toBe(1);
  });

  it('groups findings into the right category and tallies severity', () => {
    const breakdown = deriveRiskCategoryBreakdown(
      [
        { category: 'BROWSER_CONSOLE_ERROR', severity: 'MEDIUM' },
        { category: 'FRONTEND_PAGE_CRASH', severity: 'CRITICAL' },
        { category: 'BACKEND_SERVER_ERROR', severity: 'HIGH' },
      ],
      ['FRONTEND', 'BACKEND'],
      {},
    );
    expect(breakdown.FRONTEND_ERRORS.count).toBe(2);
    expect(breakdown.FRONTEND_ERRORS.bySeverity.MEDIUM).toBe(1);
    expect(breakdown.FRONTEND_ERRORS.bySeverity.CRITICAL).toBe(1);
    expect(breakdown.BACKEND_ERRORS.count).toBe(1);
    expect(breakdown.BACKEND_ERRORS.bySeverity.HIGH).toBe(1);
  });

  it('ignores finding categories outside the Risk Report breakdown (CAPTURE_DEGRADED, RESPONSIVE_LAYOUT, UI_QUALITY)', () => {
    const breakdown = deriveRiskCategoryBreakdown(
      [
        { category: 'CAPTURE_DEGRADED', severity: 'LOW' },
        { category: 'RESPONSIVE_LAYOUT', severity: 'LOW' },
        { category: 'UI_QUALITY', severity: 'LOW' },
      ],
      ['FRONTEND', 'BACKEND'],
      {},
    );
    const total = Object.values(breakdown).reduce((sum, summary) => sum + summary.count, 0);
    expect(total).toBe(0);
  });

  it('treats NETWORK_FAILURES as having had a chance via either of its two precursor signals', () => {
    const viaRequest = deriveRiskCategoryBreakdown([], ['FRONTEND'], { QA_REQUEST: 1 });
    expect(viaRequest.NETWORK_FAILURES.status).toBe('MEASURED');

    const viaPerformance = deriveRiskCategoryBreakdown([], ['FRONTEND'], { QA_PAGE_PERFORMANCE: 1 });
    expect(viaPerformance.NETWORK_FAILURES.status).toBe('MEASURED');

    const viaNeither = deriveRiskCategoryBreakdown([], ['FRONTEND'], { QA_ROUTE_CHANGED: 1 });
    expect(viaNeither.NETWORK_FAILURES.status).toBe('INSUFFICIENT_EVIDENCE');
  });
});
