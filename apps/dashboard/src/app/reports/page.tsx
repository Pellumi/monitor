'use client';
import { authenticatedFetch } from '@/lib/authenticated-fetch';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { FileText, Download, CheckCircle, AlertTriangle, HelpCircle } from 'lucide-react';
import { useSession } from '@/components/providers';

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
  const { selectedOrgId } = useSession();
  const appId = searchParams.get('appId') ?? 'app-test-checkout-success.json';
  const [exportingFormat, setExportingFormat] = React.useState<string | null>(null);
  const [exportError, setExportError] = React.useState<string | null>(null);

  const { data, isLoading, error } = useQuery<ReportData>({
    queryKey: ['latest-report', appId],
    queryFn: async () => {
      const res = await authenticatedFetch(`${REPORT_ENGINE}/reports/${appId}/latest`);
      if (!res.ok) throw new Error('Failed to fetch report');
      return res.json();
    },
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

  if (isLoading) return <div className="text-neutral-400 animate-pulse">Loading report…</div>;
  if (error)     return <div className="text-red-400">Error: {(error as Error).message}</div>;
  if (!data)     return null;

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
      // New storage response: JSON with presigned URL
      if (contentType.includes('application/json')) {
        const { url, filename } = await res.json() as { url: string; expiresAt: string; filename: string };
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        // Legacy fallback: blob stream
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
    } catch (err: any) {
      setExportError(err?.message ?? 'Export failed');
    } finally {
      setExportingFormat(null);
    }
  }

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
          {exportError && (
            <span className="self-center text-xs text-red-400 mr-2">{exportError}</span>
          )}
          {[
            { label: 'PDF', format: 'pdf' },
            { label: 'HTML', format: 'html' },
            { label: 'CSV', format: 'csv' },
            { label: 'JSON', format: 'json' },
          ].filter((btn) => allowedFormats.includes(btn.format)).map((btn) => (
            <button
              key={btn.format}
              id={`export-${btn.format}-btn`}
              onClick={() => void handleExport(btn.format)}
              disabled={!!exportingFormat}
              className="flex items-center space-x-1.5 rounded-lg border border-neutral-800 bg-neutral-800 hover:bg-neutral-700 px-4 py-2 text-xs font-semibold text-white transition-colors disabled:opacity-50"
            >
              {exportingFormat === btn.format
                ? <span className="h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin inline-block" />
                : <Download className="h-3.5 w-3.5" />
              }
              <span>Export {btn.label}</span>
            </button>
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
