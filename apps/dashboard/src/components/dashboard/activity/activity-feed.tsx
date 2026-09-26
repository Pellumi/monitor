"use client";

import React from "react";
import { useDashboard } from "../core/dashboard-provider";
import { History } from "lucide-react";

/**
 * What has happened in this application, in order.
 *
 * Rows are unattributed on purpose. The events behind this feed record what
 * happened and when, but carry no user — naming someone would mean joining an
 * unrelated audit trail and risking the wrong name against the wrong event.
 */
export function ActivityFeed() {
  const { data, state, entitlements } = useDashboard();

  if (state.lifecycle !== "ACTIVE") return null;
  if (!entitlements.canUseTeamFeatures) return null;

  const activity = data?.activity ?? [];

  return (
    <div className="rounded-lg border border-[#262626] bg-[#141414] p-6 space-y-4">
      <div>
        <h3 className="text-sm font-bold text-white font-mono tracking-tight flex items-center gap-2">
          <History className="w-4 h-4 text-neutral-400" />
          Activity
        </h3>
        <p className="text-xs text-neutral-400 font-mono mt-0.5">
          Recent changes to this application
        </p>
      </div>

      {activity.length === 0 ? (
        <p className="py-6 text-center text-xs font-mono text-neutral-500">
          Nothing has happened in this window yet.
        </p>
      ) : (
        <ol className="space-y-0">
          {activity.slice(0, 10).map((entry) => (
            <li
              key={entry.id}
              className="flex items-baseline gap-3 py-2 border-b border-[#1e1e1e] last:border-0"
            >
              <time
                dateTime={entry.occurredAt}
                className="text-[11px] font-mono text-neutral-500 shrink-0 tabular-nums w-28"
              >
                {formatWhen(entry.occurredAt)}
              </time>
              <span className="text-xs text-neutral-300">{entry.description}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/** Today shows a time, anything older shows a date. */
function formatWhen(iso: string): string {
  const at = new Date(iso);
  const isToday = new Date().toDateString() === at.toDateString();
  return isToday
    ? at.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
    : at.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
