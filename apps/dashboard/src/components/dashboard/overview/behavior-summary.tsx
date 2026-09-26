"use client";

import React from "react";
import { useDashboard } from "../core/dashboard-provider";
import { Flame, Snowflake } from "lucide-react";

/**
 * Where observation is concentrated, and where it is thin.
 *
 * Built from the two behavioural counters that exist — how often a state has
 * been visited and how often a transition has been taken. Success rate, failure
 * rate and average duration are not shown: nothing records them, and deriving
 * them from something adjacent would be inventing a measurement.
 */
export function BehaviorSummaryCard() {
  const { data, state } = useDashboard();

  if (state.lifecycle !== "ACTIVE") return null;

  const behavior = data?.behavior;
  if (!behavior) return null;

  const hasCold =
    behavior.coldestStates.length > 0 || behavior.coldestTransitions.length > 0;

  return (
    <div className="rounded-lg border border-[#262626] bg-[#141414] p-6 space-y-5">
      <div>
        <h3 className="text-sm font-bold text-white font-mono tracking-tight">
          Where behaviour concentrates
        </h3>
        <p className="text-xs text-neutral-400 font-mono mt-0.5">
          Observed traffic across states and transitions
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Column
          icon={<Flame className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />}
          title="Most travelled"
          states={behavior.hottestStates}
          transitions={behavior.hottestTransitions}
        />
        {hasCold && (
          <Column
            icon={<Snowflake className="w-3.5 h-3.5 text-cyan-400" aria-hidden="true" />}
            title="Barely travelled"
            states={behavior.coldestStates}
            transitions={behavior.coldestTransitions}
          />
        )}
      </div>

      {behavior.declaredButNeverObserved !== null && behavior.declaredButNeverObserved > 0 && (
        <p className="text-[11px] font-mono text-amber-400/90 pt-3 border-t border-[#262626]">
          {behavior.declaredButNeverObserved} declared{" "}
          {behavior.declaredButNeverObserved === 1 ? "transition has" : "transitions have"} never
          been observed at all.
        </p>
      )}
    </div>
  );
}

function Column({
  icon,
  title,
  states,
  transitions,
}: {
  icon: React.ReactNode;
  title: string;
  states: Array<{ name: string; visitCount: number }>;
  transitions: Array<{ from: string; to: string; frequency: number }>;
}) {
  return (
    <div className="space-y-3">
      <h4 className="text-xs font-bold text-neutral-300 flex items-center gap-1.5 uppercase tracking-wider">
        {icon}
        {title}
      </h4>

      {states.length > 0 && (
        <div>
          <span className="text-[10px] font-mono uppercase text-neutral-500 block mb-1">
            States
          </span>
          <ul className="space-y-1">
            {states.map((item) => (
              <li
                key={item.name}
                className="flex items-baseline justify-between gap-2 text-[11px] font-mono"
              >
                <span className="text-neutral-300 truncate">{item.name}</span>
                <span className="text-neutral-500 tabular-nums shrink-0">
                  {item.visitCount} visits
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {transitions.length > 0 && (
        <div>
          <span className="text-[10px] font-mono uppercase text-neutral-500 block mb-1">
            Transitions
          </span>
          <ul className="space-y-1">
            {transitions.map((item) => (
              <li
                key={`${item.from}->${item.to}`}
                className="flex items-baseline justify-between gap-2 text-[11px] font-mono"
              >
                <span className="text-neutral-300 truncate">
                  {item.from} &rarr; {item.to}
                </span>
                <span className="text-neutral-500 tabular-nums shrink-0">
                  {item.frequency}&times;
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
