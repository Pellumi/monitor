/**
 * The frontend section of a QA report.
 *
 * The browser track collected Core Web Vitals, settle timings, network
 * behaviour, interactions and accessibility scans for every route a run
 * touched, and none of it reached the report — it showed up as a count per
 * event type and a row in a truncated appendix. This is the counterpart to
 * `qa-backend-report.ts`: same contract, same discipline.
 *
 * Re-derived from the evidence events in the database rather than the
 * desktop's live state, because that state is trimmed as a run grows and a
 * report has to be reproducible from what was actually persisted.
 *
 * Nothing here reads a captured value. Field values, storage values and
 * payload bodies reach the database already classified and encrypted, and a
 * summary that decrypted them to count them would defeat the point.
 */

import {
  asNumber,
  asRecord,
  asText,
  isoOf,
  percentileOf,
  pushUnique,
  rounded,
  statusClass,
} from './qa-backend-report';

/** The evidence-event shape this summary needs. */
export type FrontendEvidenceEvent = {
  id?: string;
  eventId?: string;
  eventType: string;
  occurredAt: Date | string;
  scope?: string | null;
  normalizedRoute?: string | null;
  interactionGroupId?: string | null;
  metadata: unknown;
};

export type Percentiles = {
  p50: number | null;
  p75: number | null;
  p95: number | null;
  samples: number;
};

export type FrontendRoutePerformance = {
  route: string;
  /** Vitals samples that survived the hidden-tab gate. */
  samples: number;
  hiddenSamplesDropped: number;
  lcpMs: Percentiles;
  fcpMs: Percentiles;
  cls: Percentiles;
  inpMs: Percentiles;
  ttfbMs: Percentiles;
  blockingMs: Percentiles;
  /** Route settles only — an interaction settle measures something else. */
  dataReadyMs: Percentiles;
  visuallyStableMs: Percentiles;
  settleSamples: number;
  settleTimeouts: number;
  interactionSettleSamples: number;
  interactionDataReadyP95: number | null;
  longestTaskMs: number | null;
  longestTaskAttribution: string | null;
  interactionCount: number;
  resourceCount: number;
  transferredBytes: number;
  failedResources: number;
  worstVital: WorstVital | null;
  firstAt: string | null;
  lastAt: string | null;
};

export type WorstVital = {
  metric: 'LCP' | 'CLS' | 'INP';
  value: number;
  rating: 'poor' | 'needs-improvement';
};

export type FrontendNetworkGroup = {
  key: string;
  /**
   * The path of the resource that was fetched, not the page that fetched it.
   * A network row therefore cannot be joined to a route performance row.
   */
  route: string;
  resourceType: string;
  requests: number;
  failed: number;
  /** Aborted by observation-only policy: expected, never an application defect. */
  blocked: number;
  clientErrors: number;
  serverErrors: number;
  statusClasses: Record<string, number>;
  p50Ms: number | null;
  p95Ms: number | null;
  slowestMs: number | null;
  transferredBytes: number;
  methods: string[];
  firstAt: string | null;
  lastAt: string | null;
};

export type FrontendFormFunnel = {
  form: string;
  submits: number;
  invalidSubmits: number;
  invalidRate: number | null;
  routes: string[];
};

export type FrontendInteractionFunnel = {
  clicks: number;
  clicksPreBoundary: number;
  submitIntents: number;
  submitIntentsPreBoundary: number;
  submitted: number;
  invalidSubmits: number;
  invalidRate: number | null;
  fieldChanges: number;
  forms: FrontendFormFunnel[];
};

export type FrontendAccessibilityRule = {
  ruleId: string;
  help: string;
  impact: string;
  occurrences: number;
  nodes: number;
  routes: string[];
  targets: string[];
};

export type FrontendAccessibilityRollup = {
  scans: number;
  routesScanned: number;
  violations: number;
  /** Counts rule occurrences, never nodes. */
  byImpact: Record<string, number>;
  rules: FrontendAccessibilityRule[];
  cleanRoutes: string[];
};

