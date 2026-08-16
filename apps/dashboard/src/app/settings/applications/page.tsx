"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { authenticatedFetch } from "@/lib/authenticated-fetch";
import { useSession } from "@/components/providers";
import { PermissionNotice, SettingsPage } from "@/components/settings/settings-page";

interface Environment {
  id: string;
  name: string;
  type: string;
  isDefault?: boolean;
  baseUrl?: string | null;
}

interface ApplicationProfile {
  id: string;
  profileType: string;
}

interface ProjectWorkspace {
  id: string;
  opaqueLocalId?: string;
  repositoryFingerprint?: string;
  packageManager?: string | null;
  detectedStack?: any;
  lastScannedAt?: string | null;
  createdAt?: string;
  snapshots?: Array<{
    revision?: string | null;
    branch?: string | null;
    dirty?: boolean;
    frameworkSummary?: any;
    routeSummary?: any;
    endpointSummary?: any;
    documentationSummary?: any;
  }>;
  path?: string;
  snapshot?: any;
}

interface ApplicationOnboardingProgress {
  id: string;
  organizationCreated?: boolean;
  applicationCreated?: boolean;
  templateSelected?: boolean;
  expectedFlowsDefined?: boolean;
  connectionMethodSelected?: string | null;
  sdkTargetsConfigured?: boolean;
  sessionObserved?: boolean;
  installationTestPassed?: boolean;
  sdkConnected?: boolean;
  demonstrationCompleted?: boolean;
  analysisGenerated?: boolean;
  firstAnalysisReviewed?: boolean;
  firstReportGenerated?: boolean;
  valueRealized?: boolean;
}

interface ApplicationDetails {
  id: string;
  name: string;
  summary?: string | null;
  organizationId: string;
  environments: Environment[];
  profile?: ApplicationProfile | null;
  onboardingProgress?: ApplicationOnboardingProgress | null;
  projectWorkspaces?: ProjectWorkspace[];
  createdAt?: string;
}

interface Entitlement {
  planType: string;
  features: Record<string, boolean | string>;
  limits: Record<string, number>;
}

interface ApplicationStats {
  qaRunsCount: number;
  reportsCount: number;
  documentsCount: number;
  storageUsedBytes: number;
  flowsDeclaredCount: number;
  graphsDesignedCount: number;
  behavioursAnalysedCount: number;
  sessionsCount: number;
}

