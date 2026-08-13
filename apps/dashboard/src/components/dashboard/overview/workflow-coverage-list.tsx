"use client";

import React from "react";
import Link from "next/link";
import { useDashboard } from "../core/dashboard-provider";
import { ArrowRight } from "lucide-react";

export function WorkflowCoverageList() {
  const { data, state } = useDashboard();

  if (state.lifecycle !== "ACTIVE") return null;

  const workflows = data?.workflows ?? [];

  return (
    <div className="rounded-lg border border-[#262626] bg-[#141414] p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-white font-mono tracking-tight">
            Workflow Coverage Ranking
          </h3>
          <p className="text-xs text-neutral-400 font-mono mt-0.5">
            Ranked by coverage gaps & severity
          </p>
        </div>
        <Link
          href={`/workflows?appId=${data?.application?.id ?? ""}`}
          className="text-xs font-mono text-emerald-400 hover:underline flex items-center gap-1 font-semibold"
        >
          View All Workflows
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs font-mono">
          <thead>
            <tr className="border-b border-[#262626] text-neutral-400 font-semibold uppercase tracking-wider text-[10px]">
              <th className="py-2.5 px-3">Workflow</th>
              <th className="py-2.5 px-3">Coverage</th>
              <th className="py-2.5 px-3 text-center">States</th>
              <th className="py-2.5 px-3 text-center">Missing Paths</th>
              <th className="py-2.5 px-3 text-right">Demonstrations</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#222]">
            {workflows.map((wf) => (
              <tr key={wf.id} className="hover:bg-[#181818] transition-colors">
                <td className="py-3 px-3">
                  <div className="font-semibold text-white">{wf.name}</div>
                </td>

                <td className="py-3 px-3 w-44">
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-white w-10">
                      {wf.coverage}%
                    </span>
                    <div className="w-full h-1.5 bg-[#222] rounded-full overflow-hidden">
                      <div
                        className={`h-full ${
                          wf.coverage >= 80
                            ? "bg-emerald-500"
                            : wf.coverage >= 60
                            ? "bg-amber-500"
                            : "bg-red-500"
                        }`}
                        style={{ width: `${wf.coverage}%` }}
                      />
                    </div>
                  </div>
                </td>

                <td className="py-3 px-3 text-center text-neutral-300">
                  {wf.stateCount}
                </td>

                <td className="py-3 px-3 text-center">
                  {wf.missingPathCount > 0 ? (
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      {wf.missingPathCount} unobserved
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      Complete
                    </span>
                  )}
                </td>

                <td className="py-3 px-3 text-right text-neutral-400">
                  {wf.demonstrationCount} sessions
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