export type FrontendConsoleGroup = {
  level: string;
  message: string;
  occurrences: number;
  routes: string[];
  lastAt: string | null;
};

export type FrontendReportSection = {
  routes: FrontendRoutePerformance[];
  /** Distinct routes observed, uncapped — the table below may be shorter. */
  routesObserved: number;
  worstVital: { route: string; metric: string; value: number } | null;
  network: FrontendNetworkGroup[];
  networkGroupsSeen: number;
  networkTotals: {
    requests: number;
    failed: number;
    blocked: number;
    errors: number;
    transferredBytes: number;
    p95Ms: number | null;
  };
  console: { errors: number; warnings: number; groups: FrontendConsoleGroup[] };
  runtimeErrors: number;
  crashes: number;
  accessibility: FrontendAccessibilityRollup;
  interactions: FrontendInteractionFunnel;
  storageMutations: number;
  clientStateMutations: number;
  limitations: string[];
};

/** Rows listed per table. Totals above them stay exact regardless. */
const ROUTE_LIMIT = 50;
const NETWORK_GROUP_LIMIT = 150;
const CONSOLE_GROUP_LIMIT = 50;
const A11Y_RULE_LIMIT = 50;
const A11Y_ROUTE_LIMIT = 10;
const A11Y_TARGET_LIMIT = 3;
const FORM_LIMIT = 40;
/** Samples kept per metric per route, so a long run cannot grow without bound. */
const PERCENTILE_SAMPLE_CAP = 5_000;
/**
 * Time a route may spend hidden before its paint timings are discarded.
 *
 * `largest-contentful-paint` stops reporting while a tab is hidden but
 * `performance.now()` keeps running, so a backgrounded route reports an LCP
 * measured against a clock the user never experienced. The recorder reports
 * exactly 0 for a route that was never hidden, so anything past a quarter
 * second means the tab genuinely went away.
 */
const HIDDEN_SAMPLE_MAX_MS = 250;

/** Web Vitals thresholds, as web.dev defines them. */
const VITAL_THRESHOLDS = {
  LCP: { good: 2_500, poor: 4_000 },
  CLS: { good: 0.1, poor: 0.25 },
  INP: { good: 200, poor: 500 },
} as const;

const FRONTEND_EVENT_TYPES = new Set([
  'QA_PAGE_PERFORMANCE',
  'QA_REQUEST',
  'QA_CONSOLE',
  'QA_RUNTIME_ERROR',
  'QA_PAGE_CRASH',
  'QA_ACCESSIBILITY_SCAN',
  'QA_CONTROL_CLICKED',
  'QA_FORM_SUBMIT_INTENT',
  'QA_FORM_SUBMITTED',
  'QA_FIELD_CHANGED',
  'QA_STORAGE_MUTATION',
  'QA_CLIENT_STATE_MUTATION',
  'QA_ROUTE_CHANGED',
]);

export function isFrontendEvidenceEvent(event: { eventType: string }): boolean {
  return FRONTEND_EVENT_TYPES.has(event.eventType);
}

/**
 * Which entry types the browser did not support, in the words a reader uses.
 * A metric the browser could not measure must read as absent, never as zero.
 */
const UNSUPPORTED_METRIC_NAMES: Record<string, string> = {
  'largest-contentful-paint': 'LCP',
  'layout-shift': 'CLS',
  event: 'INP',
  longtask: 'blocking time',
  resource: 'resource counts',
  paint: 'FCP',
};

type Loose = Record<string, unknown>;

/**
 * A metric value, preserving "not measured" as null.
 *
 * `asNumber` cannot be used directly here: `Number(null)` is `0`, so a metric
 * the recorder explicitly reported as null — which is how it reports an entry
 * type the browser does not support — would be published as a real zero
 * reading. "0 ms LCP" and "LCP could not be measured" are opposite claims.
 */
function asMetric(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  return asNumber(value);
}

