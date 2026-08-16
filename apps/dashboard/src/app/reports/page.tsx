'use client';
import { authenticatedFetch } from '@/lib/authenticated-fetch';
import { Button } from '@/components/ui/button';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Suspense } from 'react';
import { Download, CheckCircle, AlertTriangle } from 'lucide-react';
import { ApplicationRequiredState } from '@/components/application-required-state';
import { EmptyState } from '@/components/empty-state';
import { useSelectedApplication } from '@/hooks/use-selected-application';
import { useRouter, useSearchParams } from 'next/navigation';

const REPORT_ENGINE = '/api-gateway';

interface ReportData {
  application: string;
  summary: {
    workflowCount: number;
    sessionCount: number;
  };
  coverage: {
    stateCoverage: number;
    transitionCoverage: number;
    flowCoverage: number;
  };
  workflows: Array<{
    name: string;
    path: string[];
    executionCount: number;
  }>;
  missingStates: Array<{
    stateName: string;
    confidence: number;
    reason: string | null;
  }>;
  missingFlows: Array<{
    path: string[];
    confidence: number;
    reason: string | null;
  }>;
  generatedAt: string;
}

interface QARunSummary {
  id: string;
  status: string;
  reportId?: string | null;
  endedAt?: string | null;
  createdAt?: string;
  environment?: { id: string; name: string; type: string };
  _count?: { artifacts: number; findings: number };
}

interface QARunReport {
  id: string;
  runId: string;
  status: string;
  generatedAt: string;
  application: { id: string; name: string };
  environment: { id: string; name: string; type: string };
  coverage: { expected: number | null; reconciledFlows: number };
  summary: {
    sessionCount: number;
    observedStateCount: number;
    observedTransitionCount: number;
    artifactCount: number;
    findingCount: number;
    criticalOrHighFindings: number;
  };
}

function ReportsSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="h-8 w-60 bg-[#131313] border border-[#262626] rounded-sm" />
          <div className="h-4 w-96 bg-[#131313] border border-[#262626] rounded-sm" />
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-24 bg-[#131313] border border-[#262626] rounded-sm" />
          <div className="h-9 w-24 bg-[#131313] border border-[#262626] rounded-sm" />
          <div className="h-9 w-24 bg-[#131313] border border-[#262626] rounded-sm" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-md border border-[#262626] bg-[#131313] p-6 space-y-3">
            <div className="h-3.5 w-32 bg-black border border-[#262626] rounded-sm" />
            <div className="h-8 w-20 bg-black border border-[#262626] rounded-sm" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[1, 2].map((i) => (
          <div key={i} className="rounded-md border border-[#262626] bg-[#131313] p-6 space-y-4">
            <div className="h-6 w-48 bg-black border border-[#262626] rounded-sm" />
            <div className="space-y-3">
              {[1, 2, 3].map((j) => (
                <div key={j} className="h-12 bg-black border border-[#262626] rounded-sm" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReportsContent() {
  const { appId, selectedOrgId, isLoading: isApplicationsLoading, error: applicationsError } =
    useSelectedApplication();
  const [exportingFormat, setExportingFormat] = React.useState<string | null>(null);
  const [exportError, setExportError] = React.useState<string | null>(null);
  const searchParams = useSearchParams();
  const router = useRouter();

  const { data, isLoading, error } = useQuery<ReportData>({
    queryKey: ['latest-report', appId],
    queryFn: async () => {
      const res = await authenticatedFetch(`${REPORT_ENGINE}/reports/${appId}/latest`);
      if (!res.ok) throw new Error('Failed to fetch report');
      return res.json();
    },
    enabled: !!appId,
  });

  const { data: qaRuns = [], isLoading: areRunsLoading } = useQuery<QARunSummary[]>({
    queryKey: ['qa-report-runs', appId],
    queryFn: async () => {
      const res = await authenticatedFetch(`${REPORT_ENGINE}/applications/${appId}/qa-runs`);
      if (!res.ok) throw new Error('Failed to fetch QA runs');
      return res.json();
    },
    enabled: !!appId,
    refetchInterval: 10_000,
  });

  const completedRuns = React.useMemo(
    () => qaRuns.filter((run) => run.status === 'COMPLETED'),
    [qaRuns],
  );
  const requestedRunId = searchParams.get('runId');
  const selectedRun = completedRuns.find((run) => run.id === requestedRunId) ?? completedRuns[0];
  const { data: qaReport, isLoading: isQaReportLoading, error: qaReportError } = useQuery<QARunReport>({
    queryKey: ['qa-run-report', selectedRun?.id],
    queryFn: async () => {
      const res = await authenticatedFetch(`${REPORT_ENGINE}/qa-runs/${selectedRun!.id}/report`);
      if (!res.ok) throw new Error('Failed to fetch the QA run report');
      return res.json();
    },
    enabled: !!selectedRun,
  });

  const { data: entitlement } = useQuery<{
    features: Record<string, boolean | string>;
  }>({
    queryKey: ['report-entitlement', selectedOrgId],
    queryFn: async () => {
      const res = await authenticatedFetch(`/api-gateway/organizations/${selectedOrgId}/entitlement`);
      if (!res.ok) throw new Error('Failed to fetch report entitlement');
      return res.json();
    },
    enabled: !!selectedOrgId,
  });

  const exportTier = entitlement?.features?.REPORT_EXPORT;
  const allowedFormats = exportTier === 'ALL_FORMATS'
    ? ['pdf', 'html', 'csv', 'json']
    : exportTier === 'JSON_PDF'
      ? ['pdf', 'json']
      : ['json'];

  if (!selectedOrgId) return <div className="text-[#8e9192] font-mono text-sm">No organization is selected.</div>;
  if (isApplicationsLoading) return <ReportsSkeleton />;
  if (applicationsError) return <div className="text-red-400 font-mono text-sm">Error: {(applicationsError as Error).message}</div>;
  if (!appId) return <ApplicationRequiredState feature="Report" />;

  if (isLoading || areRunsLoading || isQaReportLoading) return <ReportsSkeleton />;
  if (error)     return <div className="text-red-400 font-mono text-sm">Error: {(error as Error).message}</div>;
  if (!data)     return null;
  const aggregateReportEmpty = data.summary.sessionCount === 0 && data.summary.workflowCount === 0;
  if (aggregateReportEmpty && completedRuns.length === 0) {
    return (
      <EmptyState
        variant="activation"
        illustration="report"
        eyebrow="Report not ready"
        title="Run a demonstration to generate evidence"
        description="Reports combine captured sessions, discovered workflows, and coverage results. Send telemetry first, then Tellann can produce the report."
        primaryAction={{ label: 'Start a demonstration', href: `/onboarding/declare?appId=${encodeURIComponent(appId)}` }}
        secondaryAction={{ label: 'Connect SDK', href: `/applications/${encodeURIComponent(appId)}/connect` }}
      />
    );
  }
  if (selectedRun && qaReportError && !qaReport) {
    return (
      <EmptyState
        variant="neutral"
        illustration="report"
        eyebrow="Report temporarily unavailable"
        title="Your completed QA run was found"
        description="Tellann found the completed run, but could not assemble its report. Refresh this page or retry after the report service is available."
        primaryAction={{ label: 'Refresh report', onClick: () => window.location.reload() }}
        secondaryAction={{ label: 'View QA runs', href: '/qa-runs' }}
      />
    );
  }

  async function handleExport(format: string) {
    setExportingFormat(format);
    setExportError(null);
    try {
      const res = await authenticatedFetch(`${REPORT_ENGINE}/reports/${appId}/export?format=${format}`);
      if (!res.ok) {
        const errText = await res.text().catch(() => 'Export failed');
        throw new Error(errText);
      }
      const contentType = res.headers.get('content-type') ?? '';
      if (contentType.includes('application/json')) {
        const { url, filename } = await res.json() as { url: string; expiresAt: string; filename: string };
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        const blob = await res.blob();
        const objUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = objUrl;
        link.download = `tellann-report-${appId}.${format}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(objUrl);
      }
    } catch (err: unknown) {
      setExportError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setExportingFormat(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#262626] pb-5">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">QA Behavioral Reports</h1>
          <p className="mt-1 text-sm text-[#c4c7c8]">
            Export coverage results, discovered workflows, and ClickHouse endpoint telemetry.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {exportError && (
            <span className="self-center text-xs font-mono text-red-400 mr-2">{exportError}</span>
          )}
          {[
            { label: 'PDF', format: 'pdf' },
            { label: 'HTML', format: 'html' },
            { label: 'CSV', format: 'csv' },
            { label: 'JSON', format: 'json' },
          ].filter((btn) => allowedFormats.includes(btn.format)).map((btn) => (
            <Button
              key={btn.format}
              id={`export-${btn.format}-btn`}
              onClick={() => void handleExport(btn.format)}
              disabled={!!exportingFormat}
              loading={exportingFormat === btn.format}
              variant="secondary"
              size="sm"
              className="border border-[#262626] bg-[#131313] text-[#8e9192] hover:text-white font-mono text-xs uppercase tracking-wider rounded-sm"
            >
              {exportingFormat !== btn.format && <Download className="h-3.5 w-3.5" />}
              <span>Export {btn.label}</span>
            </Button>
          ))}
        </div>
      </div>

      {qaReport && (
        <section className="rounded-md border border-[#262626] bg-[#131313] p-6 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#262626] pb-3">
            <div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-emerald-400" />
                <span className="text-sm font-semibold text-white">QA Run Report Ready</span>
              </div>
              <h2 className="mt-2 text-xl font-bold font-mono text-white tracking-tight">
                Run {qaReport.runId.slice(0, 8)}
              </h2>
              <p className="mt-1 text-xs font-mono text-[#8e9192]">
                {qaReport.environment.name} · {qaReport.summary.artifactCount} artifacts ·{' '}
                {qaReport.summary.findingCount} findings · generated{' '}
                {new Date(qaReport.generatedAt).toLocaleString()}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="inline-block border border-[#444748] text-[#8e9192] px-2 py-0.5 text-[11px] font-mono tracking-wider uppercase rounded-sm">
                QA // Report
              </span>
              {completedRuns.length > 1 && (
                <label className="text-xs font-mono text-[#8e9192]">
                  Report run
                  <select
                    className="ml-2 rounded-sm border border-[#262626] bg-black px-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-white cursor-pointer"
                    value={qaReport.runId}
                    onChange={(event) => {
                      const params = new URLSearchParams(searchParams.toString());
                      params.set('runId', event.target.value);
                      router.replace(`?${params.toString()}`, { scroll: false });
                    }}
                  >
                    {completedRuns.map((run) => (
                      <option key={run.id} value={run.id}>
                        {run.id.slice(0, 8)} · {new Date(run.endedAt ?? run.createdAt ?? '').toLocaleString()}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          </div>

          <div className="bg-black border border-[#262626] rounded-sm divide-y divide-[#262626] md:divide-y-0 md:divide-x grid grid-cols-2 md:grid-cols-4 font-mono text-xs">
            {[
              ['Observed sessions', qaReport.summary.sessionCount],
              ['Observed states', qaReport.summary.observedStateCount],
              ['Transitions', qaReport.summary.observedTransitionCount],
              ['High priority findings', qaReport.summary.criticalOrHighFindings],
            ].map(([label, value]) => (
              <div key={String(label)} className="p-3">
                <div className="text-[10px] uppercase tracking-wider text-[#8e9192] block">{label}</div>
                <div className="mt-1 text-base font-bold text-white block">{value}</div>
              </div>
            ))}
          </div>
          {qaReportError && <p className="mt-2 text-xs font-mono text-red-400">{(qaReportError as Error).message}</p>}
        </section>
      )}

      {aggregateReportEmpty && qaReport ? (
        <section className="rounded-md border border-[#262626] bg-[#131313] p-6 space-y-2">
          <h2 className="text-base font-semibold text-white">Behavioral coverage is processing</h2>
          <p className="text-xs text-[#c4c7c8] leading-relaxed">
            The QA report above is ready. Aggregate workflow and coverage analysis has not produced a snapshot yet,
            so Tellann will not interpret zero values as complete coverage.
          </p>
        </section>
      ) : (
        <>
          {/* Metrics Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { label: 'State Coverage', value: `${data.coverage.stateCoverage.toFixed(1)}%` },
              { label: 'Transition Coverage', value: `${data.coverage.transitionCoverage.toFixed(1)}%` },
              { label: 'Flow Coverage', value: `${data.coverage.flowCoverage.toFixed(1)}%` },
            ].map((c) => (
              <div key={c.label} className="rounded-md border border-[#262626] bg-[#131313] p-5">
                <span className="text-[11px] font-mono uppercase tracking-wider text-[#8e9192] block">{c.label}</span>
                <div className="mt-2 text-3xl font-bold font-mono text-white">{c.value}</div>
              </div>
            ))}
          </div>

          {/* Detailed Sections */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Discovered Workflows */}
            <div className="rounded-md border border-[#262626] bg-[#131313] p-6 space-y-4 flex flex-col">
              <div className="flex items-center justify-between border-b border-[#262626] pb-3 shrink-0">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-emerald-400" />
                  <h3 className="text-sm font-semibold text-white">
                    Discovered Workflows ({data.workflows.length})
                  </h3>
                </div>
                <span className="inline-block border border-[#444748] text-[#8e9192] px-2 py-0.5 text-[11px] font-mono tracking-wider uppercase rounded-sm">
                  Workflows
                </span>
              </div>
              <div className="space-y-3 flex-1 flex flex-col min-h-0 pr-1 overflow-y-auto">
                {data.workflows.map((w, idx) => (
                  <div key={idx} className="border-b border-[#262626] pb-3 last:border-0">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-xs text-white">{w.name}</span>
                      <span className="text-[10px] font-mono text-[#8e9192]">{w.executionCount} executions</span>
                    </div>
                    <div className="mt-1 text-xs text-[#c4c7c8] font-mono leading-relaxed truncate">
                      {w.path.join(' → ')}
                    </div>
                  </div>
                ))}
                {data.workflows.length === 0 && (
                  <EmptyState
                    variant="neutral"
                    illustration="flow"
                    layout="page"
                    eyebrow="Workflow discovery"
                    title="No workflows in this report"
                    description="Continue exercising the application to reveal repeatable paths."
                    className="h-full flex-1 min-h-[300px]"
                  />
                )}
              </div>
            </div>

            {/* Missing Coverage */}
            <div className="rounded-md border border-[#262626] bg-[#131313] p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-[#262626] pb-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-400" />
                  <h3 className="text-sm font-semibold text-white">
                    Missing Behavioral Coverage
                  </h3>
                </div>
                <span className="inline-block border border-[#444748] text-[#8e9192] px-2 py-0.5 text-[11px] font-mono tracking-wider uppercase rounded-sm">
                  Coverage Gap
                </span>
              </div>

              <div className="space-y-5 max-h-96 overflow-y-auto pr-1">
                {/* Unreached States */}
                <div>
                  <h4 className="text-[11px] font-mono uppercase tracking-wider text-[#8e9192] mb-2">Unreached States</h4>
                  <ul className="space-y-2">
                    {data.missingStates.map((ms, idx) => (
                      <li key={idx} className="flex justify-between items-center text-xs font-mono bg-black p-3 rounded-sm border border-[#262626]">
                        <div>
                          <span className="font-mono text-white font-medium">{ms.stateName}</span>
                          <p className="text-[10px] text-[#8e9192] mt-0.5">{ms.reason || 'State never visited.'}</p>
                        </div>
                        <span className="text-[10px] font-mono text-[#8e9192] bg-[#131313] px-2 py-0.5 rounded-sm border border-[#262626]">
                          {(ms.confidence * 100).toFixed(0)}% Conf
                        </span>
                      </li>
                    ))}
                    {data.missingStates.length === 0 && (
                      <EmptyState
                        variant="success"
                        illustration="coverage"
                        layout="compact"
                        eyebrow="State coverage"
                        title="No missing states"
                        description="All expected states were reached in this report."
                      />
                    )}
                  </ul>
                </div>

                {/* Uncovered paths */}
                <div>
                  <h4 className="text-[11px] font-mono uppercase tracking-wider text-[#8e9192] mb-2">Uncovered Paths</h4>
                  <ul className="space-y-2">
                    {data.missingFlows.map((mf, idx) => (
                      <li key={idx} className="flex justify-between items-center text-xs font-mono bg-black p-3 rounded-sm border border-[#262626]">
                        <div className="max-w-[75%]">
                          <div className="font-mono text-white font-medium truncate">{mf.path.join(' → ')}</div>
                          <p className="text-[10px] text-[#8e9192] mt-0.5 leading-tight">{mf.reason || 'Workflow path never executed.'}</p>
                        </div>
                        <span className="text-[10px] font-mono text-[#8e9192] bg-[#131313] px-2 py-0.5 rounded-sm border border-[#262626] shrink-0">
                          {(mf.confidence * 100).toFixed(0)}% Conf
                        </span>
                      </li>
                    ))}
                    {data.missingFlows.length === 0 && (
                      <EmptyState
                        variant="success"
                        illustration="coverage"
                        layout="compact"
                        eyebrow="Flow coverage"
                        title="No missing flows"
                        description="No untested workflow variations were detected."
                      />
                    )}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function ReportsPage() {
  return (
    <Suspense fallback={<ReportsSkeleton />}>
      <ReportsContent />
    </Suspense>
  );
}
