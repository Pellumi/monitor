"use client";

import { useEffect, useState } from "react";
import { authenticatedFetch } from "@/lib/authenticated-fetch";
import { useSession } from "@/components/providers";
import { SettingsPage, SettingsSection, UpgradeNotice } from "@/components/settings/settings-page";
import { AlertTriangle, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type Usage = { metric: string; value: number; limit: number | null; percent: number };
type Application = { id: string; name: string; createdAt?: string };
type ErrorInfo = { title: string; detail: string } | null;

function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function formatMetricDisplay(item: Usage) {
  if (item.metric === "STORAGE_GB") {
    const bytesValue = item.value * 1024 * 1024 * 1024;
    const bytesLimit = item.limit ? item.limit * 1024 * 1024 * 1024 : null;
    return {
      label: "STORAGE USED",
      valueDisplay: formatBytes(bytesValue),
      limitDisplay: bytesLimit ? formatBytes(bytesLimit) : "Unlimited",
    };
  }

  return {
    label: item.metric.replaceAll("_", " "),
    valueDisplay: String(item.value),
    limitDisplay: item.limit !== null ? String(item.limit) : "Unlimited",
  };
}

export default function DataSettingsPage() {
  const { selectedOrgId } = useSession();
  const [usage, setUsage] = useState<Usage[]>([]);
  const [plan, setPlan] = useState("");
  const [apps, setApps] = useState<Application[]>([]);
  const [appToDelete, setAppToDelete] = useState<Application | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorInfo, setErrorInfo] = useState<ErrorInfo>(null);

  const fetchApps = () => {
    if (!selectedOrgId) return;
    authenticatedFetch(`/api-gateway/organizations/${selectedOrgId}/applications`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setApps(data))
      .catch(() => setApps([]));
  };

  useEffect(() => {
    if (!selectedOrgId) return;
    let cancelled = false;
    authenticatedFetch(`/api-gateway/usage/organization/${selectedOrgId}`)
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("Usage unavailable"))))
      .then((body) => {
        if (!cancelled) {
          setUsage(body.usage ?? []);
          setPlan(body.plan ?? "");
        }
      })
      .catch(() => {
        if (!cancelled) setUsage([]);
      });

    fetchApps();
    return () => {
      cancelled = true;
    };
  }, [selectedOrgId]);

  const handleDeleteApp = async () => {
    if (!appToDelete) return;
    setIsDeleting(true);
    setErrorInfo(null);
    try {
      const res = await authenticatedFetch(`/api-gateway/applications/${appToDelete.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || err.message || "Failed to delete application");
      }
      setAppToDelete(null);
      fetchApps();
    } catch (err: any) {
      setErrorInfo({
        title: "Deletion Failed",
        detail: err.message || "An unexpected error occurred while attempting to delete the application.",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <SettingsPage title="Storage & Retention" description="Understand stored data and the retention policy supplied by your plan." scope="ORGANIZATION">
      {/* ── Error Banner ─────────────────────────────────────────────────── */}
      {errorInfo && (
        <div
          role="alert"
          className="mb-6 rounded-lg border border-neutral-800 bg-neutral-950 p-4 text-xs font-mono text-neutral-300 animate-fade-in"
        >
          <div className="flex items-start gap-3">
            <div className="mt-0.5 shrink-0 text-red-400">
              <AlertTriangle className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-white leading-snug">{errorInfo.title}</p>
              <p className="mt-1 text-neutral-400 leading-relaxed">{errorInfo.detail}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setErrorInfo(null)}
              className="shrink-0 text-neutral-500 hover:text-white h-6 w-6"
              aria-label="Dismiss error"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <SettingsSection title="Usage overview" description={plan ? `${plan} plan` : "Current organisation"}>
        <div className="grid gap-4 md:grid-cols-3">
          {usage
            .filter((item) => ["STORAGE_GB", "APPLICATIONS", "USERS", "DEMONSTRATIONS"].includes(item.metric))
            .map((item) => {
              const { label, valueDisplay, limitDisplay } = formatMetricDisplay(item);
              return (
                <div key={item.metric} className="rounded-lg border border-neutral-800 bg-neutral-950 p-4">
                  <div className="text-xs uppercase tracking-wider text-neutral-500">{label}</div>
                  <div className="mt-2 text-2xl font-semibold text-white">
                    {valueDisplay} <span className="text-sm text-neutral-500">/ {limitDisplay}</span>
                  </div>
                  {item.limit ? (
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-neutral-800">
                      <div className="h-full bg-white" style={{ width: `${Math.min(100, item.percent)}%` }} />
                    </div>
                  ) : null}
                </div>
              );
            })}
          {usage.length === 0 ? <p className="text-sm text-neutral-500">No usage snapshot is available yet.</p> : null}
        </div>
      </SettingsSection>

      <SettingsSection title="Applications & Data" description="Manage and delete application resources in your workspace.">
        <div className="space-y-3">
          {apps.map((app) => (
            <div key={app.id} className="flex items-center justify-between rounded-lg border border-neutral-800 bg-neutral-950 p-4">
              <div>
                <div className="font-semibold text-white text-sm">{app.name}</div>
                <div className="text-xs text-neutral-500 font-mono mt-0.5">ID: {app.id}</div>
              </div>
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={() => {
                  setErrorInfo(null);
                  setAppToDelete(app);
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Delete</span>
              </Button>
            </div>
          ))}
          {apps.length === 0 ? <p className="text-sm text-neutral-500">No applications registered.</p> : null}
        </div>
      </SettingsSection>

      <SettingsSection title="Retention policy" description="Managed retention is resolved from the active subscription.">
        <p className="text-sm text-neutral-400">Free 14 days · Local 30 days · Solo 90 days · Team 180 days · Business 365 days · Enterprise custom</p>
        <div className="mt-4"><UpgradeNotice>Custom retention by data type, legal hold, and data residency are released with the corresponding Business or Enterprise capability.</UpgradeNotice></div>
      </SettingsSection>

      {appToDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-neutral-950/80 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-md rounded-2xl border border-neutral-800 bg-neutral-900 p-6 shadow-2xl space-y-5">
            <div className="flex items-center space-x-3 text-red-400">
              <AlertTriangle className="h-6 w-6 flex-shrink-0" />
              <h3 className="text-lg font-bold text-white">Delete Application</h3>
            </div>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Are you sure you want to delete <strong className="text-white">{appToDelete.name}</strong>?
              This action cannot be undone and will permanently remove all associated environments, API keys, sessions, and data.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setAppToDelete(null)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="danger"
                onClick={handleDeleteApp}
                disabled={isDeleting}
                loading={isDeleting}
              >
                Delete Application
              </Button>
            </div>
          </div>
        </div>
      )}
    </SettingsPage>
  );
}
