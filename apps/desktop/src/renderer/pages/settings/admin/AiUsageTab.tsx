import { useEffect, useState } from "react";
import type { AiUsageSummary } from "@tellann/desktop-contracts";
import { LoadingState } from "../../../pages";
import { Table } from "../../../components/ui/table";

export function AiUsageTab() {
  const [summary, setSummary] = useState<AiUsageSummary | null>(null);
  const [backfilling, setBackfilling] = useState(false);

  const load = () => {
    window.tellann!.admin.aiUsage(30).then(setSummary).catch(() => undefined);
  };

  useEffect(load, []);

  const backfill = async () => {
    setBackfilling(true);
    try {
      await window.tellann!.admin.aiUsageBackfill(30);
      load();
    } finally {
      setBackfilling(false);
    }
  };

  if (!summary) return <LoadingState />;

  return (
    <div className="stack" style={{ marginTop: 12 }}>
      <section className="content-card">
        <header className="settings-row-head">
          <h2>Last 30 days</h2>
          <button type="button" className="button" onClick={backfill} disabled={backfilling}>
            {backfilling ? "Backfilling…" : "Backfill"}
          </button>
        </header>
        <div className="settings-toggle-grid">
          <span>{summary.totalCalls.toLocaleString()} calls</span>
          <span>{(summary.totalInputTokens + summary.totalOutputTokens).toLocaleString()} tokens</span>
          <span>${summary.totalCostUsd.toFixed(2)}</span>
          <span>{summary.avgCallsPerDay.toFixed(1)}/day avg</span>
        </div>
      </section>

      <Table
        columns={[
          { key: "provider", header: "Provider", width: "1fr", render: (row) => row.provider },
          { key: "calls", header: "Calls", width: "100px", render: (row) => row.calls.toLocaleString() },
          { key: "tokens", header: "Tokens", width: "120px", render: (row) => (row.inputTokens + row.outputTokens).toLocaleString() },
          { key: "cost", header: "Est. cost", width: "100px", render: (row) => `$${row.estimatedCostUsd.toFixed(2)}` },
        ]}
        rows={summary.byProvider}
        getKey={(row) => row.provider}
      />
    </div>
  );
}
