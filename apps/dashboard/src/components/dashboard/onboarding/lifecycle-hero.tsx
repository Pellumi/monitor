"use client";

import React from "react";
import Link from "next/link";
import { useDashboard } from "../core/dashboard-provider";
import { Sparkles, Radio, Loader2, CheckCircle2, TrendingUp } from "lucide-react";

export function LifecycleHero() {
  const { data, state } = useDashboard();

  if (state.lifecycle === "NEW_ACCOUNT") {
    return (
      <div className="rounded-lg border border-[#2d2d2d] bg-gradient-to-r from-[#171717] via-[#141414] to-[#171717] p-6 text-white space-y-4">
        <div className="flex items-center gap-2 text-xs font-mono text-emerald-400 font-semibold tracking-wider uppercase">
          <Sparkles className="w-4 h-4" />
          Welcome to Tellann Quality Intelligence
        </div>
        <h2 className="text-xl font-bold tracking-tight">
          Teach Tellann how your application behaves
        </h2>
        <p className="text-sm text-neutral-300 max-w-2xl leading-relaxed">
          Connect your application and run one normal walkthrough. Tellann will
          observe the session and turn it into workflows, coverage analysis,
          missing states, missing flows, endpoint intelligence, and a replayable
          behavioral timeline.
        </p>
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <Link
            href="/onboarding"
            className="px-4 py-2 bg-white text-black font-semibold rounded text-xs hover:bg-neutral-200 transition-colors shadow-sm"
          >
            Create Your Application
          </Link>
          <a
            href="https://docs.tellann.io"
            target="_blank"
            rel="noreferrer"
            className="px-4 py-2 border border-[#3a3a3a] text-neutral-300 font-medium rounded text-xs hover:bg-[#222] transition-colors"
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
      <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/10 p-6 text-white space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-mono text-emerald-400 font-semibold uppercase tracking-wider">
            <Radio className="w-4 h-4 animate-pulse text-emerald-400" />
            Live Demonstration Recording Active
          </div>
          <span className="text-xs font-mono text-neutral-400">
            Started at 08:42
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-2 border-y border-emerald-500/20 font-mono">
          <div>
            <span className="text-[10px] uppercase text-neutral-400 block">
              Events Captured
            </span>
            <span className="text-lg font-bold text-emerald-300">
              {live?.eventCount ?? 387}
            </span>
          </div>
          <div>
            <span className="text-[10px] uppercase text-neutral-400 block">
              States Observed
            </span>
            <span className="text-lg font-bold text-white">
              {live?.stateCount ?? 14}
            </span>
          </div>
          <div>
            <span className="text-[10px] uppercase text-neutral-400 block">
              Transitions Observed
            </span>
            <span className="text-lg font-bold text-white">
              {live?.transitionCount ?? 22}
            </span>
          </div>
          <div>
            <span className="text-[10px] uppercase text-neutral-400 block">
              API Calls Captured
            </span>
            <span className="text-lg font-bold text-white">
              {live?.apiCallCount ?? 81}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between pt-1">
          <div className="text-xs text-neutral-300 font-mono">
            ● Observing user interactions & network requests...
          </div>
          <Link
            href="/qa-runs"
            className="px-4 py-2 bg-emerald-500 text-black font-bold text-xs rounded hover:bg-emerald-400 transition-colors shadow-sm"
          >
            Stop & Analyze Session
          </Link>
        </div>
      </div>
    );
  }

  if (state.lifecycle === "ANALYSIS_IN_PROGRESS") {
    return (
      <div className="rounded-lg border border-amber-500/30 bg-amber-950/10 p-6 text-white space-y-4">
        <div className="flex items-center gap-2 text-xs font-mono text-amber-400 font-semibold uppercase tracking-wider">
          <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
          Analyzing Your Demonstration
        </div>
        <h2 className="text-lg font-bold tracking-tight">
          Constructing behavioral graph & missing state intelligence...
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs font-mono py-2">
          <div className="flex items-center gap-2 text-emerald-400">
            <CheckCircle2 className="w-4 h-4" /> Session reconstructed
          </div>
          <div className="flex items-center gap-2 text-emerald-400">
            <CheckCircle2 className="w-4 h-4" /> Events ordered & sanitized
          </div>
          <div className="flex items-center gap-2 text-emerald-400">
            <CheckCircle2 className="w-4 h-4" /> States & transitions extracted
          </div>
          <div className="flex items-center gap-2 text-amber-300 font-bold">
            <Loader2 className="w-4 h-4 animate-spin" /> Discovering workflows
          </div>
          <div className="flex items-center gap-2 text-neutral-500">
            ○ Calculating workflow coverage
          </div>
          <div className="flex items-center gap-2 text-neutral-500">
            ○ Generating quality report
          </div>
        </div>
      </div>
    );
  }

  if (state.lifecycle === "ACTIVE" && data?.summary) {
    const { summary, coverage } = data;
    return (
      <div className="rounded-lg border border-[#262626] bg-[#141414] p-4 text-white">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-mono font-semibold text-neutral-300 uppercase tracking-wider">
              Since Your Previous Analysis
            </span>
          </div>
          <span className="text-[11px] font-mono text-neutral-500">
            Last analysis: {data.analysis?.lastAnalysisAt ?? "Today"}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-3 pt-3 border-t border-[#262626] text-xs font-mono">
          <span className="text-emerald-400 font-medium">
            +{summary.statesObserved.delta ?? 3} states discovered
          </span>
          <span className="text-emerald-400 font-medium">
            +{summary.transitionsObserved.delta ?? 7} transitions observed
          </span>
          <span className="text-emerald-400 font-medium">
            Workflow coverage +
            {coverage?.workflowCoverage.delta?.toFixed(1) ?? "4.7"}%
          </span>
          <span className="text-neutral-400">
            Findings: {summary.findingsCount.value?.total ?? 12} current
          </span>
        </div>
      </div>
    );
  }

  return null;
}
