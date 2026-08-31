'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { usePreferences } from '@/components/preferences-provider';
import {
  applyThemeToDocument,
  getServerSystemTheme,
  getSystemTheme,
  readStoredThemePreference,
  resolveThemeWith,
  subscribeSystemTheme,
  writeStoredThemePreference,
  type ResolvedTheme,
  type ThemePreference,
  THEME_STORAGE_KEY,
} from '@/lib/theme';

export interface ThemeContextType {
  /** What the user chose: `SYSTEM`, `LIGHT` or `DARK`. */
  theme: ThemePreference;
  /** What is actually painted right now. */
  resolvedTheme: ResolvedTheme;
  /**
   * Applies a theme immediately. Persisting to the account is left to the
   * caller (the preferences screen saves it alongside the other fields), so a
   * preview can be shown without writing to the server.
   */
  setTheme: (preference: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Lazy initialiser reads the same localStorage value the inline script read,
  // so React's first render agrees with the DOM it is hydrating.
  const [theme, setThemeState] = useState<ThemePreference>(readStoredThemePreference);

  // The OS theme is external state, so it is subscribed to rather than mirrored
  // into a state variable.
  const systemTheme = useSyncExternalStore(
    subscribeSystemTheme,
    getSystemTheme,
    getServerSystemTheme,
  );

  const resolvedTheme = resolveThemeWith(theme, systemTheme);

  // The <html> element is the external system this provider drives. The inline
  // script has usually done this already; re-applying covers preference changes
  // and OS flips.
  useEffect(() => {
    applyThemeToDocument(theme, resolvedTheme);
  }, [theme, resolvedTheme]);

  // Keep other tabs of the same account in step.
  useEffect(() => {
    function onStorage(event: StorageEvent) {
      if (event.key !== THEME_STORAGE_KEY) return;
      setThemeState(readStoredThemePreference());
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const setTheme = useCallback((preference: ThemePreference) => {
    writeStoredThemePreference(preference);
    setThemeState(preference);
  }, []);

  useServerThemeSync(setThemeState);

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

/**
 * Adopts the account's saved theme once `PreferencesProvider` has fetched it.
 *
 * localStorage is applied first (before paint) and this only corrects it, so a
 * returning visitor sees no flash and a visitor on a new device sees at most one
 * late switch to their saved theme.
 */
function useServerThemeSync(setThemeState: (preference: ThemePreference) => void) {
  const { preferences, isLoaded } = usePreferences();
  const adopted = useRef(false);

  useEffect(() => {
    if (!isLoaded || adopted.current) return;
    adopted.current = true;
    writeStoredThemePreference(preferences.theme);
    setThemeState(preferences.theme);
  }, [isLoaded, preferences.theme, setThemeState]);
}
