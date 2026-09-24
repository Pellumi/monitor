/**
 * The endpoint history of a finished backend run. The caller decides what an
 * entirely empty run looks like; this only renders once there is something to page through.
 *
 * A backend run has no pages or screenshots, so its evidence is the traffic
 * its server saw: which requests it handled, which answers were failures and
 * which data operations ran. That can be thousands of rows, so the list is
 * read a page at a time and searched and filtered by the API rather than
 * loaded whole.
 */
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, SearchX } from "lucide-react";
import type {
  BackendEvidenceItem,
  BackendEvidenceKind,
  BackendEvidencePage,
  BackendEvidenceQuery,
} from "@tellann/desktop-contracts";
import { useDesktop, normalizeDesktopError } from "./desktop-context";
import { SelectField } from "./components/ui/select";

export type BackendEvidenceCounts = { requests: number; failed: number; data: number };

const KINDS: Array<{ value: BackendEvidenceKind; label: string }> = [
  { value: "requests", label: "Requests" },
  { value: "failed", label: "Failed responses" },
  { value: "data", label: "Data operations" },
];

const PAGE_SIZES = ["25", "50", "100"];

const METHOD_OPTIONS = ["all", "GET", "POST", "PUT", "PATCH", "DELETE"].map((value) => ({
  value,
  label: value === "all" ? "Any method" : value,
}));

const STATUS_OPTIONS = [
  { value: "all", label: "Any status" },
  { value: "2xx", label: "2xx success" },
  { value: "3xx", label: "3xx redirect" },
  { value: "4xx", label: "4xx client error" },
  { value: "5xx", label: "5xx server error" },
];

const FAILED_STATUS_OPTIONS = [
  { value: "all", label: "Any failure" },
  { value: "4xx", label: "4xx client error" },
  { value: "5xx", label: "5xx server error" },
  { value: "unhandled", label: "Unhandled error" },
];

const ACCESS_OPTIONS = [
  { value: "all", label: "Reads and writes" },
  { value: "read", label: "Reads" },
  { value: "write", label: "Writes" },
];

const SORT_OPTIONS = {
  requests: [
    { value: "newest", label: "Newest first" },
    { value: "oldest", label: "Oldest first" },
    { value: "slowest", label: "Slowest first" },
  ],
  data: [
    { value: "newest", label: "Newest first" },
    { value: "oldest", label: "Oldest first" },
  ],
};

const EMPTY_COPY: Record<BackendEvidenceKind, { title: string; description: string }> = {
  requests: {
    title: "No requests captured",
    description: "Requests your server handled during this run appear here once they are synchronized.",
  },
  failed: {
    title: "No failed responses",
    description: "Every request this run captured was answered without an error.",
  },
  data: {
    title: "No data operations",
    description: "Database reads and writes made while handling requests appear here when the SDK reports them.",
  },
};

function formatTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.valueOf())
    ? value
    : date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function formatDuration(value: number | null): string {
  if (value == null) return "—";
  if (value < 1) return "<1 ms";
  if (value < 1_000) return `${Math.round(value)} ms`;
  return `${(value / 1_000).toFixed(value < 10_000 ? 2 : 1)} s`;
}

