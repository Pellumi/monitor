"use client";

import React from "react";
import Link from "next/link";
import { useDashboard } from "../core/dashboard-provider";
import { AlertOctagon, AlertTriangle, Clock, HardDrive } from "lucide-react";

export function HealthOverlays() {
  const { state } = useDashboard();

  if (state.healthIssues.length === 0) return null;

  return (
    <div className="space-y-3 font-mono text-xs">
      {state.healthIssues.map((issue) => {
        switch (issue) {
          case "ANALYSIS_FAILED":
            return (
              <div
                key={issue}
                className="p-4 rounded-md border border-red-500/40 bg-red-950/20 text-red-300 flex items-start justify-between gap-4"
              >
                <div className="flex items-start gap-3">
                  <AlertOctagon className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-white">Analysis Could Not Be Completed</h4>
                    <p className="text-neutral-300 mt-0.5">
                      Events were received successfully, but workflow & state extraction failed during analysis.
                    </p>
                  </div>
                </div>
                <Link
                  href="/qa-runs"
                  className="px-3 py-1 bg-red-500 text-black font-bold text-xs rounded hover:bg-red-400 shrink-0"
                >
                  Retry Analysis
                </Link>
              </div>
            );
          case "INGESTION_PROBLEM":
            return (
              <div
                key={issue}
                className="p-4 rounded-md border border-amber-500/40 bg-amber-950/20 text-amber-300 flex items-start justify-between gap-4"
              >
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-white">Ingestion Health Warning</h4>
                    <p className="text-neutral-300 mt-0.5">
                      Telemetry events are arriving with corrupted key identifiers or invalid schemas.
                    </p>
                  </div>
                </div>
                <Link
                  href="/settings/ingestion-keys"
                  className="px-3 py-1 border border-amber-500 text-amber-300 font-semibold text-xs rounded hover:bg-amber-500/10 shrink-0"
                >
                  Check Ingestion Keys
                </Link>
              </div>
            );
          case "NO_RECENT_DATA":
            return (
              <div
                key={issue}
                className="p-4 rounded-md border border-[#333] bg-[#1a1a1a] text-neutral-300 flex items-start justify-between gap-4"
              >
                <div className="flex items-start gap-3">
                  <Clock className="w-4 h-4 text-neutral-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-white">No Telemetry Received Recently</h4>
                    <p className="text-neutral-400 mt-0.5">
                      No behavioral events have been received in over 72 hours.
                    </p>
                  </div>
                </div>
                <Link
                  href="/qa-runs/new"
                  className="px-3 py-1 bg-white text-black font-semibold text-xs rounded hover:bg-neutral-200 shrink-0"
                >
                  Record Demonstration
                </Link>
              </div>
            );
          case "PLAN_LIMIT_REACHED":
            return (
              <div
                key={issue}
                className="p-4 rounded-md border border-purple-500/40 bg-purple-950/20 text-purple-300 flex items-start justify-between gap-4"
              >
                <div className="flex items-start gap-3">
                  <HardDrive className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-white">Storage Threshold Exceeded (94%)</h4>
                    <p className="text-neutral-300 mt-0.5">
                      Storage is near capacity. Older replay assets may be removed per your retention policy.
                    </p>
                  </div>
                </div>
                <Link
                  href="/settings/billing"
                  className="px-3 py-1 bg-purple-500 text-white font-bold text-xs rounded hover:bg-purple-400 shrink-0"
                >
                  Upgrade Storage
                </Link>
              </div>
            );
          default:
            return null;
        }
      })}
    </div>
  );
}
