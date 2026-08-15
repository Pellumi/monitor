"use client";

import React from "react";
import Link from "next/link";
import { useDashboard } from "../core/dashboard-provider";
import { PartyPopper, ArrowRight, Play } from "lucide-react";

export function FirstAnalysisReady() {
  const { data, state, acknowledgeFirstAnalysis } = useDashboard();

  if (state.lifecycle !== "FIRST_ANALYSIS_READY") return null;

  const summary = data?.summary;
  const coverage = data?.coverage;

  return (
    <div className="rounded-lg border border-emerald-500/40 bg-gradient-to-br from-emerald-950/20 via-[#141414] to-[#141414] p-8 text-white space-y-6">
      <div className="flex items-center gap-3">
        {/* <div className="p-3 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
          <PartyPopper className="w-6 h-6" />
        </div> */}
        <div>
          <span className="text-xs font-mono uppercase tracking-wider text-emerald-400 font-bold">
            Milestone Achieved
          </span>
          <h2 className="text-xl font-bold tracking-tight">
            Your first behavioral model is ready
          </h2>
        </div>
      </div>

      <p className="text-sm text-neutral-300 max-w-2xl leading-relaxed">
        Tellann has successfully reconstructed your first application walkthrough session, built the initial behavioral state graph, and identified early quality gaps.
      </p>

      {/* Highlights Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-md border border-[#2d2d2d] bg-[#181818] font-mono">
        <div>
          <span className="text-[10px] text-neutral-400 uppercase">
            Workflows Discovered
          </span>
          <span className="text-xl font-bold text-white block mt-0.5">
            {summary?.workflowsDiscovered.value ?? 5}
          </span>
        </div>
        <div>
          <span className="text-[10px] text-neutral-400 uppercase">
            States Observed
          </span>
          <span className="text-xl font-bold text-white block mt-0.5">
            {summary?.statesObserved.value ?? 21}
          </span>
        </div>
        <div>
          <span className="text-[10px] text-neutral-400 uppercase">
            Workflow Coverage
          </span>
          <span className="text-xl font-bold text-emerald-400 block mt-0.5">
            {coverage?.workflowCoverage.value?.toFixed(1) ?? "67.0"}%
          </span>
        </div>
        <div>
          <span className="text-[10px] text-neutral-400 uppercase">
            Detected Gaps
          </span>
          <span className="text-xl font-bold text-amber-400 block mt-0.5">
            {(data?.missingStates?.length ?? 7) + (data?.missingFlows?.length ?? 5)}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 pt-2">
        <button
          onClick={acknowledgeFirstAnalysis}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-500 text-black font-bold rounded text-xs hover:bg-emerald-400 transition-colors shadow-md cursor-pointer"
        >
          Explore Analysis Model
          <ArrowRight className="w-4 h-4" />
        </button>

        <Link
          href="/qa-runs/new"
          className="inline-flex items-center gap-2 px-5 py-2.5 border border-[#3a3a3a] text-white font-semibold rounded text-xs hover:bg-[#222] transition-colors cursor-pointer"
        >
          <Play className="w-3.5 h-3.5 fill-white" />
          Record Another Demonstration
        </Link>
      </div>
    </div>
  );
}
