/**
 * The findings list on the report page.
 *
 * Each finding is its title and priority. When the report drafted a resolution
 * for it, the row opens to show it: what most likely went wrong, what to check,
 * and the places in the code the analysis tied to that endpoint. The complete
 * evidence and rationale stay in the downloadable report.
 */
import { useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react";

type Row = Record<string, unknown>;

const record = (value: unknown): Row =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Row) : {};

const ITEMS_PER_PAGE = 10;

function lines(ref: Row): string {
  const start = Number(ref.startLine);
  const end = Number(ref.endLine);
  if (!Number.isFinite(start) || start <= 0) return "";
  return Number.isFinite(end) && end > start ? `:${start}–${end}` : `:${start}`;
}

function Resolution({ value }: { value: Row }) {
  const steps = Array.isArray(value.steps) ? value.steps.map(String) : [];
  const refs = Array.isArray(value.codeRefs) ? value.codeRefs.map(record) : [];
  const basis = record(value.basis);
  const requests = Number(basis.requests ?? 0);
  const confidence = Number(value.confidence);
  return (
    <div className="finding-resolution">
      <div className="finding-resolution-heading">
        <Sparkles size={14} aria-hidden="true" />
        <strong>Suggested resolution</strong>
        {Number.isFinite(confidence) ? (
          <span>{confidence >= 0.7 ? "Well supported" : confidence >= 0.45 ? "Partly supported" : "Tentative"}</span>
        ) : null}
      </div>
      <p>{String(value.summary ?? "")}</p>
      {value.likelyCause ? (
        <p className="finding-resolution-cause">
          <small>Most likely cause</small>
          {String(value.likelyCause)}
        </p>
      ) : null}
      {steps.length ? (
        <>
          <small>What to check</small>
          <ol>
            {steps.map((step, index) => <li key={index}>{step}</li>)}
          </ol>
        </>
      ) : null}
      {refs.length ? (
        <>
          <small>Where to look</small>
          <ul className="finding-resolution-refs">
            {refs.map((ref, index) => (
              <li key={String(ref.id ?? index)}>
                <code>{String(ref.path ?? "")}{lines(ref)}</code>
                <span>{String(ref.name ?? "")}</span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      <p className="finding-resolution-basis">
        Drafted by AI from {requests ? `${requests} captured request${requests === 1 ? "" : "s"}` : "this finding"}
        {basis.dataOperations ? ", the models it touched" : ""}
        {basis.code ? " and the code that handles the endpoint" : ""}. Check it against your code before acting on it.
      </p>
    </div>
  );
}

function Heading({ item, children }: { item: Row; children?: ReactNode }) {
  return (
    <>
      {children}
      <span>{String(item.title ?? item.suggestedAction ?? "Finding")}</span>
    </>
  );
}

export function ReportFindingTitles({
  items,
  label,
  status,
}: {
  items: Row[];
  label: string;
  /** Renders a finding's priority pill; passed in so this file does not own page-level components. */
  status: (priority: string) => ReactNode;
}) {
  const [page, setPage] = useState(0);
  if (!items.length) return null;

  const totalPages = Math.ceil(items.length / ITEMS_PER_PAGE);
  // The list can shrink under the reader; keep the page inside it.
  const safePage = Math.min(page, Math.max(0, totalPages - 1));
  const visible = items.slice(safePage * ITEMS_PER_PAGE, (safePage + 1) * ITEMS_PER_PAGE);

  return (
    <div className="report-title-group">
      <h3>{label}</h3>
      <ul className="report-title-list">
        {visible.map((item, index) => {
          const resolution = record(item.resolution);
          const hasResolution = Boolean(resolution.summary);
          const key = String(item.id ?? safePage * ITEMS_PER_PAGE + index);
          return hasResolution ? (
            <li key={key} className="has-resolution">
              <details>
                <summary>
                  <Heading item={item}>{status(String(item.priority ?? "MEDIUM"))}</Heading>
                  <em>Resolution</em>
                </summary>
                <Resolution value={resolution} />
              </details>
            </li>
          ) : (
            <li key={key}>
              <Heading item={item}>{status(String(item.priority ?? "MEDIUM"))}</Heading>
            </li>
          );
        })}
      </ul>
      {totalPages > 1 ? (
        <nav className="run-history-pager" aria-label={`${label} pages`}>
          <span>{safePage * ITEMS_PER_PAGE + 1}–{Math.min(items.length, (safePage + 1) * ITEMS_PER_PAGE)} of {items.length}</span>
          <div className="run-history-pager-controls">
            <button type="button" className="button" disabled={safePage === 0} onClick={() => setPage(safePage - 1)} aria-label="Previous page">
              <ChevronLeft size={14} />
            </button>
            <span>Page {safePage + 1} of {totalPages}</span>
            <button type="button" className="button" disabled={safePage >= totalPages - 1} onClick={() => setPage(safePage + 1)} aria-label="Next page">
              <ChevronRight size={14} />
            </button>
          </div>
        </nav>
      ) : null}
    </div>
  );
}
