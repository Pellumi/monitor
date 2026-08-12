"use client";

import { useEffect, useState, type FormEvent } from "react";
import { authenticatedFetch } from "@/lib/authenticated-fetch";
import { useSession } from "@/components/providers";
import { SettingsPage, SettingsSection } from "@/components/settings/settings-page";
import { Button } from "@/components/ui/button";

export default function ProfileSettingsPage() {
  const { user, refetch } = useSession();
  const [displayName, setDisplayName] = useState(() => user?.displayName ?? "");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDisplayName(user?.displayName ?? "");
  }, [user?.id, user?.displayName]);

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const response = await authenticatedFetch("/api-gateway/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message ?? "Unable to save profile.");
      await refetch();
      setMessage("Profile saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save profile.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SettingsPage title="Profile" description="Manage the identity associated with your Tellann account." scope="USER">
      {message ? <div className="rounded-md border border-neutral-800 bg-neutral-950 p-3 text-sm text-neutral-300">{message}</div> : null}
      <form onSubmit={save} className="space-y-6">
        <SettingsSection title="Account information">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-xs text-neutral-500">
              Display name
              <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} className="mt-1.5 w-full rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-white" />
            </label>
            <ReadOnly label="Email address" value={user?.email ?? "—"} />
            <ReadOnly label="Email verification" value="Verified by sign-in" />
            <ReadOnly label="Preferred authentication" value={user?.preferredAuthMode === "PASSWORD" ? "Email and password" : "Email one-time code"} />
          </div>
        </SettingsSection>
        <div className="flex justify-end">
          <Button type="submit" variant="primary" disabled={saving || !displayName.trim()}>
            {saving ? "Saving…" : "Save profile"}
          </Button>
        </div>
      </form>
    </SettingsPage>
  );
}

function ReadOnly({ label, value }: { label: string; value: string }) {
  return <div><div className="text-xs text-neutral-500">{label}</div><div className="mt-1.5 rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-neutral-300">{value}</div></div>;
}
