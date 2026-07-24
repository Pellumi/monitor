'use client';
import { authenticatedFetch } from '@/lib/authenticated-fetch';

import { useQuery } from '@tanstack/react-query';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

const REPORT_ENGINE = '/api-gateway';

async function fetchWorkflows(appId: string) {
  const res = await authenticatedFetch(`${REPORT_ENGINE}/applications/${appId}/workflows`);
  if (!res.ok) throw new Error('Failed to fetch workflows');
  return res.json();
}

function WorkflowsContent() {
  const searchParams = useSearchParams();
  const appId = searchParams.get('appId') ?? 'app-test-checkout-success.json';

  const { data, isLoading, error } = useQuery({
    queryKey: ['workflows', appId],
    queryFn: () => fetchWorkflows(appId),
  });

  if (isLoading) return <div className="text-neutral-400">Loading workflows...</div>;
  if (error) return <div className="text-red-400">Error: {(error as Error).message}</div>;

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
            {data.map((workflow: any) => (
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
    <Suspense fallback={<div className="text-neutral-400">Loading workflows...</div>}>
      <WorkflowsContent />
    </Suspense>
  );
}
