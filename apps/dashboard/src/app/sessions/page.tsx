'use client';
import { authenticatedFetch } from '@/lib/authenticated-fetch';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';

const REPORT_ENGINE = '/api-gateway';

function formatDuration(ms: number | null): string {
  if (ms == null) return '—';
  if (ms < 1000) return `${ms}ms`;
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  if (m === 0) return `${s}s`;
  return `${m}m ${s % 60}s`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

import { Suspense } from 'react';

function SessionsContent() {
  const searchParams  = useSearchParams();
  const router        = useRouter();
  const appId         = searchParams.get('appId') ?? 'app-test-checkout-success.json';
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = useQuery({
    queryKey: ['sessions', appId, page],
    queryFn: async () => {
      const url = `${REPORT_ENGINE}/applications/${appId}/sessions?page=${page}&limit=20`;
      const res = await authenticatedFetch(url);
      if (!res.ok) throw new Error('Failed to fetch sessions');
      return res.json() as Promise<{
        sessions: Array<{
          id: string;
          startTime: string;
          endTime: string;
          durationMs: number | null;
          eventCount: number | null;
          errorCount: number | null;
        }>;
        total: number;
        page: number;
        limit: number;
      }>;
    },
    enabled: !!appId,
  });

  const totalPages = data ? Math.ceil(data.total / 20) : 1;

  function navigate(sessionId: string) {
    router.push(`/sessions/${sessionId}?appId=${appId}`);
  }

  if (isLoading) return <div className="text-neutral-400 animate-pulse">Loading sessions…</div>;
  if (error)     return <div className="text-red-400">Error: {(error as Error).message}</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Sessions</h1>
          <p className="mt-1 text-sm text-neutral-400">
            {data?.total ?? 0} total sessions recorded
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-neutral-800 bg-neutral-900">
        <table className="min-w-full divide-y divide-neutral-800">
          <thead className="bg-neutral-950">
            <tr>
              {['Session ID', 'Started', 'Duration', 'Events', 'Errors', ''].map((h) => (
                <th
                  key={h}
                  className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-neutral-400"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800 bg-neutral-900">
            {data?.sessions.map((s) => (
              <tr key={s.id} className="hover:bg-neutral-800/50 cursor-pointer" onClick={() => navigate(s.id)}>
                <td className="px-6 py-4 font-mono text-xs text-neutral-400">
                  {s.id.slice(0, 8)}…{s.id.slice(-4)}
                </td>
                <td className="px-6 py-4 text-sm text-neutral-300">{formatTime(s.startTime)}</td>
                <td className="px-6 py-4 text-sm text-neutral-300">{formatDuration(s.durationMs)}</td>
                <td className="px-6 py-4 text-sm text-neutral-400">{s.eventCount ?? '—'}</td>
                <td className="px-6 py-4 text-sm">
                  {s.errorCount != null && s.errorCount > 0
                    ? <span className="text-red-400 font-medium">{s.errorCount}</span>
                    : <span className="text-neutral-500">{s.errorCount ?? '—'}</span>}
                </td>
                <td className="px-6 py-4 text-right">
                  <Link
                    href={`/sessions/${s.id}?appId=${appId}`}
                    className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Replay →
                  </Link>
                </td>
              </tr>
            ))}
            {data?.sessions.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-neutral-500">
                  No sessions recorded yet. Start a demonstration to capture session data.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="rounded px-3 py-1 text-sm text-neutral-400 border border-neutral-700 hover:border-neutral-500 disabled:opacity-30 transition-colors"
          >
            ← Previous
          </button>
          <span className="text-sm text-neutral-500">Page {page} of {totalPages}</span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="rounded px-3 py-1 text-sm text-neutral-400 border border-neutral-700 hover:border-neutral-500 disabled:opacity-30 transition-colors"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}

export default function SessionsPage() {
  return (
    <Suspense fallback={<div className="text-neutral-400 animate-pulse">Loading sessions…</div>}>
      <SessionsContent />
    </Suspense>
  );
}
