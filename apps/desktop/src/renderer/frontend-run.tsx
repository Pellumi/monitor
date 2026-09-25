/**
 * The browser rollup on the report page.
 *
 * Report-only: the live frontend run page lives in `pages.tsx` and moving it
 * is a separate refactor. This is the counterpart to `BackendReportCard` —
 * same structure, same weight, one table — so a reader comparing the two
 * halves of a full-stack run is comparing like with like.
 */
import {
  HighlightGrid,
  formatBytes,
  formatMilliseconds,
  largestBy,
  numberOf,
  plural,
  record,
  rows,
  textList,
  type Highlight,
} from "./report-primitives";

const IMPACT_TONE: Record<string, Highlight["tone"]> = {
  critical: "danger",
  serious: "warning",
};

/** A vital reads as a duration, except CLS, which is a unitless score. */
function vitalReading(metric: string, value: number): string {
  if (metric === "CLS") return value.toFixed(2);
  return formatMilliseconds(value);
}

function routeLabel(route: Record<string, unknown>): string {
  return String(route.route ?? "/");
}

/** A percentile triple, or an honest "not measured". */
function percentileLabel(value: unknown, metric = ""): string {
  const row = record(value);
  const p75 = numberOf(row.p75);
  if (p75 === null) return "Not measured";
  return metric === "CLS" ? p75.toFixed(2) : formatMilliseconds(p75);
}

/** True when this report has a browser section worth rendering. */
export function hasFrontendSection(sections: Record<string, unknown>): boolean {
  return Object.keys(record(sections.frontendSummary)).length > 0;
}

/**
 * The few things a reader would otherwise dig out of the tables: which route
 * scored worst, which one never settled, where the requests failed, and what
 * the accessibility scan actually found. A card is left out when the run has
 * nothing to say for it rather than shown empty.
 */
export function frontendReportHighlights(
  summary: Record<string, unknown>,
  routes: Record<string, unknown>[],
  network: Record<string, unknown>[],
): Highlight[] {
  const cards: Highlight[] = [];

  const worst = record(summary.worstVital);
  if (worst.metric) {
    const value = numberOf(worst.value) ?? 0;
    cards.push({
      label: "Worst Core Web Vital",
      value: `${String(worst.metric)} ${vitalReading(String(worst.metric), value)}`,
      detail: String(worst.route ?? "an unknown route"),
      note: "Measured in the page, so it includes the network and the client",
      tone: "warning",
    });
  } else if (routes.length) {
    cards.push({
      label: "Core Web Vitals",
      value: "Within thresholds",
      detail: `All ${plural(routes.length, "route")} measured stayed inside LCP, CLS and INP`,
      tone: "success",
    });
  }

  const slowestSettle = largestBy(routes, (route) => numberOf(record(route.dataReadyMs).p95) ?? 0);
  if (slowestSettle) {
    cards.push({
      label: "Slowest route to settle",
      value: percentileLabel(slowestSettle.dataReadyMs),
      detail: routeLabel(slowestSettle),
      note: "Time before the route stopped fetching its own data",
    });
  }

  const neverSettled = routes.filter((route) => (numberOf(route.settleTimeouts) ?? 0) > 0);
  if (neverSettled.length) {
    cards.push({
      label: "Routes that never settled",
      value: plural(neverSettled.length, "route"),
      detail: neverSettled.slice(0, 3).map(routeLabel).join(", "),
      note: "Still fetching or still moving at the 10-second cap",
      tone: "warning",
    });
  }

  const failing = network.filter((row) => (numberOf(row.failed) ?? 0) > 0);
  const worstResource = largestBy(failing, (row) => numberOf(row.failed) ?? 0);
  cards.push(worstResource
    ? {
        label: "Most-failing resource",
        value: `${numberOf(worstResource.failed) ?? 0} of ${plural(numberOf(worstResource.requests) ?? 0, "request")} failed`,
        detail: `${String(worstResource.resourceType ?? "other")} · ${String(worstResource.route ?? "/")}`,
        note: `${plural(failing.length, "resource group")} had failures`,
        tone: "danger",
      }
    : {
        label: "Network",
        value: network.length ? "No failed requests" : "No requests captured",
        detail: network.length
          ? `All ${plural(network.length, "resource group")} answered`
          : "The browser made no requests this run",
        tone: network.length ? "success" : undefined,
      });

  const heaviest = largestBy(routes, (route) => numberOf(route.transferredBytes) ?? 0);
  if (heaviest) {
    cards.push({
      label: "Heaviest route",
      value: formatBytes(numberOf(heaviest.transferredBytes) ?? 0),
      detail: routeLabel(heaviest),
      note: `${plural(numberOf(heaviest.resourceCount) ?? 0, "resource")} loaded`,
    });
  }

  const brokenResources = largestBy(routes, (route) => numberOf(route.failedResources) ?? 0);
  if (brokenResources && (numberOf(brokenResources.failedResources) ?? 0) > 0) {
    cards.push({
      label: "Resources that arrived empty",
      value: plural(numberOf(brokenResources.failedResources) ?? 0, "resource"),
      detail: routeLabel(brokenResources),
      note: "Transferred no bytes and decoded to nothing — a broken image, font or script",
      tone: "warning",
    });
  }

  const consoleSummary = record(summary.console);
  const consoleErrors = numberOf(consoleSummary.errors) ?? 0;
  cards.push(consoleErrors
    ? {
        label: "Console errors",
        value: plural(consoleErrors, "error"),
        detail: `${plural(rows(consoleSummary.groups).length, "distinct message")} · ${plural(
          numberOf(summary.runtimeErrors) ?? 0,
          "uncaught runtime error",
        )}`,
        tone: "danger",
      }
    : {
        label: "Console",
        value: "Clean",
        detail: "Nothing was logged at error level during this run",
        tone: "success",
      });

  const accessibility = record(summary.accessibility);
  const violations = numberOf(accessibility.violations) ?? 0;
  if (numberOf(accessibility.scans)) {
    const byImpact = record(accessibility.byImpact);
    const worstImpact = ["critical", "serious", "moderate", "minor"]
      .find((impact) => numberOf(byImpact[impact]));
    cards.push({
      label: "Accessibility",
      value: violations ? plural(violations, "violation") : "No violations",
      detail: `${plural(numberOf(accessibility.routesScanned) ?? 0, "route")} scanned`,
      note: violations
        ? Object.entries(byImpact).map(([impact, count]) => `${Number(count)} ${impact}`).join(" · ")
        : "Every scanned route passed WCAG A and AA",
      tone: violations ? IMPACT_TONE[worstImpact ?? ""] ?? "warning" : "success",
    });
  }

  const interactions = record(summary.interactions);
  const invalid = numberOf(interactions.invalidSubmits) ?? 0;
  if (invalid) {
    cards.push({
      label: "Forms rejected",
      value: `${invalid} of ${plural(numberOf(interactions.submitted) ?? 0, "submission")}`,
      detail: textList(rows(interactions.forms).map((form) => String(form.form)), "unnamed form"),
      note: "Failed the browser's own constraint validation",
      tone: "warning",
    });
  }

  return cards;
}

