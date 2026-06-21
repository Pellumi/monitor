'use client';

import { useQuery } from '@tanstack/react-query';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

const REPORT_ENGINE = '/api-gateway';

async function fetchReport(appId: string) {
  const res = await fetch(`${REPORT_ENGINE}/reports/${appId}/latest`);
  if (!res.ok) throw new Error('Failed to fetch report');
  return res.json();
}

function MissingStatesContent() {
  const searchParams = useSearchParams();
  const appId = searchParams.get('appId') ?? 'app-test-checkout-success.json';

  const { data, isLoading, error } = useQuery({
    queryKey: ['report', appId],
    queryFn: () => fetchReport(appId),
  });

  if (isLoading) return <div className="text-neutral-400">Loading missing states...</div>;
  if (error) return <div className="text-red-400">Error: {(error as Error).message}</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Missing States</h1>
      <p className="text-neutral-400">These are critical application states that were never reached during testing.</p>
      
      <div className="overflow-hidden rounded-lg border border-neutral-800 bg-neutral-900">
        <ul className="divide-y divide-neutral-800">
          {data.missingStates.map((state: any, idx: number) => (
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
          {data.missingStates.length === 0 && (
            <li className="px-6 py-8 text-center text-neutral-500">No missing states found! Great coverage.</li>
          )}
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
