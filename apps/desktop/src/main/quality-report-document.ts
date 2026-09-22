import { escapeHtml, renderHtmlToPdf, TELLANN_LOGO_SVG } from "./validation-report";

/**
 * The comprehensive quality report a user downloads.
 *
 * The report page in the app shows the summary and the finding titles only.
 * Everything the run produced — every finding with its evidence, the declared
 * coverage gaps, the risks outside the Flow, annotations, and the capture
 * appendix — is written here, in the same Tellann watermarked page design the
 * codebase risk report uses, so a downloaded report is recognisable as ours
 * whichever part of the product produced it.
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
};

export type QualityReportFormat = "JSON" | "PDF" | "CSV" | "HTML";

const EVENT_LIMIT = 250;

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
  const viewportHistory = records(runSummary.viewportHistory);
  return {
    // Payloads before session-scoped QA existed were all Flow reports and did
    // not carry scopeKind. Preserve that legacy interpretation; new flowless
    // reports identify themselves explicitly as SESSION.
    hasFlow: report.scopeKind !== "SESSION",
    application: asRecord(report.application),
    environment: asRecord(report.environment),
    summary: asRecord(report.summary),
    coverage: asRecord(report.coverage),
    repository: asRecord(report.repository),
    instrumentation: asRecord(report.instrumentation),
    correlation: asRecord(report.correlation),
    flow,
    flowSummary,
    runSummary,
    viewportHistory,
    latestViewport: asRecord(viewportHistory.at(-1)),
    eventCounts: asRecord(runSummary.eventCounts),
    recommendations: records(inFlow.recommendedNextActions),
    findings: records(inFlow.findings),
    missingStates: records(inFlow.missingStates),
    missingTransitions: records(inFlow.missingTransitions),
    unexpectedStates: asArray(inFlow.unexpectedStates).map((item) => String(item)),
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

/** One finding, with everything the app's summary leaves out. */
function renderFinding(item: Record<string, unknown>, index: number): string {
  const priority = text(item.priority, "MEDIUM");
  const reproduction = asArray(item.reproductionPath).map((step) => String(step)).filter(Boolean);
  const evidenceIds = asArray(item.evidenceIds).map((id) => String(id)).filter(Boolean);
  const rationale = text(item.rationale, "");
  const impact = text(item.impact ?? item.rationale, "Review the linked evidence.");
  return `<section class="finding">
    <div class="section-label">Finding ${String(index + 1).padStart(2, "0")}</div>
    <div class="finding-head"><span class="sev ${escapeHtml(priority.toLowerCase())}">${escapeHtml(
      priority,
    )}</span><h2>${escapeHtml(text(item.title ?? item.suggestedAction, "Recommended improvement"))}</h2></div>
    <h3>Why it matters</h3><p>${escapeHtml(impact)}</p>
    ${rationale && rationale !== impact ? `<h3>What the evidence shows</h3><p>${escapeHtml(rationale)}</p>` : ""}
    <h3>Next step</h3><p>${escapeHtml(text(item.suggestedAction, "Investigate and repeat the affected step."))}</p>
    <h3>Expected outcome</h3><p>${escapeHtml(text(item.expectedOutcome, "The Flow completes reliably."))}</p>
    <table class="facts">${factRows([
      ["SOURCE", text(item.generator, "RULES")],
      ["CONFIDENCE", confidencePercent(item.confidence)],
      ["EFFORT", text(item.effort, "Unknown")],
      ["AFFECTED STATE", text(item.affectedState, "Not linked to one state")],
      ["AFFECTED TRANSITION", text(item.affectedTransition, "Not linked to one transition")],
      ["SCOPE", text(item.scope, "IN_FLOW")],
    ])}</table>
    ${
      reproduction.length
        ? `<h3>Reproduction path</h3><ol>${reproduction.map((step) => `<li>${escapeHtml(step)}</li>`).join("")}</ol>`
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

function renderAnnotations(data: ReadReport): string {
  if (!data.annotations.length) {
    return `<section class="major"><div class="section-label">Section // Annotations</div><h2>Inspect-mode feedback</h2>
      <p>No annotations were pinned during this run.</p></section>`;
  }
  const rows = data.annotations
    .map((annotation) => {
      const author = asRecord(annotation.author);
      const mentioned = records(annotation.mentionedTeammates)
        .map((member) => `@${text(member.displayName, "member")}`)
        .join(", ");
      return `<tr><td>${escapeHtml(text(annotation.pin, "•"))}</td><td><strong>${escapeHtml(
        text(annotation.comment, ""),
      )}</strong><small>${escapeHtml(
        `${text(author.displayName, "QA author")} · ${dateText(annotation.timestamp)} · ${text(
          annotation.route,
          "unknown route",
        )} · state ${text(annotation.flowState, "outside boundary")}${mentioned ? ` · mentioned ${mentioned}` : ""}`,
      )}</small></td></tr>`;
    })
    .join("");
  return `<section class="major"><div class="section-label">Section // Annotations</div><h2>Inspect-mode feedback</h2>
    <p>Comments pinned to elements while the run was being captured, in the order they were added.</p>
    <table class="index annotations">${rows}</table></section>`;
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
    <p>The capture this report was derived from. Values read from the page stay masked here: a protected value is revealed only in the app, one at a time, rate limited and audited, and is never written to a downloaded file.</p>
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
  const title = data.hasFlow ? `${flowTitle(data)} quality report` : "Observational QA report";
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
    .watermark{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:460px;height:460px;pointer-events:none;opacity:0.05;z-index:0}
    .watermark svg{width:100%;height:100%;display:block}
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
  </style></head><body><div class="watermark">${TELLANN_LOGO_SVG}</div><main><section class="sheet">
    <div class="brand"><div class="logo">TELLANN</div><span class="badge">Quality // QA run report</span></div>
    <h1>${escapeHtml(title)}</h1>
    <p class="muted">${data.hasFlow ? "Everything this QA run established: what the Flow declared, what the run observed, every finding with its evidence, the risks found outside the Flow, and the capture record behind them." : "Everything this observational session established: what the run captured, every evidence-backed finding, annotations, artifacts, and the auditable capture record behind them."}</p>
    <div class="summary"><div class="metric">${data.findings.length} finding${
      data.findings.length === 1 ? "" : "s"
    }${data.hasFlow ? " in this Flow" : " in this session"}</div><p>${escapeHtml(
      `${counts.CRITICAL} critical · ${counts.HIGH} high · ${counts.MEDIUM} medium · ${counts.LOW} low · ${counts.INFO} info${data.hasFlow ? ` · ${data.criticalFindings.length} critical outside the Flow` : ""}`,
    )}</p></div>
    <div class="metrics">
      ${data.hasFlow ? `<div><span>Expected coverage</span><strong>${escapeHtml(expectedCoverage)}</strong></div>` : ""}
      <div><span>Observed states</span><strong>${escapeHtml(text(data.summary.observedStateCount, "0"))}</strong></div>
      <div><span>Transitions</span><strong>${escapeHtml(text(data.summary.observedTransitionCount, "0"))}</strong></div>
      <div><span>High priority</span><strong>${escapeHtml(text(data.summary.criticalOrHighFindings, "0"))}</strong></div>
    </div>
    ${
      data.runSummary.captureDegraded
        ? '<div class="notice"><strong>Capture was degraded.</strong> Read the limitations in the evidence appendix before relying on the coverage figure in this report.</div>'
        : ""
    }
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
      ])}</table>
    </section>` : ""}

    <section class="major"><div class="section-label">Section // Run</div><h2>How the run was captured</h2>
      <table class="facts">${factRows([
        ["TARGET", text(data.runSummary.url)],
        [
          "ENVIRONMENT",
          `${text(asRecord(data.runSummary.environment).name ?? data.environment.name)} · ${text(
            asRecord(data.runSummary.environment).type ?? data.environment.type,
          )}`,
        ],
        ["CAPTURE TRACKS", joined(data.runSummary.captureTracks ?? report.captureTracks, "Not recorded")],
        ["DURATION", durationText(data.runSummary.durationMs)],
        ["BOUNDARY OUTCOME", text(data.runSummary.boundaryOutcome ?? report.status)],
        [
          "INSTRUMENTATION",
          data.runSummary.instrumentationAvailable
            ? "Validated instrumentation attached"
            : "Browser-level evidence only",
        ],
        ["FRAMEWORK STATE EVIDENCE", data.runSummary.frameworkStateEvidenceCaptured ? "Captured" : "Not captured"],
        ["WINDOW RESOLUTION", windowResolution(data)],
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
    </section>

    ${data.findings.map((finding, index) => renderFinding(finding, index)).join("")}

    ${data.hasFlow ? renderGaps(data) : ""}

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

    ${renderAnnotations(data)}
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
  csv += csvRow(["Run", "Window resolution", windowResolution(data), ""]);
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
  for (const annotation of data.annotations) {
    csv += csvRow([
      "Annotation",
      text(annotation.comment, ""),
      text(annotation.pin, ""),
      `${text(asRecord(annotation.author).displayName, "QA author")} · ${dateText(annotation.timestamp)} · ${text(
        annotation.route,
        "",
      )}`,
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
    `${text(data.application.name, "application")}-${flowTitle(data)}`
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
