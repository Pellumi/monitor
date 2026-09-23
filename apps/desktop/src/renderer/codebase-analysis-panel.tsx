import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { CodebaseAnalysis, CodebaseFinding } from "@tellann/desktop-contracts";
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Download,
  FolderOpen,
  Info,
  Loader2,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { useDesktop } from "./desktop-context";

/**
 * Codebase analysis exists to power Tellann's own assistance, not to be browsed.
 * The full graph (entities, relationships, features, architecture, coverage) is
 * still built and persisted by the main process and served to internal callers
 * through `codebaseQuery`; this panel shows only the summary and the risks, with
 * the detail for each risk delivered as a downloadable report.
 */

const ACTIVE = new Set([
  "QUEUED",
  "INGESTING",
  "PARSING",
  "LINKING",
  "GRAPHING",
  "DISCOVERING_FEATURES",
  "ANALYZING_ARCHITECTURE",
  "SUMMARIZING",
]);

const STAGE_LABEL: Record<string, string> = {
  QUEUED: "Queued",
  INGESTING: "Reading the snapshot",
  PARSING: "Parsing source",
  LINKING: "Resolving references",
  GRAPHING: "Building the graph",
  DISCOVERING_FEATURES: "Discovering functionality",
  ANALYZING_ARCHITECTURE: "Analysing architecture",
  SUMMARIZING: "Preparing results",
};

type Severity = CodebaseFinding["severity"];

// Highest severity first, so a HIGH risk is never listed below INFO noise.
const SEVERITY_RANK: Record<Severity, number> = { HIGH: 2, WARNING: 1, INFO: 0 };
const SEVERITY_LABEL: Record<Severity, string> = {
  HIGH: "High",
  WARNING: "Warning",
  INFO: "Info",
};

const DOMAIN_LIMIT = 6;
const LANGUAGE_LIMIT = 4;
const RISK_PREVIEW_LIMIT = 3;
const NO_FINDINGS: CodebaseFinding[] = [];

/** Data and documentation formats, left out of the language breakdown. */
const NON_CODE_LANGUAGES = new Set([
  "json", "jsonc", "markdown", "md", "mdx", "yaml", "yml", "toml", "ini",
  "csv", "tsv", "text", "txt", "plaintext", "xml", "svg", "lock",
]);

function languageKey(language: string) {
  return language.toLowerCase().replace(/[^a-z]/g, "");
}

type LanguageShare = { language: string; key: string; share: number };

/**
 * Each language's share of the project's *code*. JSON, Markdown and similar
 * formats are excluded — a large fixture or lockfile would otherwise make a
 * JavaScript app look half data. Anything past the top few is grouped as Other.
 */
function languageShares(bytesByLanguage: Record<string, number>): LanguageShare[] {
  const all = Object.entries(bytesByLanguage).filter(([, bytes]) => bytes > 0);
  const code = all.filter(([language]) => !NON_CODE_LANGUAGES.has(languageKey(language)));
  // A repository of only docs or config still gets a breakdown.
  const entries = (code.length ? code : all).sort(([, left], [, right]) => right - left);
  const total = entries.reduce((sum, [, bytes]) => sum + bytes, 0);
  if (!total) return [];
  const shown = entries.slice(0, LANGUAGE_LIMIT).map(([language, bytes]) => ({
    language,
    key: languageKey(language),
    share: (bytes / total) * 100,
  }));
  const rest = entries.slice(LANGUAGE_LIMIT).reduce((sum, [, bytes]) => sum + bytes, 0);
  return rest ? [...shown, { language: "Other", key: "other", share: (rest / total) * 100 }] : shown;
}

function formatShare(share: number) {
  return share < 1 ? "<1%" : `${Math.round(share)}%`;
}

/**
 * A limit of the analysis itself (dynamic dispatch it could not follow), not a
 * problem in the user's code, so it is shown as a note rather than as a risk.
 */
function isAnalysisLimit(finding: CodebaseFinding) {
  return finding.kind === "DYNAMIC_CODE";
}

function sortRisks(findings: CodebaseFinding[]) {
  return [...findings].sort(
    (left, right) =>
      SEVERITY_RANK[right.severity] - SEVERITY_RANK[left.severity] ||
      left.title.localeCompare(right.title),
  );
}

