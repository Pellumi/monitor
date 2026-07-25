'use client';

import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
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
  const { selectedOrgId } = useSession();
  const requestedAppId = searchParams.get('appId');

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
  const appId = selectedApplication?.id ?? '';

  useEffect(() => {
    if (!selectedApplication || requestedAppId === selectedApplication.id) return;

    const params = new URLSearchParams(searchParams.toString());
    params.set('appId', selectedApplication.id);
    router.replace(`${pathname}?${params.toString()}`);
  }, [pathname, requestedAppId, router, searchParams, selectedApplication]);

  return {
    ...applicationsQuery,
    applications,
    selectedApplication,
    appId,
    selectedOrgId,
  };
}