function formatSize(value: number | null): string {
  if (value == null) return "—";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function statusTone(status: number | null): string {
  if (status == null) return "neutral";
  if (status >= 500) return "danger";
  if (status >= 400) return "warning";
  return "success";
}

function MethodRoute({ item }: { item: BackendEvidenceItem }) {
  return (
    <>
      <span className="run-endpoint-method" data-method={(item.method ?? "get").toLowerCase()}>
        {item.method ?? "—"}
      </span>
      <code>{item.route ?? item.path ?? "unrouted"}</code>
    </>
  );
}

function RequestRows({ items }: { items: BackendEvidenceItem[] }) {
  return (
    <table>
      <thead>
        <tr>
          <th scope="col">Time</th>
          <th scope="col">Request</th>
          <th scope="col">Response</th>
          <th scope="col">Duration</th>
          <th scope="col">Handler</th>
          <th scope="col">Size</th>
          {/* <th scope="col">Models</th> */}
        </tr>
      </thead>
      <tbody>
        {items.map((item) => {
          const isError = item.kind === "ERROR";
          const failing = isError || (item.statusCode ?? 0) >= 400;
          return (
            <tr key={item.id} data-failing={failing ? "true" : undefined}>
              <td className="run-history-time">{formatTime(item.occurredAt)}</td>
              <th scope="row">
                <MethodRoute item={item} />
                {isError ? (
                  <small className="run-history-note">
                    {[item.name, item.message].filter(Boolean).join(": ") || "Unhandled server error"}
                  </small>
                ) : null}
              </th>
              <td>
                <span className="run-history-status" data-tone={isError ? "danger" : statusTone(item.statusCode)}>
                  {isError ? "Unhandled" : (item.statusCode ?? "—")}
                </span>
              </td>
              <td>{formatDuration(item.durationMs)}</td>
              <td>{item.handler ?? "—"}</td>
              <td>{formatSize(item.responseBytes)}</td>
              {/* <td>{item.models.length ? item.models.slice(0, 4).join(", ") : "—"}</td> */}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function DataRows({ items }: { items: BackendEvidenceItem[] }) {
  return (
    <table>
      <thead>
        <tr>
          <th scope="col">Time</th>
          <th scope="col">Operation</th>
          <th scope="col">Type</th>
          <th scope="col">Records</th>
          <th scope="col">Endpoint</th>
          <th scope="col">Duration</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr key={item.id}>
            <td className="run-history-time">{formatTime(item.occurredAt)}</td>
            <th scope="row">
              <code>{item.model ?? "unknown"}.{item.operation ?? "operation"}</code>
              {item.count && item.count > 1 ? <small className="run-history-note">×{item.count} collapsed into this row</small> : null}
            </th>
            <td>
              <span className="run-history-status" data-tone={item.mutation ? "warning" : "neutral"}>
                {item.mutation ? "Write" : "Read"}
              </span>
            </td>
            <td>{item.records ?? "—"}</td>
            <td>
              {item.route ? (
                <>
                  {item.method ? <span className="run-endpoint-method" data-method={item.method.toLowerCase()}>{item.method}</span> : null}
                  <code>{item.route}</code>
                </>
              ) : "—"}
            </td>
            <td>{formatDuration(item.durationMs)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function BackendEvidenceSkeleton({ kind, rows = 5 }: { kind: BackendEvidenceKind; rows?: number }) {
  const columns = kind === "data"
    ? ["Time", "Operation", "Type", "Records", "Endpoint", "Duration"]
    : ["Time", "Request", "Response", "Duration"];

  return (
    <div className="run-history-scroll run-history-skeleton" role="status" aria-label="Loading evidence">
      <table>
        <thead aria-hidden="true">
          <tr>
            {columns.map((column) => (
              <th scope="col" key={column}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }, (_, index) => (
            <tr key={index} aria-hidden="true">
              <td className="run-history-time">
                <i className="run-history-skeleton-bar" data-bar="time" />
              </td>
              <th scope="row">
                <i className="run-history-skeleton-bar" data-bar="title" />
                <i className="run-history-skeleton-bar" data-bar="subtitle" />
              </th>
              <td>
                <i className="run-history-skeleton-bar" data-bar={kind === "data" ? "type" : "status"} />
              </td>
              <td>
                <i className="run-history-skeleton-bar" data-bar="metric" />
              </td>
              {kind === "data" ? (
                <>
                  <td>
                    <i className="run-history-skeleton-bar" data-bar="endpoint" />
                  </td>
                  <td>
                    <i className="run-history-skeleton-bar" data-bar="metric" />
                  </td>
                </>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function BackendEvidenceHistory({
  runId,
  counts,
}: {
  runId: string;
  counts: BackendEvidenceCounts;
}) {
  const { getRunBackendEvidence } = useDesktop();
  const [kind, setKind] = useState<BackendEvidenceKind>("requests");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [method, setMethod] = useState("all");
  const [status, setStatus] = useState("all");
  const [access, setAccess] = useState("all");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState("25");
  const [result, setResult] = useState<BackendEvidencePage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const latest = useRef(0);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQuery(search.trim());
      setPage(1);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  // Whichever of these are set for one kind mean nothing for another.
  const changeKind = (next: BackendEvidenceKind) => {
    setKind(next);
    setStatus("all");
    setMethod("all");
    setAccess("all");
    setSort("newest");
    setPage(1);
  };
  const clearFilters = () => {
    setSearch("");
    setQuery("");
    setMethod("all");
    setStatus("all");
    setAccess("all");
    setPage(1);
  };
  const filtered = Boolean(query) || method !== "all" || status !== "all" || access !== "all";

  useEffect(() => {
    const request = latest.current + 1;
    latest.current = request;
    setLoading(true);
    const input: BackendEvidenceQuery = {
      kind,
      page,
      pageSize: Number(pageSize),
      q: query || undefined,
      method: kind !== "data" && method !== "all" ? method : undefined,
      status: kind !== "data" && status !== "all" ? (status as BackendEvidenceQuery["status"]) : undefined,
      access: kind === "data" && access !== "all" ? (access as BackendEvidenceQuery["access"]) : undefined,
      sort: sort as BackendEvidenceQuery["sort"],
    };
    void Promise.resolve()
      .then(() => getRunBackendEvidence(runId, input))
      .then((next) => {
        if (latest.current !== request) return;
        setResult(next);
        setError(null);
      })
      .catch((cause: unknown) => {
        if (latest.current === request) setError(normalizeDesktopError(cause));
      })
      .finally(() => {
        if (latest.current === request) setLoading(false);
      });
  }, [getRunBackendEvidence, runId, kind, page, pageSize, query, method, status, access, sort, counts.requests, counts.failed, counts.data]);

  const rows = result?.kind === kind ? result.items : [];
  const matches = result?.kind === kind ? result.total : counts[kind];
  const pages = Math.max(1, Math.ceil(matches / Number(pageSize)));
  const first = matches ? (page - 1) * Number(pageSize) + 1 : 0;
  const last = Math.min(matches, page * Number(pageSize));
  const showFirstLoad = loading && !rows.length;

  return (
    <section className="run-history">
      <div className="run-history-controls">
        <div className="segmented-control" role="group" aria-label="Evidence type">
          {KINDS.map((item) => (
            <button
              key={item.value}
              type="button"
              className={kind === item.value ? "selected" : undefined}
              onClick={() => changeKind(item.value)}
            >
              {item.label} <span className="run-history-count">{counts[item.value]}</span>
            </button>
          ))}
        </div>
        <div className="run-history-filters">
          <input
            className="toolbar-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={kind === "data" ? "Search model, operation or endpoint" : "Search route, handler, status or model"}
            aria-label="Search evidence"
          />
          {kind === "data" ? (
            <SelectField ariaLabel="Read or write" value={access} onValueChange={(value) => { setAccess(value); setPage(1); }} options={ACCESS_OPTIONS} />
          ) : (
            <>
              <SelectField ariaLabel="Method" value={method} onValueChange={(value) => { setMethod(value); setPage(1); }} options={METHOD_OPTIONS} />
              <SelectField
                ariaLabel="Status"
                value={status}
                onValueChange={(value) => { setStatus(value); setPage(1); }}
                options={kind === "failed" ? FAILED_STATUS_OPTIONS : STATUS_OPTIONS}
              />
            </>
          )}
          <SelectField
            ariaLabel="Sort"
            value={sort}
            onValueChange={(value) => { setSort(value); setPage(1); }}
            options={kind === "data" ? SORT_OPTIONS.data : SORT_OPTIONS.requests}
          />
        </div>
      </div>

      {error ? <div className="inline-error" role="alert">{error}</div> : null}

      <div className="run-endpoints run-history-table" aria-busy={loading}>
        {showFirstLoad ? (
          <BackendEvidenceSkeleton kind={kind} />
        ) : rows.length ? (
          <div className="run-history-scroll" data-loading={loading ? "true" : undefined}>
            {kind === "data" ? <DataRows items={rows} /> : <RequestRows items={rows} />}
          </div>
        ) : filtered ? (
          <div className="run-history-empty">
            <SearchX size={22} aria-hidden="true" />
            <strong>Nothing matches these filters</strong>
            <button type="button" className="button" onClick={clearFilters}>Clear filters</button>
          </div>
        ) : (
          <div className="run-history-empty">
            <strong>{EMPTY_COPY[kind].title}</strong>
            <span>{EMPTY_COPY[kind].description}</span>
          </div>
        )}
      </div>

      {matches ? (
        <nav className="run-history-pager" aria-label="Evidence pages">
          <span>
            {first}–{last} of {matches}
          </span>
          <div className="run-history-pager-controls">
            <label>
              Rows
              <SelectField
                ariaLabel="Rows per page"
                value={pageSize}
                onValueChange={(value) => { setPageSize(value); setPage(1); }}
                options={PAGE_SIZES.map((value) => ({ value, label: value }))}
              />
            </label>
            <button type="button" className="button" disabled={page <= 1 || loading} onClick={() => setPage(page - 1)} aria-label="Previous page">
              <ChevronLeft size={14} />
            </button>
            <span>Page {page} of {pages}</span>
            <button type="button" className="button" disabled={page >= pages || loading} onClick={() => setPage(page + 1)} aria-label="Next page">
              <ChevronRight size={14} />
            </button>
          </div>
        </nav>
      ) : null}
    </section>
  );
}
