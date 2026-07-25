'use client';

import { EmptyState } from '@/components/empty-state';
import { useSession } from '@/components/providers';

export function ApplicationRequiredState({ feature }: { feature: string }) {
  const { selectedOrg, selectedOrgId } = useSession();
  const createHref = selectedOrgId
    ? `/onboarding/new-app?${new URLSearchParams({
        orgId: selectedOrgId,
        orgName: selectedOrg?.name ?? 'Your organization',
      }).toString()}`
    : '/onboarding';

  return (
    <EmptyState
      variant="prerequisite"
      illustration="application"
      eyebrow="Application required"
      title={`Create an application to unlock ${feature.toLowerCase()}`}
      description="Tellann keeps behavior data isolated by application. Register your first application, then connect telemetry and define the behavior you expect."
      primaryAction={{ label: 'Create application', href: createHref }}
      secondaryAction={{ label: 'View setup steps', href: '/onboarding' }}
      className="min-h-[60vh]"
    />
  );
}
