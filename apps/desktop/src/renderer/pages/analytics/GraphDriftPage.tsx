import { useEffect, useMemo, useState } from "react";
import type { CoverageHistoryPoint, DeclaredFlowSummary, GraphDiff, GraphVersion } from "@tellann/desktop-contracts";
import { Page, useProject, LoadingState, EmptyState, Status } from "../../pages";
import { SelectField } from "../../components/ui/select";
import { GitCompareArrows } from "lucide-react";

function CoverageTrendChart({ points }: { points: CoverageHistoryPoint[] }) {
  if (points.length < 2) return null;
  const width = 700;
  const height = 180;
  const padding = 24;
  const maxScore = 1;
  const xFor = (i: number) => padding + (i / (points.length - 1)) * (width - padding * 2);
  const yFor = (score: number) => height - padding - (score / maxScore) * (height - padding * 2);
  const linePoints = points.map((p, i) => `${xFor(i)},${yFor(p.coverageScore)}`).join(" ");
  const areaPoints = `${padding},${height - padding} ${linePoints} ${width - padding},${height - padding}`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Coverage trend over versions" className="coverage-trend-chart">
      <defs>
        <linearGradient id="coverage-trend-gradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 0.25, 0.5, 0.75, 1].map((fraction) => (
        <line key={fraction} x1={padding} x2={width - padding} y1={yFor(fraction)} y2={yFor(fraction)} className="coverage-trend-grid" />
      ))}
      <polygon points={areaPoints} fill="url(#coverage-trend-gradient)" />
      <polyline points={linePoints} fill="none" stroke="var(--accent)" strokeWidth={2} />
      {points.map((p, i) => (
        <g key={p.versionId}>
          <circle cx={xFor(i)} cy={yFor(p.coverageScore)} r={3.5} fill="var(--accent)" />
          <text x={xFor(i)} y={height - 6} textAnchor="middle" className="coverage-trend-label">
            v{p.versionNumber}
          </text>
        </g>
      ))}
    </svg>
  );
}

export function GraphDriftPage() {
  const { projectId, getDeclaredFlows } = useProject();
  const [flows, setFlows] = useState<DeclaredFlowSummary[] | null>(null);
  const [flowId, setFlowId] = useState<string>("");
  const [versions, setVersions] = useState<GraphVersion[] | null>(null);
  const [history, setHistory] = useState<CoverageHistoryPoint[]>([]);
  const [fromVersion, setFromVersion] = useState<string>("");
  const [toVersion, setToVersion] = useState<string>("");
  const [diff, setDiff] = useState<GraphDiff | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) return;
    getDeclaredFlows(projectId).then((result) => {
      setFlows(result);
      if (result.length && !flowId) setFlowId(result[0].id);
    }).catch(() => setFlows([]));
  }, [projectId, getDeclaredFlows]);

  useEffect(() => {
    if (!projectId || !flowId) return;
    setVersions(null);
    setDiff(null);
    Promise.all([
      window.tellann!.analytics.graphVersions(projectId, flowId),
      window.tellann!.analytics.coverageHistory(projectId, flowId),
    ])
      .then(([v, h]) => {
        setVersions(v);
        setHistory(h);
        if (v.length >= 2) {
          setFromVersion(String(v[v.length - 2].version));
          setToVersion(String(v[v.length - 1].version));
        }
      })
      .catch((err) => setError(String((err as Error)?.message ?? err)));
  }, [projectId, flowId]);

  const regression = useMemo(() => {
    for (let i = 1; i < history.length; i += 1) {
      const delta = history[i].coverageScore - history[i - 1].coverageScore;
      if (delta < -0.1) {
        return `v${history[i - 1].versionNumber} → v${history[i].versionNumber}: dropped by ${Math.round(-delta * 100)}%`;
      }
    }
    return null;
  }, [history]);

  const compare = async () => {
    if (!projectId || !flowId || !fromVersion || !toVersion) return;
    setError(null);
    try {
      setDiff(await window.tellann!.analytics.graphVersionDiff(projectId, flowId, fromVersion, toVersion));
    } catch (err) {
      setError(String((err as Error)?.message ?? err));
    }
  };

  if (!flows) return <LoadingState />;

  return (
    <Page
      title="Graph Drift"
      description="How your declared behavior graph has changed between versions."
      toolbar={
        flows.length ? (
          <SelectField
            ariaLabel="Flow"
            value={flowId}
            onValueChange={setFlowId}
            options={flows.map((flow) => ({ value: flow.id, label: flow.name }))}
          />
        ) : undefined
      }
    >
      {error ? (
        <div className="inline-error" role="alert">
          <span>{error}</span>
        </div>
      ) : null}

      {!flows.length ? (
        <EmptyState icon={<GitCompareArrows size={28} />} title="No flows declared yet" description="Declare a flow under Intent before tracking its graph drift." />
      ) : versions === null ? (
        <LoadingState />
      ) : versions.length < 2 ? (
        <EmptyState icon={<GitCompareArrows size={28} />} title="Not enough history yet" description="Graph drift needs at least two published versions of this flow to compare." />
      ) : (
        <div className="stack">
          {regression ? (
            <div className="inline-error" role="alert">
              <span>Coverage regression detected: {regression}</span>
            </div>
          ) : null}

          <section className="content-card">
            <h2>Coverage trend</h2>
            <CoverageTrendChart points={history} />
          </section>

          <section className="content-card">
            <header className="settings-row-head">
              <h2>Compare versions</h2>
              <div style={{ display: "flex", gap: 8 }}>
                <SelectField
                  ariaLabel="From version"
                  value={fromVersion}
                  onValueChange={setFromVersion}
                  options={versions.map((v) => ({ value: String(v.version), label: `v${v.version}` }))}
                />
                <SelectField
                  ariaLabel="To version"
                  value={toVersion}
                  onValueChange={setToVersion}
                  options={versions.map((v) => ({ value: String(v.version), label: `v${v.version}` }))}
                />
                <button type="button" className="button primary" onClick={compare}>
                  Compare
                </button>
              </div>
            </header>

            {diff ? (
              <div className="stack" style={{ marginTop: 12 }}>
                <p className="muted">
                  {diff.summary.stateCountDelta >= 0 ? "+" : ""}
                  {diff.summary.stateCountDelta} states, {diff.summary.transitionCountDelta >= 0 ? "+" : ""}
                  {diff.summary.transitionCountDelta} transitions
                </p>
                {diff.addedStates.length ? (
                  <div>
                    <Status>Added states</Status>
                    <p>{diff.addedStates.join(", ")}</p>
                  </div>
                ) : null}
                {diff.removedStates.length ? (
                  <div>
                    <Status>Removed states</Status>
                    <p>{diff.removedStates.join(", ")}</p>
                  </div>
                ) : null}
                {diff.addedTransitions.length ? (
                  <div>
                    <Status>Added transitions</Status>
                    <p>{diff.addedTransitions.map((t) => `${t.fromState} → ${t.toState}`).join(", ")}</p>
                  </div>
                ) : null}
                {diff.removedTransitions.length ? (
                  <div>
                    <Status>Removed transitions</Status>
                    <p>{diff.removedTransitions.map((t) => `${t.fromState} → ${t.toState}`).join(", ")}</p>
                  </div>
                ) : null}
              </div>
            ) : null}
          </section>
        </div>
      )}
    </Page>
  );
}
