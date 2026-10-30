/**
 * Groups `BrowserFinding.category` values into the Risk Report's six
 * behavioral/functional-correctness categories, and decides each category's
 * detection status for a run: MEASURED (a finding exists, or the category's
 * detector(s) ran and found nothing), INSUFFICIENT_EVIDENCE (the capture
 * track was enabled but the detector never got a chance - e.g. the run
 * crashed before any navigation), or NOT_MEASURED (the capture track itself
 * was never enabled for this run).
 *
 * The category -> precursor-event mapping below is read directly off each
 * detector's actual trigger condition in `packages/browser-observer/src/index.ts`
 * (see the method/line references in each comment) rather than guessed, since
 * a wrong mapping here would silently reintroduce the exact zero-vs-unmeasured
 * ambiguity this feature exists to remove.
 */

import type {
  FindingSeverity,
  RiskCategoryBreakdown,
  RiskCategoryId,
  RiskCategorySummary,
} from './contracts/dashboard-overview';

export type CaptureTrack = 'FRONTEND' | 'BACKEND';

const ALL_CATEGORIES: RiskCategoryId[] = [
  'ACCESSIBILITY',
  'FRONTEND_ERRORS',
  'FRONTEND_PERFORMANCE',
  'NETWORK_FAILURES',
  'BACKEND_ERRORS',
  'BACKEND_PERFORMANCE',
];

/**
 * `BrowserFinding.category` -> `RiskCategoryId`. Categories not listed here
 * (`CAPTURE_DEGRADED`, `RESPONSIVE_LAYOUT`, `UI_QUALITY`) are intentionally
 * excluded from the Risk Report breakdown:
 * - `CAPTURE_DEGRADED` is a finding about the capture pipeline itself, not a
 *   QA dimension - folding it in would make "Accessibility: 1 finding"
 *   potentially mean "capture broke," not "we found a bug."
 * - `RESPONSIVE_LAYOUT` / `UI_QUALITY` (raised by `raiseUiQualityFindings`)
 *   only ever fire during an Automated run (`state.mode === 'AUTOMATED'`,
 *   production excluded) - a different, narrower opportunity condition than
 *   the rest of frontend performance, which runs in every mode. Folding them
 *   into FRONTEND_PERFORMANCE would read a non-automated run's untouched
 *   UI-quality checks as "measured, clean" when they never ran at all.
 */
const FINDING_CATEGORY_TO_RISK_CATEGORY: Record<string, RiskCategoryId> = {
  ACCESSIBILITY_VIOLATION: 'ACCESSIBILITY',
  BROWSER_CONSOLE_ERROR: 'FRONTEND_ERRORS',
  FRONTEND_PAGE_CRASH: 'FRONTEND_ERRORS',
  FRONTEND_FORM_VALIDATION_FAILED: 'FRONTEND_ERRORS',
  FRONTEND_POOR_WEB_VITAL: 'FRONTEND_PERFORMANCE',
  FRONTEND_ROUTE_NEVER_SETTLED: 'FRONTEND_PERFORMANCE',
  NETWORK_REQUEST_FAILED: 'NETWORK_FAILURES',
  HTTP_ERROR_RESPONSE: 'NETWORK_FAILURES',
  FRONTEND_FAILED_RESOURCES: 'NETWORK_FAILURES',
  BACKEND_UNHANDLED_ERROR: 'BACKEND_ERRORS',
  BACKEND_SERVER_ERROR: 'BACKEND_ERRORS',
  BACKEND_CLIENT_ERROR: 'BACKEND_ERRORS',
  BACKEND_SLOW_RESPONSE: 'BACKEND_PERFORMANCE',
};

/** Which capture track gates a category's `NOT_MEASURED` state. */
const RISK_CATEGORY_TRACK: Record<RiskCategoryId, CaptureTrack> = {
  ACCESSIBILITY: 'FRONTEND',
  FRONTEND_ERRORS: 'FRONTEND',
  FRONTEND_PERFORMANCE: 'FRONTEND',
  NETWORK_FAILURES: 'FRONTEND',
  BACKEND_ERRORS: 'BACKEND',
  BACKEND_PERFORMANCE: 'BACKEND',
};

/**
 * Evidence-event types whose presence proves a category's detector(s) had a
 * chance to fire this run, used only to resolve a zero-finding category
 * between MEASURED (clean) and INSUFFICIENT_EVIDENCE (never got the chance).
 * A category lists more than one event type when its constituent findings
 * are gated on different signals (e.g. NETWORK_FAILURES spans both the
 * request-finish handler and the performance-sample resource check) - any one
 * firing is enough, since it proves that sub-detector was live.
 */
