"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { authenticatedFetch } from "@/lib/authenticated-fetch";

export interface Environment {
  id: string;
  name: string;
  type: string;
  isDefault?: boolean;
  baseUrl?: string | null;
}

export interface ApplicationProfile {
  id: string;
  profileType: string;
}

export interface ProjectWorkspace {
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

export interface ApplicationOnboardingProgress {
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

export interface ApplicationDetails {
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

interface BranchPolicy {
  applicationId: string;
  repositoryOriginHash: string | null;
  repositoryCloneUrl: string | null;
  qaBranchName: string;
  qaBranchBase: string;
  enforcement: "WARN" | "BLOCK";
  allowAgentCheckout: boolean;
  bound: boolean;
}

interface WorkspaceRosterEntry {
  id: string;
  isMine: boolean;
  owner: { id: string; email: string | null; displayName: string | null };
  packageManager?: string | null;
  detectedStack?: any;
  lastScannedAt?: string | null;
  branch: string | null;
  revision: string | null;
  dirty: boolean | null;
  aheadCount: number | null;
  behindCount: number | null;
  status: "COMPLIANT" | "BRANCH_MISMATCH" | "NO_POLICY" | "UNKNOWN";
  blocksRun: boolean;
  agentCheckoutGranted: boolean;
}

interface WorkspaceRoster {
  policy: BranchPolicy;
  workspaces: WorkspaceRosterEntry[];
}

export interface Entitlement {
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

export type StatusMessage = { text: string; type: "success" | "error" };

/** Shared by the list and details pages so both read and invalidate one cache entry. */
export function useOrganizationApplications(selectedOrgId: string | null | undefined) {
  return useQuery<ApplicationDetails[]>({
    queryKey: ["organization-applications", selectedOrgId],
    queryFn: async () => {
      if (!selectedOrgId) return [];
      const res = await authenticatedFetch(`/api-gateway/organizations/${selectedOrgId}/applications`);
      if (!res.ok) throw new Error("Failed to fetch applications");
      return res.json();
    },
    enabled: !!selectedOrgId,
  });
}

export function calculateProgressPercentage(progress?: ApplicationOnboardingProgress | null): number {
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

function statusChip(status: WorkspaceRosterEntry["status"], blocksRun: boolean) {
  if (status === "COMPLIANT") return { label: "ON QA BRANCH", className: "border-white text-white" };
  if (status === "BRANCH_MISMATCH") {
    return blocksRun
      ? { label: "WRONG BRANCH / BLOCKED", className: "border-red-900 text-red-400" }
      : { label: "WRONG BRANCH", className: "border-yellow-800 text-yellow-500" };
  }
  if (status === "UNKNOWN") return { label: "NOT SCANNED", className: "border-[#444748] text-[#8e9192]" };
  return { label: "NO POLICY", className: "border-[#444748] text-[#8e9192]" };
}

function ownerLabel(owner: WorkspaceRosterEntry["owner"]) {
  return owner.displayName || owner.email || owner.id.slice(0, 8);
}

export function StatusBanner({ message, onClose }: { message: StatusMessage | null; onClose: () => void }) {
  if (!message) return null;
  return (
    <div
      className={`flex items-center justify-between gap-2.5 rounded border px-3.5 py-2.5 text-xs font-mono transition-all ${
        message.type === "success"
          ? "border-white bg-black text-white"
          : "border-red-900 bg-black text-red-400"
      }`}
    >
      <div className="flex items-center gap-2">
        <span>[{message.type === "success" ? "OK" : "ERROR"}]</span>
        <span>{message.text}</span>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="text-[#8e9192] hover:text-white transition-colors"
      >
        [CLOSE]
      </button>
    </div>
  );
}

/**
 * Every member's checkout, plus the org-owned branch policy they are all
 * measured against.
 *
 * This replaces reading projectWorkspaces[0], which rendered whichever teammate
 * scanned most recently and presented that machine's branch and stack as though
 * it were the viewer's own.
 */
export function WorkspaceRosterSection({ appId, canManage }: { appId: string; canManage: boolean }) {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [draftBranch, setDraftBranch] = useState("");
  const [draftBase, setDraftBase] = useState("");
  const [draftEnforcement, setDraftEnforcement] = useState<"WARN" | "BLOCK">("WARN");
  const [draftAllowAgent, setDraftAllowAgent] = useState(false);
  const [isSavingPolicy, setIsSavingPolicy] = useState(false);
  const [policyError, setPolicyError] = useState<string | null>(null);

  const { data: roster, isLoading } = useQuery<WorkspaceRoster>({
    queryKey: ["workspace-roster", appId],
    queryFn: async () => {
      const res = await authenticatedFetch(`/api-gateway/applications/${appId}/workspace-roster`);
      if (!res.ok) throw new Error("Failed to fetch workspace roster");
      return res.json();
    },
  });

  function openPolicyEditor() {
    if (!roster) return;
    setDraftBranch(roster.policy.qaBranchName);
    setDraftBase(roster.policy.qaBranchBase);
    setDraftEnforcement(roster.policy.enforcement);
    setDraftAllowAgent(roster.policy.allowAgentCheckout);
    setPolicyError(null);
    setIsEditing(true);
  }

  async function savePolicy(e: React.FormEvent) {
    e.preventDefault();
    setIsSavingPolicy(true);
    setPolicyError(null);
    try {
      const res = await authenticatedFetch(`/api-gateway/applications/${appId}/repository-binding`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          qaBranchName: draftBranch.trim(),
          qaBranchBase: draftBase.trim(),
          enforcement: draftEnforcement,
          allowAgentCheckout: draftAllowAgent,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || body.error || "Failed to save branch policy");
      }
      setIsEditing(false);
      await queryClient.invalidateQueries({ queryKey: ["workspace-roster", appId] });
    } catch (err: any) {
      setPolicyError(err.message || "Failed to save branch policy");
    } finally {
      setIsSavingPolicy(false);
    }
  }

  if (isLoading) {
    return <div className="h-40 rounded border border-[#262626] bg-black animate-pulse" />;
  }

  const policy = roster?.policy;
  const workspaces = roster?.workspaces ?? [];
  const mismatched = workspaces.filter((entry) => entry.status === "BRANCH_MISMATCH").length;

  return (
    <div className="rounded border border-[#262626] bg-black p-4 space-y-4">
      {/* QA branch policy — identical for every member of the organisation */}
      <div className="space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#262626] pb-2.5">
          <span className="text-[11px] font-mono tracking-[.08em] uppercase text-[#8e9192]">
            QA REVIEW BRANCH POLICY
          </span>
          <div className="flex items-center gap-2">
            <span
              className={`border px-2 py-0.5 text-[10px] font-mono tracking-[.08em] uppercase ${
                policy?.enforcement === "BLOCK" ? "border-white text-white" : "border-[#444748] text-[#8e9192]"
              }`}
            >
              {policy?.enforcement === "BLOCK" ? "BLOCKING" : "WARN ONLY"}
            </span>
            {canManage && !isEditing && (
              <button
                type="button"
                onClick={openPolicyEditor}
                className="px-2 py-0.5 rounded border border-[#262626] bg-black text-[#8e9192] hover:text-white text-[10px] font-mono uppercase tracking-[.08em] transition-colors cursor-pointer"
              >
                EDIT POLICY
              </button>
            )}
          </div>
        </div>

        {isEditing ? (
          <form onSubmit={savePolicy} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[#8e9192] text-[10px] font-mono tracking-[.08em] uppercase block mb-1">
                  QA REVIEW BRANCH
                </label>
                <input
                  type="text"
                  required
                  value={draftBranch}
                  onChange={(e) => setDraftBranch(e.target.value)}
                  className="w-full rounded border border-[#262626] bg-black px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-white transition-colors"
                />
              </div>
              <div>
                <label className="text-[#8e9192] text-[10px] font-mono tracking-[.08em] uppercase block mb-1">
                  BASE BRANCH
                </label>
                <input
                  type="text"
                  required
                  value={draftBase}
                  onChange={(e) => setDraftBase(e.target.value)}
                  className="w-full rounded border border-[#262626] bg-black px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-white transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="text-[#8e9192] text-[10px] font-mono tracking-[.08em] uppercase block mb-1">
                ENFORCEMENT
              </label>
              <select
                value={draftEnforcement}
                onChange={(e) => setDraftEnforcement(e.target.value as "WARN" | "BLOCK")}
                className="w-full rounded border border-[#262626] bg-black px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-white transition-colors"
              >
                <option value="WARN">WARN — flag members on the wrong branch</option>
                <option value="BLOCK">BLOCK — stop QA runs off the review branch</option>
              </select>
            </div>

            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={draftAllowAgent}
                onChange={(e) => setDraftAllowAgent(e.target.checked)}
                className="mt-0.5 accent-white"
              />
              <span className="text-xs text-[#c4c7c8] leading-relaxed">
                Allow Tellann to switch a member&apos;s local branch for them.
                <span className="block text-[10px] font-mono text-[#8e9192] mt-0.5">
                  EACH MEMBER STILL GRANTS ACCESS PER WORKSPACE. UNCOMMITTED WORK IS STASHED, NEVER DISCARDED.
                </span>
              </span>
            </label>

            {policyError ? (
              <p className="text-[11px] font-mono text-red-400">[ERROR] {policyError}</p>
            ) : null}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-3 py-1.5 rounded border border-[#262626] bg-black text-[#8e9192] hover:text-white text-[10px] font-mono uppercase tracking-[.08em] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSavingPolicy || !draftBranch.trim() || !draftBase.trim()}
                className="px-3 py-1.5 rounded border border-white bg-white text-black text-[10px] font-mono uppercase tracking-[.08em] disabled:opacity-50 transition-colors cursor-pointer"
              >
                {isSavingPolicy ? "Saving…" : "Save Policy"}
              </button>
            </div>
          </form>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs font-mono">
            <div className="rounded border border-[#262626] bg-[#131313] p-2.5">
              <div className="text-[10px] text-[#8e9192] uppercase tracking-[.08em]">REVIEW BRANCH</div>
              <div className="text-white mt-1 truncate">{policy?.qaBranchName ?? "—"}</div>
            </div>
            <div className="rounded border border-[#262626] bg-[#131313] p-2.5">
              <div className="text-[10px] text-[#8e9192] uppercase tracking-[.08em]">BASE BRANCH</div>
              <div className="text-white mt-1 truncate">{policy?.qaBranchBase ?? "—"}</div>
            </div>
            <div className="rounded border border-[#262626] bg-[#131313] p-2.5">
              <div className="text-[10px] text-[#8e9192] uppercase tracking-[.08em]">AGENT CHECKOUT</div>
              <div className="text-white mt-1">{policy?.allowAgentCheckout ? "ALLOWED" : "DISABLED"}</div>
            </div>
          </div>
        )}

        {policy && !policy.bound ? (
          <p className="text-[11px] text-[#8e9192] font-sans leading-relaxed">
            No repository is bound yet. The first member to attach a folder in Tellann Desktop binds
            this application to their repository, and everyone else is matched against it.
          </p>
        ) : policy?.repositoryCloneUrl ? (
          <p className="text-[11px] text-[#8e9192] font-mono truncate">
            BOUND REPOSITORY: {policy.repositoryCloneUrl}
          </p>
        ) : null}
      </div>

      {/* One row per member per machine */}
      <div className="space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#262626] pb-2.5">
          <span className="text-[11px] font-mono tracking-[.08em] uppercase text-[#8e9192]">
            ATTACHED WORKSPACES
          </span>
          <span className="text-[10px] font-mono uppercase tracking-[.08em] text-[#8e9192]">
            {workspaces.length} ATTACHED
            {mismatched > 0 ? ` · ${mismatched} OFF-BRANCH` : ""}
          </span>
        </div>

        {workspaces.length === 0 ? (
          <div className="text-xs text-[#c4c7c8] leading-relaxed py-1 font-sans">
            No one has attached a local workspace yet. Launch <strong>Tellann Desktop</strong>, select
            this application, and click <em>Attach folder</em>.
          </div>
        ) : (
          <div className="space-y-2">
            {workspaces.map((entry) => {
              const chip = statusChip(entry.status, entry.blocksRun);
              return (
                <div
                  key={entry.id}
                  className={`rounded border p-3 space-y-2 ${
                    entry.isMine ? "border-[#444748] bg-[#131313]" : "border-[#262626] bg-[#131313]"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2 min-w-0">
                      <span className="text-xs font-semibold text-white truncate">
                        {ownerLabel(entry.owner)}
                      </span>
                      {entry.isMine && (
                        <span className="border border-white text-white px-1.5 py-0.5 text-[9px] font-mono tracking-[.08em] uppercase">
                          YOU
                        </span>
                      )}
                    </div>
                    <span
                      className={`border px-2 py-0.5 text-[10px] font-mono tracking-[.08em] uppercase ${chip.className}`}
                    >
                      {chip.label}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono">
                    <div>
                      <div className="text-[9px] text-[#8e9192] uppercase tracking-[.08em]">BRANCH</div>
                      <div className="text-white truncate">{entry.branch ?? "—"}</div>
                    </div>
                    <div>
                      <div className="text-[9px] text-[#8e9192] uppercase tracking-[.08em]">REVISION</div>
                      <div className="text-white truncate">{entry.revision?.slice(0, 7) ?? "—"}</div>
                    </div>
                    <div>
                      <div className="text-[9px] text-[#8e9192] uppercase tracking-[.08em]">WORKING TREE</div>
                      <div className="text-white">
                        {entry.dirty === null ? "—" : entry.dirty ? "DIRTY" : "CLEAN"}
                      </div>
                    </div>
                    <div>
                      <div className="text-[9px] text-[#8e9192] uppercase tracking-[.08em]">VS QA BRANCH</div>
                      <div className="text-white">
                        {entry.aheadCount === null && entry.behindCount === null
                          ? "—"
                          : `+${entry.aheadCount ?? 0} / -${entry.behindCount ?? 0}`}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono text-[#8e9192] uppercase tracking-[.08em]">
                    <span>{entry.packageManager ?? "UNKNOWN PM"}</span>
                    <span>·</span>
                    <span>
                      LAST SCANNED{" "}
                      {entry.lastScannedAt ? new Date(entry.lastScannedAt).toLocaleString() : "NEVER"}
                    </span>
                    {entry.agentCheckoutGranted && (
                      <>
                        <span>·</span>
                        <span className="text-white">AGENT CHECKOUT GRANTED</span>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Sub-component: Application Stats Telemetry (Black & White UI)
// ─────────────────────────────────────────────────────────────

export function ApplicationStatsStrip({ appId }: { appId: string }) {
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

export function ProgressRing({ percentage }: { percentage: number }) {
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
