import { escapeHtml, renderHtmlToPdf } from "./validation-report";

/**
 * The comprehensive quality report a user downloads.
 *
 * The report page in the app shows the summary and the finding titles only.
 * Everything the run produced — every finding with its evidence, the declared
 * coverage gaps, the risks outside the Flow, annotations, and the capture
 * appendix — is written here, in the same page design the codebase risk
 * report uses, so a downloaded report is recognisable as ours whichever part
 * of the product produced it.
 *
 * The payload is the immutable report the cloud generated. It is read
 * defensively: an older schema version must still produce a readable document
 * rather than throw while the user waits on a save dialog.
 */
export type QualityReportDocumentInput = {
  /** The QAReport payload, exactly as the cloud stored it. */
  report: Record<string, unknown>;
  /** When this download was produced, which is not when the report was generated. */
  generatedAt: string;
  /**
   * Artifact screenshots — annotation or automated-finding — pre-fetched and
   * base64-encoded as `data:` URIs, keyed by artifact id. Presigned download
   * URLs expire in minutes and cannot be written into a saved file, so the
   * caller resolves and embeds the bytes before handing the document off to
   * be rendered.
   */
  screenshots?: Record<string, string>;
};

export type QualityReportFormat = "JSON" | "PDF" | "CSV" | "HTML";

// Was 250: a page of near-identical rows adds bulk without insight. The full
// sequence stays queryable in-app regardless of how many rows print here —
// the counts table above the row list already carries the exact totals.
const EVENT_LIMIT = 50;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function records(value: unknown): Record<string, unknown>[] {
  return asArray(value).map(asRecord);
}

