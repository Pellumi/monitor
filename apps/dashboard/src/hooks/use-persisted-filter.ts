'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePreferences } from '@/components/preferences-provider';

const STORAGE_PREFIX = 'tellann_filter:';

function readStored(storageKey: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  try {
    return window.localStorage.getItem(storageKey) ?? fallback;
  } catch {
    return fallback;
  }
}

/**
 * `useState` for a list filter that survives navigation and reloads, honouring
 * the "Persist filters" preference.
 *
 * With the preference off it behaves exactly like `useState` and writes nothing,
 * and any value stored earlier is cleared so the filter starts clean.
 *
 * `key` must be unique per filter across the app (e.g. `audit-logs:action`).
 */
export function usePersistedFilter(
  key: string,
  defaultValue: string,
): [string, (value: string) => void] {
  const { preferences } = usePreferences();
  const persist = preferences.persistFilters;
  const storageKey = STORAGE_PREFIX + key;

  // `preferences` is seeded from the cache the pre-paint script wrote, so the
  // preference is already known on this first render and the stored value can be
  // restored without an effect (which would render the default first).
  const [value, setValue] = useState(() =>
    persist ? readStored(storageKey, defaultValue) : defaultValue,
  );

  // Turning the preference off should not leave a value behind to be picked up
  // if it is turned back on.
  useEffect(() => {
    if (persist) return;
    try {
      window.localStorage.removeItem(storageKey);
    } catch {
      // Nothing to clean up if storage is unavailable.
    }
  }, [persist, storageKey]);

  const set = useCallback(
    (next: string) => {
      setValue(next);
      if (!persist) return;
      try {
        window.localStorage.setItem(storageKey, next);
      } catch {
        // Persisting is a convenience; the filter still applies this session.
      }
    },
    [persist, storageKey],
  );

  return [value, set];
}
