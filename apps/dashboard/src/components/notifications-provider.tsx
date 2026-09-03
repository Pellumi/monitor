'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { authenticatedFetch } from '@/lib/authenticated-fetch';
import {
  getPermissionState,
  type NotificationPermissionState,
} from '@/lib/browser-notifications';

export type NotificationSeverity = 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type NotificationFilter = 'all' | 'unread' | 'critical';
export type StreamState = 'connecting' | 'live' | 'reconnecting' | 'polling' | 'offline';

export interface InAppNotification {
  /** Opaque per-recipient row id — the handle every mutation uses. */
  id: string;
  notificationId: string;
  type: string;
  category: string;
  severity: NotificationSeverity;
  title: string;
  body: string;
  deepLink: string | null;
  applicationId: string | null;
  groupKey: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  readAt: string | null;
  dismissedAt: string | null;
  actionedAt: string | null;
}

export interface NotificationToast {
  id: string;
  title: string;
  body: string;
  severity: NotificationSeverity;
  deepLink: string | null;
}

export interface NotificationsContextType {
  notifications: InAppNotification[];
  unreadCount: number;
  filter: NotificationFilter;
  setFilter: (filter: NotificationFilter) => void;
  streamState: StreamState;
  status: 'loading' | 'ready' | 'error';
  hasMore: boolean;
  loadMore: () => void;
  loadingMore: boolean;
  markRead: (id: string) => void;
  markAllRead: () => void;
  dismiss: (id: string) => void;
  /** Records the click and returns the validated deep link, if any. */
  openAction: (id: string) => Promise<string | null>;
  refresh: () => void;
  toasts: NotificationToast[];
  dismissToast: (id: string) => void;
  permission: NotificationPermissionState;
  refreshPermission: () => void;
}

const NotificationsContext = createContext<NotificationsContextType | null>(null);

export function useNotifications(): NotificationsContextType {
  const context = useContext(NotificationsContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationsProvider');
  }
  return context;
}

const PAGE_SIZE = 20;
const RECONCILE_INTERVAL_MS = 60_000;
const POLL_FALLBACK_INTERVAL_MS = 20_000;
const TOAST_TTL_MS = 6_000;
const MAX_TOASTS = 3;
const SSE_FAILURES_BEFORE_POLLING = 3;

function gatewayBase(organizationId: string): string {
  return `/api-gateway/organizations/${organizationId}/notifications`;
}

/**
 * Remounting on `organizationId` (and identity) resets all per-scope state
 * without an effect that clears it. All query/transient state below is
 * therefore already scoped to one user in one organisation.
 */
export function NotificationsProvider({
  organizationId,
  userId,
  children,
}: {
  organizationId: string | null;
  userId: string | null;
  children: React.ReactNode;
}) {
  return (
    <NotificationsRuntime
      key={`${userId ?? 'anon'}:${organizationId ?? 'none'}`}
      organizationId={organizationId}
    >
      {children}
    </NotificationsRuntime>
  );
}

