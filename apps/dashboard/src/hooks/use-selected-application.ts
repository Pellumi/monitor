'use client';

import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation';
import { authenticatedFetch } from '@/lib/authenticated-fetch';
import { useSession } from '@/components/providers';

export interface SelectedApplication {
  id: string;
  name: string;
}

const NO_APPLICATIONS: SelectedApplication[] = [];

export function useSelectedApplication() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const params = useParams<{ appId?: string }>();
  const { selectedOrgId } = useSession();
  const routeAppId = params?.appId;
  const queryAppId = searchParams.get('appId');
  const requestedAppId = routeAppId || queryAppId;

  const applicationsQuery = useQuery<SelectedApplication[]>({
    queryKey: ['organization-applications', selectedOrgId],
    queryFn: async () => {
      if (!selectedOrgId) return [];

      const response = await authenticatedFetch(
        `/api-gateway/organizations/${selectedOrgId}/applications`,
      );
      if (!response.ok) {
        throw new Error('Failed to load applications for the selected organization');
      }
      return response.json();
    },
    enabled: !!selectedOrgId,
  });

  const applications = applicationsQuery.data ?? NO_APPLICATIONS;
  const selectedApplication = useMemo(
    () =>
      applications.find((application) => application.id === requestedAppId) ??
      applications[0] ??
      null,
    [applications, requestedAppId],
  );
  // Never expose an application id until it has been proven to belong to the
  // selected organization. Using the URL value while the applications query
  // is loading can issue requests for the previously selected organization.
  const appId = selectedApplication?.id ?? '';

  useEffect(() => {
    if (!selectedApplication || queryAppId === selectedApplication.id) return;

    const search = new URLSearchParams(searchParams.toString());
    search.set('appId', selectedApplication.id);
    router.replace(`${pathname}?${search.toString()}`);
  }, [pathname, queryAppId, router, searchParams, selectedApplication]);

  return {
    ...applicationsQuery,
    applications,
    selectedApplication,
    appId,
    selectedOrgId,
  };
}
