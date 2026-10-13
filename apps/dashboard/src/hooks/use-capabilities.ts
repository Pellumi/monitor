'use client';

import { useQuery } from '@tanstack/react-query';
import { authenticatedFetch } from '@/lib/authenticated-fetch';

/**
 * Capability state for one application, as the API resolved it. The dashboard does not decide
 * visibility itself: it reads these states, so the sidebar, cards and API always agree.
 */
export type CapabilityStateName =
  | 'AVAILABLE'
  | 'LIMITED'
  | 'NEEDS_SETUP'
  | 'WAITING_FOR_EVIDENCE'
  | 'PLAN_LOCKED'
  | 'NOT_AUTHORIZED'
  | 'NOT_APPLICABLE'
  | 'UNAVAILABLE';

export interface RoutedCapability {
  key: string;
  state: CapabilityStateName;
  reason: string | null;
  locked: boolean;
}

export interface CapabilitiesResponse {
  resolverVersion: number;
  /** When false the dashboard keeps its legacy plan-only navigation (rollout kill switch). */
  uiEnabled: boolean;
  enforceEnabled: boolean;
  /** Every capability by key, including ones with no route. Cards gate on these. */
  capabilities: Record<string, { state: CapabilityStateName; reason: string | null; mode?: string }>;
  routes: Record<string, RoutedCapability>;
  reviewRequired: boolean;
}

/** States that remove a route from navigation entirely (doc §25). */
export const HIDDEN_CAPABILITY_STATES: ReadonlySet<CapabilityStateName> = new Set([
  'NOT_APPLICABLE',
  'UNAVAILABLE',
  'NOT_AUTHORIZED',
]);

export const CAPABILITIES_QUERY_KEY = 'application-capabilities';

export function useCapabilities(appId: string | null | undefined) {
  const query = useQuery<CapabilitiesResponse | null>({
    queryKey: [CAPABILITIES_QUERY_KEY, appId],
    queryFn: async () => {
      if (!appId) return null;
      const response = await authenticatedFetch(`/api-gateway/applications/${appId}/capabilities`);
      if (!response.ok) throw new Error('Failed to load application capabilities');
      return response.json();
    },
    enabled: !!appId,
    // Capabilities move only with architecture, plan, or evidence changes, so a short cache is safe.
    staleTime: 60_000,
  });

  return {
    capabilities: query.data ?? null,
    /** True until the first answer arrives. Callers must not treat this as "available". */
    isLoading: !!appId && query.isLoading,
    isError: query.isError,
    /** Resolved navigation applies only when the API says the UI rollout is on and the data is in. */
    resolvedUi: query.data?.uiEnabled === true,
  };
}
