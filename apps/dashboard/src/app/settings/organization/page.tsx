"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { authenticatedFetch } from "@/lib/authenticated-fetch";
import { useSession } from "@/components/providers";
import { PermissionNotice, SettingsPage, SettingsSection } from "@/components/settings/settings-page";
import { Button } from "@/components/ui/button";
import { Copy, Check, CheckCircle2, AlertCircle } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Payload = {
  organization: { id: string; name: string; slug: string; createdAt: string };
  settings: {
    primaryTimezone: string;
    defaultReportFormat: string;
    defaultInvitationExpiryDays: number;
    billingContactEmail?: string | null;
    technicalContactEmail?: string | null;
    securityContactEmail?: string | null;
    version: number;
  };
  /**
   * What the organisation's plan allows. Served by the settings API from the
   * same entitlement resolution the PUT validates against, so a control is
   * never offered here that saving would reject.
   */
  entitlements: {
    planType: string;
    allowedReportFormats: string[];
    canInviteMembers: boolean;
  };
};

const TIMEZONE_OPTIONS = [
  { value: "UTC", label: "UTC (Coordinated Universal Time)" },
  { value: "Africa/Lagos", label: "Africa/Lagos (WAT, UTC+1)" },
  { value: "Africa/Johannesburg", label: "Africa/Johannesburg (SAST, UTC+2)" },
  { value: "Africa/Cairo", label: "Africa/Cairo (EET, UTC+2)" },
  { value: "America/New_York", label: "America/New_York (EST/EDT, UTC-5/-4)" },
  { value: "America/Chicago", label: "America/Chicago (CST/CDT, UTC-6/-5)" },
  { value: "America/Denver", label: "America/Denver (MST/MDT, UTC-7/-6)" },
  { value: "America/Los_Angeles", label: "America/Los_Angeles (PST/PDT, UTC-8/-7)" },
  { value: "America/Sao_Paulo", label: "America/Sao_Paulo (BRT, UTC-3)" },
  { value: "Europe/London", label: "Europe/London (GMT/BST, UTC+0/+1)" },
  { value: "Europe/Paris", label: "Europe/Paris (CET/CEST, UTC+1/+2)" },
  { value: "Europe/Berlin", label: "Europe/Berlin (CET/CEST, UTC+1/+2)" },
  { value: "Asia/Dubai", label: "Asia/Dubai (GST, UTC+4)" },
  { value: "Asia/Kolkata", label: "Asia/Kolkata (IST, UTC+5:30)" },
  { value: "Asia/Singapore", label: "Asia/Singapore (SGT, UTC+8)" },
  { value: "Asia/Tokyo", label: "Asia/Tokyo (JST, UTC+9)" },
  { value: "Australia/Sydney", label: "Australia/Sydney (AEST/AEDT, UTC+10/+11)" },
];

const REPORT_FORMAT_OPTIONS = [
  { value: "JSON", label: "Raw JSON Payload" },
  { value: "PDF", label: "PDF Document" },
  { value: "CSV", label: "CSV Spreadsheet" },
  { value: "HTML", label: "Interactive HTML Web Page" },
];

const INVITATION_EXPIRY_OPTIONS = [
  { value: "1", label: "1 day" },
  { value: "3", label: "3 days" },
  { value: "7", label: "7 days (Recommended)" },
  { value: "14", label: "14 days" },
  { value: "30", label: "30 days" },
];

