"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { authenticatedFetch } from "@/lib/authenticated-fetch";
import { useSession } from "@/components/providers";
import { PermissionNotice, SettingsPage } from "@/components/settings/settings-page";
import {
  StatusBanner,
  useOrganizationApplications,
  type Entitlement,
  type StatusMessage,
} from "./application-shared";

// ─────────────────────────────────────────────────────────────
// Main Applications Page Component
// ─────────────────────────────────────────────────────────────

export default function ApplicationsPage() {
  const { selectedOrgId, memberships } = useSession();
  const queryClient = useQueryClient();
  const router = useRouter();

  const [statusMessage, setStatusMessage] = useState<StatusMessage | null>(null);

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showLimitModal, setShowLimitModal] = useState(false);

  // Form states
  const [createName, setCreateName] = useState("");
  const [createSummary, setCreateSummary] = useState("");
  const [createProfileType, setCreateProfileType] = useState("WEB");
  const [isCreating, setIsCreating] = useState(false);

  const role = memberships.find((m) => m.organization.id === selectedOrgId)?.role;
  const canManage = role === "OWNER" || role === "ADMIN";
  const marketingUrl = process.env.NEXT_PUBLIC_MARKETING_URL || "https://domain-name.com";

  // Fetch organization applications
  const { data: apps, isLoading } = useOrganizationApplications(selectedOrgId);

  // Fetch organization entitlement limits
  const { data: entitlement, isLoading: isEntitlementLoading } = useQuery<Entitlement>({
    queryKey: ["sidebar-entitlement", selectedOrgId],
    queryFn: async () => {
      if (!selectedOrgId) return null;
      const res = await authenticatedFetch(`/api-gateway/organizations/${selectedOrgId}/entitlement`);
      if (!res.ok) throw new Error("Failed to fetch entitlement");
      return res.json();
    },
    enabled: !!selectedOrgId,
  });

  // Until the entitlement resolves we do not know the real limit, so we must not
  // fall back to 1 and claim the org is out of slots. The server re-checks the
  // limit on create and is the authority.
  const entitlementReady = !!entitlement;
  const appLimit = entitlement?.limits?.applications ?? 1;
  const currentCount = apps?.length ?? 0;
  const limitReached = entitlementReady && currentCount >= appLimit;
  const canCreate = canManage && !isEntitlementLoading;

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
        if (res.status === 403 && typeof body.limit === "number") {
          setShowCreateModal(false);
          setShowLimitModal(true);
          return;
        }
        throw new Error(body.message || body.error || "Failed to create application");
      }

      const created = await res.json();
      setShowCreateModal(false);

      await queryClient.invalidateQueries({ queryKey: ["organization-applications", selectedOrgId] });
      await queryClient.invalidateQueries({ queryKey: ["sidebar-apps", selectedOrgId] });

      router.push(`/settings/applications/${encodeURIComponent(created.id)}`);
    } catch (err: any) {
      setStatusMessage({ text: err.message || "Failed to create application", type: "error" });
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <SettingsPage
      title="Applications"
      description="Create and browse the applications in this workspace. Open an application to manage its details, desktop workspace attachments, SDK connection, and realtime telemetry."
      scope="ORGANIZATION"
    >
      <StatusBanner message={statusMessage} onClose={() => setStatusMessage(null)} />

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
            <strong className="text-white font-mono">{entitlementReady ? appLimit : "—"}</strong>{" "}
            allowed application{!entitlementReady || appLimit > 1 ? "s" : ""}.
          </p>
        </div>

        {canManage && (
          <button
            type="button"
            onClick={openCreate}
            disabled={!canCreate}
            className="inline-block bg-white text-black text-xs font-semibold uppercase tracking-[.08em] px-4 py-2.5 rounded hover:bg-neutral-200 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Create Application
          </button>
        )}
      </div>

      {/* Application summary cards — full details live on /settings/applications/[appId] */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="h-28 rounded border border-[#262626] bg-[#131313] animate-pulse" />
          ))}
        </div>
      ) : apps && apps.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {apps.map((app) => (
            <Link
              key={app.id}
              href={`/settings/applications/${encodeURIComponent(app.id)}`}
              className="group flex flex-col justify-between gap-4 rounded border border-[#262626] bg-[#131313] p-5 transition-colors hover:border-[#444748]"
            >
              <div className="min-w-0 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h3 className="text-base font-bold text-white tracking-tight truncate">{app.name}</h3>
                  {app.profile?.profileType && (
                    <span className="border border-[#444748] text-[#8e9192] px-2 py-0.5 text-[10px] font-mono tracking-[.08em] uppercase">
                      {app.profile.profileType}
                    </span>
                  )}
                </div>
                <p className="text-xs text-[#c4c7c8] leading-relaxed font-sans line-clamp-2">
                  {app.summary ? (
                    app.summary
                  ) : (
                    <span className="italic text-[#8e9192]">No application summary provided.</span>
                  )}
                </p>
              </div>
              <span className="text-[11px] font-mono uppercase tracking-[.08em] text-[#8e9192] group-hover:text-white transition-colors">
                View Details →
              </span>
            </Link>
          ))}
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
              disabled={!canCreate}
              className="inline-block bg-white text-black text-xs font-semibold uppercase tracking-[.08em] px-4 py-2.5 rounded hover:bg-neutral-200 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
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
          Modal 2: Application Limit Reached Modal (Black & White Auth-OTP UI)
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
