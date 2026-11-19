import { type ReactNode } from "react";
import { LoadingState } from "../../pages";

export interface TableColumn<T> {
  key: string;
  header: ReactNode;
  /** CSS grid track size for this column, e.g. `"1fr"`, `"150px"`, `"minmax(0,1fr)"`. */
  width?: string;
  render(row: T): ReactNode;
}

export interface TableProps<T> {
  columns: TableColumn<T>[];
  rows: T[];
  getKey(row: T): string;
  loading?: boolean;
  empty?: ReactNode;
  onRowClick?(row: T): void;
  /** Pagination footer, rendered below the rows (caller owns page state — keeps this component a pure renderer). */
  footer?: ReactNode;
  className?: string;
}

/**
 * Generic sortable-by-caller, paginated-by-caller data table. Reuses the
 * existing `.data-table` / `.table-head` / `.table-row` CSS (desktop.css)
 * that setup-history and other lists already style, but drives the column
 * widths from `columns` instead of a page-specific CSS selector, so new
 * pages don't need their own grid-template-columns rule.
 */
export function Table<T>({
  columns,
  rows,
  getKey,
  loading,
  empty,
  onRowClick,
  footer,
  className = "",
}: TableProps<T>) {
  const template = columns.map((c) => c.width ?? "minmax(0,1fr)").join(" ");

  if (loading) return <LoadingState />;
  if (!rows.length) return <>{empty ?? null}</>;

  return (
    <div className={`data-table ${className}`.trimEnd()}>
      <div className="table-head" style={{ display: "grid", gridTemplateColumns: template }}>
        {columns.map((col) => (
          <span key={col.key}>{col.header}</span>
        ))}
      </div>
      {rows.map((row) => {
        const key = getKey(row);
        return (
          <div
            className="table-row"
            key={key}
            style={{ display: "grid", gridTemplateColumns: template, cursor: onRowClick ? "pointer" : undefined }}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
          >
            {columns.map((col) => (
              <span key={col.key}>{col.render(row)}</span>
            ))}
          </div>
        );
      })}
      {footer}
    </div>
  );
}

/** A plain prev/next pager for server-paginated tables (page/limit style endpoints). */
export function TablePager({
  page,
  pageCount,
  onPageChange,
  busy,
}: {
  page: number;
  pageCount: number;
  onPageChange(page: number): void;
  busy?: boolean;
}) {
  if (pageCount <= 1) return null;
  return (
    <div className="run-history-pager">
      <button type="button" className="button" disabled={busy || page <= 1} onClick={() => onPageChange(page - 1)}>
        Previous
      </button>
      <span className="muted">
        Page {page} of {pageCount}
      </span>
      <button
        type="button"
        className="button"
        disabled={busy || page >= pageCount}
        onClick={() => onPageChange(page + 1)}
      >
        Next
      </button>
    </div>
  );
}
