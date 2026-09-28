"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  AlertTriangle,
  Camera,
  ExternalLink,
  FileArchive,
  Route,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { authenticatedFetch } from "@/lib/authenticated-fetch";
import {
  durationText,
  modeLabel,
  MODE_MEANINGS,
  outcomeSummary,
  pinnedRows,
  reconciliationRows,
  codeEvidenceEntries,
  retainedTraceRows,
  renderTimingRows,
  unreachedLabel,
} from "./automated-report";
import type { AutomatedSection, OutcomeTone } from "./automated-report";

type RunDetail = {
  id: string;
  /** Already on the response — GET /qa-runs/:id spreads the whole run. */
  applicationId: string;
  status: string;
  targetUrl: string;
  startedAt: string | null;
  endedAt: string | null;
  environment: { name: string; type: string };
  artifacts: Array<{
    id: string;
    artifactType: string;
    bytes: string;
    capturedAt: string;
  }>;
  findings: Array<{
    id: string;
    severity: string;
    category: string;
    title: string;
    description: string;
    url: string | null;
  }>;
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
      <div className="animate-pulse text-neutral-400">
        Loading run evidence…
      </div>
    );
  if (run.error || !run.data)
    return (
      <div className="text-red-400">
        {(run.error as Error)?.message ?? "Run not found"}
      </div>
    );
  const detail = run.data;

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-2 text-sm text-emerald-400">
          <ShieldCheck className="h-4 w-4" /> {detail.status}
        </div>
        <h1 className="mt-2 text-3xl font-bold">QA Run report</h1>
        <p className="mt-1 text-sm text-neutral-400">
          {detail.environment.name} · {detail.targetUrl}
        </p>
        <p className="mt-2 font-mono text-xs text-neutral-600">{detail.id}</p>
        {report.data ? (
          <p className="mt-3 max-w-2xl text-sm text-neutral-400">
            <span className="mr-2 rounded-full border border-neutral-700 px-2.5 py-0.5 text-xs text-neutral-200">
              {modeLabel(report.data.mode)}
            </span>
            {report.data.mode ? MODE_MEANINGS[report.data.mode] : null}
          </p>
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
              className="rounded-xl border border-neutral-800 bg-neutral-900 p-5"
            >
              <div className="text-xs text-neutral-500">{label}</div>
              <div className="mt-2 text-2xl font-semibold">{value}</div>
            </div>
          ))}
        </section>
      ) : null}
      {report.data?.sections?.automated ? (
        <AutomatedRunSection section={report.data.sections.automated} />
      ) : null}
      {report.data?.instrumentation ? (
        <section className="rounded-xl border border-neutral-800 bg-neutral-900 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-wide text-neutral-500">
                Instrumentation manifest
              </div>
              <h2 className="mt-2 text-lg font-semibold">
                {report.data.instrumentation.adapterId}
              </h2>
              <p className="mt-1 text-sm text-neutral-400">
                Adapter {report.data.instrumentation.adapterVersion} · manifest{" "}
                {report.data.instrumentation.manifestVersion}
              </p>
            </div>
            <span className="rounded-full border border-emerald-800 px-3 py-1 text-xs text-emerald-400">
              {report.data.instrumentation.status}
            </span>
          </div>
          <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-neutral-500">Plan</dt>
              <dd className="mt-1 font-mono">
                {report.data.instrumentation.planId.slice(0, 8)}
              </dd>
            </div>
            <div>
              <dt className="text-neutral-500">Risk</dt>
              <dd className="mt-1">{report.data.instrumentation.risk}</dd>
            </div>
            <div>
              <dt className="text-neutral-500">Validated</dt>
              <dd className="mt-1">
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
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
          <AlertTriangle className="h-5 w-5" /> Findings
        </h2>
        <div className="space-y-3">
          {detail.findings.map((finding) => (
            <article
              key={finding.id}
              className="rounded-xl border border-neutral-800 bg-neutral-900 p-5"
            >
              <div className="flex gap-2 text-xs">
                <span className="text-amber-400">{finding.severity}</span>
                <span className="text-neutral-500">{finding.category}</span>
              </div>
              <h3 className="mt-2 font-medium">{finding.title}</h3>
              <p className="mt-1 text-sm text-neutral-400">
                {finding.description}
              </p>
            </article>
          ))}
          {!detail.findings.length ? (
            <p className="rounded-xl border border-neutral-800 p-5 text-sm text-neutral-500">
              No browser findings were captured.
            </p>
          ) : null}
        </div>
      </section>
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
          <Camera className="h-5 w-5" /> Approved artifacts
        </h2>
        {artifactError ? (
          <p role="alert" className="mb-3 text-sm text-red-400">{artifactError}</p>
        ) : null}
        <div className="grid gap-3 md:grid-cols-3">
          {detail.artifacts.map((artifact) => (
            <button
              type="button"
              key={artifact.id}
              onClick={() => void openArtifact(artifact.id)}
              disabled={openingArtifactId === artifact.id}
              className="group rounded-xl border border-neutral-800 bg-neutral-900 p-4 text-left transition-colors hover:border-neutral-600 hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 disabled:cursor-wait disabled:opacity-60"
            >
              <div className="flex items-start justify-between gap-3">
                <FileArchive className="h-5 w-5 text-blue-400" />
                <ExternalLink className="h-4 w-4 text-neutral-600 transition-colors group-hover:text-neutral-300" aria-hidden="true" />
              </div>
              <div className="mt-3 text-sm font-medium">
                {artifact.artifactType}
              </div>
              <div className="mt-1 text-xs text-neutral-500">
                {formatBytes(artifact.bytes)} · {openingArtifactId === artifact.id ? "Opening…" : "View artifact"}
              </div>
            </button>
          ))}
        </div>
      </section>
      {report.data?.correlation.sessions.length ? (
        <section>
          <h2 className="mb-1 flex items-center gap-2 text-lg font-semibold">
            <Route className="h-5 w-5" /> Sessions this run observed
          </h2>
          <p className="mb-3 text-sm text-neutral-500">
            Open a session to replay the events behind a finding — the exact click, request and
            state change, in order.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {report.data.correlation.sessions.map((session) => (
              <Link
                key={session.sessionId}
                href={`/sessions/${session.sessionId}?appId=${detail.applicationId}`}
                className="group rounded-xl border border-neutral-800 bg-neutral-900 p-5 transition-colors hover:border-neutral-700"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-sm text-neutral-200">
                    {session.sessionId.slice(0, 8)}…{session.sessionId.slice(-4)}
                  </span>
                  <ExternalLink className="h-4 w-4 text-neutral-600 transition-colors group-hover:text-neutral-300" />
                </div>
                <dl className="mt-3 space-y-1 text-xs text-neutral-500">
                  <div className="flex justify-between gap-2">
                    <dt>Started</dt>
                    <dd className="text-neutral-400">
                      {session.startedAt ? new Date(session.startedAt).toLocaleString() : "—"}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt>Duration</dt>
                    <dd className="text-neutral-400">{sessionDuration(session)}</dd>
                  </div>
                  {session.traceId ? (
                    <div className="flex justify-between gap-2">
                      <dt>Trace</dt>
                      <dd className="font-mono text-neutral-400">{session.traceId.slice(0, 8)}…</dd>
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
            <pre className="mt-2 overflow-auto rounded-xl border border-neutral-800 bg-neutral-950 p-4 text-xs text-neutral-400">
              {JSON.stringify(report.data.correlation, null, 2)}
            </pre>
          </details>
        </section>
      ) : null}
    </div>
  );
}

const TONE_STYLES: Record<OutcomeTone, string> = {
  success: "border-emerald-800 text-emerald-400",
  application: "border-amber-800 text-amber-400",
  infrastructure: "border-neutral-700 text-neutral-300",
  neutral: "border-neutral-700 text-neutral-300",
};

/** The state-by-state account of an Automated run, and how it ended. */
function AutomatedRunSection({ section }: { section: AutomatedSection }) {
  const summary = outcomeSummary(section);
  const reconciliation = reconciliationRows(section);
  const evidence = codeEvidenceEntries(section);
  const traces = retainedTraceRows(section);
  const timing = renderTimingRows(section);
  return (
    <section className="space-y-5 rounded-xl border border-neutral-800 bg-neutral-900 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-wide text-neutral-500">Automated run</div>
          <h2 className="mt-2 text-lg font-semibold">{summary.headline}</h2>
          <p className="mt-1 max-w-2xl text-sm text-neutral-400">{summary.explanation}</p>
        </div>
        <span className={`rounded-full border px-3 py-1 text-xs ${TONE_STYLES[summary.tone]}`}>
          {section.outcome.steps ?? 0} steps · {section.outcome.replans ?? 0} replans
        </span>
      </div>

      <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
        {pinnedRows(section).map(([label, value]) => (
          <div key={label}>
            <dt className="text-neutral-500">{label}</dt>
            <dd className="mt-1 break-all font-mono text-xs">{value}</dd>
          </div>
        ))}
      </dl>

      <div>
        <h3 className="text-sm font-semibold">
          States visited{" "}
          <span className="font-normal text-neutral-500">
            ({section.preBoundaryStateCount} before the Flow began, {section.inFlowStateCount} in the Flow)
          </span>
        </h3>
        <ol className="mt-3 divide-y divide-neutral-800 text-sm">
          {section.states.map((state) => (
            <li key={state.sequence} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
              <span>
                <span className="font-mono">{state.stateKey}</span>
                {state.scope === "PRE_BOUNDARY" ? (
                  <span className="ml-2 text-xs text-neutral-500">setup</span>
                ) : null}
                {state.route ? <span className="ml-2 text-xs text-neutral-500">{state.route}</span> : null}
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
            <tbody className="divide-y divide-neutral-800">
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
    </section>
  );
}
