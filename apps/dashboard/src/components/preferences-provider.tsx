'use client';

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { authenticatedFetch } from '@/lib/authenticated-fetch';
import {
  applyDisplayPreferences,
  DEFAULT_PREFERENCES,
  normalizePreferences,
  readCachedPreferences,
  writeCachedPreferences,
  type Preferences,
} from '@/lib/preferences';

export interface PreferencesContextType {
  preferences: Preferences;
  /** False until the account's own preferences have been read from the API. */
  isLoaded: boolean;
  /**
   * Adopts a preferences payload locally: caches it, applies the display
   * attributes and re-renders consumers. The preferences screen calls this
   * after a successful save; nothing here writes to the server.
   */
  applyPreferences: (preferences: Preferences) => void;
}

const PreferencesContext = createContext<PreferencesContextType | null>(null);

export function usePreferences(): PreferencesContextType {
  const context = useContext(PreferencesContext);
  if (!context) {
    throw new Error('usePreferences must be used within a PreferencesProvider');
  }
  return context;
}

/**
 * `userId` is passed in rather than read from the session context: importing
 * `providers.tsx` here would make the two modules circular, since that is where
 * this provider is mounted.
 */
export function PreferencesProvider({
  userId,
  children,
}: {
  userId: string | null;
  children: React.ReactNode;
}) {
  // Seeded from the cache the pre-paint script already read, so page size and
  // density are correct on the first render rather than after a round trip.
  const [preferences, setPreferences] = useState<Preferences>(
    () => readCachedPreferences() ?? DEFAULT_PREFERENCES,
  );
  const [isLoaded, setIsLoaded] = useState(false);
  const syncedUserId = useRef<string | null>(null);

  useEffect(() => {
    applyDisplayPreferences(preferences);
  }, [preferences]);

  const applyPreferences = useCallback((next: Preferences) => {
    writeCachedPreferences(next);
    setPreferences(next);
  }, []);

  // The account is the source of truth; the cache only avoids a flash.
  // Gated on a session because `authenticatedFetch` redirects to login on 401.
  useEffect(() => {
    if (!userId || syncedUserId.current === userId) return;
    syncedUserId.current = userId;

    let cancelled = false;
    authenticatedFetch('/api-gateway/auth/preferences')
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        applyPreferences(normalizePreferences(data));
        setIsLoaded(true);
      })
      .catch(() => {
        // Offline or transient: the cached preferences stand.
      });

    return () => {
      cancelled = true;
    };
  }, [userId, applyPreferences]);

  return (
    <PreferencesContext.Provider value={{ preferences, isLoaded, applyPreferences }}>
      {children}
    </PreferencesContext.Provider>
  );
}