/** Snapshots analysed before the analyser pluralised this title still say "module(s)". */
function displayFindingTitle(title: string) {
  return title.replace(/^(\d+) module\(s\) are never imported$/, (_match, count: string) =>
    count === "1" ? "1 module is never imported" : `${count} modules are never imported`,
  );
}

/**
 * The branch matters because of the QA review branch rule. A repository with no
 * commits has a branch but no revision, so "no revision" alone never means
 * "not a repository" — only the absence of any `.git` directory does.
 */
function sourceLabel(analysis: CodebaseAnalysis, gitDetected: boolean) {
  const revision = analysis.revision ? analysis.revision.slice(0, 7) : null;
  if (analysis.branch) {
    return revision ? `${analysis.branch} · ${revision}` : `${analysis.branch} · no commits yet`;
  }
  if (revision) return `Detached at ${revision}`;
  return gitDetected ? "Git details unavailable" : "Not a Git repository";
}

const RELATIVE_TIME = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

function formatRelative(iso: string) {
  const seconds = Math.round((new Date(iso).getTime() - Date.now()) / 1000);
  if (Number.isNaN(seconds)) return "";
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["day", 86_400],
    ["hour", 3_600],
    ["minute", 60],
  ];
  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size) return RELATIVE_TIME.format(Math.round(seconds / size), unit);
  }
  return "just now";
}

/** Electron prefixes errors thrown across IPC with the channel name. */
function ipcErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) return fallback;
  return error.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, "");
}

