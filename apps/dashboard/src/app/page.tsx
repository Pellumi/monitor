'use client';
import { authenticatedFetch } from '@/lib/authenticated-fetch';

import { useQuery } from '@tanstack/react-query';

import { Suspense } from 'react';
import { useSelectedApplication } from '@/hooks/use-selected-application';
import { ApplicationRequiredState } from '@/components/application-required-state';
import { EmptyState } from '@/components/empty-state';

const REPORT_ENGINE = '/api-gateway';

interface OverviewReport {
  summary: { sessionCount: number; workflowCount: number };
  coverage: {
    expectedCoverage: number | null;
    stateCoverage: number;
    transitionCoverage: number;
    flowCoverage: number;
  };
  missingStates: Array<{ stateName: string; confidence: number }>;
  missingFlows: Array<{ path: string[] }>;
}

async function fetchReport(appId: string): Promise<OverviewReport> {
  const res = await authenticatedFetch(`${REPORT_ENGINE}/reports/${appId}/latest`);
  if (!res.ok) {
    throw new Error('Network response was not ok');
  }
  return res.json();
}

function OverviewContent() {
  const { appId, selectedOrgId, isLoading: isApplicationsLoading, error: applicationsError } =
    useSelectedApplication();

  const { data, error, isLoading } = useQuery({
    queryKey: ['report', appId],
    queryFn: () => fetchReport(appId!),
    enabled: !!appId,
  });

  if (!selectedOrgId) return <div className="text-neutral-400">No organization is selected.</div>;
  if (isApplicationsLoading) return <div className="text-neutral-400">Loading applications...</div>;
  if (applicationsError) return <div className="text-red-400">Error: {(applicationsError as Error).message}</div>;
  if (!appId) return <ApplicationRequiredState feature="Coverage Overview" />;

  if (isLoading) return <div className="text-neutral-400 font-mono text-xs">Loading overview...</div>;
  if (error) return <div className="text-red-400 font-mono text-xs">Error loading data: {(error as Error).message}</div>;
  if (!data) return null;
  if (data.summary.sessionCount === 0 && data.summary.workflowCount === 0) {
    return (
      <EmptyState
        variant="activation"
        illustration="telemetry"
        eyebrow="Workspace ready"
        title="Send your first behavior signal"
        description="Coverage, sessions, and discovered workflows will assemble here after the SDK starts sending telemetry."
        primaryAction={{ label: 'Connect SDK', href: `/onboarding/api-keys?appId=${encodeURIComponent(appId)}` }}
        secondaryAction={{ label: 'Declare expected behavior', href: `/declare?appId=${encodeURIComponent(appId)}` }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight text-white">Coverage Overview</h1>
      
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
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
        <div className="rounded-md border border-[#262626] bg-[#131313] p-6">
          <h2 className="text-base font-semibold text-white mb-4">Top Missing States</h2>
          <ul className="space-y-2">
            {data.missingStates.slice(0, 5).map((state) => (
              <li key={state.stateName} className="flex items-center justify-between py-2 border-b border-[#262626] last:border-0">
                <span className="text-xs font-mono text-neutral-300">{state.stateName}</span>
                <span className="text-[11px] font-mono text-neutral-500">{(state.confidence * 100).toFixed(0)}% confidence</span>
              </li>
            ))}
            {data.missingStates.length === 0 && (
              <li>
                <EmptyState
                  variant="success"
                  illustration="coverage"
                  layout="compact"
                  eyebrow="State coverage"
                  title="No missing states"
                  description="All expected states were reached."
                />
              </li>
            )}
          </ul>
        </div>

        <div className="rounded-md border border-[#262626] bg-[#131313] p-6">
          <h2 className="text-base font-semibold text-white mb-4">Recent Missing Flows</h2>
          <ul className="space-y-2">
            {data.missingFlows.slice(0, 5).map((flow: { path: string[] }, idx: number) => (
              <li key={idx} className="flex flex-col py-2 border-b border-[#262626] last:border-0">
                <span className="text-xs font-mono text-neutral-400">{flow.path.join(' → ')}</span>
              </li>
            ))}
            {data.missingFlows.length === 0 && (
              <li>
                <EmptyState
                  variant="success"
                  illustration="coverage"
                  layout="compact"
                  eyebrow="Flow coverage"
                  title="No missing flows"
                  description="No untested workflow variations were detected."
                />
              </li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}

export default function OverviewPage() {
  return (
    <Suspense fallback={<div className="text-neutral-400 font-mono text-xs">Loading overview...</div>}>
      <OverviewContent />
    </Suspense>
  );
}

function MetricCard({ title, value }: { title: string; value: string | number }) {
  return (
    <div className="overflow-hidden rounded-md border border-[#262626] bg-[#131313] px-4 py-5 sm:p-5">
      <dt className="truncate text-xs font-mono font-medium uppercase tracking-wider text-[#8e9192]">{title}</dt>
      <dd className="mt-1.5 text-2xl font-bold tracking-tight text-white font-mono">{value}</dd>
    </div>
  );
}
