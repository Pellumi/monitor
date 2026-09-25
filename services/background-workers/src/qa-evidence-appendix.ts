/**
 * Choosing which evidence events the report's appendix carries.
 *
 * A long run produces tens of thousands of events and the immutable payload
 * cannot hold all of them, so a budget is unavoidable. What was avoidable was
 * *which* ones it dropped: the appendix took the first N in capture order, so
 * on any run long enough to truncate, the appendix was the warm-up and
 * everything the report was actually about had been cut.
 *
 * This keeps what a reader needs to check a claim — every event a finding
 * cites, every Flow event, every error — and then spends what is left on an
 * even spread across the remaining types, so the sample still describes the
 * whole run rather than its first few minutes.
 */

export type AppendixCandidate = {
  id: string;
  eventType: string;
};

export type AppendixSelection<T> = {
  events: T[];
  /** Events the budget could not carry. They stay queryable. */
  truncated: number;
  /** Kept versus total, per event type, so a reader can see what was sampled. */
  byType: Record<string, { kept: number; total: number }>;
};

/**
 * Types kept in full whatever the budget, because a sampled one is useless:
 * there are few of them, and each marks something going wrong.
 */
const ALWAYS_KEEP = new Set([
  'QA_PAGE_CRASH',
  'QA_RUNTIME_ERROR',
  'QA_CAPTURE_DEGRADED',
  'QA_BACKEND_ERROR',
  'QA_FLOW_EVENT',
  'QA_ACCESSIBILITY_SCAN',
]);

/**
 * Picks `take` items spread evenly across `total`, by index.
 *
 * An even stride rather than a head slice, so a sample of a long run covers
 * its end as well as its beginning. With `take === 1` this lands on the
 * middle, which is more representative than either edge.
 */
export function strideIndices(total: number, take: number): number[] {
  if (take <= 0 || total <= 0) return [];
  if (take >= total) return Array.from({ length: total }, (_, index) => index);
  if (take === 1) return [Math.floor(total / 2)];
  const step = (total - 1) / (take - 1);
  const picked = new Set<number>();
  for (let n = 0; n < take; n += 1) picked.add(Math.round(n * step));
  return [...picked].sort((left, right) => left - right);
}

/**
 * Selects the appendix's events, in four passes of descending priority.
 *
 * The returned events keep their original order, so the appendix still reads
 * as a timeline rather than as the order the passes happened to run in.
 */
export function selectAppendixEvents<T extends AppendixCandidate>(
  events: T[],
  citedEventIds: ReadonlySet<string>,
  limit: number,
): AppendixSelection<T> {
  const byType: Record<string, { kept: number; total: number }> = {};
  for (const event of events) {
    const bucket = byType[event.eventType] ?? (byType[event.eventType] = { kept: 0, total: 0 });
    bucket.total += 1;
  }
  if (events.length <= limit) {
    for (const key of Object.keys(byType)) byType[key].kept = byType[key].total;
    return { events: [...events], truncated: 0, byType };
  }

  const chosen = new Set<number>();
  const keep = (index: number) => {
    if (chosen.size >= limit) return;
    chosen.add(index);
  };

  // 1. Everything a finding points at. A report that cites evidence it did not
  //    carry cannot be checked, which is the whole purpose of the appendix.
  events.forEach((event, index) => {
    if (citedEventIds.has(event.id)) keep(index);
  });

  // 2. Flow events and errors, in full.
  events.forEach((event, index) => {
    if (ALWAYS_KEEP.has(event.eventType)) keep(index);
  });

  // 3. Whatever budget is left, divided evenly across the remaining types, so
  //    a run dominated by one noisy type cannot crowd every other type out.
  const remainingByType = new Map<string, number[]>();
  events.forEach((event, index) => {
    if (chosen.has(index)) return;
    const list = remainingByType.get(event.eventType) ?? [];
    list.push(index);
    remainingByType.set(event.eventType, list);
  });

  // Smallest groups first: a type with fewer events than its share is taken
  // whole, and what it does not use is released to the types that need it.
  const groups = [...remainingByType.entries()].sort((left, right) => left[1].length - right[1].length);
  let typesLeft = groups.length;
  for (const [, indices] of groups) {
    const budget = limit - chosen.size;
    if (budget <= 0) break;
    const share = Math.max(1, Math.floor(budget / typesLeft));
    for (const offset of strideIndices(indices.length, Math.min(share, indices.length))) {
      keep(indices[offset]);
    }
    typesLeft -= 1;
  }

  // 4. Top up with anything still unselected, should rounding have left room.
  if (chosen.size < limit) {
    for (let index = 0; index < events.length && chosen.size < limit; index += 1) keep(index);
  }

  const selected = [...chosen].sort((left, right) => left - right).map((index) => events[index]);
  for (const event of selected) byType[event.eventType].kept += 1;
  return { events: selected, truncated: events.length - selected.length, byType };
}

/** How the appendix describes what it carries, once it has had to sample. */
export function appendixLimitation(kept: number, total: number): string {
  return `The evidence appendix carries a representative ${kept} of ${total} events: every event a `
    + 'finding cites, every Flow and error event, and an even sample across the remaining types so '
    + 'the selection spans the whole run rather than its beginning. The full record stays queryable '
    + 'through the evidence endpoints.';
}
