/**
 * Remembers which application and environment the user was last working in.
 *
 * App and environment selection lives in the URL (`?appId=&envId=`). When a URL
 * carries neither — a fresh sign-in, or opening the dashboard from a bookmark —
 * the app would otherwise fall back to the first application and the default
 * environment. These helpers let it fall back to where the user actually left
 * off instead, which is what the "Remember last application/environment"
 * preferences promise.
 *
 * Stored per organisation (and per application for environments) so switching
 * organisations does not resurrect an application the user cannot see. Values
 * are always re-validated against the fetched list before use.
 */

const LAST_APPLICATION_KEY = 'tellann_last_application';
const LAST_ENVIRONMENT_KEY = 'tellann_last_environment';

function readMap(key: string): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function writeEntry(key: string, scopeId: string, value: string): void {
  if (typeof window === 'undefined' || !scopeId || !value) return;
  try {
    const map = readMap(key);
    map[scopeId] = value;
    window.localStorage.setItem(key, JSON.stringify(map));
  } catch {
    // Remembering is a convenience; selection still works for this session.
  }
}

function readEntry(key: string, scopeId: string | null | undefined): string | null {
  if (!scopeId) return null;
  return readMap(key)[scopeId] ?? null;
}

export function rememberLastApplication(organizationId: string | null | undefined, applicationId: string): void {
  if (organizationId) writeEntry(LAST_APPLICATION_KEY, organizationId, applicationId);
}

export function getLastApplication(organizationId: string | null | undefined): string | null {
  return readEntry(LAST_APPLICATION_KEY, organizationId);
}

export function rememberLastEnvironment(applicationId: string | null | undefined, environmentId: string): void {
  if (applicationId) writeEntry(LAST_ENVIRONMENT_KEY, applicationId, environmentId);
}

export function getLastEnvironment(applicationId: string | null | undefined): string | null {
  return readEntry(LAST_ENVIRONMENT_KEY, applicationId);
}

/**
 * Picks the id to fall back to when the URL names none: the remembered one if
 * the preference is on and it still exists, otherwise the caller's default.
 */
export function preferRemembered<T extends { id: string }>(
  items: T[] | undefined,
  rememberedId: string | null,
  enabled: boolean,
  fallback: T | undefined,
): T | undefined {
  if (!enabled || !rememberedId || !items) return fallback;
  return items.find((item) => item.id === rememberedId) ?? fallback;
}
