'use client';

import { Suspense, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { authenticatedFetch } from '@/lib/authenticated-fetch';

/**
 * One user's history.
 *
 * This is the shape of the support conversation the product is sold on: a client says a
 * named person cannot do something, and the engineer needs that person's recent sessions
 * with the broken ones marked. It spans their devices without any extra work, because
 * every browser they use claims an alias onto the same end-user row.
 */

const REPORT_ENGINE = '/api-gateway';

interface SessionRow {
  id: string;
  startTime: string;
  durationMs: number | null;
  eventCount: number | null;
  errorCount: number | null;
  deviceType: string | null;
  browserName: string | null;
  releaseVersion: string | null;
  abandoned: boolean;
  anonymousId: string | null;
}

interface SessionsResponse {
  sessions: SessionRow[];
  total: number;
  totalIsExact: boolean;
}

function formatDuration(ms: number | null): string {
  if (ms == null) return '—';
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return m === 0 ? `${s}s` : `${m}m ${s % 60}s`;
}

function UserHistoryContent() {
  const params = useParams<{ endUserId: string }>();
  const searchParams = useSearchParams();
  const appId = searchParams.get('appId') ?? '';
  const endUserId = params.endUserId;

  const { data, isLoading, error } = useQuery<SessionsResponse>({
    queryKey: ['user-sessions', appId, endUserId],
    queryFn: async () => {
      const query = new URLSearchParams({ endUser: endUserId, limit: '50' });
      const res = await authenticatedFetch(
        `${REPORT_ENGINE}/applications/${appId}/sessions?${query.toString()}`,
      );
      if (!res.ok) throw new Error('Failed to load this user’s sessions');
      return res.json();
    },
    enabled: !!appId && !!endUserId,
  });

  const summary = useMemo(() => {
    const sessions = data?.sessions ?? [];
    const withErrors = sessions.filter((session) => (session.errorCount ?? 0) > 0).length;
    const abandoned = sessions.filter((session) => session.abandoned).length;
    // Counted from the browsers seen, so "one person, three devices" is visible rather
    // than looking like three users.
    const devices = new Set(sessions.map((s) => s.anonymousId).filter(Boolean)).size;
    return { withErrors, abandoned, devices };
  }, [data?.sessions]);

  if (error) return <div className="text-red-400">Error: {(error as Error).message}</div>;
  if (isLoading) return <div className="animate-pulse text-neutral-500">Loading this user&rsquo;s sessions…</div>;

  const sessions = data?.sessions ?? [];

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center gap-3">
          <Link href={`/sessions/users?appId=${appId}`} className="text-sm text-neutral-500 transition-colors hover:text-neutral-300">
            ← Users
          </Link>
          <h1 className="font-mono text-xl font-bold">{endUserId.slice(0, 20)}</h1>
        </div>
        <p className="mt-1 text-sm text-neutral-400">
          {data?.total ?? 0}{data && !data.totalIsExact ? '+' : ''} session
          {data?.total === 1 ? '' : 's'}
          {summary.withErrors > 0 && <span className="text-red-400"> · {summary.withErrors} with errors</span>}
          {summary.abandoned > 0 && <span className="text-amber-400"> · {summary.abandoned} abandoned</span>}
          {summary.devices > 1 && <span> · {summary.devices} devices</span>}
        </p>
      </div>

      {sessions.length === 0 ? (
        <p className="rounded-lg border border-neutral-800 bg-neutral-900 px-6 py-10 text-center text-sm text-neutral-500">
          No sessions recorded for this user yet. Sessions that predate the first
          identify() call are attributed within a minute of it, so check back shortly.
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-neutral-800 bg-neutral-900">
          <table className="min-w-full divide-y divide-neutral-800">
            <caption className="sr-only">This user&rsquo;s sessions, most recent first.</caption>
            <thead className="bg-neutral-950">
              <tr>
                {['Started', 'Device', 'Release', 'Duration', 'Events', 'Errors', ''].map((heading) => (
                  <th key={heading} scope="col" className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-neutral-400">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800">
              {sessions.map((session) => (
                <tr key={session.id} className="hover:bg-neutral-800/50">
                  <td className="px-4 py-3 text-sm text-neutral-300">
                    {new Date(session.startTime).toLocaleString(undefined, {
                      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                    })}
                    {session.abandoned && (
                      <span className="ml-2 rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-400 ring-1 ring-amber-500/20">
                        abandoned
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-neutral-400">
                    {session.deviceType ?? '—'}
                    {session.browserName ? <span className="text-neutral-600"> · {session.browserName}</span> : null}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-neutral-500">{session.releaseVersion ?? '—'}</td>
                  <td className="px-4 py-3 text-sm text-neutral-300">{formatDuration(session.durationMs)}</td>
                  <td className="px-4 py-3 text-sm text-neutral-400">{session.eventCount ?? '—'}</td>
                  <td className="px-4 py-3 text-sm">
                    {(session.errorCount ?? 0) > 0
                      ? <span className="font-medium text-red-400">{session.errorCount}</span>
                      : <span className="text-neutral-500">{session.errorCount ?? '—'}</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/sessions/${session.id}?appId=${appId}`}
                      className="text-sm text-blue-400 transition-colors hover:text-blue-300"
                    >
                      Replay →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function UserHistoryPage() {
  return (
    <Suspense fallback={<div className="animate-pulse text-neutral-500">Loading…</div>}>
      <UserHistoryContent />
    </Suspense>
  );
}
