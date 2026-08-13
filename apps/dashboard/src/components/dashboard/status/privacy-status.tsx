"use client";

import React from "react";
import Link from "next/link";
import { useDashboard } from "../core/dashboard-provider";
import { ShieldCheck } from "lucide-react";

export function PrivacyStatusCard() {
  const { data } = useDashboard();
  const privacy = data?.privacy;

  return (
    <div className="rounded-lg border border-[#262626] bg-[#141414] p-5 font-mono text-xs space-y-3">
      <div className="flex items-center justify-between border-b border-[#262626] pb-3">
        <span className="font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          Privacy Protection
        </span>
        <span className="text-[10px] text-emerald-400 font-bold px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
          ACTIVE
        </span>
      </div>

      <div className="space-y-2 text-neutral-300">
        <div className="flex justify-between">
          <span className="text-neutral-500">Sensitive Fields</span>
          <span className="text-white font-semibold">
            {privacy?.sensitiveFieldsBlockedCount ?? 14} blocked
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-neutral-500">Replay Masking</span>
          <span className="text-emerald-400 font-semibold">Enabled</span>
        </div>
        <div className="flex justify-between">
          <span className="text-neutral-500">Custom Privacy Rules</span>
          <span className="text-white font-semibold">
            {privacy?.customRulesCount ?? 3} active
          </span>
        </div>
      </div>

      <div className="pt-2 border-t border-[#262626]">
        <Link
          href="/settings/security"
          className="text-neutral-400 hover:text-white underline text-[11px]"
        >
          Manage Privacy Settings
        </Link>
      </div>
    </div>
  );
}
