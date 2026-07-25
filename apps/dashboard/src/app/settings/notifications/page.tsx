"use client";

import { useCallback, useEffect, useState } from "react";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { authenticatedFetch } from "@/lib/authenticated-fetch";
import { useSession } from "@/components/providers";
import { SettingsPage, SettingsSection, SettingsToggle } from "@/components/settings/settings-page";

type NotificationPreference = {
  category: string;
  emailEnabled: boolean;
  inAppEnabled: boolean;
  frequency: string;
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
    setPreferences((items) => items.map((item) => item.category === category ? next : item));
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
    } else {
      setMessage("Notification preference saved.");
    }
  }

  return (
    <SettingsPage title="Notifications" description="Control in-app and email delivery for implemented Tellann events." scope="USER">
      {message ? <div className="rounded-md border border-neutral-800 bg-neutral-950 p-3 text-sm text-neutral-300">{message}</div> : null}
      {!selectedOrgId ? <div className="text-sm text-neutral-500">Select an organisation to manage its subscriptions.</div> : null}
      <div className="space-y-4">
        {preferences.map((preference) => (
          <SettingsSection key={preference.category} title={formatCategory(preference.category)}>
            <div className="divide-y divide-neutral-800">
              <SettingsToggle label="In-app notifications" checked={preference.inAppEnabled} onChange={(checked) => void update(preference.category, { inAppEnabled: checked })} />
              <SettingsToggle label="Email notifications" checked={preference.emailEnabled} disabled={["SECURITY", "BILLING", "COMPLIANCE"].includes(preference.category)} onChange={(checked) => void update(preference.category, { emailEnabled: checked })} />
            </div>
            <div className="mt-4">
              <span className="block text-xs text-neutral-500 mb-1.5">Delivery frequency</span>
              <Select
                value={preference.frequency}
                onValueChange={(value) => void update(preference.category, { frequency: value })}
              >
                <SelectTrigger className="w-full max-w-xs">
                  <SelectValue placeholder="Select frequency...">
                    {preference.frequency === "IMMEDIATE" && "Instant"}
                    {preference.frequency === "DAILY_DIGEST" && "Daily digest"}
                    {preference.frequency === "WEEKLY_DIGEST" && "Weekly digest"}
                    {preference.frequency === "NEVER" && "Never"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="IMMEDIATE">Instant</SelectItem>
                  <SelectItem value="DAILY_DIGEST">Daily digest</SelectItem>
                  <SelectItem value="WEEKLY_DIGEST">Weekly digest</SelectItem>
                  <SelectItem value="NEVER">Never</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </SettingsSection>
        ))}
      </div>
    </SettingsPage>
  );
}

function formatCategory(value: string) {
  return value.toLowerCase().replaceAll("_", " ").replace(/^\w/, (letter) => letter.toUpperCase());
}