const RISK_CATEGORY_PRECURSOR_EVENTS: Record<RiskCategoryId, string[]> = {
  // runAccessibilityScan (browser-observer/src/index.ts ~3097) emits this on every scan.
  ACCESSIBILITY: ['QA_ACCESSIBILITY_SCAN'],
  // Console-error and crash listeners are attached for the whole session once
  // any page has loaded; form-validation failures require a submit.
  FRONTEND_ERRORS: ['QA_ROUTE_CHANGED', 'QA_FORM_SUBMITTED'],
  // reportFrontendPerformance (~1486) fires only for a 'performance' bridge event.
  FRONTEND_PERFORMANCE: ['QA_PAGE_PERFORMANCE'],
  // NETWORK_REQUEST_FAILED/HTTP_ERROR_RESPONSE come off the request-finish
  // handler (QA_REQUEST); FRONTEND_FAILED_RESOURCES off the same performance
  // sample as web vitals (QA_PAGE_PERFORMANCE).
  NETWORK_FAILURES: ['QA_REQUEST', 'QA_PAGE_PERFORMANCE'],
  // BACKEND_SERVER_ERROR/BACKEND_CLIENT_ERROR come off QA_BACKEND_REQUEST;
  // BACKEND_UNHANDLED_ERROR off the separate QA_BACKEND_ERROR (recordBackendErrorEvent, ~2606).
  BACKEND_ERRORS: ['QA_BACKEND_REQUEST', 'QA_BACKEND_ERROR'],
  // reportBackendLatency (~2712) is called from inside recordBackendRequestEvent,
  // gated on the same QA_BACKEND_REQUEST emit.
  BACKEND_PERFORMANCE: ['QA_BACKEND_REQUEST'],
};

const EMPTY_BY_SEVERITY = (): Record<FindingSeverity, number> => ({
  CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0,
});

const TRACK_REASON: Record<CaptureTrack, string> = {
  FRONTEND: 'Frontend capture track was not enabled for this run.',
  BACKEND: 'Backend capture track was not enabled for this run.',
};

/**
 * Builds the Risk Report's per-category detection-status breakdown for one
 * run. Pure and dependency-free so it can be unit-tested in isolation and
 * called identically from the cloud report worker and the desktop renderer.
 */
export function deriveRiskCategoryBreakdown(
  findings: Array<{ category: string; severity: FindingSeverity }>,
  captureTracks: CaptureTrack[],
  eventCounts: Record<string, number>,
): RiskCategoryBreakdown {
  const byCategory = new Map<RiskCategoryId, { count: number; bySeverity: Record<FindingSeverity, number> }>();
  for (const id of ALL_CATEGORIES) byCategory.set(id, { count: 0, bySeverity: EMPTY_BY_SEVERITY() });

  for (const finding of findings) {
    const riskCategory = FINDING_CATEGORY_TO_RISK_CATEGORY[finding.category];
    if (!riskCategory) continue;
    const bucket = byCategory.get(riskCategory)!;
    bucket.count += 1;
    bucket.bySeverity[finding.severity] += 1;
  }

  const trackEnabled = new Set(captureTracks);
  const breakdown = {} as RiskCategoryBreakdown;

  for (const id of ALL_CATEGORIES) {
    const { count, bySeverity } = byCategory.get(id)!;
    const track = RISK_CATEGORY_TRACK[id];
    let summary: RiskCategorySummary;

    if (!trackEnabled.has(track)) {
      summary = { status: 'NOT_MEASURED', reason: TRACK_REASON[track], count: 0, bySeverity: EMPTY_BY_SEVERITY() };
    } else if (count > 0) {
      // A finding is direct proof of measurement, independent of the
      // precursor heuristic below.
      summary = { status: 'MEASURED', reason: null, count, bySeverity };
    } else {
      const hadOpportunity = RISK_CATEGORY_PRECURSOR_EVENTS[id].some((eventType) => (eventCounts[eventType] ?? 0) > 0);
      summary = hadOpportunity
        ? { status: 'MEASURED', reason: null, count: 0, bySeverity }
        : {
          status: 'INSUFFICIENT_EVIDENCE',
          reason: 'The capture track was enabled, but this run never reached a point where this category could be checked.',
          count: 0,
          bySeverity,
        };
    }
    breakdown[id] = summary;
  }

  return breakdown;
}
