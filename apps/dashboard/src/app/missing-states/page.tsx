'use client';
import { authenticatedFetch } from '@/lib/authenticated-fetch';

import { useQuery } from '@tanstack/react-query';

import { Suspense } from 'react';
import { ApplicationRequiredState } from '@/components/application-required-state';
import { EmptyState } from '@/components/empty-state';
import { useSelectedApplication } from '@/hooks/use-selected-application';

const REPORT_ENGINE = '/api-gateway';

interface MissingStatesReport {
  missingStates: Array<{
    stateName: string;
    confidence: number;
    reason?: string | null;
  }>;
}

async function fetchReport(appId: string): Promise<MissingStatesReport> {
  const res = await authenticatedFetch(`${REPORT_ENGINE}/reports/${appId}/latest`);
  if (!res.ok) throw new Error('Failed to fetch report');
  return res.json();
}

function MissingStatesContent() {
  const { appId, selectedOrgId, isLoading: isApplicationsLoading, error: applicationsError } =
    useSelectedApplication();

  const { data, isLoading, error } = useQuery<MissingStatesReport>({
    queryKey: ['report', appId],
    queryFn: () => fetchReport(appId),
    enabled: !!appId,
  });

  if (!selectedOrgId) return <div className="text-neutral-400">No organization is selected.</div>;
  if (isApplicationsLoading) return <div className="text-neutral-400">Loading applications...</div>;
  if (applicationsError) return <div className="text-red-400">Error: {(applicationsError as Error).message}</div>;
  if (!appId) return <ApplicationRequiredState feature="Missing states" />;
  if (isLoading) return <div className="text-neutral-400">Loading missing states...</div>;
  if (error) return <div className="text-red-400">Error: {(error as Error).message}</div>;
  if (!data) return null;
  if (data.missingStates.length === 0) {
    return (
      <EmptyState
        variant="success"
        illustration="coverage"
        eyebrow="Coverage clear"
        title="No missing states detected"
        description="Every expected state in the latest analysis was reached. Continue testing new behavior to keep coverage current."
        layout="compact"
      />
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Missing States</h1>
      <p className="text-neutral-400">These are critical application states that were never reached during testing.</p>
      
      <div className="overflow-hidden rounded-lg border border-neutral-800 bg-neutral-900">
        <ul className="divide-y divide-neutral-800">
          {data.missingStates.map((state, idx) => (
            <li key={idx} className="flex flex-col px-6 py-4 hover:bg-neutral-800/50">
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm text-neutral-300 bg-neutral-800 px-2 py-1 rounded">{state.stateName}</span>
                <span className="text-xs text-neutral-400 bg-neutral-800 px-2 py-1 rounded">Confidence: {(state.confidence * 100).toFixed(0)}%</span>
              </div>
              {state.reason && (
                <div className="mt-2 text-sm text-neutral-500">Reason: {state.reason}</div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default function MissingStatesPage() {
  return (
    <Suspense fallback={<div className="text-neutral-400">Loading missing states...</div>}>
      <MissingStatesContent />
    </Suspense>
  );
}
