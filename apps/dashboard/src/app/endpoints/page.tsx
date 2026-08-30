'use client';
import { authenticatedFetch } from '@/lib/authenticated-fetch';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { ApplicationRequiredState } from '@/components/application-required-state';
import { EmptyState } from '@/components/empty-state';
import { useSelectedApplication } from '@/hooks/use-selected-application';

const REPORT_ENGINE = '/api-gateway';

interface EndpointData {
  endpoint: string;
  method: string;
  requestCount: number;
  avgMs: number;
  p95Ms: number;
  p99Ms: number;
  errorRate: number;
  recommendation: string;
}

interface AnalysisData {
  applicationId: string;
  generatedAt: string;
  totalEndpoints: number;
  slowEndpoints: number;
  errorEndpoints: number;
  endpoints: EndpointData[];
}

function methodBadge(method: string) {
  const colors: Record<string, string> = {
    GET:    'bg-green-950 text-green-400 border-green-800',
    POST:   'bg-blue-950 text-blue-400 border-blue-800',
    PUT:    'bg-amber-950 text-amber-400 border-amber-800',
    PATCH:  'bg-orange-950 text-orange-400 border-orange-800',
    DELETE: 'bg-red-950 text-red-400 border-red-800',
  };
  const cls = colors[method] ?? 'bg-neutral-800 text-neutral-400 border-neutral-700';
  return (
    <span className={`rounded border px-1.5 py-0.5 font-mono text-xs font-semibold ${cls}`}>
      {method}
    </span>
  );
}

function StatusIndicator({ ep }: { ep: EndpointData }) {
  if (ep.avgMs > 1000 && ep.errorRate > 0.05) {
    return <span className="text-xs font-semibold text-red-400">🔴 Critical</span>;
  }
  if (ep.avgMs > 1000 || ep.errorRate > 0.05) {
    return <span className="text-xs font-semibold text-amber-400">⚠️ Warning</span>;
  }
  if (ep.avgMs > 500) {
    return <span className="text-xs font-semibold text-yellow-400">📊 Monitor</span>;
  }
  return <span className="text-xs font-semibold text-green-400">✅ Healthy</span>;
}

function LatencyBar({ value, max }: { value: number; max: number }) {
  const pct = Math.min(100, (value / Math.max(max, 1)) * 100);
  const color = value > 1000 ? 'bg-red-500' : value > 500 ? 'bg-amber-500' : 'bg-green-500';
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 rounded-full bg-neutral-800">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-16 text-right text-xs text-neutral-400">{value}ms</span>
    </div>
  );
}

import { Suspense } from 'react';

function EndpointsSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-8 w-64 bg-neutral-800 rounded-md" />
          <div className="h-4 w-96 bg-neutral-800/60 rounded-md" />
        </div>
        <div className="h-4 w-36 bg-neutral-800/60 rounded-md" />
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-lg border border-neutral-800 bg-neutral-900 p-4 space-y-2">
            <div className="h-4 w-28 bg-neutral-800 rounded" />
            <div className="h-8 w-16 bg-neutral-800 rounded" />
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-lg border border-neutral-800 bg-neutral-900">
        <div className="bg-neutral-950 px-6 py-3 border-b border-neutral-800 flex justify-between">
          <div className="h-4 w-20 bg-neutral-800 rounded" />
          <div className="h-4 w-16 bg-neutral-800 rounded" />
          <div className="h-4 w-20 bg-neutral-800 rounded" />
          <div className="h-4 w-16 bg-neutral-800 rounded" />
          <div className="h-4 w-16 bg-neutral-800 rounded" />
          <div className="h-4 w-20 bg-neutral-800 rounded" />
          <div className="h-4 w-16 bg-neutral-800 rounded" />
        </div>
        <div className="divide-y divide-neutral-800">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="px-6 py-4 flex items-center justify-between">
              <div className="h-4 w-44 bg-neutral-800/80 rounded" />
              <div className="h-5 w-12 bg-neutral-800/60 rounded" />
              <div className="h-4 w-16 bg-neutral-800/60 rounded" />
              <div className="h-4 w-24 bg-neutral-800/60 rounded" />
              <div className="h-4 w-16 bg-neutral-800/60 rounded" />
              <div className="h-4 w-16 bg-neutral-800/60 rounded" />
              <div className="h-5 w-20 bg-neutral-800/80 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function EndpointsContent() {
  const { appId, selectedOrgId, isLoading: isApplicationsLoading, error: applicationsError } =
    useSelectedApplication();
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery<AnalysisData>({
    queryKey: ['endpoints', appId],
    queryFn: async () => {
      try {
        const res = await authenticatedFetch(`${REPORT_ENGINE}/reports/${appId}/endpoint-intelligence`);
        if (!res.ok) {
          return {
            applicationId: appId,
            generatedAt: new Date().toISOString(),
            totalEndpoints: 0,
            slowEndpoints: 0,
            errorEndpoints: 0,
            endpoints: [],
          };
        }
        return await res.json();
      } catch {
        return {
          applicationId: appId,
          generatedAt: new Date().toISOString(),
          totalEndpoints: 0,
          slowEndpoints: 0,
          errorEndpoints: 0,
          endpoints: [],
        };
      }
    },
    refetchInterval: 30_000, // refresh every 30s
    enabled: !!appId,
    retry: 1,
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

  if (isApplicationsLoading && !appId) return <EndpointsSkeleton />;
  if (applicationsError && !appId) return <div className="p-8 text-red-400 font-mono text-xs">Error: {(applicationsError as Error).message}</div>;
  if (!appId) return <ApplicationRequiredState feature="Endpoint intelligence" />;

  if (isLoading) return <EndpointsSkeleton />;
  if (error && !data) return <div className="p-8 text-red-400 font-mono text-xs">Error: {(error as Error).message}</div>;
  if (!data) return null;

  const endpointsList = Array.isArray(data.endpoints) ? data.endpoints : [];
  if (endpointsList.length === 0) {
    return (
      <EmptyState
        variant="activation"
        illustration="telemetry"
        eyebrow={setup?.readiness?.connected ? 'SDK connected' : 'Waiting for API traffic'}
        title={setup?.readiness?.connected ? 'Generate API traffic to analyze endpoints' : 'Connect the SDK to analyze endpoints'}
        description={setup?.readiness?.connected ? 'Tellann is receiving telemetry for this application. Exercise backend routes to populate latency, volume, and error analysis.' : 'Endpoint latency, request volume, and error patterns appear after Tellann receives application traffic.'}
        primaryAction={setup?.readiness?.connected ? undefined : { label: 'Connect SDK', href: `/applications/${encodeURIComponent(appId)}/connect` }}
      />
    );
  }

  const maxAvg = Math.max(...endpointsList.map((e) => e.avgMs), 1);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Endpoint Intelligence</h1>
          <p className="mt-1 text-sm text-neutral-400">
            Latency and error rate analysis from ClickHouse · refreshes every 30s
          </p>
        </div>
        <span className="text-xs text-neutral-600">
          Last updated: {new Date(data.generatedAt).toLocaleTimeString()}
        </span>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Endpoints', value: data.totalEndpoints, color: 'text-white' },
          { label: 'Slow (avg > 1s)', value: data.slowEndpoints,  color: 'text-amber-400' },
          { label: 'Error-Prone (>5%)', value: data.errorEndpoints, color: 'text-red-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
            <p className="text-sm text-neutral-400">{label}</p>
            <p className={`mt-1 text-3xl font-bold tabular-nums ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Endpoint table */}
      <div className="overflow-hidden rounded-lg border border-neutral-800 bg-neutral-900">
        <table className="min-w-full divide-y divide-neutral-800">
          <thead className="bg-neutral-950">
            <tr>
              {['Endpoint', 'Method', 'Requests', 'Avg', 'P95', 'Error Rate', 'Status'].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-neutral-400"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800">
            {endpointsList.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-neutral-500">
                  No endpoint data yet. Integrate <code className="font-mono text-xs">tellannExpressMiddleware()</code> and generate some traffic.
                </td>
              </tr>
            )}
            {endpointsList.map((ep) => {
              const key = `${ep.method}:${ep.endpoint}`;
              const isExpanded = expanded === key;
              return [
                <tr
                  key={key}
                  className="cursor-pointer hover:bg-neutral-800/50 transition-colors"
                  onClick={() => setExpanded(isExpanded ? null : key)}
                >
                  <td className="px-4 py-3 font-mono text-sm text-neutral-200">{ep.endpoint}</td>
                  <td className="px-4 py-3">{methodBadge(ep.method)}</td>
                  <td className="px-4 py-3 text-sm tabular-nums text-neutral-400">{ep.requestCount.toLocaleString()}</td>
                  <td className={`px-4 py-3 text-sm tabular-nums font-medium ${ep.avgMs > 1000 ? 'text-red-400' : ep.avgMs > 500 ? 'text-amber-400' : 'text-neutral-300'}`}>
                    {ep.avgMs}ms
                  </td>
                  <td className="px-4 py-3 text-sm tabular-nums text-neutral-400">{ep.p95Ms}ms</td>
                  <td className={`px-4 py-3 text-sm tabular-nums font-medium ${ep.errorRate > 0.05 ? 'text-red-400' : 'text-neutral-400'}`}>
                    {(ep.errorRate * 100).toFixed(1)}%
                  </td>
                  <td className="px-4 py-3"><StatusIndicator ep={ep} /></td>
                </tr>,
                isExpanded && (
                  <tr key={`${key}-detail`} className="bg-neutral-950">
                    <td colSpan={7} className="px-6 py-4">
                      <div className="grid grid-cols-2 gap-6">
                        <div>
                          <p className="mb-2 text-xs text-neutral-500 uppercase tracking-wider">Latency Profile</p>
                          <div className="space-y-2">
                            <div className="flex items-center gap-3 text-xs text-neutral-500">
                              <span className="w-8">Avg</span>
                              <LatencyBar value={ep.avgMs} max={maxAvg} />
                            </div>
                            <div className="flex items-center gap-3 text-xs text-neutral-500">
                              <span className="w-8">P95</span>
                              <LatencyBar value={ep.p95Ms} max={maxAvg} />
                            </div>
                            <div className="flex items-center gap-3 text-xs text-neutral-500">
                              <span className="w-8">P99</span>
                              <LatencyBar value={ep.p99Ms} max={maxAvg} />
                            </div>
                          </div>
                        </div>
                        <div>
                          <p className="mb-2 text-xs text-neutral-500 uppercase tracking-wider">Recommendation</p>
                          <p className="text-sm text-neutral-300">{ep.recommendation}</p>
                        </div>
                      </div>
                    </td>
                  </tr>
                ),
              ];
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function EndpointsPage() {
  return (
    <Suspense fallback={<EndpointsSkeleton />}>
      <EndpointsContent />
    </Suspense>
  );
}
