"use client";

import React from "react";
import { useDashboard } from "../core/dashboard-provider";
import { renderMeasuredPercentage, renderMeasuredDelta } from "../core/measurement-state";
import { MeasuredValue } from "../core/types";

export function CoverageSummary() {
  const { data, state } = useDashboard();

  if (state.lifecycle !== "ACTIVE") return null;

  const coverage = data?.coverage;

  const items: Array<{
    title: string;
    measured?: MeasuredValue<number>;
    color: string;
    description: string;
  }> = [
    {
      title: "Workflow Coverage",
      measured: coverage?.workflowCoverage,
      color: "bg-emerald-500",
      description: "Demonstrated user paths vs total workflows",
    },
    {
      title: "State Coverage",
      measured: coverage?.stateCoverage,
      color: "bg-cyan-500",
      description: "Observed UI & application states",
    },
    {
      title: "Transition Coverage",
      measured: coverage?.transitionCoverage,
      color: "bg-purple-500",
      description: "Observed state-to-state transitions",
    },
    {
      title: "Endpoint Coverage",
      measured: coverage?.endpointCoverage,
      color: "bg-amber-500",
      description: "APIs called during demonstrations",
    },
    {
      title: "Error Coverage",
      measured: coverage?.errorCoverage,
      color: "bg-[#e54545]",
      description: "Demonstrated error & recovery paths",
    },
  ];

  return (
    <div className="rounded-lg border border-[#262626] bg-[#141414] p-6 space-y-6">
      <div className="flex items-center justify-between border-b border-[#262626] pb-4">
        <div>
          <h2 className="text-base font-bold text-white tracking-tight">
            Coverage Overview
          </h2>
          <p className="text-xs text-neutral-400 mt-0.5 font-mono">
            Multi-dimensional behavioral evidence coverage
          </p>
        </div>
        <span className="text-xs font-mono text-neutral-500">
          {data?.summary?.workflowsDiscovered.value != null
            ? `Derived from ${data.summary.workflowsDiscovered.value} discovered workflows`
            : "Coverage evidence pending"}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        {items.map((item, idx) => {
          const formattedVal = renderMeasuredPercentage(item.measured);
          const valNum = item.measured?.status === "MEASURED" ? item.measured.value ?? 0 : 0;
          const delta = renderMeasuredDelta(item.measured);

          return (
            <div key={idx} className="space-y-2">
              <div className="flex items-baseline justify-between text-xs font-mono">
                <span className="font-semibold text-neutral-300">{item.title}</span>
                {delta && (
                  <span
                    className={`text-[10px] ${
                      delta.direction === "up" ? "text-emerald-400" : "text-red-400"
                    }`}
                  >
                    {delta.text}
                  </span>
                )}
              </div>

              <div className="text-2xl font-bold font-mono text-white tracking-tight">
                {formattedVal}
              </div>

              {/* Horizontal Progress Bar */}
              <div className="w-full h-2 bg-[#222] rounded-full overflow-hidden">
                <div
                  className={`h-full ${item.color} transition-all duration-500`}
                  style={{ width: `${Math.min(100, Math.max(0, valNum))}%` }}
                />
              </div>

              <p className="text-[10px] text-neutral-500 leading-tight">
                {item.description}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
