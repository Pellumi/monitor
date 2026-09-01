"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Globe2, Loader2, Plus, Save, ShieldCheck, Star, Trash2, X } from "lucide-react";
import { useSession } from "@/components/providers";
import { PermissionNotice, SettingsPage, SettingsSection, UpgradeNotice } from "@/components/settings/settings-page";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { authenticatedFetch } from "@/lib/authenticated-fetch";

type Application = { id: string; name: string };
type EnvironmentType = "DEVELOPMENT" | "STAGING" | "PRODUCTION";
type Environment = {
  id: string;
  name: string;
  type: EnvironmentType;
  baseUrl: string | null;
  isDefault: boolean;
  sdkEnabled: boolean;
};
type Entitlement = {
  planType: string;
  features: Record<string, boolean | string>;
  limits: { maxEnvironmentsPerApp?: number };
};

function messageFrom(body: unknown, fallback: string) {
  if (body && typeof body === "object") {
    const value = body as { error?: string; message?: string };
    return value.message || value.error || fallback;
  }
  return fallback;
}

function EnvironmentsSettingsContent() {
  const { selectedOrgId, memberships } = useSession();
  const role = memberships.find((m) => m.organization.id === selectedOrgId)?.role;
  const canManage = role === "OWNER" || role === "ADMIN";
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [applications, setApplications] = useState<Application[]>([]);
  const [applicationId, setApplicationId] = useState("");
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [entitlement, setEntitlement] = useState<Entitlement | null>(null);
  const [drafts, setDrafts] = useState<Record<string, { name: string; baseUrl: string }>>({});
  const [newType, setNewType] = useState<Exclude<EnvironmentType, "DEVELOPMENT">>("STAGING");
  const [newName, setNewName] = useState("Staging");
  const [newBaseUrl, setNewBaseUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [rowBusyId, setRowBusyId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadEnvironments = useCallback(async (appId: string) => {
    const response = await authenticatedFetch(`/api-gateway/applications/${appId}/environments`, { cache: "no-store" });
    const body = await response.json().catch(() => []);
    if (!response.ok) throw new Error(messageFrom(body, "Unable to load environments."));
    const items = body as Environment[];
    setEnvironments(items);
    setDrafts(Object.fromEntries(items.map((item) => [item.id, { name: item.name, baseUrl: item.baseUrl ?? "" }])));
  }, []);

  useEffect(() => {
    if (!selectedOrgId) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    void Promise.all([
      authenticatedFetch(`/api-gateway/organizations/${selectedOrgId}/applications`, { cache: "no-store" }),
      authenticatedFetch(`/api-gateway/organizations/${selectedOrgId}/entitlement`, { cache: "no-store" }),
    ]).then(async ([appsResponse, entitlementResponse]) => {
      const [appsBody, entitlementBody] = await Promise.all([
        appsResponse.json().catch(() => []),
        entitlementResponse.json().catch(() => null),
      ]);
      if (!appsResponse.ok) throw new Error(messageFrom(appsBody, "Unable to load applications."));
      if (!entitlementResponse.ok) throw new Error(messageFrom(entitlementBody, "Unable to load plan access."));
      if (cancelled) return;
      const nextApplications = appsBody as Application[];
      const requestedId = searchParams.get("appId");
      const nextId = nextApplications.some((item) => item.id === requestedId) ? requestedId! : nextApplications[0]?.id ?? "";
      setApplications(nextApplications);
      setEntitlement(entitlementBody as Entitlement);
      setApplicationId(nextId);
    }).catch((reason) => {
      if (!cancelled) setError(reason instanceof Error ? reason.message : "Unable to load environment settings.");
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [searchParams, selectedOrgId]);

  useEffect(() => {
    if (!applicationId) {
      setEnvironments([]);
      return;
    }
    setError("");
    void loadEnvironments(applicationId).catch((reason) => {
      setError(reason instanceof Error ? reason.message : "Unable to load environments.");
    });
  }, [applicationId, loadEnvironments]);

  function selectApplication(nextId: string) {
    setApplicationId(nextId);
    const params = new URLSearchParams(searchParams.toString());
    params.set("appId", nextId);
    params.delete("envId");
    router.replace(`/settings/environments?${params.toString()}`);
  }

  async function refreshAfterChange() {
    await loadEnvironments(applicationId);
    await queryClient.invalidateQueries({ queryKey: ["sidebar-envs", applicationId] });
  }

  async function saveEnvironment(environment: Environment) {
    const draft = drafts[environment.id];
    if (!draft) return;
    setSavingId(environment.id);
    setError("");
    setNotice("");
    try {
      const response = await authenticatedFetch(`/api-gateway/environments/${environment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: draft.name, baseUrl: draft.baseUrl }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(messageFrom(body, "Unable to save environment."));
      await refreshAfterChange();
      setNotice(`${draft.name} was updated.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to save environment.");
    } finally {
      setSavingId(null);
    }
  }

  async function patchEnvironment(environment: Environment, patch: Record<string, unknown>, success: string) {
    setRowBusyId(environment.id);
    setError("");
    setNotice("");
    try {
      const response = await authenticatedFetch(`/api-gateway/environments/${environment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(messageFrom(body, "Unable to update environment."));
      await refreshAfterChange();
      setNotice(success);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to update environment.");
    } finally {
      setRowBusyId(null);
    }
  }

  async function deleteEnvironment(environment: Environment) {
    setRowBusyId(environment.id);
    setError("");
    setNotice("");
    try {
      const response = await authenticatedFetch(`/api-gateway/environments/${environment.id}`, { method: "DELETE" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(messageFrom(body, "Unable to delete environment."));
      setConfirmDeleteId(null);
      await refreshAfterChange();
      setNotice(`${environment.name} was deleted.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to delete environment.");
    } finally {
      setRowBusyId(null);
    }
  }

  async function createEnvironment() {
    if (!applicationId) return;
    setCreating(true);
    setError("");
    setNotice("");
    try {
      const response = await authenticatedFetch(`/api-gateway/applications/${applicationId}/environments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName, type: newType, baseUrl: newBaseUrl }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(messageFrom(body, "Unable to create environment."));
      await refreshAfterChange();
      setNewBaseUrl("");
      setNotice(`${newName.trim()} was created.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to create environment.");
    } finally {
      setCreating(false);
    }
  }

  const environmentLimit = entitlement?.limits.maxEnvironmentsPerApp ?? 1;
  const planSupportsMultiple = environmentLimit > 1;
  const withinLimit = environments.length < environmentLimit;
  const canCreate = canManage && planSupportsMultiple && withinLimit;

  return (
    <SettingsPage title="Environments" description="Keep development, staging, and production traffic isolated and give each target a trusted browser base URL." scope="APPLICATION">
      {applications.length > 1 ? (
        <SettingsSection title="Application" description="Environment configuration is scoped to one application.">
          <Select value={applicationId} onValueChange={selectApplication}>
            <SelectTrigger className="max-w-md"><SelectValue placeholder="Select an application">{applications.find((item) => item.id === applicationId)?.name}</SelectValue></SelectTrigger>
            <SelectContent>{applications.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent>
          </Select>
        </SettingsSection>
      ) : null}

      {!canManage ? (
        <PermissionNotice>You can view environment configuration, but only an Owner or Admin can add, edit, or delete environments.</PermissionNotice>
      ) : null}

      {error ? (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-lg border border-red-900/60 bg-red-950/20 px-4 py-3 text-sm text-red-200">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError("")}
            className="inline-flex items-center gap-1 text-xs font-medium text-red-400 hover:text-white transition-colors shrink-0 cursor-pointer"
            aria-label="Dismiss error"
          >
            <X className="h-4 w-4" />
            <span>Dismiss</span>
          </button>
        </div>
      ) : null}
      {notice ? (
        <div role="status" className="flex items-center justify-between gap-3 rounded-lg border border-emerald-900/60 bg-emerald-950/20 px-4 py-3 text-sm text-emerald-200">
          <span>{notice}</span>
          <button
            type="button"
            onClick={() => setNotice("")}
            className="inline-flex items-center gap-1 text-xs font-medium text-emerald-400 hover:text-white transition-colors shrink-0 cursor-pointer"
            aria-label="Dismiss notice"
          >
            <X className="h-4 w-4" />
            <span>Dismiss</span>
          </button>
        </div>
      ) : null}

      <SettingsSection title="Configured environments" description={`${environments.length} of ${environmentLimit} environment slots used on the ${entitlement?.planType ?? "current"} plan.`}>
        {loading ? <div className="flex items-center gap-2 py-8 text-sm text-neutral-500"><Loader2 className="h-4 w-4 animate-spin" />Loading environment settings…</div> : null}
        {!loading && applications.length === 0 ? <p className="py-6 text-sm text-neutral-500">Create an application before configuring environments.</p> : null}
        <div className="space-y-4">
          {environments.map((environment) => {
            const draft = drafts[environment.id] ?? { name: environment.name, baseUrl: environment.baseUrl ?? "" };
            const production = environment.type === "PRODUCTION";
            const rowBusy = rowBusyId === environment.id;
            return (
              <article key={environment.id} className="rounded-xl border border-neutral-800 bg-neutral-950 p-5">
                <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg border border-neutral-800 bg-black p-2 text-neutral-300"><Globe2 className="h-4 w-4" /></div>
                    <div><h3 className="text-sm font-semibold text-white">{environment.name}</h3><p className="mt-1 text-xs text-neutral-500">{environment.type}{environment.isDefault ? " · default" : ""}</p></div>
                  </div>
                  {production ? <span className="inline-flex items-center gap-1.5 rounded-full border border-neutral-700 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-300"><ShieldCheck className="h-3 w-3" />Observation only</span> : null}
                </div>
                <div className="grid gap-4 md:grid-cols-[minmax(180px,.6fr)_minmax(280px,1fr)_auto] md:items-end">
                  <label className="space-y-2"><span className="text-xs font-medium text-neutral-400">Name</span><input value={draft.name} maxLength={80} disabled={!canManage} onChange={(event) => setDrafts((current) => ({ ...current, [environment.id]: { ...draft, name: event.target.value } }))} className="h-10 w-full rounded-md border border-neutral-800 bg-black px-3 text-sm text-white outline-none transition focus:border-white disabled:opacity-50" /></label>
                  <label className="space-y-2"><span className="text-xs font-medium text-neutral-400">Base URL</span><input type="url" value={draft.baseUrl} disabled={!canManage} placeholder={production ? "https://app.example.com" : "http://localhost:3000"} onChange={(event) => setDrafts((current) => ({ ...current, [environment.id]: { ...draft, baseUrl: event.target.value } }))} className="h-10 w-full rounded-md border border-neutral-800 bg-black px-3 text-sm text-white outline-none transition focus:border-white disabled:opacity-50" /></label>
                  <Button onClick={() => void saveEnvironment(environment)} disabled={!canManage || savingId !== null || rowBusy || !draft.name.trim()}><Save className="h-4 w-4" />Save</Button>
                </div>
                {production ? <p className="mt-3 text-xs leading-5 text-neutral-500">Production requires HTTPS. Tellann blocks process launch, instrumentation, automated interaction, and form submission for this environment.</p> : null}

                {canManage ? (
                  <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-neutral-900 pt-4">
                    <div className="flex items-center gap-2">
                      <Switch checked={environment.sdkEnabled} disabled={rowBusy} onCheckedChange={(next) => void patchEnvironment(environment, { sdkEnabled: next }, `${environment.name} SDK ingestion ${next ? "enabled" : "disabled"}.`)} />
                      <span className="text-xs text-neutral-400">SDK ingestion {environment.sdkEnabled ? "enabled" : "disabled"}</span>
                    </div>
                    {environment.isDefault ? (
                      <span className="inline-flex items-center gap-1.5 text-xs text-neutral-500"><Star className="h-3.5 w-3.5 fill-current" />Application default</span>
                    ) : (
                      <button type="button" onClick={() => void patchEnvironment(environment, { isDefault: true }, `${environment.name} is now the application default.`)} disabled={rowBusy} className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-400 hover:text-white transition-colors disabled:opacity-50 cursor-pointer"><Star className="h-3.5 w-3.5" />Make default</button>
                    )}
                    {environment.isDefault ? null : confirmDeleteId === environment.id ? (
                      <span className="inline-flex items-center gap-2 text-xs text-neutral-400">
                        Delete {environment.name}?
                        <button type="button" onClick={() => void deleteEnvironment(environment)} disabled={rowBusy} className="font-semibold text-red-400 hover:text-red-300 disabled:opacity-50 cursor-pointer">Confirm</button>
                        <button type="button" onClick={() => setConfirmDeleteId(null)} disabled={rowBusy} className="text-neutral-500 hover:text-white cursor-pointer">Cancel</button>
                      </span>
                    ) : (
                      <button type="button" onClick={() => { setConfirmDeleteId(environment.id); setError(""); setNotice(""); }} disabled={rowBusy} className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-400 hover:text-red-300 transition-colors disabled:opacity-50 cursor-pointer"><Trash2 className="h-3.5 w-3.5" />Delete</button>
                    )}
                    {rowBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin text-neutral-500" /> : null}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      </SettingsSection>

      <SettingsSection title="Add environment" description="Staging and production targets are available when your plan includes multiple environments.">
        {!planSupportsMultiple ? (
          <UpgradeNotice>Multiple environments start on the Solo plan. Your automatic Development environment remains fully configurable.</UpgradeNotice>
        ) : !canManage ? (
          <PermissionNotice>Only an Owner or Admin can add environments.</PermissionNotice>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <label className="space-y-2"><span className="text-xs font-medium text-neutral-400">Type</span><Select value={newType} onValueChange={(value) => { const type = value as typeof newType; setNewType(type); setNewName(type === "STAGING" ? "Staging" : "Production"); }}><SelectTrigger><SelectValue placeholder="Select type">{newType === "STAGING" ? "Staging" : "Production"}</SelectValue></SelectTrigger><SelectContent><SelectItem value="STAGING">Staging</SelectItem><SelectItem value="PRODUCTION">Production</SelectItem></SelectContent></Select></label>
              <label className="space-y-2"><span className="text-xs font-medium text-neutral-400">Name</span><input value={newName} maxLength={80} onChange={(event) => setNewName(event.target.value)} className="h-10 w-full rounded-md border border-neutral-800 bg-black px-3 text-sm text-white outline-none transition focus:border-white" /></label>
              <label className="space-y-2"><span className="text-xs font-medium text-neutral-400">Base URL</span><input type="url" value={newBaseUrl} placeholder={newType === "PRODUCTION" ? "https://app.example.com" : "https://staging.example.com"} onChange={(event) => setNewBaseUrl(event.target.value)} className="h-10 w-full rounded-md border border-neutral-800 bg-black px-3 text-sm text-white outline-none transition focus:border-white" /></label>
            </div>
            <Button variant="primary" onClick={() => void createEnvironment()} disabled={!canCreate || creating || !newName.trim()} loading={creating}><Plus className="h-4 w-4" />Add environment</Button>
            {!withinLimit ? <p className="text-xs text-neutral-500">This application has reached its {environmentLimit}-environment plan limit.</p> : null}
          </div>
        )}
      </SettingsSection>
    </SettingsPage>
  );
}

export default function EnvironmentsSettingsPage() {
  return <Suspense fallback={<div className="flex items-center gap-2 text-sm text-neutral-500"><Loader2 className="h-4 w-4 animate-spin" />Loading environment settings…</div>}><EnvironmentsSettingsContent /></Suspense>;
}
