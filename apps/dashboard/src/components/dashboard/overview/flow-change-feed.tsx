"use client";

import React from "react";
import Link from "next/link";
import { useDashboard } from "../core/dashboard-provider";
import { FlowTrend } from "../core/types";
import { ArrowRight, Minus, Sparkles, TrendingDown, TrendingUp } from "lucide-react";

/**
 * How declared-flow coverage has moved since each flow was last reconciled.
 *
 * Declared flows rather than observed workflows: a `Workflow` row is one
 * session's traversal with a generated name and no history, so there is nothing
 * to difference. A declared flow is a named thing someone authored, and its
 * coverage is recorded every time it is reconciled.
 *
 * Regressions lead, because a flow that went backwards is the one thing here
 * worth interrupting someone for.
 */
export function FlowChangeFeed() {
  const { data, state } = useDashboard();

  if (state.lifecycle !== "ACTIVE") return null;

  const changes = data?.flowChanges ?? [];
  if (changes.length === 0) return null;

  const applicationId = data?.application?.id ?? "";

  return (
    <div className="rounded-lg border border-[#262626] bg-[#141414] p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-white font-mono tracking-tight">
            Flow coverage changes
          </h3>
          <p className="text-xs text-neutral-400 font-mono mt-0.5">
            Movement since each flow was last reconciled
          </p>
        </div>
        <Link
          href={`/graph-drift?appId=${applicationId}`}
          className="text-xs font-mono text-emerald-400 hover:underline flex items-center gap-1 font-semibold"
        >
          See drift
          <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
        </Link>
      </div>

      <ul className="divide-y divide-[#222]">
        {changes.map((change) => (
          <li key={change.flowId} className="flex items-center justify-between gap-3 py-2.5">
            <span className="text-xs font-mono font-bold text-white truncate min-w-0">
              {change.flowName}
            </span>

            <div className="flex items-center gap-3 shrink-0 font-mono text-xs">
              <span className="text-neutral-400">
                {change.previous === null
                  ? `${change.current}%`
                  : `${change.previous}% → ${change.current}%`}
              </span>
              <TrendBadge trend={change.trend} delta={change.delta} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Trend is carried by an icon and a word, not by colour alone. */
function TrendBadge({ trend, delta }: { trend: FlowTrend; delta: number | null }) {
  const config = {
    IMPROVED: {
      icon: <TrendingUp className="w-3 h-3" aria-hidden="true" />,
      label: "Improved",
      className: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    },
    DECLINED: {
      icon: <TrendingDown className="w-3 h-3" aria-hidden="true" />,
      label: "Declined",
      className: "text-red-400 bg-red-500/10 border-red-500/20",
    },
    STABLE: {
      icon: <Minus className="w-3 h-3" aria-hidden="true" />,
      label: "Stable",
      className: "text-neutral-400 bg-[#222] border-[#333]",
    },
    NEW: {
      icon: <Sparkles className="w-3 h-3" aria-hidden="true" />,
      label: "First result",
      className: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
    },
  }[trend];

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-bold uppercase tracking-wider whitespace-nowrap ${config.className}`}
    >
      {config.icon}
      {config.label}
      {delta !== null && trend !== "STABLE" && (
        <span className="tabular-nums">
          {delta > 0 ? "+" : ""}
          {delta}
        </span>
      )}
    </span>
  );
}
