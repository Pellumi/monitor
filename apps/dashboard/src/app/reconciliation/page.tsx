'use client';
import { authenticatedFetch } from '@/lib/authenticated-fetch';
import { Button } from '@/components/ui/button';

import { useState, useMemo, Suspense } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSelectedApplication } from '@/hooks/use-selected-application';
import { ApplicationRequiredState } from '@/components/application-required-state';
import { EmptyState } from '@/components/empty-state';
import {
  GitCompare,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  Download,
  ArrowRight,
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
  const {
    appId,
    selectedOrgId,
    isLoading: isApplicationsLoading,
    error: applicationsError,
  } = useSelectedApplication();
  const queryClient = useQueryClient();

  const [activeTabFlowId, setActiveTabFlowId] = useState<string>('');

  // ─────────────────────────────────────────────────────────────
  // Queries
  // ─────────────────────────────────────────────────────────────

  // Fetch all declared flows (completed ones only for tabs)
  const { data: flows, isLoading: isFlowsLoading } = useQuery<DeclaredFlow[]>({
    queryKey: ['reconciliation-flows', appId],
    queryFn: async () => {
      const res = await authenticatedFetch(`${FDRS_API}/applications/${appId}/declared-flow`);
      if (!res.ok) throw new Error('Failed to fetch declared flows');
      const data: DeclaredFlow[] = await res.json();
      return data.filter((f) => f.status === 'COMPLETE');
    },
    enabled: !!appId,
  });

  // Fetch reconciliation reports
  const { data: reports, isLoading: isReportsLoading } = useQuery<ReconciliationReport[]>({
    queryKey: ['reconciliation-reports-detail', appId],
    queryFn: async () => {
      const res = await authenticatedFetch(`${FDRS_API}/applications/${appId}/reconciliation`);
      if (!res.ok) throw new Error('Failed to fetch reconciliation reports');
      return res.json();
    },
    enabled: !!appId,
  });

  const selectedFlowId =
    flows?.some((flow) => flow.id === activeTabFlowId)
      ? activeTabFlowId
      : flows?.[0]?.id ?? '';

  const activeReport = useMemo(() => {
    return reports?.find((r) => r.flowId === selectedFlowId);
  }, [reports, selectedFlowId]);

  // ─────────────────────────────────────────────────────────────
  // Mutations
  // ─────────────────────────────────────────────────────────────

  const runReconciliationMutation = useMutation({
    mutationFn: async () => {
      const res = await authenticatedFetch(`${FDRS_API}/applications/${appId}/reconciliation/run`, {
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
      const res = await authenticatedFetch(`${FDRS_API}/applications/${appId}/declared-flow/${selectedFlowId}/promote`, {
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

function ReconciliationSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#262626] pb-5">
        <div className="space-y-2">
          <div className="h-8 w-64 bg-neutral-800 rounded-md" />
          <div className="h-4 w-96 bg-neutral-800/60 rounded-md" />
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-36 bg-neutral-800 rounded-md" />
          <div className="h-9 w-28 bg-neutral-800 rounded-md" />
          <div className="h-9 w-28 bg-neutral-800 rounded-md" />
        </div>
      </div>

      <div className="border-b border-[#262626] flex space-x-8 pb-4">
        <div className="h-5 w-32 bg-neutral-800 rounded" />
        <div className="h-5 w-28 bg-neutral-800/60 rounded" />
        <div className="h-5 w-36 bg-neutral-800/60 rounded" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[1, 2].map((i) => (
          <div key={i} className="rounded-md border border-[#262626] bg-[#131313] p-6 flex items-center justify-between">
            <div className="space-y-3">
              <div className="h-4 w-44 bg-neutral-800/80 rounded" />
              <div className="h-9 w-24 bg-neutral-800 rounded" />
              <div className="h-3.5 w-48 bg-neutral-800/50 rounded" />
            </div>
            <div className="h-12 w-12 rounded-md bg-neutral-800" />
          </div>
        ))}
      </div>

      <div className="rounded-md border border-[#262626] bg-[#131313] p-6 space-y-4">
        <div className="h-6 w-48 bg-neutral-800 rounded" />
        <div className="h-32 bg-neutral-800/40 rounded-md" />
      </div>
    </div>
  );
}

  if (!selectedOrgId) {
    return <div className="text-neutral-400">No organization is selected.</div>;
  }
  if (isApplicationsLoading) {
    return <ReconciliationSkeleton />;
  }
  if (applicationsError) {
    return <div className="text-red-400">Error: {(applicationsError as Error).message}</div>;
  }
  if (!appId) {
    return <ApplicationRequiredState feature="Reconciliation" />;
  }
  if (isFlowsLoading || isReportsLoading) {
    return <ReconciliationSkeleton />;
  }

  const triggerExport = async (format: string) => {
    try {
      const res = await authenticatedFetch(`${FDRS_API}/applications/${appId}/reconciliation/export?format=${format}`);
      if (!res.ok) throw new Error('Export failed');
      const contentType = res.headers.get('content-type') ?? '';
      if (contentType.includes('application/json') && res.headers.get('content-disposition') === null) {
        // Presigned URL response
        const { url, filename } = await res.json() as { url: string; filename: string };
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        // Direct stream
        const blob = await res.blob();
        const objUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = objUrl;
        link.download = `reconciliation-${appId}.${format}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(objUrl);
      }
    } catch (err) {
      console.error('[Reconciliation] Export error', err);
    }
  };


  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#262626] pb-5">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center space-x-3">
            <span>Behavioral Reconciliation</span>
          </h1>
          <p className="mt-1 text-sm text-neutral-400">
            Reconcile top-down intent flows against observed bottom-up telemetry and handle promotion.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => runReconciliationMutation.mutate()}
            disabled={runReconciliationMutation.isPending}
            loading={runReconciliationMutation.isPending}
            variant="secondary"
            className="mr-2"
          >
            Run Reconciliation
          </Button>

          {[
            { label: 'Export CSV', format: 'csv' },
            { label: 'Export JSON', format: 'json' },
          ].map((btn) => (
            <Button
              key={btn.format}
              onClick={() => triggerExport(btn.format)}
              variant="secondary"
              size="sm"
            >
              <Download className="h-3.5 w-3.5" />
              <span>{btn.label}</span>
            </Button>
          ))}
        </div>
      </div>

      {/* Tabs */}
      {flows && flows.length > 0 ? (
        <div className="space-y-6">
          <div className="border-b border-[#262626]">
            <nav className="-mb-px flex space-x-8" aria-label="Tabs">
              {flows.map((flow) => {
                const isActive = selectedFlowId === flow.id;
                return (
                  <button
                    key={flow.id}
                    onClick={() => setActiveTabFlowId(flow.id)}
                    className={`border-b-2 py-4 px-1 text-sm font-semibold whitespace-nowrap transition-colors ${
                      isActive
                        ? 'border-white text-white font-bold'
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
                <div className="rounded-md border border-[#262626] bg-[#131313] p-6 backdrop-blur-xl flex items-center justify-between">
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
                  <div className="h-12 w-12 rounded-md bg-blue-500/10 flex items-center justify-center text-white">
                    <CheckCircle className="h-6 w-6" />
                  </div>
                </div>

                <div className="rounded-md border border-[#262626] bg-[#131313] p-6 backdrop-blur-xl flex items-center justify-between">
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
                  <div className="h-12 w-12 rounded-md bg-purple-500/10 flex items-center justify-center text-white">
                    <GitPullRequest className="h-6 w-6" />
                  </div>
                </div>
              </div>

              {/* Three-way breakdown cards */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* LEFT: Gaps & Promotion (States) */}
                <div className="space-y-6">
                  {/* True Gaps (States) */}
                  <div className="rounded-md border border-[#262626] bg-[#131313] p-6 space-y-4">
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                      <AlertCircle className="h-5 w-5 text-red-300" />
                      <span>Missing Expected States (True Gaps) ({activeReport.trueGapCount})</span>
                    </h3>
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                      {activeReport.trueGaps.map((gap) => (
                        <div
                          key={gap.stateName}
                          className="flex justify-between items-center text-xs bg-black p-4 rounded-md border border-red-900/40 text-neutral-300"
                        >
                          <div>
                            <span className="font-mono font-bold text-red-300">{gap.stateName}</span>
                            <p className="text-[10px] text-neutral-500 mt-1">Source: {gap.provenance}</p>
                          </div>
                          <span className="text-[10px] text-neutral-400 font-semibold bg-[#131313] px-2 py-0.5 rounded border border-[#262626]">
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
                  <div className="rounded-md border border-[#262626] bg-[#131313] p-6 space-y-4">
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-white" />
                      <span>Undeclared States Observed ({activeReport.undeclaredCount})</span>
                    </h3>
                    <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                      {activeReport.undeclared.map((und) => (
                        <div
                          key={und.stateName}
                          className="border border-[#262626] bg-black p-4 rounded-md flex items-center justify-between"
                        >
                          <div>
                            <span className="font-mono text-sm font-semibold text-white">{und.stateName}</span>
                            <div className="text-[10px] text-neutral-500 mt-1">
                              {und.observationCount} visits in observed telemetry
                            </div>
                          </div>
                          <div className="flex space-x-2">
                            <Button
                              onClick={() =>
                                promoteStateMutation.mutate({
                                  stateName: und.stateName,
                                  accepted: true,
                                })
                              }
                              variant="primary"
                              size="xs"
                            >
                              <span>Promote</span>
                              <ArrowRight className="h-3 w-3" />
                            </Button>
                            <Button
                              onClick={() =>
                                promoteStateMutation.mutate({
                                  stateName: und.stateName,
                                  accepted: false,
                                })
                              }
                              variant="secondary"
                              size="xs"
                            >
                              Ignore
                            </Button>
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
                  <div className="rounded-md border border-[#262626] bg-[#131313] p-6 space-y-4">
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                      <AlertCircle className="h-5 w-5 text-white" />
                      <span>True Gap Transitions ({activeReport.trueGapTransitions})</span>
                    </h3>
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                      {activeReport.trueGapTransitionsList.map((trans, idx) => (
                        <div
                          key={idx}
                          className="text-xs bg-black p-4 rounded-md border border-[#262626] text-neutral-300 space-y-1"
                        >
                          <div className="flex items-center space-x-2">
                            <span className="font-mono text-neutral-400">{trans.fromStateName}</span>
                            <ArrowRight className="h-3.5 w-3.5 text-white flex-shrink-0" />
                            <span className="font-mono text-white font-bold">{trans.toStateName}</span>
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
                  <div className="rounded-md border border-[#262626] bg-[#131313] p-6 space-y-4">
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-white" />
                      <span>Undeclared Transitions (Bypasses) ({activeReport.undeclaredTransitions})</span>
                    </h3>
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                      {activeReport.undeclaredTransitionsList.map((trans, idx) => (
                        <div
                          key={idx}
                          className="text-xs bg-black p-4 rounded-md border border-[#262626] text-neutral-300 flex items-center justify-between"
                        >
                          <div className="flex items-center space-x-2">
                            <span className="font-mono text-neutral-400">{trans.fromStateName}</span>
                            <ArrowRight className="h-3.5 w-3.5 text-white flex-shrink-0" />
                            <span className="font-mono text-white font-bold">{trans.toStateName}</span>
                          </div>
                          <span className="text-[10px] text-neutral-500 font-mono font-semibold bg-[#131313] px-2 py-0.5 rounded border border-neutral-850">
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
            <EmptyState
              variant="activation"
              illustration="telemetry"
              layout="page"
              eyebrow="Waiting for telemetry"
              title="No reconciliation report yet"
              description="Run your application through this flow, then trigger reconciliation to compare observed and expected behavior."
              primaryAction={{ label: 'Run reconciliation', onClick: () => runReconciliationMutation.mutate() }}
            />
          )}
        </div>
      ) : (
        <EmptyState
          variant="activation"
          illustration="flow"
          eyebrow="Expected flow required"
          title="Complete your first declared flow"
          description="Reconciliation needs a completed expected flow before it can compare telemetry."
          primaryAction={{ label: 'Declare your first flow', href: `/declare?appId=${encodeURIComponent(appId)}` }}
        />
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
