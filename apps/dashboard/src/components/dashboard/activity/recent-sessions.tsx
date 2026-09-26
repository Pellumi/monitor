"use client";

import React from "react";
import Link from "next/link";
import { useDashboard } from "../core/dashboard-provider";
import { Play, ArrowRight, CheckCircle2 } from "lucide-react";

export function RecentSessions() {
  const { data, state } = useDashboard();

  if (state.lifecycle !== "ACTIVE") return null;

  const sessions = data?.sessions ?? [];

  return (
    <div className="rounded-lg border border-[#262626] bg-[#141414] p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-white font-mono tracking-tight flex items-center gap-2">
            <Play className="w-4 h-4 text-emerald-400" />
            Recent Demonstrated Sessions
          </h3>
          <p className="text-xs text-neutral-400 font-mono mt-0.5">
            Replayable behavioral session timelines
          </p>
        </div>
        <Link
          href={`/sessions?appId=${data?.application?.id ?? ""}`}
          className="text-xs font-mono text-emerald-400 hover:underline flex items-center gap-1 font-semibold"
        >
          View All Sessions
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {sessions.length === 0 ? (
        <p className="py-8 text-center text-xs font-mono text-neutral-500">
          No sessions in this window. Widen the date range or record a demonstration.
        </p>
      ) : (
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs font-mono">
          <caption className="sr-only">Recent observed sessions, newest first</caption>
          <thead>
            <tr className="border-b border-[#262626] text-neutral-400 font-semibold uppercase tracking-wider text-[10px]">
              <th scope="col" className="py-2.5 px-3">Session</th>
              <th scope="col" className="py-2.5 px-3">Source</th>
              <th scope="col" className="py-2.5 px-3 text-center">Duration</th>
              <th scope="col" className="py-2.5 px-3 text-center">Events</th>
              <th scope="col" className="py-2.5 px-3 text-center">Errors</th>
              <th scope="col" className="py-2.5 px-3 text-right">Started</th>
              <th scope="col" className="py-2.5 px-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#222]">
            {sessions.map((ses) => (
              <tr key={ses.id} className="hover:bg-[#181818] transition-colors">
                <td className="py-3 px-3">
                  <Link
                    href={`/sessions/${ses.id}`}
                    className="font-bold text-emerald-400 hover:underline"
                  >
                    {ses.id.slice(0, 12)}
                  </Link>
                </td>
                {/* Whether a session came from a guided QA run is knowable;
                    "Guided" and "Exploratory" used to alternate by row index. */}
                <td className="py-3 px-3 text-neutral-300">
                  {ses.qaRunId ? "Guided run" : "SDK capture"}
                </td>
                <td className="py-3 px-3 text-center text-neutral-400">
                  {ses.durationSeconds === null
                    ? <span className="text-neutral-600">&mdash;</span>
                    : `${Math.floor(ses.durationSeconds / 60)}m ${ses.durationSeconds % 60}s`}
                </td>
                <td className="py-3 px-3 text-center text-neutral-300">
                  {ses.eventCount ?? <span className="text-neutral-600">&mdash;</span>}
                </td>
                <td className="py-3 px-3 text-center">
                  {ses.errorCount === null ? (
                    <span className="text-neutral-600">&mdash;</span>
                  ) : ses.errorCount > 0 ? (
                    <span className="text-red-400 font-bold">{ses.errorCount}</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-emerald-400">
                      <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
                      <span>0</span>
                    </span>
                  )}
                </td>
                <td className="py-3 px-3 text-right text-neutral-500">
                  {new Date(ses.timestamp).toLocaleString()}
                </td>
                <td className="py-3 px-3 text-right">
                  <Link
                    href={`/sessions/${ses.id}`}
                    className="text-xs px-2.5 py-1 border border-[#333] hover:border-emerald-500 text-neutral-300 hover:text-white rounded transition-colors"
                  >
                    Replay
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}
    </div>
  );
}
