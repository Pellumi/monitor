"use client";

import React from "react";
import Link from "next/link";
import { useDashboard } from "../core/dashboard-provider";
import { FileText, Download, ArrowRight } from "lucide-react";

export function RecentReports() {
  const { data, state, entitlements } = useDashboard();

  if (state.lifecycle !== "ACTIVE") return null;

  const reports = data?.reports ?? [];

  return (
    <div className="rounded-lg border border-[#262626] bg-[#141414] p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-white font-mono tracking-tight flex items-center gap-2">
            <FileText className="w-4 h-4 text-emerald-400" />
            Generated Quality Reports
          </h3>
          <p className="text-xs text-neutral-400 font-mono mt-0.5">
            Phase 1 executive & technical reports
          </p>
        </div>
        <Link
          href={`/reports?appId=${data?.application?.id ?? ""}`}
          className="text-xs font-mono text-emerald-400 hover:underline flex items-center gap-1 font-semibold"
        >
          View All Reports
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        {reports.map((rep) => (
          <div
            key={rep.id}
            className="p-4 rounded border border-[#262626] bg-[#181818] space-y-3 font-mono flex flex-col justify-between"
          >
            <div>
              <span className="text-[10px] text-neutral-500 uppercase tracking-wider block">
                {rep.type} Report
              </span>
              <h4 className="text-xs font-bold text-white mt-1">
                {rep.title}
              </h4>
              <span className="text-[10px] text-neutral-400 block mt-2">
                Generated {rep.generatedAt}
              </span>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-[#262626]">
              <Link
                href={`/reports?id=${rep.id}`}
                className="text-xs text-white hover:text-emerald-400 font-semibold underline"
              >
                View
              </Link>
              {entitlements.canExportPdf ? (
                <button className="text-xs text-neutral-400 hover:text-white flex items-center gap-1 font-mono cursor-pointer ml-auto">
                  <Download className="w-3 h-3" /> PDF
                </button>
              ) : (
                <span className="text-[10px] text-neutral-600 ml-auto">
                  PDF (Solo/Team)
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
