'use client';
import { authenticatedFetch } from '@/lib/authenticated-fetch';
import { Button } from '@/components/ui/button';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ApplicationRequiredState } from '@/components/application-required-state';
import { EmptyState } from '@/components/empty-state';
import { useSelectedApplication } from '@/hooks/use-selected-application';
import { usePreferences } from '@/components/preferences-provider';
import { usePersistedFilter } from '@/hooks/use-persisted-filter';

interface Environment {
  id: string;
  name: string;
  type: string;
  isDefault?: boolean;
}

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
  const [environmentId, setEnvironmentId] = usePersistedFilter('sessions:environment', '');

  const { data: environments } = useQuery<Environment[]>({
    queryKey: ['application-environments', appId],
    queryFn: async () => {
      const res = await authenticatedFetch(`${REPORT_ENGINE}/applications/${appId}/environments`);
      if (!res.ok) throw new Error('Failed to load environments');
      return res.json();
    },
    enabled: !!appId,
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ['sessions', appId, page, pageSize, environmentId],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: String(pageSize) });
      if (environmentId) params.set('environmentId', environmentId);
      const res = await authenticatedFetch(
        `${REPORT_ENGINE}/applications/${appId}/sessions?${params.toString()}`,
      );
      if (!res.ok) throw new Error('Failed to fetch sessions');
      return res.json() as Promise<{
        sessions: Array<{
          id: string;
          startTime: string;
          endTime: string;
          durationMs: number | null;
          eventCount: number | null;
          errorCount: number | null;
          qaRunId: string | null;
        }>;
        total: number;
        /** Sessions this application has in any environment. */
        applicationTotal: number;
        environmentId: string | null;
        page: number;
        limit: number;
      }>;
    },
    enabled: !!appId,
  });

  // Page size comes from a preference, so it can change under a reader who is
  // already deep in the list. Without this they land past the end and see an
  // empty table with no explanation.
  useEffect(() => { setPage(1); }, [pageSize, environmentId]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / pageSize)) : 1;

  // The listing is always scoped to one environment, so the count above has to
  // say which — otherwise "12 sessions" silently means something different
  // depending on a filter the reader may not have set themselves.
  const activeEnvironmentName = useMemo(() => {
    const resolved = environmentId || data?.environmentId;
    return environments?.find((environment) => environment.id === resolved)?.name
      ?? (resolved ? 'the selected environment' : 'the default environment');
  }, [environments, environmentId, data?.environmentId]);

  function navigate(sessionId: string) {
    router.push(`/sessions/${sessionId}?appId=${appId}`);
  }

  if (!selectedOrgId) return <div className="text-neutral-400">No organization is selected.</div>;
  if (isApplicationsLoading) return <SessionsSkeleton />;
  if (applicationsError) return <div className="text-red-400">Error: {(applicationsError as Error).message}</div>;
  if (!appId) return <ApplicationRequiredState feature="Session" />;

  if (isLoading) return <SessionsSkeleton />;
  if (error)     return <div className="text-red-400">Error: {(error as Error).message}</div>;
  // Only an application that has never reported a session anywhere is an
  // instrumentation problem. An environment that happens to be empty is not,
  // and telling that reader to install the SDK — while hiding the filter that
  // would get them back — sends them after a bug that does not exist.
  if (data && data.applicationTotal === 0) {
    return (
      <EmptyState
        variant="activation"
        illustration="telemetry"
        eyebrow="No sessions captured"
        title="Record your first behavior session"
        description="Once the SDK is connected, interactions and state transitions will appear here as replayable sessions."
        primaryAction={{ label: 'Connect SDK', href: `/applications/${encodeURIComponent(appId)}/connect` }}
        secondaryAction={{ label: 'Start a demonstration', href: `/qa-runs/new?appId=${encodeURIComponent(appId)}` }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Sessions</h1>
          <p className="mt-1 text-sm text-neutral-400">
            {data?.total ?? 0} session{data?.total === 1 ? '' : 's'} in {activeEnvironmentName}
            {data && data.applicationTotal !== data.total
              ? ` · ${data.applicationTotal} across all environments`
              : ''}
          </p>
        </div>
        {environments && environments.length > 1 && (
          <label className="flex items-center gap-2 text-sm text-neutral-400">
            <span>Environment</span>
            <select
              value={environmentId}
              onChange={(e) => setEnvironmentId(e.target.value)}
              className="rounded-md border border-neutral-800 bg-neutral-950 px-3 py-1.5 text-sm text-neutral-200"
            >
              <option value="">Default</option>
              {environments.map((environment) => (
                <option key={environment.id} value={environment.id}>
                  {environment.name}
                </option>
              ))}
            </select>
          </label>
        )}
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
                <td colSpan={6} className="px-6 py-12 text-center text-sm text-neutral-500">
                  No sessions in {activeEnvironmentName}.
                  {environmentId ? (
                    <>
                      {' '}
                      <button
                        type="button"
                        onClick={() => setEnvironmentId('')}
                        className="text-blue-400 transition-colors hover:text-blue-300"
                      >
                        Show the default environment
                      </button>
                      {' instead, or run a demonstration against this one.'}
                    </>
                  ) : (
                    ' Start a demonstration to capture session data.'
                  )}
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
