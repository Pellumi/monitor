"use client";

import { useCallback, useEffect, useState } from "react";
import { Lock } from "lucide-react";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { authenticatedFetch } from "@/lib/authenticated-fetch";
import { useSession } from "@/components/providers";
import { useNotifications } from "@/components/notifications-provider";
import { requestPermission } from "@/lib/browser-notifications";
import { SettingsPage, SettingsSection, SettingsToggle } from "@/components/settings/settings-page";

/** Mirrors `CategoryCapability` from @tellann/email, sent with each preference. */
type CategoryCapability = {
  category: string;
  label: string;
  description: string;
  emailSupported: boolean;
  emailLocked: boolean;
  inAppSupported: boolean;
  batchable: boolean;
  defaultFrequency: string;
};

type NotificationPreference = {
  category: string;
  emailEnabled: boolean;
  inAppEnabled: boolean;
  frequency: string;
  capability: CategoryCapability;
};

const FREQUENCY_LABELS: Record<string, string> = {
  IMMEDIATE: "Instant",
  DAILY_DIGEST: "Daily digest",
  WEEKLY_DIGEST: "Weekly digest",
  NEVER: "Never",
};

export default function NotificationsPage() {
  const { selectedOrgId } = useSession();
  const [preferences, setPreferences] = useState<NotificationPreference[]>([]);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    if (!selectedOrgId) return;
    const response = await authenticatedFetch(`/api-gateway/organizations/${selectedOrgId}/notification-preferences`);
    if (!response.ok) throw new Error("Unable to load notification preferences.");
    setPreferences(await response.json());
  }, [selectedOrgId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load().catch((error: Error) => setMessage(error.message));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function update(category: string, patch: Partial<NotificationPreference>) {
    if (!selectedOrgId) return;
    const current = preferences.find((item) => item.category === category);
    if (!current) return;
    const next = { ...current, ...patch };
    setPreferences((items) => items.map((item) => (item.category === category ? next : item)));
    const response = await authenticatedFetch(
      `/api-gateway/organizations/${selectedOrgId}/notification-preferences/${category}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      },
    );
    if (!response.ok) {
      await load();
      const body = await response.json().catch(() => ({}));
      setMessage(body.message ?? "Unable to update notifications.");
      return;
    }
    // The server coerces values it cannot honour (a digest frequency on a
    // transactional category, or email on a locked one), so the stored result
    // replaces the optimistic one rather than being assumed correct.
    const saved = await response.json();
    setPreferences((items) =>
      items.map((item) => (item.category === category ? { ...item, ...saved } : item)),
    );
    setMessage("Notification preference saved.");
  }

  return (
    <SettingsPage
      title="Notifications"
      description="Choose how Tellann tells you about activity in this organisation."
      scope="USER"
    >
      {message ? (
        <div className="rounded-md border border-neutral-800 bg-neutral-950 p-3 text-sm text-neutral-300">
          {message}
        </div>
      ) : null}
      {!selectedOrgId ? (
        <div className="text-sm text-neutral-500">Select an organisation to manage its subscriptions.</div>
      ) : null}

      <BrowserNotificationSection />

      <div className="space-y-4">
        {preferences.map((preference) => {
          const capability = preference.capability;
          return (
            <SettingsSection
              key={preference.category}
              title={capability.label}
              description={capability.description}
            >
              <div className="divide-y divide-neutral-800">
                {capability.inAppSupported ? (
                  <SettingsToggle
                    label="In-app notifications"
                    description="Show in the notification bell, and as a browser notification while Tellann is open."
                    checked={preference.inAppEnabled}
                    onChange={(checked) => void update(preference.category, { inAppEnabled: checked })}
                  />
                ) : null}

                {capability.emailSupported ? (
                  <SettingsToggle
                    label="Email notifications"
                    description={
                      capability.emailLocked
                        ? "Required for account safety, so this cannot be switched off."
                        : undefined
                    }
                    checked={preference.emailEnabled}
                    disabled={capability.emailLocked}
                    onChange={(checked) => void update(preference.category, { emailEnabled: checked })}
                  />
                ) : null}
              </div>

              {/*
                Frequency is offered only where batching is meaningful. A sign-in
                alert or an invite is only useful when it happens, so those
                categories send immediately and show no control at all.
              */}
              {capability.batchable && capability.emailSupported ? (
                <div className="mt-4">
                  <span className="block text-xs font-semibold text-neutral-400 mb-1.5">
                    Email delivery frequency
                  </span>
                  <Select
                    value={preference.frequency}
                    onValueChange={(value) => void update(preference.category, { frequency: value })}
                  >
                    <SelectTrigger className="w-full max-w-xs">
                      <SelectValue placeholder="Select frequency...">
                        {FREQUENCY_LABELS[preference.frequency] ?? preference.frequency}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="IMMEDIATE">Instant</SelectItem>
                      <SelectItem value="DAILY_DIGEST">Daily digest</SelectItem>
                      <SelectItem value="WEEKLY_DIGEST">Weekly digest</SelectItem>
                      <SelectItem value="NEVER">Never</SelectItem>
                    </SelectContent>
                  </Select>
                  <span className="mt-1.5 block text-xs leading-5 text-neutral-500">
                    Digests are collected and sent in one email. In-app notifications are unaffected.
                  </span>
                </div>
              ) : capability.emailSupported ? (
                <p className="mt-4 flex items-center gap-1.5 text-xs text-neutral-500">
                  <Lock className="h-3 w-3 shrink-0" />
                  Sent immediately — these are time-sensitive and cannot be batched.
                </p>
              ) : null}
            </SettingsSection>
          );
        })}
      </div>
    </SettingsPage>
  );
}

/**
 * Browser notifications need explicit permission, which can only be requested
 * from a user gesture and can never be re-requested once denied. This section
 * makes that state visible instead of letting the in-app toggles appear broken.
 */
function BrowserNotificationSection() {
  const { permission, refreshPermission } = useNotifications();
  const [requesting, setRequesting] = useState(false);

  async function onEnable() {
    setRequesting(true);
    try {
      await requestPermission();
      refreshPermission();
    } finally {
      setRequesting(false);
    }
  }

  return (
    <SettingsSection
      title="Browser notifications"
      description="Tellann can raise a desktop notification while the app is open in a tab."
    >
      {permission === "unsupported" ? (
        <PermissionBadge
          label="Unsupported"
          variant="neutral"
          tooltip="This browser does not support notifications. The in-app notification bell still works."
        />
      ) : permission === "granted" ? (
        <PermissionBadge
          label="Enabled"
          variant="emerald"
          tooltip="Notifications for the categories below will appear while Tellann is open."
        />
      ) : permission === "denied" ? (
        <PermissionBadge
          label="Blocked"
          variant="amber"
          tooltip="Blocked for this site. Browser permissions can only be restored from your browser site settings — Tellann cannot ask again. The notification bell still works."
        />
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="primary" onClick={() => void onEnable()} disabled={requesting}>
            {requesting ? "Waiting for browser…" : "Enable browser notifications"}
          </Button>
          <span className="text-xs text-neutral-500">Your browser will ask you to confirm.</span>
        </div>
      )}
    </SettingsSection>
  );
}

function PermissionBadge({
  label,
  tooltip,
  variant,
}: {
  label: string;
  tooltip: string;
  variant: "emerald" | "amber" | "neutral";
}) {
  const badgeColors = {
    emerald: "border-emerald-800/60 bg-emerald-950/40 text-emerald-400",
    amber: "border-amber-800/60 bg-amber-950/40 text-amber-400",
    neutral: "border-neutral-800 bg-neutral-950 text-neutral-400",
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            tabIndex={0}
            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold cursor-help focus:outline-none focus:ring-1 focus:ring-neutral-700 ${badgeColors[variant]}`}
          >
            {label}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed text-neutral-200">
          <p>{tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
