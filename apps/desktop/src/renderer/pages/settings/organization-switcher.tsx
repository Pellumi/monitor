import type { DesktopOrganization } from "@tellann/desktop-contracts";
import { SelectField } from "../../components/ui/select";

/** Shown only when the member belongs to more than one organisation. */
export function OrganizationSwitcher({
  organizations,
  organizationId,
  onChange,
}: {
  organizations: DesktopOrganization[];
  organizationId: string | null;
  onChange(id: string): void;
}) {
  if (organizations.length <= 1) return null;
  return (
    <SelectField
      ariaLabel="Organization"
      value={organizationId ?? ""}
      onValueChange={onChange}
      options={organizations.map((org) => ({ value: org.id, label: org.name }))}
      className="settings-org-switcher"
    />
  );
}
