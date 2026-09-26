"use client";

import React from "react";
import Link from "next/link";
import { useDashboard } from "../core/dashboard-provider";
import { ArrowRight, GitCompare } from "lucide-react";

/**
 * Declared behaviour against observed behaviour.
 *
 * Reconciliation has been computed and stored all along — the overview fetched
 * it and threw it away, so the one thing that distinguishes this product from a
 * coverage report was invisible on its main page.
 *
 * Renders nothing when no flow has been declared: an application that has not
 * attempted declaration has not scored zero at it.
 */
export function ExpectedVsObserved() {
  const { data, state } = useDashboard();

  if (state.lifecycle !== "ACTIVE") return null;

  const model = data?.expectedVsObserved;
  if (!model) return null;

  const { expected, topGaps } = model;
  const applicationId = data?.application?.id ?? "";

  return (
    <div className="rounded-lg border border-[#262626] bg-[#141414] p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-white font-mono tracking-tight flex items-center gap-2">
            <GitCompare className="w-4 h-4 text-cyan-400" />
            Expected vs Observed
          </h3>
          <p className="text-xs text-neutral-400 font-mono mt-0.5">
            {expected.declaredFlowCount} declared{" "}
            {expected.declaredFlowCount === 1 ? "flow" : "flows"} ·{" "}
            {expected.expectedStateCount} states · {expected.expectedTransitionCount} transitions
          </p>
        </div>
        <Link
          href={`/reconciliation?appId=${applicationId}`}
          className="text-xs font-mono text-emerald-400 hover:underline flex items-center gap-1 font-semibold"
        >
          Open Reconciliation
          <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
        </Link>
      </div>

      {topGaps.length === 0 ? (
        <p className="py-6 text-center text-xs font-mono text-neutral-500">
          Nothing reconciled yet. Run a demonstration against a declared flow to
          compare what you declared with what actually happens.
        </p>
      ) : (
        <div className="space-y-3">
          {topGaps.map((gap) => {
            const totalGaps = gap.trueGapStateCount + gap.trueGapTransitionCount;
            return (
              <div
                key={gap.reportId}
                className="p-3 rounded border border-[#262626] bg-[#181818] space-y-2"
              >
                <div className="flex items-center justify-between font-mono">
                  <span className="text-xs font-bold text-white">{gap.flowName}</span>
                  <span
                    className={`text-xs font-bold ${
                      gap.expectedCoverage >= 80
                        ? "text-emerald-400"
                        : gap.expectedCoverage >= 50
                        ? "text-amber-400"
                        : "text-red-400"
                    }`}
                  >
                    {gap.expectedCoverage}% of declared behaviour observed
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-mono text-neutral-400">
                  <span>
                    {totalGaps === 0 ? (
                      <span className="text-emerald-400">No unobserved declarations</span>
                    ) : (
                      <>
                        <span className="text-amber-400 font-bold">{totalGaps}</span> declared but
                        never observed
                        {gap.trueGapStateCount > 0 && ` (${gap.trueGapStateCount} states)`}
                      </>
                    )}
                  </span>
                  {gap.undeclaredStateCount > 0 && (
                    <span>
                      <span className="text-cyan-400 font-bold">{gap.undeclaredStateCount}</span>{" "}
                      observed but never declared
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3 pt-1 border-t border-[#262626]">
                  <Link
                    href={`/reconciliation?appId=${applicationId}&flowId=${gap.flowId}`}
                    className="text-[11px] font-mono text-neutral-400 hover:text-white underline"
                  >
                    Inspect gaps
                  </Link>
                  <Link
                    href={`/graph-drift?appId=${applicationId}&flowId=${gap.flowId}`}
                    className="text-[11px] font-mono text-neutral-400 hover:text-white underline"
                  >
                    See drift over time
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
