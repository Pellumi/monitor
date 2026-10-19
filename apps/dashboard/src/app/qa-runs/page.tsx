"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AlertTriangle, ArrowRight, FileSearch } from "lucide-react";
import { authenticatedFetch } from "@/lib/authenticated-fetch";
import { useSelectedApplication } from "@/hooks/use-selected-application";
import { ApplicationRequiredState } from "@/components/application-required-state";
import { EmptyState } from "@/components/empty-state";
import { RunStatusBadge } from "./run-status-badge";
import { describeExecutionPhase, MODE_LABELS } from "./[id]/automated-report";

type QARun = {
  id: string;
  status: string;
  mode: string;
  /**
   * What the desktop reports while an Automated run is going. The server has stored it since Automated runs
   * shipped and nothing read it, so a run in progress looked exactly like one that had stalled.
   */
  automation?: { executionPhase?: string | null; awaitingUser?: { kind: string; detail: string } | null } | null;
  targetUrl: string;
  createdAt: string;
  startedAt: string | null;
  endedAt: string | null;
  environment: { name: string; type: string };
  _count: { artifacts: number; findings: number };
};

function QARunsSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="space-y-2 border-b border-[#262626] pb-5">
        <div className="h-8 w-40 rounded-sm bg-[#131313]" />
        <div className="h-4 w-96 rounded-sm bg-[#131313]" />
      </div>
      <div className="grid gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-md border border-[#262626] bg-[#131313] p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="h-4 w-28 rounded-sm bg-[#1d1d1d]" />
                  <div className="h-4 w-14 rounded-sm bg-[#1d1d1d]" />
                </div>
                <div className="h-3.5 w-64 rounded-sm bg-[#1d1d1d]" />
                <div className="h-3 w-40 rounded-sm bg-[#1d1d1d]" />
              </div>
              <div className="h-5 w-24 rounded bg-[#1d1d1d]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** A run the platform still considers in progress, by the statuses the desktop drives it through. */
function isRunActive(status: string): boolean {
  return !["COMPLETED", "COMPLETED_INCOMPLETE", "FAILED", "CANCELLED", "ARCHIVED", "TIMED_OUT"].includes(status);
}

function formatRelativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(ms / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function QARunsPage() {
  const { appId, selectedOrgId, isLoading: loadingApplication } = useSelectedApplication();
  const runs = useQuery<QARun[]>({
    queryKey: ["qa-runs", appId],
    enabled: Boolean(appId),
    queryFn: async () => {
      const response = await authenticatedFetch(`/api-gateway/applications/${appId}/qa-runs`);
      if (!response.ok) throw new Error("Unable to load QA runs");
      return response.json();
    },
    // A run in progress used to sit at whatever status the page was loaded with until somebody reloaded it.
    refetchInterval: (query) => ((query.state.data ?? []).some((run) => isRunActive(run.status)) ? 10_000 : false),
  });
  const [mode, setMode] = useState<string>("ALL");

  if (!selectedOrgId) return <div className="font-mono text-sm text-[#8e9192]">Select an organization to view QA runs.</div>;
  if (loadingApplication || runs.isLoading) return <QARunsSkeleton />;
  if (!appId) return <ApplicationRequiredState feature="QA runs" />;

  const all = runs.data ?? [];
  const list = mode === "ALL" ? all : all.filter((run) => run.mode === mode);
  // Only offer a filter for the modes this application actually has runs in.
  const modes = [...new Set(all.map((run) => run.mode))].filter((candidate) => MODE_LABELS[candidate]);

  return (
    <div className="space-y-6">
      <div className="border-b border-[#262626] pb-5">
        <h1 className="text-3xl font-bold tracking-tight text-white">QA Runs</h1>
        <p className="mt-1 text-sm text-[#c4c7c8]">
          Guided, assisted and automated desktop runs: captured evidence, findings, reconciliation and reports.
        </p>
        {modes.length > 1 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {["ALL", ...modes].map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setMode(option)}
                className={
                  mode === option
                    ? "rounded border border-white/20 bg-white/10 px-2.5 py-1 font-mono text-[11px] uppercase tracking-wider text-white"
                    : "rounded border border-[#262626] px-2.5 py-1 font-mono text-[11px] uppercase tracking-wider text-[#8e9192] transition-colors hover:border-[#3a3a3a] hover:text-white"
                }
              >
                {option === "ALL" ? "All modes" : MODE_LABELS[option]}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {runs.error ? (
        <p role="alert" className="font-mono text-sm text-red-400">
          {(runs.error as Error).message}
        </p>
      ) : null}

      {!runs.isLoading && list.length === 0 && all.length > 0 ? (
        <p className="font-mono text-sm text-[#8e9192]">
          No {MODE_LABELS[mode]?.toLowerCase() ?? "matching"} runs for this application yet.
        </p>
      ) : !runs.isLoading && list.length === 0 ? (
        <EmptyState
          illustration="list"
          eyebrow="No runs yet"
          title="Run your first QA session"
          description="Open Tellann Desktop to drive a run against this application — guided, or automated against a Flow you have declared. Evidence, findings and the report land here as soon as it completes."
          primaryAction={{ label: "Start a demonstration", href: `/qa-runs/new?appId=${appId}` }}
        />
      ) : (
        <div className="grid gap-3">
          {list.map((run) => (
            <Link
              key={run.id}
              href={`/qa-runs/${run.id}`}
              className="group block rounded-md border border-[#262626] bg-[#131313] p-5 transition-colors hover:border-[#3a3a3a] hover:bg-[#161616]"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-semibold text-white">{run.environment.name}</span>
                    <span className="rounded border border-[#262626] bg-black px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-[#8e9192]">
                      {run.environment.type}
                    </span>
                    <span className="rounded border border-[#262626] bg-black px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-[#8e9192]">
                      {MODE_LABELS[run.mode] ?? run.mode}
                    </span>
                    <RunStatusBadge status={run.status} />
                  </div>
                  <p className="mt-2 truncate font-mono text-xs text-[#8e9192]">{run.targetUrl}</p>
                  {isRunActive(run.status) && run.automation?.awaitingUser ? (
                    <p className="mt-2 font-mono text-xs text-amber-400">Waiting for somebody at the desktop</p>
                  ) : isRunActive(run.status) && run.automation?.executionPhase ? (
                    <p className="mt-2 font-mono text-xs text-[#8e9192]">{describeExecutionPhase(run.automation.executionPhase)}</p>
                  ) : null}
                  <p className="mt-2 font-mono text-[11px] text-[#5a5a5a]">
                    {formatRelativeTime(run.createdAt)} · {run.id.slice(0, 8)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-4">
                  <div className="flex flex-col items-end gap-1.5 font-mono text-xs">
                    <span className="flex items-center gap-1.5 text-[#8e9192]">
                      <FileSearch className="h-3 w-3" aria-hidden="true" />
                      {run._count.artifacts} artifacts
                    </span>
                    <span
                      className={
                        run._count.findings > 0
                          ? "flex items-center gap-1.5 text-amber-400"
                          : "flex items-center gap-1.5 text-[#5a5a5a]"
                      }
                    >
                      <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                      {run._count.findings} findings
                    </span>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-[#444748] transition-colors group-hover:text-white" aria-hidden="true" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
