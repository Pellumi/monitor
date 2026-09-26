"use client";

import React from "react";
import Link from "next/link";
import { useDashboard } from "../core/dashboard-provider";
import { SeverityTag } from "./severity-tag";
import { ArrowRight, Bug } from "lucide-react";

/**
 * Defects observed during runs, as distinct from gaps inferred by a rule.
 *
 * Kept apart from the missing-state and missing-flow cards on purpose. "A rule
 * expects an error state nobody has seen" and "this page crashed" are different
 * kinds of claim, and one list would erase the difference.
 *
 * These belong to their run and have no resolution — a browser finding cannot
 * be closed the way a missing state can — so this is findings *from recent
 * runs*, not an open-issue list, and the copy says so.
 */
export function ObservedFindingsCard() {
  const { data, state } = useDashboard();

  if (state.lifecycle !== "ACTIVE") return null;

  const findings = data?.observedFindings ?? [];
  if (findings.length === 0) return null;

  const applicationId = data?.application?.id ?? "";

  return (
    <div className="rounded-lg border border-[#262626] bg-[#141414] p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-white font-mono tracking-tight flex items-center gap-2">
            <Bug className="w-4 h-4 text-red-400" aria-hidden="true" />
            Observed during runs
          </h3>
          <p className="text-xs text-neutral-400 font-mono mt-0.5">
            Defects captured while your application was running
          </p>
        </div>
        <Link
          href={`/qa-runs?appId=${applicationId}`}
          className="text-xs font-mono text-emerald-400 hover:underline flex items-center gap-1 font-semibold"
        >
          View runs
          <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
        </Link>
      </div>

      <div className="space-y-3">
        {findings.slice(0, 4).map((finding) => (
          <div
            key={finding.id}
            className="p-3 rounded border border-[#262626] bg-[#181818] space-y-1.5"
          >
            <div className="flex items-start justify-between gap-3">
              <span className="text-xs font-bold text-white font-mono">{finding.title}</span>
              <SeverityTag severity={finding.severity} />
            </div>

            <p className="text-[11px] font-mono text-neutral-400 leading-relaxed">
              {finding.description}
            </p>

            <div className="flex items-center justify-between text-[10px] font-mono text-neutral-500 pt-0.5">
              <span>{humaniseCategory(finding.category)}</span>
              <Link
                href={`/qa-runs/${finding.runId}`}
                className="text-neutral-400 hover:text-white underline"
              >
                See the run
              </Link>
            </div>

            {finding.recommendation && (
              <p className="text-[11px] font-mono text-emerald-400/90 leading-relaxed pt-1 border-t border-[#262626]">
                {finding.recommendation}
              </p>
            )}
          </div>
        ))}
      </div>

      <p className="text-[10px] text-neutral-500 leading-relaxed">
        Findings belong to the run that captured them and are not tracked to closure.
      </p>
    </div>
  );
}

/** `FRONTEND_PAGE_CRASH` reads badly; the detector's vocabulary is not copy. */
function humaniseCategory(category: string): string {
  const words = category.toLowerCase().replace(/_/g, " ").trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : "Finding";
}
