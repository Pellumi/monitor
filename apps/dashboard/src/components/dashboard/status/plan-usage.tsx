"use client";

import React from "react";
import Link from "next/link";
import { useDashboard } from "../core/dashboard-provider";
import { HardDrive } from "lucide-react";

export function PlanUsageCard() {
  const { data } = useDashboard();
  const usage = data?.usage;

  if (!usage) return null;

  const storagePercent = Math.round((usage.storageUsedMb / usage.storageLimitMb) * 100);

  return (
    <div className="rounded-lg border border-[#262626] bg-[#141414] p-5 font-mono text-xs space-y-3">
      <div className="flex items-center justify-between border-b border-[#262626] pb-3">
        <span className="font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <HardDrive className="w-3.5 h-3.5 text-purple-400" />
          {usage.planName} Usage
        </span>
        <span className="text-[10px] text-neutral-400 font-bold px-2 py-0.5 rounded bg-[#222] border border-[#333]">
          {usage.retentionDays}D RETENTION
        </span>
      </div>

      <div className="space-y-2 text-neutral-300">
        <div className="flex justify-between">
          <span className="text-neutral-500">Applications</span>
          <span className="text-white font-semibold">
            {usage.applicationsUsed} / {usage.applicationsLimit}
          </span>
        </div>
        <div className="space-y-1">
          <div className="flex justify-between">
            <span className="text-neutral-500">Storage Used</span>
            <span className="text-white font-semibold">
              {(usage.storageUsedMb / 1024).toFixed(1)} / {(usage.storageLimitMb / 1024).toFixed(1)} GB
            </span>
          </div>
          <div className="w-full h-1.5 bg-[#222] rounded-full overflow-hidden">
            <div
              className={`h-full ${storagePercent > 90 ? "bg-red-500" : "bg-purple-500"}`}
              style={{ width: `${Math.min(100, storagePercent)}%` }}
            />
          </div>
        </div>
      </div>

      <div className="pt-2 border-t border-[#262626]">
        <Link
          href="/settings/billing"
          className="text-neutral-400 hover:text-white underline text-[11px]"
        >
          View Plan & Billing Details
        </Link>
      </div>
    </div>
  );
}
