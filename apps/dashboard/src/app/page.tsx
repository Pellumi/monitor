'use client';

import { useQuery } from '@tanstack/react-query';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import Link from 'next/link';

const REPORT_ENGINE = '/api-gateway';

async function fetchReport(appId: string) {
  const res = await fetch(`${REPORT_ENGINE}/reports/${appId}/latest`);
  if (!res.ok) {
    throw new Error('Network response was not ok');
  }
  return res.json();
}

function OverviewContent() {
  const searchParams = useSearchParams();
  const appId = searchParams.get('appId');

  const { data, error, isLoading } = useQuery({
    queryKey: ['report', appId],
    queryFn: () => fetchReport(appId!),
    enabled: !!appId,
  });

  if (!appId) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] text-center max-w-md mx-auto space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-xl shadow-lg">
          S
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">Welcome to SOTS Platform</h1>
          <p className="text-neutral-400 text-sm">
            To start tracking expected states, transitions, and observing behavioral gaps, you need to configure your first application.
          </p>
        </div>
        <Link
          href="/onboarding"
          className="px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-medium rounded-xl hover:opacity-95 transition-all text-sm shadow-md"
        >
          Create First Application
        </Link>
      </div>
    );
  }

  if (isLoading) return <div className="text-neutral-400">Loading overview...</div>;
  if (error) return <div className="text-red-400">Error loading data: {(error as Error).message}</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Coverage Overview</h1>
      
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-5">
        <MetricCard
          title="Expected Coverage"
          value={data.coverage.expectedCoverage == null ? 'N/A' : `${data.coverage.expectedCoverage.toFixed(1)}%`}
        />
        <MetricCard title="State Coverage" value={`${data.coverage.stateCoverage.toFixed(1)}%`} />
        <MetricCard title="Transition Coverage" value={`${data.coverage.transitionCoverage.toFixed(1)}%`} />
        <MetricCard title="Flow Coverage" value={`${data.coverage.flowCoverage.toFixed(1)}%`} />
        <MetricCard title="Total Sessions" value={data.summary.sessionCount} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-6">
          <h2 className="text-lg font-semibold mb-4">Top Missing States</h2>
          <ul className="space-y-2">
            {data.missingStates.slice(0, 5).map((state: any) => (
              <li key={state.stateName} className="flex items-center justify-between py-2 border-b border-neutral-800 last:border-0">
                <span className="text-sm font-mono text-neutral-300">{state.stateName}</span>
                <span className="text-xs text-neutral-500">{(state.confidence * 100).toFixed(0)}% confidence</span>
              </li>
            ))}
            {data.missingStates.length === 0 && <li className="text-sm text-neutral-500">No missing states found.</li>}
          </ul>
        </div>

        <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-6">
          <h2 className="text-lg font-semibold mb-4">Recent Missing Flows</h2>
          <ul className="space-y-2">
            {data.missingFlows.slice(0, 5).map((flow: { path: string[] }, idx: number) => (
              <li key={idx} className="flex flex-col py-2 border-b border-neutral-800 last:border-0">
                <span className="text-xs font-mono text-neutral-400">{flow.path.join(' → ')}</span>
              </li>
            ))}
            {data.missingFlows.length === 0 && <li className="text-sm text-neutral-500">No missing flows found.</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}

export default function OverviewPage() {
  return (
    <Suspense fallback={<div className="text-neutral-400">Loading overview...</div>}>
      <OverviewContent />
    </Suspense>
  );
}

function MetricCard({ title, value }: { title: string; value: string | number }) {
  return (
    <div className="overflow-hidden rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-5 sm:p-6">
      <dt className="truncate text-sm font-medium text-neutral-400">{title}</dt>
      <dd className="mt-1 text-3xl font-semibold tracking-tight text-white">{value}</dd>
    </div>
  );
}
