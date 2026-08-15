'use client';
import { authenticatedFetch } from '@/lib/authenticated-fetch';

import { useQuery } from '@tanstack/react-query';

import { Suspense } from 'react';
import { ApplicationRequiredState } from '@/components/application-required-state';
import { EmptyState } from '@/components/empty-state';
import { useSelectedApplication } from '@/hooks/use-selected-application';

const REPORT_ENGINE = '/api-gateway';

interface Workflow {
  id: string;
  name: string;
  path: string[];
  executionCount: number;
}

async function fetchWorkflows(appId: string): Promise<Workflow[]> {
  const res = await authenticatedFetch(`${REPORT_ENGINE}/applications/${appId}/workflows`);
  if (!res.ok) throw new Error('Failed to fetch workflows');
  return res.json();
}

function WorkflowsSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-56 bg-neutral-800 rounded-md" />

      <div className="overflow-hidden rounded-lg border border-neutral-800 bg-neutral-900">
        <div className="bg-neutral-950 px-6 py-3 border-b border-neutral-800 flex justify-between">
          <div className="h-4 w-24 bg-neutral-800 rounded" />
          <div className="h-4 w-32 bg-neutral-800 rounded" />
          <div className="h-4 w-24 bg-neutral-800 rounded" />
        </div>
        <div className="divide-y divide-neutral-800">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="px-6 py-4 flex items-center justify-between">
              <div className="h-4 w-40 bg-neutral-800/80 rounded" />
              <div className="h-4 w-64 bg-neutral-800/60 rounded font-mono" />
              <div className="h-4 w-16 bg-neutral-800/60 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function WorkflowsContent() {
  const { appId, selectedOrgId, isLoading: isApplicationsLoading, error: applicationsError } =
    useSelectedApplication();

  const { data, isLoading, error } = useQuery<Workflow[]>({
    queryKey: ['workflows', appId],
    queryFn: () => fetchWorkflows(appId),
    enabled: !!appId,
  });
  const { data: setup } = useQuery<{ readiness?: { connected?: boolean } }>({
    queryKey: ['sdk-setup', appId],
    queryFn: async () => {
      const response = await authenticatedFetch(`/api-gateway/applications/${appId}/sdk-setup`);
      if (!response.ok) throw new Error('Failed to load SDK readiness');
      return response.json();
    },
    enabled: !!appId,
    refetchInterval: 5_000,
    refetchOnWindowFocus: 'always',
  });

  if (!selectedOrgId) return <div className="text-neutral-400">No organization is selected.</div>;
  if (isApplicationsLoading) return <WorkflowsSkeleton />;
  if (applicationsError) return <div className="text-red-400">Error: {(applicationsError as Error).message}</div>;
  if (!appId) return <ApplicationRequiredState feature="Workflow" />;
  if (isLoading) return <WorkflowsSkeleton />;
  if (error) return <div className="text-red-400">Error: {(error as Error).message}</div>;
  if (!data) return null;
  if (data.length === 0) {
    return (
      <EmptyState
        variant="activation"
        illustration="telemetry"
        eyebrow={setup?.readiness?.connected ? 'SDK connected' : 'Waiting for telemetry'}
        title={setup?.readiness?.connected ? 'Exercise your application to discover workflows' : 'Connect the SDK to discover workflows'}
        description={setup?.readiness?.connected ? 'Tellann is receiving telemetry for this application. Navigate through complete user journeys so workflows can be assembled.' : 'Tellann builds workflows from real navigation and state transitions. Connect an ingestion key, then exercise your application.'}
        primaryAction={setup?.readiness?.connected ? undefined : { label: 'Connect SDK', href: `/applications/${encodeURIComponent(appId)}/connect` }}
        secondaryAction={{ label: 'Declare a flow', href: `/declare?appId=${encodeURIComponent(appId)}` }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Discovered Workflows</h1>
      
      <div className="overflow-hidden rounded-lg border border-neutral-800 bg-neutral-900">
        <table className="min-w-full divide-y divide-neutral-800">
          <thead className="bg-neutral-950">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-neutral-400">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-neutral-400">Path Signature</th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-neutral-400">Executions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800 bg-neutral-900">
            {data.map((workflow) => (
              <tr key={workflow.id} className="hover:bg-neutral-800/50">
                <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-white">{workflow.name}</td>
                <td className="px-6 py-4 text-sm text-neutral-400 font-mono">
                  {workflow.path.join(' → ')}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-right text-sm text-neutral-400">
                  {workflow.executionCount}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function WorkflowsPage() {
  return (
    <Suspense fallback={<WorkflowsSkeleton />}>
      <WorkflowsContent />
    </Suspense>
  );
}
