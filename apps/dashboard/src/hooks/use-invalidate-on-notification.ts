'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNotifications } from '@/components/notifications-provider';

/**
 * Refetches a query when a notification says its data has changed.
 *
 * Follows the SSE-to-`invalidateQueries` pattern already established in
 * `application-events-provider.tsx`, but subscribes through the notifications
 * provider rather than opening a second stream — that provider already holds
 * one, plus a reconciliation poll behind it, and both funnel through the same
 * subscription point.
 *
 * Matching is by key *prefix*. The application-events provider invalidates
 * exact `[key, organizationId]` tuples, which would never match a key like
 * `['dashboard-overview', appId, range, envId]`.
 */
export function useInvalidateOnNotification(types: readonly string[], queryKeyPrefix: readonly unknown[]) {
  const { subscribe } = useNotifications();
  const queryClient = useQueryClient();

  // Serialised so a caller can pass array literals without re-subscribing on
  // every render.
  const typeKey = types.join(',');
  const prefixKey = JSON.stringify(queryKeyPrefix);

  useEffect(() => {
    const watched = new Set(typeKey.split(','));
    const prefix = JSON.parse(prefixKey) as unknown[];

    return subscribe((notification) => {
      if (!watched.has(notification.type)) return;
      void queryClient.invalidateQueries({ queryKey: prefix });
    });
  }, [subscribe, queryClient, typeKey, prefixKey]);
}

/**
 * Notification types that mean the overview's data has moved.
 *
 * These are the strings actually produced. `DEMONSTRATION_ANALYSIS_READY`
 * appears in a JSDoc example and nowhere else — subscribing to it would be
 * listening for something no code emits.
 *
 * @see services/background-workers/src/qa-report-worker.ts — QA_REPORT_READY
 * @see services/onboarding-api/src/desktop-routes.ts — QA_TERMINAL_REACHED
 */
export const ANALYSIS_NOTIFICATION_TYPES = ['QA_REPORT_READY', 'QA_TERMINAL_REACHED'] as const;
