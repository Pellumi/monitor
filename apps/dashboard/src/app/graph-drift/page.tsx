"use client";
import { authenticatedFetch } from '@/lib/authenticated-fetch';

import { useState, useMemo, useEffect, Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import {
  TrendingUp,
  TrendingDown,
  GitCompare,
  AlertTriangle,
  Plus,
  Minus,
  ArrowRight,
  BarChart2,
  RefreshCw,
  Info,
} from "lucide-react";
import { useSession } from "@/components/providers";

const FDRS_API = "/api-gateway";

interface GraphVersion {
  id: string;
  version: number;
  createdAt: string;
  expectedStateCount: number | null;
  expectedTransitionCount: number | null;
  expectedCoverage: number | null;
}

interface CoverageHistory {
  versionId: string;
  versionNumber: number;
  snapshotDate: string;
  stateCount: number;
  transitionCount: number;
  coverageScore: number | null;
}

interface GraphDiff {
  addedStates: string[];
  removedStates: string[];
  addedTransitions: Array<{ fromState: string; toState: string; action?: string }>;
  removedTransitions: Array<{ fromState: string; toState: string; action?: string }>;
}

interface DeclaredFlow {
  id: string;
  name: string;
  workflowType: string;
  version: number;
}

interface Application {
  id: string;
  name: string;
}

interface ApiEnvelope<T> {
  success?: boolean;
  data?: T;
}

type DiffState = string | { stateName?: string | null; name?: string | null };

type DiffTransition = {
  fromState?: string | { stateName?: string | null; name?: string | null } | null;
  toState?: string | { stateName?: string | null; name?: string | null } | null;
  fromStateName?: string | null;
  toStateName?: string | null;
  from?: string | null;
  to?: string | null;
  action?: string | null;
  fromNode?: { stateName?: string | null; name?: string | null } | null;
  toNode?: { stateName?: string | null; name?: string | null } | null;
};

interface FdrsDiffPayload {
  addedStates?: DiffState[];
  removedStates?: DiffState[];
  addedTransitions?: DiffTransition[];
  removedTransitions?: DiffTransition[];
  addedNodes?: DiffState[];
  removedNodes?: DiffState[];
  addedEdges?: DiffTransition[];
  removedEdges?: DiffTransition[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function unwrapData<T>(payload: unknown): T {
  if (isRecord(payload) && "data" in payload) {
    return payload.data as T;
  }
  return payload as T;
}

function getErrorMessage(payload: unknown, fallback: string) {
  if (isRecord(payload)) {
    const message = payload.message ?? payload.error;
    if (typeof message === "string" && message.trim()) return message;
  }
  return fallback;
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await authenticatedFetch(url, init);
  let payload: unknown = null;
  try {
    payload = await res.json();
  } catch {
    payload = null;
  }
  if (!res.ok) {
    throw new Error(getErrorMessage(payload, `Request failed with status ${res.status}`));
  }
  return unwrapData<T>(payload);
}

function stateLabel(state: DiffState): string {
  if (typeof state === "string") return state;
  return state.stateName ?? state.name ?? "Unknown state";
}

function endpointLabel(value: DiffTransition["fromState"] | DiffTransition["toState"] | undefined): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  return value.stateName ?? value.name ?? null;
}

function normalizeTransition(transition: DiffTransition) {
  return {
    fromState:
      transition.fromStateName ??
      endpointLabel(transition.fromState) ??
      transition.fromNode?.stateName ??
      transition.fromNode?.name ??
      transition.from ??
      "Unknown",
    toState:
      transition.toStateName ??
      endpointLabel(transition.toState) ??
      transition.toNode?.stateName ??
      transition.toNode?.name ??
      transition.to ??
      "Unknown",
    action: transition.action ?? undefined,
  };
}

function normalizeDiff(payload: ApiEnvelope<FdrsDiffPayload> | FdrsDiffPayload): GraphDiff {
  const data = unwrapData<FdrsDiffPayload>(payload);
  return {
    addedStates: (data.addedStates ?? data.addedNodes ?? []).map(stateLabel),
    removedStates: (data.removedStates ?? data.removedNodes ?? []).map(stateLabel),
    addedTransitions: (data.addedTransitions ?? data.addedEdges ?? []).map(normalizeTransition),
    removedTransitions: (data.removedTransitions ?? data.removedEdges ?? []).map(normalizeTransition),
  };
}

function DriftAlertBadge({ score, prevScore }: { score: number | null; prevScore: number | null }) {
  if (score === null || prevScore === null) return null;
  const delta = score - prevScore;
  if (Math.abs(delta) < 0.05) return null;

  if (delta < -0.1) {
    return (
      <span className="flex items-center gap-1 text-xs font-semibold text-red-400 bg-red-950/40 border border-red-900/40 px-2 py-0.5 rounded-full">
        <TrendingDown className="h-3 w-3" />
        {Math.abs(delta * 100).toFixed(1)}% drop
      </span>
    );
  }
  if (delta > 0) {
    return (
      <span className="flex items-center gap-1 text-xs font-semibold text-emerald-400 bg-emerald-950/40 border border-emerald-900/40 px-2 py-0.5 rounded-full">
        <TrendingUp className="h-3 w-3" />
        +{(delta * 100).toFixed(1)}%
      </span>
    );
  }
  return null;
}

function SimpleLineChart({ data }: { data: CoverageHistory[] }) {
  if (data.length < 2) {
    return (
      <div className="flex items-center justify-center h-48 text-neutral-500 text-xs">
        At least 2 versions needed to show trend
      </div>
    );
  }

  const width = 700;
  const height = 180;
  const paddingX = 40;
  const paddingY = 20;
  const chartWidth = width - paddingX * 2;
  const chartHeight = height - paddingY * 2;

  const scores = data.map((d) => d.coverageScore ?? 0);
  const minScore = Math.max(0, Math.min(...scores) - 0.05);
  const maxScore = Math.min(1, Math.max(...scores) + 0.05);

  const xScale = (i: number) => paddingX + (i / (data.length - 1)) * chartWidth;
  const yScale = (v: number) =>
    paddingY + chartHeight - ((v - minScore) / (maxScore - minScore)) * chartHeight;

  const polylinePoints = data
    .map((d, i) => `${xScale(i)},${yScale(d.coverageScore ?? 0)}`)
    .join(" ");

  const areaPath =
    `M${xScale(0)},${paddingY + chartHeight} ` +
    data.map((d, i) => `L${xScale(i)},${yScale(d.coverageScore ?? 0)}`).join(" ") +
    ` L${xScale(data.length - 1)},${paddingY + chartHeight} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-48">
      {/* Gradient fill */}
      <defs>
        <linearGradient id="coverageGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6366f1" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#6366f1" stopOpacity="0.02" />
        </linearGradient>
      </defs>

      {/* Area */}
      <path d={areaPath} fill="url(#coverageGradient)" />

      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
        const y = yScale(minScore + (maxScore - minScore) * pct);
        return (
          <g key={pct}>
            <line
              x1={paddingX}
              y1={y}
              x2={width - paddingX}
              y2={y}
              stroke="#262626"
              strokeWidth="1"
            />
            <text x={paddingX - 4} y={y + 4} fill="#525252" fontSize="9" textAnchor="end">
              {Math.round((minScore + (maxScore - minScore) * pct) * 100)}%
            </text>
          </g>
        );
      })}

      {/* Line */}
      <polyline
        points={polylinePoints}
        fill="none"
        stroke="#6366f1"
        strokeWidth="2"
        strokeLinejoin="round"
      />

      {/* Data points */}
      {data.map((d, i) => (
        <g key={d.versionId}>
          <circle
            cx={xScale(i)}
            cy={yScale(d.coverageScore ?? 0)}
            r="4"
            fill="#6366f1"
            stroke="#0a0a0a"
            strokeWidth="2"
          />
          <text
            x={xScale(i)}
            y={paddingY + chartHeight + 14}
            fill="#525252"
            fontSize="9"
            textAnchor="middle"
          >
            v{d.versionNumber}
          </text>
        </g>
      ))}
    </svg>
  );
}

function GraphDriftContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { selectedOrgId } = useSession();
  const appIdFromUrl = searchParams.get("appId");

  const [selectedFlowId, setSelectedFlowId] = useState<string>("");
  const [fromVersionId, setFromVersionId] = useState<string>("");
  const [toVersionId, setToVersionId] = useState<string>("");
  const [showDiff, setShowDiff] = useState(false);

  const { data: apps = [], isLoading: isAppsLoading, error: appsError } = useQuery<Application[]>({
    queryKey: ["graph-drift-apps", selectedOrgId],
    queryFn: async () => {
      if (!selectedOrgId) return [];
      return requestJson<Application[]>(`${FDRS_API}/organizations/${selectedOrgId}/applications`);
    },
    enabled: !!selectedOrgId,
  });

  const activeApp = useMemo(
    () => apps.find((app) => app.id === appIdFromUrl) ?? apps[0] ?? null,
    [apps, appIdFromUrl],
  );
  const appId = appIdFromUrl ?? activeApp?.id ?? "";

  useEffect(() => {
    if (!appIdFromUrl && activeApp?.id) {
      const params = new URLSearchParams(searchParams.toString());
      params.set("appId", activeApp.id);
      router.replace(`/graph-drift?${params.toString()}`);
    }
  }, [activeApp?.id, appIdFromUrl, router, searchParams]);

  const { data: flows = [], isLoading: isFlowsLoading, error: flowsError } = useQuery<DeclaredFlow[]>({
    queryKey: ["declared-flows-drift", appId],
    queryFn: async () => requestJson<DeclaredFlow[]>(`${FDRS_API}/applications/${appId}/declared-flow`),
    enabled: !!appId,
  });

  useEffect(() => {
    if (!flows.length) {
      setSelectedFlowId("");
      setFromVersionId("");
      setToVersionId("");
      setShowDiff(false);
      return;
    }
    if (!flows.some((flow) => flow.id === selectedFlowId)) {
      setSelectedFlowId(flows[0].id);
      setFromVersionId("");
      setToVersionId("");
      setShowDiff(false);
    }
  }, [flows, selectedFlowId]);

  const { data: coverageHistory = [], isLoading: isHistoryLoading, error: historyError } = useQuery<CoverageHistory[]>({
    queryKey: ["coverage-history", appId, selectedFlowId],
    queryFn: async () => requestJson<CoverageHistory[]>(`${FDRS_API}/applications/${appId}/declared-flow/${selectedFlowId}/coverage-history`),
    enabled: !!appId && !!selectedFlowId,
  });

  const { data: versions = [], isLoading: isVersionsLoading, error: versionsError } = useQuery<GraphVersion[]>({
    queryKey: ["graph-versions-drift", appId, selectedFlowId],
    queryFn: async () => requestJson<GraphVersion[]>(`${FDRS_API}/applications/${appId}/declared-flow/${selectedFlowId}/versions`),
    enabled: !!appId && !!selectedFlowId,
  });

  const sortedVersions = useMemo(
    () => [...versions].sort((a, b) => a.version - b.version),
    [versions],
  );

  useEffect(() => {
    if (sortedVersions.length < 2) {
      setFromVersionId("");
      setToVersionId("");
      setShowDiff(false);
      return;
    }

    const hasFrom = sortedVersions.some((version) => version.id === fromVersionId);
    const hasTo = sortedVersions.some((version) => version.id === toVersionId);
    if (!hasFrom) setFromVersionId(sortedVersions[0].id);
    if (!hasTo) setToVersionId(sortedVersions[sortedVersions.length - 1].id);
  }, [fromVersionId, sortedVersions, toVersionId]);

  const {
    data: diff,
    isFetching: isDiffLoading,
    error: diffError,
    refetch: refetchDiff,
  } = useQuery<GraphDiff>({
    queryKey: ["graph-diff", appId, selectedFlowId, fromVersionId, toVersionId],
    queryFn: async () => {
      const params = new URLSearchParams({ from: fromVersionId, to: toVersionId });
      const payload = await requestJson<ApiEnvelope<FdrsDiffPayload> | FdrsDiffPayload>(
        `${FDRS_API}/applications/${appId}/declared-flow/${selectedFlowId}/versions/diff?${params.toString()}`,
      );
      return normalizeDiff(payload);
    },
    enabled: false,
  });

  // Detect coverage regressions
  const driftAlerts = useMemo(() => {
    if (!coverageHistory || coverageHistory.length < 2) return [];
    const alerts = [];
    for (let i = 1; i < coverageHistory.length; i++) {
      const prev = coverageHistory[i - 1];
      const curr = coverageHistory[i];
      if (
        curr.coverageScore !== null &&
        prev.coverageScore !== null &&
        curr.coverageScore - prev.coverageScore < -0.1
      ) {
        alerts.push({
          fromVersion: prev.versionNumber,
          toVersion: curr.versionNumber,
          delta: curr.coverageScore - prev.coverageScore,
        });
      }
    }
    return alerts;
  }, [coverageHistory]);

  function handleCompare() {
    if (!fromVersionId || !toVersionId || fromVersionId === toVersionId) return;
    setShowDiff(true);
    void refetchDiff();
  }

  const selectedFlow = flows.find((f) => f.id === selectedFlowId);
  const selectedAppName = apps.find((app) => app.id === appId)?.name ?? activeApp?.name ?? "Selected application";
  const loadError = appsError ?? flowsError ?? historyError ?? versionsError;

  if (!selectedOrgId) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <div className="border border-neutral-800 bg-neutral-900 rounded-xl p-8 text-sm text-neutral-400">
          No organization is selected.
        </div>
      </div>
    );
  }

  if (isAppsLoading) {
    return (
      <div className="p-6 flex items-center gap-2 text-neutral-500 text-sm">
        <RefreshCw className="h-4 w-4 animate-spin" />
        Loading applications...
      </div>
    );
  }

  if (!appId) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <div className="border border-neutral-800 bg-neutral-900 rounded-xl p-8 text-sm text-neutral-400">
          No applications are available for this organization.
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-indigo-400" />
            Graph Drift
          </h1>
          <p className="text-sm text-neutral-400 mt-1">
            {selectedAppName} behavioral graph coverage over time and version comparisons.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <label className="text-xs text-neutral-400 font-medium" htmlFor="flow-selector">Flow</label>
          <select
            id="flow-selector"
            value={selectedFlowId}
            onChange={(e) => {
              setSelectedFlowId(e.target.value);
              setShowDiff(false);
              setFromVersionId("");
              setToVersionId("");
            }}
            disabled={isFlowsLoading || flows.length === 0}
            className="bg-neutral-900 text-white border border-neutral-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-indigo-500 disabled:opacity-60"
          >
            {isFlowsLoading && <option>Loading...</option>}
            {!isFlowsLoading && flows.length === 0 && <option>No declared flows</option>}
            {flows.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loadError instanceof Error && (
        <div className="border border-red-900/40 bg-red-950/20 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-300">Graph drift data failed to load</p>
            <p className="mt-1 text-xs text-red-400/80">{loadError.message}</p>
          </div>
        </div>
      )}

      {driftAlerts.length > 0 && (
        <div className="border border-amber-900/40 bg-amber-950/20 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-300">Coverage Regression Detected</p>
            <div className="mt-1 space-y-1">
              {driftAlerts.map((a, i) => (
                <p key={i} className="text-xs text-amber-400/80">
                  Version v{a.fromVersion} → v{a.toVersion}: coverage dropped by{" "}
                  {Math.abs(a.delta * 100).toFixed(1)}%
                </p>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="xl:col-span-2 space-y-6">
          {/* Coverage Trend Chart */}
          <div className="border border-neutral-800 bg-neutral-900 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-semibold text-white">Coverage Trend</h2>
                <p className="text-xs text-neutral-500 mt-0.5">
                  {selectedFlow ? `${selectedFlow.name} expected state coverage` : "Expected state coverage"}
                </p>
              </div>
              {isHistoryLoading && (
                <RefreshCw className="h-4 w-4 text-neutral-500 animate-spin" />
              )}
            </div>

            {coverageHistory && coverageHistory.length > 0 ? (
              <SimpleLineChart data={coverageHistory} />
            ) : (
              <div className="flex flex-col items-center justify-center h-48 text-neutral-600 text-xs gap-2">
                <BarChart2 className="h-8 w-8 opacity-30" />
                <p>No version history available yet</p>
                <p className="text-neutral-700">Complete multiple flow declarations to see trends</p>
              </div>
            )}
          </div>

          {/* Version Diff Panel */}
          <div className="border border-neutral-800 bg-neutral-900 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <GitCompare className="h-4 w-4 text-indigo-400" />
              Version Comparison
            </h2>

            <div className="flex flex-col gap-3 lg:flex-row lg:items-end mb-4">
              <div className="flex-1">
                <label className="text-xs text-neutral-500 mb-1 block" htmlFor="from-version-selector">From version</label>
                <select
                  id="from-version-selector"
                  value={fromVersionId}
                  onChange={(e) => {
                    setFromVersionId(e.target.value);
                    setShowDiff(false);
                  }}
                  disabled={sortedVersions.length < 2 || isVersionsLoading}
                  className="w-full bg-neutral-950 text-white border border-neutral-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-indigo-500 disabled:opacity-60"
                >
                  <option value="">Select version...</option>
                  {sortedVersions.map((v) => (
                    <option key={v.id} value={v.id}>
                      v{v.version} — {new Date(v.createdAt).toLocaleDateString()}
                      {v.expectedStateCount != null ? ` (${v.expectedStateCount} states)` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <ArrowRight className="hidden h-4 w-4 text-neutral-600 flex-shrink-0 mb-2 lg:block" />

              <div className="flex-1">
                <label className="text-xs text-neutral-500 mb-1 block" htmlFor="to-version-selector">To version</label>
                <select
                  id="to-version-selector"
                  value={toVersionId}
                  onChange={(e) => {
                    setToVersionId(e.target.value);
                    setShowDiff(false);
                  }}
                  disabled={sortedVersions.length < 2 || isVersionsLoading}
                  className="w-full bg-neutral-950 text-white border border-neutral-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-indigo-500 disabled:opacity-60"
                >
                  <option value="">Select version...</option>
                  {sortedVersions.map((v) => (
                    <option key={v.id} value={v.id}>
                      v{v.version} — {new Date(v.createdAt).toLocaleDateString()}
                      {v.expectedStateCount != null ? ` (${v.expectedStateCount} states)` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <button
                id="compare-versions-btn"
                onClick={handleCompare}
                disabled={!fromVersionId || !toVersionId || fromVersionId === toVersionId || isDiffLoading}
                className="flex items-center justify-center gap-2 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors flex-shrink-0"
              >
                {isDiffLoading ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <GitCompare className="h-3.5 w-3.5" />
                )}
                Compare
              </button>
            </div>

            {showDiff && diffError instanceof Error && (
              <div className="flex items-center gap-2 text-xs text-red-400 border border-red-900/40 bg-red-950/20 rounded-lg px-4 py-3 mb-4">
                <AlertTriangle className="h-4 w-4" />
                {diffError.message}
              </div>
            )}

            {showDiff && diff && (
              <div className="space-y-4">
                {/* Summary badges */}
                <div className="flex flex-wrap gap-2">
                  <span className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-emerald-950/40 border border-emerald-900/40 text-emerald-400">
                    <Plus className="h-3 w-3" />
                    {diff.addedStates.length} states added
                  </span>
                  <span className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-red-950/40 border border-red-900/40 text-red-400">
                    <Minus className="h-3 w-3" />
                    {diff.removedStates.length} states removed
                  </span>
                  <span className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-blue-950/40 border border-blue-900/40 text-blue-400">
                    <Plus className="h-3 w-3" />
                    {diff.addedTransitions.length} transitions added
                  </span>
                  <span className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-orange-950/40 border border-orange-900/40 text-orange-400">
                    <Minus className="h-3 w-3" />
                    {diff.removedTransitions.length} transitions removed
                  </span>
                </div>

                {/* States diff */}
                {(diff.addedStates.length > 0 || diff.removedStates.length > 0) && (
                  <div className="grid grid-cols-2 gap-4">
                    {diff.addedStates.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-emerald-400 mb-2 uppercase tracking-wider">
                          Added States
                        </p>
                        <div className="space-y-1">
                          {diff.addedStates.map((s) => (
                            <div
                              key={s}
                              className="flex items-center gap-2 text-xs text-emerald-300 bg-emerald-950/20 px-2.5 py-1.5 rounded-md border border-emerald-900/20"
                            >
                              <Plus className="h-3 w-3 flex-shrink-0" />
                              {s}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {diff.removedStates.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-red-400 mb-2 uppercase tracking-wider">
                          Removed States
                        </p>
                        <div className="space-y-1">
                          {diff.removedStates.map((s) => (
                            <div
                              key={s}
                              className="flex items-center gap-2 text-xs text-red-300 bg-red-950/20 px-2.5 py-1.5 rounded-md border border-red-900/20 line-through opacity-75"
                            >
                              <Minus className="h-3 w-3 flex-shrink-0 no-underline" />
                              {s}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Transitions diff */}
                {(diff.addedTransitions.length > 0 || diff.removedTransitions.length > 0) && (
                  <div className="grid grid-cols-2 gap-4">
                    {diff.addedTransitions.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-blue-400 mb-2 uppercase tracking-wider">
                          Added Transitions
                        </p>
                        <div className="space-y-1">
                          {diff.addedTransitions.slice(0, 10).map((t, i) => (
                            <div
                              key={i}
                              className="flex items-center gap-1.5 text-xs text-blue-300 bg-blue-950/20 px-2.5 py-1.5 rounded-md border border-blue-900/20"
                            >
                              <span className="truncate">{t.fromState}</span>
                              <ArrowRight className="h-3 w-3 flex-shrink-0" />
                              <span className="truncate">{t.toState}</span>
                            </div>
                          ))}
                          {diff.addedTransitions.length > 10 && (
                            <p className="text-xs text-neutral-600 px-2">
                              +{diff.addedTransitions.length - 10} more…
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                    {diff.removedTransitions.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-orange-400 mb-2 uppercase tracking-wider">
                          Removed Transitions
                        </p>
                        <div className="space-y-1">
                          {diff.removedTransitions.slice(0, 10).map((t, i) => (
                            <div
                              key={i}
                              className="flex items-center gap-1.5 text-xs text-orange-300/70 bg-orange-950/20 px-2.5 py-1.5 rounded-md border border-orange-900/20 opacity-75"
                            >
                              <span className="truncate line-through">{t.fromState}</span>
                              <ArrowRight className="h-3 w-3 flex-shrink-0" />
                              <span className="truncate line-through">{t.toState}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {diff.addedStates.length === 0 &&
                  diff.removedStates.length === 0 &&
                  diff.addedTransitions.length === 0 &&
                  diff.removedTransitions.length === 0 && (
                    <div className="flex items-center gap-2 text-xs text-neutral-500 border border-neutral-800 rounded-lg px-4 py-3">
                      <Info className="h-4 w-4" />
                      No structural changes between these versions
                    </div>
                  )}
              </div>
            )}

            {!showDiff && (
              <div className="flex items-center gap-2 text-xs text-neutral-600 border border-neutral-800 border-dashed rounded-lg px-4 py-6 justify-center">
                <GitCompare className="h-4 w-4" />
                Select two versions and click Compare to see the diff
              </div>
            )}
          </div>
        </div>

        {/* Right sidebar — Version List */}
        <div className="space-y-4">
          <div className="border border-neutral-800 bg-neutral-900 rounded-xl p-4">
            <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-3">
              Version History
            </h3>

            {!versions || versions.length === 0 ? (
              <p className="text-xs text-neutral-600">No versions recorded yet</p>
            ) : (
              <div className="space-y-2">
                {[...versions]
                  .sort((a, b) => b.version - a.version)
                  .map((v, i, arr) => {
                    const history = coverageHistory?.find((h) => h.versionId === v.id);
                    const prevHistory =
                      i < arr.length - 1
                        ? coverageHistory?.find((h) => h.versionId === arr[i + 1].id)
                        : null;

                    return (
                      <div
                        key={v.id}
                        id={`version-${v.version}`}
                        className="border border-neutral-800 bg-neutral-950 rounded-lg p-3 space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-white">v{v.version}</span>
                          {history?.coverageScore != null && prevHistory?.coverageScore != null && (
                            <DriftAlertBadge
                              score={history.coverageScore}
                              prevScore={prevHistory.coverageScore}
                            />
                          )}
                        </div>
                        <p className="text-[10px] text-neutral-600">
                          {new Date(v.createdAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </p>
                        <div className="flex gap-3 text-[10px] text-neutral-500">
                          {v.expectedStateCount != null && (
                            <span>{v.expectedStateCount} states</span>
                          )}
                          {v.expectedTransitionCount != null && (
                            <span>{v.expectedTransitionCount} transitions</span>
                          )}
                        </div>
                        {history?.coverageScore != null && (
                          <div className="mt-1.5">
                            <div className="flex justify-between text-[10px] mb-0.5">
                              <span className="text-neutral-500">Coverage</span>
                              <span
                                className={
                                  history.coverageScore >= 0.7
                                    ? "text-emerald-400"
                                    : history.coverageScore >= 0.4
                                    ? "text-amber-400"
                                    : "text-red-400"
                                }
                              >
                                {(history.coverageScore * 100).toFixed(0)}%
                              </span>
                            </div>
                            <div className="h-1 bg-neutral-800 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  history.coverageScore >= 0.7
                                    ? "bg-emerald-500"
                                    : history.coverageScore >= 0.4
                                    ? "bg-amber-500"
                                    : "bg-red-500"
                                }`}
                                style={{ width: `${history.coverageScore * 100}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}
          </div>

          {/* Drift Summary */}
          {driftAlerts.length > 0 && (
            <div className="border border-neutral-800 bg-neutral-900 rounded-xl p-4">
              <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                Drift Alerts
              </h3>
              <div className="space-y-2">
                {driftAlerts.map((a, i) => (
                  <div
                    key={i}
                    className="text-xs border border-amber-900/30 bg-amber-950/10 rounded-lg px-3 py-2"
                  >
                    <p className="text-amber-300 font-medium">
                      v{a.fromVersion} → v{a.toVersion}
                    </p>
                    <p className="text-amber-500/70 mt-0.5">
                      ↓ {Math.abs(a.delta * 100).toFixed(1)}% coverage
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function GraphDriftPage() {
  return (
    <Suspense
      fallback={
        <div className="p-6 flex items-center gap-2 text-neutral-500 text-sm">
          <RefreshCw className="h-4 w-4 animate-spin" />
          Loading graph drift…
        </div>
      }
    >
      <GraphDriftContent />
    </Suspense>
  );
}
