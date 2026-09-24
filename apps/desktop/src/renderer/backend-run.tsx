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
import { Link } from "react-router-dom";
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

/**
 * What fills each pane, said where the pane is empty.
 *
 * An empty pane with a generic message is indistinguishable from a broken one.
 * For the backend track two of these panes stay empty unless something is
 * wired up, so the message says what and how rather than leaving the operator
 * to guess whether their server is quiet or their SDK is not reporting.
 */
export const BACKEND_EMPTY_EVIDENCE: Record<BackendEvidenceTabValue, string> = {
  REQUESTS:
    "Requests appear here as your server handles them. If this stays empty while you are calling the API, the backend SDK is not reporting into this run.",
  SERVER:
    "Unhandled server errors appear here. An empty pane is the good outcome: nothing was raised outside a response.",
  DATA:
    "Reads and writes appear here once the SDK can see your data layer. Django and SQLAlchemy are wired up automatically by the SDK's middleware. For Prisma, extend your client once: prisma.$extends(tellannPrismaExtension()). Anything else can report directly with TELLANN.trackDataAccess({ model, operation }).",
  FLOW:
    "Flow events appear here when your application reports a declared state. A run without a Flow attached never fills this pane.",
  PERFORMANCE:
    "Requests that took notably longer than usual appear here — over a second, or several times the endpoint's own median. An empty pane means nothing stood out.",
  FINDINGS: "No findings have been raised in this run.",
};

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

type IngestionKeySummary = {
  id: string;
  keyPrefix: string;
  label: string | null;
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
};

/** The standing environment a server started outside Tellann needs, set once. */
function environmentBlock(input: {
  gatewayEndpoint: string;
  ingestionKey: string;
  applicationId: string;
  environmentId: string;
}): string {
  return [
    `TELLANN_GATEWAY_URL=${input.gatewayEndpoint}`,
    `TELLANN_INGESTION_KEY=${input.ingestionKey}`,
    `TELLANN_APPLICATION_ID=${input.applicationId}`,
    `TELLANN_ENVIRONMENT_ID=${input.environmentId}`,
  ].join("\n");
}

/**
 * What the run is waiting for when nothing has arrived yet.
 *
 * A backend run that shows zeros is nearly always a wiring problem, not a
 * quiet application, so the empty state says what to check. What it hands
 * over to fix that is this environment's standing ingestion key rather than
 * a credential scoped to this one run: a server the desktop did not start —
 * most of all one that is actually deployed somewhere, not running on this
 * machine — is configured with it once and never has to change it before the
 * next run. Which run a request lands on is resolved from whichever run is
 * currently recording against this environment, not from anything the
 * server's own configuration carries.
 */