function Metric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="analysis-metric" title={hint}>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function AnalysisSummary({ analysis }: { analysis: CodebaseAnalysis }) {
  const languages = useMemo(
    () => languageShares(analysis.coverage?.languageBytes ?? {}),
    [analysis.coverage],
  );

  const domains = analysis.architecture?.domains ?? [];
  const hiddenDomains = domains.length - DOMAIN_LIMIT;
  const coverage = Math.round(
    Math.min(Math.max(analysis.summary.coveragePercent, 0), 100),
  );
  const { summary } = analysis;
  // Source files always shows; a zero anywhere else says nothing about this
  // project (a frontend has no endpoints or data models).
  const metrics: Array<{ label: string; value: number; hint?: string; always?: boolean }> = [
    { label: "Source files", value: summary.files, always: true },
    {
      label: "Entry points",
      value: summary.features,
      hint: "Routes, UI actions, endpoints and jobs Tellann traced through your code.",
    },
    { label: "Endpoints", value: summary.endpoints },
    { label: "Data models", value: summary.dataModels },
    { label: "External systems", value: summary.externalServices },
  ];

  return (
    <>
      <div className="analysis-metrics compact">
        {metrics
          .filter((metric) => metric.always || metric.value > 0)
          .map((metric) => (
            <Metric
              key={metric.label}
              label={metric.label}
              value={metric.value.toLocaleString()}
              hint={metric.hint}
            />
          ))}
      </div>
      <dl className="analysis-summary-facts">
        <div>
          <dt>Coverage</dt>
          <dd>
            <div
              className="analysis-coverage-bar"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={coverage}
              aria-label="Share of files the deep analyzers reached"
            >
              <span style={{ width: `${coverage}%` }} />
            </div>
            <p className="analysis-fact-caption">{coverage}% of files analysed</p>
          </dd>
        </div>
        <div>
          <dt>Languages</dt>
          <dd>
            {languages.length ? (
              <>
                <div
                  className="analysis-language-bar"
                  role="img"
                  aria-label={`Language distribution: ${languages
                    .map((item) => `${item.language} ${formatShare(item.share)}`)
                    .join(", ")}`}
                >
                  {languages.map((item) => (
                    <span
                      key={item.language}
                      className={`lang-${item.key}`}
                      style={{ width: `${item.share}%` }}
                      title={`${item.language}: ${formatShare(item.share)}`}
                    />
                  ))}
                </div>
                <ul className="analysis-legend">
                  {languages.map((item) => (
                    <li key={item.language}>
                      <span className={`analysis-legend-dot lang-${item.key}`} />
                      <span className="analysis-legend-label">{item.language}</span>
                      <span className="analysis-legend-pct">{formatShare(item.share)}</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              "Not recorded"
            )}
          </dd>
        </div>
        {/* <div>
          <dt>Domains</dt>
          <dd>
            {domains.length
              ? `${domains
                  .slice(0, DOMAIN_LIMIT)
                  .map((domain) => domain.name)
                  .join(", ")}${hiddenDomains > 0 ? ` +${hiddenDomains} more` : ""}`
              : "None identified"}
          </dd>
        </div> */}
      </dl>
    </>
  );
}

type ReportState = {
  status: "idle" | "saving" | "saved" | "error";
  message: string | null;
};

/**
 * Downloading the risk report. Lives at the panel level so the collapsed strip
 * and the full notice share one status instead of each losing it on toggle.
 */
function useRiskReport(applicationId: string, findings: CodebaseFinding[]) {
  const [report, setReport] = useState<ReportState>({
    status: "idle",
    message: null,
  });

  // A rescan can change the findings, so a "Saved" message would describe a
  // report of the previous result.
  useEffect(() => {
    setReport({ status: "idle", message: null });
  }, [findings]);

  const downloadReport = useCallback(async () => {
    const save = window.tellann?.projects?.saveCodebaseRiskReport;
    if (!save) {
      setReport({
        status: "error",
        message:
          "Tellann Desktop loaded an older system bridge. Fully close and restart the Desktop app, then download the report again.",
      });
      return;
    }
    setReport({ status: "saving", message: null });
    try {
      const result = await save(applicationId);
      if (result.cancelled) {
        setReport({ status: "idle", message: null });
        return;
      }
      setReport({
        status: "saved",
        message: `Saved ${result.filename ?? "the report"}.`,
      });
    } catch (error) {
      setReport({
        status: "error",
        message: ipcErrorMessage(error, "The risk report could not be generated."),
      });
    }
  }, [applicationId]);

  return { report, downloadReport };
}

/** Secondary by design: the page's primary action is the next setup step. */
function DownloadReportButton({
  report,
  onDownload,
}: {
  report: ReportState;
  onDownload(): void;
}) {
  const saving = report.status === "saving";
  return (
    <button
      className="analysis-btn-secondary analysis-btn-outline"
      onClick={onDownload}
      disabled={saving}
    >
      {saving ? <Loader2 size={13} className="spin" /> : <Download size={13} />}
      {saving ? "Preparing…" : "Download report"}
    </button>
  );
}

function ReportStatus({ report }: { report: ReportState }) {
  if (!report.message) return null;
  return (
    <p
      className={`analysis-risk-report-status${report.status === "error" ? " is-error" : ""}`}
    >
      {report.message}
    </p>
  );
}

function riskSummary(risks: CodebaseFinding[]) {
  if (!risks.length) return "No risks detected";
  const high = risks.filter((finding) => finding.severity === "HIGH").length;
  return `${risks.length} risk${risks.length === 1 ? "" : "s"}${high ? ` (${high} high)` : ""}`;
}

/**
 * Tells the user risks exist and names the most severe few. What a risk means,
 * the code it reaches, and how to fix it live in the report rather than on screen.
 */
function RiskNotice({
  risks,
  report,
  onDownload,
}: {
  /** Already sorted, most severe first, with analysis limits removed. */
  risks: CodebaseFinding[];
  report: ReportState;
  onDownload(): void;
}) {
  if (!risks.length) {
    return (
      <p className="analysis-clear analysis-risk-clear">
        <ShieldCheck size={14} />
        No risks were detected in this snapshot.
      </p>
    );
  }

  const breakdown = (["HIGH", "WARNING", "INFO"] as const)
    .map((severity) => ({
      severity,
      count: risks.filter((finding) => finding.severity === severity).length,
    }))
    .filter((item) => item.count)
    .map((item) => `${item.count} ${SEVERITY_LABEL[item.severity].toLowerCase()}`)
    .join(" · ");
  const hidden = risks.length - RISK_PREVIEW_LIMIT;

  return (
    <section
      className={`analysis-risk-notice severity-${risks[0].severity.toLowerCase()}`}
      role="alert"
      aria-label="Codebase risks"
    >
      <div className="analysis-risk-notice-head">
        <AlertTriangle size={18} />
        <div>
          <h3>
            {risks.length} risk{risks.length === 1 ? "" : "s"} detected
          </h3>
          <p>
            {breakdown}. The report explains each risk, the code it affects,
            and how to address it.
          </p>
        </div>
        <DownloadReportButton report={report} onDownload={onDownload} />
      </div>
      <ol className="analysis-risk-titles">
        {risks.slice(0, RISK_PREVIEW_LIMIT).map((finding) => (
          <li key={finding.id}>
            <span
              className={`analysis-risk-severity severity-${finding.severity.toLowerCase()}`}
            >
              {SEVERITY_LABEL[finding.severity]}
            </span>
            <span className="analysis-risk-title">
              {displayFindingTitle(finding.title)}
            </span>
          </li>
        ))}
      </ol>
      {hidden > 0 ? (
        <p className="analysis-risk-more">+{hidden} more in the report</p>
      ) : null}
      <ReportStatus report={report} />
    </section>
  );
}

/** The collapsed view: one line of what matters, with the details a click away. */
function AnalysisStrip({
  analysis,
  risks,
  report,
  onDownload,
  onExpand,
}: {
  analysis: CodebaseAnalysis;
  risks: CodebaseFinding[];
  report: ReportState;
  onDownload(): void;
  onExpand(): void;
}) {
  const language = languageShares(analysis.coverage?.languageBytes ?? {})[0]?.language;
  const files = analysis.summary.files;
  const summary = [
    riskSummary(risks),
    `${files.toLocaleString()} file${files === 1 ? "" : "s"}`,
    language && language !== "Other" ? language : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const tone = risks.length ? risks[0].severity.toLowerCase() : "clear";

  return (
    <div className={`analysis-strip tone-${tone}`}>
      <div className="analysis-strip-row">
        <span className="analysis-strip-summary">
          {risks.length ? <AlertTriangle size={15} /> : <ShieldCheck size={15} />}
          {summary}
        </span>
        <div className="analysis-strip-actions">
          <button
            className="analysis-link-btn"
            onClick={onExpand}
            aria-expanded={false}
          >
            View details
            <ChevronDown size={13} />
          </button>
          {risks.length ? (
            <DownloadReportButton report={report} onDownload={onDownload} />
          ) : null}
        </div>
      </div>
      <ReportStatus report={report} />
    </div>
  );
}

// ── Shell ────────────────────────────────────────────────────────────────────

/**
 * The worker reports a folder it cannot open as a raw `ENOENT` against a path
 * it has already redacted to `[workspace]`, which tells the reader nothing and
 * cannot be fixed by retrying — the folder has to be attached again.
 */
function isMissingWorkspaceFailure(detail: string | null | undefined): boolean {
  return /ENOENT|no such file or directory|WORKSPACE_NOT_ATTACHED/i.test(detail ?? "");
}

/**
 * Every state where the panel has nothing to show: what happened, the technical
 * detail underneath it, and the action that actually resolves it.
 */
function AnalysisStateCard({
  title,
  description,
  detail,
  actions,
}: {
  title: string;
  description: string;
  detail?: string | null;
  actions: ReactNode;
}) {
  return (
    <section className="content-card analysis-shell w-full">
      <div className="analysis-state w-full max-w-none p-0!">
        <h2>{title}</h2>
        <p>{description}</p>
        {detail ? <p className="analysis-state-detail">{detail}</p> : null}
        <div className="analysis-state-actions ml-auto!">{actions}</div>
      </div>
    </section>
  );
}

export function CodebaseAnalysisPanel({
  applicationId,
  collapsible = false,
}: {
  applicationId: string;
  /** Start as a one-line summary with a "View details" toggle (the overview). */
  collapsible?: boolean;
}) {
  const { attachWorkspace, busy } = useDesktop();
  const [state, setState] = useState<CodebaseAnalysisView | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [expanded, setExpanded] = useState(!collapsible);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  // Bumped whenever something starts new work, so polling restarts. Without it
  // a rescan runs in the main process while this view sits on the old result.
  const [reloadToken, setReloadToken] = useState(0);
  const [rescan, setRescan] = useState<{
    busy: boolean;
    message: string | null;
    /** The rescan cannot proceed until a folder is attached again. */
    needsAttach: boolean;
  }>({ busy: false, message: null, needsAttach: false });

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const refresh = async () => {
      try {
        const next =
          await window.tellann?.projects.getCodebaseAnalysis(applicationId);
        if (stopped) return;
        setState(
          next?.analysis
            ? {
                ...next,
                // Local analysis snapshots created before notices were added do
                // not contain this collection. Normalize persisted snapshots at
                // the renderer boundary so opening Workspace remains compatible.
                analysis: {
                  ...next.analysis,
                  warnings: next.analysis.warnings ?? [],
                  notices: next.analysis.notices ?? [],
                },
              }
            : (next ?? null),
        );
        setLoaded(true);
        const status = next?.job?.status ?? next?.analysis?.status;
        // Poll while work is in flight; settle once it is done.
        if (!next || (status && ACTIVE.has(status)))
          timer = setTimeout(refresh, 1_500);
      } catch {
        if (!stopped) {
          setLoaded(true);
          timer = setTimeout(refresh, 5_000);
        }
      }
    };
    void refresh();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }, [applicationId, reloadToken]);

  const cancelAnalysis = useCallback(async () => {
    if (cancelling) return;
    setCancelling(true);
    setCancelError(null);
    try {
      const result = await window.tellann?.projects.cancelCodebaseAnalysis(applicationId);
      if (!result?.cancelled) {
        setCancelError("This analysis is no longer running. Refresh the view and try again.");
        return;
      }
      // Restart polling immediately instead of leaving the old progress card
      // visible until its existing timer happens to fire.
      setReloadToken((value) => value + 1);
    } catch (error) {
      setCancelError(ipcErrorMessage(error, "The analysis could not be cancelled."));
    } finally {
      setCancelling(false);
    }
  }, [applicationId, cancelling]);

  /**
   * Start a fresh analysis of the attached folder. Reports what happened either
   * way: a cloud-backed workspace needs re-attaching so consent is asked against
   * the new revision, and a failure has to be visible rather than swallowed.
   */
  const startRescan = useCallback(async () => {
    setRescan({ busy: true, message: null, needsAttach: false });
    try {
      const result =
        await window.tellann?.projects?.rescanCodebase?.(applicationId);
      if (!result) {
        setRescan({
          busy: false,
          message: "This build of the desktop app cannot start a rescan.",
          needsAttach: false,
        });
        return;
      }
      if (result.requiresReattach) {
        setRescan({
          busy: false,
          message:
            "This workspace sends its source for cloud analysis. Attaching the folder again analyses the current revision, so consent is asked against what would actually be uploaded.",
          needsAttach: true,
        });
        return;
      }
      setRescan({ busy: false, message: null, needsAttach: false });
      setReloadToken((value) => value + 1);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "The rescan could not be started.";
      setRescan({
        busy: false,
        message,
        needsAttach: isMissingWorkspaceFailure(message),
      });
    }
  }, [applicationId]);

  /**
   * Opens the folder picker and restarts polling. Attaching runs a fresh
   * analysis in the main process, so the panel only has to look again.
   */
  const attachFolder = useCallback(async () => {
    const attached = await attachWorkspace(applicationId).catch(() => null);
    if (!attached) return;
    setRescan({ busy: false, message: null, needsAttach: false });
    setReloadToken((value) => value + 1);
  }, [attachWorkspace, applicationId]);

  const analysis = state?.analysis ?? null;
  const status = state?.job?.status ?? analysis?.status ?? null;
  const progress = state?.job?.progress ?? analysis?.progress ?? 0;
  const stageMessage = state?.job?.stageMessage ?? analysis?.stageMessage ?? "";
  const findings = analysis?.findings ?? NO_FINDINGS;
  const risks = useMemo(
    () => sortRisks(findings.filter((finding) => !isAnalysisLimit(finding))),
    [findings],
  );
  const analysisLimited = useMemo(() => findings.some(isAnalysisLimit), [findings]);
  const { report, downloadReport } = useRiskReport(applicationId, findings);

  if (!loaded) {
    return (
      <section className="content-card analysis-shell">
        <p className="analysis-note">
          <Loader2 size={14} className="spin" /> Checking analysis status…
        </p>
      </section>
    );
  }

  if (!state) {
    return (
      <AnalysisStateCard
        title="No code graph yet"
        description="Deep analysis has not run for this application. Attach the project folder to build a versioned code graph from it."
        actions={
          <button
            className="analysis-btn-primary"
            onClick={() => void attachFolder()}
            disabled={busy}
          >
            <FolderOpen size={14} />
            Attach folder
          </button>
        }
      />
    );
  }

  if (state.unreachable) {
    return (
      <section className="content-card analysis-shell">
        <div className="analysis-warning">
          <AlertTriangle size={15} />
          The analysis service could not be reached, so this view may be out of
          date. {state.unreachable}
        </div>
        {analysis ? (
          <p className="analysis-note">
            Showing the last result stored on this device.
          </p>
        ) : null}
      </section>
    );
  }

  // In-flight, whether it is running here or in the cloud.
  if (status && ACTIVE.has(status)) {
    return (
      <section className="content-card analysis-shell p-0!">
        <div className="analysis-progress-head">
          <div>
            {/* <div
              style={{
                display: "flex",
                gap: "8px",
                alignItems: "center",
                marginBottom: "8px",
              }}
            >
              <span className="analysis-badge">
                Codebase //{" "}
                {state.mode === "cloud" ? "Cloud Analysis" : "Local Analysis"}
              </span>
            </div> */}
            <h2>{STAGE_LABEL[status] ?? status}</h2>
            <p>{stageMessage}</p>
          </div>
          <button
            className="analysis-btn-secondary"
            onClick={() => void cancelAnalysis()}
            disabled={cancelling}
          >
            {cancelling ? <Loader2 size={14} className="spin" /> : null}
            {cancelling ? "Cancelling…" : "Cancel"}
          </button>
        </div>
        <div className="analysis-progress">
          <span style={{ width: `${Math.max(progress, 2)}%` }} />
        </div>
        <p className="analysis-note analysis-progress-note">
          {progress}%
          {state.uploadProgress
            ? ` · uploading part ${state.uploadProgress.sent} of ${state.uploadProgress.total}`
            : ""}
          {state.job
            ? ` · attempt ${state.job.attempt} of ${state.job.maxAttempts}`
            : ""}{" "}
          · this continues if you navigate away.
        </p>
        {cancelError ? <div className="analysis-warning"><AlertTriangle size={15} />{cancelError}</div> : null}
        {state.interrupted ? (
          <div className="analysis-warning">
            <AlertTriangle size={15} />
            The previous run stopped when the desktop closed. Cancel this
            interrupted run, then start a new analysis.
          </div>
        ) : null}
      </section>
    );
  }

  if (status === "FAILED") {
    const failure = state.job?.errorMessageSafe ?? analysis?.stageMessage ?? null;
    // A folder that cannot be opened is not something a retry can fix, and the
    // raw ENOENT names a path that was redacted to "[workspace]" on the way
    // here — so it is stated plainly and answered with the picker instead.
    const missingFolder = isMissingWorkspaceFailure(failure);
    const needsAttach = missingFolder || rescan.needsAttach;
    return (
      <AnalysisStateCard
        title={missingFolder ? "The project folder is missing" : "Analysis failed"}
        description={
          missingFolder
            ? "Tellann could not open the folder attached to this application, it has been moved, renamed, or deleted since the last analysis. Attach it again to rebuild the code graph."
            : "The codebase analysis stopped before it finished, so no results were saved from this run."
        }
        detail={rescan.message ?? (missingFolder ? null : failure)}
        actions={
          needsAttach ? (
            <button
              className="analysis-btn-primary"
              onClick={() => void attachFolder()}
              disabled={busy}
            >
              <FolderOpen size={14} />
              Attach folder
            </button>
          ) : (
            <button
              className="analysis-btn-primary"
              onClick={() => void startRescan()}
              disabled={rescan.busy}
            >
              {rescan.busy ? (
                <Loader2 size={14} className="spin" />
              ) : (
                <RefreshCw size={14} />
              )}
              {rescan.busy ? "Starting…" : "Try again"}
            </button>
          )
        }
      />
    );
  }

  // A cancelled run never produced a graph, so the pending record it leaves
  // behind is a stub: showing it as a result would claim an empty repository.
  if (!analysis || (status === "CANCELLED" && !analysis.graphVersion)) {
    return (
      <AnalysisStateCard
        title={status === "CANCELLED" ? "Analysis cancelled" : "No results yet"}
        description={
          status === "CANCELLED"
            ? "This analysis was stopped before it produced a code graph. Start a new one, or attach a different folder."
            : "No analysis results are available for this application yet. Run one against the attached folder to build a code graph."
        }
        detail={rescan.message}
        actions={
          <>
            <button
              className="analysis-btn-primary"
              onClick={() => void startRescan()}
              disabled={rescan.busy || busy}
            >
              {rescan.busy ? (
                <Loader2 size={14} className="spin" />
              ) : (
                <RefreshCw size={14} />
              )}
              {rescan.busy ? "Starting…" : "Run analysis"}
            </button>
            <button
              className="analysis-btn-secondary"
              onClick={() => void attachFolder()}
              disabled={busy}
            >
              <FolderOpen size={14} />
              Attach folder
            </button>
          </>
        }
      />
    );
  }

  const collapsed = collapsible && !expanded;
  return (
    <section className={`content-card analysis-shell${collapsed ? " is-collapsed" : ""}`}>
      <header className="analysis-header p-0! border-none!">
        <div>
          {/* <div
            style={{
              display: "flex",
              gap: "8px",
              alignItems: "center",
              marginBottom: "8px",
            }}
          >
            <span className="analysis-badge">
              Codebase //{" "}
              {analysis.status === "PARTIAL" ? "Partial" : "Complete"}
            </span>
            <span className="analysis-badge">
              {state.mode === "cloud" ? "Cloud" : "Local"}
            </span>
            {analysis.dirty ? (
              <span className="analysis-badge">Uncommitted Changes</span>
            ) : null}
          </div> */}
          <h2>Repository analysis</h2>
          <p>
            {sourceLabel(analysis, state.gitDetected === true)}
            {analysis.completedAt ? (
              <>
                {" · "}
                <time
                  dateTime={analysis.completedAt}
                  title={new Date(analysis.completedAt).toLocaleString()}
                >
                  Analysed {formatRelative(analysis.completedAt)}
                </time>
              </>
            ) : null}
          </p>
        </div>
        <div className="analysis-header-actions">
          {collapsible && expanded ? (
            <button
              className="analysis-link-btn"
              onClick={() => setExpanded(false)}
              aria-expanded
            >
              Hide details
              <ChevronUp size={13} />
            </button>
          ) : null}
          <button
            className="analysis-icon-btn"
            onClick={() => void startRescan()}
            disabled={rescan.busy}
            aria-label="Rescan codebase"
            title="Rescan codebase"
          >
            {rescan.busy ? (
              <Loader2 size={15} className="spin" />
            ) : (
              <RefreshCw size={15} />
            )}
          </button>
        </div>
      </header>

      {rescan.message ? (
        <div className="analysis-warning">
          <Info size={15} />
          {rescan.message}
        </div>
      ) : null}

      {analysis.status === "PARTIAL" && analysis.warnings.length ? (
        <div className="analysis-warning">
          <AlertTriangle size={15} />
          <div>
            <strong>Partial analysis.</strong>{" "}
            {analysis.warnings.length === 1
              ? "One part"
              : `${analysis.warnings.length} parts`}{" "}
            of the repository could not be read, so the summary and risks below
            may be incomplete.
          </div>
        </div>
      ) : null}

      {collapsed ? (
        <AnalysisStrip
          analysis={analysis}
          risks={risks}
          report={report}
          onDownload={() => void downloadReport()}
          onExpand={() => setExpanded(true)}
        />
      ) : (
        <div className="analysis-body p-0! pt-4! min-h-0!">
          <RiskNotice
            risks={risks}
            report={report}
            onDownload={() => void downloadReport()}
          />
          {analysisLimited ? (
            <p className="analysis-limit-note">
              <Info size={14} />
              Some references couldn&apos;t be traced, so results may be incomplete.
            </p>
          ) : null}
          <AnalysisSummary analysis={analysis} />
        </div>
      )}
    </section>
  );
}
