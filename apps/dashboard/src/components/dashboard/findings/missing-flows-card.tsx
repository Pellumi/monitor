"use client";

import React from "react";
import Link from "next/link";
import { useDashboard } from "../core/dashboard-provider";
import { ArrowRight, GitFork } from "lucide-react";

export function MissingFlowsCard() {
  const { data, state } = useDashboard();

  if (state.lifecycle !== "ACTIVE") return null;

  const missingFlows = data?.missingFlows ?? [];
  const analysisCount = data?.analysis?.analysisCount ?? 0;

  return (
    <div className="rounded-lg border border-[#262626] bg-[#141414] p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-white font-mono tracking-tight flex items-center gap-2">
            <GitFork className="w-4 h-4 text-purple-400" />
            Recent Missing Flows
          </h3>
          <p className="text-xs text-neutral-400 font-mono mt-0.5">
            Failure, recovery, & alternative trajectory gaps
          </p>
        </div>
        <Link
          href={`/missing-flows?appId=${data?.application?.id ?? ""}`}
          className="text-xs font-mono text-emerald-400 hover:underline flex items-center gap-1 font-semibold"
        >
          View All
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* 3-Tier Empty State */}
      {analysisCount === 0 ? (
        <div className="py-8 text-center text-xs font-mono text-neutral-400 space-y-1">
          <p className="text-white font-semibold">Missing flows have not been analyzed yet</p>
          <p className="text-neutral-500">Record a session to detect unobserved workflow branches.</p>
        </div>
      ) : missingFlows.length === 0 ? (
        <div className="py-8 text-center text-xs font-mono text-emerald-400 space-y-1">
          <p className="font-semibold">No missing flows detected</p>
          <p className="text-neutral-500">All key failure and alternative paths observed.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {missingFlows.slice(0, 3).map((flow) => (
            <div
              key={flow.id}
              className="p-3 rounded border border-[#262626] bg-[#181818] space-y-2 hover:border-[#3a3a3a] transition-colors"
            >
              <div className="flex items-center justify-between font-mono">
                <span className="text-xs font-bold text-white">
                  {flow.flowName}
                </span>
                <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 uppercase">
                  {flow.severity}
                </span>
              </div>
              <div className="text-[11px] font-mono text-neutral-400">
                Workflow: {flow.workflowName}
              </div>
              <div className="text-[11px] font-mono text-purple-300 bg-[#111] p-2 rounded border border-[#2d2d2d] overflow-x-auto">
                {flow.path.join(" -> ")}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
