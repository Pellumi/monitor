/**
 * Theme resolution shared by the pre-hydration inline script, the ThemeProvider,
 * and the preferences screen.
 *
 * `SYSTEM | LIGHT | DARK` is the vocabulary the `UserPreference.theme` column and
 * the `/auth/preferences` API already use, so it is kept verbatim on the client
 * rather than translated at the edges.
 */

export type ThemePreference = 'SYSTEM' | 'LIGHT' | 'DARK';

/** The theme actually painted, once `SYSTEM` has been resolved against the OS. */
export type ResolvedTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'tellann_theme';

export const DEFAULT_THEME_PREFERENCE: ThemePreference = 'SYSTEM';

/**
 * Tellann has always painted dark, so an unreadable OS preference resolves dark
 * instead of flipping the whole app to light on a browser without `matchMedia`.
 */
const FALLBACK_RESOLVED_THEME: ResolvedTheme = 'dark';

const LIGHT_MEDIA_QUERY = '(prefers-color-scheme: light)';

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'SYSTEM' || value === 'LIGHT' || value === 'DARK';
}

export function normalizeThemePreference(value: unknown): ThemePreference {
  return isThemePreference(value) ? value : DEFAULT_THEME_PREFERENCE;
}

export function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return FALLBACK_RESOLVED_THEME;
  }
  return window.matchMedia(LIGHT_MEDIA_QUERY).matches ? 'light' : 'dark';
}

/**
 * The single resolution rule, kept pure so callers can feed it a reactive
 * system theme (the provider) or the current one (`resolveTheme`).
 */
export function resolveThemeWith(
  preference: ThemePreference,
  systemTheme: ResolvedTheme,
): ResolvedTheme {
  if (preference === 'LIGHT') return 'light';
  if (preference === 'DARK') return 'dark';
  return systemTheme;
}

export function resolveTheme(preference: ThemePreference): ResolvedTheme {
  return resolveThemeWith(preference, getSystemTheme());
}

/**
 * `useSyncExternalStore` subscribe half: notifies React when the OS theme flips.
 * A no-op on browsers without `matchMedia`.
 */
export function subscribeSystemTheme(onStoreChange: () => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return () => {};
  }
  const query = window.matchMedia(LIGHT_MEDIA_QUERY);
  query.addEventListener('change', onStoreChange);
  return () => query.removeEventListener('change', onStoreChange);
}

/**
 * `useSyncExternalStore` server snapshot. The server cannot know the OS theme,
 * so it reports the historical default; the inline script corrects the DOM
 * before paint and nothing is rendered from this value.
 */
export function getServerSystemTheme(): ResolvedTheme {
  return FALLBACK_RESOLVED_THEME;
}

/**
 * Writes the theme onto `<html>`. `globals.css` keys the light palette off the
 * `light` class; `data-theme-preference` is exposed so styles (and tests) can
 * tell "explicitly light" from "light because the OS says so".
 */
export function applyThemeToDocument(preference: ThemePreference, resolved: ResolvedTheme): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.classList.remove('light', 'dark');
  root.classList.add(resolved);
  root.dataset.theme = resolved;
  root.dataset.themePreference = preference;
  // Keeps native form controls, scrollbars and `<input>` UI in step with the app.
  root.style.colorScheme = resolved;
}

export function readStoredThemePreference(): ThemePreference {
  if (typeof window === 'undefined') return DEFAULT_THEME_PREFERENCE;
  try {
    return normalizeThemePreference(window.localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    // Private-mode Safari and blocked-storage contexts throw on access.
    return DEFAULT_THEME_PREFERENCE;
  }
}

export function writeStoredThemePreference(preference: ThemePreference): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // Persistence is a convenience; the in-memory theme still applies.
  }
}

/**
 * Runs synchronously in `<head>` during HTML parsing, so the stored theme is on
 * `<html>` before the first paint. Anything React does happens later, which is
 * why this cannot be a `useEffect`.
 *
 * Deliberately duplicates the logic above in ES5: it must not depend on the
 * bundle having loaded.
 */
export const THEME_INIT_SCRIPT = `(function(){try{
var p=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
if(p!=="LIGHT"&&p!=="DARK"&&p!=="SYSTEM")p=${JSON.stringify(DEFAULT_THEME_PREFERENCE)};
var r=p==="SYSTEM"?(window.matchMedia&&window.matchMedia(${JSON.stringify(LIGHT_MEDIA_QUERY)}).matches?"light":${JSON.stringify(FALLBACK_RESOLVED_THEME)}):p.toLowerCase();
var e=document.documentElement;
e.classList.remove("light","dark");e.classList.add(r);
e.setAttribute("data-theme",r);e.setAttribute("data-theme-preference",p);
e.style.colorScheme=r;
}catch(_){}})();`.replace(/\n/g, '');
