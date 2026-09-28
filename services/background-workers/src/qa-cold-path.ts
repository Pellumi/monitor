/**
 * Run the report's independent, I/O-bound steps together.
 *
 * Once a run's evidence is in, several parts of its report need something slow and unrelated to
 * each other: an AI synthesis call, a per-finding resolution draft, an endpoint-baseline lookup,
 * a reconciliation query. They were awaited one after another, so the report took the *sum* of
 * their latencies when it only depends on the slowest. Nothing here reorders what a step produces:
 * each task owns its own failure handling (an AI outage must degrade the report, not fail it), so
 * this only decides when they start.
 *
 * A task that throws still rejects the whole set. Tasks that are allowed to fail are expected to
 * catch their own errors and return a fallback, exactly as they did when they ran in sequence.
 */
export async function runConcurrently<T extends Record<string, () => Promise<unknown>>>(
  tasks: T,
): Promise<{ [K in keyof T]: Awaited<ReturnType<T[K]>> }> {
  const entries = Object.entries(tasks);
  const results = await Promise.all(entries.map(([, task]) => task()));
  return Object.fromEntries(entries.map(([name], index) => [name, results[index]])) as { [K in keyof T]: Awaited<ReturnType<T[K]>> };
}
