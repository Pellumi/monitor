/**
 * The backend section of a QA report.
 *
 * The desktop keeps a rolling summary while a run is live, but a report cannot
 * be built from it: the run state is a client-side view, it is trimmed as the
 * run grows, and a report has to be reproducible from what was actually
 * persisted. So this re-derives everything from the evidence events in the
 * database, which are the authoritative record.
 *
 * Nothing here reads a captured value. Payloads reach the database already
 * classified and encrypted, and a summary that decrypted them to count them
 * would defeat the point of protecting them.
 */

/** The evidence-event shape this summary needs. */
export type BackendEvidenceEvent = {
  id?: string;
  eventId?: string;
  eventType: string;
  occurredAt: Date | string;
  scope?: string | null;
  metadata: unknown;
};

export type BackendEndpointReport = {
  key: string;
  method: string;
  route: string;
  requests: number;
  errors: number;
  clientErrors: number;
  serverErrors: number;
  averageMs: number | null;
  p95Ms: number | null;
  slowestMs: number | null;
  /** How many responses fell in each status class, e.g. `{ "2xx": 14 }`. */
  statusClasses: Record<string, number>;
  lastStatus: number | null;
  models: string[];
  /**
   * What each model was actually used for on this endpoint.
   *
   * `models` above says which models a request declared it touched; this says
   * how many times and in which direction, which is the difference between
   * "this route reads orders" and "this route reads orders four hundred times".
   */
  modelUsage: Array<{ model: string; reads: number; writes: number; records: number | null }>;
  handlers: string[];
  requestBytes: number;
  responseBytes: number;
  firstAt: string | null;
  lastAt: string | null;
};

export type BackendModelReport = {
  model: string;
  reads: number;
  writes: number;
  /** Records the data layer reported touching, where it reported any. */
  records: number | null;
  operations: string[];
  endpoints: string[];
  firstAt: string | null;
  lastAt: string | null;
};

export type BackendErrorReport = {
  route: string | null;
  method: string | null;
  name: string;
  message: string;
  occurrences: number;
  lastAt: string | null;
};

export type BackendSlowRequest = {
  method: string;
  route: string;
  durationMs: number;
  statusCode: number | null;
  occurredAt: string | null;
  eventId: string | null;
};

export type BackendReportSection = {
  requests: number;
  errors: number;
  clientErrors: number;
  serverErrors: number;
  unhandledErrors: number;
  dataOperations: number;
  errorRate: number | null;
  totalDurationMs: number;
  averageMs: number | null;
  p50Ms: number | null;
  p95Ms: number | null;
  p99Ms: number | null;
  slowestMs: number | null;
  requestBytes: number;
  responseBytes: number;
  firstRequestAt: string | null;
  lastRequestAt: string | null;
  /** Requests per minute across the window the run actually saw traffic in. */
  requestsPerMinute: number | null;
  payloadsCaptured: number;
  /** Distinct routes observed. The table below may list fewer. */
  endpointsSeen: number;
  /** Distinct models observed. The table below may list fewer. */
  modelsSeen: number;
  endpoints: BackendEndpointReport[];
  models: BackendModelReport[];
  serverErrorGroups: BackendErrorReport[];
  slowestRequests: BackendSlowRequest[];
  limitations: string[];
};

/** Endpoints and models listed in the report. The rest stay queryable. */
const ENDPOINT_LIMIT = 100;
const MODEL_LIMIT = 100;
const ERROR_GROUP_LIMIT = 50;
const SLOWEST_LIMIT = 10;
/** Models listed against one endpoint. */
const MODELS_PER_ENDPOINT = 20;

const BACKEND_EVENT_TYPES = new Set([
  'QA_BACKEND_REQUEST',
  'QA_BACKEND_ERROR',
  'QA_BACKEND_DATA_ACCESS',
]);

export function isBackendEvidenceEvent(event: { eventType: string }): boolean {
  return BACKEND_EVENT_TYPES.has(event.eventType);
}

export function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export function asNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function asText(value: unknown, limit = 300): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text ? text.slice(0, limit) : null;
}

