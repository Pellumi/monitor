"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { authenticatedFetch } from "@/lib/authenticated-fetch";
import { useSession } from "@/components/providers";
import { PermissionNotice, SettingsPage } from "@/components/settings/settings-page";
import {
  ApplicationStatsStrip,
  ProgressRing,
  StatusBanner,
  WorkspaceRosterSection,
  calculateProgressPercentage,
  useOrganizationApplications,
  type StatusMessage,
} from "../application-shared";

interface SdkSetupStatus {
  environmentName: string;
  environmentType: string;
  hasActiveKey: boolean;
  keyPrefix: string | null;
  readiness: {
    connected: boolean;
    sessionObserved: boolean;
    eventObserved: boolean;
    installationTestPassed: boolean;
    targets: Array<{ targetId: string; verified: boolean; lastEventAt: string | null }>;
  };
}

// ─────────────────────────────────────────────────────────────
// Sub-component: SDK connection status + entry point to setup
// ─────────────────────────────────────────────────────────────

function ApplicationConnectionSection({ appId }: { appId: string }) {
  const router = useRouter();
  const [alreadyConnected, setAlreadyConnected] = useState(false);
  const connectHref = `/applications/${encodeURIComponent(appId)}/connect?appId=${encodeURIComponent(appId)}`;

  const setup = useQuery<SdkSetupStatus>({
    queryKey: ["sdk-setup", appId],
    queryFn: async () => {
      const res = await authenticatedFetch(`/api-gateway/applications/${appId}/sdk-setup`);
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.message || body?.error || "Failed to load connection status");
      return body;
    },
  });

  // Always re-check before deciding: a teammate may have connected the SDK since this page loaded.
  async function handleConnect() {
    const result = await setup.refetch();
    if (result.data?.readiness.connected) {
      setAlreadyConnected(true);
      return;
    }
    router.push(connectHref);
  }

  const readiness = setup.data?.readiness;
  const lastEventAt = readiness?.targets
    .map((target) => target.lastEventAt)
    .filter((value): value is string => !!value)
    .sort()
    .at(-1);

  return (
    <div className="rounded border border-[#262626] bg-black p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#262626] pb-2.5">
        <span className="text-[11px] font-mono tracking-[.08em] uppercase text-[#8e9192]">
          SDK CONNECTION
        </span>
        {setup.isLoading ? (
          <span className="text-[10px] font-mono uppercase tracking-[.08em] text-[#8e9192]">CHECKING…</span>
        ) : (
          <span
            className={`border px-2 py-0.5 text-[10px] font-mono tracking-[.08em] uppercase ${
              readiness?.connected ? "border-white text-white" : "border-[#444748] text-[#8e9192]"
            }`}
          >
            {readiness?.connected ? "CONNECTED" : "NOT CONNECTED"}
          </span>
        )}
      </div>

      {setup.error ? (
        <p className="text-[11px] font-mono text-red-400">[ERROR] {setup.error.message}</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs font-mono">
          <div className="rounded border border-[#262626] bg-[#131313] p-2.5">
            <div className="text-[10px] text-[#8e9192] uppercase tracking-[.08em]">ENVIRONMENT</div>
            <div className="text-white mt-1 truncate">
              {setup.data ? `${setup.data.environmentName} (${setup.data.environmentType})` : "—"}
            </div>
          </div>
          <div className="rounded border border-[#262626] bg-[#131313] p-2.5">
            <div className="text-[10px] text-[#8e9192] uppercase tracking-[.08em]">INGESTION KEY</div>
            <div className="text-white mt-1 truncate">
              {setup.data ? (setup.data.hasActiveKey ? `${setup.data.keyPrefix ?? "ACTIVE"}…` : "NONE") : "—"}
            </div>
          </div>
          <div className="rounded border border-[#262626] bg-[#131313] p-2.5">
            <div className="text-[10px] text-[#8e9192] uppercase tracking-[.08em]">INSTALLATION</div>
            <div className="text-white mt-1">
              {readiness ? (readiness.installationTestPassed ? "VERIFIED" : "WAITING") : "—"}
            </div>
          </div>
          <div className="rounded border border-[#262626] bg-[#131313] p-2.5">
            <div className="text-[10px] text-[#8e9192] uppercase tracking-[.08em]">LAST EVENT</div>
            <div className="text-white mt-1 truncate">
              {lastEventAt ? new Date(lastEventAt).toLocaleString() : "NEVER"}
            </div>
          </div>
        </div>
      )}

      {alreadyConnected ? (
        <div className="rounded border border-white bg-[#131313] p-3 space-y-2">
          <p className="text-xs font-semibold text-white font-sans">This application is already connected.</p>
          <p className="text-xs text-[#c4c7c8] leading-relaxed font-sans">
            Tellann is already receiving telemetry for this application. You can still open the connection
            setup to view the install commands, initialization snippet, and ingestion key, for example to
            connect another target or reinstall the SDK.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <Link
              href={connectHref}
              className="px-3 py-1.5 rounded border border-white bg-white text-black text-[10px] font-mono uppercase tracking-[.08em] hover:bg-neutral-200 transition-colors"
            >
              View Connection Details →
            </Link>
            <button
              type="button"
              onClick={() => setAlreadyConnected(false)}
              className="px-3 py-1.5 rounded border border-[#262626] bg-black text-[#8e9192] hover:text-white text-[10px] font-mono uppercase tracking-[.08em] transition-colors cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <p className="text-[11px] text-[#8e9192] font-sans leading-relaxed">
            Install the Tellann SDK manually or let Tellann Desktop set it up for you.
          </p>
          <button
            type="button"
            onClick={() => void handleConnect()}
            disabled={setup.isFetching}
            className="px-4 py-2 rounded border border-white bg-white text-black text-xs font-semibold uppercase tracking-[.08em] hover:bg-neutral-200 disabled:opacity-50 transition-colors cursor-pointer"
          >
            {setup.isFetching ? "Checking…" : "Connect Application"}
          </button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main Application Details Page Component
// ─────────────────────────────────────────────────────────────

export default function ApplicationDetailsPage() {
  const { appId } = useParams<{ appId: string }>();
  const { selectedOrgId, memberships } = useSession();
  const queryClient = useQueryClient();
  const router = useRouter();

  const [statusMessage, setStatusMessage] = useState<StatusMessage | null>(null);
  const [copied, setCopied] = useState(false);

  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editName, setEditName] = useState("");
  const [editSummary, setEditSummary] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const role = memberships.find((m) => m.organization.id === selectedOrgId)?.role;
  const canManage = role === "OWNER" || role === "ADMIN";

  const { data: apps, isLoading } = useOrganizationApplications(selectedOrgId);
  const app = apps?.find((item) => item.id === appId);

  function openEdit() {
    if (!app) return;
    setEditName(app.name);
    setEditSummary(app.summary ?? "");
    setShowEditModal(true);
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!app || !editName.trim()) return;
    setIsSavingEdit(true);
    setStatusMessage(null);

    try {
      const res = await authenticatedFetch(`/api-gateway/applications/${app.id}`, {
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

      setShowEditModal(false);
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
    if (!app) return;
    setIsDeleting(true);
    setStatusMessage(null);

    try {
      const res = await authenticatedFetch(`/api-gateway/applications/${app.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || body.error || "Failed to delete application");
      }

      // Leave before the list refetches, otherwise this page flashes "not found".
      const remaining = apps?.filter((item) => item.id !== app.id) ?? [];
      router.push(
        remaining.length > 0
          ? `/settings/applications?appId=${encodeURIComponent(remaining[0].id)}`
          : "/onboarding",
      );

      await queryClient.invalidateQueries({ queryKey: ["organization-applications", selectedOrgId] });
      await queryClient.invalidateQueries({ queryKey: ["sidebar-apps", selectedOrgId] });
    } catch (err: any) {
      setStatusMessage({ text: err.message || "Failed to delete application", type: "error" });
      setIsDeleting(false);
    }
  }

  function copyId(id: string) {
    void navigator.clipboard.writeText(id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const backLink = (
    <Link
      href="/settings/applications"
      className="inline-block text-[11px] font-mono uppercase tracking-[.08em] text-[#8e9192] hover:text-white transition-colors"
    >
      ← All Applications
    </Link>
  );

  if (isLoading || (!apps && selectedOrgId)) {
    return (
      <div className="space-y-4">
        {backLink}
        <div className="space-y-4">
          <div className="h-32 rounded border border-[#262626] bg-[#131313] animate-pulse" />
          <div className="h-64 rounded border border-[#262626] bg-[#131313] animate-pulse" />
        </div>
      </div>
    );
  }

  if (!app) {
    return (
      <div className="space-y-4">
        {backLink}
        <div className="rounded border border-[#262626] bg-[#131313] p-12 text-center space-y-2">
          <h3 className="text-lg font-semibold text-white tracking-tight">Application Not Found</h3>
          <p className="text-xs text-[#c4c7c8] max-w-md mx-auto">
            This application does not exist in the selected organisation, or it has been deleted.
          </p>
        </div>
      </div>
    );
  }

  const progressPercentage = calculateProgressPercentage(app.onboardingProgress);

  return (
    <div className="space-y-4">
      {backLink}
      <SettingsPage
        title={app.name}
        description="Connection status, desktop workspace attachments, QA branch policy, onboarding progress, and realtime telemetry for this application."
        scope="ORGANIZATION"
      >
        <StatusBanner message={statusMessage} onClose={() => setStatusMessage(null)} />

        {!canManage && (
          <PermissionNotice>
            You can view this application and its project telemetry, but only an Owner or Admin can edit or delete it.
          </PermissionNotice>
        )}

        <div className="rounded border border-[#262626] bg-[#131313] shadow-2xl overflow-hidden">
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
                  onClick={() => copyId(app.id)}
                  className="text-[#8e9192] hover:text-white font-mono text-[11px] px-1.5 py-0.5 rounded border border-[#262626] transition-colors"
                  title="Copy Application ID"
                >
                  {copied ? "[COPIED]" : "[COPY]"}
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
                    onClick={openEdit}
                    className="px-3 py-1.5 rounded border border-[#262626] bg-black text-[#8e9192] hover:text-white hover:bg-[#262626] text-xs font-mono uppercase tracking-[.08em] transition-colors cursor-pointer"
                    title="Edit Application Details"
                  >
                    EDIT
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowDeleteModal(true)}
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
            {/* SDK connection status and the entry point to the connect flow */}
            <ApplicationConnectionSection appId={app.id} />

            {/* Repository binding, QA branch policy, and every member's checkout */}
            <WorkspaceRosterSection appId={app.id} canManage={canManage} />

            {/* Feature 5: Telemetry Fan-out Stats Strip */}
            <ApplicationStatsStrip appId={app.id} />
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────────
            Modal 1: Edit Application Modal (Black & White Auth-OTP UI)
        ───────────────────────────────────────────────────────────── */}
        {showEditModal && (
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
                    onClick={() => setShowEditModal(false)}
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
            Modal 2: Delete Application Modal (Black & White Auth-OTP UI)
        ───────────────────────────────────────────────────────────── */}
        {showDeleteModal && (
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
                  Are you sure you want to delete <strong className="text-white font-semibold">{app.name}</strong>?
                  This action cannot be undone and will permanently remove all associated environments, API keys, sessions, and behavior graphs.
                </p>
              </div>

              <div className="bg-black border border-[#262626] rounded divide-y divide-[#262626]">
                <div className="flex items-center justify-between px-3 py-2">
                  <span className="text-[#8e9192] text-[11px] font-mono tracking-[.08em] uppercase">APPLICATION</span>
                  <span className="text-white text-xs font-mono font-semibold truncate max-w-[200px] text-right">{app.name}</span>
                </div>
                <div className="flex items-center justify-between px-3 py-2">
                  <span className="text-[#8e9192] text-[11px] font-mono tracking-[.08em] uppercase">ACTION TYPE</span>
                  <span className="text-white text-xs font-mono uppercase">PERMANENT DELETE</span>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(false)}
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
      </SettingsPage>
    </div>
  );
}
