'use client';

import { useState, useMemo, Suspense } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  GitCompare,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  Download,
  Info,
  Layers,
  ArrowRight,
  RefreshCw,
  GitPullRequest,
} from 'lucide-react';

const FDRS_API = '/api-gateway';

interface DeclaredFlow {
  id: string;
  name: string;
  status: 'DRAFT' | 'COMPLETE';
  version: number;
  workflowType: string;
}

interface ReconciliationReport {
  flowId: string;
  applicationId: string;
  confirmedCount: number;
  trueGapCount: number;
  undeclaredCount: number;
  expectedCoverageScore: number;
  trueGaps: Array<{ stateName: string; provenance: string; declaredById: string | null }>;
  undeclared: Array<{ stateName: string; observationCount: number }>;
  confirmedTransitions: number;
  trueGapTransitions: number;
  undeclaredTransitions: number;
  transitionCoverageScore: number;
  trueGapTransitionsList: Array<{ fromStateId: string; toStateId: string; fromStateName: string; toStateName: string; action: string | null }>;
  undeclaredTransitionsList: Array<{ fromStateName: string; toStateName: string; observationCount: number }>;
  generatedAt: string;
  flow: DeclaredFlow;
}

function ReconciliationContent() {
  const searchParams = useSearchParams();
  const appId = searchParams.get('appId') ?? 'acadai-local';
  const queryClient = useQueryClient();

  const [activeTabFlowId, setActiveTabFlowId] = useState<string>('');

  // ─────────────────────────────────────────────────────────────
  // Queries
  // ─────────────────────────────────────────────────────────────

  // Fetch all declared flows (completed ones only for tabs)
  const { data: flows, isLoading: isFlowsLoading } = useQuery<DeclaredFlow[]>({
    queryKey: ['reconciliation-flows', appId],
    queryFn: async () => {
      const res = await fetch(`${FDRS_API}/applications/${appId}/declared-flow`);
      if (!res.ok) throw new Error('Failed to fetch declared flows');
      const data: DeclaredFlow[] = await res.json();
      return data.filter((f) => f.status === 'COMPLETE');
    },
  });

  // Fetch reconciliation reports
  const { data: reports, isLoading: isReportsLoading, refetch: refetchReports } = useQuery<ReconciliationReport[]>({
    queryKey: ['reconciliation-reports-detail', appId],
    queryFn: async () => {
      const res = await fetch(`${FDRS_API}/applications/${appId}/reconciliation`);
      if (!res.ok) throw new Error('Failed to fetch reconciliation reports');
      return res.json();
    },
  });

  // Set the default tab once flows are loaded
  useMemo(() => {
    if (flows && flows.length > 0 && !activeTabFlowId) {
      setActiveTabFlowId(flows[0].id);
    }
  }, [flows, activeTabFlowId]);

  const activeReport = useMemo(() => {
    return reports?.find((r) => r.flowId === activeTabFlowId);
  }, [reports, activeTabFlowId]);

  // ─────────────────────────────────────────────────────────────
  // Mutations
  // ─────────────────────────────────────────────────────────────

  const runReconciliationMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${FDRS_API}/applications/${appId}/reconciliation/run`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed to run reconciliation');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reconciliation-reports-detail', appId] });
    },
  });

  const promoteStateMutation = useMutation({
    mutationFn: async (data: { stateName: string; accepted: boolean }) => {
      const res = await fetch(`${FDRS_API}/applications/${appId}/declared-flow/${activeTabFlowId}/promote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to promote state');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reconciliation-reports-detail', appId] });
    },
  });

  if (isFlowsLoading || isReportsLoading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="text-neutral-400 animate-pulse text-lg">Loading reconciliation report…</div>
      </div>
    );
  }

  const triggerExport = (format: string) => {
    window.location.href = `${FDRS_API}/applications/${appId}/reconciliation/export?format=${format}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-neutral-800 pb-5">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center space-x-3">
            <GitCompare className="h-8 w-8 text-blue-400" />
            <span>Behavioral Reconciliation</span>
          </h1>
          <p className="mt-1 text-sm text-neutral-400">
            Reconcile top-down intent flows against observed bottom-up telemetry and handle promotion.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => runReconciliationMutation.mutate()}
            disabled={runReconciliationMutation.isPending}
            className="flex items-center space-x-1.5 rounded-lg border border-neutral-800 bg-neutral-950 hover:bg-neutral-900 px-4 py-2 text-xs font-semibold text-white transition-colors mr-2"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${runReconciliationMutation.isPending ? 'animate-spin' : ''}`} />
            <span>{runReconciliationMutation.isPending ? 'Reconciling…' : 'Run Reconciliation'}</span>
          </button>

          {[
            { label: 'Export CSV', format: 'csv' },
            { label: 'Export JSON', format: 'json' },
          ].map((btn) => (
            <button
              key={btn.format}
              onClick={() => triggerExport(btn.format)}
              className="flex items-center space-x-1.5 rounded-lg border border-neutral-800 bg-neutral-900/60 hover:bg-neutral-850 px-4 py-2 text-xs font-semibold text-neutral-300 transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              <span>{btn.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tabs */}
      {flows && flows.length > 0 ? (
        <div className="space-y-6">
          <div className="border-b border-neutral-800">
            <nav className="-mb-px flex space-x-8" aria-label="Tabs">
              {flows.map((flow) => {
                const isActive = activeTabFlowId === flow.id;
                return (
                  <button
                    key={flow.id}
                    onClick={() => setActiveTabFlowId(flow.id)}
                    className={`border-b-2 py-4 px-1 text-sm font-semibold whitespace-nowrap transition-colors ${
                      isActive
                        ? 'border-blue-500 text-blue-400 font-bold'
                        : 'border-transparent text-neutral-500 hover:border-neutral-700 hover:text-neutral-300'
                    }`}
                  >
                    {flow.name} (v{flow.version})
                  </button>
                );
              })}
            </nav>
          </div>

          {activeReport ? (
            <div className="space-y-6">
              {/* Hero KPI Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-6 backdrop-blur-xl flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                      State Coverage (Expected Score)
                    </span>
                    <div className="mt-2 text-4xl font-black text-white font-mono">
                      {(activeReport.expectedCoverageScore * 100).toFixed(1)}%
                    </div>
                    <p className="text-xs text-neutral-400 mt-2">
                      {activeReport.confirmedCount} confirmed states, {activeReport.trueGapCount} true gaps
                    </p>
                  </div>
                  <div className="h-12 w-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400">
                    <CheckCircle className="h-6 w-6" />
                  </div>
                </div>

                <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-6 backdrop-blur-xl flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                      Transition Coverage KPI
                    </span>
                    <div className="mt-2 text-4xl font-black text-white font-mono">
                      {(activeReport.transitionCoverageScore * 100).toFixed(1)}%
                    </div>
                    <p className="text-xs text-neutral-400 mt-2">
                      {activeReport.confirmedTransitions} confirmed edges, {activeReport.trueGapTransitions} true gaps
                    </p>
                  </div>
                  <div className="h-12 w-12 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400">
                    <GitPullRequest className="h-6 w-6" />
                  </div>
                </div>
              </div>

              {/* Three-way breakdown cards */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* LEFT: Gaps & Promotion (States) */}
                <div className="space-y-6">
                  {/* True Gaps (States) */}
                  <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6 space-y-4">
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                      <AlertCircle className="h-5 w-5 text-red-400" />
                      <span>Missing Expected States (True Gaps) ({activeReport.trueGapCount})</span>
                    </h3>
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                      {activeReport.trueGaps.map((gap) => (
                        <div
                          key={gap.stateName}
                          className="flex justify-between items-center text-xs bg-neutral-950 p-4 rounded-xl border border-red-950/30 text-neutral-300"
                        >
                          <div>
                            <span className="font-mono font-bold text-red-400">{gap.stateName}</span>
                            <p className="text-[10px] text-neutral-500 mt-1">Source: {gap.provenance}</p>
                          </div>
                          <span className="text-[10px] text-neutral-400 font-semibold bg-neutral-900 px-2 py-0.5 rounded border border-neutral-800">
                            Required State
                          </span>
                        </div>
                      ))}
                      {activeReport.trueGapCount === 0 && (
                        <p className="text-xs text-neutral-500 text-center py-6">All expected states observed successfully!</p>
                      )}
                    </div>
                  </div>

                  {/* Undeclared States & Promotion */}
                  <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6 space-y-4">
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-amber-400" />
                      <span>Undeclared States Observed ({activeReport.undeclaredCount})</span>
                    </h3>
                    <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                      {activeReport.undeclared.map((und) => (
                        <div
                          key={und.stateName}
                          className="border border-neutral-800 bg-neutral-950 p-4 rounded-xl flex items-center justify-between"
                        >
                          <div>
                            <span className="font-mono text-sm font-semibold text-white">{und.stateName}</span>
                            <div className="text-[10px] text-neutral-500 mt-1">
                              {und.observationCount} visits in observed telemetry
                            </div>
                          </div>
                          <div className="flex space-x-2">
                            <button
                              onClick={() =>
                                promoteStateMutation.mutate({
                                  stateName: und.stateName,
                                  accepted: true,
                                })
                              }
                              className="rounded bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 text-xs font-semibold transition-colors flex items-center space-x-1"
                            >
                              <span>Promote</span>
                              <ArrowRight className="h-3 w-3" />
                            </button>
                            <button
                              onClick={() =>
                                promoteStateMutation.mutate({
                                  stateName: und.stateName,
                                  accepted: false,
                                })
                              }
                              className="rounded border border-neutral-800 bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white px-3 py-1.5 text-xs font-semibold transition-colors"
                            >
                              Ignore
                            </button>
                          </div>
                        </div>
                      ))}
                      {activeReport.undeclaredCount === 0 && (
                        <p className="text-xs text-neutral-500 text-center py-6">No undeclared states observed.</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* RIGHT: Transitions (Edges) */}
                <div className="space-y-6">
                  {/* True Gap Transitions */}
                  <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6 space-y-4">
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                      <AlertCircle className="h-5 w-5 text-purple-400" />
                      <span>True Gap Transitions ({activeReport.trueGapTransitions})</span>
                    </h3>
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                      {activeReport.trueGapTransitionsList.map((trans, idx) => (
                        <div
                          key={idx}
                          className="text-xs bg-neutral-950 p-4 rounded-xl border border-purple-950/30 text-neutral-300 space-y-1"
                        >
                          <div className="flex items-center space-x-2">
                            <span className="font-mono text-neutral-400">{trans.fromStateName}</span>
                            <ArrowRight className="h-3.5 w-3.5 text-purple-400 flex-shrink-0" />
                            <span className="font-mono text-purple-400 font-bold">{trans.toStateName}</span>
                          </div>
                          {trans.action && (
                            <p className="text-[10px] text-neutral-500">Action: {trans.action}</p>
                          )}
                        </div>
                      ))}
                      {activeReport.trueGapTransitions === 0 && (
                        <p className="text-xs text-neutral-500 text-center py-6">All expected transitions observed successfully!</p>
                      )}
                    </div>
                  </div>

                  {/* Undeclared Transitions (Bypasses) */}
                  <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6 space-y-4">
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-amber-400" />
                      <span>Undeclared Transitions (Bypasses) ({activeReport.undeclaredTransitions})</span>
                    </h3>
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                      {activeReport.undeclaredTransitionsList.map((trans, idx) => (
                        <div
                          key={idx}
                          className="text-xs bg-neutral-950 p-4 rounded-xl border border-amber-950/20 text-neutral-300 flex items-center justify-between"
                        >
                          <div className="flex items-center space-x-2">
                            <span className="font-mono text-neutral-400">{trans.fromStateName}</span>
                            <ArrowRight className="h-3.5 w-3.5 text-amber-400 flex-shrink-0" />
                            <span className="font-mono text-amber-400 font-bold">{trans.toStateName}</span>
                          </div>
                          <span className="text-[10px] text-neutral-500 font-mono font-semibold bg-neutral-900 px-2 py-0.5 rounded border border-neutral-850">
                            {trans.observationCount} count
                          </span>
                        </div>
                      ))}
                      {activeReport.undeclaredTransitions === 0 && (
                        <p className="text-xs text-neutral-500 text-center py-6">No unexpected workflow transitions observed.</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-12 rounded-2xl border border-neutral-850 bg-neutral-900/30 text-center space-y-4">
              <Info className="h-10 w-10 text-neutral-600" />
              <div className="max-w-md">
                <h3 className="text-lg font-bold text-white">No Reconciliation Report Found</h3>
                <p className="text-xs text-neutral-400 mt-2">
                  We have not reconciled telemetry for this flow yet. Trigger reconciliation manually above or run telemetry events to automatically reconcile.
                </p>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center p-16 rounded-2xl border border-dashed border-neutral-800 bg-neutral-900/10 text-center space-y-6">
          <div className="h-16 w-16 rounded-2xl bg-neutral-950 flex items-center justify-center border border-neutral-800 text-neutral-500">
            <Layers className="h-8 w-8" />
          </div>
          <div className="max-w-sm space-y-2">
            <h3 className="text-lg font-bold text-white">No Completed Flows Declared</h3>
            <p className="text-xs text-neutral-400">
              Before you can reconcile telemetry, you need to build and mark at least one flow as complete.
            </p>
          </div>
          <Link
            href={`/declare?appId=${appId}`}
            className="flex items-center space-x-2 rounded-xl bg-blue-600 hover:bg-blue-500 px-5 py-2.5 text-xs font-semibold text-white transition-colors"
          >
            <span>Go to Flow Declaration Builder</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}
    </div>
  );
}

export default function ReconciliationPage() {
  return (
    <Suspense fallback={<div className="text-neutral-400 animate-pulse">Loading reconciliation report…</div>}>
      <ReconciliationContent />
    </Suspense>
  );
}
