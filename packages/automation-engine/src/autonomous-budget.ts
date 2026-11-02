import type { AutomationLimits } from '@tellann/desktop-contracts';
import { LoopDetector, RunBudget } from './budget';
import type { ActionClass } from './types';

/**
 * `RunBudget`/`LoopDetector` plus the one thing an autonomous run spends that a deterministic
 * one never does: model calls. Wraps rather than duplicates — `maxActions` and `maxDurationMs`
 * map straight onto `RunBudget`'s `maxSteps`/`maxDurationMs`; only the model-call ceiling is new.
 */

export interface AutonomousLimits {
  maxActions: number;
  maxModelCalls: number;
  maxDurationMs: number;
  maxReplans?: number;
  maxActionRetries?: number;
}

export type AutonomousBudgetExceededReason =
  | 'MAX_DURATION_EXCEEDED'
  | 'MAX_ACTIONS_EXCEEDED'
  | 'MAX_MODEL_CALLS_EXCEEDED'
  | 'LOOP_DETECTED';

export class AutonomousBudget {
  private readonly runBudget: RunBudget;
  private readonly loop = new LoopDetector();
  private modelCalls = 0;

  constructor(private readonly limits: AutonomousLimits, now: () => number = Date.now) {
    const asAutomationLimits: AutomationLimits = {
      maxSteps: limits.maxActions,
      maxDurationMs: limits.maxDurationMs,
      maxReplans: limits.maxReplans ?? 10,
      maxActionRetries: limits.maxActionRetries ?? 2,
    };
    this.runBudget = new RunBudget(asAutomationLimits, now);
  }

  recordStep(): void {
    this.runBudget.recordStep();
  }

  recordReplan(): void {
    this.runBudget.recordReplan();
  }

  recordModelCall(): void {
    this.modelCalls += 1;
  }

  get modelCallCount(): number {
    return this.modelCalls;
  }

  get stepCount(): number {
    return this.runBudget.stepCount;
  }

  get replanCount(): number {
    return this.runBudget.replanCount;
  }

  elapsedMs(): number {
    return this.runBudget.elapsedMs();
  }

  canRetry(actionClass: ActionClass, attempts: number): boolean {
    return this.runBudget.canRetry(actionClass, attempts);
  }

  /** Record where the run is now; true means it is going in circles. See `LoopDetector.observe`. */
  observeProgress(fingerprint: string, progress: number): boolean {
    return this.loop.observe(fingerprint, progress);
  }

  exceeded(): AutonomousBudgetExceededReason | null {
    const base = this.runBudget.exceeded();
    if (base === 'MAX_DURATION_EXCEEDED') return 'MAX_DURATION_EXCEEDED';
    if (base === 'MAX_STEPS_EXCEEDED') return 'MAX_ACTIONS_EXCEEDED';
    if (base === 'LOOP_DETECTED') return 'LOOP_DETECTED';
    if (this.modelCalls >= this.limits.maxModelCalls) return 'MAX_MODEL_CALLS_EXCEEDED';
    return null;
  }
}
