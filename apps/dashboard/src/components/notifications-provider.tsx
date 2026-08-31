'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { authenticatedFetch } from '@/lib/authenticated-fetch';
import {
  getPermissionState,
  showBrowserNotification,
  type NotificationPermissionState,
} from '@/lib/browser-notifications';

export interface InAppNotification {
  id: string;
  category: string;
  eventType: string;
  severity: string;
  title: string;
  body: string;
  createdAt: string;
}

export interface NotificationsContextType {
  notifications: InAppNotification[];
  unreadCount: number;
  permission: NotificationPermissionState;
  /** Re-reads `Notification.permission` after the settings screen requests it. */
  refreshPermission: () => void;
  markAllRead: () => void;
  refresh: () => void;
}

const NotificationsContext = createContext<NotificationsContextType | null>(null);

export function useNotifications(): NotificationsContextType {
  const context = useContext(NotificationsContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationsProvider');
  }
  return context;
}

const POLL_INTERVAL_MS = 60_000;
const LAST_READ_KEY = 'tellann_notifications_last_read';
/** Cap on how many browser popups one poll may raise, so a burst cannot spam. */
const MAX_POPUPS_PER_POLL = 3;

function readLastRead(organizationId: string): string | null {
  try {
    return window.localStorage.getItem(`${LAST_READ_KEY}:${organizationId}`);
  } catch {
    return null;
  }
}

function writeLastRead(organizationId: string, iso: string): void {
  try {
    window.localStorage.setItem(`${LAST_READ_KEY}:${organizationId}`, iso);
  } catch {
    // Read state is a convenience; the feed still renders without it.
  }
}

/**
 * Remounting on `organizationId` resets all per-organisation state without an
 * effect that clears it, which is the idiomatic way to key state to a prop.
 */
export function NotificationsProvider({
  organizationId,
  children,
}: {
  organizationId: string | null;
  children: React.ReactNode;
}) {
  return (
    <NotificationsRuntime key={organizationId ?? 'none'} organizationId={organizationId}>
      {children}
    </NotificationsRuntime>
  );
}

/**
 * Polls the in-app notification feed while the tab is open and raises a browser
 * notification for anything that arrived since the previous poll.
 *
 * Polling rather than a socket is deliberate: the feed is derived from
 * notification events written by background work, so sub-minute latency buys
 * nothing and this needs no new infrastructure. React Query already pauses
 * polling for a backgrounded tab and refetches on refocus.
 */
function NotificationsRuntime({
  organizationId,
  children,
}: {
  organizationId: string | null;
  children: React.ReactNode;
}) {
  // Read once on mount. Permission cannot change without a user gesture, and
  // the settings screen calls `refreshPermission` after requesting it.
  const [permission, setPermission] = useState<NotificationPermissionState>(getPermissionState);
  const [lastRead, setLastRead] = useState<string | null>(() =>
    organizationId ? readLastRead(organizationId) : null,
  );

  const refreshPermission = useCallback(() => setPermission(getPermissionState()), []);

  const { data, refetch } = useQuery({
    queryKey: ['in-app-notifications', organizationId],
    queryFn: async () => {
      const response = await authenticatedFetch(
        `/api-gateway/organizations/${organizationId}/notifications?limit=30`,
      );
      if (!response.ok) throw new Error('Failed to load notifications');
      const body = (await response.json()) as { notifications?: InAppNotification[] };
      return body.notifications ?? [];
    },
    enabled: !!organizationId,
    refetchInterval: POLL_INTERVAL_MS,
    // A backgrounded tab cannot usefully show anything; the refocus refetch
    // catches up.
    refetchIntervalInBackground: false,
    staleTime: POLL_INTERVAL_MS,
  });

  // Stable identity: `markAllRead` depends on this, and a fresh [] each render
  // would rebuild that callback on every render.
  const notifications = useMemo(() => data ?? [], [data]);

  // Newest item already announced. Seeded from the first successful poll so
  // opening the app does not replay the backlog as popups.
  const lastAnnouncedAt = useRef<string | null>(null);
  const hasSeeded = useRef(false);

  // Raising browser notifications is a side effect on an external system, which
  // is what effects are for — nothing here sets React state.
  useEffect(() => {
    if (!data) return;
    const newest = data[0]?.createdAt ?? null;

    if (!hasSeeded.current) {
      hasSeeded.current = true;
      lastAnnouncedAt.current = newest;
      return;
    }

    const since = lastAnnouncedAt.current;
    const fresh = since ? data.filter((item) => item.createdAt > since) : data;

    // Oldest first, so the most recent ends up on top of the notification stack.
    for (const item of fresh.slice(0, MAX_POPUPS_PER_POLL).reverse()) {
      showBrowserNotification({ id: item.id, title: item.title, body: item.body });
    }
    if (newest) lastAnnouncedAt.current = newest;
  }, [data]);

  const markAllRead = useCallback(() => {
    const newest = notifications[0]?.createdAt ?? new Date().toISOString();
    setLastRead(newest);
    if (organizationId) writeLastRead(organizationId, newest);
  }, [notifications, organizationId]);

  const unreadCount = lastRead
    ? notifications.filter((item) => item.createdAt > lastRead).length
    : notifications.length;

  return (
    <NotificationsContext.Provider
      value={{
        notifications,
        unreadCount,
        permission,
        refreshPermission,
        markAllRead,
        refresh: () => void refetch(),
      }}
    >
      {children}
    </NotificationsContext.Provider>
  );
}