function NotificationsRuntime({
  organizationId,
  children,
}: {
  organizationId: string | null;
  children: React.ReactNode;
}) {
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filter, setFilterState] = useState<NotificationFilter>('all');
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [loadingMore, setLoadingMore] = useState(false);
  const [streamState, setStreamState] = useState<StreamState>(() =>
    typeof window !== 'undefined' && 'EventSource' in window ? 'connecting' : 'polling',
  );
  const [toasts, setToasts] = useState<NotificationToast[]>([]);
  const [permission, setPermission] = useState<NotificationPermissionState>(getPermissionState);

  const refreshPermission = useCallback(() => setPermission(getPermissionState()), []);

  // Keep the push service worker registered for returning users who already
  // granted permission; the settings screen drives first-time enrolment.
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => void 0);
  }, []);

  // Newest createdAt already turned into a toast, so a reconnect/poll backfill
  // does not replay the backlog.
  const lastToastedAt = useRef<string | null>(null);
  const seededToasts = useRef(false);

  const pushToast = useCallback((items: InAppNotification[]) => {
    const since = lastToastedAt.current;
    const fresh = items
      .filter((item) => !item.readAt && !item.dismissedAt)
      .filter((item) => (since ? item.createdAt > since : true));
    if (fresh.length === 0) return;
    setToasts((current) => {
      const merged = [
        ...fresh.slice(0, MAX_TOASTS).map((item) => ({
          id: item.id,
          title: item.title,
          body: item.body,
          severity: item.severity,
          deepLink: item.deepLink,
        })),
        ...current,
      ];
      return merged.slice(0, MAX_TOASTS);
    });
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  // Auto-expire toasts.
  useEffect(() => {
    if (toasts.length === 0) return;
    const timer = window.setTimeout(() => {
      setToasts((current) => current.slice(0, -1));
    }, TOAST_TTL_MS);
    return () => window.clearTimeout(timer);
  }, [toasts]);

  // Merge one row from the stream / a mutation response into the list.
  const upsertRow = useCallback((row: InAppNotification) => {
    setNotifications((current) => {
      const index = current.findIndex((item) => item.id === row.id);
      if (index === -1) {
        if (row.dismissedAt) return current;
        return [row, ...current].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
      }
      const next = [...current];
      next[index] = row;
      if (row.dismissedAt) next.splice(index, 1);
      return next;
    });
  }, []);

  const fetchPage = useCallback(
    async (cursor: string | null, activeFilter: NotificationFilter) => {
      if (!organizationId) return null;
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), filter: activeFilter });
      if (cursor) params.set('cursor', cursor);
      const response = await authenticatedFetch(`${gatewayBase(organizationId)}?${params}`);
      if (!response.ok) throw new Error('Failed to load notifications');
      return (await response.json()) as {
        notifications: InAppNotification[];
        unreadCount: number;
        nextCursor: string | null;
      };
    },
    [organizationId],
  );

  // Initial + filter-change load. `status` starts at 'loading'; `setFilter`
  // resets it to 'loading' from the user event, keeping this effect free of a
  // synchronous setState.
  useEffect(() => {
    if (!organizationId) return;
    let cancelled = false;
    fetchPage(null, filter)
      .then((data) => {
        if (cancelled || !data) return;
        setNotifications(data.notifications);
        setUnreadCount(data.unreadCount);
        setNextCursor(data.nextCursor);
        setStatus('ready');
        if (!seededToasts.current) {
          seededToasts.current = true;
          lastToastedAt.current = data.notifications[0]?.createdAt ?? new Date().toISOString();
        }
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [organizationId, filter, fetchPage]);

  // Reconciliation poll — recovery for anything SSE missed. Always runs; cheap.
  useEffect(() => {
    if (!organizationId) return;
    const interval = window.setInterval(
      () => {
        fetchPage(null, filter)
          .then((data) => {
            if (!data) return;
            setUnreadCount(data.unreadCount);
            data.notifications.forEach(upsertRow);
            pushToast(data.notifications);
            lastToastedAt.current = data.notifications[0]?.createdAt ?? lastToastedAt.current;
          })
          .catch(() => {
            /* transient; the next tick retries */
          });
      },
      streamState === 'polling' ? POLL_FALLBACK_INTERVAL_MS : RECONCILE_INTERVAL_MS,
    );
    return () => window.clearInterval(interval);
  }, [organizationId, filter, fetchPage, upsertRow, pushToast, streamState]);

  // SSE subscription.
  useEffect(() => {
    if (!organizationId || typeof window === 'undefined' || !('EventSource' in window)) {
      return; // streamState was initialised to 'polling' when EventSource is absent
    }
    let source: EventSource | null = null;
    let failures = 0;
    let stopped = false;

    const connect = () => {
      if (stopped) return;
      setStreamState((prev) => (prev === 'live' ? 'live' : 'connecting'));
      source = new EventSource(
        `/api-gateway/organizations/${organizationId}/notification-stream`,
        { withCredentials: true },
      );
      source.onopen = () => {
        failures = 0;
        setStreamState('live');
      };
      source.addEventListener('notification', (event) => {
        try {
          const row = JSON.parse((event as MessageEvent).data) as InAppNotification;
          upsertRow(row);
          if (!row.readAt && !row.dismissedAt) {
            setUnreadCount((count) => count + 1);
            pushToast([row]);
            lastToastedAt.current = row.createdAt;
          } else {
            // A read/dismiss that happened on another device.
            setUnreadCount((count) => Math.max(0, count));
          }
        } catch {
          /* ignore malformed frame */
        }
      });
      source.onerror = () => {
        source?.close();
        if (stopped) return;
        failures += 1;
        if (failures >= SSE_FAILURES_BEFORE_POLLING) {
          setStreamState('polling');
          return; // stop retrying; the reconciliation poll takes over
        }
        setStreamState('reconnecting');
        window.setTimeout(connect, Math.min(1000 * failures, 5000));
      };
    };

    connect();
    return () => {
      stopped = true;
      source?.close();
    };
  }, [organizationId, upsertRow, pushToast]);

  const setFilter = useCallback((next: NotificationFilter) => {
    setFilterState(next);
    setNextCursor(null);
    setStatus('loading');
  }, []);

  const loadMore = useCallback(() => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    fetchPage(nextCursor, filter)
      .then((data) => {
        if (!data) return;
        setNotifications((current) => {
          const seen = new Set(current.map((item) => item.id));
          return [...current, ...data.notifications.filter((item) => !seen.has(item.id))];
        });
        setNextCursor(data.nextCursor);
        setUnreadCount(data.unreadCount);
      })
      .finally(() => setLoadingMore(false));
  }, [nextCursor, loadingMore, fetchPage, filter]);

  const patch = useCallback(
    async (path: string, method = 'PATCH') => {
      if (!organizationId) return null;
      const response = await authenticatedFetch(`${gatewayBase(organizationId)}${path}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) throw new Error('Notification update failed');
      return response.json().catch(() => ({}));
    },
    [organizationId],
  );

  const markRead = useCallback(
    (id: string) => {
      setNotifications((current) =>
        current.map((item) =>
          item.id === id && !item.readAt ? { ...item, readAt: new Date().toISOString() } : item,
        ),
      );
      setUnreadCount((count) => Math.max(0, count - 1));
      patch(`/${id}/read`)
        .then((body) => {
          if (body && typeof body.unreadCount === 'number') setUnreadCount(body.unreadCount);
        })
        .catch(() => void 0);
    },
    [patch],
  );

  const markAllRead = useCallback(() => {
    setNotifications((current) =>
      current.map((item) => (item.readAt ? item : { ...item, readAt: new Date().toISOString() })),
    );
    setUnreadCount(0);
    patch('/read-all', 'POST').catch(() => void 0);
  }, [patch]);

  const dismiss = useCallback(
    (id: string) => {
      setNotifications((current) => current.filter((item) => item.id !== id));
      setToasts((current) => current.filter((toast) => toast.id !== id));
      patch(`/${id}/dismiss`)
        .then((body) => {
          if (body && typeof body.unreadCount === 'number') setUnreadCount(body.unreadCount);
        })
        .catch(() => void 0);
    },
    [patch],
  );

  const openAction = useCallback(
    async (id: string): Promise<string | null> => {
      setNotifications((current) =>
        current.map((item) =>
          item.id === id
            ? { ...item, readAt: item.readAt ?? new Date().toISOString(), actionedAt: new Date().toISOString() }
            : item,
        ),
      );
      setUnreadCount((count) => Math.max(0, count - 1));
      try {
        const body = await patch(`/${id}/action`, 'POST');
        return body && typeof body.deepLink === 'string' ? body.deepLink : null;
      } catch {
        return null;
      }
    },
    [patch],
  );

  const refresh = useCallback(() => {
    fetchPage(null, filter)
      .then((data) => {
        if (!data) return;
        setNotifications(data.notifications);
        setUnreadCount(data.unreadCount);
        setNextCursor(data.nextCursor);
        setStatus('ready');
      })
      .catch(() => setStatus('error'));
  }, [fetchPage, filter]);

  const value = useMemo<NotificationsContextType>(
    () => ({
      notifications,
      unreadCount,
      filter,
      setFilter,
      streamState,
      status,
      hasMore: !!nextCursor,
      loadMore,
      loadingMore,
      markRead,
      markAllRead,
      dismiss,
      openAction,
      refresh,
      toasts,
      dismissToast,
      permission,
      refreshPermission,
    }),
    [
      notifications,
      unreadCount,
      filter,
      setFilter,
      streamState,
      status,
      nextCursor,
      loadMore,
      loadingMore,
      markRead,
      markAllRead,
      dismiss,
      openAction,
      refresh,
      toasts,
      dismissToast,
      permission,
      refreshPermission,
    ],
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}
