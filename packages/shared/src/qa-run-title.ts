/**
 * A QA run is named for what it exercised once the operator gives it a name.
 * Unset means the UI derives one from its environment and start date — the
 * same "no stored title, derive a readable one" convention an untitled
 * instrumentation task already follows.
 */

export function derivedQaRunTitle(run: {
  environmentName?: string | null;
  startedAt: Date | string | null;
  createdAt: Date | string;
}): string {
  const date = new Date(run.startedAt ?? run.createdAt).toISOString().slice(0, 10);
  return run.environmentName ? `${run.environmentName} · ${date}` : `QA run · ${date}`;
}

export function resolveQaRunTitle(run: {
  title?: string | null;
  environmentName?: string | null;
  startedAt: Date | string | null;
  createdAt: Date | string;
}): string {
  return run.title?.trim() || derivedQaRunTitle(run);
}

/**
 * A supplied title, trimmed and bounded. `undefined` in means "leave it
 * alone" is not applicable here — the caller always intends to set it — so
 * `undefined` out instead means the value was invalid (too long); an empty
 * string is valid and means "clear it back to the derived title".
 */
export function normalizeQaRunTitle(value: unknown): string | null | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length <= 200 ? trimmed : undefined;
}