export function FrontendReportCard({
  sections,
  runHref,
}: {
  sections: Record<string, unknown>;
  runHref?: string;
}) {
  const summary = record(sections.frontendSummary);
  // Self-suppressing, the same way the backend card is: a backend-only run
  // gets no empty chapter explaining that its browser did nothing.
  if (!Object.keys(summary).length) return null;

  const routes = rows(summary.routes);
  const network = rows(summary.network);
  const accessibility = record(summary.accessibility);
  const a11yRules = rows(accessibility.rules);
  const networkTotals = record(summary.networkTotals);
  const consoleSummary = record(summary.console);
  const limitations = Array.isArray(summary.limitations)
    ? summary.limitations.map((item) => String(item))
    : [];
  const routesObserved = numberOf(summary.routesObserved) ?? routes.length;

  return (
    <section className="content-card report-section">
      <div className="card-heading">
        <small>Browser</small>
        <h2>What the browser saw</h2>
        <span className="pill">{plural(routesObserved, "route")}</span>
      </div>
      <p>
        Timings here were measured inside the page, so they include the network and the client. A
        route&rsquo;s numbers are its own: an in-app navigation resets them rather than accumulating
        across the session.
        {runHref ? <> Open the run to replay the evidence behind them.</> : null}
      </p>

      <dl className="detail-list report-detail-grid">
        <div>
          <dt>Console errors</dt>
          <dd>{numberOf(consoleSummary.errors) ?? 0}</dd>
        </div>
        <div>
          <dt>Failed requests</dt>
          <dd>{(numberOf(networkTotals.failed) ?? 0) + (numberOf(networkTotals.errors) ?? 0)}</dd>
        </div>
        <div>
          <dt>Transferred</dt>
          <dd>{formatBytes(numberOf(networkTotals.transferredBytes) ?? 0)}</dd>
        </div>
        <div>
          <dt>Accessibility violations</dt>
          <dd>{numberOf(accessibility.violations) ?? 0}</dd>
        </div>
      </dl>

      <HighlightGrid highlights={frontendReportHighlights(summary, routes, network)} />

      {a11yRules.length ? (
        <section className="run-models">
          <h3>Accessibility rules</h3>
          <p>
            Counted once per rule per scan rather than once per failing element: one contrast
            failure across four hundred elements is one thing to fix.
          </p>
          <table>
            <thead>
              <tr>
                <th>Impact</th>
                <th>Rule</th>
                <th>Occurrences</th>
                <th>Routes</th>
              </tr>
            </thead>
            <tbody>
              {a11yRules.map((rule) => (
                <tr key={String(rule.ruleId)}>
                  <td>{String(rule.impact ?? "unknown")}</td>
                  <td>
                    <strong>{String(rule.help ?? rule.ruleId ?? "")}</strong>
                    <small>{String(rule.ruleId ?? "")}</small>
                  </td>
                  <td>{numberOf(rule.occurrences) ?? 1}</td>
                  <td>{textList(rule.routes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      {limitations.length ? (
        <div className="report-limitations">
          <h3>What this section could not see</h3>
          <ul>
            {limitations.map((limitation) => (
              <li key={limitation}>{limitation}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