function text(value: unknown, fallback = "Not recorded"): string {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

function dateText(value: unknown, fallback = "Not recorded"): string {
  if (!value) return fallback;
  const date = new Date(String(value));
  return Number.isNaN(date.valueOf()) ? String(value) : date.toLocaleString();
}

function joined(value: unknown, fallback = "Not declared"): string {
  const items = asArray(value).map((item) => String(item)).filter(Boolean);
  return items.length ? items.join(", ") : fallback;
}

function confidencePercent(value: unknown): string {
  const confidence = Number(value);
  return Number.isFinite(confidence) ? `${Math.round(confidence * 100)}%` : "Not scored";
}

function eventLabel(type: string): string {
  return type.replace(/^QA_/, "").replaceAll("_", " ").toLowerCase();
}

function list(items: string[]): string {
  return `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function factRows(rows: Array<[string, string]>): string {
  return rows
    .map(([label, value]) => `<tr><td>${escapeHtml(label)}</td><td>${escapeHtml(value)}</td></tr>`)
    .join("");
}

/** The parts of the payload every renderer reads, resolved once. */
function readReport(report: Record<string, unknown>) {
  const sections = asRecord(report.sections);
  const inFlow = asRecord(sections.inFlowFindings);
  const appendix = asRecord(sections.evidenceAppendix);
  const flow = asRecord(report.flow);
  const flowSummary = asRecord(sections.flowSummary);
  const runSummary = asRecord(sections.runSummary);
  const backend = asRecord(sections.backendSummary);
  const frontend = asRecord(sections.frontendSummary);
  const automated = asRecord(sections.automated);
  const viewportHistory = records(runSummary.viewportHistory);
  return {
    // Payloads before session-scoped QA existed were all Flow reports and did
    // not carry scopeKind. Preserve that legacy interpretation; new flowless
    // reports identify themselves explicitly as SESSION.
    hasFlow: report.scopeKind !== "SESSION",
    // The run's own name, which the report is filed under.
    runTitle: text(report.title, ""),
    // QRS-RUN-003: the mode changes what an absence of evidence means, so the document states it.
    mode: typeof report.mode === "string" ? report.mode : null,
    // Only an Automated run carries this section.
    automated,
    hasAutomated: Object.keys(automated).length > 0,
    application: asRecord(report.application),
    environment: asRecord(report.environment),
    summary: asRecord(report.summary),
    coverage: asRecord(report.coverage),
    coverageCaveats: asArray(asRecord(report.coverage).caveats).map((item) => String(item)),
    repository: asRecord(report.repository),
    instrumentation: asRecord(report.instrumentation),
    correlation: asRecord(report.correlation),
    flow,
    flowSummary,
    runSummary,
    // A frontend-only run carries no backend section at all, which is how the
    // renderer knows to leave the chapter out rather than print zeroes.
    backend,
    hasBackend: Object.keys(backend).length > 0,
    // A run that never opened a browser has no viewport, no framework-state
    // evidence and nothing "window resolution" could ever mean — those rows
    // are left out of the document rather than printed as "Not recorded".
    backendOnly: (() => {
      const tracks = asArray(runSummary.captureTracks).map((item) => String(item));
      return tracks.includes("BACKEND") && !tracks.includes("FRONTEND");
    })(),
    backendEndpoints: records(backend.endpoints),
    backendModels: records(backend.models),
    backendErrorGroups: records(backend.serverErrorGroups),
    backendSlowestRequests: records(backend.slowestRequests),
    backendLimitations: asArray(backend.limitations).map((item) => String(item)),
    // A backend-only run carries no frontend section, the same way a
    // frontend-only run carries no backend one.
    frontend,
    hasFrontend: Object.keys(frontend).length > 0,
    frontendRoutes: records(frontend.routes),
    frontendNetwork: records(frontend.network),
    frontendConsoleGroups: records(asRecord(frontend.console).groups),
    frontendA11yRules: records(asRecord(frontend.accessibility).rules),
    frontendForms: records(asRecord(frontend.interactions).forms),
    frontendLimitations: asArray(frontend.limitations).map((item) => String(item)),
    viewportHistory,
    latestViewport: asRecord(viewportHistory.at(-1)),
    eventCounts: asRecord(runSummary.eventCounts),
    recommendations: records(inFlow.recommendedNextActions),
    // Deterministic findings arrive sorted by priority, but AI-sourced
    // suggestions are appended after that sorted block, unsorted relative to
    // it — so the list as stored is not reliably priority-ordered end to end.
    // Sorting once here keeps the Findings Index, the per-finding chapter and
    // the "Immediate attention" cover callout consistent with each other and
    // with the "Ordered by priority" claim already printed in this document.
    findings: records(inFlow.findings).sort(
      (left, right) =>
        (SEVERITY_RANK[text(left.priority, "MEDIUM").toUpperCase()] ?? 99) -
        (SEVERITY_RANK[text(right.priority, "MEDIUM").toUpperCase()] ?? 99),
    ),
    // QRS-RUN-003 companion: the run's own stop reason, translated into a
    // verification verdict on the cover page rather than printed as a raw enum.
    completionReason: typeof runSummary.boundaryOutcome === "string" ? runSummary.boundaryOutcome : null,
    completedStatus: text(report.status, ""),
    missingStates: records(inFlow.missingStates),
    missingTransitions: records(inFlow.missingTransitions),
    unexpectedStates: asArray(inFlow.unexpectedStates).map((item) => String(item)),
    trend: asRecord(sections.trend),
    hasTrend: Boolean(asRecord(sections.trend).available),
    trendBasis: asRecord(asRecord(sections.trend).basis),
    trendNew: records(asRecord(sections.trend).new),
    trendResolved: records(asRecord(sections.trend).resolved),
    trendStillPresent: records(asRecord(sections.trend).stillPresent),
    criticalFindings: records(sections.criticalSystemWideFindings),
    annotations: records(sections.userAnnotations),
    events: records(appendix.events),
    eventTotal: Number(appendix.eventTotal ?? 0),
    eventsTruncated: Number(appendix.eventsTruncated ?? 0),
    acceptedFlowEvents: records(appendix.acceptedFlowEvents),
    quarantinedFlowEvents: records(appendix.quarantinedFlowEvents),
    limitations: asArray(appendix.limitations).map((item) => String(item)),
  };
}

type ReadReport = ReturnType<typeof readReport>;

function flowTitle(data: ReadReport): string {
  return data.hasFlow ? text(data.flowSummary.name ?? data.flow.name, "Selected Flow") : "Observational QA";
}

function windowResolution(data: ReadReport): string {
  const { latestViewport, viewportHistory } = data;
  if (!latestViewport.innerWidth || !latestViewport.innerHeight) return "Not recorded";
  const resizes = viewportHistory.length - 1;
  return `${text(latestViewport.innerWidth)} × ${text(latestViewport.innerHeight)} CSS px · ${text(
    latestViewport.devicePixelRatio ?? 1,
  )}× DPR${resizes > 0 ? ` · ${resizes} resize ${resizes === 1 ? "change" : "changes"}` : ""}`;
}

/** A server-side duration, in the unit that reads at its magnitude. */
function millisecondText(value: unknown, fallback = "Not recorded"): string {
  const ms = Number(value);
  if (!Number.isFinite(ms)) return fallback;
  if (ms < 1) return "<1 ms";
  return ms < 1_000 ? `${Math.round(ms)} ms` : `${(ms / 1_000).toFixed(2)} s`;
}

function byteText(value: unknown): string {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  if (bytes < 1_024) return `${bytes} B`;
  if (bytes < 1_024 * 1_024) return `${(bytes / 1_024).toFixed(1)} KB`;
  return `${(bytes / (1_024 * 1_024)).toFixed(1)} MB`;
}

/** Status classes as `2xx 14 · 5xx 1`, in ascending class order. */
function statusClassText(value: unknown): string {
  const classes = asRecord(value);
  const entries = Object.entries(classes).sort(([left], [right]) => left.localeCompare(right));
  return entries.length
    ? entries.map(([name, count]) => `${name} ${Number(count)}`).join(" · ")
    : "—";
}

function durationText(value: unknown): string {
  const ms = Number(value);
  return Number.isFinite(ms) && ms > 0 ? `${(ms / 1000).toFixed(1)} seconds` : "Not recorded";
}

function coverageText(data: ReadReport): string {
  const expected = data.coverage.expected;
  return expected === null || expected === undefined
    ? "Observational — no declared Flow to measure against"
    : `${Number(expected).toFixed(1)}% of the declared Flow was exercised`;
}

/**
 * How much the coverage figure is worth.
 *
 * A clean ratio reads as a fact, and 85% from a degraded capture is not the
 * same claim as 85% from a clean one. The document said so in a notice; the
 * figure itself carried none of it.
 */
function confidenceText(data: ReadReport): string {
  const band = text(data.coverage.confidenceBand, "");
  const score = Number(data.coverage.confidence);
  const percent = Number.isFinite(score) ? ` (${Math.round(score * 100)}%)` : "";
  const qualifier = data.coverageCaveats.length
    ? ` · ${data.coverageCaveats.length} qualifying condition${data.coverageCaveats.length === 1 ? "" : "s"}`
    : " · nothing qualifies it";
  return `${band}${percent}${qualifier}`;
}

/** The AI-drafted resolution for a finding, when the report carries one. */
function renderResolution(item: Record<string, unknown>): string {
  const resolution = asRecord(item.resolution);
  const summary = text(resolution.summary, "");
  if (!summary) return "";
  const steps = asArray(resolution.steps).map((step) => String(step)).filter(Boolean);
  const refs = records(resolution.codeRefs);
  const cause = text(resolution.likelyCause, "");
  return `<h3>Suggested resolution</h3><p>${escapeHtml(summary)}</p>
    ${cause ? `<p><strong>Most likely cause.</strong> ${escapeHtml(cause)}</p>` : ""}
    ${steps.length ? `<p><strong>What to check</strong></p><ol>${steps.map((step) => `<li>${escapeHtml(step)}</li>`).join("")}</ol>` : ""}
    ${refs.length ? `<p><strong>Where to look</strong></p><table class="manifest">${refs
      .map((ref) => {
        const start = Number(ref.startLine);
        const end = Number(ref.endLine);
        const range = Number.isFinite(start) && start > 0 ? (Number.isFinite(end) && end > start ? `:${start}–${end}` : `:${start}`) : "";
        return `<tr><td>${escapeHtml(text(ref.role, "CODE").toUpperCase())}</td><td><strong>${escapeHtml(`${text(ref.path, "")}${range}`)}</strong> ${escapeHtml(text(ref.name, ""))}</td></tr>`;
      })
      .join("")}</table>` : ""}
    <p class="muted">Drafted by AI from the captured requests${resolution.basis && asRecord(resolution.basis).code ? " and the code that handles the endpoint" : ""}, with ${escapeHtml(confidencePercent(resolution.confidence))} confidence. Check it against your code before acting on it.</p>`;
}

/** One finding, with everything the app's summary leaves out. */
function renderFinding(item: Record<string, unknown>, index: number, screenshots: Record<string, string> = {}): string {
  const priority = text(item.priority, "MEDIUM");
  const reproduction = asArray(item.reproductionPath).map((step) => String(step)).filter(Boolean);
  const evidenceIds = asArray(item.evidenceIds).map((id) => String(id)).filter(Boolean);
  const shots = asArray(item.evidenceArtifactIds)
    .map((id) => screenshots[String(id)])
    .filter((uri): uri is string => Boolean(uri));
  const rationale = text(item.rationale, "");
  const impact = text(item.impact ?? item.rationale, "Review the linked evidence.");
  return `<section class="finding">
    <div class="section-label">Finding ${String(index + 1).padStart(2, "0")}</div>
    <div class="finding-head"><span class="sev ${escapeHtml(priority.toLowerCase())}">${escapeHtml(
      priority,
    )}</span><h2>${escapeHtml(text(item.title ?? item.suggestedAction, "Recommended improvement"))}</h2></div>
    <h3>Why it matters</h3><p>${escapeHtml(impact)}</p>
    ${businessImpactLine(item) ? `<p class="muted"><strong>What this means for your users.</strong> ${escapeHtml(businessImpactLine(item))}</p>` : ""}
    ${contextualCaveat(item) ? `<p class="muted">${escapeHtml(contextualCaveat(item))}</p>` : ""}
    ${rationale && rationale !== impact ? `<h3>What the evidence shows</h3><p>${escapeHtml(rationale)}</p>` : ""}
    <h3>Next step</h3><p>${escapeHtml(text(item.suggestedAction, "Investigate and repeat the affected step."))}</p>
    ${renderResolution(item)}
    <h3>Expected outcome</h3><p>${escapeHtml(text(item.expectedOutcome, "The Flow completes reliably."))}</p>
    <table class="facts">${factRows([
      ["SOURCE", text(item.generator, "RULES")],
      ["CONFIDENCE", confidencePercent(item.confidence)],
      ["EFFORT", text(item.effort, "Unknown")],
      ["AFFECTED STATE", text(item.affectedState, "Not linked to one state")],
      ["AFFECTED TRANSITION", text(item.affectedTransition, "Not linked to one transition")],
      ["SCOPE", text(item.scope, "IN_FLOW")],
      ...(asArray(item.affectedRoutes).length
        ? ([["AFFECTED ROUTES", joined(item.affectedRoutes)]] as Array<[string, string]>)
        : []),
    ])}</table>
    ${
      reproduction.length
        ? `<h3>Reproduction path</h3><ol>${reproduction.map((step) => `<li>${escapeHtml(step)}</li>`).join("")}</ol>`
        : ""
    }
    ${
      shots.length
        ? `<h3>Screenshot</h3>${shots
            .map((uri) => `<img class="finding-shot" src="${escapeHtml(uri)}" alt="Masked screenshot captured for this finding">`)
            .join("")}`
        : ""
    }
    ${
      evidenceIds.length
        ? `<h3>Linked evidence</h3><p class="muted">Query these evidence event ids on the run to see the capture behind this finding.</p><table class="manifest">${evidenceIds
            .map((id) => `<tr><td>EVENT</td><td><strong>${escapeHtml(id)}</strong></td></tr>`)
            .join("")}</table>`
        : ""
    }
  </section>`;
}

function renderGaps(data: ReadReport): string {
  const { missingStates, missingTransitions, unexpectedStates } = data;
  if (!missingStates.length && !missingTransitions.length && !unexpectedStates.length) {
    return `<section class="major"><div class="section-label">Section // Declared coverage</div><h2>Declared coverage gaps</h2>
      <p>Every declared state and transition was observed, and nothing outside the declaration appeared. The run covered the Flow as published.</p></section>`;
  }
  const stateRows = missingStates
    .map(
      (state) =>
        `<tr><td>STATE</td><td><strong>${escapeHtml(
          text(state.name ?? state.key, "Declared state"),
        )}</strong><small>${escapeHtml(
          `key ${text(state.key, "unknown")} · role ${text(state.role, "NORMAL")}`,
        )}</small></td></tr>`,
    )
    .join("");
  const transitionRows = missingTransitions
    .map(
      (transition) =>
        `<tr><td>TRANSITION</td><td><strong>${escapeHtml(
          `${text(transition.from, "?")} → ${text(transition.to, "?")}`,
        )}</strong><small>${escapeHtml(
          `action ${text(transition.action, "not declared")}`,
        )}</small></td></tr>`,
    )
    .join("");
  const unexpectedRows = unexpectedStates
    .map(
      (state) =>
        `<tr><td>UNDECLARED</td><td><strong>${escapeHtml(
          state,
        )}</strong><small>Observed in this run but absent from the declared Flow.</small></td></tr>`,
    )
    .join("");
  return `<section class="major"><div class="section-label">Section // Declared coverage</div><h2>Declared coverage gaps</h2>
    <p>What the immutable Flow version declared, measured against what this run produced accepted evidence for. A gap is not a defect on its own: it means the declaration was not verified here.</p>
    <table class="facts">${factRows([
      ["DECLARED STATES NOT OBSERVED", String(missingStates.length)],
      ["DECLARED TRANSITIONS NOT OBSERVED", String(missingTransitions.length)],
      ["OBSERVED STATES NOT DECLARED", String(unexpectedStates.length)],
    ])}</table>
    <table class="manifest">${stateRows}${transitionRows}${unexpectedRows}</table>
  </section>`;
}

const TREND_SCOPE_TEXT: Record<string, string> = {
  SAME_FLOW: "Compared against the most recent completed run of the same Flow.",
  SAME_APPLICATION_AND_ENVIRONMENT_NO_FLOW: "Compared against the most recent completed session on the same application and environment (no Flow was declared on either run).",
};

/**
 * Declared-vs-observed across runs: what's new, resolved, or still present since the
 * last comparable run. Always states its own basis, even when unavailable — a
 * comparison that could not run still says why and what it would have compared
 * against, rather than silently omitting the chapter.
 */
function renderTrend(data: ReadReport): string {
  // Absent entirely on a report generated before this feature shipped — say
  // nothing, rather than claiming a comparison was attempted and failed.
  if (!Object.keys(data.trend).length) return "";
  const scopeLine = TREND_SCOPE_TEXT[text(data.trendBasis.comparisonScope, "")] ?? "No comparable prior run was identified.";
  if (!data.hasTrend) {
    const reason = text(data.trend.status, "") === "NO_PRIOR_RUN"
      ? "This is the first comparable run, so nothing is new, resolved, or persisting yet."
      : "A comparison could not be computed for this report.";
    return `<section class="major"><div class="section-label">Section // Trend</div><h2>Since the last run</h2>
      <p>${escapeHtml(scopeLine)} ${escapeHtml(reason)}</p></section>`;
  }
  const versionNote = data.trendBasis.flowVersionChanged === true
    ? " The declared Flow version differs from that run — a finding that disappeared may reflect a changed declaration rather than a fix."
    : "";
  const envNote = data.trendBasis.sameEnvironment === false ? " That run was captured on a different environment." : "";
  const row = (item: Record<string, unknown>, label: string) =>
    `<tr><td>${escapeHtml(label)}</td><td><span class="sev ${escapeHtml(
      text(item.severity, "MEDIUM").toLowerCase(),
    )}">${escapeHtml(text(item.severity, "MEDIUM"))}</span></td><td><strong>${escapeHtml(
      text(item.title, text(item.category, "Finding")),
    )}</strong></td></tr>`;
  return `<section class="major"><div class="section-label">Section // Trend</div><h2>Since the last run</h2>
    <p>${escapeHtml(scopeLine)} Run captured ${escapeHtml(dateText(data.trendBasis.comparedToRunAt))}.${escapeHtml(versionNote)}${escapeHtml(envNote)}</p>
    <div class="metrics">
      <div><span>New</span><strong>${escapeHtml(text(data.trend.newCount, "0"))}</strong></div>
      <div><span>Resolved</span><strong>${escapeHtml(text(data.trend.resolvedCount, "0"))}</strong></div>
      <div><span>Still present</span><strong>${escapeHtml(text(data.trend.stillPresentCount, "0"))}</strong></div>
    </div>
    ${
      data.trendNew.length || data.trendResolved.length || data.trendStillPresent.length
        ? `<table class="index">${data.trendNew.map((item) => row(item, "NEW")).join("")}${data.trendResolved
            .map((item) => row(item, "RESOLVED"))
            .join("")}${data.trendStillPresent.map((item) => row(item, "STILL PRESENT")).join("")}</table>`
        : ""
    }
  </section>`;
}

/**
 * What an endpoint touched, with counts where the data hooks reported them.
 * "reads orders" and "reads orders four hundred times" are different facts.
 */
function modelUsageText(endpoint: Record<string, unknown>): string {
  const usage = records(endpoint.modelUsage);
  if (usage.length) {
    return `models ${usage
      .map((row) => {
        const reads = Number(row.reads ?? 0);
        const writes = Number(row.writes ?? 0);
        const parts = [reads ? `${reads}r` : "", writes ? `${writes}w` : ""].filter(Boolean);
        return parts.length ? `${text(row.model, "?")} ${parts.join("/")}` : text(row.model, "?");
      })
      .join(", ")}`;
  }
  const declared = Array.isArray(endpoint.models) ? endpoint.models.map(String) : [];
  return declared.length ? `models ${declared.join(", ")}` : "no data-access evidence";
}

/**
 * How this run's p95 compared with the endpoint's own recent history.
 *
 * Carries the sample count, because "3x slower than usual" over four prior
 * requests is a very different claim from the same ratio over four thousand.
 */
function baselineText(value: unknown): string {
  const baseline = asRecord(value);
  if (baseline.p95Ms === undefined || baseline.p95Ms === null) return "No history";
  const ratio = Number(baseline.ratio);
  const verdict = text(baseline.verdict, "TYPICAL");
  const usual = millisecondText(baseline.p95Ms, "—");
  const samples = Number(baseline.samples ?? 0);
  const comparison = Number.isFinite(ratio) && verdict !== "TYPICAL"
    ? `${ratio.toFixed(1)}x usual`
    : "as usual";
  return `${comparison} (${usual} over ${samples.toLocaleString()} calls)`;
}

// Below this many samples, "p50/p75/p95" claims more statistical confidence
// than the underlying values support — at n=1 all three percentiles are the
// same single observation wearing three different labels.
const LOW_SAMPLE_THRESHOLD = 5;

/** A percentile triple as the report prints it, or a dash when unmeasured. */
function percentileText(value: unknown, unit = "ms"): string {
  const row = asRecord(value);
  if (row.p75 === null || row.p75 === undefined) return "Not measured";
  const format = (raw: unknown) => {
    if (raw === null || raw === undefined) return "—";
    const number = Number(raw);
    if (!Number.isFinite(number)) return "—";
    if (unit === "") return number.toFixed(2);
    return number >= 1_000 ? `${(number / 1_000).toFixed(1)} s` : `${Math.round(number)} ms`;
  };
  const samples = Number(row.samples ?? 0);
  if (Number.isFinite(samples) && samples > 0 && samples < LOW_SAMPLE_THRESHOLD) {
    const values = [...new Set([format(row.p50), format(row.p75), format(row.p95)])];
    return `${values.join(" / ")} observed over ${samples} sample${samples === 1 ? "" : "s"} — too few to call these percentiles`;
  }
  return `${format(row.p50)} p50 · ${format(row.p75)} p75 · ${format(row.p95)} p95`;
}

function vitalText(value: unknown): string {
  const vital = asRecord(value);
  if (!vital.metric) return "—";
  const metric = String(vital.metric);
  const raw = Number(vital.value);
  const reading = metric === "CLS"
    ? raw.toFixed(2)
    : raw >= 1_000 ? `${(raw / 1_000).toFixed(1)} s` : `${Math.round(raw)} ms`;
  return `${metric} ${reading}`;
}

/**
 * What the browser saw during the run.
 *
 * The counterpart to the backend chapter. Everything here was measured inside
 * the page, so it includes the network and the client — unlike the server-side
 * handler timings in the section that follows.
 */
function renderFrontend(data: ReadReport): string {
  if (!data.hasFrontend) return "";
  const { frontend } = data;
  const network = asRecord(frontend.networkTotals);
  const consoleSummary = asRecord(frontend.console);
  const accessibility = asRecord(frontend.accessibility);
  const interactions = asRecord(frontend.interactions);
  const byImpact = asRecord(accessibility.byImpact);

  const routeRows = data.frontendRoutes
    .map((route) => {
      const vital = asRecord(route.worstVital);
      return `<tr><td><strong>${escapeHtml(text(route.route, "/"))}</strong><small>${escapeHtml(
        [
          `${text(route.samples, "0")} samples`,
          route.settleTimeouts ? `${route.settleTimeouts} settle timeout(s)` : "",
          route.failedResources ? `${route.failedResources} empty resources` : "",
          route.hiddenSamplesDropped ? `${route.hiddenSamplesDropped} discarded while hidden` : "",
        ].filter(Boolean).join(" · "),
      )}</small></td><td>${escapeHtml(percentileText(route.lcpMs))}</td><td>${escapeHtml(
        percentileText(route.cls, ""),
      )}</td><td>${escapeHtml(percentileText(route.inpMs))}</td><td>${escapeHtml(
        percentileText(route.dataReadyMs),
      )}</td><td>${escapeHtml(vital.metric ? vitalText(route.worstVital) : "Within thresholds")}</td></tr>`;
    })
    .join("");

  const networkRows = data.frontendNetwork
    .map(
      (row) =>
        `<tr><td>${escapeHtml(text(row.resourceType, "other"))}</td><td><strong>${escapeHtml(
          text(row.route, "/"),
        )}</strong><small>${escapeHtml(statusClassText(row.statusClasses))}</small></td><td>${escapeHtml(
          text(row.requests, "0"),
        )}</td><td>${escapeHtml(
          `${text(row.failed, "0")} failed${Number(row.blocked ?? 0) ? ` · ${row.blocked} blocked` : ""}`,
        )}</td><td>${escapeHtml(millisecondText(row.p95Ms, "—"))}</td><td>${escapeHtml(
          byteText(row.transferredBytes),
        )}</td></tr>`,
    )
    .join("");

  const a11yRows = data.frontendA11yRules
    .map(
      (rule) =>
        `<tr><td>${escapeHtml(text(rule.impact, "unknown"))}</td><td><strong>${escapeHtml(
          text(rule.help, String(rule.ruleId ?? "")),
        )}</strong><small>${escapeHtml(
          `${text(rule.ruleId, "")} · ${text(rule.nodes, "0")} element(s) · ${joined(rule.routes, "no route recorded")}`,
        )}</small></td><td>${escapeHtml(text(rule.occurrences, "1"))}</td></tr>`,
    )
    .join("");

  const consoleRows = data.frontendConsoleGroups
    .map(
      (group) =>
        `<tr><td>${escapeHtml(text(group.level, "error"))}</td><td><strong>${escapeHtml(
          text(group.message, ""),
        )}</strong><small>${escapeHtml(joined(group.routes, "no route recorded"))}</small></td><td>${escapeHtml(
          text(group.occurrences, "1"),
        )}</td></tr>`,
    )
    .join("");

  const formRows = data.frontendForms
    .map(
      (form) =>
        `<tr><td><strong>${escapeHtml(text(form.form, "unnamed form"))}</strong><small>${escapeHtml(
          joined(form.routes, "no route recorded"),
        )}</small></td><td>${escapeHtml(text(form.submits, "0"))}</td><td>${escapeHtml(
          `${text(form.invalidSubmits, "0")}${form.invalidRate == null ? "" : ` (${Number(form.invalidRate).toFixed(0)}%)`}`,
        )}</td></tr>`,
    )
    .join("");

  return `<section class="major"><div class="section-label">Section // Browser</div><h2>What the browser saw</h2>
    <p>Everything in this section was measured inside the page, so it includes the network and the client. A route's numbers are its own: an in-app navigation resets them rather than accumulating across the session.</p>
    <div class="metrics">
      <div><span>Routes</span><strong>${escapeHtml(text(frontend.routesObserved, "0"))}</strong></div>
      <div><span>Console errors</span><strong>${escapeHtml(text(consoleSummary.errors, "0"))}</strong></div>
      <div><span>Failed requests</span><strong>${escapeHtml(
        String(Number(network.failed ?? 0) + Number(network.errors ?? 0)),
      )}</strong></div>
      <div><span>Worst vital</span><strong>${escapeHtml(vitalText(frontend.worstVital))}</strong></div>
    </div>
    <table class="facts">${factRows([
      [
        "WORST VITAL",
        frontend.worstVital
          ? `${vitalText(frontend.worstVital)} on ${text(asRecord(frontend.worstVital).route, "an unknown route")}`
          : "Every route measured stayed within the Core Web Vitals thresholds",
      ],
      [
        "NETWORK",
        `${text(network.requests, "0")} requests · ${text(network.failed, "0")} failed · ${text(
          network.errors,
          "0",
        )} error responses${Number(network.blocked ?? 0) ? ` · ${network.blocked} blocked by policy` : ""} · ${byteText(
          network.transferredBytes,
        )} transferred`,
      ],
      [
        "CONSOLE",
        `${text(consoleSummary.errors, "0")} errors · ${text(consoleSummary.warnings, "0")} warnings · ${text(
          frontend.runtimeErrors,
          "0",
        )} uncaught runtime errors${Number(frontend.crashes ?? 0) ? ` · ${frontend.crashes} page crash(es)` : ""}`,
      ],
      [
        "ACCESSIBILITY",
        Number(accessibility.scans ?? 0)
          ? `${text(accessibility.violations, "0")} violations across ${text(
              accessibility.routesScanned,
              "0",
            )} scanned routes · ${
              Object.entries(byImpact)
                .map(([impact, count]) => `${count} ${impact}`)
                .join(" · ") || "no impact recorded"
            }`
          : "No accessibility scan ran during this run",
      ],
      [
        "INTERACTIONS",
        `${text(interactions.clicks, "0")} clicks · ${text(interactions.submitted, "0")} form submissions · ${text(
          interactions.invalidSubmits,
          "0",
        )} rejected by validation · ${text(interactions.fieldChanges, "0")} field changes`,
      ],
      [
        "CLIENT STATE",
        `${text(frontend.clientStateMutations, "0")} framework-state changes · ${text(
          frontend.storageMutations,
          "0",
        )} browser storage writes`,
      ],
    ])}</table>
    ${
      routeRows
        ? `<h3>Routes</h3><p>Worst first. LCP, CLS and INP are the Core Web Vitals as the browser measured them; "data ready" is how long the route took before it stopped fetching.</p><table class="index"><tr><td>ROUTE</td><td>LCP</td><td>CLS</td><td>INP</td><td>DATA READY</td><td>VERDICT</td></tr>${routeRows}</table>`
        : "<p>No page-performance sample reached this run.</p>"
    }
    ${
      networkRows
        ? `<h3>Network by resource</h3><p>Grouped by what was fetched, not by the page that fetched it — so a row here cannot be matched to a route above.</p><table class="index"><tr><td>TYPE</td><td>RESOURCE</td><td>REQUESTS</td><td>FAILURES</td><td>P95</td><td>TRANSFERRED</td></tr>${networkRows}</table>`
        : ""
    }
    ${
      a11yRows
        ? `<h3>Accessibility rules</h3><p>Counted once per rule per scan, not once per failing element: one contrast failure across four hundred elements is one thing to fix. IMPACT below is the scanning tool's own rating (critical/serious/moderate/minor), a different scale from Tellann's finding priority — see "Two different severity scales" earlier in this document.</p><table class="index"><tr><td>IMPACT</td><td>RULE</td><td>OCCURRENCES</td></tr>${a11yRows}</table>`
        : ""
    }
    ${
      consoleRows
        ? `<h3>Console output</h3><table class="index"><tr><td>LEVEL</td><td>MESSAGE</td><td>COUNT</td></tr>${consoleRows}</table>`
        : ""
    }
    ${
      formRows
        ? `<h3>Forms</h3><table class="index"><tr><td>FORM</td><td>SUBMISSIONS</td><td>REJECTED</td></tr>${formRows}</table>`
        : ""
    }
    ${
      data.frontendLimitations.length
        ? `<h3>What this section could not see</h3>${list(data.frontendLimitations)}`
        : ""
    }
  </section>`;
}

/**
 * What the application's own server did during the run.
 *
 * Present only when the run captured backend evidence. It answers the two
 * questions a browser report cannot: which endpoints were exercised and how
 * they behaved, and what each one actually changed.
 */
function renderBackend(data: ReadReport): string {
  if (!data.hasBackend) return "";
  const { backend } = data;
  const requests = Number(backend.requests ?? 0);
  const endpointRows = data.backendEndpoints
    .map(
      (endpoint) =>
        `<tr><td>${escapeHtml(text(endpoint.method, "GET"))}</td><td><strong>${escapeHtml(
          text(endpoint.route, "/"),
        )}</strong><small>${escapeHtml(
          [
            `${text(endpoint.requests, "0")} calls`,
            statusClassText(endpoint.statusClasses),
            endpoint.handlers && (endpoint.handlers as unknown[]).length
              ? `handler ${(endpoint.handlers as unknown[]).map(String).join(", ")}`
              : "",
            modelUsageText(endpoint),
          ]
            .filter(Boolean)
            .join(" · "),
        )}</small></td><td>${escapeHtml(text(endpoint.errors, "0"))}</td><td>${escapeHtml(
          millisecondText(endpoint.averageMs, "—"),
        )}</td><td>${escapeHtml(millisecondText(endpoint.p95Ms, "—"))}</td><td>${escapeHtml(
          baselineText(endpoint.baseline),
        )}</td></tr>`,
    )
    .join("");
  const modelRows = data.backendModels
    .map(
      (model) =>
        `<tr><td>${escapeHtml(text(model.model, "Unknown model"))}</td><td>${escapeHtml(
          `${text(model.reads, "0")} read / ${text(model.writes, "0")} write`,
        )}</td><td>${escapeHtml(
          (model.operations as unknown[] | undefined)?.length
            ? (model.operations as unknown[]).map(String).join(", ")
            : "—",
        )}</td><td>${escapeHtml(
          (model.endpoints as unknown[] | undefined)?.length
            ? (model.endpoints as unknown[]).map(String).join(", ")
            : "—",
        )}</td></tr>`,
    )
    .join("");
  const errorRows = data.backendErrorGroups
    .map(
      (group) =>
        `<tr><td>${escapeHtml(text(group.name, "Error"))}</td><td><strong>${escapeHtml(
          text(group.route, "No route recorded"),
        )}</strong><small>${escapeHtml(text(group.message, ""))}</small></td><td>${escapeHtml(
          text(group.occurrences, "1"),
        )}</td></tr>`,
    )
    .join("");
  const slowRows = data.backendSlowestRequests
    .map(
      (item) =>
        `<tr><td>${escapeHtml(`${text(item.method, "GET")} ${text(item.route, "/")}`)}</td><td>${escapeHtml(
          millisecondText(item.durationMs, "—"),
        )}</td><td>${escapeHtml(text(item.statusCode, "—"))}</td></tr>`,
    )
    .join("");

  return `<section class="major"><div class="section-label">Section // Backend</div><h2>What the server handled</h2>
    <p>Every request the application's own server reported during this run, as the backend SDK measured it. Durations are server-side handler time, not round trips, so they exclude the network and the client.</p>
    <div class="metrics">
      <div><span>Requests</span><strong>${escapeHtml(String(requests))}</strong></div>
      <div><span>Failed</span><strong>${escapeHtml(text(backend.errors, "0"))}</strong></div>
      <div><span>p95</span><strong>${escapeHtml(millisecondText(backend.p95Ms, "—"))}</strong></div>
      <div><span>Data ops</span><strong>${escapeHtml(text(backend.dataOperations, "0"))}</strong></div>
    </div>
    <table class="facts">${factRows([
      ["ENDPOINTS EXERCISED", String(data.backendEndpoints.length)],
      [
        "FAILURE BREAKDOWN",
        requests
          ? `${text(backend.serverErrors, "0")} server · ${text(backend.clientErrors, "0")} client · ${text(
              backend.unhandledErrors,
              "0",
            )} unhandled${backend.errorRate == null ? "" : ` · ${Number(backend.errorRate).toFixed(1)}% of requests`}`
          : "No request was recorded",
      ],
      [
        "RESPONSE TIME",
        requests
          ? `${millisecondText(backend.p50Ms, "—")} median · ${millisecondText(
              backend.p95Ms,
              "—",
            )} p95 · ${millisecondText(backend.p99Ms, "—")} p99 · ${millisecondText(
              backend.slowestMs,
              "—",
            )} slowest`
          : "Not measured",
      ],
      [
        "TRANSFERRED",
        `${byteText(backend.requestBytes)} in · ${byteText(backend.responseBytes)} out`,
      ],
      [
        "THROUGHPUT",
        backend.requestsPerMinute == null
          ? "Too few requests to report a rate"
          : `${Number(backend.requestsPerMinute).toFixed(1)} requests per minute`,
      ],
      [
        "PAYLOADS RETAINED",
        `${text(backend.payloadsCaptured, "0")} of ${requests} requests`,
      ],
      ["MODELS TOUCHED", String(data.backendModels.length)],
    ])}</table>
    ${
      endpointRows
        ? `<h3>Endpoints</h3><p>Busiest first. A route is the template the framework matched, so calls that differ only by identifier are counted together.</p><table class="index"><tr><td>METHOD</td><td>ROUTE</td><td>ERRORS</td><td>AVG</td><td>P95</td><td>VS USUAL</td></tr>${endpointRows}</table>`
        : "<p>No request reached this run.</p>"
    }
    ${
      modelRows
        ? `<h3>Models affected</h3><p>What the run changed, rather than only what it answered with. Reported by the SDK's data-access hooks; the arguments of a query are never recorded.</p><table class="index"><tr><td>MODEL</td><td>ACCESS</td><td>OPERATIONS</td><td>ENDPOINTS</td></tr>${modelRows}</table>`
        : ""
    }
    ${
      errorRows
        ? `<h3>Unhandled server errors</h3><p>Errors the application reported outside a response, grouped by route and type.</p><table class="index"><tr><td>TYPE</td><td>WHERE</td><td>COUNT</td></tr>${errorRows}</table>`
        : ""
    }
    ${
      slowRows
        ? `<h3>Slowest requests</h3><table class="index"><tr><td>REQUEST</td><td>DURATION</td><td>STATUS</td></tr>${slowRows}</table>`
        : ""
    }
    ${
      data.backendLimitations.length
        ? `<h3>What this section could not see</h3>${list(data.backendLimitations)}`
        : ""
    }
  </section>`;
}

function renderAnnotations(data: ReadReport, screenshots: Record<string, string> = {}): string {
  if (!data.annotations.length) {
    return `<section class="major"><div class="section-label">Section // Annotations</div><h2>Inspect-mode feedback</h2>
      <p>No annotations were pinned during this run.</p></section>`;
  }
  const rows = data.annotations
    .map((annotation) => {
      const author = asRecord(annotation.author);
      const resolvedBy = asRecord(annotation.resolvedBy);
      const source = asRecord(asRecord(annotation.element).sourceMapping);
      const sourcePath = source.status === "MATCHED" ? text(source.path, "") : "";
      const startLine = Number(source.startLine ?? 0);
      const endLine = Number(source.endLine ?? startLine);
      const sourceLabel = sourcePath
        ? `${sourcePath}${startLine > 0 ? `:${startLine}${endLine > startLine ? `-${endLine}` : ""}` : ""}`
        : "";
      const mentioned = records(annotation.mentionedTeammates)
        .map((member) => `@${text(member.displayName, "member")}`)
        .join(", ");
      const resolvedLabel = annotation.resolved
        ? ` · resolved${resolvedBy.displayName ? ` by ${text(resolvedBy.displayName)}` : ""}${annotation.resolvedAt ? ` (${dateText(annotation.resolvedAt)})` : ""}`
        : "";
      const screenshotArtifactId = typeof annotation.screenshotArtifactId === "string" ? annotation.screenshotArtifactId : "";
      const dataUri = screenshotArtifactId ? screenshots[screenshotArtifactId] : undefined;
      const shot = dataUri ? `<img class="annotation-shot" src="${escapeHtml(dataUri)}" alt="Highlighted annotated element">` : "";
      return `<tr><td>${escapeHtml(text(annotation.pin, "•"))}</td><td><strong>${escapeHtml(
        text(annotation.comment, ""),
      )}</strong><small>${escapeHtml(
        `${text(author.displayName, "QA author")} · ${dateText(annotation.timestamp)} · ${text(
          annotation.route,
          "unknown route",
        )} · state ${text(annotation.flowState, "outside boundary")}${sourceLabel ? ` · source ${sourceLabel}` : ""}${mentioned ? ` · mentioned ${mentioned}` : ""}${resolvedLabel}`,
      )}</small>${shot}</td></tr>`;
    })
    .join("");
  return `<section class="major"><div class="section-label">Section // Annotations</div><h2>Inspect-mode feedback</h2>
    <p>Comments pinned to elements while the run was being captured, in the order they were added.</p>
    <table class="index annotations">${rows}</table></section>`;
}

const MODE_TEXT: Record<string, string> = {
  GUIDED: "Guided",
  ASSISTED: "Assisted",
  OBSERVATION_ONLY: "Observation only",
  AUTOMATED: "Automated",
};

const OUTCOME_KIND_TEXT: Record<string, string> = {
  SUCCESS: "Every declared step to the target was performed and the expected state followed.",
  APPLICATION: "The application did not behave as the declared Flow describes, so the run could not continue.",
  INFRASTRUCTURE: "A failure of the run itself, not a finding about the application. Nothing here shows the Flow is broken.",
  USER: "The run was stopped before it finished; states it did not reach say nothing about the application.",
};

/** The run's own stop reason, translated into prose for the cover-page verdict. */
const COMPLETION_REASON_TEXT: Record<string, string> = {
  TERMINAL_STATE_REACHED: "The run reached its declared terminal state. This report reflects a complete pass through the declared Flow.",
  MANUAL_STOP_BEFORE_TERMINAL: "The run was stopped manually before reaching its declared terminal state. Findings and coverage reflect only what happened before the stop.",
  MANUAL_STOP_BEFORE_INITIAL: "The run was stopped before it reached its declared initial state. Little to nothing in this report was captured in-Flow.",
  TIMEOUT: "The run timed out before reaching its declared terminal state. Findings and coverage reflect only what happened before the timeout.",
  SESSION_MANUAL_STOP: "This observational session was stopped manually. There is no declared Flow to measure completeness against — only what was captured is reported.",
  SESSION_TIMEOUT: "This observational session timed out. There is no declared Flow to measure completeness against — only what was captured is reported.",
};
const COMPLETION_REASON_FALLBACK = "This run's completion reason was not recorded, so completeness cannot be confirmed from this report alone.";

/** The cover-page headline paired with COMPLETION_REASON_TEXT, same keys. */
const VERDICT_HEADLINE_TEXT: Record<string, string> = {
  TERMINAL_STATE_REACHED: "Verified — reached its declared end",
  MANUAL_STOP_BEFORE_TERMINAL: "Partial — stopped before the declared end",
  MANUAL_STOP_BEFORE_INITIAL: "Incomplete — stopped before the Flow began",
  TIMEOUT: "Partial — timed out before the declared end",
  SESSION_MANUAL_STOP: "Session — no declared Flow to verify against",
  SESSION_TIMEOUT: "Session — no declared Flow to verify against",
};

/** Finding categories where "this happened" needs a "confirm it's actually a defect" caveat. */
const CONTEXTUAL_CATEGORIES = new Set(["HTTP_ERROR_RESPONSE", "NETWORK_REQUEST_FAILED", "BROWSER_CONSOLE_ERROR"]);

/** Tellann's own priority scale, lowest number first — mirrors services/background-workers' severityRank. */
const SEVERITY_RANK: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, INFO: 4 };

/**
 * A caveat for findings whose category is inherently ambiguous without more context
 * than this run captured (a 401 can be a correct auth rejection; a console error can be
 * third-party noise). Absent for every other category, and silently absent on a report
 * generated before `category` was added to the payload — `text(item.category, "")`
 * returns "" for those, which never matches `CONTEXTUAL_CATEGORIES`.
 */
function contextualCaveat(item: Record<string, unknown>): string {
  const category = text(item.category, "");
  if (!CONTEXTUAL_CATEGORIES.has(category)) return "";
  if (category === "BROWSER_CONSOLE_ERROR") {
    return "This is a console error observed during the run. Some console errors are expected noise from third-party scripts; confirm it traces to application code before treating it as a defect.";
  }
  return "This is an HTTP response outside the 2xx/3xx range. A 401/403 during an intentional auth check, or a 404 your application expects to probe for, reads identically to a real failure here — confirm what the request was for before treating this as a defect.";
}

/**
 * `dedupeKey` for a Core Web Vital finding is `vital:${metric}:${route}` (packages/
 * browser-observer) — the only place the specific metric (LCP/CLS/INP) survives into
 * the report, since `category` is the same FRONTEND_POOR_WEB_VITAL for all three.
 */
function parseVitalMetric(dedupeKey: unknown): string | null {
  const key = typeof dedupeKey === "string" ? dedupeKey : "";
  const parts = key.split(":");
  return parts.length >= 2 && parts[0] === "vital" ? parts[1] : null;
}

/**
 * Plain-language "what this means for your users" lines. Per docs/desktop/
 * report_review.md §5, these never assert a specific business outcome (no invented
 * percentages, no asserting a route is checkout) — only a generic translation of the
 * technical event, with workflow-criticality framing kept as an explicit, unconfirmed
 * guess ("if this route is part of a flow users rely on..."), never a stated fact.
 * Scoped to the categories named for this feature; absent for every other category and
 * for a report generated before `category` was added to the payload, same silent
 * degradation as `contextualCaveat` above.
 */
const BUSINESS_IMPACT_TEXT: Record<string, string> = {
  ACCESSIBILITY_VIOLATION: "This may make part of the page unusable for people using assistive technology, such as a screen reader or keyboard-only navigation.",
  HTTP_ERROR_RESPONSE: "A request answering like this may stop a user from completing whatever they were doing — if this route is part of a flow users rely on, such as signing in or checking out, that attempt may not have gone through.",
  NETWORK_REQUEST_FAILED: "A request failing outright may stop a user from completing whatever they were doing — if this route is part of a flow users rely on, that attempt may not have gone through.",
  BROWSER_CONSOLE_ERROR: "A client-side error like this can leave part of the page not working as a user expects, even when nothing visibly crashed.",
  FRONTEND_FAILED_RESOURCES: "A broken image, font, or script can make a page look unfinished or broken to a user, even though the rest of the page still works.",
};

const VITAL_BUSINESS_IMPACT_TEXT: Record<string, string> = {
  CLS: "Elements shifting while a page loads can cause a user to click the wrong thing or lose their place — if this route is part of a flow users rely on, that friction may show up as mis-clicks or people giving up partway through.",
  LCP: "A page slow to show its main content is one of the clearest reasons a user leaves before it finishes loading — if this route is part of a flow users rely on, slower loads may mean fewer people complete it.",
  INP: "A page that feels slow to respond to clicks reads as broken to a user, even though it still works — if this route is part of a flow users rely on, that may show up as repeated clicks or abandoned attempts.",
};

function businessImpactLine(item: Record<string, unknown>): string {
  const category = text(item.category, "");
  if (category === "FRONTEND_POOR_WEB_VITAL") {
    const metric = parseVitalMetric(item.dedupeKey);
    return (metric && VITAL_BUSINESS_IMPACT_TEXT[metric]) ?? "";
  }
  return BUSINESS_IMPACT_TEXT[category] ?? "";
}

/**
 * The Automated Run chapter (QRS-RUN-005..008): what the run was pinned to, how each state went,
 * and how it ended. It keeps "the application prevented this" apart from "the run never got
 * there", and it never presents an execution failure as a missing Flow step.
 */
/** How hard a step was to get at, in the words a report uses. `EASY` is never shown: it is the ordinary case. */
const EASE_TEXT: Record<string, string> = {
  NO_STABLE_IDENTITY: "the control had nothing but its visible text to identify it",
  AMONG_LOOKALIKES: "the control was one of several that read the same",
  HIDDEN_OR_DISABLED: "a matching control was hidden or disabled",
  NEEDED_RETRY: "the control did not respond the first time",
  SLOW_TRANSITION: "the step took a visible while to take effect",
};

function renderAutomated(data: ReadReport): string {
  if (!data.hasAutomated) return "";
  const automated = data.automated;
  const pinned = asRecord(automated.pinned);
  const outcome = asRecord(automated.outcome);
  const states = records(automated.states);
  const unreached = records(automated.unreachedStates);
  const reconciliation = Object.entries(asRecord(automated.reconciliation)).filter(([, count]) => Number(count) > 0);
  const kind = typeof outcome.kind === "string" ? outcome.kind : "";
  const codeEvidence = records(automated.codeEvidence);
  const retainedTraces = records(automated.retainedTraces);
  const renderTiming = records(automated.renderTiming)
    .map((sample) => ({ sample, total: Number(sample.totalMs) || 0 }))
    .sort((a, b) => b.total - a.total)
    .map(({ sample }) => {
      const states = Array.isArray(sample.states) ? sample.states.map((state) => text(state)).join(", ") : "";
      return `<tr><td>${escapeHtml(text(sample.component))}<small>${escapeHtml(states || "not mapped to a state")}</small></td><td>${escapeHtml(
        `${text(sample.mounts, "0")} mounts, ${text(sample.updates, "0")} updates`,
      )}</td><td>${escapeHtml(`${text(sample.totalMs, "0")} ms total, ${text(sample.maxMs, "0")} ms worst`)}</td></tr>`;
    })
    .join("");

  const stateRows = states
    .map((state) => {
      const action = asRecord(state.action);
      const acted = Object.keys(action).length > 0;
      const result = !acted
        ? "End of run"
        : `${text(action.label, "Action")} → ${
            action.verified === false ? "did not advance" : action.verified === true ? "advanced" : "not verified"
          }${action.error ? ` (${text(action.error)})` : ""}`;
      // How hard the step was to get at, said only when it was harder than it should have been.
      const ease = typeof action.ease === "string" && action.ease !== "EASY" ? EASE_TEXT[action.ease] ?? null : null;
      const waited = typeof action.settledMs === "number" ? `waited ${millisecondText(action.settledMs)}` : null;
      const effort = [ease, waited].filter(Boolean).join(" · ");
      return `<tr><td>${escapeHtml(text(state.stateKey))}<small>${escapeHtml(
        `${state.scope === "PRE_BOUNDARY" ? "setup, before the Flow began" : "in the Flow"} · ${text(state.route, "no route")}`,
      )}</small></td><td>${escapeHtml(result)}${effort ? `<small>${escapeHtml(effort)}</small>` : ""}</td><td>${escapeHtml(
        millisecondText(state.durationMs),
      )}</td></tr>`;
    })
    .join("");

  const unreachedRows = unreached
    .map(
      (state) =>
        `<tr><td>${escapeHtml(text(state.stateKey))}</td><td>${escapeHtml(
          state.status === "BLOCKED_BY_APPLICATION" ? "Prevented by the application" : "Not attempted",
        )}${state.detail ? `<small>${escapeHtml(text(state.detail))}</small>` : ""}</td></tr>`,
    )
    .join("");

  const evidenceBlocks = codeEvidence
    .map((entry) => {
      const subject = asRecord(entry.subject);
      const locations = records(entry.refs).map((ref) => {
        const start = typeof ref.startLine === "number" ? ref.startLine : null;
        const end = typeof ref.endLine === "number" ? ref.endLine : null;
        const range = start ? (end && end !== start ? `:${start}-${end}` : `:${start}`) : "";
        return `${ref.symbol ? `${text(ref.symbol)} — ` : ""}${text(ref.file)}${range}`;
      });
      const doubtful = entry.derivation !== "RESOLVED";
      return `<h3>${escapeHtml(`${subject.kind === "STATE" ? "State" : "Transition"} ${text(subject.id)}`)}</h3><p>${escapeHtml(
        text(entry.summary),
      )}</p>${locations.length ? list(locations) : ""}${
        doubtful ? `<p class="muted">${escapeHtml(`The mapping to code is ${text(entry.derivation).toLowerCase()}; treat this as a lead.`)}</p>` : ""
      }`;
    })
    .join("");

  // What was computed and, until now, shown nowhere: the actions the run could not perform at all.
  const blockedRows = records(automated.blockedActions)
    .map((blocked) => `<tr><td>${escapeHtml(text(blocked.reason).replaceAll("_", " ").toLowerCase())}<small>${escapeHtml(
      text(blocked.transitionId, "no step recorded"),
    )}</small></td><td>${escapeHtml(text(blocked.detail, "No detail recorded"))}</td></tr>`)
    .join("");

  // What the Flow said a step causes, against what the page did. A declared contract the application has
  // quietly stopped honouring is one of the most useful things here and was being thrown away.
  const effectRows = states
    .flatMap((state) => {
      const action = asRecord(state.action);
      return records(action.effects)
        .filter((effect) => effect.outcome !== "MATCHED")
        .map((effect) => `<tr><td>${escapeHtml(`${text(effect.method)} ${text(effect.route)}`)}<small>${escapeHtml(
          `${text(state.stateKey)} · ${text(action.label, "step")}`,
        )}</small></td><td>${escapeHtml(
          effect.outcome === "NOT_OBSERVED"
            ? "Declared for this step and never happened"
            : `Answered ${text(effect.observedStatus, "something else")} rather than ${text(effect.expectedStatus, "what was declared")}`,
        )}</td></tr>`);
    })
    .join("");

  const uiQualityRows = records(automated.uiQuality)
    .map((finding) => `<tr><td>${escapeHtml(text(finding.rule).replaceAll("_", " ").toLowerCase())}<small>${escapeHtml(
      [text(finding.stateKey, "the Flow itself"), finding.breakpoint ? text(finding.breakpoint) : null].filter(Boolean).join(" · "),
    )}</small></td><td>${escapeHtml(text(finding.detail))}${
      finding.recommendation ? `<small>${escapeHtml(text(finding.recommendation))}</small>` : ""
    }</td></tr>`)
    .join("");

  // A state-by-size grid. Every size is shown, including the ones that were fine, because "checked and clear"
  // is the half of a responsiveness claim that is usually missing.
  const responsive = records(automated.responsive);
  const responsiveNames = [...new Set(responsive.flatMap((entry) => records(entry.samples).map((sample) => text(sample.name))))];
  const responsiveRows = responsive
    .map((entry) => {
      const byName = new Map(records(entry.samples).map((sample) => [text(sample.name), sample]));
      const cells = responsiveNames.map((name) => {
        const sample = byName.get(name);
        if (!sample) return "<td>—</td>";
        const problems = [
          Number(sample.horizontalOverflowPx) > 4 ? `${text(sample.horizontalOverflowPx)}px too wide` : null,
          Number(sample.smallestTextPx) > 0 && Number(sample.smallestTextPx) < 12 ? `${text(sample.smallestTextPx)}px text` : null,
          Number(sample.smallestTapTargetPx) > 0 && Number(sample.smallestTapTargetPx) < 44 && Number(sample.width) <= 768
            ? `${text(sample.smallestTapTargetPx)}px control`
            : null,
        ].filter(Boolean);
        return `<td>${escapeHtml(problems.length ? problems.join("; ") : "clear")}</td>`;
      });
      return `<tr><td>${escapeHtml(text(entry.stateKey))}</td>${cells.join("")}</tr>`;
    })
    .join("");

  const summary = asRecord(automated.summary);
  const priorities = Array.isArray(summary.priorities) ? summary.priorities.map((line) => text(line)).filter(Boolean) : [];
  const limitations = Array.isArray(automated.limitations) ? automated.limitations.map((line) => text(line)).filter(Boolean) : [];

  const traceRows = retainedTraces
    .map((trace) => {
      const reasons = Array.isArray(trace.reasons) ? trace.reasons.map((reason) => text(reason)) : [];
      return `<tr><td>${escapeHtml(text(trace.stateKey, "Before the first state"))}</td><td>${escapeHtml(
        reasons.length ? reasons.map((reason) => reason.replaceAll("_", " ").toLowerCase()).join("; ") : "something went wrong here",
      )}</td></tr>`;
    })
    .join("");

  return `<section class="major"><div class="section-label">Section // Automated run</div><h2>What the automated run did</h2>
    ${
      summary.headline
        ? `<p class="lead">${escapeHtml(text(summary.headline))}</p>${
            priorities.length ? `<h3>What to look at first</h3>${list(priorities)}` : ""
          }`
        : ""
    }
    <p><strong>${escapeHtml(text(outcome.stopReason, "Outcome not recorded"))}</strong>. ${escapeHtml(
      OUTCOME_KIND_TEXT[kind] ?? "The run did not record why it ended.",
    )}${outcome.detail ? ` ${escapeHtml(text(outcome.detail))}` : ""}</p>
    <h3>What the run was pinned to</h3>
    <table class="facts">${factRows([
      ["FLOW VERSION", text(pinned.flowVersionId)],
      ["STARTING STATE", text(pinned.initialStateKey)],
      ["TARGET STATE", text(pinned.targetTerminalStateKey)],
      ["EXECUTION PROFILE", text(pinned.executionProfileId)],
      ["TEST PERSONA", text(pinned.testPersonaId)],
      ["RUN DATA SET", text(pinned.runDataSetId)],
      ["CODE SNAPSHOT", text(pinned.codeSnapshotId)],
      ["INSTRUMENTATION", text(pinned.instrumentationManifestVersion)],
      ["STEPS / REPLANS", `${text(outcome.steps, "0")} / ${text(outcome.replans, "0")}`],
    ])}</table>
    <h3>State by state</h3>
    ${
      stateRows
        ? `<table class="facts">${stateRows}</table>`
        : "<p>No state was recognised before the run ended.</p>"
    }
    ${
      unreachedRows
        ? `<h3>Declared states not reached</h3><table class="facts">${unreachedRows}</table>`
        : ""
    }
    ${
      evidenceBlocks
        ? `<h3>What the code says about the step that failed</h3><p class="muted">Locations and a summary only. The source stays on the machine that ran the test.</p>${evidenceBlocks}`
        : ""
    }
    ${
      traceRows
        ? `<h3>Diagnostic traces kept</h3><p class="muted">A trace is recorded for every state and kept only where something went wrong. It holds the action log and console output, with typed text, page content and credentials removed.</p><table class="facts">${traceRows}</table>`
        : ""
    }
    ${
      renderTiming
        ? `<h3>Render time of the Flow's components</h3><p class="muted">Measured for the components this run was asked to watch, in a development build.</p><table class="facts">${renderTiming}</table>`
        : ""
    }
    ${
      effectRows
        ? `<h3>What the Flow says these steps cause, and what happened</h3><p class="muted">Only the requests a person declared are checked. One that did not happen is the application no longer doing what the Flow says it does.</p><table class="facts">${effectRows}</table>`
        : ""
    }
    ${
      uiQualityRows
        ? `<h3>How this Flow could be better to use</h3><p class="muted">Each of these is a measurement against a published threshold, so you can tell whether to agree with it.</p><table class="facts">${uiQualityRows}</table>`
        : ""
    }
    ${
      responsiveRows
        ? `<h3>How each state behaves at other window sizes</h3><p class="muted">Each state was re-measured at these sizes the first time the run reached it. Nothing was clicked and nothing was changed.</p>`
          + `<table class="facts"><tr><td>State</td>${responsiveNames.map((name) => `<td>${escapeHtml(name)}</td>`).join("")}</tr>${responsiveRows}</table>`
        : ""
    }
    ${
      blockedRows
        ? `<h3>Actions the run could not perform</h3><table class="facts">${blockedRows}</table>`
        : ""
    }
    ${
      reconciliation.length
        ? `<h3>What reconciliation attributes the gaps to</h3>${list(
            reconciliation.map(([reason, count]) => `${count} × ${reason.replaceAll("_", " ").toLowerCase()}`),
          )}`
        : ""
    }
    ${
      limitations.length
        ? `<h3>What this run could not tell you</h3>${list(limitations)}`
        : ""
    }
  </section>`;
}

function renderAppendix(data: ReadReport): string {
  const eventRows = data.events
    .slice(0, EVENT_LIMIT)
    .map(
      (event) =>
        `<tr><td>${escapeHtml(dateText(event.timestamp, "—"))}</td><td>${escapeHtml(
          text(event.type, "EVENT"),
        )}</td><td>${escapeHtml(text(event.route, "No route"))}</td><td>${escapeHtml(
          text(event.scope, "IN_FLOW"),
        )}</td></tr>`,
    )
    .join("");
  const notListed = Math.max(0, data.events.length - EVENT_LIMIT);
  const limitations = [
    ...data.limitations,
    ...(data.eventsTruncated > 0
      ? [
          `The stored appendix holds a bounded sample: ${data.eventsTruncated} event(s) of ${data.eventTotal} stay queryable through the evidence endpoints rather than being embedded in the report.`,
        ]
      : []),
    ...(notListed > 0
      ? [`This document lists the first ${EVENT_LIMIT} events of the stored sample; ${notListed} further event(s) are not printed.`]
      : []),
  ];
  return `<section class="major"><div class="section-label">Appendix // Evidence</div><h2>Auditable capture record</h2>
    <p>The capture this report was derived from. Values read from the page stay masked here: a protected value is revealed only in the app, one at a time, rate limited and audited, and is never written to a downloaded file. For the full captured sequence, open this run in Tellann Desktop and use the evidence viewer; this document prints only a bounded sample for audit reference.</p>
    <table class="facts">${factRows([
      ["EVIDENCE EVENTS CAPTURED", String(data.eventTotal || data.events.length)],
      ["ACCEPTED FLOW EVENTS", String(data.acceptedFlowEvents.length)],
      ["QUARANTINED FLOW EVENTS", String(data.quarantinedFlowEvents.length)],
      ["SESSIONS CORRELATED", String(records(data.correlation.sessions).length)],
      ["ARTIFACTS CAPTURED", text(data.summary.artifactCount, "0")],
    ])}</table>
    ${limitations.length ? `<h3>Capture limitations</h3>${list(limitations)}` : ""}
    ${
      eventRows
        ? `<h3>Evidence index</h3><table class="index events">${eventRows}</table>`
        : '<p class="muted">No evidence events were embedded in this report.</p>'
    }
  </section>`;
}

export function qualityReportHtml(input: QualityReportDocumentInput): string {
  const { report } = input;
  const data = readReport(report);
  const title = data.runTitle
    || (data.hasFlow ? `${flowTitle(data)} quality report` : "Observational QA report");
  const counts: Record<string, number> = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0 };
  for (const finding of data.findings) {
    const priority = text(finding.priority, "MEDIUM").toUpperCase();
    counts[priority] = (counts[priority] ?? 0) + 1;
  }

  const snapshotRows = factRows([
    ["APPLICATION", text(data.application.name)],
    ["ENVIRONMENT", `${text(data.environment.name)} · ${text(data.environment.type)}`],
    ...(data.hasFlow ? [["FLOW", `${flowTitle(data)} · version ${text(data.flowSummary.version ?? data.flow.version, "legacy")}`] as [string, string]] : []),
    ["RUN", text(report.runId)],
    ["REPORT", text(report.id)],
    ["RUN OUTCOME", text(data.runSummary.boundaryOutcome ?? report.status)],
    ["REPORT GENERATED", dateText(report.generatedAt)],
    ["DOCUMENT GENERATED", dateText(input.generatedAt)],
  ]);

  const indexRows = data.findings
    .map((finding, index) => {
      const priority = text(finding.priority, "MEDIUM");
      return `<tr><td>${String(index + 1).padStart(2, "0")}</td><td><span class="sev ${escapeHtml(
        priority.toLowerCase(),
      )}">${escapeHtml(priority)}</span></td><td><strong>${escapeHtml(
        text(finding.title ?? finding.suggestedAction, "Finding"),
      )}</strong><small>${escapeHtml(
        `${text(finding.generator, "RULES")} · state ${text(finding.affectedState, "not linked")} · transition ${text(
          finding.affectedTransition,
          "not linked",
        )}`,
      )}</small></td></tr>`;
    })
    .join("");

  const eventCountRows = Object.entries(data.eventCounts).map(
    ([type, count]) => [eventLabel(type).toUpperCase(), String(Number(count))] as [string, string],
  );

  const expectedCoverage =
    data.coverage.expected === null || data.coverage.expected === undefined
      ? "n/a"
      : `${Number(data.coverage.expected).toFixed(1)}%`;

  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>
    @page { size:A4; margin:18mm 0; }
    *{box-sizing:border-box}
    html, body{margin:0;padding:0;background:#ffffff;color:#1a1a1a;font-family:Arial,Helvetica,sans-serif;font-size:10pt;line-height:1.5;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    main{position:relative;z-index:1}
    .sheet{padding:0 16mm}
    .brand{display:flex;justify-content:space-between;align-items:center;margin-bottom:34px}
    .logo{font-size:20px;font-weight:800;letter-spacing:-.04em;color:#000}
    .badge,.sev{display:inline-block;border:1px solid #cfcfcf;color:#666;padding:3px 7px;font:8pt 'Courier New',monospace;letter-spacing:.08em;text-transform:uppercase;white-space:nowrap}
    .sev.critical,.sev.high{color:#fff;background:#111;border-color:#111}
    .sev.medium{color:#111;border-color:#111;background:#ededed}
    h1{font-size:25px;line-height:1.2;margin:0 0 10px;color:#000}
    h2{font-size:17px;line-height:1.3;margin:0;color:#000}
    h3{font-size:12px;margin:20px 0 8px;color:#000}
    p{margin:0 0 12px}
    .muted,small{color:#666}
    small{display:block;margin-top:3px;overflow-wrap:anywhere}
    table{width:100%;border-collapse:collapse}
    td{border:1px solid #dcdcdc;padding:8px 10px;vertical-align:top}
    .facts td:first-child,.manifest td:first-child{color:#666;font:8pt 'Courier New',monospace;letter-spacing:.06em;width:28%;text-transform:uppercase}
    .index td:first-child{color:#666;font:8pt 'Courier New',monospace;width:8%}
    .index td:nth-child(2){width:14%}
    .events td{font-size:8.5pt}
    .events td:first-child{width:24%}
    .events td:nth-child(2){width:24%}
    .annotation-shot{display:block;max-width:320px;margin-top:8px;border:1px solid #dcdcdc}
    .finding-shot{display:block;max-width:420px;margin-top:8px;border:1px solid #dcdcdc}
    .summary{border:1px solid #dcdcdc;padding:18px;margin:18px 0}
    .metric{font:22px 'Courier New',monospace;color:#000}
    .metrics{display:flex;gap:10px;margin:18px 0}
    .metrics > div{flex:1;border:1px solid #dcdcdc;padding:12px}
    .metrics span{display:block;color:#666;font:7.5pt 'Courier New',monospace;letter-spacing:.06em;text-transform:uppercase}
    .metrics strong{display:block;margin-top:6px;font:18px 'Courier New',monospace;font-weight:400;color:#000}
    ul,ol{margin:0 0 12px;padding-left:19px}
    li{margin-bottom:4px}
    .major,.finding{break-before:page}
    .section-label{font:8pt 'Courier New',monospace;color:#666;letter-spacing:.1em;text-transform:uppercase;margin-bottom:8px}
    .finding-head{display:flex;gap:10px;align-items:center;margin-bottom:12px}
    .notice{border-left:3px solid #000;padding:10px 14px;margin:12px 0}
    tr{break-inside:avoid}
    .footer{border-top:1px solid #dcdcdc;margin-top:30px;padding-top:14px;color:#666;font-size:8pt}
  </style></head><body><main><section class="sheet">
    <div class="brand"><div class="logo">TELLANN</div><span class="badge">Quality // QA run report</span></div>
    <h1>${escapeHtml(title)}</h1>
    <p class="muted">${data.hasFlow ? "Everything this QA run established: what the Flow declared, what the run observed, every finding with its evidence, the risks found outside the Flow, and the capture record behind them." : "Everything this observational session established: what the run captured, every evidence-backed finding, annotations, artifacts, and the auditable capture record behind them."}</p>
    ${
      data.completionReason
        ? `<div class="notice"><strong>${escapeHtml(VERDICT_HEADLINE_TEXT[data.completionReason] ?? "Outcome not recorded")}.</strong> ${escapeHtml(COMPLETION_REASON_TEXT[data.completionReason] ?? COMPLETION_REASON_FALLBACK)}</div>`
        : ""
    }
    <div class="summary"><div class="metric">${data.findings.length} finding${
      data.findings.length === 1 ? "" : "s"
    }${data.hasFlow ? " in this Flow" : " in this session"}</div><p>${escapeHtml(
      `${counts.CRITICAL} critical · ${counts.HIGH} high · ${counts.MEDIUM} medium · ${counts.LOW} low · ${counts.INFO} info${data.hasFlow ? ` · ${data.criticalFindings.length} critical outside the Flow` : ""}`,
    )}</p></div>
    <div class="metrics">
      ${data.hasFlow ? `<div><span>Expected coverage</span><strong>${escapeHtml(expectedCoverage)}</strong></div>` : ""}
      ${
        data.hasFlow
          ? `<div><span>Observed states</span><strong>${escapeHtml(text(data.summary.observedStateCount, "0"))}</strong></div>
             <div><span>Transitions</span><strong>${escapeHtml(text(data.summary.observedTransitionCount, "0"))}</strong></div>`
          : `<div><span>Observed states</span><strong>Not measured</strong></div>
             <div><span>Transitions</span><strong>Not measured</strong></div>`
      }
      <div><span>High priority</span><strong>${escapeHtml(text(data.summary.criticalOrHighFindings, "0"))}</strong></div>
    </div>
    <table class="facts">${factRows([
      ["WORKFLOW COVERAGE", data.hasFlow ? coverageText(data) : "Not measured — this run declared no Flow to verify against"],
      [
        "STATE/TRANSITION EVIDENCE",
        data.hasFlow
          ? `${text(data.summary.observedStateCount, "0")} states, ${text(data.summary.observedTransitionCount, "0")} transitions observed`
          : "Not available for a session-scoped run",
      ],
      [
        // instrumentationAvailable is about the frontend framework adapter
        // (the "Instrumentation manifest" below), not a backend concept — it
        // has no meaning on a run that never opened a browser.
        "INSTRUMENTATION",
        data.backendOnly
          ? "Not applicable — no browser capture track"
          : data.runSummary.instrumentationAvailable
            ? "Validated instrumentation attached"
            : "Browser-level evidence only",
      ],
    ])}</table>
    ${
      data.runSummary.captureDegraded
        ? '<div class="notice"><strong>Capture was degraded.</strong> Read the limitations in the evidence appendix before relying on the coverage figure in this report.</div>'
        : ""
    }
    ${(() => {
      const top = data.findings.filter((f) => ["CRITICAL", "HIGH"].includes(text(f.priority, "").toUpperCase())).slice(0, 3);
      if (!top.length) return "";
      return `<div class="notice"><strong>Immediate attention</strong><ul>${top
        .map(
          (f) =>
            `<li><span class="sev ${escapeHtml(text(f.priority, "MEDIUM").toLowerCase())}">${escapeHtml(
              text(f.priority, "MEDIUM"),
            )}</span> ${escapeHtml(text(f.title ?? f.suggestedAction, "Finding"))}</li>`,
        )
        .join("")}</ul></div>`;
    })()}
    <table class="facts">${snapshotRows}</table>

    ${data.hasFlow ? `<section class="major"><div class="section-label">Section // Flow</div><h2>What the Flow declared</h2>
      <p>${escapeHtml(text(data.flowSummary.purpose ?? data.flow.purpose, "No purpose was declared for this Flow."))}</p>
      <table class="facts">${factRows([
        ["SCOPE", text(data.flowSummary.scope ?? data.flow.scopeStatement, "Not declared")],
        ["INITIAL STATE", text(data.flowSummary.initialState ?? data.flow.initialStateKey, "Not declared")],
        ["TERMINAL STATES", joined(data.flowSummary.terminalStates ?? data.flow.terminalStateKeys)],
        [
          "DECLARED STRUCTURE",
          `${text(data.flowSummary.declaredStateCount, "—")} states · ${text(
            data.flowSummary.declaredTransitionCount,
            "—",
          )} transitions`,
        ],
        ["PROVENANCE", text(data.flowSummary.provenance, "Not recorded")],
        ["COVERAGE", coverageText(data)],
        ...(data.coverage.confidenceBand
          ? ([["CONFIDENCE", confidenceText(data)]] as Array<[string, string]>)
          : []),
      ])}</table>
      ${
        data.coverageCaveats.length
          ? `<h3>What qualifies that number</h3><p>The coverage figure above was produced under these conditions. It is still the best measure this run can offer; it is not the same claim as the same percentage from a clean capture.</p>${list(data.coverageCaveats)}`
          : ""
      }
    </section>` : ""}

    ${data.hasFlow ? renderGaps(data) : ""}

    <section class="major"><div class="section-label">Section // Run</div><h2>How the run was captured</h2>
      <table class="facts">${factRows([
        ["TARGET", text(data.runSummary.url)],
        [
          "ENVIRONMENT",
          `${text(asRecord(data.runSummary.environment).name ?? data.environment.name)} · ${text(
            asRecord(data.runSummary.environment).type ?? data.environment.type,
          )}`,
        ],
        ["MODE", data.mode ? MODE_TEXT[data.mode] ?? data.mode : "Not recorded"],
        ["CAPTURE TRACKS", joined(data.runSummary.captureTracks ?? report.captureTracks, "Not recorded")],
        ["DURATION", durationText(data.runSummary.durationMs)],
        ["BOUNDARY OUTCOME", text(data.runSummary.boundaryOutcome ?? report.status)],
        // A backend-only run opened no browser, so there is no viewport,
        // client instrumentation or framework-state evidence to report —
        // printing "Not recorded" for all three would just be browser-shaped
        // noise on a run that was never going to fill them in.
        ...(data.backendOnly
          ? []
          : ([
              [
                "INSTRUMENTATION",
                data.runSummary.instrumentationAvailable
                  ? "Validated instrumentation attached"
                  : "Browser-level evidence only",
              ],
              ["FRAMEWORK STATE EVIDENCE", data.runSummary.frameworkStateEvidenceCaptured ? "Captured" : "Not captured"],
              ["WINDOW RESOLUTION", windowResolution(data)],
            ] as Array<[string, string]>)),
        ["REPOSITORY REVISION", text(data.runSummary.repositoryRevision ?? data.repository.revision, "Not attached")],
        [
          "WORKING TREE",
          data.repository.dirty === undefined
            ? "Not attached"
            : data.repository.dirty
              ? "Had uncommitted changes"
              : "Clean",
        ],
        ["SESSIONS", String(records(data.correlation.sessions).length)],
      ])}</table>
      ${eventCountRows.length ? `<h3>Evidence captured by type</h3><table class="facts">${factRows(eventCountRows)}</table>` : ""}
      ${
        Object.keys(data.instrumentation).length
          ? `<h3>Instrumentation manifest</h3><table class="facts">${factRows([
              ["ADAPTER", `${text(data.instrumentation.adapterId)} ${text(data.instrumentation.adapterVersion, "")}`.trim()],
              ["MANIFEST VERSION", text(data.instrumentation.manifestVersion)],
              ["STATUS", text(data.instrumentation.status)],
              ["RISK", text(data.instrumentation.risk)],
              ["VALIDATED", dateText(data.instrumentation.validatedAt, "Not validated")],
            ])}</table>`
          : ""
      }
    </section>

    ${renderAutomated(data)}

    <section class="major"><div class="section-label">Section // Findings index</div><h2>${data.hasFlow ? "Every finding in this Flow" : "Session findings"}</h2>
      ${
        indexRows
          ? `<p>Ordered by priority, as the analysis ranked them. Each one is written out in full after this index.</p><table class="index">${indexRows}</table>`
          : `<p>The deterministic analysis found no ${data.hasFlow ? "in-Flow" : "session"} finding for this run.</p>`
      }
      ${
        data.recommendations.length
          ? `<h3>Recommended next actions</h3><p>The ${data.recommendations.length} the analysis prioritised highest, in order.</p><table class="index">${data.recommendations
              .map(
                (item, index) =>
                  `<tr><td>${String(index + 1).padStart(2, "0")}</td><td><span class="sev ${escapeHtml(
                    text(item.priority, "MEDIUM").toLowerCase(),
                  )}">${escapeHtml(text(item.priority, "MEDIUM"))}</span></td><td><strong>${escapeHtml(
                    text(item.title ?? item.suggestedAction, "Recommended improvement"),
                  )}</strong><small>${escapeHtml(text(item.suggestedAction, ""))}</small></td></tr>`,
              )
              .join("")}</table>`
          : ""
      }
      <h3>How to read priority</h3>
      <table class="facts">${factRows([
        ["CRITICAL / HIGH", "Blocks or breaks the declared Flow. Address it before relying on this Flow in a release."],
        ["MEDIUM", "The Flow was not fully verified, or it degraded. Plan to address it."],
        ["LOW / INFO", "For awareness. It may be intentional, or it limits what this run could see."],
      ])}</table>
      <p class="muted">Confidence reflects how a finding was established: a deterministic rule over accepted evidence scores highest; an AI-assisted suggestion is published only when its references to states, transitions, and evidence ids were verified against this run.</p>
      <h3>Two different severity scales</h3>
      <p>Tellann priority (CRITICAL/HIGH/MEDIUM/LOW/INFO, used throughout this document) ranks findings by how much they affect this run's declared Flow or session. Where a finding comes from automated tooling — the accessibility scanner's own impact rating (critical/serious/moderate/minor) — that is a different scale, scoped to the single rule it flags. A tool rating of "critical" does not by itself raise Tellann's priority for the finding derived from it; "0 critical findings" and "2 critical accessibility rules" appearing in the same report is not a contradiction.</p>
    </section>

    ${renderTrend(data)}

    ${data.findings.map((finding, index) => renderFinding(finding, index, input.screenshots)).join("")}

    ${data.hasFlow ? `<section class="major"><div class="section-label">Section // Outside the Flow</div><h2>Risks outside the selected Flow</h2>
      ${
        data.criticalFindings.length
          ? `<p>High-severity failures captured while the run was in progress but outside the declared boundary. They did not affect the coverage figure, and they are still real.</p>${data.criticalFindings
              .map(
                (item) =>
                  `<h3>${escapeHtml(text(item.title, "Critical finding"))}</h3><p>${escapeHtml(
                    text(item.impact ?? item.rationale, "Review the linked evidence."),
                  )}</p><table class="facts">${factRows([
                    ["PRIORITY", text(item.priority, "HIGH")],
                    ["SOURCE", text(item.generator, "RULES")],
                    ["CONFIDENCE", confidencePercent(item.confidence)],
                    ["NEXT STEP", text(item.suggestedAction, "Investigate immediately.")],
                  ])}</table>`,
              )
              .join("")}`
          : "<p>No high-confidence, high-severity out-of-Flow failure was recorded during this run.</p>"
      }
    </section>` : ""}

    ${renderFrontend(data)}
    ${renderBackend(data)}
    ${renderAnnotations(data, input.screenshots)}
    ${renderAppendix(data)}

    <div class="footer">Tellann quality report — generated by Tellann Desktop from the immutable report of run ${escapeHtml(
      text(report.runId, "unknown"),
    )}. Captured values stay masked; no credential, token, or protected value is included in this document.</div>
  </section></main></body></html>`;
}

