"use client";

import React from "react";
import { useDashboard } from "../core/dashboard-provider";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

export function CoverageTrend() {
  const { data, state } = useDashboard();

  if (state.lifecycle !== "ACTIVE") return null;

  const history = data?.coverageHistory ?? [];

  if (history.length < 2) {
    return (
      <div className="rounded-lg border border-[#262626] bg-[#141414] p-6 text-center text-neutral-400 font-mono text-xs space-y-2">
        <span className="font-semibold text-white block">Coverage Trend</span>
        <p className="text-neutral-500">
          A historical coverage trend line will appear after your next demonstration is analyzed.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-[#262626] bg-[#141414] p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-white font-mono tracking-tight">
            Coverage History Trend
          </h3>
          <p className="text-xs text-neutral-400 font-mono">
            Workflow, State, and Transition coverage across analyses
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs font-mono">
          <span className="flex items-center gap-1.5 text-emerald-400">
            <span className="w-2.5 h-2.5 rounded bg-emerald-500" /> Workflow
          </span>
          <span className="flex items-center gap-1.5 text-cyan-400">
            <span className="w-2.5 h-2.5 rounded bg-cyan-500" /> State
          </span>
          <span className="flex items-center gap-1.5 text-purple-400">
            <span className="w-2.5 h-2.5 rounded bg-purple-500" /> Transition
          </span>
        </div>
      </div>

      <div className="h-56 w-full pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={history} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorWorkflow" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorState" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorTransition" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#a855f7" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="#222" />
            <XAxis dataKey="timestamp" stroke="#666" fontSize={11} fontFamily="monospace" />
            <YAxis stroke="#666" fontSize={11} fontFamily="monospace" domain={[0, 100]} unit="%" />

            <Tooltip
              contentStyle={{
                backgroundColor: "#181818",
                borderColor: "#333",
                borderRadius: "6px",
                fontSize: "12px",
                fontFamily: "monospace",
                color: "#fff",
              }}
              formatter={(value: number | string | Array<number | string> | undefined) => [
                typeof value === "number" ? `${value.toFixed(1)}%` : String(value ?? 0),
              ]}
            />

            <Area
              type="monotone"
              dataKey="workflow"
              name="Workflow Coverage"
              stroke="#10b981"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorWorkflow)"
            />
            <Area
              type="monotone"
              dataKey="state"
              name="State Coverage"
              stroke="#06b6d4"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorState)"
            />
            <Area
              type="monotone"
              dataKey="transition"
              name="Transition Coverage"
              stroke="#a855f7"
              strokeWidth={1.5}
              fillOpacity={1}
              fill="url(#colorTransition)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
