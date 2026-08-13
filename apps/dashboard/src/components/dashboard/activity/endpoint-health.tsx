"use client";

import React from "react";
import Link from "next/link";
import { useDashboard } from "../core/dashboard-provider";
import { renderMeasuredValue } from "../core/measurement-state";
import { Activity, ArrowRight, Clock, AlertCircle } from "lucide-react";

export function EndpointHealth() {
  const { data, state } = useDashboard();

  if (state.lifecycle !== "ACTIVE") return null;

  const endpoints = data?.endpoints;

  if (!endpoints) {
    return (
      <div className="rounded-lg border border-[#262626] bg-[#141414] p-6 text-center text-xs font-mono text-neutral-400 space-y-2">
        <span className="font-semibold text-white block">Backend Telemetry Unconnected</span>
        <p className="text-neutral-500">
          Connect the @tellann/node SDK to include API performance and endpoint health in your quality analysis.
        </p>
        <Link
          href="/settings/ingestion-keys"
          className="inline-block mt-2 text-xs text-amber-400 underline"
        >
          View Node.js Setup Guide
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-[#262626] bg-[#141414] p-6 space-y-6">
      <div className="flex items-center justify-between border-b border-[#262626] pb-4">
        <div>
          <h3 className="text-sm font-bold text-white font-mono tracking-tight flex items-center gap-2">
            <Activity className="w-4 h-4 text-cyan-400" />
            Endpoint Health & Performance
          </h3>
          <p className="text-xs text-neutral-400 font-mono mt-0.5">
            {renderMeasuredValue(endpoints.observedCount)} endpoints observed • Avg latency: {renderMeasuredValue(endpoints.averageLatencyMs)} ms
          </p>
        </div>
        <Link
          href={`/endpoints?appId=${data?.application?.id ?? ""}`}
          className="text-xs font-mono text-emerald-400 hover:underline flex items-center gap-1 font-semibold"
        >
          Open Endpoint Analysis
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Split Views: Slowest Endpoints vs Highest Error Rates */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 font-mono text-xs">
        {/* Slowest Endpoints */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-neutral-300 flex items-center gap-1.5 uppercase tracking-wider">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            Slowest Endpoints (Latency in ms)
          </h4>
          <div className="space-y-2">
            {endpoints.slowEndpoints.map((ep) => (
              <div
                key={ep.id}
                className="p-3 rounded border border-[#262626] bg-[#181818] flex items-center justify-between"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#222] text-amber-400 font-bold">
                      {ep.method}
                    </span>
                    <span className="font-bold text-white">{ep.path}</span>
                  </div>
                  <span className="text-[10px] text-neutral-500 block mt-1">
                    {ep.callCount} API requests captured
                  </span>
                </div>
                <span className="text-sm font-bold text-amber-400">
                  {ep.averageLatencyMs} ms
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Highest Error Rates */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-neutral-300 flex items-center gap-1.5 uppercase tracking-wider">
            <AlertCircle className="w-3.5 h-3.5 text-red-400" />
            Highest Error Rates (% Failed)
          </h4>
          <div className="space-y-2">
            {endpoints.errorProneEndpoints.map((ep) => (
              <div
                key={ep.id}
                className="p-3 rounded border border-[#262626] bg-[#181818] flex items-center justify-between"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20 font-bold">
                      {ep.method}
                    </span>
                    <span className="font-bold text-white">{ep.path}</span>
                  </div>
                  <span className="text-[10px] text-neutral-500 block mt-1">
                    {ep.errorCount} total errors recorded
                  </span>
                </div>
                <span className="text-sm font-bold text-red-400">
                  {ep.errorRatePercentage}% error
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
