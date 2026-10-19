import { twMerge } from "tailwind-merge";

const STATUS_STYLES: Record<string, string> = {
  COMPLETED: "border-emerald-500/20 bg-emerald-500/10 text-emerald-400",
  COMPLETED_INCOMPLETE: "border-amber-500/20 bg-amber-500/10 text-amber-400",
  FAILED: "border-red-500/20 bg-red-500/10 text-red-400",
  CANCELLED: "border-[#333] bg-[#141414] text-[#8e9192]",
};

const LIVE_STATUSES = new Set([
  "RUNNING",
  "RECORDING",
  "PROCESSING",
  "ARMED",
  "WAITING_FOR_INITIAL",
  "PAUSED",
  "CREATED",
]);

/** A QA run's lifecycle status, styled the same way severity and plan badges are elsewhere in the app. */
export function RunStatusBadge({ status }: { status: string }) {
  const live = LIVE_STATUSES.has(status);
  const className = STATUS_STYLES[status] ?? "border-blue-500/20 bg-blue-500/10 text-blue-400";
  return (
    <span
      className={twMerge(
        "inline-flex items-center gap-1.5 rounded border px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider whitespace-nowrap",
        className,
      )}
    >
      {live ? <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" aria-hidden="true" /> : null}
      {status.replace(/_/g, " ")}
    </span>
  );
}
