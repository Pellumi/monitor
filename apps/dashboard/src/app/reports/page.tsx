'use client';

import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { FileText, Download, CheckCircle, AlertTriangle, HelpCircle } from 'lucide-react';

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

function ReportsContent() {
  const searchParams = useSearchParams();
  const appId = searchParams.get('appId') ?? 'app-test-checkout-success.json';

  const { data, isLoading, error } = useQuery<ReportData>({
    queryKey: ['latest-report', appId],
    queryFn: async () => {
      const res = await fetch(`${REPORT_ENGINE}/reports/${appId}/latest`);
      if (!res.ok) throw new Error('Failed to fetch report');
      return res.json();
    },
  });

  if (isLoading) return <div className="text-neutral-400 animate-pulse">Loading report…</div>;
  if (error)     return <div className="text-red-400">Error: {(error as Error).message}</div>;
  if (!data)     return null;

  const exportUrl = (format: string) => `${REPORT_ENGINE}/reports/${appId}/export?format=${format}`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">QA Behavioral Reports</h1>
          <p className="mt-1 text-sm text-neutral-400">
            Export coverage results, discovered workflows, and ClickHouse endpoint telemetry.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            { label: 'Export PDF', format: 'pdf', color: 'bg-neutral-800 text-white hover:bg-neutral-700' },
            { label: 'Export HTML', format: 'html', color: 'bg-neutral-800 text-white hover:bg-neutral-700' },
            { label: 'Export CSV', format: 'csv', color: 'bg-neutral-800 text-white hover:bg-neutral-700' },
            { label: 'Export JSON', format: 'json', color: 'bg-neutral-800 text-white hover:bg-neutral-700' },
          ].map((btn) => (
            <a
              key={btn.format}
              href={exportUrl(btn.format)}
              download
              className={`flex items-center space-x-1.5 rounded-lg border border-neutral-800 px-4 py-2 text-xs font-semibold transition-colors ${btn.color}`}
            >
              <Download className="h-3.5 w-3.5" />
              <span>{btn.label}</span>
            </a>
          ))}
        </div>
      </div>

      {/* Metrics Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: 'State Coverage', value: `${data.coverage.stateCoverage.toFixed(1)}%` },
          { label: 'Transition Coverage', value: `${data.coverage.transitionCoverage.toFixed(1)}%` },
          { label: 'Flow Coverage', value: `${data.coverage.flowCoverage.toFixed(1)}%` },
        ].map((c) => (
          <div key={c.label} className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-6 backdrop-blur-xl">
            <span className="text-xs font-medium text-neutral-500 uppercase tracking-wider">{c.label}</span>
            <div className="mt-2 text-3xl font-bold text-white">{c.value}</div>
          </div>
        ))}
      </div>

      {/* Detailed Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Discovered Workflows */}
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-6 space-y-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-400" />
            <span>Discovered Workflows ({data.workflows.length})</span>
          </h3>
          <div className="space-y-4 max-h-96 overflow-y-auto pr-1">
            {data.workflows.map((w, idx) => (
              <div key={idx} className="border-b border-neutral-800/60 pb-3 last:border-0">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-sm text-neutral-200">{w.name}</span>
                  <span className="text-xs text-neutral-500">{w.executionCount} executions</span>
                </div>
                <div className="mt-1 text-xs text-neutral-400 font-mono leading-relaxed truncate">
                  {w.path.join(' → ')}
                </div>
              </div>
            ))}
            {data.workflows.length === 0 && (
              <p className="text-sm text-neutral-500 text-center py-6">No workflows discovered yet.</p>
            )}
          </div>
        </div>

        {/* Missing Coverage */}
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-6 space-y-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-400" />
            <span>Missing Behavioral Coverage</span>
          </h3>

          <div className="space-y-6 max-h-96 overflow-y-auto pr-1">
            {/* Unreached States */}
            <div>
              <h4 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">Unreached States</h4>
              <ul className="space-y-2">
                {data.missingStates.map((ms, idx) => (
                  <li key={idx} className="flex justify-between items-center text-xs bg-neutral-950 p-3 rounded-lg border border-neutral-800">
                    <div>
                      <span className="font-mono text-red-400 font-medium">{ms.stateName}</span>
                      <p className="text-[10px] text-neutral-500 mt-0.5">{ms.reason || 'State never visited.'}</p>
                    </div>
                    <span className="text-[10px] text-neutral-400 font-semibold bg-neutral-900 px-2 py-0.5 rounded border border-neutral-800">
                      {(ms.confidence * 100).toFixed(0)}% Conf
                    </span>
                  </li>
                ))}
                {data.missingStates.length === 0 && (
                  <p className="text-xs text-neutral-500">No missing states detected.</p>
                )}
              </ul>
            </div>

            {/* Uncovered paths */}
            <div>
              <h4 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">Uncovered Paths</h4>
              <ul className="space-y-2">
                {data.missingFlows.map((mf, idx) => (
                  <li key={idx} className="flex justify-between items-center text-xs bg-neutral-950 p-3 rounded-lg border border-neutral-800">
                    <div className="max-w-[75%]">
                      <div className="font-mono text-amber-400 font-medium truncate">{mf.path.join(' → ')}</div>
                      <p className="text-[10px] text-neutral-500 mt-0.5 leading-tight">{mf.reason || 'Workflow path never executed.'}</p>
                    </div>
                    <span className="text-[10px] text-neutral-400 font-semibold bg-neutral-900 px-2 py-0.5 rounded border border-neutral-800 flex-shrink-0">
                      {(mf.confidence * 100).toFixed(0)}% Conf
                    </span>
                  </li>
                ))}
                {data.missingFlows.length === 0 && (
                  <p className="text-xs text-neutral-500">No missing flows detected.</p>
                )}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ReportsPage() {
  return (
    <Suspense fallback={<div className="text-neutral-400 animate-pulse">Loading report…</div>}>
      <ReportsContent />
    </Suspense>
  );
}
