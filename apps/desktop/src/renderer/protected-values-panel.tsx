/**
 * The protected values of a run that the reader can reveal.
 *
 * Only values with something to reveal are listed: an ordinary value stored
 * encrypted, on a run the reader is allowed to reveal from. Pseudonymized
 * identifiers and secrets are one-way by design, so a row for each of them
 * could only ever say it cannot be shown. A reader who may not reveal anything
 * sees no section at all.
 *
 * A run can hold thousands of these, so the list is read a page at a time and
 * searched and filtered by the API. A revealed value is held only in this
 * component's state, for as long as the reader keeps it open.
 */
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, EyeOff, SearchX, Unlock } from "lucide-react";
import type { ProtectedValuePage, ProtectedValuePart, ProtectedValueQuery } from "@tellann/desktop-contracts";
import { useDesktop, normalizeDesktopError } from "./desktop-context";
import { SelectField } from "./components/ui/select";

const PARTS: Array<{ value: "all" | ProtectedValuePart; label: string }> = [
  { value: "all", label: "All" },
  { value: "requestBody", label: "Request body" },
  { value: "responseBody", label: "Response body" },
  { value: "query", label: "Query string" },
  { value: "other", label: "Other" },
];

const METHOD_OPTIONS = ["all", "GET", "POST", "PUT", "PATCH", "DELETE"].map((value) => ({
  value,
  label: value === "all" ? "Any method" : value,
}));

const PAGE_SIZES = ["10", "25", "50"];

function formatTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.valueOf())
    ? value
    : date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function ProtectedValuesPanel({ runId }: { runId: string }) {
  const { getRunProtectedValues, revealProtectedValue } = useDesktop();
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [part, setPart] = useState<"all" | ProtectedValuePart>("all");
  const [method, setMethod] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState("10");
  const [result, setResult] = useState<ProtectedValuePage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [revealError, setRevealError] = useState<string | null>(null);
  const latest = useRef(0);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQuery(search.trim());
      setPage(1);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const request = latest.current + 1;
    latest.current = request;
    setLoading(true);
    const input: ProtectedValueQuery = {
      page,
      pageSize: Number(pageSize),
      q: query || undefined,
      part: part === "all" ? undefined : part,
      method: method === "all" ? undefined : method,
    };
    void Promise.resolve()
      .then(() => getRunProtectedValues(runId, input))
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
  }, [getRunProtectedValues, runId, page, pageSize, query, part, method]);

  const filtered = Boolean(query) || part !== "all" || method !== "all";
  // Nothing to reveal, or nothing this reader may reveal: no section at all.
  if (!result || !result.canReveal || (!result.total && !filtered)) return null;

  const reveal = async (valueId: string) => {
    if (busy) return;
    setBusy(valueId);
    setRevealError(null);
    try {
      const value = await revealProtectedValue(runId, valueId);
      setRevealed((current) => ({ ...current, [valueId]: value.value }));
    } catch (cause) {
      setRevealError(normalizeDesktopError(cause));
    } finally {
      setBusy(null);
    }
  };
  const hide = (valueId: string) =>
    setRevealed((current) => {
      const { [valueId]: _removed, ...rest } = current;
      return rest;
    });
  const clearFilters = () => {
    setSearch("");
    setQuery("");
    setPart("all");
    setMethod("all");
    setPage(1);
  };

  const size = Number(pageSize);
  const pages = Math.max(1, Math.ceil(result.total / size));
  const first = result.total ? (page - 1) * size + 1 : 0;
  const last = Math.min(result.total, page * size);

  return (
    <details className="report-details protected-values">
      <summary>Protected values{filtered ? "" : ` (${result.total})`}</summary>
      <p>
        Values stay masked, and are never written to a downloaded report. Each reveal is individual,
        rate limited, audited, and never cached.
      </p>

      <div className="protected-values-controls">
        <div className="segmented-control" role="group" aria-label="Where the value was captured">
          {PARTS.map((item) => (
            <button
              key={item.value}
              type="button"
              className={part === item.value ? "selected" : undefined}
              onClick={() => { setPart(item.value); setPage(1); }}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="protected-values-filters">
          <input
            className="toolbar-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search field, route or method"
            aria-label="Search protected values"
          />
          <SelectField
            ariaLabel="Method"
            value={method}
            onValueChange={(value) => { setMethod(value); setPage(1); }}
            options={METHOD_OPTIONS}
          />
        </div>
      </div>

      {error ? <div className="inline-error" role="alert">{error}</div> : null}
      {revealError ? <div className="inline-error" role="alert">{revealError}</div> : null}

      <div className="protected-values-list" aria-busy={loading} data-loading={loading ? "true" : undefined}>
        {result.items.length ? result.items.map((item) => (
          <div className="protected-value-row" key={item.id}>
            <div>
              <strong>{item.keyPath}</strong>
              <small>
                {[item.displayValue, item.method && item.route ? `${item.method} ${item.route}` : (item.route ?? "unknown route"), item.statusCode, formatTime(item.occurredAt)]
                  .filter((piece) => piece !== null && piece !== "")
                  .join(" · ")}
              </small>
              {revealed[item.id] !== undefined ? <code>{revealed[item.id]}</code> : null}
            </div>
            {revealed[item.id] !== undefined ? (
              <button className="button" type="button" onClick={() => hide(item.id)}>
                <EyeOff size={15} />
                Hide
              </button>
            ) : (
              <button className="button" type="button" disabled={Boolean(busy)} onClick={() => void reveal(item.id)}>
                <Unlock size={15} />
                {busy === item.id ? "Authorizing…" : "Reveal"}
              </button>
            )}
          </div>
        )) : (
          <div className="run-history-empty">
            <SearchX size={22} aria-hidden="true" />
            <strong>{loading ? "Loading…" : "Nothing matches these filters"}</strong>
            {!loading ? <button type="button" className="button" onClick={clearFilters}>Clear filters</button> : null}
          </div>
        )}
      </div>

      {result.total ? (
        <nav className="run-history-pager" aria-label="Protected value pages">
          <span>{first}–{last} of {result.total}</span>
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
    </details>
  );
}
