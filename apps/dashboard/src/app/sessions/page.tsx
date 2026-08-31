'use client';
import { authenticatedFetch } from '@/lib/authenticated-fetch';
import { Button } from '@/components/ui/button';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ApplicationRequiredState } from '@/components/application-required-state';
import { EmptyState } from '@/components/empty-state';
import { useSelectedApplication } from '@/hooks/use-selected-application';
import { usePreferences } from '@/components/preferences-provider';

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

function SessionsSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="space-y-2">
        <div className="h-8 w-40 bg-neutral-800 rounded-md" />
        <div className="h-4 w-48 bg-neutral-800/60 rounded-md" />
      </div>

      <div className="overflow-hidden rounded-lg border border-neutral-800 bg-neutral-900">
        <div className="bg-neutral-950 px-6 py-3 border-b border-neutral-800 flex justify-between">
          <div className="h-4 w-24 bg-neutral-800 rounded" />
          <div className="h-4 w-24 bg-neutral-800 rounded" />
          <div className="h-4 w-20 bg-neutral-800 rounded" />
          <div className="h-4 w-16 bg-neutral-800 rounded" />
          <div className="h-4 w-16 bg-neutral-800 rounded" />
          <div className="h-4 w-16 bg-neutral-800 rounded" />
        </div>
        <div className="divide-y divide-neutral-800">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="px-6 py-4 flex items-center justify-between">
              <div className="h-4 w-32 bg-neutral-800/80 rounded" />
              <div className="h-4 w-36 bg-neutral-800/60 rounded" />
              <div className="h-4 w-20 bg-neutral-800/60 rounded" />
              <div className="h-4 w-12 bg-neutral-800/60 rounded" />
              <div className="h-4 w-12 bg-neutral-800/60 rounded" />
              <div className="h-4 w-16 bg-neutral-800/80 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SessionsContent() {
  const router        = useRouter();
  const { appId, selectedOrgId, isLoading: isApplicationsLoading, error: applicationsError } =
    useSelectedApplication();
  const [page, setPage] = useState(1);
  const { preferences } = usePreferences();
  const pageSize = preferences.tablePageSize;

  const { data, isLoading, error } = useQuery({
    queryKey: ['sessions', appId, page, pageSize],
    queryFn: async () => {
      const url = `${REPORT_ENGINE}/applications/${appId}/sessions?page=${page}&limit=${pageSize}`;
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

  if (!selectedOrgId) return <div className="text-neutral-400">No organization is selected.</div>;
  if (isApplicationsLoading) return <SessionsSkeleton />;
  if (applicationsError) return <div className="text-red-400">Error: {(applicationsError as Error).message}</div>;
  if (!appId) return <ApplicationRequiredState feature="Session" />;

  if (isLoading) return <SessionsSkeleton />;
  if (error)     return <div className="text-red-400">Error: {(error as Error).message}</div>;
  if (data?.sessions.length === 0) {
    return (
      <EmptyState
        variant="activation"
        illustration="telemetry"
        eyebrow="No sessions captured"
        title="Record your first behavior session"
        description="Once the SDK is connected, interactions and state transitions will appear here as replayable sessions."
        primaryAction={{ label: 'Connect SDK', href: `/applications/${encodeURIComponent(appId)}/connect` }}
        secondaryAction={{ label: 'Start a demonstration', href: `/onboarding/declare?appId=${encodeURIComponent(appId)}` }}
      />
    );
  }

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
          <Button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            variant="secondary"
            size="sm"
          >
            ← Previous
          </Button>
          <span className="text-sm text-neutral-500">Page {page} of {totalPages}</span>
          <Button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            variant="secondary"
            size="sm"
          >
            Next →
          </Button>
        </div>
      )}
    </div>
  );
}

export default function SessionsPage() {
  return (
    <Suspense fallback={<SessionsSkeleton />}>
      <SessionsContent />
    </Suspense>
  );
}
