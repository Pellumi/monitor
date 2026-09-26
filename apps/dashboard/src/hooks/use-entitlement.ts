'use client';

import { useQuery } from '@tanstack/react-query';
import { Feature, reportFormatsForTier, type ResourceLimits } from '@tellann/shared/entitlements';
import { authenticatedFetch } from '@/lib/authenticated-fetch';
import { useSession } from '@/components/providers';
import type { DashboardEntitlements } from '@/components/dashboard/core/types';

/**
 * The organisation's resolved entitlement, as the server computed it.
 *
 * Three call sites were fetching this under three different query keys, and a
 * fourth place — the dashboard — reimplemented the plan matrix in the browser
 * from scratch. That copy had drifted: it offered CSV export on Free, whose
 * real `REPORT_EXPORT` tier is JSON-only, and it had no case for the `LOCAL`
 * plan at all, so a paying LOCAL organisation silently received Free's
 * restrictions. One shared key, one source of truth.
 */
export interface ResolvedEntitlement {
  planType: string;
  features: Record<string, boolean | string>;
  limits: ResourceLimits;
  /** Formats the plan entitles, already resolved through `reportFormatsForTier`. */
  reportFormats?: string[];
}

export const ENTITLEMENT_QUERY_KEY = 'organization-entitlement';

export function useEntitlement() {
  const { selectedOrgId } = useSession();

  const query = useQuery<ResolvedEntitlement | null>({
    queryKey: [ENTITLEMENT_QUERY_KEY, selectedOrgId],
    queryFn: async () => {
      if (!selectedOrgId) return null;
      const response = await authenticatedFetch(
        `/api-gateway/organizations/${selectedOrgId}/entitlement`,
      );
      if (!response.ok) throw new Error('Failed to load entitlement');
      return response.json();
    },
    enabled: !!selectedOrgId,
    // Plans change rarely, and every surface on the page reads this.
    staleTime: 5 * 60_000,
  });

  return {
    entitlement: query.data ?? null,
    isLoading: query.isLoading,
    /**
     * Until the entitlement has loaded, nothing is granted. Optimistically
     * enabling an action the plan forbids produces a button that 403s.
     */
    entitlements: toDashboardEntitlements(query.data ?? null),
  };
}

export function toDashboardEntitlements(
  entitlement: ResolvedEntitlement | null,
): DashboardEntitlements {
  if (!entitlement) {
    return {
      canExportPdf: false,
      canExportCsv: false,
      canUseTeamFeatures: false,
      canAccessApi: false,
      canAccessAuditLogs: false,
      canUseMultipleEnvironments: false,
    };
  }

  const formats = entitlement.reportFormats
    ?? reportFormatsForTier(entitlement.features[Feature.REPORT_EXPORT]).map((f) => f.toLowerCase());
  const has = (feature: Feature) => Boolean(entitlement.features[feature]);

  return {
    canExportPdf: formats.some((format) => format.toLowerCase() === 'pdf'),
    canExportCsv: formats.some((format) => format.toLowerCase() === 'csv'),
    canUseTeamFeatures: has(Feature.TEAM_COLLABORATION),
    canAccessApi: has(Feature.API_ACCESS),
    canAccessAuditLogs: has(Feature.AUDIT_LOGS),
    canUseMultipleEnvironments: has(Feature.MULTIPLE_ENVIRONMENTS),
  };
}
