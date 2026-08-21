"use client";

import React from "react";
import Link from "next/link";
import { useDashboard } from "../core/dashboard-provider";
import { Sparkles, Radio, Loader2, CheckCircle2, TrendingUp } from "lucide-react";

export function LifecycleHero() {
  const { data, state } = useDashboard();

  if (state.lifecycle === "NEW_ACCOUNT") {
    return (
      <div className="rounded-md border border-[#262626] bg-[#131313] p-6 text-white space-y-4">
        <div className="flex items-center justify-between border-b border-[#262626] pb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-white" />
            <span className="text-sm font-semibold text-white">Welcome to Tellann</span>
          </div>
          <span className="inline-block border border-[#444748] text-[#8e9192] px-2 py-0.5 text-[11px] font-mono tracking-wider uppercase rounded-sm">
            Onboarding // Setup
          </span>
        </div>
        <h2 className="text-lg font-semibold tracking-tight text-white">
          Teach Tellann how your application behaves
        </h2>
        <p className="text-sm text-[#c4c7c8] max-w-2xl leading-relaxed">
          Connect your application and run one normal walkthrough. Tellann will
          observe the session and turn it into workflows, coverage analysis,
          missing states, missing flows, endpoint intelligence, and a replayable
          behavioral timeline.
        </p>
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <Link
            href="/onboarding"
            className="px-4 py-2 bg-white text-black font-semibold rounded-sm text-xs uppercase tracking-wider hover:bg-neutral-200 transition-colors"
          >
            Create Your Application
          </Link>
          <a
            href="https://docs.tellann.co"
            target="_blank"
            rel="noreferrer"
            className="px-4 py-2 border border-[#444748] bg-black text-[#8e9192] font-mono text-xs uppercase tracking-wider rounded-sm hover:text-white hover:border-white transition-colors"
          >
            View Quick Start Guide
          </a>
        </div>
      </div>
    );
  }

  if (state.lifecycle === "DEMONSTRATION_IN_PROGRESS") {
    const live = data?.liveDemonstration;
    return (
      <div className="rounded-md border border-[#262626] bg-[#131313] p-6 text-white space-y-4">
        <div className="flex items-center justify-between border-b border-[#262626] pb-3">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 animate-pulse text-emerald-400" />
            <span className="text-sm font-semibold text-white">Live Demonstration Recording Active</span>
          </div>
          <span className="inline-block border border-[#444748] text-[#8e9192] px-2 py-0.5 text-[11px] font-mono tracking-wider uppercase rounded-sm">
            Live // Recording
          </span>
        </div>

        <div className="bg-black border border-[#262626] rounded-sm divide-y divide-[#262626] font-mono text-xs">
          <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-[#262626]">
            <div className="p-3">
              <span className="text-[#8e9192] text-[10px] uppercase tracking-wider block">
                Events Captured
              </span>
              <span className="text-base font-bold text-white mt-1 block">
                {live?.eventCount ?? "Pending"}
              </span>
            </div>
            <div className="p-3">
              <span className="text-[#8e9192] text-[10px] uppercase tracking-wider block">
                States Observed
              </span>
              <span className="text-base font-bold text-white mt-1 block">
                {live?.stateCount ?? "Pending"}
              </span>
            </div>
            <div className="p-3">
              <span className="text-[#8e9192] text-[10px] uppercase tracking-wider block">
                Transitions
              </span>
              <span className="text-base font-bold text-white mt-1 block">
                {live?.transitionCount ?? "Pending"}
              </span>
            </div>
            <div className="p-3">
              <span className="text-[#8e9192] text-[10px] uppercase tracking-wider block">
                API Calls
              </span>
              <span className="text-base font-bold text-white mt-1 block">
                {live?.apiCallCount ?? "Pending"}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-1">
          <div className="text-xs text-[#8e9192] font-mono">
            Observing user interactions and network requests...
          </div>
          <Link
            href="/qa-runs"
            className="px-4 py-2 bg-white text-black font-semibold text-xs rounded-sm uppercase tracking-wider hover:bg-neutral-200 transition-colors"
          >
            Stop & Analyze Session
          </Link>
        </div>
      </div>
    );
  }

  if (state.lifecycle === "ANALYSIS_IN_PROGRESS") {
    return (
      <div className="rounded-md border border-[#262626] bg-[#131313] p-6 text-white space-y-4">
        <div className="flex items-center justify-between border-b border-[#262626] pb-3">
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-white" />
            <span className="text-sm font-semibold text-white">Analyzing Demonstration</span>
          </div>
          <span className="inline-block border border-[#444748] text-[#8e9192] px-2 py-0.5 text-[11px] font-mono tracking-wider uppercase rounded-sm">
            Analysis // Processing
          </span>
        </div>
        <h2 className="text-base font-semibold tracking-tight text-white">
          Constructing behavioral graph & missing state intelligence...
        </h2>

        <div className="bg-black border border-[#262626] rounded-sm p-4 font-mono text-xs grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="flex items-center gap-2 text-white">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> Session reconstructed
          </div>
          <div className="flex items-center gap-2 text-white">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> Events ordered & sanitized
          </div>
          <div className="flex items-center gap-2 text-white">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> States & transitions extracted
          </div>
          <div className="flex items-center gap-2 text-white font-bold">
            <Loader2 className="w-4 h-4 animate-spin text-amber-400 shrink-0" /> Discovering workflows
          </div>
          <div className="flex items-center gap-2 text-[#8e9192]">
            Pending: calculating workflow coverage
          </div>
          <div className="flex items-center gap-2 text-[#8e9192]">
            Pending: generating quality report
          </div>
        </div>
      </div>
    );
  }

  if (state.lifecycle === "ACTIVE" && data?.summary) {
    const { summary, coverage } = data;
    return (
      <div className="rounded-md border border-[#262626] bg-[#131313] p-5 text-white space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#262626] pb-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-white" />
            <span className="text-sm font-semibold text-white">Analysis Delta</span>
          </div>
          <span className="inline-block border border-[#444748] text-[#8e9192] px-2 py-0.5 text-[11px] font-mono tracking-wider uppercase rounded-sm">
            Last analysis: {data.analysis?.lastAnalysisAt ?? "Pending"}
          </span>
        </div>

        <div className="bg-black border border-[#262626] rounded-sm divide-y sm:divide-y-0 sm:divide-x divide-[#262626] grid grid-cols-1 sm:grid-cols-4 font-mono text-xs">
          <div className="p-3">
            <span className="text-[#8e9192] text-[10px] uppercase tracking-wider block">
              States Discovered
            </span>
            <span className="text-sm font-bold text-white mt-1 block">
              {summary.statesObserved.delta != null ? `${summary.statesObserved.delta >= 0 ? "+" : ""}${summary.statesObserved.delta} states` : "Pending"}
            </span>
          </div>
          <div className="p-3">
            <span className="text-[#8e9192] text-[10px] uppercase tracking-wider block">
              Transitions
            </span>
            <span className="text-sm font-bold text-white mt-1 block">
              {summary.transitionsObserved.delta != null ? `${summary.transitionsObserved.delta >= 0 ? "+" : ""}${summary.transitionsObserved.delta} observed` : "Pending"}
            </span>
          </div>
          <div className="p-3">
            <span className="text-[#8e9192] text-[10px] uppercase tracking-wider block">
              Workflow Coverage
            </span>
            <span className="text-sm font-bold text-white mt-1 block">
              {coverage?.workflowCoverage.delta != null ? `${coverage.workflowCoverage.delta >= 0 ? "+" : ""}${coverage.workflowCoverage.delta.toFixed(1)}%` : "Pending"}
            </span>
          </div>
          <div className="p-3">
            <span className="text-[#8e9192] text-[10px] uppercase tracking-wider block">
              Current Findings
            </span>
            <span className="text-sm font-bold text-white mt-1 block">
              {summary.findingsCount.value?.total != null ? `${summary.findingsCount.value.total} total` : "Pending"}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
