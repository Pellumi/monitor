/**
 * User preferences shared across the app.
 *
 * The shape mirrors the `UserPreference` row returned by `/auth/preferences`
 * verbatim, so nothing has to be translated at the edges.
 *
 * Theme is handled separately in `./theme` — it has its own storage key and
 * pre-paint path because it repaints the entire page.
 */

import { normalizeThemePreference, type ThemePreference } from './theme';

export type Density = 'COMFORTABLE' | 'COMPACT';

export const TABLE_PAGE_SIZES = [10, 25, 50, 100] as const;

export interface Preferences {
  theme: ThemePreference;
  density: Density;
  sidebarCollapsed: boolean;
  reducedMotion: boolean;
  highContrast: boolean;
  tablePageSize: number;
  persistFilters: boolean;
  defaultLandingPage: string;
  rememberLastApplication: boolean;
  rememberLastEnvironment: boolean;
  /**
   * @deprecated Reports are delivered as file exports (JSON/PDF/CSV), never as a
   * navigable page, so there is no link for this to retarget. The field is kept
   * so the API contract and stored row are unchanged, but no UI reads it.
   */
  reportsOpenInNewTab: boolean;
  version: number;
}

export const DEFAULT_PREFERENCES: Preferences = {
  theme: 'SYSTEM',
  density: 'COMFORTABLE',
  sidebarCollapsed: false,
  reducedMotion: false,
  highContrast: false,
  tablePageSize: 25,
  persistFilters: true,
  defaultLandingPage: '/',
  rememberLastApplication: true,
  rememberLastEnvironment: true,
  reportsOpenInNewTab: false,
  version: 1,
};

/** Full snapshot, cached so page size and density are known before the fetch resolves. */
export const PREFERENCES_STORAGE_KEY = 'tellann_preferences';

export function normalizePreferences(value: unknown): Preferences {
  const raw = (value ?? {}) as Partial<Record<keyof Preferences, unknown>>;
  const pageSize = Number(raw.tablePageSize);

  return {
    ...DEFAULT_PREFERENCES,
    theme: normalizeThemePreference(raw.theme),
    density: raw.density === 'COMPACT' ? 'COMPACT' : 'COMFORTABLE',
    sidebarCollapsed: bool(raw.sidebarCollapsed, DEFAULT_PREFERENCES.sidebarCollapsed),
    reducedMotion: bool(raw.reducedMotion, DEFAULT_PREFERENCES.reducedMotion),
    highContrast: bool(raw.highContrast, DEFAULT_PREFERENCES.highContrast),
    // The API rejects anything outside this set, so an odd stored value is
    // corrected here rather than at save time.
    tablePageSize: (TABLE_PAGE_SIZES as readonly number[]).includes(pageSize)
      ? pageSize
      : DEFAULT_PREFERENCES.tablePageSize,
    persistFilters: bool(raw.persistFilters, DEFAULT_PREFERENCES.persistFilters),
    defaultLandingPage:
      typeof raw.defaultLandingPage === 'string' && raw.defaultLandingPage
        ? raw.defaultLandingPage
        : DEFAULT_PREFERENCES.defaultLandingPage,
    rememberLastApplication: bool(raw.rememberLastApplication, DEFAULT_PREFERENCES.rememberLastApplication),
    rememberLastEnvironment: bool(raw.rememberLastEnvironment, DEFAULT_PREFERENCES.rememberLastEnvironment),
    reportsOpenInNewTab: bool(raw.reportsOpenInNewTab, DEFAULT_PREFERENCES.reportsOpenInNewTab),
    version: Number.isFinite(Number(raw.version)) ? Number(raw.version) : DEFAULT_PREFERENCES.version,
  };
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

export function readCachedPreferences(): Preferences | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(PREFERENCES_STORAGE_KEY);
    return raw ? normalizePreferences(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function writeCachedPreferences(preferences: Preferences): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(preferences));
  } catch {
    // Caching is an optimisation; the fetched value still applies this session.
  }
}

/**
 * Writes the display preferences onto `<html>`. `globals.css` keys the compact
 * spacing scale, motion suppression and high-contrast palette off these.
 */
export function applyDisplayPreferences(preferences: Preferences): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.dataset.density = preferences.density === 'COMPACT' ? 'compact' : 'comfortable';
  toggleAttribute(root, 'data-reduced-motion', preferences.reducedMotion);
  toggleAttribute(root, 'data-high-contrast', preferences.highContrast);
}

function toggleAttribute(element: HTMLElement, name: string, on: boolean): void {
  if (on) element.setAttribute(name, '');
  else element.removeAttribute(name);
}

/**
 * Applies density/motion/contrast during HTML parsing, before the first paint,
 * for the same reason the theme does. Runs alongside `THEME_INIT_SCRIPT`.
 */
export const DISPLAY_INIT_SCRIPT = `(function(){try{
var p=JSON.parse(localStorage.getItem(${JSON.stringify(PREFERENCES_STORAGE_KEY)})||"{}");
var e=document.documentElement;
e.setAttribute("data-density",p.density==="COMPACT"?"compact":"comfortable");
if(p.reducedMotion===true)e.setAttribute("data-reduced-motion","");
if(p.highContrast===true)e.setAttribute("data-high-contrast","");
}catch(_){}})();`.replace(/\n/g, '');