export function BackendWaitingPanel({
  targetUrl,
  applicationId,
  environmentId,
}: {
  targetUrl: string;
  applicationId: string;
  environmentId: string;
}) {
  const [loading, setLoading] = useState(true);
  const [gatewayEndpoint, setGatewayEndpoint] = useState<string | null>(null);
  const [keys, setKeys] = useState<IngestionKeySummary[]>([]);
  const [createdKey, setCreatedKey] = useState<{ rawKey: string; keyPrefix: string } | null>(null);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void window.tellann?.runs
      ?.listIngestionKeys?.(environmentId)
      .then((result) => {
        if (cancelled) return;
        setGatewayEndpoint(result.gatewayEndpoint);
        setKeys(result.keys);
      })
      .catch(() => undefined)
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [environmentId]);

  const copy = (text: string) => {
    void window.tellann?.system?.copyText?.(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2_000);
  };

  const handleCreate = async () => {
    setCreating(true);
    try {
      const result = await window.tellann?.runs?.createIngestionKey?.(environmentId);
      if (!result) return;
      setGatewayEndpoint(result.gatewayEndpoint);
      setCreatedKey({ rawKey: result.key.rawKey, keyPrefix: result.key.keyPrefix });
      setKeys((existing) => [{ ...result.key, lastUsedAt: null }, ...existing]);
    } finally {
      setCreating(false);
    }
  };

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
            middleware is registered, and it is configured with this
            environment's ingestion key.
          </dd>
        </div>
      </dl>
      {loading ? null : createdKey && gatewayEndpoint ? (
        <div className="run-connect">
          <div className="run-connect-heading">
            <strong>New ingestion key created</strong>
            <button
              type="button"
              className="button"
              onClick={() => copy(environmentBlock({
                gatewayEndpoint, ingestionKey: createdKey.rawKey, applicationId, environmentId,
              }))}
            >
              <Copy size={14} />
              {copied ? "Copied" : "Copy environment"}
            </button>
          </div>
          <p>
            Shown once — set this in your server's environment and it needs no
            further changes. A process Tellann launches itself already has
            this automatically.
          </p>
          <pre>{environmentBlock({
            gatewayEndpoint, ingestionKey: createdKey.rawKey, applicationId, environmentId,
          })}</pre>
        </div>
      ) : keys.length && gatewayEndpoint ? (
        <div className="run-connect">
          <div className="run-connect-heading">
            <strong>Started your server yourself?</strong>
          </div>
          <p>
            This environment already has a standing ingestion key
            (<code>{keys[0].keyPrefix}…</code>, {keys[0].label || "unlabeled"}).
            If your server's <code>TELLANN_INGESTION_KEY</code> is already set
            to it, its requests are picked up automatically — nothing to
            reconfigure for this run. A key's value is only ever shown once,
            at creation, so it cannot be recovered here if it was lost.
          </p>
          <dl>
            <div>
              <dt>TELLANN_GATEWAY_URL</dt>
              <dd className="mono">{gatewayEndpoint}</dd>
            </div>
            <div>
              <dt>TELLANN_APPLICATION_ID</dt>
              <dd className="mono">{applicationId}</dd>
            </div>
            <div>
              <dt>TELLANN_ENVIRONMENT_ID</dt>
              <dd className="mono">{environmentId}</dd>
            </div>
          </dl>
          <button type="button" className="button" onClick={() => void handleCreate()} disabled={creating}>
            <Copy size={14} />
            {creating ? "Creating…" : "Create another key"}
          </button>
        </div>
      ) : (
        <div className="run-connect">
          <div className="run-connect-heading">
            <strong>Started your server yourself?</strong>
            <button type="button" className="button" onClick={() => void handleCreate()} disabled={creating}>
              {creating ? "Creating…" : "Create ingestion key"}
            </button>
          </div>
          <p>
            This environment has no standing ingestion key yet. Create one and
            it works for this run and every future one — a deployed server
            never needs a fresh credential before it can be exercised again.
          </p>
        </div>
      )}
    </section>
  );
}


// ── the report's backend section ────────────────────────────────────────────
//
// The report page reads a stored payload rather than live run state, so these
// take the section as it was written: loosely typed, tolerant of a payload
// from an older schema, and never assuming a field is present.

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function rows(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.map(record) : [];
}

