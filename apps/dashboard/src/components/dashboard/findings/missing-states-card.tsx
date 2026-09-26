"use client";

import React from "react";
import Link from "next/link";
import { useDashboard } from "../core/dashboard-provider";
import { ArrowRight, AlertTriangle } from "lucide-react";
import { SeverityTag } from "./severity-tag";

export function MissingStatesCard() {
  const { data, state } = useDashboard();

  if (state.lifecycle !== "ACTIVE") return null;

  const missingStates = data?.missingStates ?? [];
  const analysisCount = data?.analysis?.analysisCount ?? 0;

  return (
    <div className="rounded-lg border border-[#262626] bg-[#141414] p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-white font-mono tracking-tight flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            Top Missing States
          </h3>
          <p className="text-xs text-neutral-400 font-mono mt-0.5">
            Unobserved UI, error, & loading state gaps
          </p>
        </div>
        <Link
          href={`/missing-states?appId=${data?.application?.id ?? ""}`}
          className="text-xs font-mono text-emerald-400 hover:underline flex items-center gap-1 font-semibold"
        >
          View All
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* 3-Tier Empty State handling */}
      {analysisCount === 0 ? (
        <div className="py-8 text-center text-xs font-mono text-neutral-400 space-y-1">
          <p className="text-white font-semibold">Missing states have not been analyzed yet</p>
          <p className="text-neutral-500">Complete a demonstration to begin detection.</p>
        </div>
      ) : missingStates.length === 0 ? (
        <div className="py-8 text-center text-xs font-mono text-emerald-400 space-y-1">
          <p className="font-semibold">No missing states detected</p>
          <p className="text-neutral-500">All required state categories observed in current workflows.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {missingStates.slice(0, 4).map((item) => (
            <div
              key={item.id}
              className="p-3 rounded border border-[#262626] bg-[#181818] space-y-1 hover:border-[#3a3a3a] transition-colors"
            >
              <div className="flex items-center justify-between font-mono">
                <span className="text-xs font-bold text-white font-mono">
                  {item.stateName}
                </span>
                <SeverityTag severity={item.severity} />
              </div>
              <div className="flex items-center justify-between text-[11px] font-mono text-neutral-400">
                {/* The state this gap was inferred from — a real observed
                    state, unlike the "Application Workflow" placeholder that
                    used to sit here. */}
                <span>{item.workflowName ? `After: ${item.workflowName}` : "Source unrecorded"}</span>
                {/* Only shown when the detecting rule actually classified it. */}
                {item.category && <span className="text-neutral-500">{item.category}</span>}
              </div>
              <p className="text-[11px] font-mono text-amber-400/90 leading-tight pt-1">
                {item.evidence}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
