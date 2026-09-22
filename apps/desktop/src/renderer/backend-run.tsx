/**
 * The backend half of the live run page.
 *
 * A backend run answers a different question from a frontend one. There is no
 * viewport, no route the operator is looking at and no element to inspect;
 * what there is, is a stream of requests the application's own server handled.
 * So the workspace shows the request totals, the endpoints behind them and the
 * models those endpoints touched, and the evidence panel is organised by
 * request, server error and data operation rather than by console and network.
 */
import { useEffect, useState } from "react";
import { Copy, Database, Network, ServerCrash, Workflow, Gauge, AlertTriangle } from "lucide-react";
import type {
  BackendEndpointStat,
  BackendModelStat,
  BackendRunSummary,
  GuidedRunState,
  LiveEvidence,
} from "@tellann/browser-observer";

export type BackendEvidenceTabValue =
  | "REQUESTS"
  | "SERVER"
  | "DATA"
  | "FLOW"
  | "PERFORMANCE"
  | "FINDINGS";

export const BACKEND_EVIDENCE_TABS: Array<{
  value: BackendEvidenceTabValue;
  label: string;
  icon: typeof Network;
  kinds: Array<LiveEvidence["kind"]>;
}> = [
  { value: "REQUESTS", label: "Requests", icon: Network, kinds: ["REQUEST"] },
  { value: "SERVER", label: "Server", icon: ServerCrash, kinds: ["SERVER", "PAGE"] },
  { value: "DATA", label: "Data", icon: Database, kinds: ["DATA", "STORAGE"] },
  { value: "FLOW", label: "Flow", icon: Workflow, kinds: ["FLOW"] },
  { value: "PERFORMANCE", label: "Performance", icon: Gauge, kinds: ["PERFORMANCE"] },
  { value: "FINDINGS", label: "Findings", icon: AlertTriangle, kinds: [] },
];

/** Whether this run opens a browser at all. */
export function isBackendOnlyRun(run: Pick<GuidedRunState, "captureTracks">): boolean {
  const tracks = run.captureTracks ?? ["FRONTEND"];
  return tracks.includes("BACKEND") && !tracks.includes("FRONTEND");
}

export function hasBackendTrack(run: Pick<GuidedRunState, "captureTracks">): boolean {
  return (run.captureTracks ?? ["FRONTEND"]).includes("BACKEND");
}

function formatMilliseconds(value: number | null | undefined): string {
  if (value == null) return "—";
  if (value < 1) return "<1 ms";
  if (value < 1_000) return `${Math.round(value)} ms`;
  return `${(value / 1_000).toFixed(value < 10_000 ? 2 : 1)} s`;
}

function formatBytes(value: number): string {
  if (!value) return "0 B";
  if (value < 1_024) return `${value} B`;
  if (value < 1_024 * 1_024) return `${(value / 1_024).toFixed(1)} KB`;
  return `${(value / (1_024 * 1_024)).toFixed(1)} MB`;
}

function percentage(part: number, whole: number): string {
  if (!whole) return "0%";
  const value = (part / whole) * 100;
  return `${value < 10 && value > 0 ? value.toFixed(1) : Math.round(value)}%`;
}

/**
 * The four numbers a backend run is read by, in the place the frontend run
 * puts route, viewport, event count and interaction mode.
 */
export function BackendRunFacts({
  summary,
  targetUrl,
  connected,
}: {
  summary: BackendRunSummary | null;
  targetUrl: string;
  connected: boolean;
}) {
  const totals = summary ?? null;
  const requests = totals?.requests ?? 0;
  const errors = totals?.errors ?? 0;
  return (
    <div className="run-facts">
      <article>
        <small>Requests handled</small>
        <strong>{requests}</strong>
        <span>
          {requests
            ? `${totals?.endpoints.length ?? 0} endpoint${(totals?.endpoints.length ?? 0) === 1 ? "" : "s"} · ${formatBytes((totals?.requestBytes ?? 0) + (totals?.responseBytes ?? 0))} transferred`
            : connected
              ? "Your application has not reported a request yet."
              : "Waiting for the first request from your application."}
        </span>
      </article>
      <article data-tone={errors ? "warning" : undefined}>
        <small>Failed responses</small>
        <strong>{errors}</strong>
        <span>
          {requests
            ? `${percentage(errors, requests)} of requests · ${totals?.serverErrors ?? 0} server, ${totals?.clientErrors ?? 0} client`
            : "4xx and 5xx responses are counted here as they happen."}
        </span>
      </article>
      <article>
        <small>Response time</small>
        <strong>{formatMilliseconds(totals?.p95Ms ?? null)} p95</strong>
        <span>
          {totals?.p50Ms == null
            ? "Server-side handler duration, measured by the SDK."
            : `${formatMilliseconds(totals.p50Ms)} median · ${formatMilliseconds(totals.slowestMs)} slowest`}
        </span>
      </article>
      <article>
        <small>Data operations</small>
        <strong>{totals?.dataOperations ?? 0}</strong>
        <span>
          {totals?.models.length
            ? `${totals.models.length} model${totals.models.length === 1 ? "" : "s"} touched`
            : "Reads and writes appear here once the SDK's data hooks are wired up."}
        </span>
      </article>
      <article className="run-fact-wide">
        <small>Capture target</small>
        <strong>{(() => { try { return new URL(targetUrl).host; } catch { return targetUrl; } })()}</strong>
        <span>
          No browser is opened for a backend run. Drive the API however you
          normally would — your client, your tests, curl — and every request the
          SDK reports is recorded against this run.
        </span>
      </article>
    </div>
  );
}

