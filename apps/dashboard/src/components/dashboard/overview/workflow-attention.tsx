"use client";

import React from "react";
import Link from "next/link";
import { useDashboard } from "../core/dashboard-provider";
import { Compass, Play } from "lucide-react";

type Ordering = "least" | "most";

/**
 * Where demonstration effort has and has not gone.
 *
 * The least-exercised end is the one that matters — surfacing behaviour nobody
 * has walked through is the whole point of the product — so it leads. The
 * most-exercised end is the same data reversed and shares the card rather than
 * taking a second one.
 */
export function WorkflowAttention() {
  const { data, state } = useDashboard();
  const [ordering, setOrdering] = React.useState<Ordering>("least");

  if (state.lifecycle !== "ACTIVE") return null;

  const workflows = data?.workflows ?? [];
  if (workflows.length === 0) return null;

  const ranked = [...workflows].sort((a, b) =>
    ordering === "least"
      ? a.demonstrationCount - b.demonstrationCount
      : b.demonstrationCount - a.demonstrationCount,
  );
  const shown = ranked.slice(0, 5);
  const applicationId = data?.application?.id ?? "";

  return (
    <div className="rounded-lg border border-[#262626] bg-[#141414] p-6 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-white font-mono tracking-tight flex items-center gap-2">
            <Compass className="w-4 h-4 text-amber-400" />
            {ordering === "least" ? "Least demonstrated" : "Most demonstrated"}
          </h3>
          <p className="text-xs text-neutral-400 font-mono mt-0.5">
            {ordering === "least"
              ? "Workflows nobody has walked through recently"
              : "Where demonstration effort is concentrated"}
          </p>
        </div>

        <div
          role="group"
          aria-label="Ordering"
          className="flex rounded border border-[#2d2d2d] overflow-hidden shrink-0"
        >
          {(["least", "most"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setOrdering(option)}
              aria-pressed={ordering === option}
              className={`px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider transition-colors ${
                ordering === option
                  ? "bg-[#222] text-white"
                  : "bg-transparent text-neutral-500 hover:text-neutral-300"
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      <ul className="space-y-2">
        {shown.map((workflow) => (
          <li
            key={workflow.id}
            className="flex items-center justify-between gap-3 p-3 rounded border border-[#262626] bg-[#181818]"
          >
            <div className="min-w-0">
              <span className="text-xs font-bold text-white font-mono block truncate">
                {workflow.name}
              </span>
              <span className="text-[11px] font-mono text-neutral-500">
                {workflow.demonstrationCount === 0
                  ? "Never demonstrated"
                  : `${workflow.demonstrationCount} ${
                      workflow.demonstrationCount === 1 ? "demonstration" : "demonstrations"
                    }`}
              </span>
            </div>

            {ordering === "least" && (
              <Link
                href={`/qa-runs/new?appId=${applicationId}&workflowId=${workflow.id}`}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-mono font-bold bg-white text-black rounded hover:bg-neutral-200 transition-colors shrink-0"
              >
                <Play className="w-3 h-3 fill-black" aria-hidden="true" />
                Demonstrate
              </Link>
            )}
          </li>
        ))}
      </ul>

      {/* Workflow has no environment and the count is incremented for every
          session, so this figure is not scoped the way the coverage beside it
          is. Said rather than left to be assumed. */}
      <p className="text-[10px] text-neutral-500 leading-relaxed">
        Counts cover all environments.
      </p>
    </div>
  );
}
