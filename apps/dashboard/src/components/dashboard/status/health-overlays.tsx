"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useDashboard } from "../core/dashboard-provider";
import { DashboardHealthIssue } from "../core/types";
import { AlertOctagon, Clock, HardDrive, X } from "lucide-react";

/**
 * Operational banners.
 *
 * Each issue carries the figures its copy states. The storage banner used to
 * print a hardcoded "94%" — true for no account — and blamed the retention
 * policy for deletions that retention does not perform: it runs on age, never
 * on storage pressure. Both now come from the payload.
 *
 * The `INGESTION_PROBLEM` banner was removed rather than left unreachable. No
 * ingestion rejection is recorded anywhere, so nothing could ever raise it.
 */
export function HealthOverlays() {
  const { state, data } = useDashboard();
  const applicationId = data?.application?.id ?? null;
  const [dismissed, setDismissed] = useState<string[]>([]);

  // Loaded after mount so the first (server-matching) render has nothing
  // dismissed yet — reading localStorage during render would make the
  // client's first paint disagree with the server's and trigger a hydration
  // mismatch.
  useEffect(() => {
    if (!applicationId) return;
    setDismissed(readDismissed(applicationId));
  }, [applicationId]);

  const dismiss = (key: string) => {
    if (!applicationId) return;
    const next = writeDismissed(applicationId, key);
    setDismissed(next);
  };

  const visibleIssues = state.healthIssues.filter(
    (issue) => !dismissed.includes(dismissKey(issue)),
  );

  if (visibleIssues.length === 0) return null;

  return (
    <div className="space-y-3 font-mono text-xs">
      {visibleIssues.map((issue) => (
        <HealthOverlay key={dismissKey(issue)} issue={issue} onDismiss={() => dismiss(dismissKey(issue))} />
      ))}
    </div>
  );
}

/** A stable id per *occurrence* of an issue, so resolving and recurring re-shows it. */
function dismissKey(issue: DashboardHealthIssue): string {
  switch (issue.kind) {
    case "ANALYSIS_FAILED":
      return `ANALYSIS_FAILED:${issue.runId}`;
    case "NO_RECENT_DATA":
      return `NO_RECENT_DATA:${issue.lastEventAt ?? "unknown"}`;
    case "PLAN_LIMIT_REACHED":
      return `PLAN_LIMIT_REACHED:${issue.metric}`;
    default:
      return issue satisfies never;
  }
}

function storageKey(applicationId: string): string {
  return `tellann:dismissed-health-issues:${applicationId}`;
}

function readDismissed(applicationId: string): string[] {
  try {
    const raw = window.localStorage.getItem(storageKey(applicationId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function writeDismissed(applicationId: string, key: string): string[] {
  const next = Array.from(new Set([...readDismissed(applicationId), key]));
  try {
    window.localStorage.setItem(storageKey(applicationId), JSON.stringify(next));
  } catch {
    // Dismissal still applies for this session even if it can't persist.
  }
  return next;
}

function HealthOverlay({ issue, onDismiss }: { issue: DashboardHealthIssue; onDismiss: () => void }) {
  switch (issue.kind) {
    case "ANALYSIS_FAILED":
      return (
        <Banner
          tone="danger"
          icon={<AlertOctagon className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />}
          title="Analysis could not be completed"
          body={
            issue.reason
              ? issue.reason
              : "Events were received, but the analysis did not finish."
          }
          action={{ label: "Retry analysis", href: `/qa-runs/${issue.runId}` }}
          onDismiss={onDismiss}
        />
      );

    case "NO_RECENT_DATA":
      return (
        <Banner
          tone="neutral"
          icon={<Clock className="w-4 h-4 text-neutral-400 shrink-0 mt-0.5" />}
          title="No telemetry received recently"
          body={`The last event arrived ${formatAge(issue.hoursSinceLastEvent)} ago. Findings and coverage below reflect that data, not today's.`}
          action={{ label: "Record demonstration", href: "/qa-runs/new" }}
          onDismiss={onDismiss}
        />
      );

    case "PLAN_LIMIT_REACHED":
      return (
        <Banner
          tone="warning"
          icon={<HardDrive className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />}
          title={
            issue.metric === "STORAGE"
              ? `Storage is at ${issue.usedPercent}% of your ${issue.planName} plan`
              : `You are using ${issue.used} of ${issue.limit} applications`
          }
          body={
            issue.consequence === "NEW_UPLOADS_REJECTED"
              ? `${formatMb(issue.used)} of ${formatMb(issue.limit)} used. New report exports and run artifacts will be rejected until you free space or upgrade. Nothing already stored is removed.`
              : "You cannot create another application on this plan until you upgrade or remove one."
          }
          action={{ label: "View plan", href: "/settings/billing" }}
          onDismiss={onDismiss}
        />
      );

    default:
      return null;
  }
}

const TONES = {
  danger: "border-red-500/40 bg-red-950/20 text-red-300",
  warning: "border-purple-500/40 bg-purple-950/20 text-purple-300",
  neutral: "border-[#333] bg-[#1a1a1a] text-neutral-300",
} as const;

const ACTION_TONES = {
  danger: "bg-red-500 text-black hover:bg-red-400",
  warning: "bg-purple-500 text-white hover:bg-purple-400",
  neutral: "bg-white text-black hover:bg-neutral-200",
} as const;

function Banner({
  tone,
  icon,
  title,
  body,
  action,
  onDismiss,
}: {
  tone: keyof typeof TONES;
  icon: React.ReactNode;
  title: string;
  body: string;
  action: { label: string; href: string };
  onDismiss: () => void;
}) {
  return (
    <div className={`p-4 rounded-md border flex items-start justify-between gap-4 ${TONES[tone]}`}>
      <div className="flex items-start gap-3">
        {icon}
        <div>
          <h4 className="font-bold text-white">{title}</h4>
          <p className="text-neutral-300 mt-0.5 leading-relaxed">{body}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Link
          href={action.href}
          className={`px-3 py-1 font-bold text-xs rounded shrink-0 ${ACTION_TONES[tone]}`}
        >
          {action.label}
        </Link>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="p-1 rounded text-neutral-400 hover:text-white hover:bg-white/10 transition"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

/** Hours are what the payload carries; days are what a person reads. */
function formatAge(hours: number): string {
  if (hours < 48) return `${hours} hours`;
  return `${Math.floor(hours / 24)} days`;
}

function formatMb(mb: number): string {
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${Math.round(mb)} MB`;
}