/** Every route the run has exercised, busiest first. */
export function BackendEndpointTable({ endpoints }: { endpoints: BackendEndpointStat[] }) {
  return (
    <section className="run-endpoints">
      <header>
        <h2>Endpoints</h2>
        <span>{endpoints.length}</span>
      </header>
      {endpoints.length ? (
        <table>
          <thead>
            <tr>
              <th scope="col">Route</th>
              <th scope="col">Calls</th>
              <th scope="col">Errors</th>
              <th scope="col">Avg</th>
              <th scope="col">p95</th>
              <th scope="col">Models</th>
            </tr>
          </thead>
          <tbody>
            {endpoints.slice(0, 50).map((endpoint) => (
              <tr key={endpoint.key} data-failing={endpoint.errors ? "true" : undefined}>
                <th scope="row">
                  <span className="run-endpoint-method" data-method={endpoint.method.toLowerCase()}>
                    {endpoint.method}
                  </span>
                  <code>{endpoint.route}</code>
                </th>
                <td>{endpoint.requests}</td>
                <td>{endpoint.errors || "—"}</td>
                <td>{formatMilliseconds(endpoint.requests ? endpoint.totalDurationMs / endpoint.requests : null)}</td>
                <td>{formatMilliseconds(endpoint.p95Ms || null)}</td>
                <td>{endpoint.models.length ? endpoint.models.join(", ") : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="run-findings-empty">
          No request has been reported yet. Check that the backend SDK is
          initialized in the process you are exercising and that it is pointed
          at this run.
        </p>
      )}
    </section>
  );
}

/** What the run changed, rather than only what it answered with. */
export function BackendModelTable({ models }: { models: BackendModelStat[] }) {
  if (!models.length) return null;
  return (
    <section className="run-models">
      <header>
        <h2>Models affected</h2>
        <span>{models.length}</span>
      </header>
      <table>
        <thead>
          <tr>
            <th scope="col">Model</th>
            <th scope="col">Reads</th>
            <th scope="col">Writes</th>
            <th scope="col">Operations</th>
            <th scope="col">Endpoints</th>
          </tr>
        </thead>
        <tbody>
          {models.slice(0, 50).map((model) => (
            <tr key={model.model}>
              <th scope="row"><code>{model.model}</code></th>
              <td>{model.reads || "—"}</td>
              <td>{model.writes || "—"}</td>
              <td>{model.operations.slice(0, 4).join(", ") || "—"}</td>
              <td>{model.endpoints.length ? model.endpoints.slice(0, 3).join(", ") : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

type RelayConnection = {
  endpoint: string;
  relayToken: string;
  runId: string;
  sessionId: string;
  traceId: string;
  applicationId: string;
  environmentId: string;
};

/** The environment a server the operator starts themselves needs to report in. */
function connectionEnvironment(connection: RelayConnection): string {
  return [
    `TELLANN_RELAY_ENDPOINT=${connection.endpoint}`,
    `TELLANN_RUN_CREDENTIAL=${connection.relayToken}`,
    `TELLANN_RUN_ID=${connection.runId}`,
    `TELLANN_SESSION_ID=${connection.sessionId}`,
    `TELLANN_TRACE_ID=${connection.traceId}`,
    `TELLANN_APPLICATION_ID=${connection.applicationId}`,
    `TELLANN_ENVIRONMENT_ID=${connection.environmentId}`,
  ].join("\n");
}

/**
 * What the run is waiting for when nothing has arrived yet.
 *
 * A backend run that shows zeros is nearly always a wiring problem, not a
 * quiet application, so the empty state says what to check — and hands over
 * the exact environment a server started outside Tellann needs, which is the
 * one thing an operator cannot work out for themselves.
 */
export function BackendWaitingPanel({ targetUrl }: { targetUrl: string }) {
  const [connection, setConnection] = useState<RelayConnection | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void window.tellann?.runs
      ?.relayConnection?.()
      .then((value) => { if (!cancelled) setConnection(value); })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  return (
    <section className="run-waiting">
      <header>
        <Network size={18} />
        <div>
          <small>Waiting for traffic</small>
          <strong>No request has reached this run yet</strong>
        </div>
      </header>
      <dl>
        <div>
          <dt>Capture target</dt>
          <dd>{targetUrl}</dd>
        </div>
        <div>
          <dt>What to check</dt>
          <dd>
            The backend SDK is initialized where your server starts, its
            middleware is registered, and the process can reach this run.
          </dd>
        </div>
      </dl>
      {connection ? (
        <div className="run-connect">
          <div className="run-connect-heading">
            <strong>Started your server yourself?</strong>
            <button
              type="button"
              className="button"
              onClick={() => {
                void window.tellann?.system?.copyText?.(connectionEnvironment(connection));
                setCopied(true);
                window.setTimeout(() => setCopied(false), 2_000);
              }}
            >
              <Copy size={14} />
              {copied ? "Copied" : "Copy environment"}
            </button>
          </div>
          <p>
            A process Tellann launches is given this automatically. A process
            you start yourself needs it in its environment before the SDK can
            report into this run — it is valid only while the run is open.
          </p>
          <pre>{connectionEnvironment(connection)}</pre>
        </div>
      ) : null}
    </section>
  );
}
