"use client";

import React from "react";
import Link from "next/link";
import { useDashboard } from "../core/dashboard-provider";
import { DashboardHealthIssue } from "../core/types";
import { AlertOctagon, Clock, HardDrive } from "lucide-react";

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
  const { state } = useDashboard();

  if (state.healthIssues.length === 0) return null;

  return (
    <div className="space-y-3 font-mono text-xs">
      {state.healthIssues.map((issue, index) => (
        <HealthOverlay key={`${issue.kind}-${index}`} issue={issue} />
      ))}
    </div>
  );
}

function HealthOverlay({ issue }: { issue: DashboardHealthIssue }) {
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
}: {
  tone: keyof typeof TONES;
  icon: React.ReactNode;
  title: string;
  body: string;
  action: { label: string; href: string };
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
      <Link
        href={action.href}
        className={`px-3 py-1 font-bold text-xs rounded shrink-0 ${ACTION_TONES[tone]}`}
      >
        {action.label}
      </Link>
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