function calculateProgressPercentage(progress?: ApplicationOnboardingProgress | null): number {
  if (!progress) return 15;
  const steps = [
    progress.applicationCreated ?? true,
    progress.templateSelected ?? false,
    progress.expectedFlowsDefined ?? false,
    progress.sdkConnected ?? false,
    progress.sessionObserved ?? false,
    progress.analysisGenerated ?? false,
    progress.firstReportGenerated ?? false,
    progress.valueRealized ?? false,
  ];
  const completed = steps.filter(Boolean).length;
  return Math.round((completed / steps.length) * 100);
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function parseWorkspaceInfo(workspace?: ProjectWorkspace) {
  if (!workspace) return null;
  const latestSnapshot = workspace.snapshots?.[0] || workspace.snapshot;

  // Routes count
  const routesRaw = latestSnapshot?.routeSummary ?? latestSnapshot?.routes;
  const routesCount = Array.isArray(routesRaw)
    ? routesRaw.length
    : routesRaw && typeof routesRaw === "object"
    ? Object.keys(routesRaw).length
    : typeof routesRaw === "number"
    ? routesRaw
    : 0;

  // Endpoints count
  const endpointsRaw = latestSnapshot?.endpointSummary ?? latestSnapshot?.endpoints;
  const endpointsCount = Array.isArray(endpointsRaw)
    ? endpointsRaw.length
    : endpointsRaw && typeof endpointsRaw === "object"
    ? Object.keys(endpointsRaw).length
    : typeof endpointsRaw === "number"
    ? endpointsRaw
    : 0;

  // Docs count
  const docsRaw = latestSnapshot?.documentationSummary ?? latestSnapshot?.documentation;
  const docsCount = Array.isArray(docsRaw)
    ? docsRaw.length
    : docsRaw && typeof docsRaw === "object"
    ? Object.keys(docsRaw).length
    : typeof docsRaw === "number"
    ? docsRaw
    : 0;

  // Package manager
  const packageManager = workspace.packageManager || latestSnapshot?.packageManager || "npm";

  // Frameworks / Stack
  const stackRaw = workspace.detectedStack || latestSnapshot?.frameworkSummary || latestSnapshot?.frameworks;
  let frameworks: Array<{ name: string; version?: string }> = [];
  if (Array.isArray(stackRaw)) {
    frameworks = stackRaw.map((f: any) =>
      typeof f === "string"
        ? { name: f }
        : { name: f.framework || f.name || String(f), version: f.version }
    );
  } else if (stackRaw && typeof stackRaw === "object") {
    frameworks = Object.entries(stackRaw).map(([name, ver]) => ({
      name,
      version: typeof ver === "string" ? ver : undefined,
    }));
  }

  const branch = latestSnapshot?.branch || null;
  const revision = latestSnapshot?.revision ? String(latestSnapshot.revision).slice(0, 7) : null;
  const fingerprint = workspace.repositoryFingerprint
    ? workspace.repositoryFingerprint.slice(0, 12)
    : workspace.opaqueLocalId;
  const path = workspace.path || null;

  return {
    routesCount,
    endpointsCount,
    docsCount,
    packageManager,
    frameworks,
    branch,
    revision,
    fingerprint,
    path,
  };
}

// ─────────────────────────────────────────────────────────────
// Sub-component: Application Stats Telemetry (Black & White UI)
// ─────────────────────────────────────────────────────────────

function ApplicationStatsStrip({ appId }: { appId: string }) {
  const { data: stats, isLoading } = useQuery<ApplicationStats>({
    queryKey: ["application-stats", appId],
    queryFn: async () => {
      const res = await authenticatedFetch(`/api-gateway/applications/${appId}/stats`);
      if (!res.ok) throw new Error("Failed to fetch app stats");
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 pt-3 border-t border-[#262626]">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-12 rounded border border-[#262626] bg-black animate-pulse" />
        ))}
      </div>
    );
  }

  const items = [
    { label: "QA RUNS", value: stats?.qaRunsCount ?? 0 },
    { label: "REPORTS", value: stats?.reportsCount ?? 0 },
    { label: "DOCUMENTS", value: stats?.documentsCount ?? 0 },
    { label: "STORAGE", value: formatBytes(stats?.storageUsedBytes ?? 0) },
    { label: "FLOWS DECLARED", value: stats?.flowsDeclaredCount ?? 0 },
    { label: "GRAPHS DESIGNED", value: stats?.graphsDesignedCount ?? 0 },
    { label: "BEHAVIORS ANALYZED", value: stats?.behavioursAnalysedCount ?? 0 },
    { label: "SESSIONS CAPTURED", value: stats?.sessionsCount ?? 0 },
  ];

  return (
    <div className="space-y-2 pt-3 border-t border-[#262626]">
      <div className="flex items-center justify-between text-[11px] font-mono uppercase tracking-[.08em] text-[#8e9192]">
        <span>APPLICATION TELEMETRY & SUMMARY</span>
        <span>LIVE STATS</span>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {items.map((item) => (
          <div
            key={item.label}
            className="rounded border border-[#262626] bg-black p-2.5 flex flex-col justify-between"
          >
            <span className="text-[10px] font-mono tracking-[.08em] uppercase text-[#8e9192] truncate">
              {item.label}
            </span>
            <span className="text-sm font-semibold font-mono text-white mt-1">
              {item.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Sub-component: Progress Ring (Black & White Mono Style)
// ─────────────────────────────────────────────────────────────

function ProgressRing({ percentage }: { percentage: number }) {
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg className="w-12 h-12 transform -rotate-90">
        <circle
          cx="24"
          cy="24"
          r={radius}
          className="text-[#262626]"
          strokeWidth="3.5"
          stroke="currentColor"
          fill="transparent"
        />
        <circle
          cx="24"
          cy="24"
          r={radius}
          className="text-white transition-all duration-500 ease-out"
          strokeWidth="3.5"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          stroke="currentColor"
          fill="transparent"
        />
      </svg>
      <span className="absolute text-[10px] font-mono font-bold text-white">
        {percentage}%
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main Applications Page Component
// ─────────────────────────────────────────────────────────────

export default function ApplicationsPage() {
  const { selectedOrgId, memberships } = useSession();
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [statusMessage, setStatusMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [appToEdit, setAppToEdit] = useState<ApplicationDetails | null>(null);
  const [appToDelete, setAppToDelete] = useState<ApplicationDetails | null>(null);

  // Form states
  const [createName, setCreateName] = useState("");
  const [createSummary, setCreateSummary] = useState("");
  const [createProfileType, setCreateProfileType] = useState("WEB");
  const [isCreating, setIsCreating] = useState(false);

  const [editName, setEditName] = useState("");
  const [editSummary, setEditSummary] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const [isDeleting, setIsDeleting] = useState(false);

  const role = memberships.find((m) => m.organization.id === selectedOrgId)?.role;
  const canManage = role === "OWNER" || role === "ADMIN";
  const marketingUrl = process.env.NEXT_PUBLIC_MARKETING_URL || "https://domain-name.com";

  // Fetch organization applications
  const { data: apps, isLoading } = useQuery<ApplicationDetails[]>({
    queryKey: ["organization-applications", selectedOrgId],
    queryFn: async () => {
      if (!selectedOrgId) return [];
      const res = await authenticatedFetch(`/api-gateway/organizations/${selectedOrgId}/applications`);
      if (!res.ok) throw new Error("Failed to fetch applications");
      return res.json();
    },
    enabled: !!selectedOrgId,
  });

  // Fetch organization entitlement limits
  const { data: entitlement } = useQuery<Entitlement>({
    queryKey: ["sidebar-entitlement", selectedOrgId],
    queryFn: async () => {
      if (!selectedOrgId) return null;
      const res = await authenticatedFetch(`/api-gateway/organizations/${selectedOrgId}/entitlement`);
      if (!res.ok) throw new Error("Failed to fetch entitlement");
      return res.json();
    },
    enabled: !!selectedOrgId,
  });

  const appLimit = entitlement?.limits?.applications ?? 1;
  const currentCount = apps?.length ?? 0;
  const limitReached = currentCount >= appLimit;

  // Handlers
  function openCreate() {
    if (limitReached) {
      setShowLimitModal(true);
    } else {
      setCreateName("");
      setCreateSummary("");
      setCreateProfileType("WEB");
      setShowCreateModal(true);
    }
  }

  async function handleCreateApp(e: React.FormEvent) {
    e.preventDefault();
    if (!createName.trim() || !selectedOrgId) return;
    setIsCreating(true);
    setStatusMessage(null);

    try {
      const res = await authenticatedFetch(`/api-gateway/organizations/${selectedOrgId}/applications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: createName.trim(),
          summary: createSummary.trim() || undefined,
          profileType: createProfileType,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || body.error || "Failed to create application");
      }

      const created = await res.json();
      setShowCreateModal(false);
      setStatusMessage({ text: `Application '${created.name}' created successfully.`, type: "success" });

      await queryClient.invalidateQueries({ queryKey: ["organization-applications", selectedOrgId] });
      await queryClient.invalidateQueries({ queryKey: ["sidebar-apps", selectedOrgId] });

      const params = new URLSearchParams(searchParams.toString());
      params.set("appId", created.id);
      params.delete("envId");
      router.push(`${pathname}?${params.toString()}`);
    } catch (err: any) {
      setStatusMessage({ text: err.message || "Failed to create application", type: "error" });
    } finally {
      setIsCreating(false);
    }
  }

  function openEdit(app: ApplicationDetails) {
    setAppToEdit(app);
    setEditName(app.name);
    setEditSummary(app.summary ?? "");
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!appToEdit || !editName.trim()) return;
    setIsSavingEdit(true);
    setStatusMessage(null);

    try {
      const res = await authenticatedFetch(`/api-gateway/applications/${appToEdit.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          summary: editSummary.trim(),
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || body.error || "Failed to update application");
      }

      setAppToEdit(null);
      setStatusMessage({ text: "Application updated successfully.", type: "success" });

      await queryClient.invalidateQueries({ queryKey: ["organization-applications", selectedOrgId] });
      await queryClient.invalidateQueries({ queryKey: ["sidebar-apps", selectedOrgId] });
    } catch (err: any) {
      setStatusMessage({ text: err.message || "Failed to update application", type: "error" });
    } finally {
      setIsSavingEdit(false);
    }
  }

  async function handleDeleteApp() {
    if (!appToDelete) return;
    setIsDeleting(true);
    setStatusMessage(null);

    try {
      const res = await authenticatedFetch(`/api-gateway/applications/${appToDelete.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || body.error || "Failed to delete application");
      }

      const deletedId = appToDelete.id;
      setAppToDelete(null);
      setStatusMessage({ text: "Application deleted successfully.", type: "success" });

      await queryClient.invalidateQueries({ queryKey: ["organization-applications", selectedOrgId] });
      await queryClient.invalidateQueries({ queryKey: ["sidebar-apps", selectedOrgId] });

      const currentAppId = searchParams.get("appId");
      if (currentAppId === deletedId) {
        const remaining = apps?.filter((a) => a.id !== deletedId) ?? [];
        const params = new URLSearchParams(searchParams.toString());
        if (remaining.length > 0) {
          params.set("appId", remaining[0].id);
          params.delete("envId");
          router.push(`${pathname}?${params.toString()}`);
        } else {
          params.delete("appId");
          params.delete("envId");
          router.push("/onboarding");
        }
      }
    } catch (err: any) {
      setStatusMessage({ text: err.message || "Failed to delete application", type: "error" });
    } finally {
      setIsDeleting(false);
    }
  }

  function copyText(text: string, id: string) {
    void navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  return (
    <SettingsPage
      title="Applications"
      description="Create, configure, and monitor applications within this workspace. Manage purpose summaries, desktop workspace attachments, onboarding progress, and realtime telemetry."
      scope="ORGANIZATION"
    >
      {/* Status Messages Banner */}
      {statusMessage ? (
        <div
          className={`flex items-center justify-between gap-2.5 rounded border px-3.5 py-2.5 text-xs font-mono transition-all ${
            statusMessage.type === "success"
              ? "border-white bg-black text-white"
              : "border-red-900 bg-black text-red-400"
          }`}
        >
          <div className="flex items-center gap-2">
            <span>[{statusMessage.type === "success" ? "OK" : "ERROR"}]</span>
            <span>{statusMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="text-[#8e9192] hover:text-white transition-colors"
          >
            [CLOSE]
          </button>
        </div>
      ) : null}

      {!canManage && (
        <PermissionNotice>
          You can view applications and their project telemetry, but only an Owner or Admin can create, edit, or delete applications.
        </PermissionNotice>
      )}

      {/* Header bar: Count & Add Button */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded border border-[#262626] bg-[#131313] p-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-white tracking-tight font-sans">Application Slots</h2>
            <span className="inline-block border border-[#444748] text-[#8e9192] px-2 py-0.5 text-[11px] font-mono tracking-[.08em] uppercase">
              {entitlement?.planType ?? "FREE"} PLAN
            </span>
          </div>
          <p className="text-xs text-[#c4c7c8] font-sans">
            Using <strong className="text-white font-mono">{currentCount}</strong> of{" "}
            <strong className="text-white font-mono">{appLimit}</strong> allowed application{appLimit > 1 ? "s" : ""}.
          </p>
        </div>

        {canManage && (
          <button
            type="button"
            onClick={openCreate}
            className="inline-block bg-white text-black text-xs font-semibold uppercase tracking-[.08em] px-4 py-2.5 rounded hover:bg-neutral-200 transition-colors cursor-pointer"
          >
            Create Application
          </button>
        )}
      </div>

      {/* Applications Cards List */}
      {isLoading ? (
        <div className="space-y-4">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="h-64 rounded border border-[#262626] bg-[#131313] animate-pulse p-6" />
          ))}
        </div>
      ) : apps && apps.length > 0 ? (
        <div className="space-y-6">
          {apps.map((app) => {
            const workspace = app.projectWorkspaces?.[0];
            const parsedWorkspace = parseWorkspaceInfo(workspace);
            const progressPercentage = calculateProgressPercentage(app.onboardingProgress);

            return (
              <div
                key={app.id}
                className="rounded border border-[#262626] bg-[#131313] transition-all hover:border-[#444748] shadow-2xl overflow-hidden"
              >
                {/* Application Header Bar */}
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#262626] p-5 bg-black">
                  <div className="min-w-0 space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h3 className="text-xl font-bold text-white tracking-tight">{app.name}</h3>
                      {app.profile?.profileType && (
                        <span className="border border-[#444748] text-[#8e9192] px-2 py-0.5 text-[10px] font-mono tracking-[.08em] uppercase">
                          {app.profile.profileType}
                        </span>
                      )}
                      <span className="text-[11px] font-mono text-[#8e9192] truncate">ID: {app.id}</span>
                      <button
                        type="button"
                        onClick={() => copyText(app.id, app.id)}
                        className="text-[#8e9192] hover:text-white font-mono text-[11px] px-1.5 py-0.5 rounded border border-[#262626] transition-colors"
                        title="Copy Application ID"
                      >
                        {copiedId === app.id ? "[COPIED]" : "[COPY]"}
                      </button>
                    </div>

                    {/* Application Purpose / Summary */}
                    <p className="text-xs text-[#c4c7c8] leading-relaxed font-sans">
                      {app.summary ? (
                        <span>{app.summary}</span>
                      ) : (
                        <span className="italic text-[#8e9192]">No application summary provided.</span>
                      )}
                    </p>
                  </div>

                  {/* Progress Ring & Action Buttons */}
                  <div className="flex items-center space-x-4 shrink-0">
                    <div className="flex items-center space-x-3 border-r border-[#262626] pr-4">
                      <div className="text-right hidden sm:block">
                        <div className="text-xs font-semibold text-white font-sans">Onboarding Progress</div>
                        <div className="text-[10px] font-mono text-[#8e9192]">
                          {progressPercentage === 100 ? "SETUP COMPLETE" : "IN PROGRESS"}
                        </div>
                      </div>
                      <ProgressRing percentage={progressPercentage} />
                    </div>

                    {canManage && (
                      <div className="flex items-center space-x-2">
                        <button
                          type="button"
                          onClick={() => openEdit(app)}
                          className="px-3 py-1.5 rounded border border-[#262626] bg-black text-[#8e9192] hover:text-white hover:bg-[#262626] text-xs font-mono uppercase tracking-[.08em] transition-colors cursor-pointer"
                          title="Edit Application Details"
                        >
                          EDIT
                        </button>
                        <button
                          type="button"
                          onClick={() => setAppToDelete(app)}
                          className="px-3 py-1.5 rounded border border-[#262626] bg-black text-[#8e9192] hover:text-white hover:bg-neutral-900 text-xs font-mono uppercase tracking-[.08em] transition-colors cursor-pointer"
                          title="Delete Application"
                        >
                          DELETE
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-5 space-y-5">
                  {/* Feature 3: Attached Project Workspace & Analysis Overview */}
                  <div className="rounded border border-[#262626] bg-black p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#262626] pb-2.5">
                      <span className="text-[11px] font-mono tracking-[.08em] uppercase text-[#8e9192]">
                        ATTACHED PROJECT WORKSPACE
                      </span>
                      {parsedWorkspace ? (
                        <span className="border border-white text-white px-2 py-0.5 text-[10px] font-mono tracking-[.08em] uppercase">
                          CONNECTED
                        </span>
                      ) : (
                        <span className="border border-[#444748] text-[#8e9192] px-2 py-0.5 text-[10px] font-mono tracking-[.08em] uppercase">
                          NOT ATTACHED
                        </span>
                      )}
                    </div>

                    {parsedWorkspace ? (
                      <div className="space-y-3 text-xs font-mono">
                        {/* Path / Fingerprint */}
                        <div className="flex flex-wrap items-center justify-between gap-2 bg-[#131313] p-2.5 rounded border border-[#262626]">
                          <span className="text-[#c4c7c8] truncate max-w-xl">
                            {parsedWorkspace.path
                              ? `Path: ${parsedWorkspace.path}`
                              : `Workspace Fingerprint: ${parsedWorkspace.fingerprint}`}
                          </span>
                          <span className="border border-[#444748] text-[#8e9192] px-2 py-0.5 text-[10px] uppercase">
                            {parsedWorkspace.packageManager}
                          </span>
                        </div>

                        {/* Frameworks & Stack */}
                        {parsedWorkspace.frameworks.length > 0 && (
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[11px] text-[#8e9192] uppercase tracking-[.08em]">DETECTED STACK:</span>
                            {parsedWorkspace.frameworks.map((fw) => (
                              <span
                                key={fw.name}
                                className="border border-[#262626] bg-[#131313] text-white px-2 py-0.5 text-[10px] rounded"
                              >
                                {fw.name} {fw.version ? `v${fw.version}` : ""}
                              </span>
                            ))}
                            {parsedWorkspace.branch && (
                              <span className="border border-[#262626] text-[#8e9192] px-2 py-0.5 text-[10px] rounded">
                                branch: {parsedWorkspace.branch}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Analysis Overview: Routes, Endpoints, Docs */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                          <div className="rounded border border-[#262626] bg-[#131313] p-2.5 text-center">
                            <div className="text-base font-bold text-white">
                              {parsedWorkspace.routesCount}
                            </div>
                            <div className="text-[10px] text-[#8e9192] uppercase tracking-[.08em] mt-0.5">
                              DISCOVERED ROUTES
                            </div>
                          </div>
                          <div className="rounded border border-[#262626] bg-[#131313] p-2.5 text-center">
                            <div className="text-base font-bold text-white">
                              {parsedWorkspace.endpointsCount}
                            </div>
                            <div className="text-[10px] text-[#8e9192] uppercase tracking-[.08em] mt-0.5">
                              ENDPOINTS MAPPED
                            </div>
                          </div>
                          <div className="rounded border border-[#262626] bg-[#131313] p-2.5 text-center">
                            <div className="text-base font-bold text-white">
                              {parsedWorkspace.docsCount}
                            </div>
                            <div className="text-[10px] text-[#8e9192] uppercase tracking-[.08em] mt-0.5">
                              DOC MANIFESTS
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-[#c4c7c8] leading-relaxed py-1 font-sans">
                        To link a local workspace folder, launch the <strong>Tellann Desktop</strong> application, select this application, and click <em>Attach Local Workspace</em>.
                      </div>
                    )}
                  </div>

                  {/* Feature 5: Telemetry Fan-out Stats Strip */}
                  <ApplicationStatsStrip appId={app.id} />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded border border-[#262626] bg-[#131313] p-12 text-center space-y-4">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold text-white tracking-tight">No Applications Created</h3>
            <p className="text-xs text-[#c4c7c8] max-w-md mx-auto">
              Get started by creating your first application in this organisation to define behavioral graphs, upload specifications, and run QA checks.
            </p>
          </div>
          {canManage && (
            <button
              type="button"
              onClick={openCreate}
              className="inline-block bg-white text-black text-xs font-semibold uppercase tracking-[.08em] px-4 py-2.5 rounded hover:bg-neutral-200 transition-colors cursor-pointer"
            >
              Create Application
            </button>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          Modal 1: Create Application Modal (Black & White Auth-OTP UI)
      ───────────────────────────────────────────────────────────── */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-100">
          <div className="relative w-full max-w-md rounded border border-[#262626] bg-[#131313] p-6 shadow-2xl space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#262626] pb-4">
              <span className="text-white text-lg font-extrabold tracking-tight">TELLANN</span>
              <span className="inline-block border border-[#444748] text-[#8e9192] px-2 py-1 text-[11px] font-mono tracking-[.08em] uppercase">
                App // Create
              </span>
            </div>

            <div className="space-y-1">
              <h3 className="text-xl font-semibold text-white tracking-tight">
                Create Application
              </h3>
              <p className="text-xs text-[#c4c7c8] leading-relaxed">
                Add a new application entry to this organisation workspace.
              </p>
            </div>

            <form onSubmit={handleCreateApp} className="space-y-4">
              <div>
                <label className="text-[#8e9192] text-[11px] font-mono tracking-[.08em] uppercase block mb-1.5">
                  APPLICATION NAME <span className="text-white">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Payment Gateway Service"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  className="w-full rounded border border-[#262626] bg-black px-3.5 py-2 text-xs text-white font-mono focus:outline-none focus:border-white transition-colors"
                />
              </div>

              <div>
                <label className="text-[#8e9192] text-[11px] font-mono tracking-[.08em] uppercase block mb-1.5">
                  APPLICATION SUMMARY / PURPOSE
                </label>
                <textarea
                  rows={3}
                  placeholder="Describe the primary function and purpose of this application..."
                  value={createSummary}
                  onChange={(e) => setCreateSummary(e.target.value)}
                  className="w-full rounded border border-[#262626] bg-black px-3.5 py-2 text-xs text-white font-mono focus:outline-none focus:border-white transition-colors leading-relaxed"
                />
                <span className="text-[10px] font-mono text-[#8e9192] mt-1 block">
                  NOTE: Summarizes application scope for AI graph generation and team members.
                </span>
              </div>

              <div>
                <label className="text-[#8e9192] text-[11px] font-mono tracking-[.08em] uppercase block mb-1.5">
                  PROFILE TYPE
                </label>
                <select
                  value={createProfileType}
                  onChange={(e) => setCreateProfileType(e.target.value)}
                  className="w-full rounded border border-[#262626] bg-black px-3.5 py-2 text-xs text-white font-mono focus:outline-none focus:border-white transition-colors"
                >
                  <option value="WEB">WEB — Web Frontend / Fullstack App</option>
                  <option value="MOBILE">MOBILE — Mobile App (iOS / Android)</option>
                  <option value="API">API — Backend Microservice / REST / GraphQL</option>
                  <option value="DESKTOP">DESKTOP — Electron / Native Desktop</option>
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 h-10 flex items-center justify-center rounded border border-[#262626] bg-black text-xs font-semibold uppercase tracking-[.08em] text-[#8e9192] hover:bg-[#262626] hover:text-white transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating || !createName.trim()}
                  className="flex-1 h-10 flex items-center justify-center rounded border border-white bg-white text-xs font-semibold uppercase tracking-[.08em] text-black hover:bg-neutral-200 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {isCreating ? "Creating…" : "Create Application"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          Modal 2: Edit Application Modal (Black & White Auth-OTP UI)
      ───────────────────────────────────────────────────────────── */}
      {appToEdit && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-100">
          <div className="relative w-full max-w-md rounded border border-[#262626] bg-[#131313] p-6 shadow-2xl space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#262626] pb-4">
              <span className="text-white text-lg font-extrabold tracking-tight">TELLANN</span>
              <span className="inline-block border border-[#444748] text-[#8e9192] px-2 py-1 text-[11px] font-mono tracking-[.08em] uppercase">
                App // Edit
              </span>
            </div>

            <div className="space-y-1">
              <h3 className="text-xl font-semibold text-white tracking-tight">
                Edit Application
              </h3>
              <p className="text-xs text-[#c4c7c8] leading-relaxed">
                Update application name and purpose summary.
              </p>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="text-[#8e9192] text-[11px] font-mono tracking-[.08em] uppercase block mb-1.5">
                  APPLICATION NAME <span className="text-white">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full rounded border border-[#262626] bg-black px-3.5 py-2 text-xs text-white font-mono focus:outline-none focus:border-white transition-colors"
                />
              </div>

              <div>
                <label className="text-[#8e9192] text-[11px] font-mono tracking-[.08em] uppercase block mb-1.5">
                  APPLICATION SUMMARY / PURPOSE
                </label>
                <textarea
                  rows={4}
                  placeholder="Explain the purpose and function of this application..."
                  value={editSummary}
                  onChange={(e) => setEditSummary(e.target.value)}
                  className="w-full rounded border border-[#262626] bg-black px-3.5 py-2 text-xs text-white font-mono focus:outline-none focus:border-white transition-colors leading-relaxed"
                />
                <span className="text-[10px] font-mono text-[#8e9192] mt-1 block">
                  NOTE: Edits are synchronized live to open Desktop sessions via SSE stream.
                </span>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setAppToEdit(null)}
                  className="flex-1 h-10 flex items-center justify-center rounded border border-[#262626] bg-black text-xs font-semibold uppercase tracking-[.08em] text-[#8e9192] hover:bg-[#262626] hover:text-white transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit || !editName.trim()}
                  className="flex-1 h-10 flex items-center justify-center rounded border border-white bg-white text-xs font-semibold uppercase tracking-[.08em] text-black hover:bg-neutral-200 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {isSavingEdit ? "Saving…" : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          Modal 3: Delete Application Modal (Black & White Auth-OTP UI)
      ───────────────────────────────────────────────────────────── */}
      {appToDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-100">
          <div className="relative w-full max-w-md rounded border border-[#262626] bg-[#131313] p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-[#262626] pb-4">
              <span className="text-white text-lg font-extrabold tracking-tight">TELLANN</span>
              <span className="inline-block border border-[#444748] text-[#8e9192] px-2 py-1 text-[11px] font-mono tracking-[.08em] uppercase">
                App // Delete
              </span>
            </div>

            <div className="space-y-2">
              <h3 className="text-xl font-semibold text-white tracking-tight">
                Delete Application
              </h3>
              <p className="text-xs text-[#c4c7c8] leading-relaxed">
                Are you sure you want to delete <strong className="text-white font-semibold">{appToDelete.name}</strong>?
                This action cannot be undone and will permanently remove all associated environments, API keys, sessions, and behavior graphs.
              </p>
            </div>

            <div className="bg-black border border-[#262626] rounded divide-y divide-[#262626]">
              <div className="flex items-center justify-between px-3 py-2">
                <span className="text-[#8e9192] text-[11px] font-mono tracking-[.08em] uppercase">APPLICATION</span>
                <span className="text-white text-xs font-mono font-semibold truncate max-w-[200px] text-right">{appToDelete.name}</span>
              </div>
              <div className="flex items-center justify-between px-3 py-2">
                <span className="text-[#8e9192] text-[11px] font-mono tracking-[.08em] uppercase">ACTION TYPE</span>
                <span className="text-white text-xs font-mono uppercase">PERMANENT DELETE</span>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setAppToDelete(null)}
                disabled={isDeleting}
                className="flex-1 h-10 flex items-center justify-center rounded border border-[#262626] bg-black text-xs font-semibold uppercase tracking-[.08em] text-[#8e9192] hover:bg-[#262626] hover:text-white transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteApp}
                disabled={isDeleting}
                className="flex-1 h-10 flex items-center justify-center rounded border border-white bg-white text-xs font-semibold uppercase tracking-[.08em] text-black hover:bg-neutral-200 transition-colors disabled:opacity-50 cursor-pointer"
              >
                {isDeleting ? "Deleting…" : "Delete Application"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          Modal 4: Application Limit Reached Modal (Black & White Auth-OTP UI)
      ───────────────────────────────────────────────────────────── */}
      {showLimitModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-100">
          <div className="relative w-full max-w-md rounded border border-[#262626] bg-[#131313] p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-[#262626] pb-4">
              <span className="text-white text-lg font-extrabold tracking-tight">TELLANN</span>
              <span className="inline-block border border-[#444748] text-[#8e9192] px-2 py-1 text-[11px] font-mono tracking-[.08em] uppercase">
                Plan // Limit
              </span>
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-semibold text-white tracking-tight">
                Application Limit Reached
              </h3>
              <p className="text-xs text-[#c4c7c8] leading-relaxed">
                You have reached the maximum number of applications allowed on your plan ({appLimit} application{appLimit > 1 ? "s" : ""}). Please upgrade your plan to onboard more applications.
              </p>
            </div>
            <div className="bg-black border border-[#262626] rounded divide-y divide-[#262626]">
              <div className="flex items-center justify-between px-3 py-2">
                <span className="text-[#8e9192] text-[11px] font-mono tracking-[.08em] uppercase">CURRENT LIMIT</span>
                <span className="text-white text-xs font-mono">{appLimit} App{appLimit > 1 ? "s" : ""}</span>
              </div>
              <div className="flex items-center justify-between px-3 py-2">
                <span className="text-[#8e9192] text-[11px] font-mono tracking-[.08em] uppercase">REQUIRED ACTION</span>
                <span className="text-white text-xs font-mono uppercase">UPGRADE PLAN</span>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowLimitModal(false)}
                className="flex-1 h-10 flex items-center justify-center rounded border border-[#262626] bg-black text-xs font-semibold uppercase tracking-[.08em] text-[#8e9192] hover:bg-[#262626] hover:text-white transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <a
                href={`${marketingUrl}/pricing`}
                className="flex-1 h-10 flex items-center justify-center rounded border border-white bg-white text-xs font-semibold uppercase tracking-[.08em] text-black hover:bg-neutral-200 transition-colors text-center cursor-pointer"
              >
                Upgrade Plan
              </a>
            </div>
          </div>
        </div>
      )}
    </SettingsPage>
  );
}
