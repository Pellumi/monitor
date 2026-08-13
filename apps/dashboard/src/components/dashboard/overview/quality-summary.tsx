"use client";

import React from "react";
import { useDashboard } from "../core/dashboard-provider";
import { renderMeasuredValue } from "../core/measurement-state";
import { Workflow, Layers, GitCommit, Play, AlertTriangle } from "lucide-react";

export function QualitySummary() {
  const { data, state } = useDashboard();

  if (state.lifecycle !== "ACTIVE") return null;

  const summary = data?.summary;
  const findings = summary?.findingsCount.value;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
      <SummaryMetricCard
        icon={<Workflow className="w-4 h-4 text-emerald-400" />}
        title="Workflows Discovered"
        value={renderMeasuredValue(summary?.workflowsDiscovered)}
        delta={summary?.workflowsDiscovered.delta}
      />

      <SummaryMetricCard
        icon={<Layers className="w-4 h-4 text-cyan-400" />}
        title="States Observed"
        value={renderMeasuredValue(summary?.statesObserved)}
        delta={summary?.statesObserved.delta}
      />

      <SummaryMetricCard
        icon={<GitCommit className="w-4 h-4 text-purple-400" />}
        title="Transitions Observed"
        value={renderMeasuredValue(summary?.transitionsObserved)}
        delta={summary?.transitionsObserved.delta}
      />

      <SummaryMetricCard
        icon={<Play className="w-4 h-4 text-amber-400" />}
        title="Sessions Observed"
        value={renderMeasuredValue(summary?.sessionCount)}
        delta={summary?.sessionCount.delta}
      />

      <SummaryMetricCard
        icon={<AlertTriangle className="w-4 h-4 text-red-400" />}
        title="Open Quality Findings"
        value={findings ? `${findings.total}` : renderMeasuredValue(summary?.findingsCount)}
        subtext={
          findings ? `${findings.high + findings.critical} High/Critical` : undefined
        }
      />
    </div>
  );
}

function SummaryMetricCard({
  icon,
  title,
  value,
  delta,
  subtext,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  delta?: number;
  subtext?: string;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-[#262626] bg-[#141414] px-4 py-4 sm:p-5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-mono font-medium uppercase tracking-wider text-neutral-400">
          {title}
        </span>
        {icon}
      </div>

      <div className="mt-2 flex items-baseline justify-between">
        <span className="text-2xl font-bold tracking-tight text-white font-mono">
          {value}
        </span>

        {delta !== undefined && delta !== 0 && (
          <span className="text-xs font-mono text-emerald-400 font-semibold">
            +{delta}
          </span>
        )}
      </div>

      {subtext && (
        <span className="text-[11px] font-mono text-neutral-400 mt-1 block">
          {subtext}
        </span>
      )}
    </div>
  );
}
