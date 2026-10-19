"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  Accessibility,
  AlertTriangle,
  Camera,
  ChevronDown,
  Eye,
  ExternalLink,
  FileArchive,
  Route,
} from "lucide-react";
import Link from "next/link";
import { authenticatedFetch } from "@/lib/authenticated-fetch";
import { SeverityTag } from "@/components/dashboard/findings/severity-tag";
import type { FindingSeverity } from "@/components/dashboard/core/types";
import { RunStatusBadge } from "../run-status-badge";
import {
  durationText,
  modeLabel,
  MODE_MEANINGS,
  outcomeSummary,
  pinnedRows,
  reconciliationRows,
  blockedActionRows,
  codeEvidenceEntries,
  describeExecutionPhase,
  easeText,
  effectRows,
  responsiveGrid,
  uiQualityRows,
  retainedTraceRows,
  renderTimingRows,
  unreachedLabel,
} from "./automated-report";
import type { AutomatedSection, OutcomeTone } from "./automated-report";

const SEVERITY_ORDER: FindingSeverity[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"];
const VALID_SEVERITIES = new Set<FindingSeverity>(SEVERITY_ORDER);
function asSeverity(value: string): FindingSeverity {
  return VALID_SEVERITIES.has(value as FindingSeverity) ? (value as FindingSeverity) : "INFO";
}

type Finding = {
  id: string;
  severity: string;
  category: string;
  title: string;
  description: string;
  url: string | null;
};

type FindingGroup = {
  key: string;
  category: string;
  title: string;
  /** The worst severity among this group's occurrences — what the group's own badge shows. */
  severity: FindingSeverity;
  occurrences: Finding[];
};

/** The same underlying issue (same category + title) showing up on several routes is one thing to
 *  fix, not N things to scroll past — grouped here so the review list reads by issue, not by hit. */
function groupFindings(findings: Finding[]): FindingGroup[] {
  const groups = new Map<string, FindingGroup>();
  for (const finding of findings) {
    const key = `${finding.category}::${finding.title}`;
    const severity = asSeverity(finding.severity);
    const existing = groups.get(key);
    if (existing) {
      existing.occurrences.push(finding);
      if (SEVERITY_ORDER.indexOf(severity) < SEVERITY_ORDER.indexOf(existing.severity)) existing.severity = severity;
    } else {
      groups.set(key, { key, category: finding.category, title: finding.title, severity, occurrences: [finding] });
    }
  }
  return [...groups.values()].sort((a, b) => {
    const rankDiff = SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity);
    return rankDiff !== 0 ? rankDiff : b.occurrences.length - a.occurrences.length;
  });
}

const DESCRIPTION_TRUNCATE_LENGTH = 180;
function isLongDescription(description: string): boolean {
  return description.length > DESCRIPTION_TRUNCATE_LENGTH || description.split("\n").length > 2;
}

const ARTIFACT_TYPE_META: Record<string, { label: string; singular: string; icon: typeof Camera }> = {
  SCREENSHOT: { label: "Screenshots", singular: "Screenshot", icon: Camera },
  INSPECT_SCREENSHOT: { label: "Inspection screenshots", singular: "Inspection screenshot", icon: Eye },
  ACCESSIBILITY_SNAPSHOT: { label: "Accessibility snapshots", singular: "Accessibility snapshot", icon: Accessibility },
};
function artifactTypeMeta(artifactType: string) {
  const fallback = artifactType.replace(/_/g, " ").toLowerCase();
  return ARTIFACT_TYPE_META[artifactType] ?? { label: fallback, singular: fallback, icon: FileArchive };
}

type ArtifactCaptureInfo = {
  stateKey?: string;
  route?: string;
  title?: string;
  sequence?: number;
  captureReason?: string;
};

/** The capture-context header a desktop client attaches to an artifact — best-effort, not every artifact carries one. */
function captureInfo(metadata: Record<string, unknown> | null | undefined): ArtifactCaptureInfo {
  if (!metadata) return {};
  return {
    stateKey: typeof metadata.stateKey === "string" ? metadata.stateKey : undefined,
    route: typeof metadata.route === "string" ? metadata.route : undefined,
    title: typeof metadata.title === "string" ? metadata.title : undefined,
    sequence: typeof metadata.sequence === "number" ? metadata.sequence : undefined,
    captureReason: typeof metadata.captureReason === "string" ? metadata.captureReason : undefined,
  };
}

