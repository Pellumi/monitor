import type {
  BlastRadiusResult,
  CodebaseAnalysis,
  CodebaseFinding,
  CodeEntity,
} from "@tellann/desktop-contracts";
import { escapeHtml, renderHtmlToPdf, TELLANN_LOGO_SVG } from "./validation-report";

export type CodebaseRiskReportInput = {
  workspaceName: string;
  mode: "cloud" | "local";
  generatedAt: string;
  analysis: CodebaseAnalysis;
  /** Reach of a change to each finding's primary entity, keyed by finding id. */
  blastRadius: Record<string, BlastRadiusResult>;
};

type Severity = CodebaseFinding["severity"];

const SEVERITY_RANK: Record<Severity, number> = { HIGH: 2, WARNING: 1, INFO: 0 };

const SEVERITY_MEANING: Record<Severity, string> = {
  HIGH: "Address before making significant changes in the affected area.",
  WARNING: "Plan to address. It raises the cost and risk of changing this code.",
  INFO: "For awareness. It may be intentional, or it limits what the analysis could see.",
};

const AFFECTED_LIMIT = 30;

/**
 * What each kind of finding means and how it is usually resolved. The analyzer
 * only states what it found; this is what turns that into something a
 * developer can act on without reading the analyzer's source.
 */
const GUIDANCE: Record<
  CodebaseFinding["kind"],
  { category: string; why: string[]; fix: string[] }
> = {
  CYCLE: {
    category: "Circular dependency",
    why: [
      "Every module in the cycle can reach every other, so none of them can be changed, tested, or reused independently.",
      "Import order becomes significant: a value can still be undefined when another module in the cycle reads it, which shows up as intermittent start-up errors.",
      "Bundlers cannot split the group apart, and extracting any one module into its own package means taking the whole cycle with it.",
    ],
    fix: [
      "Find the import that closes the loop, usually the one pointing from a lower-level module back up to a higher-level one.",
      "Move the types, constants, or helpers both sides need into a new module that imports neither of them.",
      "Where one side only needs to call the other, invert the dependency: accept a callback, interface, or injected service instead of importing it.",
      "Add a cycle check to CI (for example the import/no-cycle lint rule or madge --circular) so the cycle does not return.",
    ],
  },
  COUPLING: {
    category: "Coupling hotspot",
    why: [
      "Many modules depend on this one, so any change to its behaviour or exports reaches all of them.",
      "Hotspots concentrate regressions and merge conflicts, and slow reviews because every change needs wide verification.",
    ],
    fix: [
      "Check the reach listed below before changing it, and add tests at its public boundary first so regressions are caught where they start.",
      "Split it by responsibility. Dependents usually use only part of it, and each part can become a smaller module with fewer dependents.",
      "Expose a narrow, stable interface and keep internals private so dependents cannot couple to implementation details.",
      "Avoid adding new dependents until it has been split.",
    ],
  },
  UNRESOLVED_REFERENCE: {
    category: "Unreferenced code",
    why: [
      "Modules that nothing imports are either dead code, which still has to be read, built, and maintained, or are loaded by a mechanism static analysis cannot follow.",
      "If they are loaded dynamically, their impact is missing from reach calculations and discovered feature workflows.",
    ],
    fix: [
      "For each listed module, check whether a framework convention, configuration file, lazy import, or string-based loader reaches it.",
      "Delete the modules that are genuinely unused, then run the build and tests.",
      "For modules loaded dynamically, prefer an explicit import or registration so tooling and reviewers can follow the dependency.",
    ],
  },
  STALE_DOCUMENTATION: {
    category: "Stale documentation",
    why: [
      "An API document describes endpoints that were not found in the code.",
      "Consumers and QA flows built from that document will target endpoints that do not exist, or that behave differently from what is described.",
    ],
    fix: [
      "Confirm whether each endpoint was removed, renamed, or is registered dynamically.",
      "Update or remove the documented paths so the specification matches the implementation, or implement the endpoint if the document is the source of truth.",
      "Where possible, generate the specification from the code so the two cannot drift apart again.",
    ],
  },
  DYNAMIC_CODE: {
    category: "Unresolved call sites",
    why: [
      "A large share of calls could not be traced to a declaration, so execution paths through them are missing from the analysis.",
      "Reach calculations and discovered workflows are understated, and Tellann's assistance for this codebase is less precise.",
    ],
    fix: [
      "Make sure dependencies and their type declarations are installed in the analysed folder, then rescan. Missing types are the most common cause.",
      "Give injected services and factory results explicit types rather than any or untyped objects.",
      "Replace string-keyed dispatch (event names, handler maps, reflection) with typed calls where it is practical.",
    ],
  },
  UNSUPPORTED_LANGUAGE: {
    category: "Limited analysis coverage",
    why: [
      "Some files are written in languages the deep analyzers do not support, so their symbols, calls, and dependencies are not in the graph.",
      "Risks inside those files, and dependencies that cross into them, may not be reported.",
    ],
    fix: [
      "No code change is required.",
      "Review changes in those parts of the repository manually rather than relying on the analysis.",
      "Rescan once support for those languages is available.",
    ],
  },
};

