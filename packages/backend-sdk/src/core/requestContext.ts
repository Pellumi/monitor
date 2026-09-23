import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * One persistence operation observed while a request was in flight.
 */
export interface TellannDataAccess {
  model: string;
  operation: string;
  records?: number | null;
  durationMs?: number | null;
  mutation?: boolean;
}

export interface TellannRequestContext {
  sessionId?: string;
  runId?: string;
  traceId?: string;
  method?: string;
  route?: string;
  /** Filled in as the request runs, then attached to its API_REQUEST event. */
  dataAccess: TellannDataAccess[];
}

/**
 * Ties a persistence operation to the request that caused it.
 *
 * `AsyncLocalStorage` is what makes "which models did this endpoint touch"
 * answerable without the application passing a context object down through
 * every layer: the integration opens a store per request, and an ORM hook
 * anywhere below it lands in the same store no matter how many awaits deep it
 * is. Work that escapes the request - a queued job, a detached promise - lands
 * in no store at all and is reported without a route, which is correct: it did
 * not belong to that request.
 */
const storage = new AsyncLocalStorage<TellannRequestContext>();

export function runInRequestContext<T>(context: TellannRequestContext, callback: () => T): T {
  return storage.run(context, callback);
}

export function currentRequestContext(): TellannRequestContext | undefined {
  return storage.getStore();
}

/**
 * Enters a context without a callback to wrap.
 *
 * Koa and Express middleware wrap what comes after them, so they can use
 * `runInRequestContext`. Fastify and hapi hooks do not: they run, return, and
 * the framework carries on by itself. `enterWith` binds the context to the
 * current asynchronous execution instead, which is how those hooks reach the
 * handlers the framework runs after them.
 */
export function enterRequestContext(context: TellannRequestContext): TellannRequestContext {
  storage.enterWith(context);
  return context;
}

/** Records one operation against the in-flight request, if there is one. */
export function recordDataAccess(access: TellannDataAccess): TellannRequestContext | undefined {
  const context = storage.getStore();
  if (!context) return undefined;
  // A request in a loop can touch one model thousands of times; the run needs
  // the shape of what happened, not an unbounded list.
  if (context.dataAccess.length < 200) context.dataAccess.push(access);
  return context;
}

/**
 * The models a request touched, collapsed to one entry per model and
 * operation, with the record counts summed and the operations counted.
 *
 * Collapsing matters: a request that reads one model in a loop produces
 * thousands of entries, and reporting each one would flood the run with rows
 * that all say the same thing. The count keeps the volume visible without the
 * noise.
 */
export function summarizeDataAccess(
  entries: TellannDataAccess[],
): Array<{ model: string; operation: string; records: number | null; count: number; mutation: boolean }> {
  const totals = new Map<string, { model: string; operation: string; records: number | null; count: number; mutation: boolean }>();
  for (const entry of entries) {
    const key = `${entry.model}:${entry.operation}`;
    const existing = totals.get(key);
    if (!existing) {
      totals.set(key, {
        model: entry.model,
        operation: entry.operation,
        records: entry.records ?? null,
        count: 1,
        mutation: Boolean(entry.mutation),
      });
      continue;
    }
    existing.count += 1;
    if (entry.records != null) existing.records = (existing.records ?? 0) + entry.records;
  }
  return [...totals.values()].slice(0, 50);
}