export function renderQualityReportPdf(input: QualityReportDocumentInput): Promise<Buffer> {
  return renderHtmlToPdf(qualityReportHtml(input));
}

function csvCell(value: unknown): string {
  return `"${String(value ?? "").replace(/"/g, '""').replace(/[\r\n]+/g, " ")}"`;
}

function csvRow(cells: unknown[]): string {
  return `${cells.map(csvCell).join(",")}\n`;
}

/** The same report as a flat table, for a spreadsheet or a pipeline. */
export function qualityReportCsv(input: QualityReportDocumentInput): string {
  const { report } = input;
  const data = readReport(report);
  let csv = csvRow(["Section", "Item", "Priority/Value", "Detail"]);
  csv += csvRow(["Report", "Application", text(data.application.name), text(report.runId)]);
  csv += csvRow(["Report", "Environment", text(data.environment.name), text(data.environment.type)]);
  if (data.hasFlow) csv += csvRow([
    "Report",
    "Flow",
    flowTitle(data),
    `version ${text(data.flowSummary.version ?? data.flow.version, "legacy")}`,
  ]);
  csv += csvRow(["Report", "Generated", dateText(report.generatedAt), `document ${dateText(input.generatedAt)}`]);
  if (data.hasFlow) csv += csvRow(["Coverage", "Expected coverage", coverageText(data), ""]);
  csv += csvRow(["Coverage", "Observed states", text(data.summary.observedStateCount, "0"), ""]);
  csv += csvRow(["Coverage", "Observed transitions", text(data.summary.observedTransitionCount, "0"), ""]);
  csv += csvRow([
    "Run",
    "Target",
    text(data.runSummary.url),
    text(data.runSummary.boundaryOutcome ?? report.status),
  ]);
  csv += csvRow([
    "Run",
    "Duration",
    durationText(data.runSummary.durationMs),
    joined(data.runSummary.captureTracks, ""),
  ]);
  if (!data.backendOnly) csv += csvRow(["Run", "Window resolution", windowResolution(data), ""]);
  for (const [type, count] of Object.entries(data.eventCounts)) {
    csv += csvRow(["Evidence", eventLabel(type), String(Number(count)), ""]);
  }
  for (const finding of data.findings) {
    csv += csvRow([
      "Finding",
      text(finding.title ?? finding.suggestedAction, "Finding"),
      text(finding.priority, "MEDIUM"),
      `${text(finding.impact ?? finding.rationale, "")} Next step: ${text(
        finding.suggestedAction,
        "",
      )} (state ${text(finding.affectedState, "not linked")}, transition ${text(
        finding.affectedTransition,
        "not linked",
      )}, confidence ${confidencePercent(finding.confidence)})`,
    ]);
    const resolution = asRecord(finding.resolution);
    if (text(resolution.summary, "")) {
      csv += csvRow([
        "Suggested resolution",
        text(finding.title ?? finding.suggestedAction, "Finding"),
        confidencePercent(resolution.confidence),
        `${text(resolution.summary, "")} Most likely cause: ${text(resolution.likelyCause, "")} Steps: ${asArray(resolution.steps).map((step) => String(step)).join(" | ")}`,
      ]);
    }
  }
  for (const caveat of data.coverageCaveats) {
    csv += csvRow(["Coverage caveat", caveat, text(data.coverage.confidenceBand, ""), ""]);
  }
  for (const state of data.hasFlow ? data.missingStates : []) {
    csv += csvRow([
      "Coverage gap",
      `Declared state not observed: ${text(state.name ?? state.key, "state")}`,
      text(state.role, "NORMAL"),
      text(state.key, ""),
    ]);
  }
  for (const transition of data.hasFlow ? data.missingTransitions : []) {
    csv += csvRow([
      "Coverage gap",
      `Declared transition not observed: ${text(transition.from, "?")} -> ${text(transition.to, "?")}`,
      "",
      text(transition.action, ""),
    ]);
  }
  for (const state of data.hasFlow ? data.unexpectedStates : []) {
    csv += csvRow(["Coverage gap", `Observed state not declared: ${state}`, "", ""]);
  }
  for (const finding of data.hasFlow ? data.criticalFindings : []) {
    csv += csvRow([
      "Outside Flow",
      text(finding.title, "Critical finding"),
      text(finding.priority, "HIGH"),
      `${text(finding.impact ?? finding.rationale, "")} Next step: ${text(finding.suggestedAction, "")}`,
    ]);
  }
  if (data.hasFrontend) {
    const { frontend } = data;
    const network = asRecord(frontend.networkTotals);
    const consoleSummary = asRecord(frontend.console);
    const accessibility = asRecord(frontend.accessibility);
    const interactions = asRecord(frontend.interactions);
    csv += csvRow([
      "Browser",
      "Routes exercised",
      text(frontend.routesObserved, "0"),
      `${text(consoleSummary.errors, "0")} console errors · ${
        Number(network.failed ?? 0) + Number(network.errors ?? 0)
      } failed requests`,
    ]);
    csv += csvRow([
      "Browser",
      "Worst vital",
      vitalText(frontend.worstVital),
      text(asRecord(frontend.worstVital).route, "No route breached a threshold"),
    ]);
    csv += csvRow([
      "Browser",
      "Interactions",
      `${text(interactions.clicks, "0")} clicks`,
      `${text(interactions.submitted, "0")} submissions · ${text(
        interactions.invalidSubmits,
        "0",
      )} rejected by validation`,
    ]);
    for (const route of data.frontendRoutes) {
      csv += csvRow([
        "Route",
        text(route.route, "/"),
        `${text(route.samples, "0")} samples`,
        `LCP ${percentileText(route.lcpMs)} · CLS ${percentileText(route.cls, "")} · INP ${percentileText(
          route.inpMs,
        )} · data ready ${percentileText(route.dataReadyMs)}`,
      ]);
    }
    for (const row of data.frontendNetwork) {
      csv += csvRow([
        "Resource",
        `${text(row.resourceType, "other")} on ${text(row.route, "/")}`,
        `${text(row.requests, "0")} requests`,
        `${text(row.failed, "0")} failed · p95 ${millisecondText(row.p95Ms, "—")} · ${byteText(
          row.transferredBytes,
        )} transferred`,
      ]);
    }
    for (const rule of data.frontendA11yRules) {
      csv += csvRow([
        "Accessibility",
        `${text(rule.ruleId, "rule")} (${text(rule.impact, "unknown")})`,
        `${text(rule.nodes, "0")} elements`,
        `${text(rule.help, "")} · ${joined(rule.routes, "no route recorded")}`,
      ]);
    }
    for (const group of data.frontendConsoleGroups) {
      csv += csvRow([
        "Console",
        text(group.message, "").slice(0, 200),
        text(group.occurrences, "1"),
        `${text(group.level, "error")} · ${joined(group.routes, "no route recorded")}`,
      ]);
    }
    for (const form of data.frontendForms) {
      csv += csvRow([
        "Form",
        text(form.form, "unnamed form"),
        `${text(form.invalidSubmits, "0")} of ${text(form.submits, "0")} rejected`,
        joined(form.routes, "no route recorded"),
      ]);
    }
    for (const limitation of data.frontendLimitations) {
      csv += csvRow(["Browser limitation", limitation, "", ""]);
    }
  }
  if (data.hasBackend) {
    const { backend } = data;
    csv += csvRow([
      "Backend",
      "Requests handled",
      text(backend.requests, "0"),
      `${text(backend.errors, "0")} failed (${text(backend.serverErrors, "0")} server, ${text(
        backend.clientErrors,
        "0",
      )} client, ${text(backend.unhandledErrors, "0")} unhandled)`,
    ]);
    csv += csvRow([
      "Backend",
      "Response time",
      millisecondText(backend.p95Ms, "—"),
      `median ${millisecondText(backend.p50Ms, "—")} · p99 ${millisecondText(
        backend.p99Ms,
        "—",
      )} · slowest ${millisecondText(backend.slowestMs, "—")}`,
    ]);
    csv += csvRow([
      "Backend",
      "Transferred",
      `${byteText(backend.requestBytes)} in / ${byteText(backend.responseBytes)} out`,
      `${text(backend.payloadsCaptured, "0")} requests retained a payload`,
    ]);
    csv += csvRow(["Backend", "Data operations", text(backend.dataOperations, "0"), ""]);
    for (const endpoint of data.backendEndpoints) {
      csv += csvRow([
        "Endpoint",
        `${text(endpoint.method, "GET")} ${text(endpoint.route, "/")}`,
        text(endpoint.requests, "0"),
        `${text(endpoint.errors, "0")} errors · avg ${millisecondText(
          endpoint.averageMs,
          "—",
        )} · p95 ${millisecondText(endpoint.p95Ms, "—")} · ${statusClassText(
          endpoint.statusClasses,
        )} · models ${joined(endpoint.models, "none recorded")}`,
      ]);
    }
    for (const model of data.backendModels) {
      csv += csvRow([
        "Model",
        text(model.model, "model"),
        `${text(model.reads, "0")} read / ${text(model.writes, "0")} write`,
        `operations ${joined(model.operations, "none recorded")} · endpoints ${joined(
          model.endpoints,
          "none recorded",
        )}`,
      ]);
    }
    for (const group of data.backendErrorGroups) {
      csv += csvRow([
        "Server error",
        `${text(group.name, "Error")} on ${text(group.route, "no route recorded")}`,
        text(group.occurrences, "1"),
        text(group.message, ""),
      ]);
    }
    for (const request of data.backendSlowestRequests) {
      csv += csvRow([
        "Slowest request",
        `${text(request.method, "GET")} ${text(request.route, "/")}`,
        millisecondText(request.durationMs, "—"),
        `status ${text(request.statusCode, "—")} · ${dateText(request.occurredAt, "")}`,
      ]);
    }
  }
  for (const annotation of data.annotations) {
    const resolvedBy = asRecord(annotation.resolvedBy);
    const resolvedDetail = annotation.resolved
      ? ` · resolved${resolvedBy.displayName ? ` by ${text(resolvedBy.displayName)}` : ""}${annotation.resolvedAt ? ` (${dateText(annotation.resolvedAt)})` : ""}`
      : " · unresolved";
    const screenshotDetail = annotation.screenshotArtifactId ? ` · screenshot ${text(annotation.screenshotArtifactId)}` : "";
    csv += csvRow([
      "Annotation",
      text(annotation.comment, ""),
      text(annotation.pin, ""),
      `${text(asRecord(annotation.author).displayName, "QA author")} · ${dateText(annotation.timestamp)} · ${text(
        annotation.route,
        "",
      )}${resolvedDetail}${screenshotDetail}`,
    ]);
  }
  for (const limitation of data.limitations) {
    csv += csvRow(["Limitation", limitation, "", ""]);
  }
  return csv;
}