/** A settle sample carries `trigger`; a vitals sample carries `supported`. */
function isSettleSample(metadata: Loose): boolean {
  return metadata.trigger !== undefined || metadata.dataReadyMs !== undefined;
}

function isVitalsSample(metadata: Loose): boolean {
  return metadata.supported !== undefined;
}

class Samples {
  private readonly values: number[] = [];

  add(value: number | null): void {
    // A metric the browser reported as null was not measured. Coercing it to
    // zero would publish "0 ms LCP" for a browser that cannot measure LCP.
    if (value === null || this.values.length >= PERCENTILE_SAMPLE_CAP) return;
    this.values.push(value);
  }

  get count(): number {
    return this.values.length;
  }

  percentiles(): Percentiles {
    return {
      p50: rounded(percentileOf(this.values, 50)),
      p75: rounded(percentileOf(this.values, 75)),
      p95: rounded(percentileOf(this.values, 95)),
      samples: this.values.length,
    };
  }
}

type RouteAccumulator = {
  route: string;
  samples: number;
  hiddenSamplesDropped: number;
  lcp: Samples;
  fcp: Samples;
  cls: Samples;
  inp: Samples;
  ttfb: Samples;
  blocking: Samples;
  dataReady: Samples;
  visuallyStable: Samples;
  interactionDataReady: Samples;
  settleSamples: number;
  settleTimeouts: number;
  interactionSettleSamples: number;
  longestTaskMs: number | null;
  longestTaskAttribution: string | null;
  interactionCount: number;
  resourceCount: number;
  transferredBytes: number;
  failedResources: number;
  firstAt: string | null;
  lastAt: string | null;
};

function newRoute(route: string, at: string | null): RouteAccumulator {
  return {
    route,
    samples: 0,
    hiddenSamplesDropped: 0,
    lcp: new Samples(), fcp: new Samples(), cls: new Samples(),
    inp: new Samples(), ttfb: new Samples(), blocking: new Samples(),
    dataReady: new Samples(), visuallyStable: new Samples(),
    interactionDataReady: new Samples(),
    settleSamples: 0, settleTimeouts: 0, interactionSettleSamples: 0,
    longestTaskMs: null, longestTaskAttribution: null,
    interactionCount: 0, resourceCount: 0, transferredBytes: 0, failedResources: 0,
    firstAt: at, lastAt: at,
  };
}

/** The worse of a route's vitals, ranked by how far past "good" each one is. */
export function worstVitalOf(input: {
  lcp: number | null;
  cls: number | null;
  inp: number | null;
}): WorstVital | null {
  const candidates: Array<{ metric: WorstVital['metric']; value: number; ratio: number }> = [];
  if (input.lcp !== null) candidates.push({ metric: 'LCP', value: input.lcp, ratio: input.lcp / VITAL_THRESHOLDS.LCP.good });
  if (input.inp !== null) candidates.push({ metric: 'INP', value: input.inp, ratio: input.inp / VITAL_THRESHOLDS.INP.good });
  if (input.cls !== null) candidates.push({ metric: 'CLS', value: input.cls, ratio: input.cls / VITAL_THRESHOLDS.CLS.good });
  const worst = candidates.sort((left, right) => right.ratio - left.ratio)[0];
  if (!worst || worst.ratio <= 1) return null;
  const threshold = VITAL_THRESHOLDS[worst.metric];
  return {
    metric: worst.metric,
    value: worst.value,
    rating: worst.value > threshold.poor ? 'poor' : 'needs-improvement',
  };
}

const IMPACT_RANK: Record<string, number> = { critical: 0, serious: 1, moderate: 2, minor: 3 };

/**
 * Builds the report's frontend section, or null when the run captured no
 * browser evidence at all — a backend-only run should not carry an empty
 * section explaining that its browser did nothing.
 */
