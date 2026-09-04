'use client';

import { useEffect, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';

/**
 * Keeps the dashboard's application lists in step with every other surface.
 *
 * The API gateway broadcasts APP_CREATED / APP_UPDATED / APP_DELETED whenever
 * onboarding-api changes an application — whoever made the change, from the web
 * dashboard or from Tellann Desktop. Without this the web only learns about a
 * desktop-created application on the next full page load.
 *
 * Telling the user is a separate concern: the `app-created` notification travels
 * the central notification pipeline and surfaces through the notification centre
 * and toaster. This component only refreshes data.
 */
const APPLICATION_QUERY_KEYS = [
  'organization-applications',
  'sidebar-apps',
  'sidebar-entitlement',
  'apps',
] as const;

type AppEventAction = 'APP_CREATED' | 'APP_UPDATED' | 'APP_DELETED';

export function ApplicationEventsProvider({
  organizationId,
  children,
}: {
  organizationId: string | null;
  children: ReactNode;
}) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!organizationId || typeof window === 'undefined' || !('EventSource' in window)) return;

    const source = new EventSource(
      `/api-gateway/v1/app-events?organizationId=${encodeURIComponent(organizationId)}`,
    );

    source.onmessage = (event) => {
      let payload: { action?: AppEventAction; organizationId?: string | null };
      try {
        payload = JSON.parse(event.data);
      } catch {
        return; // The stream also carries a CONNECTED frame and keep-alives.
      }
      if (!payload.action) return;
      // The gateway already scopes by organisation; an event that names a
      // different one is not ours to act on.
      if (payload.organizationId && payload.organizationId !== organizationId) return;

      for (const key of APPLICATION_QUERY_KEYS) {
        void queryClient.invalidateQueries({ queryKey: [key, organizationId] });
      }
    };

    // EventSource reconnects on its own; a persistent failure just means the
    // lists stay as fresh as the next navigation makes them.
    source.onerror = () => undefined;

    return () => source.close();
  }, [organizationId, queryClient]);

  return <>{children}</>;
}