/** A file name stem that identifies the Flow and the run without leaking a path. */
export function qualityReportFileBase(input: QualityReportDocumentInput): string {
  const data = readReport(input.report);
  const name =
    `${text(data.application.name, "application")}-${data.runTitle || flowTitle(data)}`
      .replace(/[^a-z0-9-]+/gi, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 70) || "quality-report";
  const runId = text(input.report.runId, "").slice(0, 8) || "run";
  return `Tellann-${name}-quality-report-${runId}-${input.generatedAt.slice(0, 10)}`;
}

/** The bytes and file name parts for one entitled download format. */
export async function renderQualityReport(
  input: QualityReportDocumentInput,
  format: QualityReportFormat,
): Promise<{ buffer: Buffer; extension: string; filterName: string }> {
  switch (format) {
    case "PDF":
      return { buffer: await renderQualityReportPdf(input), extension: "pdf", filterName: "PDF report" };
    case "HTML":
      return { buffer: Buffer.from(qualityReportHtml(input), "utf-8"), extension: "html", filterName: "HTML report" };
    case "CSV":
      return { buffer: Buffer.from(qualityReportCsv(input), "utf-8"), extension: "csv", filterName: "CSV table" };
    case "JSON":
      return {
        buffer: Buffer.from(JSON.stringify(input.report, null, 2), "utf-8"),
        extension: "json",
        filterName: "JSON report",
      };
  }
}
