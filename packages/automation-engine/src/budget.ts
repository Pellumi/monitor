import type { AutomationLimits, AutomationStopReason } from '@tellann/desktop-contracts';
import { isRetrySafe } from './policy';
import type { ActionClass } from './types';

/**
 * Hard boundaries on a run that replans as it goes.
 *
 * A planner that can change its mind needs something that can end the run
 * regardless of what the planner thinks. These are not heuristics for the
 * planner to weigh; when one trips the run stops with a stop reason.
 */
export class RunBudget {
  private steps = 0;
  private replans = 0;
  private readonly startedAt: number;

  constructor(
    private readonly limits: AutomationLimits,
    private readonly now: () => number = Date.now,
  ) {
    this.startedAt = now();
  }

  recordStep(): void {
    this.steps += 1;
  }

  recordReplan(): void {
    this.replans += 1;
  }

  get stepCount(): number {
    return this.steps;
  }

  get replanCount(): number {
    return this.replans;
  }

  elapsedMs(): number {
    return this.now() - this.startedAt;
  }

  /** The stop reason if any budget is exhausted, checked before starting the next action. */
  exceeded(): AutomationStopReason | null {
    if (this.elapsedMs() >= this.limits.maxDurationMs) return 'MAX_DURATION_EXCEEDED';
    if (this.steps >= this.limits.maxSteps) return 'MAX_STEPS_EXCEEDED';
    // Replans have no dedicated stop reason: a plan that keeps failing is a run that is not making progress.
    if (this.replans > this.limits.maxReplans) return 'LOOP_DETECTED';
    return null;
  }

  /** Whether the same action may be attempted again after `attempts` tries. Mutations never are. */
  canRetry(actionClass: ActionClass, attempts: number): boolean {
    return isRetrySafe(actionClass) && attempts <= this.limits.maxActionRetries;
  }
}

/**
 * Detects a run that is going round in circles.
 *
 * Visiting a state again is normal: a form re-renders with a validation error,
 * a list reloads. Visiting the same state again *without having got any closer to
 * the goal since the last time we were there* is the signature of a loop, and it
 * has to be measured against the previous visit, not the first: A -> B -> A -> B
 * makes "progress" once (reaching B) and then repeats forever.
 *
 * `progress` is the caller's measure of how far along the run is (higher is
 * closer). A fingerprint whose last `threshold - 1` revisits each made no
 * progress ends the run.
 */
export class LoopDetector {
  private bestProgress = -Infinity;
  private readonly visits = new Map<string, { progressAtLastVisit: number; stale: number }>();

  constructor(private readonly threshold = 3) {}

  /** Record where the run is now. Returns true when the run is looping. */
  observe(fingerprint: string, progress: number): boolean {
    if (progress > this.bestProgress) this.bestProgress = progress;
    const seen = this.visits.get(fingerprint);
    if (!seen) {
      this.visits.set(fingerprint, { progressAtLastVisit: this.bestProgress, stale: 0 });
      return false;
    }
    seen.stale = this.bestProgress > seen.progressAtLastVisit ? 0 : seen.stale + 1;
    seen.progressAtLastVisit = this.bestProgress;
    return seen.stale >= this.threshold - 1;
  }
}

/**
 * A short, stable identity for "what the browser is showing": the route and which
 * state (if any) was recognised. Not a DOM hash — a page that re-renders the same
 * thing must produce the same fingerprint.
 */
export function stateFingerprint(path: string, recognizedStateKey: string | null): string {
  return `${path}::${recognizedStateKey ?? 'unrecognised'}`;
}
