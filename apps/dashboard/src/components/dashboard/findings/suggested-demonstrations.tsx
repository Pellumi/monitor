"use client";

import React from "react";
import Link from "next/link";
import { useDashboard } from "../core/dashboard-provider";
import { Compass, Play } from "lucide-react";

export function SuggestedDemonstrationsCard() {
  const { data, state } = useDashboard();

  if (state.lifecycle !== "ACTIVE") return null;

  const opportunities = data?.opportunities ?? [];

  if (opportunities.length === 0) return null;

  return (
    <div className="rounded-lg border border-emerald-500/30 bg-[#141414] p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-white font-mono tracking-tight flex items-center gap-2">
            <Compass className="w-4 h-4 text-emerald-400" />
            Coverage Opportunities (Suggested Next Walkthroughs)
          </h3>
          <p className="text-xs text-neutral-400 font-mono mt-0.5">
            Targeted walkthrough suggestions based on deterministic missing flow evidence
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {opportunities.map((opp) => (
          <div
            key={opp.id}
            className="p-4 rounded-md border border-[#2d2d2d] bg-[#181818] space-y-3 flex flex-col justify-between"
          >
            <div className="space-y-1.5">
              <div className="flex items-center justify-between font-mono">
                <span className="text-xs font-bold text-white">
                  {opp.title}
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {opp.workflowName}
                </span>
              </div>
              <p className="text-xs text-neutral-300 leading-relaxed">
                {opp.description}
              </p>

              <div className="pt-2 border-t border-[#262626]">
                <span className="text-[10px] font-mono uppercase text-neutral-500 font-semibold block mb-1">
                  Suggested Steps:
                </span>
                <ul className="space-y-1 text-xs font-mono text-neutral-400">
                  {opp.suggestedSteps.map((step, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-emerald-400">{idx + 1}.</span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="pt-2">
              <Link
                href={`/qa-runs/new?appId=${data?.application?.id ?? ""}&workflowId=${opp.workflowId}`}
                className="inline-flex items-center justify-center gap-2 w-full py-2 bg-emerald-500 text-black font-bold text-xs rounded hover:bg-emerald-400 transition-colors shadow-sm cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-black" />
                Start Guided Demonstration
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
