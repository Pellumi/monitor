import { useEffect, useState } from "react";
import type { QueueStatus } from "@tellann/desktop-contracts";
import { LoadingState, EmptyState } from "../../../pages";
import { ListChecks } from "lucide-react";

const COUNT_KEYS = ["waiting", "active", "completed", "failed", "delayed", "paused"] as const;

export function JobMonitorTab() {
  const [status, setStatus] = useState<QueueStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      window.tellann!.admin
        .queueStatus()
        .then((result) => !cancelled && setStatus(result))
        .catch((err) => !cancelled && setError(String((err as Error)?.message ?? err)));
    load();
    const interval = setInterval(load, 8_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  if (error) {
    return <EmptyState icon={<ListChecks size={28} />} title="Queue status unavailable" description={error} />;
  }
  if (!status) return <LoadingState />;

  return (
    <div className="data-table" style={{ marginTop: 12 }}>
      <div className="table-head" style={{ display: "grid", gridTemplateColumns: "1.5fr repeat(6, 1fr)" }}>
        <span>Queue</span>
        {COUNT_KEYS.map((key) => (
          <span key={key} style={{ textTransform: "capitalize" }}>
            {key}
          </span>
        ))}
      </div>
      {status.queues.map((queue) => (
        <div className="table-row" key={queue.name} style={{ display: "grid", gridTemplateColumns: "1.5fr repeat(6, 1fr)" }}>
          <span>{queue.name}</span>
          {COUNT_KEYS.map((key) => (
            <span key={key} style={key === "failed" && queue[key] > 0 ? { color: "var(--danger)", fontWeight: 600 } : undefined}>
              {queue[key].toLocaleString()}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}
