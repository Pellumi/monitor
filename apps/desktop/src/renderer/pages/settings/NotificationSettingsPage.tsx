import { useEffect, useState } from "react";
import type { NotificationCategory, NotificationFrequency, NotificationPreference } from "@tellann/desktop-contracts";
import { Page, LoadingState, EmptyState } from "../../pages";
import { Switch } from "../../components/ui/switch";
import { SelectField } from "../../components/ui/select";
import { formatEnum } from "../../components/desktop-ui";
import { useActiveOrganization } from "./use-active-organization";
import { OrganizationSwitcher } from "./organization-switcher";
import { Bell } from "lucide-react";

const BATCHABLE: NotificationCategory[] = ["ALERTS", "REPORTS", "DIGEST"];
const FREQUENCY_OPTIONS: { value: NotificationFrequency; label: string }[] = [
  { value: "IMMEDIATE", label: "Immediately" },
  { value: "DAILY_DIGEST", label: "Daily digest" },
  { value: "WEEKLY_DIGEST", label: "Weekly digest" },
  { value: "NEVER", label: "Never" },
];

export function NotificationSettingsPage() {
  const { organizationId, organizations, setOrganizationId } = useActiveOrganization();
  const [preferences, setPreferences] = useState<NotificationPreference[] | null>(null);
  const [savingCategory, setSavingCategory] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!organizationId) return;
    let cancelled = false;
    setPreferences(null);
    window.tellann?.notifications
      .preferences(organizationId)
      .then((rows) => {
        if (!cancelled) setPreferences(rows);
      })
      .catch((err) => !cancelled && setError(String((err as Error)?.message ?? err)));
    return () => {
      cancelled = true;
    };
  }, [organizationId]);

  const update = async (category: string, patch: Partial<NotificationPreference>) => {
    if (!organizationId) return;
    setSavingCategory(category);
    try {
      const updated = await window.tellann!.notifications.updatePreference(organizationId, category, patch);
      setPreferences((current) => current?.map((item) => (item.category === category ? updated : item)) ?? current);
    } catch (err) {
      setError(String((err as Error)?.message ?? err));
    } finally {
      setSavingCategory(null);
    }
  };

  return (
    <Page
      title="Notifications"
      description="Choose how Tellann reaches you: in this app, on your desktop, or by email."
      toolbar={<OrganizationSwitcher organizations={organizations} organizationId={organizationId} onChange={setOrganizationId} />}
    >
      {error ? (
        <div className="inline-error">
          <span>{error}</span>
        </div>
      ) : null}

      {!preferences ? (
        <LoadingState />
      ) : preferences.length ? (
        <div className="stack">
          {preferences.map((pref) => (
            <section className="content-card" key={pref.category}>
              <header className="settings-row-head">
                <h2>{formatEnum(pref.category)}</h2>
                {savingCategory === pref.category ? <span className="muted">Saving…</span> : null}
              </header>

              <div className="settings-toggle-grid">
                <label className="settings-toggle">
                  <Switch
                    checked={pref.inAppEnabled}
                    onCheckedChange={(checked) => update(pref.category, { inAppEnabled: checked })}
                    disabled={savingCategory === pref.category}
                  />
                  <span>In-app</span>
                </label>
                <label className="settings-toggle">
                  <Switch
                    checked={pref.desktopEnabled}
                    onCheckedChange={(checked) => update(pref.category, { desktopEnabled: checked })}
                    disabled={savingCategory === pref.category}
                  />
                  <span>Desktop notification</span>
                </label>
                {pref.capability.emailSupported ? (
                  <label className="settings-toggle">
                    <Switch
                      checked={pref.emailEnabled}
                      onCheckedChange={(checked) => update(pref.category, { emailEnabled: checked })}
                      disabled={savingCategory === pref.category || pref.capability.emailLocked}
                    />
                    <span>Email{pref.capability.emailLocked ? " (always on)" : ""}</span>
                  </label>
                ) : null}
              </div>

              {BATCHABLE.includes(pref.category) ? (
                <div className="settings-field-row">
                  <span className="muted">Frequency</span>
                  <SelectField
                    ariaLabel={`${pref.category} frequency`}
                    value={pref.frequency}
                    onValueChange={(value) => update(pref.category, { frequency: value as NotificationFrequency })}
                    options={FREQUENCY_OPTIONS}
                    disabled={savingCategory === pref.category}
                  />
                </div>
              ) : null}
            </section>
          ))}

          <section className="content-card">
            <h2>Quiet hours</h2>
            <p className="muted">Applies across every category above.</p>
            <div className="settings-toggle-grid">
              <label className="settings-toggle">
                <Switch
                  checked={preferences[0]?.quietHoursEnabled ?? false}
                  onCheckedChange={(checked) =>
                    Promise.all(preferences.map((p) => update(p.category, { quietHoursEnabled: checked })))
                  }
                />
                <span>Enable quiet hours</span>
              </label>
              <label className="settings-toggle">
                <Switch
                  checked={preferences[0]?.criticalOverridesQuietHours ?? true}
                  onCheckedChange={(checked) =>
                    Promise.all(preferences.map((p) => update(p.category, { criticalOverridesQuietHours: checked })))
                  }
                />
                <span>Critical alerts override quiet hours</span>
              </label>
            </div>
          </section>
        </div>
      ) : (
        <EmptyState icon={<Bell size={28} />} title="No preferences yet" description="Notification preferences will appear here once your organization has been set up." />
      )}
    </Page>
  );
}