export function summarizeFrontendEvidence(
  events: FrontendEvidenceEvent[],
  options: { captureTracks?: string[] | null } = {},
): FrontendReportSection | null {
  const frontendEvents = events.filter(isFrontendEvidenceEvent);
  const tracksFrontend = (options.captureTracks ?? []).includes('FRONTEND');
  if (!frontendEvents.length && !tracksFrontend) return null;

  const routes = new Map<string, RouteAccumulator>();
  const networkGroups = new Map<string, FrontendNetworkGroup>();
  const networkDurations = new Map<string, number[]>();
  const consoleGroups = new Map<string, FrontendConsoleGroup>();
  const a11yRules = new Map<string, FrontendAccessibilityRule>();
  const forms = new Map<string, FrontendFormFunnel>();
  const unsupportedEntryTypes = new Set<string>();
  const scannedRoutes = new Set<string>();
  const cleanRoutes = new Set<string>();
  const allNetworkDurations: number[] = [];

  let routesObserved = 0;
  let networkGroupsSeen = 0;
  let observerUnavailable = false;
  let a11yScans = 0;
  let a11yViolations = 0;
  let a11yAtPerScanCap = false;
  const a11yByImpact: Record<string, number> = {};
  let consoleErrors = 0;
  let consoleWarnings = 0;
  let runtimeErrors = 0;
  let crashes = 0;
  let storageMutations = 0;
  let clientStateMutations = 0;
  let clicks = 0;
  let clicksPreBoundary = 0;
  let submitIntents = 0;
  let submitIntentsPreBoundary = 0;
  let submitted = 0;
  let invalidSubmits = 0;
  let fieldChanges = 0;
  let networkRequests = 0;
  let networkFailed = 0;
  let networkBlocked = 0;
  let networkClientErrors = 0;
  let networkServerErrors = 0;
  let networkBytes = 0;
  let routesTruncated = false;
  let hiddenGatedRoutes = 0;

  const routeFor = (key: string, at: string | null): RouteAccumulator | null => {
    const existing = routes.get(key);
    if (existing) {
      existing.lastAt = at ?? existing.lastAt;
      return existing;
    }
    routesObserved += 1;
    if (routes.size >= ROUTE_LIMIT) {
      routesTruncated = true;
      return null;
    }
    const created = newRoute(key, at);
    routes.set(key, created);
    return created;
  };

  for (const event of frontendEvents) {
    const metadata = asRecord(event.metadata);
    const at = isoOf(event.occurredAt);
    const preBoundary = event.scope === 'PRE_BOUNDARY';

    switch (event.eventType) {
      case 'QA_PAGE_PERFORMANCE': {
        // The recorder emits four disjoint shapes under this one event type.
        // A settle sample carries timings and no vitals; a vitals sample
        // carries vitals and no timings; the unsupported fallback carries
        // neither and has no route at all.
        if (metadata.supported === false) {
          observerUnavailable = true;
          for (const entry of Array.isArray(metadata.unsupportedMetrics) ? metadata.unsupportedMetrics : []) {
            unsupportedEntryTypes.add(String(entry));
          }
          break;
        }
        // Metadata's own route names the route being *left* on an SPA
        // navigation, while the event's normalizedRoute was stamped from the
        // page's current URL — which has already changed. Preferring the event
        // would attribute every route's vitals to its successor.
        const route = asText(metadata.route) ?? event.normalizedRoute ?? '(unknown route)';
        const bucket = routeFor(route, at);
        if (!bucket) break;

        if (isVitalsSample(metadata)) {
          for (const entry of Array.isArray(metadata.unsupportedMetrics) ? metadata.unsupportedMetrics : []) {
            unsupportedEntryTypes.add(String(entry));
          }
          const hiddenMs = asMetric(metadata.hiddenMs);
          const measuredWhileVisible = hiddenMs === null || hiddenMs <= HIDDEN_SAMPLE_MAX_MS;
          if (measuredWhileVisible) {
            bucket.samples += 1;
            bucket.lcp.add(asMetric(metadata.lcp));
            bucket.fcp.add(asMetric(metadata.fcp));
            bucket.cls.add(asMetric(metadata.cls));
            bucket.inp.add(asMetric(metadata.inpMs));
            bucket.ttfb.add(asMetric(metadata.ttfbMs));
            bucket.blocking.add(asMetric(metadata.longTaskMs));
          } else {
            bucket.hiddenSamplesDropped += 1;
          }
          // Counts stay valid while a tab is hidden — a broken image is broken
          // whether or not anyone was looking — so they accumulate regardless.
          bucket.resourceCount += asNumber(metadata.resourceCount) ?? 0;
          bucket.transferredBytes += asNumber(metadata.transferredBytes) ?? 0;
          bucket.failedResources += asNumber(metadata.failedResourceCount) ?? 0;
          bucket.interactionCount += asNumber(metadata.interactionCount) ?? 0;
          const longest = asMetric(metadata.longestTaskMs);
          if (longest !== null && longest > (bucket.longestTaskMs ?? -1)) {
            bucket.longestTaskMs = longest;
            bucket.longestTaskAttribution = asText(metadata.longestTaskAttribution, 200);
          }
        }

        if (isSettleSample(metadata)) {
          const interaction = metadata.trigger === 'interaction';
          if (interaction) {
            bucket.interactionSettleSamples += 1;
            bucket.interactionDataReady.add(asMetric(metadata.dataReadyMs));
          } else {
            bucket.settleSamples += 1;
            bucket.dataReady.add(asMetric(metadata.dataReadyMs));
            bucket.visuallyStable.add(asMetric(metadata.visuallyStableMs));
          }
          // A settle that never completed is a defect whichever triggered it.
          if (metadata.dataReadyTimedOut === true || metadata.visuallyStableTimedOut === true) {
            bucket.settleTimeouts += 1;
          }
        }
        break;
      }

      case 'QA_REQUEST': {
        networkRequests += 1;
        const resourceType = asText(metadata.resourceType, 40) ?? 'other';
        // normalizedRoute here is the path of the resource fetched, not of the
        // page that fetched it.
        const route = event.normalizedRoute ?? asText(metadata.url, 200) ?? '(unknown)';
        const key = `${route}\u0000${resourceType}`;
        const status = asNumber(metadata.statusCode ?? metadata.status);
        const failed = metadata.failed === true;
        const blocked = metadata.blockedByPolicy === true;
        const durationMs = asNumber(metadata.durationMs);
        const bytes = asNumber(metadata.transferredBytes) ?? 0;

        networkBytes += bytes;
        if (blocked) networkBlocked += 1;
        else if (failed) networkFailed += 1;
        else if (status !== null && status >= 500) networkServerErrors += 1;
        else if (status !== null && status >= 400) networkClientErrors += 1;
        if (durationMs !== null) allNetworkDurations.push(durationMs);

        let group = networkGroups.get(key);
        if (!group) {
          networkGroupsSeen += 1;
          if (networkGroups.size < NETWORK_GROUP_LIMIT) {
            group = {
              key, route, resourceType,
              requests: 0, failed: 0, blocked: 0, clientErrors: 0, serverErrors: 0,
              statusClasses: {}, p50Ms: null, p95Ms: null, slowestMs: null,
              transferredBytes: 0, methods: [], firstAt: at, lastAt: at,
            };
            networkGroups.set(key, group);
          }
        }
        if (group) {
          group.requests += 1;
          group.lastAt = at ?? group.lastAt;
          group.transferredBytes += bytes;
          group.statusClasses[statusClass(status)] = (group.statusClasses[statusClass(status)] ?? 0) + 1;
          if (blocked) group.blocked += 1;
          else if (failed) group.failed += 1;
          else if (status !== null && status >= 500) group.serverErrors += 1;
          else if (status !== null && status >= 400) group.clientErrors += 1;
          pushUnique(group.methods, asText(metadata.method, 12), 6);
          if (durationMs !== null) {
            const samples = networkDurations.get(key) ?? [];
            samples.push(durationMs);
            networkDurations.set(key, samples);
            group.slowestMs = Math.max(group.slowestMs ?? 0, durationMs);
          }
        }
        break;
      }

      case 'QA_CONSOLE': {
        const level = (asText(metadata.level, 20) ?? 'log').toLowerCase();
        if (level === 'error') consoleErrors += 1;
        else if (level === 'warning' || level === 'warn') consoleWarnings += 1;
        else break;
        const message = asText(metadata.message, 400) ?? 'Console output';
        const key = `${level}\u0000${message}`;
        const existing = consoleGroups.get(key);
        if (existing) {
          existing.occurrences += 1;
          existing.lastAt = at ?? existing.lastAt;
          pushUnique(existing.routes, event.normalizedRoute ?? null, 10);
        } else if (consoleGroups.size < CONSOLE_GROUP_LIMIT) {
          const group: FrontendConsoleGroup = { level, message, occurrences: 1, routes: [], lastAt: at };
          pushUnique(group.routes, event.normalizedRoute ?? null, 10);
          consoleGroups.set(key, group);
        }
        break;
      }

      case 'QA_RUNTIME_ERROR': runtimeErrors += 1; break;
      case 'QA_PAGE_CRASH': crashes += 1; break;
      case 'QA_STORAGE_MUTATION': storageMutations += 1; break;
      case 'QA_CLIENT_STATE_MUTATION': clientStateMutations += 1; break;
      case 'QA_FIELD_CHANGED': fieldChanges += 1; break;

      case 'QA_CONTROL_CLICKED':
        clicks += 1;
        if (preBoundary) clicksPreBoundary += 1;
        break;

      case 'QA_FORM_SUBMIT_INTENT':
        submitIntents += 1;
        if (preBoundary) submitIntentsPreBoundary += 1;
        break;

      case 'QA_FORM_SUBMITTED': {
        submitted += 1;
        // Strict false: an older recorder that never reported validity leaves
        // this undefined, which is not the same as "the form was rejected".
        const invalid = metadata.valid === false;
        if (invalid) invalidSubmits += 1;
        const label = asText(metadata.formName, 120) ?? asText(metadata.formId, 120) ?? 'unnamed form';
        const form = forms.get(label);
        if (form) {
          form.submits += 1;
          if (invalid) form.invalidSubmits += 1;
          pushUnique(form.routes, event.normalizedRoute ?? null, 6);
        } else if (forms.size < FORM_LIMIT) {
          const created: FrontendFormFunnel = {
            form: label, submits: 1, invalidSubmits: invalid ? 1 : 0, invalidRate: null, routes: [],
          };
          pushUnique(created.routes, event.normalizedRoute ?? null, 6);
          forms.set(label, created);
        }
        break;
      }

      case 'QA_ACCESSIBILITY_SCAN': {
        a11yScans += 1;
        const route = asText(metadata.route) ?? event.normalizedRoute ?? '(unknown route)';
        scannedRoutes.add(route);
        const violations = Array.isArray(metadata.violations) ? metadata.violations : [];
        if (violations.length >= 20) a11yAtPerScanCap = true;
        if (!violations.length) {
          cleanRoutes.add(route);
          break;
        }
        cleanRoutes.delete(route);
        for (const raw of violations) {
          const violation = asRecord(raw);
          const ruleId = asText(violation.id, 100) ?? 'unknown-rule';
          const impact = (asText(violation.impact, 20) ?? 'unknown').toLowerCase();
          const nodes = asNumber(violation.nodes) ?? 0;
          a11yViolations += 1;
          // Rule occurrences, not nodes: one colour-contrast failure across
          // 400 elements is one problem to fix, not 400 critical ones.
          a11yByImpact[impact] = (a11yByImpact[impact] ?? 0) + 1;
          const existing = a11yRules.get(ruleId);
          const rule = existing ?? {
            ruleId,
            help: asText(violation.help, 200) ?? ruleId,
            impact,
            occurrences: 0,
            nodes: 0,
            routes: [],
            targets: [],
          };
          if (!existing) {
            if (a11yRules.size >= A11Y_RULE_LIMIT) continue;
            a11yRules.set(ruleId, rule);
          }
          rule.occurrences += 1;
          rule.nodes += nodes;
          pushUnique(rule.routes, route, A11Y_ROUTE_LIMIT);
          for (const target of Array.isArray(violation.targets) ? violation.targets : []) {
            pushUnique(rule.targets, asText(target, 160), A11Y_TARGET_LIMIT);
          }
        }
        break;
      }

      default:
        break;
    }
  }

  // ── Finalise ────────────────────────────────────────────────────────────
  for (const [key, group] of networkGroups) {
    const samples = networkDurations.get(key) ?? [];
    group.p50Ms = rounded(percentileOf(samples, 50));
    group.p95Ms = rounded(percentileOf(samples, 95));
    group.slowestMs = rounded(group.slowestMs);
  }

  const routeRows: FrontendRoutePerformance[] = [...routes.values()].map((bucket) => {
    const lcpMs = bucket.lcp.percentiles();
    const cls = bucket.cls.percentiles();
    const inpMs = bucket.inp.percentiles();
    if (bucket.samples === 0 && bucket.hiddenSamplesDropped > 0) hiddenGatedRoutes += 1;
    return {
      route: bucket.route,
      samples: bucket.samples,
      hiddenSamplesDropped: bucket.hiddenSamplesDropped,
      lcpMs,
      fcpMs: bucket.fcp.percentiles(),
      cls,
      inpMs,
      ttfbMs: bucket.ttfb.percentiles(),
      blockingMs: bucket.blocking.percentiles(),
      dataReadyMs: bucket.dataReady.percentiles(),
      visuallyStableMs: bucket.visuallyStable.percentiles(),
      settleSamples: bucket.settleSamples,
      settleTimeouts: bucket.settleTimeouts,
      interactionSettleSamples: bucket.interactionSettleSamples,
      interactionDataReadyP95: bucket.interactionDataReady.percentiles().p95,
      longestTaskMs: rounded(bucket.longestTaskMs),
      longestTaskAttribution: bucket.longestTaskAttribution,
      interactionCount: bucket.interactionCount,
      resourceCount: bucket.resourceCount,
      transferredBytes: bucket.transferredBytes,
      failedResources: bucket.failedResources,
      // p75 is the percentile Web Vitals is defined against.
      worstVital: worstVitalOf({ lcp: lcpMs.p75, cls: cls.p75, inp: inpMs.p75 }),
      firstAt: bucket.firstAt,
      lastAt: bucket.lastAt,
    };
  });

  const worstAcrossRoutes = routeRows
    .filter((row) => row.worstVital)
    .sort((left, right) => rank(right.worstVital!) - rank(left.worstVital!))[0];

  for (const form of forms.values()) {
    form.invalidRate = form.submits ? rounded((form.invalidSubmits / form.submits) * 100) : null;
  }

  const limitations: string[] = [];
  if (observerUnavailable) {
    limitations.push(
      'The browser reported no usable PerformanceObserver entry types, so no Core Web Vital '
      + 'was measured for this run. Settle timings and network evidence are unaffected.',
    );
  }
  const unsupportedNames = [...unsupportedEntryTypes]
    .map((entry) => UNSUPPORTED_METRIC_NAMES[entry] ?? entry)
    .filter((name, index, all) => all.indexOf(name) === index);
  if (unsupportedNames.length) {
    limitations.push(
      `The browser did not support ${[...unsupportedEntryTypes].join(', ')}, so `
      + `${unsupportedNames.join(', ')} ${unsupportedNames.length === 1 ? 'was' : 'were'} not measured `
      + 'for this run. Every other metric in this section is unaffected.',
    );
  }
  if (hiddenGatedRoutes > 0) {
    limitations.push(
      `${hiddenGatedRoutes} route${hiddenGatedRoutes === 1 ? '' : 's'} spent long enough in a `
      + 'background tab that their paint timings were discarded rather than reported. Counts and '
      + 'network evidence for those routes are unaffected.',
    );
  }
  if (submitIntentsPreBoundary > 0) {
    limitations.push(
      'Form submissions before the Flow boundary are recorded as intents only — the submit result '
      + 'itself is not retained before the boundary, so the pre-boundary funnel shows intents '
      + 'without outcomes. It is not a drop-off.',
    );
  }
  if (clicksPreBoundary > 0) {
    limitations.push(
      'Interactions before the Flow boundary are recorded as counts only. Their element labels and '
      + "form names are stripped at capture, because a login screen's labels can carry credentials.",
    );
  }
  if (a11yAtPerScanCap) {
    limitations.push(
      'At least one accessibility scan reported 20 violations, which is the per-scan cap the '
      + 'evidence-size limit imposes. A route at the cap may have more.',
    );
  }
  if (routesTruncated) {
    limitations.push(
      `The route table lists ${ROUTE_LIMIT} of ${routesObserved} routes. The totals above it count `
      + 'every route; the rest stay queryable through the evidence endpoints.',
    );
  }
  if (networkGroupsSeen > networkGroups.size) {
    limitations.push(
      `The network table lists ${networkGroups.size} of ${networkGroupsSeen} resource groups. The `
      + 'totals above it count every request.',
    );
  }
  if (!frontendEvents.length && tracksFrontend) {
    limitations.push(
      'This run selected the frontend capture track but no browser evidence reached it. Check that '
      + 'the managed browser opened and that the target URL was reachable.',
    );
  }

  return {
    routes: routeRows.sort((left, right) => rankRoute(right) - rankRoute(left)).slice(0, ROUTE_LIMIT),
    routesObserved,
    worstVital: worstAcrossRoutes?.worstVital
      ? {
          route: worstAcrossRoutes.route,
          metric: worstAcrossRoutes.worstVital.metric,
          value: worstAcrossRoutes.worstVital.value,
        }
      : null,
    network: [...networkGroups.values()].sort((left, right) => right.requests - left.requests),
    networkGroupsSeen,
    networkTotals: {
      requests: networkRequests,
      failed: networkFailed,
      blocked: networkBlocked,
      errors: networkClientErrors + networkServerErrors,
      transferredBytes: networkBytes,
      p95Ms: rounded(percentileOf(allNetworkDurations, 95)),
    },
    console: {
      errors: consoleErrors,
      warnings: consoleWarnings,
      groups: [...consoleGroups.values()].sort((left, right) => right.occurrences - left.occurrences),
    },
    runtimeErrors,
    crashes,
    accessibility: {
      scans: a11yScans,
      routesScanned: scannedRoutes.size,
      violations: a11yViolations,
      byImpact: a11yByImpact,
      rules: [...a11yRules.values()].sort((left, right) => {
        const byImpact = (IMPACT_RANK[left.impact] ?? 9) - (IMPACT_RANK[right.impact] ?? 9);
        return byImpact !== 0 ? byImpact : right.occurrences - left.occurrences;
      }),
      cleanRoutes: [...cleanRoutes],
    },
    interactions: {
      clicks,
      clicksPreBoundary,
      submitIntents,
      submitIntentsPreBoundary,
      submitted,
      invalidSubmits,
      invalidRate: submitted ? rounded((invalidSubmits / submitted) * 100) : null,
      fieldChanges,
      forms: [...forms.values()].sort((left, right) => right.submits - left.submits),
    },
    storageMutations,
    clientStateMutations,
    limitations,
  };
}

/** How badly a vital missed, so the worst across routes can be picked. */
function rank(vital: WorstVital): number {
  const threshold = VITAL_THRESHOLDS[vital.metric];
  return vital.value / threshold.good;
}

/** Route ordering for the table: worst vitals first, then busiest. */
function rankRoute(row: FrontendRoutePerformance): number {
  if (row.worstVital) return 1_000 + rank(row.worstVital);
  return row.settleTimeouts * 10 + row.failedResources;
}
