"use client";

import { useCallback, useEffect, useState } from "react";
import { authenticatedFetch } from "@/lib/authenticated-fetch";
import { useSession } from "@/components/providers";
import { PermissionNotice, SettingsPage, SettingsSection } from "@/components/settings/settings-page";
import { Button } from "@/components/ui/button";

type Payload = {
  organization: { id: string; name: string; slug: string; createdAt: string };
  settings: {
    primaryTimezone: string;
    defaultReportFormat: string;
    defaultInvitationExpiryDays: number;
    defaultSeverityThreshold: string;
    billingContactEmail?: string | null;
    technicalContactEmail?: string | null;
    securityContactEmail?: string | null;
    version: number;
  };
};

export default function OrganizationPage() {
  const { selectedOrgId, memberships } = useSession();
  const [payload, setPayload] = useState<Payload | null>(null);
  const [message, setMessage] = useState("");
  const role = memberships.find((membership) => membership.organization.id === selectedOrgId)?.role;
  const canManage = role === "OWNER" || role === "ADMIN";

  const load = useCallback(async () => {
    if (!selectedOrgId) return;
    const response = await authenticatedFetch(`/api-gateway/organizations/${selectedOrgId}/settings`);
    if (!response.ok) throw new Error("Unable to load organisation settings.");
    setPayload(await response.json());
  }, [selectedOrgId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load().catch((error: Error) => setMessage(error.message));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function save() {
    if (!selectedOrgId || !payload) return;
    const response = await authenticatedFetch(`/api-gateway/organizations/${selectedOrgId}/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload.settings),
    });
    const body = await response.json();
    if (!response.ok) {
      setMessage(body.message ?? "Unable to save organisation settings.");
      return;
    }
    setPayload({ ...payload, settings: body });
    setMessage("Organisation settings saved.");
  }

  function field(key: keyof Payload["settings"], value: string | number) {
    setPayload((current) => current ? { ...current, settings: { ...current.settings, [key]: value } } : current);
  }

  return (
    <SettingsPage title="Organisation" description="Manage workspace identity, defaults, contacts, ownership, and lifecycle." scope="ORGANIZATION">
      {message ? <div className="rounded-md border border-neutral-800 bg-neutral-950 p-3 text-sm text-neutral-300">{message}</div> : null}
      {!canManage ? <PermissionNotice>You can view these settings, but only an Owner or Admin can change them.</PermissionNotice> : null}
      {payload ? (
        <>
          <SettingsSection title="Workspace identity">
            <div className="grid gap-4 md:grid-cols-2">
              <ReadOnly label="Organisation name" value={payload.organization.name} />
              <ReadOnly label="Workspace slug" value={payload.organization.slug} />
              <ReadOnly label="Organisation ID" value={payload.organization.id} />
              <Input label="Primary timezone" value={payload.settings.primaryTimezone} disabled={!canManage} onChange={(value) => field("primaryTimezone", value)} />
            </div>
          </SettingsSection>
          <SettingsSection title="Workspace defaults">
            <div className="grid gap-4 md:grid-cols-3">
              <Input label="Default report format" value={payload.settings.defaultReportFormat} disabled={!canManage} onChange={(value) => field("defaultReportFormat", value)} />
              <Input label="Invitation expiry (days)" type="number" value={String(payload.settings.defaultInvitationExpiryDays)} disabled={!canManage} onChange={(value) => field("defaultInvitationExpiryDays", Number(value))} />
              <Input label="Severity threshold" value={payload.settings.defaultSeverityThreshold} disabled={!canManage} onChange={(value) => field("defaultSeverityThreshold", value)} />
            </div>
          </SettingsSection>
          <SettingsSection title="Contacts">
            <div className="grid gap-4 md:grid-cols-3">
              {(["billingContactEmail", "technicalContactEmail", "securityContactEmail"] as const).map((key) => (
                <Input key={key} label={key.replace("ContactEmail", " contact")} type="email" value={payload.settings[key] ?? ""} disabled={!canManage} onChange={(value) => field(key, value)} />
              ))}
            </div>
          </SettingsSection>
          {canManage ? <div className="flex justify-end"><Button onClick={() => void save()} variant="primary">Save organisation</Button></div> : null}
        </>
      ) : <div className="text-sm text-neutral-500">Loading organisation…</div>}
    </SettingsPage>
  );
}

function Input({ label, value, onChange, disabled, type = "text" }: { label: string; value: string; onChange: (value: string) => void; disabled?: boolean; type?: string }) {
  return <label className="text-xs capitalize text-neutral-500">{label}<input type={type} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} className="mt-1.5 w-full rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-white disabled:opacity-50" /></label>;
}

function ReadOnly({ label, value }: { label: string; value: string }) {
  return <div><div className="text-xs text-neutral-500">{label}</div><div className="mt-1.5 rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-neutral-300">{value}</div></div>;
}
