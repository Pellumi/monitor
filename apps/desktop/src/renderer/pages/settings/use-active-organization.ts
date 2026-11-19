import { useEffect, useState } from "react";
import { useDesktop } from "../../desktop-context";

const STORAGE_KEY = "tellann:settings:active-org";

/**
 * Settings pages are org-scoped (members, billing, audit logs, notification
 * preferences) but, unlike the main app, aren't nested under an
 * `applications/:projectId` route — there's no project in the URL to derive
 * an organisation from. This picks a sensible default (the last one used
 * here, else the first the member belongs to) and persists the choice for
 * members of more than one organisation.
 */
export function useActiveOrganization() {
  const { organizations } = useDesktop();
  const [organizationId, setOrganizationId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (!organizations.length) return;
    if (organizationId && organizations.some((org) => org.id === organizationId)) return;
    const next = organizations[0].id;
    setOrganizationId(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, [organizations, organizationId]);

  const select = (id: string) => {
    setOrganizationId(id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      /* ignore */
    }
  };

  return { organizationId, organizations, setOrganizationId: select };
}
