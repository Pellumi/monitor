"use client";

import React from "react";
import Link from "next/link";
import { useDashboard } from "../core/dashboard-provider";
import { Network, ArrowRight } from "lucide-react";

export function GraphPreview() {
  const { data, state } = useDashboard();

  if (state.lifecycle !== "ACTIVE") return null;

  const graph = data?.graph;

  const nodes = graph?.nodes ?? [];

  return (
    <div className="rounded-lg border border-[#262626] bg-[#141414] p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-white font-mono tracking-tight flex items-center gap-2">
            <Network className="w-4 h-4 text-emerald-400" />
            Behavioral Topology Preview
          </h3>
          <p className="text-xs text-neutral-400 font-mono mt-0.5">
            {graph ? `${graph.nodeCount} states / ${graph.edgeCount} transitions / ${graph.workflowCount} workflows` : "Topology pending"}
          </p>
        </div>
        <Link
          href={`/graph?appId=${data?.application?.id ?? ""}`}
          className="text-xs font-mono text-emerald-400 hover:underline flex items-center gap-1 font-semibold"
        >
          Open Full Graph
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Visual Canvas Nodes Flow */}
      <div className="p-5 rounded border border-[#222] bg-[#0c0c0c] flex flex-wrap items-center justify-center gap-3 min-h-[160px]">
        {nodes.length === 0 ? (
          <p className="text-xs text-neutral-500 font-mono">No observed topology yet. Complete a QA run to populate this preview.</p>
        ) : nodes.map((node, idx) => (
          <React.Fragment key={node.id}>
            <div className="px-3 py-2 rounded bg-[#1c1c1c] border border-[#333] text-center font-mono hover:border-emerald-500/50 transition-colors">
              <span className="text-[10px] text-neutral-500 uppercase block">
                {node.type}
              </span>
              <span className="text-xs font-bold text-white">{node.label}</span>
            </div>
            {idx < nodes.length - 1 && (
              <span className="text-neutral-600 font-mono text-sm">-&gt;</span>
            )}
          </React.Fragment>
        ))}
      </div>

      <div className="flex items-center justify-between text-xs font-mono text-neutral-400 pt-1">
        <span>Entry points: {graph?.entryPointCount ?? "Pending"}</span>
        <span>Exit points: {graph?.exitPointCount ?? "Pending"}</span>
      </div>
    </div>
  );
}