function percent(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}

function location(path: string | null, line: number | null): string {
  if (!path) return "";
  return line ? `${path}:${line}` : path;
}

function list(items: string[]): string {
  return `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function factRows(rows: Array<[string, string]>): string {
  return rows
    .map(
      ([label, value]) =>
        `<tr><td>${escapeHtml(label)}</td><td>${escapeHtml(value)}</td></tr>`,
    )
    .join("");
}

function renderFinding(
  finding: CodebaseFinding,
  index: number,
  input: CodebaseRiskReportInput,
  byId: Map<string, CodeEntity>,
): string {
  const guide = GUIDANCE[finding.kind];
  const severity = finding.severity.toLowerCase();

  const affected = finding.entityIds
    .map((id) => byId.get(id))
    .filter((entity): entity is CodeEntity => Boolean(entity));
  const affectedRows = affected
    .slice(0, AFFECTED_LIMIT)
    .map(
      (entity) =>
        `<tr><td>${escapeHtml(entity.type.replaceAll("_", " "))}</td><td><strong>${escapeHtml(entity.name)}</strong>${entity.path ? `<small>${escapeHtml(location(entity.path, entity.startLine))}</small>` : ""}</td></tr>`,
    )
    .join("");
  const affectedSection = affected.length
    ? `<h3>Affected code</h3><table class="manifest">${affectedRows}</table>${affected.length > AFFECTED_LIMIT ? `<p class="muted">${affected.length - AFFECTED_LIMIT} further item(s) are not listed.</p>` : ""}`
    : "";

  const primaryId = finding.entityIds[0];
  const coupling = primaryId
    ? input.analysis.architecture?.coupling.find((record) => record.entityId === primaryId) ??
      input.analysis.architecture?.hotspots.find((record) => record.entityId === primaryId)
    : undefined;
  const couplingSection =
    finding.kind === "COUPLING" && coupling
      ? `<h3>Coupling measurements</h3><table class="facts">${factRows([
          ["DEPENDED ON BY", `${coupling.fanIn} module(s)`],
          ["DEPENDS ON", `${coupling.fanOut} module(s)`],
          ["INSTABILITY", `${coupling.instability.toFixed(2)} (0 = only depended on, 1 = only depends on others)`],
          ["CENTRALITY", coupling.centrality.toFixed(2)],
        ])}</table>`
      : "";

  const radius = input.blastRadius[finding.id];
  const radiusSubject = primaryId ? byId.get(primaryId) : undefined;
  const radiusSection = radius
    ? `<h3>What a change could reach</h3><p>Following incoming dependencies from ${escapeHtml(radiusSubject?.path ?? radiusSubject?.name ?? "the primary module")}, a change there could affect:</p><table class="facts">${factRows([
        ["MODULES", String(radius.affected.modules)],
        ["FUNCTIONS", String(radius.affected.functions)],
        ["ENDPOINTS", String(radius.affected.endpoints)],
        ["JOBS", String(radius.affected.jobs)],
        ["TESTS", String(radius.affected.tests)],
        ["FEATURES", String(radius.affected.features)],
      ])}</table>${radius.truncated ? '<p class="muted">The traversal was capped, so the true reach is larger.</p>' : ""}`
    : "";

  const evidenceRows = finding.evidence
    .map(
      (item) =>
        `<tr><td>${escapeHtml(item.kind.replaceAll("-", " "))}</td><td><strong>${escapeHtml(location(item.path, item.startLine))}</strong><small>Analyzer: ${escapeHtml(item.analyzer)} · confidence ${percent(item.confidence)}${item.symbol ? ` · symbol ${escapeHtml(item.symbol)}` : ""}</small>${item.excerpt ? `<pre>${escapeHtml(item.excerpt)}</pre>` : ""}</td></tr>`,
    )
    .join("");
  const evidenceSection = finding.evidence.length
    ? `<h3>Evidence</h3><table class="manifest">${evidenceRows}</table>`
    : '<h3>Evidence</h3><p class="muted">This is a derived result with no single source location; it follows from the relationships across the code graph.</p>';

  return `<section class="risk">
    <div class="section-label">Risk ${String(index + 1).padStart(2, "0")} // ${escapeHtml(guide.category)}</div>
    <div class="risk-head"><span class="sev ${severity}">${escapeHtml(finding.severity)}</span><h2>${escapeHtml(finding.title)}</h2></div>
    <div class="notice"><strong>Severity: ${escapeHtml(finding.severity)}.</strong> ${escapeHtml(SEVERITY_MEANING[finding.severity])}</div>
    <h3>What was found</h3><p>${escapeHtml(finding.description)}</p>
    <h3>Why it matters</h3>${list(guide.why)}
    ${affectedSection}${couplingSection}${radiusSection}
    <h3>How to address it</h3><ol>${guide.fix.map((step) => `<li>${escapeHtml(step)}</li>`).join("")}</ol>
    ${evidenceSection}
  </section>`;
}

export function codebaseRiskReportHtml(input: CodebaseRiskReportInput): string {
  const { analysis } = input;
  const findings = [...analysis.findings].sort(
    (left, right) =>
      SEVERITY_RANK[right.severity] - SEVERITY_RANK[left.severity] ||
      left.title.localeCompare(right.title),
  );
  const byId = new Map(analysis.entities.map((entity) => [entity.id, entity]));
  const counts = { HIGH: 0, WARNING: 0, INFO: 0 };
  for (const finding of findings) counts[finding.severity] += 1;
  const title = `${input.workspaceName} codebase risk report`;
  const coverage = analysis.coverage;

  const snapshotRows = factRows([
    ["WORKSPACE", input.workspaceName],
    ["BRANCH", analysis.branch ?? "Not recorded"],
    ["REVISION", analysis.revision ?? "No Git history"],
    ["WORKING TREE", analysis.dirty ? "Had uncommitted changes when analysed" : "Clean"],
    ["ANALYSED", analysis.completedAt ? new Date(analysis.completedAt).toLocaleString() : "Not recorded"],
    ["ANALYSIS", `${input.mode === "cloud" ? "Cloud" : "Local"} · ${analysis.status === "PARTIAL" ? "partial" : "complete"}`],
    ["COVERAGE", coverage ? `${coverage.analyzedFiles} of ${coverage.analyzableFiles} analysable files (${analysis.summary.coveragePercent}%)` : `${analysis.summary.coveragePercent}%`],
    ["REPORT GENERATED", new Date(input.generatedAt).toLocaleString()],
  ]);

  const indexRows = findings
    .map(
      (finding, index) =>
        `<tr><td>${String(index + 1).padStart(2, "0")}</td><td><span class="sev ${finding.severity.toLowerCase()}">${escapeHtml(finding.severity)}</span></td><td><strong>${escapeHtml(finding.title)}</strong><small>${escapeHtml(GUIDANCE[finding.kind].category)}</small></td></tr>`,
    )
    .join("");

  const unsupported = Object.entries(coverage?.unsupportedLanguageFiles ?? {});
  const limitRows = coverage
    ? factRows([
        ["CALLS RESOLVED IN REPOSITORY", percent(coverage.internalCallRatio)],
        ["CALLS INTO DEPENDENCIES", percent(coverage.externalCallRatio)],
        ["CALLS LEFT UNRESOLVED", percent(coverage.unresolvedCallRatio)],
        ["IMPORTS LEFT UNRESOLVED", percent(coverage.unresolvedImportRatio)],
        ["NOT DEEPLY ANALYSED", unsupported.length ? unsupported.map(([language, count]) => `${language} (${count})`).join(", ") : "None"],
        ["RESULT TRUNCATED", coverage.truncated ? "Yes, repository size limits applied" : "No"],
      ])
    : "";
  const limitsSection = `<section class="major"><div class="section-label">Appendix // Analysis limits</div><h2>What the analysis could not see</h2>
    <p>Static analysis reads the code without running it. Behaviour behind dynamic dispatch, runtime configuration, or unsupported languages is not in the graph, so a clean area is not proof that no risk exists there.</p>
    ${coverage ? `<table class="facts">${limitRows}</table>` : '<p class="muted">Coverage was not recorded for this analysis.</p>'}
    ${analysis.warnings.length ? `<h3>Parts of the repository that could not be read</h3>${list(analysis.warnings)}` : ""}
  </section>`;

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
    .sev.high{color:#fff;background:#111;border-color:#111}
    .sev.warning{color:#111;border-color:#111;background:#ededed}
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
    .summary{border:1px solid #dcdcdc;padding:18px;margin:18px 0}
    .metric{font:22px 'Courier New',monospace;color:#000}
    pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#f6f6f6;border:1px solid #dcdcdc;margin:8px 0 0;padding:10px;color:#333;font:7.5pt/1.45 'Courier New',monospace}
    ul,ol{margin:0 0 12px;padding-left:19px}
    li{margin-bottom:4px}
    .major,.risk{break-before:page}
    .section-label{font:8pt 'Courier New',monospace;color:#666;letter-spacing:.1em;text-transform:uppercase;margin-bottom:8px}
    .risk-head{display:flex;gap:10px;align-items:center;margin-bottom:12px}
    .notice{border-left:3px solid #000;padding:10px 14px;margin:12px 0}
    tr{break-inside:avoid}
    .footer{border-top:1px solid #dcdcdc;margin-top:30px;padding-top:14px;color:#666;font-size:8pt}
  </style></head><body><div class="watermark">${TELLANN_LOGO_SVG}</div><main><section class="sheet">
    <div class="brand"><div class="logo">TELLANN</div><span class="badge">Codebase // Risk report</span></div>
    <h1>${escapeHtml(title)}</h1>
    <p class="muted">Every risk the codebase analysis detected in this snapshot: what was found, why it matters, the code it affects, how far a change could reach, and how to address it.</p>
    <div class="summary"><div class="metric">${findings.length} risk${findings.length === 1 ? "" : "s"} detected</div><p>${counts.HIGH} high · ${counts.WARNING} warning · ${counts.INFO} info</p></div>
    <table class="facts">${snapshotRows}</table>

    <section class="major"><div class="section-label">01 // Risk index</div><h2>All detected risks</h2><p></p>
      <table class="index">${indexRows}</table>
      <h3>How to read severity</h3>
      <table class="facts">${factRows([
        ["HIGH", SEVERITY_MEANING.HIGH],
        ["WARNING", SEVERITY_MEANING.WARNING],
        ["INFO", SEVERITY_MEANING.INFO],
      ])}</table>
      <p class="muted">Evidence confidence reflects how each fact was established: compiler or framework resolution scores highest, syntax and documentation next, and naming or directory heuristics lowest. Verify low-confidence evidence before acting on it.</p>
    </section>

    ${findings.map((finding, index) => renderFinding(finding, index, input, byId)).join("")}
    ${limitsSection}
    <div class="footer">Tellann codebase risk report - generated by Tellann Desktop from the stored analysis of this workspace. Paths are repository-relative; no absolute workspace path, credential, or environment value is included.</div>
  </section></main></body></html>`;
}

export function renderCodebaseRiskReportPdf(
  input: CodebaseRiskReportInput,
): Promise<Buffer> {
  return renderHtmlToPdf(codebaseRiskReportHtml(input));
}
