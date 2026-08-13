import { MeasuredValue } from "./types";

export function renderMeasuredValue<T>(
  measured: MeasuredValue<T> | undefined,
  formatter?: (val: T) => string,
  fallback: string = "Not measured yet",
): string {
  if (!measured || measured.status === "NOT_MEASURED") {
    return fallback;
  }
  if (measured.status === "INSUFFICIENT_EVIDENCE") {
    return "Not enough evidence";
  }
  if (measured.value === null || measured.value === undefined) {
    return fallback;
  }
  return formatter ? formatter(measured.value) : String(measured.value);
}

export function renderMeasuredPercentage(
  measured: MeasuredValue<number> | undefined,
  fallback: string = "Not measured yet",
): string {
  return renderMeasuredValue(
    measured,
    (val) => `${val.toFixed(1)}%`,
    fallback,
  );
}

export function renderMeasuredDelta(
  measured: MeasuredValue<number> | undefined,
): { text: string; direction: "up" | "down" | "neutral" } | null {
  if (
    !measured ||
    measured.status !== "MEASURED" ||
    measured.delta === undefined ||
    measured.delta === 0
  ) {
    return null;
  }

  const abs = Math.abs(measured.delta).toFixed(1);
  if (measured.delta > 0) {
    return { text: `↑ ${abs}%`, direction: "up" };
  } else {
    return { text: `↓ ${abs}%`, direction: "down" };
  }
}
