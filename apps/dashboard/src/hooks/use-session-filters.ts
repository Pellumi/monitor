'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePreferences } from '@/components/preferences-provider';

const STORAGE_KEY = 'tellann_filter:sessions';

/**
 * The session list's filter set, as one persisted object.
 *
 * `usePersistedFilter` holds a single string, which is right for a lone dropdown and
 * wrong here: this screen has a dozen filters, several of them multi-valued, and they
 * have to survive a reload together — a reader who narrowed to "mobile, 5xx, abandoned"
 * and then opened a replay should come back to the same list.
 *
 * It honours the same "Persist filters" preference, and behaves exactly like `useState`
 * when that is off.
 */

export interface SessionFilters {
  /** An end-user id or a pasted external id. */
  endUser: string;
  anonymousId: string;
  /** Free text over error messages, states, workflows, routes and context. */
  q: string;
  errorContains: string;
  /** '' | 'with' | 'without' */
  errors: string;
  /** '' | 'abandoned' | 'completed' */
  outcome: string;
  statusClass: string;
  deviceType: string[];
  browserName: string[];
  releaseVersion: string[];
  eventType: string[];
  stateName: string[];
  workflowName: string[];
  minDurationMs: string;
  maxDurationMs: string;
  from: string;
  to: string;
}

export const EMPTY_SESSION_FILTERS: SessionFilters = {
  endUser: '',
  anonymousId: '',
  q: '',
  errorContains: '',
  errors: '',
  outcome: '',
  statusClass: '',
  deviceType: [],
  browserName: [],
  releaseVersion: [],
  eventType: [],
  stateName: [],
  workflowName: [],
  minDurationMs: '',
  maxDurationMs: '',
  from: '',
  to: '',
};

/** Merges stored values onto the defaults, so a new filter does not break an old blob. */
function normalize(raw: unknown): SessionFilters {
  if (!raw || typeof raw !== 'object') return EMPTY_SESSION_FILTERS;
  const source = raw as Record<string, unknown>;
  const next = { ...EMPTY_SESSION_FILTERS };

  for (const key of Object.keys(EMPTY_SESSION_FILTERS) as Array<keyof SessionFilters>) {
    const value = source[key];
    const fallback = EMPTY_SESSION_FILTERS[key];
    if (Array.isArray(fallback)) {
      if (Array.isArray(value)) {
        (next[key] as string[]) = value.filter((item): item is string => typeof item === 'string');
      }
    } else if (typeof value === 'string') {
      (next[key] as string) = value;
    }
  }
  return next;
}

function readStored(): SessionFilters {
  if (typeof window === 'undefined') return EMPTY_SESSION_FILTERS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? normalize(JSON.parse(raw)) : EMPTY_SESSION_FILTERS;
  } catch {
    return EMPTY_SESSION_FILTERS;
  }
}

export interface UseSessionFilters {
  filters: SessionFilters;
  /** Replaces one filter. Multi-value keys take an array. */
  setFilter: <K extends keyof SessionFilters>(key: K, value: SessionFilters[K]) => void;
  /** Adds or removes one value from a multi-value filter. */
  toggleValue: (key: 'deviceType' | 'browserName' | 'releaseVersion' | 'eventType' | 'stateName' | 'workflowName', value: string) => void;
  clear: () => void;
  /** How many filters are set, for the "N active" badge and the Clear affordance. */
  activeCount: number;
  /** The query string these filters produce, without the leading `?`. */
  toQuery: () => URLSearchParams;
}

export function useSessionFilters(initial?: Partial<SessionFilters>): UseSessionFilters {
  const { preferences } = usePreferences();
  const persist = preferences.persistFilters;

  // Preferences are seeded from the pre-paint cache, so the stored value can be restored
  // during the first render rather than in an effect that would flash the default first.
  // An explicit `initial` -- a deep link from the graph or a findings card -- always wins
  // over what was stored, because the reader asked for it just now.
  const [filters, setFilters] = useState<SessionFilters>(() => ({
    ...(persist ? readStored() : EMPTY_SESSION_FILTERS),
    ...initial,
  }));

  useEffect(() => {
    if (persist) return;
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Nothing to clean up if storage is unavailable.
    }
  }, [persist]);

  const write = useCallback((next: SessionFilters) => {
    setFilters(next);
    if (!persist) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Persisting is a convenience; the filter still applies this session.
    }
  }, [persist]);

  const setFilter = useCallback(<K extends keyof SessionFilters>(key: K, value: SessionFilters[K]) => {
    setFilters((current) => {
      const next = { ...current, [key]: value };
      if (persist) {
        try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      }
      return next;
    });
  }, [persist]);

  const toggleValue = useCallback((key: Parameters<UseSessionFilters['toggleValue']>[0], value: string) => {
    setFilters((current) => {
      const list = current[key];
      const next = {
        ...current,
        [key]: list.includes(value) ? list.filter((item) => item !== value) : [...list, value],
      };
      if (persist) {
        try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      }
      return next;
    });
  }, [persist]);

  const clear = useCallback(() => write(EMPTY_SESSION_FILTERS), [write]);

  const activeCount = useMemo(() => (
    (Object.keys(EMPTY_SESSION_FILTERS) as Array<keyof SessionFilters>).filter((key) => {
      const value = filters[key];
      return Array.isArray(value) ? value.length > 0 : value !== '';
    }).length
  ), [filters]);

  const toQuery = useCallback(() => {
    const params = new URLSearchParams();
    const add = (key: string, value: string) => { if (value) params.set(key, value); };

    add('endUser', filters.endUser.trim());
    add('anonymousId', filters.anonymousId.trim());
    add('q', filters.q.trim());
    add('errorContains', filters.errorContains.trim());
    add('statusClass', filters.statusClass);
    add('minDurationMs', filters.minDurationMs);
    add('maxDurationMs', filters.maxDurationMs);
    add('from', filters.from);
    add('to', filters.to);

    // Tri-state selects map onto a boolean the API distinguishes from absent: "without
    // errors" is a real filter, not the same as not filtering.
    if (filters.errors === 'with') params.set('hasError', 'true');
    if (filters.errors === 'without') params.set('hasError', 'false');
    if (filters.outcome === 'abandoned') params.set('abandoned', 'true');
    if (filters.outcome === 'completed') params.set('abandoned', 'false');

    for (const key of ['deviceType', 'browserName', 'releaseVersion', 'eventType', 'stateName', 'workflowName'] as const) {
      const list = filters[key];
      if (list.length > 0) params.set(key, list.join(','));
    }

    return params;
  }, [filters]);

  return { filters, setFilter, toggleValue, clear, activeCount, toQuery };
}
