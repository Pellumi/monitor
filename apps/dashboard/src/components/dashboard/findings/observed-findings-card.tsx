"use client";

import React from "react";
import Link from "next/link";
import { useDashboard } from "../core/dashboard-provider";
import { SeverityTag } from "./severity-tag";
import { ArrowRight, Bug } from "lucide-react";

/**
 * What was actually observed going wrong, as distinct from gaps inferred by a rule.
 *
 * Kept apart from the missing-state and missing-flow cards on purpose. "A rule expects an
 * error state nobody has seen" and "this page crashed" are different kinds of claim, and one
 * list would erase the difference.
 *
 * Two origins share this card, and the row says which:
 *
 *  - BROWSER_RUN: something went wrong during a guided run, in front of someone. It belongs
 *    to that run, has no resolution concept, and links to the run.
 *  - OBSERVED_SESSION: a pattern across production traffic -- "errors concentrate here",
 *    not "this crashed once". It is application-scoped, it can be resolved, and it links to
 *    the sessions that show it, because an aggregate claim should be checkable.
 */
export function ObservedFindingsCard() {
  const { data, state } = useDashboard();

  if (state.lifecycle !== "ACTIVE") return null;

  const findings = data?.observedFindings ?? [];
  if (findings.length === 0) return null;

  const applicationId = data?.application?.id ?? "";
  const frictionCount = findings.filter((finding) => finding.origin === "OBSERVED_SESSION").length;
  const runCount = findings.length - frictionCount;

  return (
    <div className="rounded-lg border border-[#262626] bg-[#141414] p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-white font-mono tracking-tight flex items-center gap-2">
            <Bug className="w-4 h-4 text-red-400" aria-hidden="true" />
            Observed going wrong
          </h3>
          <p className="text-xs text-neutral-400 font-mono mt-0.5">
            {frictionCount > 0 && runCount > 0
              ? `${frictionCount} pattern${frictionCount === 1 ? "" : "s"} in production, ${runCount} from runs`
              : frictionCount > 0
                ? "Patterns across your real traffic"
                : "Defects captured while your application was running"}
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

            <div className="flex items-center justify-between gap-3 text-[10px] font-mono text-neutral-500 pt-0.5">
              <span className="flex items-center gap-2">
                {humaniseCategory(finding.category)}
                {finding.origin === "OBSERVED_SESSION" && finding.affectedSessions ? (
                  // The volume behind the claim, because a ratio without a denominator is
                  // not a finding -- "30% of 6 sessions" and "30% of 600" are different
                  // facts and only one is worth acting on.
                  <span className="text-neutral-600">
                    {finding.affectedSessions} session{finding.affectedSessions === 1 ? "" : "s"}
                  </span>
                ) : null}
              </span>

              {finding.origin === "OBSERVED_SESSION" ? (
                // Deep-links into the filtered session list, so the reader lands on the
                // evidence rather than on a claim they have to go and verify by hand.
                <Link
                  href={
                    finding.relatedStateName
                      ? `/sessions?appId=${applicationId}&stateName=${encodeURIComponent(finding.relatedStateName)}${
                          finding.category === "FRICTION_ABANDONMENT" ? "&abandoned=1" : "&hasError=1"
                        }`
                      : `/sessions?appId=${applicationId}&hasError=1`
                  }
                  className="text-neutral-400 hover:text-white underline whitespace-nowrap"
                >
                  See the sessions
                </Link>
              ) : (
                <Link
                  href={`/qa-runs/${finding.runId}`}
                  className="text-neutral-400 hover:text-white underline whitespace-nowrap"
                >
                  See the run
                </Link>
              )}
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
        {frictionCount > 0
          ? "Production patterns clear themselves once the behaviour stops. Run findings belong to the run that captured them and are not tracked to closure."
          : "Findings belong to the run that captured them and are not tracked to closure."}
      </p>
    </div>
  );
}

/** `FRONTEND_PAGE_CRASH` reads badly; the detector's vocabulary is not copy. */
function humaniseCategory(category: string): string {
  const words = category.toLowerCase().replace(/_/g, " ").trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : "Finding";
}
