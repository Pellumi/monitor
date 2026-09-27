import type { Request, Response, NextFunction } from 'express';

/**
 * Per-application ingest limits.
 *
 * There were none. A single misconfigured SDK — a flush interval of zero, a retry loop, a
 * bot farm — could saturate the collector and, through it, every application's ingest. The
 * limit is per application rather than per IP because that is the unit whose behaviour is
 * actually at fault, and because real traffic for one application arrives from thousands of
 * IPs.
 *
 * Deliberately in-process and approximate. A shared counter in Redis would be exact and
 * would also put a network round-trip in front of every batch; what matters here is
 * shedding a runaway producer, and an in-process ceiling per instance does that. It is
 * documented as approximate rather than presented as a quota.
 */

/** Events per application per window. Generous: a real burst must not be shed. */
const EVENT_BUDGET = Number(process.env.INGEST_EVENT_BUDGET ?? 20_000);
const WINDOW_MS = Number(process.env.INGEST_WINDOW_MS ?? 60_000);
/** Retry-After sent on a shed, in seconds. */
const RETRY_AFTER_SECONDS = Math.ceil(WINDOW_MS / 1000);

interface Bucket {
  count: number;
  windowStart: number;
  /** Shed events in the current window, so the log line reports a total not a stream. */
  shed: number;
  warned: boolean;
}

const buckets = new Map<string, Bucket>();

/** Keeps the map from growing without bound for applications that stop reporting. */
const SWEEP_EVERY_MS = 10 * 60_000;
let lastSweep = Date.now();

function sweep(now: number): void {
  if (now - lastSweep < SWEEP_EVERY_MS) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    if (now - bucket.windowStart > SWEEP_EVERY_MS) buckets.delete(key);
  }
}

export interface BudgetVerdict {
  allowed: boolean;
  /** Remaining budget, for the response header a well-behaved SDK can back off on. */
  remaining: number;
  retryAfterSeconds: number;
}

export function consumeIngestBudget(applicationId: string, eventCount: number, now = Date.now()): BudgetVerdict {
  sweep(now);

  let bucket = buckets.get(applicationId);
  if (!bucket || now - bucket.windowStart >= WINDOW_MS) {
    if (bucket?.shed) {
      console.warn(
        `[EventCollector] Shed ${bucket.shed} event(s) for application ${applicationId} `
        + `in the last window (budget ${EVENT_BUDGET})`,
      );
    }
    bucket = { count: 0, windowStart: now, shed: 0, warned: false };
    buckets.set(applicationId, bucket);
  }

  if (bucket.count + eventCount > EVENT_BUDGET) {
    bucket.shed += eventCount;
    if (!bucket.warned) {
      // Announced once per window, not per batch: a runaway producer would otherwise fill
      // the log with the evidence of its own runaway-ness.
      console.warn(
        `[EventCollector] Application ${applicationId} exceeded its ingest budget `
        + `(${EVENT_BUDGET} events / ${WINDOW_MS}ms); shedding until the window resets`,
      );
      bucket.warned = true;
    }
    return { allowed: false, remaining: 0, retryAfterSeconds: RETRY_AFTER_SECONDS };
  }

  bucket.count += eventCount;
  return {
    allowed: true,
    remaining: Math.max(0, EVENT_BUDGET - bucket.count),
    retryAfterSeconds: 0,
  };
}

/**
 * Express middleware form, for routes whose event count is known from the body.
 *
 * Answers 429 with `Retry-After`, which the SDK's flush now treats as transient and
 * re-buffers — so a shed batch is delayed rather than lost. Before the flush fix it would
 * have been dropped silently, which is why backpressure could not safely have been added
 * first.
 */
export function ingestBudgetMiddleware(countEvents: (req: Request) => number) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const applicationId = req.headers['x-tellann-application-id'];
    // Without a resolved application there is nothing to attribute a budget to. The
    // gateway's key resolution is what supplies it, and an unauthenticated path has its own
    // limits upstream.
    if (typeof applicationId !== 'string' || !applicationId) {
      next();
      return;
    }

    const verdict = consumeIngestBudget(applicationId, Math.max(1, countEvents(req)));
    res.setHeader('x-tellann-ingest-remaining', String(verdict.remaining));

    if (!verdict.allowed) {
      res.setHeader('Retry-After', String(verdict.retryAfterSeconds));
      res.status(429).json({
        error: 'INGEST_RATE_LIMITED',
        message: 'This application is sending events faster than its ingest budget allows.',
        retryAfterSeconds: verdict.retryAfterSeconds,
      });
      return;
    }

    next();
  };
}

/** For tests, and for a health endpoint that wants to report shedding. */
export function ingestBudgetState(): Array<{ applicationId: string; count: number; shed: number }> {
  return [...buckets.entries()].map(([applicationId, bucket]) => ({
    applicationId,
    count: bucket.count,
    shed: bucket.shed,
  }));
}

export function resetIngestBudgets(): void {
  buckets.clear();
}

export const INGEST_EVENT_BUDGET = EVENT_BUDGET;
export const INGEST_WINDOW_MS = WINDOW_MS;
