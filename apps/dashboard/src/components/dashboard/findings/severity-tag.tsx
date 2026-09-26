"use client";

import React from "react";
import { FindingSeverity } from "../core/types";
import { AlertOctagon, AlertTriangle, ArrowDown, Info, Minus } from "lucide-react";

/**
 * A finding's severity.
 *
 * Carries an icon and the word, not just a colour. Severity was previously
 * distinguishable only by hue, which disappears under greyscale printing and
 * for the ~8% of men with a colour vision deficiency — and red and amber are
 * exactly the pair that goes.
 */
const STYLES: Record<FindingSeverity, { className: string; icon: React.ReactNode }> = {
  CRITICAL: {
    className: "bg-red-500/10 text-red-400 border-red-500/20",
    icon: <AlertOctagon className="w-3 h-3" aria-hidden="true" />,
  },
  HIGH: {
    className: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    icon: <AlertTriangle className="w-3 h-3" aria-hidden="true" />,
  },
  MEDIUM: {
    className: "bg-yellow-500/10 text-yellow-300 border-yellow-500/20",
    icon: <Minus className="w-3 h-3" aria-hidden="true" />,
  },
  LOW: {
    className: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    icon: <ArrowDown className="w-3 h-3" aria-hidden="true" />,
  },
  INFO: {
    className: "bg-neutral-500/10 text-neutral-400 border-neutral-500/20",
    icon: <Info className="w-3 h-3" aria-hidden="true" />,
  },
};

export function SeverityTag({ severity }: { severity: FindingSeverity }) {
  const style = STYLES[severity] ?? STYLES.INFO;

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono font-bold rounded border uppercase whitespace-nowrap ${style.className}`}
    >
      {style.icon}
      {severity}
    </span>
  );
}
