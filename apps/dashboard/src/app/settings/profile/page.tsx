"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { CheckCircle2, AlertCircle, CreditCard } from "lucide-react";
import { countries } from "countries-list";
import { authenticatedFetch } from "@/lib/authenticated-fetch";
import { useSession } from "@/components/providers";
import { SettingsPage, SettingsSection } from "@/components/settings/settings-page";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
