import { useEffect, useState } from "react";
import type { ReconciliationReport } from "@tellann/desktop-contracts";
import { Page, useProject, LoadingState, EmptyState, Status } from "../../pages";
import { Table } from "../../components/ui/table";
import { activeEnvironmentId } from "./shared";
import { GitCompareArrows, RefreshCw } from "lucide-react";

export function ReconciliationPage() {
  const { projectId, application } = useProject();
  const [reports, setReports] = useState<ReconciliationReport[] | null>(null);
  const [selected, setSelected] = useState<ReconciliationReport | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    if (!projectId) return;
    const environmentId = activeEnvironmentId(application, projectId);
    setReports(null);
    window.tellann!.analytics
      .reconciliationReports(projectId, environmentId)
      .then((result) => {
        setReports(result);
        setSelected((current) => current ?? result[0] ?? null);
      })
      .catch((err) => setError(String((err as Error)?.message ?? err)));
  };

  useEffect(load, [projectId, application]);

  const runNow = async () => {
    if (!projectId) return;
    setRunning(true);
    setError(null);
    try {
      const environmentId = activeEnvironmentId(application, projectId);
      const result = await window.tellann!.analytics.runReconciliation(projectId, { environmentId });
      setReports(result);
      setSelected(result[0] ?? null);
    } catch (err) {
      setError(String((err as Error)?.message ?? err));
    } finally {
      setRunning(false);
    }
  };

  if (reports === null) return <LoadingState />;

  return (
    <Page
      title="Reconciliation"
      description="Declared behavior vs. what's actually been observed, per Flow."
      actions={
        <button type="button" className="button primary" onClick={runNow} disabled={running}>
          <RefreshCw size={14} /> {running ? "Running…" : "Run now"}
        </button>
      }
    >
      {error ? (
        <div className="inline-error" role="alert">
          <span>{error}</span>
        </div>
      ) : null}

      {!reports.length ? (
        <EmptyState icon={<GitCompareArrows size={28} />} title="No reconciliation yet" description="Run reconciliation to compare your declared Flows against observed behavior." />
      ) : (
        <div className="master-detail">
          <div className="list-pane">
            {reports.map((report) => (
              <button
                type="button"
                key={report.flowId}
                className="content-card row-card reconciliation-flow-card"
                data-selected={selected?.flowId === report.flowId}
                onClick={() => setSelected(report)}
              >
                <div>
                  <h2>{report.flow.name}</h2>
                  <p className="muted">
                    {report.confirmedCount} confirmed · {report.trueGapCount} gaps · {report.undeclaredCount} undeclared
                  </p>
                </div>
                <Status>{`${Math.round(report.expectedCoverageScore * 100)}% coverage`}</Status>
              </button>
            ))}
          </div>
          <div className="detail-pane">
            {selected ? (
              <div className="stack" style={{ padding: 16 }}>
                <h2>{selected.flow.name}</h2>
                <p className="muted">
                  States: {Math.round(selected.expectedCoverageScore * 100)}% coverage · Transitions:{" "}
                  {Math.round(selected.transitionCoverageScore * 100)}% coverage
                </p>

                {selected.trueGaps.length ? (
                  <section>
                    <h3>True gaps (declared, never observed)</h3>
                    <Table
                      columns={[
                        { key: "state", header: "State", width: "2fr", render: (row) => row.stateName },
                        { key: "provenance", header: "Source", width: "1fr", render: (row) => row.provenance ?? "—" },
                      ]}
                      rows={selected.trueGaps}
                      getKey={(row) => row.stateName}
                    />
                  </section>
                ) : null}

                {selected.undeclared.length ? (
                  <section>
                    <h3>Undeclared (observed, never declared)</h3>
                    <Table
                      columns={[
                        { key: "state", header: "State", width: "1.5fr", render: (row) => row.stateName },
                        { key: "visits", header: "Visits (30d)", width: "110px", render: (row) => Math.round(row.weightedVisits).toLocaleString() },
                        { key: "users", header: "Unique users", width: "110px", render: (row) => row.uniqueEndUsers.toLocaleString() },
                        { key: "errors", header: "Error rate", width: "100px", render: (row) => `${(row.errorRate * 100).toFixed(1)}%` },
                      ]}
                      rows={selected.undeclared}
                      getKey={(row) => row.stateName}
                    />
                  </section>
                ) : null}
              </div>
            ) : (
              <EmptyState icon={<GitCompareArrows size={28} />} title="Select a Flow" description="Choose a Flow on the left to see its reconciliation detail." />
            )}
          </div>
        </div>
      )}
    </Page>
  );
}