function humanizeStateKey(stateKey: string): string {
  return stateKey.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

const CAPTURE_REASON_LABEL: Record<string, string> = {
  FINDING: "Finding",
  STATE_SETTLED: "State reached",
  RUN_FINAL: "Final state",
  INSPECT_ANNOTATION: "Inspected",
};

/** Groups artifacts by type, and within each type orders them the way the run actually unfolded — by
 *  declared sequence where the capturing client sent one, otherwise by capture time. */
function groupArtifactsByType<T extends { artifactType: string; capturedAt: string; metadata?: Record<string, unknown> | null }>(
  artifacts: T[],
): Array<[string, T[]]> {
  const groups = new Map<string, T[]>();
  for (const artifact of artifacts) {
    const bucket = groups.get(artifact.artifactType);
    if (bucket) bucket.push(artifact);
    else groups.set(artifact.artifactType, [artifact]);
  }
  for (const bucket of groups.values()) {
    bucket.sort((a, b) => {
      const seqA = captureInfo(a.metadata).sequence;
      const seqB = captureInfo(b.metadata).sequence;
      if (seqA != null && seqB != null) return seqA - seqB;
      return new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime();
    });
  }
  return [...groups.entries()].sort((a, b) => b[1].length - a[1].length);
}

type RunDetail = {
  id: string;
  /** Already on the response — GET /qa-runs/:id spreads the whole run. */
  applicationId: string;
  status: string;
  targetUrl: string;
  startedAt: string | null;
  endedAt: string | null;
  environment: { name: string; type: string };
  mode?: string;
  /**
   * What the desktop reports while an Automated run is going: where it is, whether it is waiting for somebody,
   * and when it last checked in. The server has stored all of this since automated runs shipped; nothing read it,
   * so a run in progress looked identical to one that had stalled.
   */
  automation?: {
    executionPhase?: string | null;
    awaitingUser?: { kind: string; detail: string } | null;
    heartbeatAt?: string | null;
    stopReason?: string | null;
  } | null;
  artifacts: Array<{
    id: string;
    artifactType: string;
    bytes: string;
    capturedAt: string;
    /** Client-supplied capture context — stateKey, route, title, sequence, captureReason. Best-effort: not every artifact carries it. */
    metadata?: Record<string, unknown> | null;
  }>;
  findings: Finding[];
};
type Report = {
  id: string;
  generatedAt: string;
  /** The mode the evidence was gathered under. Absent on a report generated before modes were recorded. */
  mode?: string;
  sections?: { automated?: AutomatedSection | null };
  coverage: { expected: number | null; reconciledFlows: number };
  correlation: {
    runId: string;
    sessions: Array<{
      sessionId: string;
      traceId: string | null;
      startedAt: string | null;
      endedAt: string | null;
    }>;
  };
  instrumentation: null | {
    patchSetId: string;
    planId: string;
    adapterId: string;
    adapterVersion: string;
    manifestVersion: string;
    status: string;
    risk: string;
    validation: unknown;
    appliedAt: string | null;
    validatedAt: string | null;
  };
  summary: {
    sessionCount: number;
    observedStateCount: number;
    observedTransitionCount: number;
    artifactCount: number;
    findingCount: number;
    criticalOrHighFindings: number;
  };
};

/** How long a correlated session ran, from the timestamps the report carries. */
function sessionDuration(session: { startedAt: string | null; endedAt: string | null }): string {
  if (!session.startedAt || !session.endedAt) return "—";
  const ms = new Date(session.endedAt).getTime() - new Date(session.startedAt).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "—";
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.round(ms / 1000);
  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

function formatBytes(rawBytes: string): string {
  const bytes = Number(rawBytes);
  if (!Number.isFinite(bytes) || bytes < 0) return "Unknown size";
  if (bytes === 0) return "0 bytes";
  const units = ["bytes", "KB", "MB", "GB", "TB"];
  const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** unitIndex;
  return `${value.toLocaleString(undefined, { maximumFractionDigits: unitIndex === 0 ? 0 : 1 })} ${units[unitIndex]}`;
}

/** A run the platform still considers in progress, by the statuses the desktop drives it through. */
function isRunActive(status: string | undefined): boolean {
  return status !== undefined && !["COMPLETED", "COMPLETED_INCOMPLETE", "FAILED", "CANCELLED", "ARCHIVED", "TIMED_OUT"].includes(status);
}

/**
 * How long ago the desktop last checked in, in the words somebody would use.
 *
 * `now` is passed in rather than read from the clock: this runs during render, where reading the clock gives a
 * result that changes without the component being told to re-render. The caller uses the moment the run data
 * itself arrived, which is both pure and exactly the cadence this needs — it updates on every poll.
 */
function sinceText(iso: string | null | undefined, now: number): string | null {
  if (!iso) return null;
  const ms = now - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  if (ms < 60_000) return "just now";
  const minutes = Math.round(ms / 60_000);
  return minutes < 60 ? `${minutes} min ago` : `${Math.round(minutes / 60)} h ago`;
}

/** Past this with no word from the desktop, a run is far more likely to be gone than slow. */
const STALE_HEARTBEAT_MS = 90_000;

/**
 * Where an Automated run is right now, for somebody who is not sitting at the desktop that is driving it.
 *
 * The desktop has reported its phase, whether it is waiting for a person, and a heartbeat every twenty seconds
 * since Automated runs shipped. All of it was stored and none of it was shown, so a run in progress looked
 * exactly like one that had died — and a run paused for somebody to sign in looked like one that had hung.
 */
function LiveAutomationBanner({ detail, asOf }: { detail: RunDetail; asOf: number }) {
  const automation = detail.automation;
  if (!isRunActive(detail.status) || !automation) return null;
  const phase = automation.executionPhase ? describeExecutionPhase(automation.executionPhase) : null;
  const waiting = automation.awaitingUser;
  const last = sinceText(automation.heartbeatAt, asOf);
  const stale = automation.heartbeatAt
    ? asOf - new Date(automation.heartbeatAt).getTime() > STALE_HEARTBEAT_MS
    : false;

  return (
    <div
      className={`mt-4 rounded-xl border p-4 ${
        waiting ? "border-amber-500/40 bg-amber-500/5" : stale ? "border-[#262626] bg-black" : "border-emerald-500/30 bg-emerald-500/5"
      }`}
      role="status"
    >
      <p className="text-sm font-semibold text-white">
        {waiting ? "Waiting for somebody at the desktop" : phase ?? "Running"}
      </p>
      {waiting ? <p className="mt-1 text-sm text-[#c4c7c8]">{waiting.detail}</p> : null}
      {last ? (
        <p className="mt-2 text-xs text-[#8e9192]">
          {stale
            ? `Last heard from the desktop ${last}. It may have been closed.`
            : `Last heard from the desktop ${last}.`}
        </p>
      ) : null}
    </div>
  );
}

export default function QARunDetailPage() {
  const runId = String(useParams<{ id: string }>().id);
  const [openingArtifactId, setOpeningArtifactId] = useState<string | null>(null);
  const [artifactError, setArtifactError] = useState<string | null>(null);

  async function openArtifact(artifactId: string) {
    setOpeningArtifactId(artifactId);
    setArtifactError(null);
    const artifactWindow = window.open("about:blank", "_blank");
    if (artifactWindow) artifactWindow.opener = null;
    try {
      const response = await authenticatedFetch(
        `/api-gateway/qa-runs/${runId}/artifacts/${artifactId}/download`,
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || typeof payload.url !== "string") {
        throw new Error(payload.error || "Artifact content is unavailable");
      }
      if (artifactWindow) artifactWindow.location.replace(payload.url);
      else window.location.assign(payload.url);
    } catch (error) {
      artifactWindow?.close();
      setArtifactError(error instanceof Error ? error.message : "Unable to open artifact");
    } finally {
      setOpeningArtifactId(null);
    }
  }
  const run = useQuery<RunDetail>({
    queryKey: ["qa-run", runId],
    queryFn: async () => {
      const response = await authenticatedFetch(
        `/api-gateway/qa-runs/${runId}`,
      );
      if (!response.ok) throw new Error("Unable to load QA run");
      return response.json();
    },
    // A run in progress used to sit there until somebody reloaded, and never promoted itself to showing its
    // report when one appeared. The desktop reports in every twenty seconds, so this matches that.
    refetchInterval: (query) => (isRunActive(query.state.data?.status) ? 10_000 : false),
  });
  const report = useQuery<Report>({
    queryKey: ["qa-run-report", runId],
    enabled: run.data?.status === "COMPLETED",
    queryFn: async () => {
      const response = await authenticatedFetch(
        `/api-gateway/qa-runs/${runId}/report`,
      );
      if (!response.ok) throw new Error("Unable to load QA report");
      return response.json();
    },
  });

  if (run.isLoading)
    return (
      <div className="animate-pulse font-mono text-sm text-[#8e9192]">
        Loading run evidence…
      </div>
    );
  if (run.error || !run.data)
    return (
      <div className="font-mono text-sm text-red-400">
        {(run.error as Error)?.message ?? "Run not found"}
      </div>
    );
  const detail = run.data;
  const artifactGroups = groupArtifactsByType(detail.artifacts);

  return (
    <div className="space-y-8">
      <div className="border-b border-[#262626] pb-5">
        <div className="flex flex-wrap items-center gap-2">
          <RunStatusBadge status={detail.status} />
          {report.data?.mode ?? detail.mode ? (
            <span className="rounded border border-[#262626] bg-black px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-[#8e9192]">
              {modeLabel(report.data?.mode ?? detail.mode)}
            </span>
          ) : null}
        </div>
        <LiveAutomationBanner detail={detail} asOf={run.dataUpdatedAt} />
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-white">QA Run report</h1>
        <p className="mt-1 text-sm text-[#c4c7c8]">
          {detail.environment.name} · <span className="font-mono">{detail.targetUrl}</span>
        </p>
        <p className="mt-2 font-mono text-xs text-[#5a5a5a]">{detail.id}</p>
        {report.data?.mode ? (
          <p className="mt-3 max-w-2xl text-sm text-[#8e9192]">{MODE_MEANINGS[report.data.mode]}</p>
        ) : null}
      </div>
      {report.data ? (
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            [
              "Expected coverage",
              report.data.coverage.expected == null
                ? "Pending intent"
                : `${report.data.coverage.expected.toFixed(1)}%`,
            ],
            ["Observed sessions", report.data.summary.sessionCount],
            ["Observed states", report.data.summary.observedStateCount],
            [
              "Observed transitions",
              report.data.summary.observedTransitionCount,
            ],
            ["Approved artifacts", report.data.summary.artifactCount],
            [
              "High-priority findings",
              report.data.summary.criticalOrHighFindings,
            ],
          ].map(([label, value]) => (
            <div
              key={label}
              className="rounded-md border border-[#262626] bg-[#131313] p-5"
            >
              <div className="font-mono text-xs uppercase tracking-wide text-[#8e9192]">{label}</div>
              <div className="mt-2 text-2xl font-semibold text-white">{value}</div>
            </div>
          ))}
        </section>
      ) : null}
      {report.data?.sections?.automated ? (
        <AutomatedRunSection section={report.data.sections.automated} />
      ) : null}
      {report.data?.instrumentation ? (
        <section className="rounded-md border border-[#262626] bg-[#131313] p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="font-mono text-xs uppercase tracking-wide text-[#8e9192]">
                Instrumentation manifest
              </div>
              <h2 className="mt-2 text-lg font-semibold text-white">
                {report.data.instrumentation.adapterId}
              </h2>
              <p className="mt-1 text-sm text-[#8e9192]">
                Adapter {report.data.instrumentation.adapterVersion} · manifest{" "}
                {report.data.instrumentation.manifestVersion}
              </p>
            </div>
            <span className="rounded border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-emerald-400">
              {report.data.instrumentation.status}
            </span>
          </div>
          <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="font-mono text-xs uppercase tracking-wide text-[#8e9192]">Plan</dt>
              <dd className="mt-1 font-mono text-neutral-200">
                {report.data.instrumentation.planId.slice(0, 8)}
              </dd>
            </div>
            <div>
              <dt className="font-mono text-xs uppercase tracking-wide text-[#8e9192]">Risk</dt>
              <dd className="mt-1 text-neutral-200">{report.data.instrumentation.risk}</dd>
            </div>
            <div>
              <dt className="font-mono text-xs uppercase tracking-wide text-[#8e9192]">Validated</dt>
              <dd className="mt-1 text-neutral-200">
                {report.data.instrumentation.validatedAt
                  ? new Date(
                      report.data.instrumentation.validatedAt,
                    ).toLocaleString()
                  : "Not validated"}
              </dd>
            </div>
          </dl>
        </section>
      ) : null}
      <FindingsSection findings={detail.findings} />
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-white">
          <Camera className="h-5 w-5 text-[#8e9192]" aria-hidden="true" /> Approved artifacts
          <span className="font-mono text-xs font-normal text-[#5a5a5a]">{detail.artifacts.length}</span>
        </h2>
        {artifactError ? (
          <p role="alert" className="mb-3 text-sm text-red-400">{artifactError}</p>
        ) : null}
        {!detail.artifacts.length ? (
          <p className="rounded-md border border-[#262626] bg-[#131313] p-5 text-sm text-[#5a5a5a]">
            No artifacts were captured for this run.
          </p>
        ) : (
          <div className="space-y-5">
            {artifactGroups.map(([artifactType, artifacts]) => (
              <ArtifactGroupSection
                key={artifactType}
                artifactType={artifactType}
                artifacts={artifacts}
                openingArtifactId={openingArtifactId}
                onOpen={openArtifact}
              />
            ))}
          </div>
        )}
      </section>
      {report.data?.correlation.sessions.length ? (
        <section>
          <h2 className="mb-1 flex items-center gap-2 text-lg font-semibold text-white">
            <Route className="h-5 w-5 text-[#8e9192]" aria-hidden="true" /> Sessions this run observed
          </h2>
          <p className="mb-3 text-sm text-[#8e9192]">
            Open a session to replay the events behind a finding — the exact click, request and
            state change, in order.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {report.data.correlation.sessions.map((session) => (
              <Link
                key={session.sessionId}
                href={`/sessions/${session.sessionId}?appId=${detail.applicationId}`}
                className="group rounded-md border border-[#262626] bg-[#131313] p-5 transition-colors hover:border-[#3a3a3a] hover:bg-[#161616]"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-sm text-neutral-200">
                    {session.sessionId.slice(0, 8)}…{session.sessionId.slice(-4)}
                  </span>
                  <span className="flex items-center gap-1 font-mono text-xs text-blue-400 group-hover:text-blue-300">
                    Replay
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                  </span>
                </div>
                <dl className="mt-3 space-y-1 text-xs text-[#5a5a5a]">
                  <div className="flex justify-between gap-2">
                    <dt>Started</dt>
                    <dd className="text-[#8e9192]">
                      {session.startedAt ? new Date(session.startedAt).toLocaleString() : "—"}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt>Duration</dt>
                    <dd className="text-[#8e9192]">{sessionDuration(session)}</dd>
                  </div>
                  {session.traceId ? (
                    <div className="flex justify-between gap-2">
                      <dt>Trace</dt>
                      <dd className="font-mono text-[#8e9192]">{session.traceId.slice(0, 8)}…</dd>
                    </div>
                  ) : null}
                </dl>
              </Link>
            ))}
          </div>
          <details className="mt-4">
            <summary className="cursor-pointer text-xs text-neutral-600 hover:text-neutral-400">
              Show raw correlation
            </summary>
            <pre className="mt-2 overflow-auto rounded-md border border-[#262626] bg-black p-4 text-xs text-[#8e9192]">
              {JSON.stringify(report.data.correlation, null, 2)}
            </pre>
          </details>
        </section>
      ) : null}
    </div>
  );
}

const SEVERITY_FILTER_STYLES: Record<FindingSeverity, string> = {
  CRITICAL: "border-red-500/20 bg-red-500/10 text-red-400",
  HIGH: "border-amber-500/20 bg-amber-500/10 text-amber-400",
  MEDIUM: "border-yellow-500/20 bg-yellow-500/10 text-yellow-300",
  LOW: "border-blue-500/20 bg-blue-500/10 text-blue-400",
  INFO: "border-neutral-500/20 bg-neutral-500/10 text-neutral-400",
};

/** The findings list: grouped by issue (not by hit) so the same violation across five routes is one
 *  card, worst severity first, with a filter so a reviewer can jump straight to what matters. */
function FindingsSection({ findings }: { findings: Finding[] }) {
  const [severityFilter, setSeverityFilter] = useState<FindingSeverity | "ALL">("ALL");
  const presentSeverities = SEVERITY_ORDER.filter((severity) => findings.some((finding) => asSeverity(finding.severity) === severity));
  const filtered = severityFilter === "ALL" ? findings : findings.filter((finding) => asSeverity(finding.severity) === severityFilter);
  const groups = groupFindings(filtered);

  return (
    <section>
      <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-white">
        <AlertTriangle className="h-5 w-5 text-[#8e9192]" aria-hidden="true" /> Findings
        <span className="font-mono text-xs font-normal text-[#5a5a5a]">{findings.length}</span>
      </h2>
      {findings.length ? (
        <div className="mb-3 flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter findings by severity">
          <button
            type="button"
            onClick={() => setSeverityFilter("ALL")}
            className={
              severityFilter === "ALL"
                ? "rounded border border-white px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-white"
                : "rounded border border-[#262626] px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-[#8e9192] transition-colors hover:border-[#3a3a3a] hover:text-white"
            }
          >
            All · {findings.length}
          </button>
          {presentSeverities.map((severity) => {
            const count = findings.filter((finding) => asSeverity(finding.severity) === severity).length;
            const active = severityFilter === severity;
            return (
              <button
                key={severity}
                type="button"
                onClick={() => setSeverityFilter(active ? "ALL" : severity)}
                className={
                  "rounded border px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider transition-colors " +
                  (active ? SEVERITY_FILTER_STYLES[severity] : "border-[#262626] text-[#8e9192] hover:border-[#3a3a3a] hover:text-white")
                }
              >
                {severity} · {count}
              </button>
            );
          })}
        </div>
      ) : null}
      <div className="space-y-3">
        {groups.map((group) => (
          <FindingGroupCard key={group.key} group={group} />
        ))}
        {!findings.length ? (
          <p className="rounded-md border border-[#262626] bg-[#131313] p-5 text-sm text-[#5a5a5a]">
            No browser findings were captured.
          </p>
        ) : null}
        {findings.length && !groups.length ? (
          <p className="rounded-md border border-[#262626] bg-[#131313] p-5 text-sm text-[#5a5a5a]">
            No findings match this filter.
          </p>
        ) : null}
      </div>
    </section>
  );
}

function FindingDescription({ description }: { description: string }) {
  if (!isLongDescription(description)) {
    return <p className="mt-1 text-sm text-[#8e9192]">{description}</p>;
  }
  return (
    <details className="mt-1 group/desc">
      <summary className="cursor-pointer text-sm text-[#8e9192] marker:content-none">
        <span className="line-clamp-2 inline">{description}</span>
        <span className="mt-1 block font-mono text-[11px] text-[#5a5a5a] group-open/desc:hidden">Show full details</span>
        <span className="mt-1 hidden font-mono text-[11px] text-[#5a5a5a] group-open/desc:block">Hide</span>
      </summary>
      <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-words rounded border border-[#262626] bg-black p-3 font-mono text-xs text-[#8e9192]">
        {description}
      </pre>
    </details>
  );
}

function FindingGroupCard({ group }: { group: FindingGroup }) {
  const [expanded, setExpanded] = useState(false);
  const single = group.occurrences.length === 1;
  const first = group.occurrences[0];

  return (
    <article className="rounded-md border border-[#262626] bg-[#131313] p-5">
      <div className="flex flex-wrap items-center gap-2">
        <SeverityTag severity={group.severity} />
        <span className="font-mono text-xs text-[#5a5a5a]">{group.category}</span>
        {!single ? (
          <span className="rounded border border-[#262626] bg-black px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-[#8e9192]">
            {group.occurrences.length} occurrences
          </span>
        ) : null}
      </div>
      <h3 className="mt-2 font-medium text-white">{group.title}</h3>
      {single ? (
        <>
          <FindingDescription description={first.description} />
          {first.url ? <p className="mt-1 font-mono text-xs text-[#5a5a5a]">{first.url}</p> : null}
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            className="mt-2 flex items-center gap-1.5 font-mono text-xs text-[#8e9192] transition-colors hover:text-white"
            aria-expanded={expanded}
          >
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} aria-hidden="true" />
            {expanded ? "Hide occurrences" : `Show all ${group.occurrences.length} occurrences`}
          </button>
          {expanded ? (
            <ul className="mt-3 space-y-3 border-t border-[#262626] pt-3">
              {group.occurrences.map((occurrence) => (
                <li key={occurrence.id}>
                  {occurrence.url ? (
                    <p className="font-mono text-xs text-[#c4c7c8]">{occurrence.url}</p>
                  ) : null}
                  <FindingDescription description={occurrence.description} />
                </li>
              ))}
            </ul>
          ) : null}
        </>
      )}
    </article>
  );
}

const ARTIFACTS_PER_PAGE = 12;

/** One artifact type's section, with its own page so 44 screenshots don't turn the report into a scroll marathon. */
function ArtifactGroupSection({
  artifactType,
  artifacts,
  openingArtifactId,
  onOpen,
}: {
  artifactType: string;
  artifacts: RunDetail["artifacts"];
  openingArtifactId: string | null;
  onOpen(artifactId: string): void;
}) {
  const meta = artifactTypeMeta(artifactType);
  const GroupIcon = meta.icon;
  const pageCount = Math.max(1, Math.ceil(artifacts.length / ARTIFACTS_PER_PAGE));
  const [page, setPage] = useState(0);
  const currentPage = Math.min(page, pageCount - 1);
  const offset = currentPage * ARTIFACTS_PER_PAGE;
  const pageItems = artifacts.slice(offset, offset + ARTIFACTS_PER_PAGE);

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <GroupIcon className="h-3.5 w-3.5 text-[#5a5a5a]" aria-hidden="true" />
          <h3 className="font-mono text-xs uppercase tracking-wide text-[#8e9192]">{meta.label}</h3>
          <span className="font-mono text-[11px] text-[#5a5a5a]">{artifacts.length}</span>
        </div>
        {pageCount > 1 ? (
          <div className="flex items-center gap-2 font-mono text-[11px] text-[#5a5a5a]">
            <button
              type="button"
              onClick={() => setPage((value) => Math.max(0, value - 1))}
              disabled={currentPage === 0}
              className="rounded border border-[#262626] px-2 py-1 text-[#8e9192] transition-colors hover:border-[#3a3a3a] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              Prev
            </button>
            <span>
              Page {currentPage + 1} of {pageCount}
            </span>
            <button
              type="button"
              onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))}
              disabled={currentPage === pageCount - 1}
              className="rounded border border-[#262626] px-2 py-1 text-[#8e9192] transition-colors hover:border-[#3a3a3a] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          </div>
        ) : null}
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {pageItems.map((artifact, index) => {
          const info = captureInfo(artifact.metadata);
          const title = info.title || (info.stateKey ? humanizeStateKey(info.stateKey) : null) || `${meta.singular} ${offset + index + 1}`;
          const reasonLabel = info.captureReason ? CAPTURE_REASON_LABEL[info.captureReason] : null;
          return (
            <button
              type="button"
              key={artifact.id}
              onClick={() => void onOpen(artifact.id)}
              disabled={openingArtifactId === artifact.id}
              className="group flex flex-col gap-1 rounded-md border border-[#262626] bg-[#131313] px-3 py-2.5 text-left transition-colors hover:border-[#3a3a3a] hover:bg-[#161616] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white disabled:cursor-wait disabled:opacity-60"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="min-w-0 truncate font-mono text-xs text-[#c4c7c8]">
                  {openingArtifactId === artifact.id ? "Opening…" : title}
                </span>
                <ExternalLink className="h-3.5 w-3.5 shrink-0 text-[#5a5a5a] transition-colors group-hover:text-white" aria-hidden="true" />
              </div>
              {info.route ? (
                <span className="truncate font-mono text-[10px] text-[#5a5a5a]">{info.route}</span>
              ) : null}
              <div className="flex flex-wrap items-center gap-1.5 font-mono text-[10px] text-[#5a5a5a]">
                <span>{new Date(artifact.capturedAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
                <span aria-hidden="true">·</span>
                <span>{formatBytes(artifact.bytes)}</span>
                {reasonLabel ? (
                  <span
                    className={
                      info.captureReason === "FINDING"
                        ? "rounded border border-amber-500/20 bg-amber-500/10 px-1 py-0.5 text-amber-400"
                        : "rounded border border-[#262626] px-1 py-0.5 text-[#8e9192]"
                    }
                  >
                    {reasonLabel}
                  </span>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

const TONE_STYLES: Record<OutcomeTone, string> = {
  success: "border-emerald-500/20 bg-emerald-500/10 text-emerald-400",
  application: "border-amber-500/20 bg-amber-500/10 text-amber-400",
  infrastructure: "border-[#333] bg-[#141414] text-[#c4c7c8]",
  neutral: "border-[#333] bg-[#141414] text-[#c4c7c8]",
};

/** The state-by-state account of an Automated run, and how it ended. */
function AutomatedRunSection({ section }: { section: AutomatedSection }) {
  const summary = outcomeSummary(section);
  const reconciliation = reconciliationRows(section);
  const evidence = codeEvidenceEntries(section);
  const traces = retainedTraceRows(section);
  const timing = renderTimingRows(section);
  const effects = effectRows(section);
  const quality = uiQualityRows(section);
  const grid = responsiveGrid(section);
  const blocked = blockedActionRows(section);
  const lead = section.summary ?? null;
  const limitations = section.limitations ?? [];
  return (
    <section className="space-y-5 rounded-md border border-[#262626] bg-[#131313] p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="font-mono text-xs uppercase tracking-wide text-[#8e9192]">Automated run</div>
          <h2 className="mt-2 text-lg font-semibold text-white">{summary.headline}</h2>
          {lead ? (
            <p className="mt-1 text-sm text-neutral-300">
              {lead.headline}
              {lead.declared > 0 ? (
                <span className="ml-2 font-mono text-xs text-neutral-500">
                  {lead.reached} of {lead.declared} declared states
                  {lead.furthestStateKey ? ` · furthest ${lead.furthestStateKey}` : ""}
                </span>
              ) : null}
            </p>
          ) : null}
          <p className="mt-1 max-w-2xl text-sm text-[#8e9192]">{summary.explanation}</p>
        </div>
        <span className={`rounded border px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-wider ${TONE_STYLES[summary.tone]}`}>
          {section.outcome.steps ?? 0} steps · {section.outcome.replans ?? 0} replans
        </span>
      </div>

      <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
        {pinnedRows(section).map(([label, value]) => (
          <div key={label}>
            <dt className="font-mono text-xs uppercase tracking-wide text-[#8e9192]">{label}</dt>
            <dd className="mt-1 break-all font-mono text-xs text-neutral-200">{value}</dd>
          </div>
        ))}
      </dl>

      <div>
        <h3 className="text-sm font-semibold text-white">
          States visited{" "}
          <span className="font-normal text-[#8e9192]">
            ({section.preBoundaryStateCount} before the Flow began, {section.inFlowStateCount} in the Flow)
          </span>
        </h3>
        <ol className="mt-3 divide-y divide-[#262626] text-sm">
          {section.states.map((state) => (
            <li key={state.sequence} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
              <span>
                <span className="font-mono">{state.stateKey}</span>
                {state.scope === "PRE_BOUNDARY" ? (
                  <span className="ml-2 text-xs text-neutral-500">setup</span>
                ) : null}
                {state.route ? <span className="ml-2 text-xs text-neutral-500">{state.route}</span> : null}
                {state.confidence && state.confidence !== "HIGH" ? (
                  <span className="ml-2 text-xs text-amber-300">{state.confidence.toLowerCase()} confidence</span>
                ) : null}
                {easeText(state.action) ? (
                  <span className="mt-1 block text-xs text-neutral-500">{easeText(state.action)}</span>
                ) : null}
              </span>
              <span className="text-xs text-neutral-400">
                {state.action
                  ? `${state.action.label ?? "action"} → ${
                      state.action.verified === false
                        ? "did not advance"
                        : state.action.verified
                          ? "advanced"
                          : "not verified"
                    }${state.action.error ? ` (${state.action.error})` : ""}`
                  : "end of run"}
                {" · "}
                {durationText(state.durationMs)}
                {state.errorCount > 0 ? ` · ${state.errorCount} error${state.errorCount === 1 ? "" : "s"}` : ""}
              </span>
            </li>
          ))}
        </ol>
      </div>

      {section.unreachedStates.length > 0 ? (
        <div>
          <h3 className="text-sm font-semibold">Declared states not reached</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {section.unreachedStates.map((state) => (
              <li key={state.stateKey} className="flex flex-wrap justify-between gap-2">
                <span className="font-mono">{state.stateKey}</span>
                <span
                  className={
                    state.status === "BLOCKED_BY_APPLICATION" ? "text-amber-400" : "text-neutral-500"
                  }
                >
                  {unreachedLabel(state.status)}
                  {state.detail ? ` — ${state.detail}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {evidence.length > 0 ? (
        <div>
          <h3 className="text-sm font-semibold">What the code says about the step that failed</h3>
          <p className="mt-1 text-xs text-neutral-500">
            Locations and a summary only. The source stays on the machine that ran the test.
          </p>
          <ul className="mt-3 space-y-3 text-sm">
            {evidence.map((entry) => (
              <li key={entry.key}>
                <div className="font-mono text-xs text-neutral-400">{entry.heading}</div>
                <p className="mt-1 text-neutral-300">{entry.summary}</p>
                {entry.locations.map((location) => (
                  <div key={location} className="font-mono text-xs text-neutral-500">{location}</div>
                ))}
                {entry.caveat ? <p className="mt-1 text-xs text-amber-400">{entry.caveat}</p> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {traces.length > 0 ? (
        <div>
          <h3 className="text-sm font-semibold">Diagnostic traces kept</h3>
          <p className="mt-1 text-xs text-neutral-500">
            A trace is recorded for every state and kept only where something went wrong. It holds the
            action log and console output, with typed text, page content and credentials removed.
          </p>
          <ul className="mt-3 space-y-1 text-sm text-neutral-300">
            {traces.map(([where, why]) => (
              <li key={`${where}:${why}`}>
                <span className="font-mono">{where}</span> — {why}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {timing.length > 0 ? (
        <div>
          <h3 className="text-sm font-semibold">Render time of the Flow&apos;s components</h3>
          <p className="mt-1 text-xs text-neutral-500">
            Measured for the components this run was asked to watch, in a development build. Each is
            listed with the states it is the code for.
          </p>
          <table className="mt-3 w-full text-left text-sm">
            <tbody className="divide-y divide-[#262626]">
              {timing.map((row) => (
                <tr key={row.component}>
                  <td className="py-2 font-mono">{row.component}</td>
                  <td className="py-2 text-xs text-neutral-500">{row.states}</td>
                  <td className="py-2 text-xs text-neutral-400">{row.renders}</td>
                  <td className="py-2 text-right text-xs">{row.total} total · {row.worst} worst</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {reconciliation.length > 0 ? (
        <div>
          <h3 className="text-sm font-semibold">What reconciliation attributes the gaps to</h3>
          <ul className="mt-3 space-y-1 text-sm text-neutral-300">
            {reconciliation.map(([label, count]) => (
              <li key={label}>
                {count} × {label}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {lead && lead.priorities.length > 0 ? (
        <div>
          <h3 className="text-sm font-semibold">What to look at first</h3>
          <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-neutral-300">
            {lead.priorities.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ol>
        </div>
      ) : null}

      {effects.length > 0 ? (
        <div>
          <h3 className="text-sm font-semibold">What the Flow says these steps cause, and what happened</h3>
          <p className="mt-1 text-xs text-neutral-500">
            Only the requests somebody declared are checked. One that did not happen is the application no longer
            doing what the Flow says it does.
          </p>
          <ul className="mt-3 divide-y divide-neutral-800 text-sm">
            {effects.map((effect) => (
              <li key={effect.key} className="py-2">
                <span className="font-mono text-neutral-200">{effect.request}</span>
                <span className="ml-2 text-amber-300">{effect.outcome}</span>
                <span className="mt-1 block font-mono text-xs text-neutral-500">{effect.where}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {quality.length > 0 ? (
        <div>
          <h3 className="text-sm font-semibold">How this Flow could be better to use</h3>
          <p className="mt-1 text-xs text-neutral-500">
            Each of these is a measurement against a published threshold, so you can tell whether to agree with it.
          </p>
          <ul className="mt-3 divide-y divide-neutral-800 text-sm">
            {quality.map((finding) => (
              <li key={finding.key} className="py-2">
                <span className={finding.severity === "MEDIUM" ? "text-amber-300" : "text-neutral-300"}>{finding.title}</span>
                <span className="ml-2 font-mono text-xs text-neutral-500">{finding.where}</span>
                <span className="mt-1 block text-neutral-300">{finding.detail}</span>
                {finding.recommendation ? (
                  <span className="mt-1 block text-xs text-neutral-500">{finding.recommendation}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {grid ? (
        <div>
          <h3 className="text-sm font-semibold">How each state behaves at other window sizes</h3>
          <p className="mt-1 text-xs text-neutral-500">
            Each state was re-measured at these sizes the first time the run reached it. Nothing was clicked and
            nothing was changed.
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-neutral-500">
                  <th className="pb-2 pr-4 font-normal">State</th>
                  {grid.sizes.map((size) => (
                    <th key={size} className="pb-2 pr-4 font-normal">{size}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800">
                {grid.rows.map((row) => (
                  <tr key={row.stateKey}>
                    <td className="py-2 pr-4 font-mono text-xs text-neutral-300">{row.stateKey}</td>
                    {row.cells.map((cell, index) => (
                      <td
                        key={grid.sizes[index] ?? index}
                        className={`py-2 pr-4 ${cell === "clear" ? "text-emerald-400" : cell === "—" ? "text-neutral-600" : "text-amber-300"}`}
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {blocked.length > 0 ? (
        <div>
          <h3 className="text-sm font-semibold">Actions the run could not perform</h3>
          <ul className="mt-3 divide-y divide-neutral-800 text-sm">
            {blocked.map((action) => (
              <li key={action.key} className="py-2">
                <span className="text-neutral-300">{action.reason}</span>
                <span className="ml-2 font-mono text-xs text-neutral-500">{action.step}</span>
                <span className="mt-1 block text-neutral-400">{action.detail}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {limitations.length > 0 ? (
        <div>
          <h3 className="text-sm font-semibold">What this run could not tell you</h3>
          <ul className="mt-3 space-y-1 text-sm text-neutral-400">
            {limitations.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
