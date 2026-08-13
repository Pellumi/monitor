"use client";

import React from "react";
import Link from "next/link";
import { useDashboard } from "../core/dashboard-provider";
import { Radio } from "lucide-react";

export function ObservationStatusCard() {
  const { data } = useDashboard();
  const telemetry = data?.telemetry;

  return (
    <div className="rounded-lg border border-[#262626] bg-[#141414] p-5 font-mono text-xs space-y-3">
      <div className="flex items-center justify-between border-b border-[#262626] pb-3">
        <span className="font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <Radio className="w-3.5 h-3.5 text-emerald-400" />
          Observation Status
        </span>
        <span className="text-[10px] text-emerald-400 font-bold px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
          HEALTHY
        </span>
      </div>

      <div className="space-y-2 text-neutral-300">
        <div className="flex justify-between">
          <span className="text-neutral-500">Frontend SDK</span>
          <span className="text-emerald-400 font-semibold">
            {telemetry?.frontendStatus ?? "Active"}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-neutral-500">Backend SDK</span>
          <span className="text-emerald-400 font-semibold">
            {telemetry?.backendStatus ?? "Active"}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-neutral-500">Environment</span>
          <span className="text-white uppercase font-bold">
            {data?.application?.environment ?? "development"}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-neutral-500">Last Event</span>
          <span className="text-neutral-300">
            {telemetry?.lastEventAt ? "12 secs ago" : "—"}
          </span>
        </div>
      </div>

      <div className="pt-2 border-t border-[#262626]">
        <Link
          href="/settings/ingestion-keys"
          className="text-neutral-400 hover:text-white underline text-[11px]"
        >
          Check Integration Health
        </Link>
      </div>
    </div>
  );
}
