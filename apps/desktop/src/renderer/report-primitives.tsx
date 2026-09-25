/**
 * Shared pieces of the report cards.
 *
 * Extracted from `backend-run.tsx` when the browser card arrived. The rule for
 * what belongs here is whether the two cards *must* agree: a reader comparing
 * "1.50 s" in one card against "1.5s" in the other notices, and concludes the
 * two sections measured different things. Formatting policy, coercion and the
 * highlight markup are all in that category. Anything only coincidentally
 * alike — a backend endpoint label and a browser route label are different
 * things wearing similar names — stays in its own file.
 */
import type { ReactNode } from "react";

export function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function rows(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.map(record) : [];
}

export function numberOf(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function textList(value: unknown, fallback = "—"): string {
  const items = Array.isArray(value) ? value.map((item) => String(item)).filter(Boolean) : [];
  return items.length ? items.join(", ") : fallback;
}

/** `2xx 14 · 5xx 1`, in ascending class order. */
export function statusClasses(value: unknown): string {
  const entries = Object.entries(record(value)).sort(([left], [right]) => left.localeCompare(right));
  return entries.length ? entries.map(([name, count]) => `${name} ${Number(count)}`).join(" · ") : "—";
}

export function formatMilliseconds(value: number | null | undefined): string {
  if (value == null) return "—";
  if (value < 1) return "<1 ms";
  if (value < 1_000) return `${Math.round(value)} ms`;
  return `${(value / 1_000).toFixed(value < 10_000 ? 2 : 1)} s`;
}

export function formatBytes(value: number): string {
  if (!value) return "0 B";
  if (value < 1_024) return `${value} B`;
  if (value < 1_024 * 1_024) return `${(value / 1_024).toFixed(1)} KB`;
  return `${(value / (1_024 * 1_024)).toFixed(1)} MB`;
}

export function percentage(part: number, whole: number): string {
  if (!whole) return "0%";
  const value = (part / whole) * 100;
  return `${value < 10 && value > 0 ? value.toFixed(1) : Math.round(value)}%`;
}

export const plural = (count: number, one: string, many = `${one}s`) =>
  `${count} ${count === 1 ? one : many}`;

export function largestBy<T>(items: T[], score: (item: T) => number): T | null {
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

export type Highlight = {
  label: string;
  value: string;
  detail: string;
  note?: string;
  tone?: "danger" | "warning" | "success";
};

/** The highlight strip both report cards use, so `data-tone` cannot drift. */
export function HighlightGrid({ highlights }: { highlights: Highlight[] }): ReactNode {
  if (!highlights.length) return null;
  return (
    <div className="report-highlights">
      {highlights.map((highlight) => (
        <div key={highlight.label} className="report-highlight" data-tone={highlight.tone}>
          <small>{highlight.label}</small>
          <strong>{highlight.value}</strong>
          <span title={highlight.detail}>{highlight.detail}</span>
          {highlight.note ? <em>{highlight.note}</em> : null}
        </div>
      ))}
    </div>
  );
}