function numberOf(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function textList(value: unknown, fallback = "—"): string {
  const items = Array.isArray(value) ? value.map((item) => String(item)).filter(Boolean) : [];
  return items.length ? items.join(", ") : fallback;
}

/** `2xx 14 · 5xx 1`, in ascending class order. */
function statusClasses(value: unknown): string {
  const entries = Object.entries(record(value)).sort(([left], [right]) => left.localeCompare(right));
  return entries.length ? entries.map(([name, count]) => `${name} ${Number(count)}`).join(" · ") : "—";
}

type Highlight = { label: string; value: string; detail: string; note?: string; tone?: "danger" | "warning" | "success" };

const plural = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;
const endpointLabel = (endpoint: Record<string, unknown>) => `${String(endpoint.method ?? "GET")} ${String(endpoint.route ?? "/")}`;

function largestBy<T>(items: T[], score: (item: T) => number): T | null {
  let best: T | null = null;
  let bestScore = 0;
  for (const item of items) {
    const value = score(item);
    if (value > bestScore) {
      best = item;
      bestScore = value;
    }
  }
  return best;
}

/**
 * The few things a reader would otherwise dig out of two long tables: which
 * endpoint was slowest, busiest and least reliable, which models took the
 * reads and the writes, and how the traffic was shaped. A card is left out when
 * the run has nothing to say for it, rather than shown empty.
 */
function reportHighlights(
  summary: Record<string, unknown>,
  endpoints: Record<string, unknown>[],
  models: Record<string, unknown>[],
  resolutions: Record<string, unknown>,
): Highlight[] {
  const cards: Highlight[] = [];

  const slowest = largestBy(endpoints, (endpoint) => numberOf(endpoint.slowestMs) ?? 0);
  if (slowest) {
    cards.push({
      label: "Slowest endpoint",
      value: formatMilliseconds(numberOf(slowest.slowestMs)),
      detail: endpointLabel(slowest),
      note: `${formatMilliseconds(numberOf(slowest.p95Ms))} p95 across ${plural(numberOf(slowest.requests) ?? 0, "call")}`,
      tone: (numberOf(slowest.slowestMs) ?? 0) >= 5_000 ? "warning" : undefined,
    });
  }

  const busiest = largestBy(endpoints, (endpoint) => numberOf(endpoint.requests) ?? 0);
  if (busiest) {
    cards.push({
      label: "Busiest endpoint",
      value: plural(numberOf(busiest.requests) ?? 0, "call"),
      detail: endpointLabel(busiest),
      note: `${formatMilliseconds(numberOf(busiest.averageMs))} on average`,
    });
  }

  const failing = endpoints.filter((endpoint) => (numberOf(endpoint.errors) ?? 0) > 0);
  // Failure rate first, so a route that failed its only call outranks a busy one
  // with a single stray error; the absolute count breaks ties.
  const leastReliable = largestBy(
    failing,
    (endpoint) => (numberOf(endpoint.errors) ?? 0) / Math.max(numberOf(endpoint.requests) ?? 1, 1) + (numberOf(endpoint.errors) ?? 0) / 1_000,
  );
  cards.push(leastReliable
    ? {
        label: "Least reliable endpoint",
        value: `${numberOf(leastReliable.errors) ?? 0} of ${plural(numberOf(leastReliable.requests) ?? 0, "call")} failed`,
        detail: endpointLabel(leastReliable),
        note: `${plural(failing.length, "endpoint")} had failures · ${statusClasses(leastReliable.statusClasses)}`,
        tone: "danger",
      }
    : {
        label: "Reliability",
        value: "No failing endpoints",
        detail: endpoints.length ? `All ${plural(endpoints.length, "endpoint")} answered without an error` : "No responses were captured",
        tone: endpoints.length ? "success" : undefined,
      });

  const heaviest = largestBy(endpoints, (endpoint) => numberOf(endpoint.responseBytes) ?? 0);
  if (heaviest) {
    const calls = Math.max(numberOf(heaviest.requests) ?? 1, 1);
    cards.push({
      label: "Heaviest responses",
      value: formatBytes(numberOf(heaviest.responseBytes) ?? 0),
      detail: endpointLabel(heaviest),
      note: `${formatBytes(Math.round((numberOf(heaviest.responseBytes) ?? 0) / calls))} per call`,
    });
  }

  const mostRead = largestBy(models, (model) => numberOf(model.reads) ?? 0);
  if (mostRead) {
    cards.push({
      label: "Most-read model",
      value: plural(numberOf(mostRead.reads) ?? 0, "read"),
      detail: String(mostRead.model ?? "—"),
      note: Array.isArray(mostRead.endpoints) && mostRead.endpoints.length ? `Used by ${plural(mostRead.endpoints.length, "endpoint")}` : undefined,
    });
  }

  const mostWritten = largestBy(models, (model) => numberOf(model.writes) ?? 0);
  cards.push(mostWritten
    ? {
        label: "Most-written model",
        value: plural(numberOf(mostWritten.writes) ?? 0, "write"),
        detail: String(mostWritten.model ?? "—"),
        note: textList(mostWritten.operations),
        tone: "warning",
      }
    : {
        label: "Data changes",
        value: "No writes",
        detail: models.length ? "This run only read data" : "No data operations were reported",
      });

  const totalReads = models.reduce((sum, model) => sum + (numberOf(model.reads) ?? 0), 0);
  const totalWrites = models.reduce((sum, model) => sum + (numberOf(model.writes) ?? 0), 0);
  if (totalReads + totalWrites) {
    cards.push({
      label: "Data footprint",
      value: `${totalReads + totalWrites} operations`,
      detail: `${totalReads} reads · ${totalWrites} writes`,
      note: `Across ${plural(models.length, "model")}`,
    });
  }

  const perMinute = numberOf(summary.requestsPerMinute);
  const first = summary.firstRequestAt ? new Date(String(summary.firstRequestAt)).getTime() : NaN;
  const last = summary.lastRequestAt ? new Date(String(summary.lastRequestAt)).getTime() : NaN;
  if (perMinute !== null) {
    const spanMinutes = Number.isFinite(first) && Number.isFinite(last) ? Math.max(1, Math.round((last - first) / 60_000)) : null;
    cards.push({
      label: "Traffic",
      value: `${perMinute < 10 ? perMinute.toFixed(1) : Math.round(perMinute)} requests/min`,
      detail: spanMinutes === null ? "Across the run" : `Over ${spanMinutes} minute${spanMinutes === 1 ? "" : "s"} of activity`,
    });
  }

  const drafted = numberOf(resolutions.drafted) ?? 0;
  if (drafted) {
    cards.push({
      label: "Suggested resolutions",
      value: plural(drafted, "finding"),
      detail: "Have an AI-drafted resolution",
      note: resolutions.codeContext ? "Drafted with the code that handles each endpoint" : "Drafted from the captured requests",
    });
  }

  return cards;
}

/** True when this report has a backend section worth rendering. */
export function hasBackendSection(sections: Record<string, unknown>): boolean {
  return Object.keys(record(sections.backendSummary)).length > 0;
}

/**
 * The backend rollup on the report page: the numbers, the endpoints behind
 * them, and what those endpoints changed. Everything else about a finding
 * stays in the downloadable report, as it does for the rest of this page.
 */
export function BackendReportCard({
  sections,
  runHref,
}: {
  sections: Record<string, unknown>;
  /** Where the full request-by-request history lives, so the card can point at it. */
  runHref?: string;
}) {
  const summary = record(sections.backendSummary);
  if (!Object.keys(summary).length) return null;
  const endpoints = rows(summary.endpoints);
  const models = rows(summary.models);
  const highlights = reportHighlights(summary, endpoints, models, record(sections.findingResolutions));
  const errorGroups = rows(summary.serverErrorGroups);
  const requests = numberOf(summary.requests) ?? 0;
  const limitations = Array.isArray(summary.limitations)
    ? summary.limitations.map((item) => String(item))
    : [];

  return (
    <section className="content-card report-section">
      <div className="card-heading">
        <div>
          <small>Backend</small>
          <h2>What the server handled</h2>
        </div>
        <span className="status-pill" data-tone="neutral">
          <span aria-hidden="true" />
          {`${requests} request${requests === 1 ? "" : "s"}`}
        </span>
      </div>
      <p>
        Durations are server-side handler time as the SDK measured it, so they
        exclude the network and the client.
        {runHref ? (
          <>
            {" "}
            Every endpoint, request and data operation is listed in the{" "}
            <Link to={runHref}>QA run</Link>.
          </>
        ) : null}
      </p>
      <dl className="detail-list report-detail-grid">
        <div>
          <dt>Failed responses</dt>
          <dd>
            {numberOf(summary.errors) ?? 0}
            {summary.errorRate == null ? "" : ` · ${Number(summary.errorRate).toFixed(1)}% of requests`}
          </dd>
        </div>
        <div>
          <dt>Breakdown</dt>
          <dd>
            {`${numberOf(summary.serverErrors) ?? 0} server · ${numberOf(summary.clientErrors) ?? 0} client · ${numberOf(summary.unhandledErrors) ?? 0} unhandled`}
          </dd>
        </div>
        <div>
          <dt>Response time</dt>
          <dd>
            {`${formatMilliseconds(numberOf(summary.p50Ms))} median · ${formatMilliseconds(numberOf(summary.p95Ms))} p95 · ${formatMilliseconds(numberOf(summary.slowestMs))} slowest`}
          </dd>
        </div>
        <div>
          <dt>Transferred</dt>
          <dd>
            {`${formatBytes(numberOf(summary.requestBytes) ?? 0)} in · ${formatBytes(numberOf(summary.responseBytes) ?? 0)} out`}
          </dd>
        </div>
        <div>
          <dt>Data operations</dt>
          <dd>{`${numberOf(summary.dataOperations) ?? 0} across ${models.length} model${models.length === 1 ? "" : "s"}`}</dd>
        </div>
        <div>
          <dt>Payloads retained</dt>
          <dd>{`${numberOf(summary.payloadsCaptured) ?? 0} of ${requests} requests`}</dd>
        </div>
      </dl>

      {highlights.length ? (
        <div className="report-highlights" aria-label="Highlights from this run">
          {highlights.map((highlight) => (
            <article className="report-highlight" data-tone={highlight.tone} key={highlight.label}>
              <small>{highlight.label}</small>
              <strong>{highlight.value}</strong>
              <span title={highlight.detail}>{highlight.detail}</span>
              {highlight.note ? <em>{highlight.note}</em> : null}
            </article>
          ))}
        </div>
      ) : null}

      {errorGroups.length ? (
        <section className="run-models">
          <header>
            <h2>Unhandled server errors</h2>
            <span>{errorGroups.length}</span>
          </header>
          <table>
            <thead>
              <tr>
                <th scope="col">Type</th>
                <th scope="col">Where</th>
                <th scope="col">Count</th>
              </tr>
            </thead>
            <tbody>
              {errorGroups.slice(0, 50).map((group, index) => (
                <tr key={`${String(group.name ?? "error")}-${index}`}>
                  <th scope="row">{String(group.name ?? "Error")}</th>
                  <td>
                    <code>{String(group.route ?? "No route recorded")}</code>
                    <br />
                    {String(group.message ?? "")}
                  </td>
                  <td>{numberOf(group.occurrences) ?? 1}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      {limitations.length ? (
        <ul className="report-limitations">
          {limitations.map((limitation) => (
            <li key={limitation}>{limitation}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
