"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { authenticatedFetch } from "@/lib/authenticated-fetch";
import { useTheme } from "@/components/theme-provider";
import { usePreferences } from "@/components/preferences-provider";
import { normalizeThemePreference, type ThemePreference } from "@/lib/theme";
import {
  applyDisplayPreferences,
  normalizePreferences,
  TABLE_PAGE_SIZES,
  type Density,
  type Preferences,
} from "@/lib/preferences";
import {
  SettingsPage,
  SettingsSection,
  SettingsToggle,
} from "@/components/settings/settings-page";


export default function PreferencesPage() {
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const { setTheme } = useTheme();
  const { preferences: savedPreferences, applyPreferences } = usePreferences();
  // Read in an unmount cleanup, so it must not be a stale render's copy.
  const savedPreferencesRef = useRef(savedPreferences);
  useEffect(() => {
    savedPreferencesRef.current = savedPreferences;
  }, [savedPreferences]);
  // The theme the account is known to hold, so a failed save can be undone.
  // `useTheme().theme` is unusable here: previewing a choice already moved it.
  const persistedTheme = useRef<ThemePreference | null>(null);

  useEffect(() => {
    let cancelled = false;
    authenticatedFetch("/api-gateway/auth/preferences")
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load preferences.");
        return response.json();
      })
      .then((data) => {
        if (cancelled) return;
        const loaded = normalizePreferences(data);
        setPreferences(loaded);
        persistedTheme.current = loaded.theme;
        // The stored preferences win over whatever this device had cached.
        setTheme(loaded.theme);
        applyPreferences(loaded);
      })
      .catch((error: Error) => {
        if (!cancelled) setMessage(error.message);
      });
    return () => {
      cancelled = true;
    };
  }, [setTheme, applyPreferences]);

  function update<K extends keyof Preferences>(key: K, value: Preferences[K]) {
    setPreferences((current) =>
      current ? { ...current, [key]: value } : current,
    );
  }

  // Preview density, motion and contrast against the whole app as they are
  // picked, for the same reason the theme select previews itself.
  useEffect(() => {
    if (preferences) applyDisplayPreferences(preferences);
  }, [preferences]);

  // Leaving without saving must not leave the preview behind.
  useEffect(
    () => () => applyDisplayPreferences(savedPreferencesRef.current),
    [],
  );

  /**
   * Repaints the app as soon as a theme is picked, so the select previews the
   * choice instead of describing it. `save` still persists it to the account.
   */
  function updateTheme(value: string) {
    const preference = normalizeThemePreference(value);
    update("theme", preference);
    setTheme(preference);
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
      const saved = normalizePreferences(body);
      setPreferences(saved);
      persistedTheme.current = saved.theme;
      setTheme(saved.theme);
      // Push to the provider so the rest of the app picks up density, page size,
      // motion and contrast without a reload.
      applyPreferences(saved);
      setMessage("Preferences saved.");
    } catch (error) {
      // The preview already repainted the app; put it back so what is on screen
      // matches what the account actually stores.
      if (persistedTheme.current) {
        setTheme(persistedTheme.current);
        update("theme", persistedTheme.current);
      }
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
                description="System follows your operating system setting."
                value={preferences.theme}
                onChange={updateTheme}
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
                description="Compact tightens spacing throughout the interface."
                value={preferences.density}
                onChange={(value) =>
                  update("density", value === "COMPACT" ? "COMPACT" : ("COMFORTABLE" as Density))
                }
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
                description="Rows per page in sessions and audit logs."
                value={String(preferences.tablePageSize)}
                onChange={(value) => update("tablePageSize", Number(value))}
                displayValue={String(preferences.tablePageSize)}
              >
                {TABLE_PAGE_SIZES.map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
              </SelectField>
            </div>
            <div className="mt-4 divide-y divide-neutral-800">
              <SettingsToggle
                label="Reduced motion"
                description="Suppress animations and transitions across the interface."
                checked={preferences.reducedMotion}
                onChange={(value) => update("reducedMotion", value)}
              />
              <SettingsToggle
                label="High contrast"
                description="Strengthen borders and muted text for easier reading."
                checked={preferences.highContrast}
                onChange={(value) => update("highContrast", value)}
              />
              <SettingsToggle
                label="Persist filters"
                description="Keep list filters, such as audit log actions, between visits."
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
                description="Return to the application you were last working in instead of the first one."
                checked={preferences.rememberLastApplication}
                onChange={(value) => update("rememberLastApplication", value)}
              />
              <SettingsToggle
                label="Remember last environment"
                description="Return to the environment you last selected for that application."
                checked={preferences.rememberLastEnvironment}
                onChange={(value) => update("rememberLastEnvironment", value)}
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
  description,
  value,
  onChange,
  displayValue,
  children,
}: {
  label: string;
  description?: string;
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
      {description ? (
        <span className="mt-1.5 block text-xs leading-5 text-neutral-500">
          {description}
        </span>
      ) : null}
    </div>
  );
}
