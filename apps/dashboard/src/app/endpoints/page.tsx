'use client';
import { authenticatedFetch } from '@/lib/authenticated-fetch';

import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';

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

function EndpointsContent() {
  const searchParams = useSearchParams();
  const appId        = searchParams.get('appId') ?? 'app-test-checkout-success.json';
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery<AnalysisData>({
    queryKey: ['endpoints', appId],
    queryFn: async () => {
      const res = await authenticatedFetch(`${REPORT_ENGINE}/reports/${appId}/endpoint-intelligence`);
      if (!res.ok) throw new Error('Failed to fetch endpoint analysis');
      return res.json();
    },
    refetchInterval: 30_000, // refresh every 30s
  });

  if (isLoading) return <div className="text-neutral-400 animate-pulse">Loading endpoint analysis…</div>;
  if (error)     return <div className="text-red-400">Error: {(error as Error).message}</div>;
  if (!data)     return null;

  const maxAvg = Math.max(...data.endpoints.map((e) => e.avgMs), 1);

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
            {data.endpoints.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-neutral-500">
                  No endpoint data yet. Integrate <code className="font-mono text-xs">sotsExpressMiddleware()</code> and generate some traffic.
                </td>
              </tr>
            )}
            {data.endpoints.map((ep) => {
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
    <Suspense fallback={<div className="text-neutral-400 animate-pulse">Loading endpoint analysis…</div>}>
      <EndpointsContent />
    </Suspense>
  );
}
