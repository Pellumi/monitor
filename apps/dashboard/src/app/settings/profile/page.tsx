"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { CheckCircle2, AlertCircle, CreditCard, RefreshCw } from "lucide-react";
import { countries } from "countries-list";
import { authenticatedFetch } from "@/lib/authenticated-fetch";
import { useSession } from "@/components/providers";
import { SettingsPage, SettingsSection } from "@/components/settings/settings-page";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { Avatar } from "@/components/ui/avatar";
import { AVATAR_BACKGROUND_PRESETS, dicebearAvatarUrl } from "@/lib/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ACCEPTED_AVATAR_TYPES = ["image/png", "image/jpeg", "image/webp"];

/** Crop `file` to a centred square and re-encode as a 512px PNG, keeping the upload small. */
async function toSquarePng(file: File, size = 512): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas is unavailable in this browser.");
    const scale = Math.max(size / bitmap.width, size / bitmap.height);
    const drawW = bitmap.width * scale;
    const drawH = bitmap.height * scale;
    ctx.drawImage(bitmap, (size - drawW) / 2, (size - drawH) / 2, drawW, drawH);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Could not process that image."))),
        "image/png",
      ),
    );
  } finally {
    bitmap.close();
  }
}

export default function ProfileSettingsPage() {
  const { user, refetch } = useSession();
  const [displayName, setDisplayName] = useState(() => user?.displayName ?? "");
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [countryCode, setCountryCode] = useState("");
  const [legalName, setLegalName] = useState("");
  const [billingEmail, setBillingEmail] = useState("");
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingSaving, setBillingSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatarBusy, setAvatarBusy] = useState<null | "upload" | "generated" | "remove">(null);
  const [avatarBg, setAvatarBg] = useState("");
  const [avatarSeedSalt, setAvatarSeedSalt] = useState("");
  const generatedAvatarUrl = useMemo(
    () =>
      dicebearAvatarUrl(`${user?.email ?? "tellann"}${avatarSeedSalt ? `-${avatarSeedSalt}` : ""}`, {
        backgroundColor: avatarBg,
      }),
    [user?.email, avatarSeedSalt, avatarBg],
  );
  const countryOptions = useMemo(() => Object.entries(countries)
    .map(([code, country]) => ({ code, name: country.name }))
    .sort((left, right) => left.name.localeCompare(right.name)), []);

  useEffect(() => {
    setDisplayName(user?.displayName ?? "");
  }, [user?.id, user?.displayName]);

  // Billing identity is user-scoped: one profile per account, carried into
  // every organization this user pays for. No organization role gates it.
  useEffect(() => {
    if (!user?.id) return;
    const controller = new AbortController();
    setBillingLoading(true);
    void authenticatedFetch(`/api-gateway/billing/users/me/profile`, { signal: controller.signal })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.message ?? "Unable to load billing profile.");
        if (controller.signal.aborted) return;
        setCountryCode(body?.countryCode ?? "");
        setLegalName(body?.legalName ?? user?.displayName ?? "");
        setBillingEmail(body?.billingEmail ?? user?.email ?? "");
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setNotice({ type: "error", text: error instanceof Error ? error.message : "Unable to load billing profile." });
      })
      .finally(() => { if (!controller.signal.aborted) setBillingLoading(false); });
    return () => controller.abort();
  }, [user?.id, user?.displayName, user?.email]);

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setNotice(null);
    try {
      const response = await authenticatedFetch("/api-gateway/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message ?? "Unable to save profile.");
      await refetch();
      setNotice({ type: "success", text: "Profile saved successfully." });
    } catch (error) {
      setNotice({
        type: "error",
        text: error instanceof Error ? error.message : "Unable to save profile.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function uploadAvatar(file: File) {
    if (!ACCEPTED_AVATAR_TYPES.includes(file.type)) {
      setNotice({ type: "error", text: "Choose a PNG, JPEG or WebP image." });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setNotice({ type: "error", text: "That image is too large. Pick one under 10 MB." });
      return;
    }
    setAvatarBusy("upload");
    setNotice(null);
    try {
      const blob = await toSquarePng(file);
      const response = await authenticatedFetch("/api-gateway/auth/me/avatar", {
        method: "POST",
        headers: { "Content-Type": "image/png" },
        body: blob,
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message ?? "Unable to upload image.");
      await refetch();
      setAvatarSeedSalt("");
      setAvatarBg("");
      setNotice({ type: "success", text: "Profile picture updated." });
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "Unable to upload image." });
    } finally {
      setAvatarBusy(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function saveGeneratedAvatar() {
    setAvatarBusy("generated");
    setNotice(null);
    try {
      const response = await authenticatedFetch("/api-gateway/auth/me/avatar/generated", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarUrl: generatedAvatarUrl }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message ?? "Unable to save avatar.");
      await refetch();
      setNotice({ type: "success", text: "Profile picture updated." });
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "Unable to save avatar." });
    } finally {
      setAvatarBusy(null);
    }
  }

  async function removeAvatar() {
    setAvatarBusy("remove");
    setNotice(null);
    try {
      const response = await authenticatedFetch("/api-gateway/auth/me/avatar", { method: "DELETE" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message ?? "Unable to remove image.");
      await refetch();
      setAvatarSeedSalt("");
      setAvatarBg("");
      setNotice({ type: "success", text: "Profile picture reset to the default." });
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "Unable to remove image." });
    } finally {
      setAvatarBusy(null);
    }
  }

  async function saveBillingProfile(event: FormEvent) {
    event.preventDefault();
    if (!countryCode) return;
    setBillingSaving(true);
    setNotice(null);
    try {
      const response = await authenticatedFetch(`/api-gateway/billing/users/me/profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ countryCode, legalName: legalName.trim() || null, billingEmail: billingEmail.trim() || null }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message ?? "Unable to save billing profile.");
      setNotice({ type: "success", text: "Billing profile saved. Available plans and currency will now reflect this country." });
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "Unable to save billing profile." });
    } finally {
      setBillingSaving(false);
    }
  }

  return (
    <SettingsPage title="Profile" description="Manage the identity associated with your Tellann account." scope="USER">
      {notice ? (
        <div
          role="status"
          className={cn(
            "flex items-center justify-between gap-2.5 rounded-lg border p-3 text-sm transition-colors",
            notice.type === "success"
              ? "border-emerald-500/30 bg-emerald-950/40 text-emerald-300"
              : "border-red-900/60 bg-red-950/40 text-red-300"
          )}
        >
          <div className="flex items-center gap-2.5">
            {notice.type === "success" ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
            )}
            {notice.text}
          </div>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="text-[#8e9192] hover:text-white transition-colors text-xs font-mono uppercase tracking-wider shrink-0 cursor-pointer"
            aria-label="Dismiss"
          >
            Cancel
          </button>
        </div>
      ) : null}
      <SettingsSection
        title="Profile picture"
        description="Shown across Tellann wherever your account appears — the sidebar, member lists and comments."
      >
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start">
          <div className="flex flex-col items-center gap-3">
            <Avatar
              src={user?.avatarUrl}
              name={user?.displayName}
              email={user?.email}
              size={96}
              className="border-neutral-700"
            />
            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={avatarBusy !== null}
                onClick={() => fileInputRef.current?.click()}
              >
                {avatarBusy === "upload" ? "Uploading…" : "Upload image"}
              </Button>
              {user?.hasCustomAvatar ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={avatarBusy !== null}
                  onClick={removeAvatar}
                >
                  {avatarBusy === "remove" ? "Resetting…" : "Reset"}
                </Button>
              ) : null}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_AVATAR_TYPES.join(",")}
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void uploadAvatar(file);
              }}
            />
            <p className="max-w-[13rem] text-center text-[11px] leading-4 text-neutral-500">
              PNG, JPEG or WebP. Centre-cropped to a square automatically.
            </p>
          </div>

          <div className="flex-1 space-y-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
              Or use a generated avatar
            </div>
            <div className="flex items-center gap-4">
              <Avatar
                src={generatedAvatarUrl}
                name={user?.displayName}
                email={user?.email}
                size={64}
                className="border-neutral-700"
              />
              <div className="space-y-2.5">
                <div className="flex flex-wrap gap-1.5">
                  {AVATAR_BACKGROUND_PRESETS.map((preset) => (
                    <button
                      key={preset.value || "transparent"}
                      type="button"
                      title={preset.label}
                      aria-label={preset.label}
                      aria-pressed={avatarBg === preset.value}
                      onClick={() => setAvatarBg(preset.value)}
                      className={cn(
                        "h-6 w-6 rounded-full border transition-colors",
                        avatarBg === preset.value
                          ? "border-white"
                          : "border-neutral-700 hover:border-neutral-500",
                      )}
                      style={{
                        background: preset.value
                          ? `#${preset.value}`
                          : "repeating-conic-gradient(#404040 0% 25%, #262626 0% 50%) 50% / 10px 10px",
                      }}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setAvatarSeedSalt(Math.random().toString(36).slice(2, 8))}
                  className="inline-flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider text-neutral-400 transition-colors hover:text-white"
                >
                  <RefreshCw className="h-3 w-3" />
                  Shuffle
                </button>
              </div>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={avatarBusy !== null}
              onClick={saveGeneratedAvatar}
            >
              {avatarBusy === "generated" ? "Saving…" : "Use this avatar"}
            </Button>
          </div>
        </div>
      </SettingsSection>
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
      <form id="billing-profile" onSubmit={saveBillingProfile} className="scroll-mt-24 space-y-6">
        <SettingsSection title="Billing profile">
          <div className="mb-4 flex gap-3 rounded-lg border border-neutral-800 bg-neutral-950 p-4 text-sm text-neutral-400">
            <CreditCard className="mt-0.5 h-4 w-4 shrink-0 text-neutral-300" />
            <p>Your billing country determines your currency, available plans, and payment provider. It applies to every organization you pay for.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs text-neutral-500 block">
                  Billing country <span className="text-red-400">*</span>
                </label>
                <Select
                  value={countryCode}
                  onValueChange={(val) => setCountryCode(val)}
                >
                  <SelectTrigger disabled={billingLoading || billingSaving} className="w-full bg-neutral-950 border-neutral-800 text-white">
                    <SelectValue placeholder="Select a country">
                      {countryOptions.find((c) => c.code === countryCode)?.name}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {countryOptions.map((country) => (
                      <SelectItem key={country.code} value={country.code}>
                        {country.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <label className="text-xs text-neutral-500">
                Legal name on invoices
                <input value={legalName} onChange={(event) => setLegalName(event.target.value)} disabled={billingLoading || billingSaving} className="mt-1.5 w-full rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-white outline-none focus:border-white disabled:opacity-50" />
              </label>
              <label className="text-xs text-neutral-500 md:col-span-2">
                Billing email
                <input type="email" value={billingEmail} onChange={(event) => setBillingEmail(event.target.value)} disabled={billingLoading || billingSaving} className="mt-1.5 w-full rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-white outline-none focus:border-white disabled:opacity-50" />
              </label>
          </div>
        </SettingsSection>
        <div className="flex justify-end">
          <Button type="submit" variant="primary" disabled={billingLoading || billingSaving || !countryCode}>
            {billingSaving ? "Saving…" : "Save billing profile"}
          </Button>
        </div>
      </form>
    </SettingsPage>
  );
}

function ReadOnly({ label, value }: { label: string; value: string }) {
  return <div><div className="text-xs text-neutral-500">{label}</div><div className="mt-1.5 rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-neutral-300">{value}</div></div>;
}