export default function OrganizationPage() {
  const { selectedOrgId, memberships } = useSession();
  const [payload, setPayload] = useState<Payload | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [copiedId, setCopiedId] = useState(false);
  const role = memberships.find((membership) => membership.organization.id === selectedOrgId)?.role;
  const canManage = role === "OWNER" || role === "ADMIN";

  // Plan gates come from the API rather than a local copy of the plan matrix,
  // so the choices offered here and the ones the PUT accepts cannot drift.
  const allowedReportFormats = payload?.entitlements.allowedReportFormats ?? [];
  const canInviteMembers = payload?.entitlements.canInviteMembers ?? false;
  const planName = payload?.entitlements.planType ?? "current";
  const reportFormatOptions = REPORT_FORMAT_OPTIONS.filter((option) => allowedReportFormats.includes(option.value));
  const lockedReportFormats = REPORT_FORMAT_OPTIONS
    .filter((option) => !allowedReportFormats.includes(option.value))
    .map((option) => option.value);

  const load = useCallback(async (signal?: AbortSignal) => {
    if (!selectedOrgId) return;
    const response = await authenticatedFetch(`/api-gateway/organizations/${selectedOrgId}/settings`, { signal });
    if (!response.ok) throw new Error("Unable to load organisation settings.");
    const nextPayload = await response.json() as Payload;
    if (!signal?.aborted) setPayload(nextPayload);
  }, [selectedOrgId]);

  useEffect(() => {
    const controller = new AbortController();
    setPayload(null);
    setStatusMessage(null);
    const timer = window.setTimeout(() => {
      void load(controller.signal).catch((error: Error) => {
        if (error.name !== "AbortError") setStatusMessage({ text: error.message, type: "error" });
      });
    }, 0);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [load]);

  async function save() {
    if (!selectedOrgId || !payload || payload.organization.id !== selectedOrgId) return;
    const response = await authenticatedFetch(`/api-gateway/organizations/${selectedOrgId}/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...payload.settings,
        name: payload.organization.name,
      }),
    });
    const body = await response.json();
    if (!response.ok) {
      setStatusMessage({ text: body.message ?? "Unable to save organisation settings.", type: "error" });
      return;
    }
    setPayload({
      ...payload,
      organization: { ...payload.organization, name: payload.organization.name },
      settings: body,
    });
    setStatusMessage({ text: "Organisation settings saved successfully.", type: "success" });
  }

  function field(key: keyof Payload["settings"], value: string | number) {
    setPayload((current) => current ? { ...current, settings: { ...current.settings, [key]: value } } : current);
  }

  function orgField(key: keyof Payload["organization"], value: string) {
    setPayload((current) => current ? { ...current, organization: { ...current.organization, [key]: value } } : current);
  }

  function copyOrganizationId(id: string) {
    void navigator.clipboard.writeText(id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  }

  return (
    <SettingsPage title="Organisation" description="Manage workspace identity, defaults, contacts, ownership, and lifecycle." scope="ORGANIZATION">
      {statusMessage ? (
        <div
          className={`flex items-center gap-2.5 rounded-md border px-3.5 py-2.5 text-xs font-medium transition-all ${
            statusMessage.type === "success"
              ? "border-emerald-500/30 bg-emerald-950/40 text-emerald-300"
              : "border-red-500/30 bg-red-950/40 text-red-300"
          }`}
        >
          {statusMessage.type === "success" ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      ) : null}
      {!canManage ? <PermissionNotice>You can view these settings, but only an Owner or Admin can change them.</PermissionNotice> : null}
      {payload ? (
        <>
          <SettingsSection title="Workspace identity">
            <div className="grid gap-4 md:grid-cols-2">
              <Input
                label="Organisation name"
                value={payload.organization.name}
                disabled={!canManage}
                onChange={(value) => orgField("name", value)}
              />
              <ReadOnly label="Workspace slug" value={payload.organization.slug} />
              
              <ReadOnlyWithCopy
                label="Organisation ID"
                value={payload.organization.id}
                copied={copiedId}
                onCopy={() => copyOrganizationId(payload.organization.id)}
              />

              <SelectInput
                label="Primary timezone"
                value={payload.settings.primaryTimezone}
                disabled={!canManage}
                onChange={(value) => field("primaryTimezone", value)}
                options={TIMEZONE_OPTIONS}
              />
            </div>
          </SettingsSection>

          <SettingsSection
            title="Workspace defaults"
            description="Applied whenever a report or an invitation is created without explicit options."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <SelectInput
                label="Default report format"
                value={payload.settings.defaultReportFormat}
                disabled={!canManage}
                onChange={(value) => field("defaultReportFormat", value)}
                options={reportFormatOptions}
                description={
                  lockedReportFormats.length
                    ? `Every report is generated in this format unless another is chosen at export. ${lockedReportFormats.join(", ")} ${lockedReportFormats.length === 1 ? "is" : "are"} not available on the ${planName} plan.`
                    : "Every report is generated in this format unless another is chosen at export."
                }
                upgradeHref={lockedReportFormats.length ? "/settings/billing" : undefined}
              />

              <SelectInput
                label="Invitation expiry"
                value={String(payload.settings.defaultInvitationExpiryDays)}
                disabled={!canManage || !canInviteMembers}
                onChange={(value) => field("defaultInvitationExpiryDays", Number(value))}
                options={INVITATION_EXPIRY_OPTIONS}
                description={
                  canInviteMembers
                    ? "How long a team invitation stays valid after it is sent."
                    : `The ${planName} plan does not include team invitations, so there is nothing to expire.`
                }
                upgradeHref={canInviteMembers ? undefined : "/settings/billing"}
              />
            </div>
          </SettingsSection>

          <SettingsSection
            title="Contacts"
            description="Set an address to send that category of mail to one mailbox instead of to every member. Leave it blank and those messages go to members' own email addresses. Sign-in codes, device alerts and invitations are addressed to a person and are always delivered to them directly."
          >
            <div className="grid gap-4 md:grid-cols-3">
              <InputWithHelper
                label="Billing Contact Email"
                type="email"
                placeholder="billing@company.com"
                value={payload.settings.billingContactEmail ?? ""}
                disabled={!canManage}
                onChange={(value) => field("billingContactEmail", value)}
                description="Receives invoices, receipts, payment failures, trial and plan notices, and usage warnings."
              />

              <InputWithHelper
                label="Technical Contact Email"
                type="email"
                placeholder="eng-leads@company.com"
                value={payload.settings.technicalContactEmail ?? ""}
                disabled={!canManage}
                onChange={(value) => field("technicalContactEmail", value)}
                description="Receives coverage drops, missing critical flows, slow endpoints, and failed run analysis."
              />

              <InputWithHelper
                label="Security Contact Email"
                type="email"
                placeholder="security@company.com"
                value={payload.settings.securityContactEmail ?? ""}
                disabled={!canManage}
                onChange={(value) => field("securityContactEmail", value)}
                description="Receives organisation security advisories and privacy or data-handling notices."
              />
            </div>
          </SettingsSection>

          {canManage ? (
            <div className="flex justify-end pt-2">
              <Button onClick={() => void save()} variant="primary">
                Save organisation
              </Button>
            </div>
          ) : null}
        </>
      ) : (
        <div className="text-sm text-neutral-500">Loading organisation…</div>
      )}
    </SettingsPage>
  );
}

function Input({ label, value, onChange, disabled, type = "text" }: { label: string; value: string; onChange: (value: string) => void; disabled?: boolean; type?: string }) {
  return (
    <label className="text-xs text-neutral-400 font-medium">
      {label}
      <input
        type={type}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1.5 w-full rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-white focus:outline-none focus:border-neutral-500 transition-colors disabled:opacity-50"
      />
    </label>
  );
}

function InputWithHelper({
  label,
  value,
  onChange,
  disabled,
  type = "email",
  placeholder,
  description,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  type?: string;
  placeholder?: string;
  description: string;
}) {
  return (
    <label className="text-xs text-neutral-400 font-medium flex flex-col">
      <span>{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1.5 w-full rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-white focus:outline-none focus:border-neutral-500 transition-colors disabled:opacity-50"
      />
      <span className="mt-1.5 text-[11px] text-neutral-500 leading-normal">{description}</span>
    </label>
  );
}

function SelectInput({
  label,
  value,
  onChange,
  disabled,
  options,
  description,
  upgradeHref,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  options: Array<{ value: string; label: string }>;
  description?: string;
  /** Renders an upgrade link beside the description when the plan is the limit. */
  upgradeHref?: string;
}) {
  const selectedOption = options.find((opt) => opt.value === value);

  return (
    <div className="text-xs text-neutral-400 font-medium flex flex-col">
      <span>{label}</span>
      <div className="mt-1.5">
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger disabled={disabled} className="w-full">
            <SelectValue placeholder="Select...">{selectedOption?.label ?? value}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {options.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {description ? (
        <span className="mt-1.5 text-[11px] text-neutral-500 leading-normal">
          {description}
          {upgradeHref ? (
            <>
              {" "}
              <Link href={upgradeHref} className="text-neutral-300 underline underline-offset-2 hover:text-white">
                Compare plans
              </Link>
            </>
          ) : null}
        </span>
      ) : null}
    </div>
  );
}

function ReadOnly({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-neutral-400 font-medium">{label}</div>
      <div className="mt-1.5 rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-neutral-400 font-mono select-all">
        {value}
      </div>
    </div>
  );
}

function ReadOnlyWithCopy({
  label,
  value,
  copied,
  onCopy,
}: {
  label: string;
  value: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div>
      <div className="text-xs text-neutral-400 font-medium">{label}</div>
      <div className="mt-1.5 flex items-center justify-between gap-2 rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm font-mono text-neutral-300">
        <span className="truncate select-all text-xs">{value}</span>
        <button
          type="button"
          onClick={onCopy}
          className="p-1 rounded text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors shrink-0 flex items-center gap-1 text-[11px]"
          title="Copy Organisation ID"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-emerald-400 font-mono">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              <span className="text-neutral-400 hover:text-white font-mono">Copy</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
