/**
 * Builders for `MeasuredValue<T>` (see `contracts/dashboard-overview.ts`).
 *
 * Moved here from `services/report-engine/src/dashboard-derivation.ts` so a
 * second service (`services/background-workers`) can share the exact same
 * "zero is a measurement, absence is not" logic rather than growing its own
 * copy that quietly drifts from this one.
 */

import type { MeasuredValue, MeasurementStatus } from './contracts/dashboard-overview';

export function measured<T>(value: T | null | undefined, delta?: number): MeasuredValue<T> {
  if (value === null || value === undefined) {
    return { status: 'NOT_MEASURED', value: null };
  }
  return delta === undefined
    ? { status: 'MEASURED', value }
    : { status: 'MEASURED', value, delta };
}

export function notMeasured<T>(status: MeasurementStatus = 'NOT_MEASURED'): MeasuredValue<T> {
  return { status, value: null };
}

/**
 * A ratio as a percentage, or NOT_MEASURED when the denominator is zero.
 *
 * Zero observations out of zero expectations is not 0% coverage — it is an
 * unanswered question, and rendering it as 0% invents a failing grade.
 */
export function ratioPercent(numerator: number, denominator: number): MeasuredValue<number> {
  if (!Number.isFinite(denominator) || denominator <= 0) return notMeasured();
  const pct = (numerator / denominator) * 100;
  return measured(Math.max(0, Math.min(100, Number(pct.toFixed(1)))));
}

/** Difference between two measurements, only when both are actually measured. */
export function withDelta(
  current: MeasuredValue<number>,
  previous: number | null | undefined,
): MeasuredValue<number> {
  if (current.status !== 'MEASURED' || current.value === null) return current;
  if (previous === null || previous === undefined) return current;
  return { ...current, delta: Number((current.value - previous).toFixed(1)) };
}
