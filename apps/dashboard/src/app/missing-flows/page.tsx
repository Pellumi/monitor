'use client';
import { authenticatedFetch } from '@/lib/authenticated-fetch';

import { useQuery } from '@tanstack/react-query';

import { Suspense } from 'react';
import { ApplicationRequiredState } from '@/components/application-required-state';
import { EmptyState } from '@/components/empty-state';
import { useSelectedApplication } from '@/hooks/use-selected-application';

const REPORT_ENGINE = '/api-gateway';

interface MissingFlowsReport {
  missingFlows: Array<{
    path: string[];
    confidence: number;
    reason?: string | null;
  }>;
}

async function fetchReport(appId: string): Promise<MissingFlowsReport> {
  const res = await authenticatedFetch(`${REPORT_ENGINE}/reports/${appId}/latest`);
  if (!res.ok) throw new Error('Failed to fetch report');
  return res.json();
}

function MissingFlowsContent() {
  const { appId, selectedOrgId, isLoading: isApplicationsLoading, error: applicationsError } =
    useSelectedApplication();

  const { data, isLoading, error } = useQuery<MissingFlowsReport>({
    queryKey: ['report', appId],
    queryFn: () => fetchReport(appId),
    enabled: !!appId,
  });

  if (!selectedOrgId) return <div className="text-neutral-400">No organization is selected.</div>;
  if (isApplicationsLoading) return <div className="text-neutral-400">Loading applications...</div>;
  if (applicationsError) return <div className="text-red-400">Error: {(applicationsError as Error).message}</div>;
  if (!appId) return <ApplicationRequiredState feature="Missing flows" />;
  if (isLoading) return <div className="text-neutral-400">Loading missing flows...</div>;
  if (error) return <div className="text-red-400">Error: {(error as Error).message}</div>;
  if (!data) return null;
  if (data.missingFlows.length === 0) {
    return (
      <EmptyState
        variant="success"
        illustration="coverage"
        eyebrow="Coverage clear"
        title="No missing flows detected"
        description="The latest analysis found no untested variations in your known workflows."
        layout="compact"
      />
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Missing Flows</h1>
      <p className="text-neutral-400">These flows represent theoretical variations of known workflows that have never been tested.</p>
      
      <div className="overflow-hidden rounded-lg border border-neutral-800 bg-neutral-900">
        <ul className="divide-y divide-neutral-800">
          {data.missingFlows.map((flow, idx) => (
            <li key={idx} className="flex flex-col px-6 py-4 hover:bg-neutral-800/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 font-mono text-sm">
                  {flow.path.map((state: string, sIdx: number) => (
                    <span key={sIdx} className="flex items-center space-x-2">
                      <span className="rounded bg-neutral-800 px-2 py-1 text-neutral-300">{state}</span>
                      {sIdx < flow.path.length - 1 && <span className="text-neutral-500">→</span>}
                    </span>
                  ))}
                </div>
                <span className="text-xs text-neutral-400 bg-neutral-800 px-2 py-1 rounded">Confidence: {(flow.confidence * 100).toFixed(0)}%</span>
              </div>
              {flow.reason && (
                <div className="mt-2 text-sm text-neutral-500">Reason: {flow.reason}</div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default function MissingFlowsPage() {
  return (
    <Suspense fallback={<div className="text-neutral-400">Loading missing flows...</div>}>
      <MissingFlowsContent />
    </Suspense>
  );
}
