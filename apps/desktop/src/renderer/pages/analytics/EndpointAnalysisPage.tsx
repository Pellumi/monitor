import { useEffect, useState } from "react";
import type { EndpointAnalysis } from "@tellann/desktop-contracts";
import { Page, useProject, LoadingState, EmptyState } from "../../pages";
import { Status } from "../../pages";
import { Gauge } from "lucide-react";
import { activeEnvironmentId } from "./shared";

const SLOW_REQUEST_MS = 1000;
const WATCH_REQUEST_MS = 500;
const ERROR_RATE_THRESHOLD = 0.05;

function severity(endpoint: EndpointAnalysis["endpoints"][number]): "Critical" | "Warning" | "Monitor" | "Healthy" {
  const slow = endpoint.p95Ms > SLOW_REQUEST_MS || (endpoint.p50Ms > 0 && endpoint.p95Ms >= endpoint.p50Ms * 3);
  const errorProne = endpoint.errorRate > ERROR_RATE_THRESHOLD;
  if (slow && errorProne) return "Critical";
  if (slow || errorProne) return "Warning";
  if (endpoint.p95Ms > WATCH_REQUEST_MS) return "Monitor";
  return "Healthy";
}

function LatencyBar({ label, ms, max }: { label: string; ms: number; max: number }) {
  const pct = max > 0 ? Math.min(100, (ms / max) * 100) : 0;
  const tone = ms > SLOW_REQUEST_MS ? "danger" : ms > WATCH_REQUEST_MS ? "warning" : "success";
  return (
    <div className="endpoint-latency-row">
      <span className="endpoint-latency-label">{label}</span>
      <div className="endpoint-latency-track">
        <div className="endpoint-latency-fill" data-tone={tone} style={{ width: `${pct}%` }} />
      </div>
      <span className="endpoint-latency-value">{Math.round(ms)}ms</span>
    </div>
  );
}

export function EndpointAnalysisPage() {
  const { projectId, application } = useProject();
  const [data, setData] = useState<EndpointAnalysis | null>(null);

  useEffect(() => {
    if (!projectId) return;
    const environmentId = activeEnvironmentId(application, projectId);
    let cancelled = false;
    const load = () =>
      window.tellann!.analytics
        .endpointAnalysis(projectId, { windowDays: 30, environmentId })
        .then((result) => !cancelled && setData(result))
        .catch(() => undefined);
    load();
    const interval = setInterval(load, 30_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [projectId, application]);

  if (!data) return <LoadingState />;
  if (!data.endpoints.length) {
    return (
      <Page title="Endpoint Analysis" description="Latency and error rate per route, over the last 30 days.">
        <EmptyState icon={<Gauge size={28} />} title="No endpoint telemetry yet" description="Connect your backend SDK and endpoint timings will appear here." />
      </Page>
    );
  }

  const maxP95 = Math.max(...data.endpoints.map((e) => e.p95Ms), 1);

  return (
    <Page
      title="Endpoint Analysis"
      description={`Latency and error rate per route, over the last ${data.windowDays} days${data.windowClampedByRetention ? " (clamped by plan retention)" : ""}.`}
    >
      <div className="stack">
        {data.endpoints.map((endpoint) => (
          <section className="content-card" key={`${endpoint.method}:${endpoint.endpoint}`}>
            <header className="settings-row-head">
              <h2>
                <code>{endpoint.method}</code> {endpoint.route}
              </h2>
              <Status>{severity(endpoint)}</Status>
            </header>
            <p className="muted">
              {endpoint.requestCount.toLocaleString()} requests · {(endpoint.errorRate * 100).toFixed(1)}% errors
            </p>
            <LatencyBar label="avg" ms={endpoint.avgMs} max={maxP95} />
            <LatencyBar label="p50" ms={endpoint.p50Ms} max={maxP95} />
            <LatencyBar label="p95" ms={endpoint.p95Ms} max={maxP95} />
            <LatencyBar label="p99" ms={endpoint.p99Ms} max={maxP95} />
            {endpoint.recommendation ? <p className="muted" style={{ marginTop: 8 }}>{endpoint.recommendation}</p> : null}
          </section>
        ))}
      </div>
    </Page>
  );
}
