"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Lock } from "lucide-react";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { authenticatedFetch } from "@/lib/authenticated-fetch";
import { useSession } from "@/components/providers";
import {
  disablePush,
  enablePush,
  getPushState,
  isPushSupported,
  sendTestPush,
  type PushState,
} from "@/lib/push-manager";
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
  webPushEnabled: boolean;
  desktopEnabled: boolean;
  frequency: string;
  minSeverity: string;
  quietHoursEnabled: boolean;
  quietHoursStart: number | null;
  quietHoursEnd: number | null;
  criticalOverridesQuietHours: boolean;
  capability: CategoryCapability;
};

const FREQUENCY_LABELS: Record<string, string> = {
  IMMEDIATE: "Instant",
  DAILY_DIGEST: "Daily digest",
  WEEKLY_DIGEST: "Weekly digest",
  NEVER: "Never",
};

const SEVERITY_OPTIONS = [
  { value: "CRITICAL", label: "Critical only" },
  { value: "HIGH", label: "Critical + High" },
  { value: "MEDIUM", label: "Critical + High + Medium" },
  { value: "LOW", label: "Everything except routine info" },
];

function minutesToTime(minutes: number | null): string {
  if (minutes === null) return "";
  const h = String(Math.floor(minutes / 60)).padStart(2, "0");
  const m = String(minutes % 60).padStart(2, "0");
  return `${h}:${m}`;
}
function timeToMinutes(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

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

  const savePreference = useCallback(
    async (category: string, patch: Partial<NotificationPreference>) => {
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
      const saved = await response.json();
      setPreferences((items) =>
        items.map((item) => (item.category === category ? { ...item, ...saved } : item)),
      );
      setMessage("Notification preference saved.");
    },
    [selectedOrgId, preferences, load],
  );

  /** Severity threshold and quiet hours are one choice applied to every category. */
  const applyToAll = useCallback(
    async (patch: Partial<NotificationPreference>) => {
      setPreferences((items) => items.map((item) => ({ ...item, ...patch })));
      await Promise.all(preferences.map((pref) => savePreference(pref.category, patch)));
    },
    [preferences, savePreference],
  );

  const shared = preferences[0];

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

      <WebPushSection orgId={selectedOrgId} onMessage={setMessage} />

      {shared ? (
        <SettingsSection
          title="Browser push & desktop delivery"
          description="Applies to every category above. In-app notifications ignore these and always arrive."
        >
          <div className="space-y-4">
            <div>
              <span className="mb-1.5 block text-xs font-semibold text-neutral-400">
                Send a push / desktop alert for
              </span>
              <Select
                value={shared.minSeverity}
                onValueChange={(value) => void applyToAll({ minSeverity: value })}
              >
                <SelectTrigger className="w-full max-w-xs">
                  <SelectValue placeholder="Select severity…">
                    {SEVERITY_OPTIONS.find((o) => o.value === shared.minSeverity)?.label ?? shared.minSeverity}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {SEVERITY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <SettingsToggle
              label="Quiet hours"
              description="Hold back push and desktop alerts during a nightly window."
              checked={shared.quietHoursEnabled}
              onChange={(checked) => void applyToAll({ quietHoursEnabled: checked })}
            />
            {shared.quietHoursEnabled ? (
              <div className="flex flex-wrap items-end gap-3 pl-1">
                <label className="text-xs text-neutral-400">
                  From
                  <input
                    type="time"
                    defaultValue={minutesToTime(shared.quietHoursStart ?? 22 * 60)}
                    onBlur={(event) => void applyToAll({ quietHoursStart: timeToMinutes(event.target.value) })}
                    className="mt-1 block rounded border border-neutral-800 bg-neutral-950 px-2 py-1 text-sm text-neutral-200"
                  />
                </label>
                <label className="text-xs text-neutral-400">
                  To
                  <input
                    type="time"
                    defaultValue={minutesToTime(shared.quietHoursEnd ?? 7 * 60)}
                    onBlur={(event) => void applyToAll({ quietHoursEnd: timeToMinutes(event.target.value) })}
                    className="mt-1 block rounded border border-neutral-800 bg-neutral-950 px-2 py-1 text-sm text-neutral-200"
                  />
                </label>
                <SettingsToggle
                  label="Still allow critical alerts"
                  checked={shared.criticalOverridesQuietHours}
                  onChange={(checked) => void applyToAll({ criticalOverridesQuietHours: checked })}
                />
              </div>
            ) : null}
          </div>
        </SettingsSection>
      ) : null}

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
                    label="In-app"
                    description="The notification bell and a toast while Tellann is open."
                    checked={preference.inAppEnabled}
                    onChange={(checked) => void savePreference(preference.category, { inAppEnabled: checked })}
                  />
                ) : null}

                <SettingsToggle
                  label="Browser push"
                  description="Sent to enrolled browsers when no Tellann tab is open."
                  checked={preference.webPushEnabled}
                  onChange={(checked) => void savePreference(preference.category, { webPushEnabled: checked })}
                />

                <SettingsToggle
                  label="Desktop"
                  description="Native notification from a running Tellann Desktop."
                  checked={preference.desktopEnabled}
                  onChange={(checked) => void savePreference(preference.category, { desktopEnabled: checked })}
                />

                {capability.emailSupported ? (
                  <SettingsToggle
                    label="Email"
                    description={
                      capability.emailLocked
                        ? "Required for account safety, so this cannot be switched off."
                        : undefined
                    }
                    checked={preference.emailEnabled}
                    disabled={capability.emailLocked}
                    onChange={(checked) => void savePreference(preference.category, { emailEnabled: checked })}
                  />
                ) : null}
              </div>

              {capability.batchable && capability.emailSupported ? (
                <div className="mt-4">
                  <span className="block text-xs font-semibold text-neutral-400 mb-1.5">
                    Email delivery frequency
                  </span>
                  <Select
                    value={preference.frequency}
                    onValueChange={(value) => void savePreference(preference.category, { frequency: value })}
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
 * Standards-based Web Push enrolment. Distinct from in-app notifications: this
 * is the browser delivering an OS notification when Tellann is closed. Permission
 * is only requested after the user presses Enable.
 */
function WebPushSection({
  orgId,
  onMessage,
}: {
  orgId: string | null;
  onMessage: (message: string) => void;
}) {
  const [state, setState] = useState<PushState>("default");
  const [busy, setBusy] = useState(false);
  const supported = useMemo(() => isPushSupported(), []);

  useEffect(() => {
    void getPushState().then(setState);
  }, []);

  async function onEnable() {
    if (!orgId) return;
    setBusy(true);
    try {
      setState(await enablePush(orgId));
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "Could not enable browser push.");
    } finally {
      setBusy(false);
    }
  }

  async function onDisable() {
    if (!orgId) return;
    setBusy(true);
    try {
      setState(await disablePush(orgId));
    } finally {
      setBusy(false);
    }
  }

  async function onTest() {
    if (!orgId) return;
    setBusy(true);
    try {
      const result = await sendTestPush(orgId);
      onMessage(`Test push sent to ${result.sent} of ${result.total} browser(s).`);
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "Test failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SettingsSection
      title="Browser push"
      description="Get an OS notification even when Tellann is closed. This is different from the in-app bell, which only updates while a tab is open."
    >
      {!supported || state === "unsupported" ? (
        <PermissionBadge
          label="Unsupported"
          variant="neutral"
          tooltip="This browser does not support Web Push. In-app notifications still work."
        />
      ) : state === "denied" ? (
        <PermissionBadge
          label="Blocked"
          variant="amber"
          tooltip="Notifications are blocked for this site. Re-enable them in your browser's site settings — Tellann cannot ask again."
        />
      ) : state === "subscribed" ? (
        <div className="flex flex-wrap items-center gap-3">
          <PermissionBadge
            label="Enabled on this browser"
            variant="emerald"
            tooltip="This browser will receive push notifications for the categories you allow below."
          />
          <Button type="button" variant="secondary" onClick={() => void onTest()} disabled={busy}>
            Send test
          </Button>
          <Button type="button" variant="ghost" onClick={() => void onDisable()} disabled={busy}>
            Turn off for this browser
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="primary" onClick={() => void onEnable()} disabled={busy || !orgId}>
            {busy ? "Waiting for browser…" : "Enable browser push"}
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
