"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { authenticatedFetch } from "@/lib/authenticated-fetch";
import {
  SettingsPage,
  SettingsSection,
  SettingsToggle,
} from "@/components/settings/settings-page";

type Preferences = {
  theme: string;
  density: string;
  sidebarCollapsed: boolean;
  reducedMotion: boolean;
  highContrast: boolean;
  tablePageSize: number;
  persistFilters: boolean;
  defaultLandingPage: string;
  rememberLastApplication: boolean;
  rememberLastEnvironment: boolean;
  reportsOpenInNewTab: boolean;
  version: number;
};

export default function PreferencesPage() {
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    authenticatedFetch("/api-gateway/auth/preferences")
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load preferences.");
        return response.json() as Promise<Preferences>;
      })
      .then((data) => {
        if (!cancelled) setPreferences(data);
      })
      .catch((error: Error) => {
        if (!cancelled) setMessage(error.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function update<K extends keyof Preferences>(key: K, value: Preferences[K]) {
    setPreferences((current) =>
      current ? { ...current, [key]: value } : current,
    );
  }

  async function save() {
    if (!preferences) return;
    setSaving(true);
    setMessage("");
    try {
      const response = await authenticatedFetch(
        "/api-gateway/auth/preferences",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(preferences),
        },
      );
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.message ?? "Unable to save preferences.");
      setPreferences(body);
      setMessage("Preferences saved.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to save preferences.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <SettingsPage
      title="Preferences"
      description="Choose how Tellann looks, navigates, and presents behavioural evidence."
      scope="USER"
    >
      {message ? (
        <div className="rounded-md border border-neutral-800 bg-neutral-950 p-3 text-sm text-neutral-300">
          {message}
        </div>
      ) : null}
      {!preferences ? (
        <div className="text-sm text-neutral-500">Loading preferences…</div>
      ) : (
        <>
          <SettingsSection
            title="Interface"
            description="Visual and interaction defaults for this account."
          >
            <div className="grid gap-4 md:grid-cols-3">
              <SelectField
                label="Theme"
                value={preferences.theme}
                onChange={(value) => update("theme", value)}
                displayValue={
                  preferences.theme === "SYSTEM"
                    ? "System"
                    : preferences.theme === "LIGHT"
                      ? "Light"
                      : "Dark"
                }
              >
                <SelectItem value="SYSTEM">System</SelectItem>
                <SelectItem value="LIGHT">Light</SelectItem>
                <SelectItem value="DARK">Dark</SelectItem>
              </SelectField>
              <SelectField
                label="Density"
                value={preferences.density}
                onChange={(value) => update("density", value)}
                displayValue={
                  preferences.density === "COMFORTABLE"
                    ? "Comfortable"
                    : "Compact"
                }
              >
                <SelectItem value="COMFORTABLE">Comfortable</SelectItem>
                <SelectItem value="COMPACT">Compact</SelectItem>
              </SelectField>
              <SelectField
                label="Table page size"
                value={String(preferences.tablePageSize)}
                onChange={(value) => update("tablePageSize", Number(value))}
                displayValue={String(preferences.tablePageSize)}
              >
                {[10, 25, 50, 100].map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
              </SelectField>
            </div>
            <div className="mt-4 divide-y divide-neutral-800">
              <SettingsToggle
                label="Reduced motion"
                checked={preferences.reducedMotion}
                onChange={(value) => update("reducedMotion", value)}
              />
              <SettingsToggle
                label="High contrast"
                checked={preferences.highContrast}
                onChange={(value) => update("highContrast", value)}
              />
              <SettingsToggle
                label="Persist filters"
                checked={preferences.persistFilters}
                onChange={(value) => update("persistFilters", value)}
              />
            </div>
          </SettingsSection>
          <SettingsSection
            title="Navigation"
            description="Control where Tellann returns you between visits."
          >
            <div className="divide-y divide-neutral-800">
              <SettingsToggle
                label="Remember last application"
                checked={preferences.rememberLastApplication}
                onChange={(value) => update("rememberLastApplication", value)}
              />
              <SettingsToggle
                label="Remember last environment"
                checked={preferences.rememberLastEnvironment}
                onChange={(value) => update("rememberLastEnvironment", value)}
              />
              <SettingsToggle
                label="Open reports in a new tab"
                checked={preferences.reportsOpenInNewTab}
                onChange={(value) => update("reportsOpenInNewTab", value)}
              />
            </div>
          </SettingsSection>
          <div className="flex justify-end">
            <Button
              type="button"
              variant="primary"
              onClick={save}
              disabled={saving}
            >
              {saving ? "Saving…" : "Save preferences"}
            </Button>
          </div>
        </>
      )}
    </SettingsPage>
  );
}

function SelectField({
  label,
  value,
  onChange,
  displayValue,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  displayValue: string;
  children: ReactNode;
}) {
  return (
    <div className="block">
      <span className="mb-1.5 block text-xs font-semibold text-neutral-400">
        {label}
      </span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Select...">{displayValue}</SelectValue>
        </SelectTrigger>
        <SelectContent>{children}</SelectContent>
      </Select>
    </div>
  );
}