export function isoOf(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** Nearest-rank percentile, matching what the desktop shows during the run. */
export function percentileOf(values: number[], percentile: number): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const rank = Math.ceil((percentile / 100) * sorted.length);
  return sorted[Math.min(sorted.length - 1, Math.max(0, rank - 1))];
}

export function statusClass(status: number | null): string {
  if (status === null) return 'no response';
  return `${Math.floor(status / 100)}xx`;
}

export function rounded(value: number | null): number | null {
  return value === null ? null : Math.round(value * 100) / 100;
}

export function pushUnique(list: string[], value: string | null, limit: number): void {
  if (!value || list.includes(value) || list.length >= limit) return;
  list.push(value);
}

/**
 * Builds the report's backend section, or null when the run captured no
 * backend evidence at all — a frontend-only run should not carry an empty
 * section explaining that its backend did nothing.
 */
export function summarizeBackendEvidence(
  events: BackendEvidenceEvent[],
  options: { captureTracks?: string[] | null } = {},
): BackendReportSection | null {
  const backendEvents = events.filter(isBackendEvidenceEvent);
  const tracksBackend = (options.captureTracks ?? []).includes('BACKEND');
  if (!backendEvents.length && !tracksBackend) return null;

  const durations: number[] = [];
  const endpointDurations = new Map<string, number[]>();
  const endpoints = new Map<string, BackendEndpointReport>();
  const models = new Map<string, BackendModelReport>();
  const errorGroups = new Map<string, BackendErrorReport>();
  /**
   * Per-endpoint model usage, accumulated standalone rather than through the
   * endpoint map. A data-access event can arrive before the request event for
   * the same endpoint — the SDK collapses a request's operations and may flush
   * them first — so writing through `endpoints.get(key)` during the loop would
   * silently lose every early-arriving operation.
   */
  const endpointModelUsage = new Map<string, Map<string, { reads: number; writes: number; records: number | null }>>();
  const slowest: BackendSlowRequest[] = [];
  /** Distinct routes and models seen, so a capped table never mis-states the totals. */
  let endpointsSeen = 0;
  let modelsSeen = 0;
  /** Requests carrying a captured body, which is what a reader can inspect. */
  let payloadsCaptured = 0;
  let requests = 0;
  let clientErrors = 0;
  let serverErrors = 0;
  let unhandledErrors = 0;
  let dataOperations = 0;
  let totalDurationMs = 0;
  let requestBytes = 0;
  let responseBytes = 0;
  let firstRequestAt: string | null = null;
  let lastRequestAt: string | null = null;

  for (const event of backendEvents) {
    const metadata = asRecord(event.metadata);
    const at = isoOf(event.occurredAt);

    if (event.eventType === 'QA_BACKEND_ERROR') {
      unhandledErrors += 1;
      const name = asText(metadata.name, 200) ?? 'Error';
      const route = asText(metadata.route);
      const key = `${route ?? 'unrouted'}:${name}`;
      const existing = errorGroups.get(key);
      if (existing) {
        existing.occurrences += 1;
        existing.lastAt = at ?? existing.lastAt;
      } else if (errorGroups.size < ERROR_GROUP_LIMIT) {
        errorGroups.set(key, {
          route,
          method: asText(metadata.method, 12),
          name,
          message: asText(metadata.message, 1_000) ?? 'Server error',
          occurrences: 1,
          lastAt: at,
        });
      }
      continue;
    }

    if (event.eventType === 'QA_BACKEND_DATA_ACCESS') {
      // The SDK collapses a request's operations before sending them, so one
      // event can stand for many; counting events would under-report a view
      // that queries in a loop.
      const count = Math.max(1, Math.round(asNumber(metadata.count) ?? 1));
      dataOperations += count;
      const model = asText(metadata.model, 120);
      if (!model) continue;
      const operation = asText(metadata.operation, 60) ?? 'unknown';
      const records = asNumber(metadata.records);
      const route = asText(metadata.route);
      const method = asText(metadata.method, 12);
      const existing = models.get(model);
      const entry = existing ?? {
        model, reads: 0, writes: 0, records: null,
        operations: [], endpoints: [], firstAt: at, lastAt: at,
      };
      if (!existing) {
        modelsSeen += 1;
        if (models.size >= MODEL_LIMIT) continue;
        models.set(model, entry);
      }
      if (metadata.mutation === true) entry.writes += count;
      else entry.reads += count;
      if (records !== null) entry.records = (entry.records ?? 0) + records;
      entry.lastAt = at ?? entry.lastAt;
      pushUnique(entry.operations, operation, 12);
      pushUnique(entry.endpoints, route ? `${method ? `${method} ` : ''}${route}` : null, 20);
      if (route) {
        const endpointKey = `${(method ?? 'GET').toUpperCase()} ${route}`;
        const usage = endpointModelUsage.get(endpointKey) ?? new Map();
        endpointModelUsage.set(endpointKey, usage);
        const row = usage.get(model) ?? { reads: 0, writes: 0, records: null };
        if (metadata.mutation === true) row.writes += count; else row.reads += count;
        if (records !== null) row.records = (row.records ?? 0) + records;
        usage.set(model, row);
      }
      continue;
    }

    // QA_BACKEND_REQUEST
    requests += 1;
    const method = (asText(metadata.method, 12) ?? 'GET').toUpperCase();
    const route = asText(metadata.route) ?? '/';
    const status = asNumber(metadata.statusCode);
    const durationMs = asNumber(metadata.durationMs);
    const key = `${method} ${route}`;
    if (status !== null && status >= 500) serverErrors += 1;
    else if (status !== null && status >= 400) clientErrors += 1;
    requestBytes += asNumber(metadata.requestBytes) ?? 0;
    responseBytes += asNumber(metadata.responseBytes) ?? 0;
    if (metadata.requestBody !== undefined || metadata.responseBody !== undefined) payloadsCaptured += 1;
    if (!firstRequestAt || (at && at < firstRequestAt)) firstRequestAt = at ?? firstRequestAt;
    if (!lastRequestAt || (at && at > lastRequestAt)) lastRequestAt = at ?? lastRequestAt;

    // Run-wide timing is accumulated before the endpoint table is capped.
    // These used to sit below the cap's `continue`, so on an application with
    // more than ENDPOINT_LIMIT routes the run's average, percentiles and
    // slowest-request list silently excluded every request past the cap — the
    // limitation text said the table was shortened, not that the totals beside
    // it were wrong.
    if (durationMs !== null) {
      durations.push(durationMs);
      totalDurationMs += durationMs;
      const perEndpoint = endpointDurations.get(key) ?? [];
      perEndpoint.push(durationMs);
      endpointDurations.set(key, perEndpoint);
      slowest.push({
        method, route, durationMs, statusCode: status,
        occurredAt: at, eventId: asText(event.eventId ?? event.id, 100),
      });
    }

    const existing = endpoints.get(key);
    const entry = existing ?? {
      key, method, route, requests: 0, errors: 0, clientErrors: 0, serverErrors: 0,
      averageMs: null, p95Ms: null, slowestMs: null, statusClasses: {},
      lastStatus: null, models: [], modelUsage: [], handlers: [], requestBytes: 0, responseBytes: 0,
      firstAt: at, lastAt: at,
    };
    if (!existing) {
      endpointsSeen += 1;
      if (endpoints.size >= ENDPOINT_LIMIT) continue;
      endpoints.set(key, entry);
    }
    entry.requests += 1;
    entry.lastStatus = status;
    entry.lastAt = at ?? entry.lastAt;
    entry.requestBytes += asNumber(metadata.requestBytes) ?? 0;
    entry.responseBytes += asNumber(metadata.responseBytes) ?? 0;
    entry.statusClasses[statusClass(status)] = (entry.statusClasses[statusClass(status)] ?? 0) + 1;
    if (status !== null && status >= 500) { entry.errors += 1; entry.serverErrors += 1; }
    else if (status !== null && status >= 400) { entry.errors += 1; entry.clientErrors += 1; }
    pushUnique(entry.handlers, asText(metadata.handler, 200), 5);
    for (const raw of Array.isArray(metadata.models) ? metadata.models : []) {
      const model = asText(asRecord(raw).model ?? raw, 120);
      pushUnique(entry.models, model, 20);
    }
    if (durationMs !== null) entry.slowestMs = Math.max(entry.slowestMs ?? 0, durationMs);
  }

  for (const [key, entry] of endpoints) {
    // Joined in the final pass, so an operation that arrived before its
    // request is still counted. A model the request declared but no operation
    // touched is kept at 0/0 — that disagreement is itself a signal.
    const usage = endpointModelUsage.get(key);
    const usageRows = usage
      ? [...usage.entries()].map(([model, row]) => ({ model, ...row }))
      : [];
    for (const declared of entry.models) {
      if (!usageRows.some((row) => row.model === declared)) {
        usageRows.push({ model: declared, reads: 0, writes: 0, records: null });
      }
    }
    entry.modelUsage = usageRows
      .sort((left, right) => (right.reads + right.writes) - (left.reads + left.writes))
      .slice(0, MODELS_PER_ENDPOINT);
    const samples = endpointDurations.get(key) ?? [];
    entry.averageMs = samples.length
      ? rounded(samples.reduce((sum, value) => sum + value, 0) / samples.length)
      : null;
    entry.p95Ms = rounded(percentileOf(samples, 95));
    entry.slowestMs = rounded(entry.slowestMs);
  }

  const spanMs = firstRequestAt && lastRequestAt
    ? new Date(lastRequestAt).getTime() - new Date(firstRequestAt).getTime()
    : 0;
  const errors = clientErrors + serverErrors;

  return {
    requests,
    errors,
    clientErrors,
    serverErrors,
    unhandledErrors,
    dataOperations,
    errorRate: requests ? rounded((errors / requests) * 100) : null,
    totalDurationMs: rounded(totalDurationMs) ?? 0,
    averageMs: durations.length ? rounded(totalDurationMs / durations.length) : null,
    p50Ms: rounded(percentileOf(durations, 50)),
    p95Ms: rounded(percentileOf(durations, 95)),
    p99Ms: rounded(percentileOf(durations, 99)),
    slowestMs: rounded(durations.length ? Math.max(...durations) : null),
    requestBytes,
    responseBytes,
    firstRequestAt,
    lastRequestAt,
    // Under a second of traffic is not a rate worth publishing; it would read
    // as thousands of requests per minute off two calls a moment apart.
    requestsPerMinute: spanMs >= 1_000 && requests > 1
      ? rounded((requests / spanMs) * 60_000)
      : null,
    payloadsCaptured,
    endpointsSeen,
    modelsSeen,
    endpoints: [...endpoints.values()].sort((left, right) => right.requests - left.requests),
    models: [...models.values()].sort((left, right) =>
      (right.reads + right.writes) - (left.reads + left.writes)),
    serverErrorGroups: [...errorGroups.values()].sort((left, right) => right.occurrences - left.occurrences),
    slowestRequests: slowest
      .sort((left, right) => right.durationMs - left.durationMs)
      .slice(0, SLOWEST_LIMIT),
    limitations: [
      ...(requests && !payloadsCaptured
        ? ['No request or response payloads were retained for this run. Payload capture is disabled before a declared Flow starts, in production observation, and when the SDK is configured without it.']
        : []),
      ...(requests && !models.size
        ? ['No data-access evidence was reported, so the models each request touched are unknown. Wire the SDK\'s ORM hooks to record them.']
        : []),
      ...(endpointsSeen > endpoints.size
        ? [`The endpoint table lists ${endpoints.size} of ${endpointsSeen} routes. Every total above it — requests, failures, response times and the slowest requests — counts all of them; the rest of the table stays queryable through the evidence endpoints.`]
        : []),
      ...(modelsSeen > models.size
        ? [`The model table lists ${models.size} of ${modelsSeen} models. The data-operation total above it counts all of them.`]
        : []),
      ...(!requests && tracksBackend
        ? ['This run selected the backend capture track but no request reached it. Check that the SDK is initialized in the process under test and pointed at the run.']
        : []),
    ],
  };
}
