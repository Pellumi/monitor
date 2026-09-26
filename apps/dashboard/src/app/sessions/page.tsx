'use client';
import { authenticatedFetch } from '@/lib/authenticated-fetch';
import { Button } from '@/components/ui/button';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ApplicationRequiredState } from '@/components/application-required-state';
import { EmptyState } from '@/components/empty-state';
import { useSelectedApplication } from '@/hooks/use-selected-application';
import { usePreferences } from '@/components/preferences-provider';
import { usePersistedFilter } from '@/hooks/use-persisted-filter';
import { useSessionFilters, type SessionFilters } from '@/hooks/use-session-filters';
import { SessionFilterBar } from '@/components/sessions/session-filter-bar';

interface Environment {
  id: string;
  name: string;
  type: string;
  isDefault?: boolean;
}

interface SessionRow {
  id: string;
  startTime: string;
  endTime: string;
  durationMs: number | null;
  eventCount: number | null;
  errorCount: number | null;
  qaRunId: string | null;
  endUserId: string | null;
  endUserLabel: string | null;
  anonymousId: string | null;
  deviceType: string | null;
  browserName: string | null;
  releaseVersion: string | null;
  abandoned: boolean;
}

interface SessionsResponse {
  sessions: SessionRow[];
  total: number;
  totalIsExact: boolean;
  /** Sessions this application has in any environment. */
  applicationTotal: number;
  environmentId: string | null;
  /** Sessions still recording, which have no facet yet and cannot be filtered. */
  excludedInFlight: number;
  cursor: string | null;
  page: number;
  limit: number;
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

function SessionsSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="space-y-2">
        <div className="h-8 w-40 bg-neutral-800 rounded-md" />
        <div className="h-4 w-48 bg-neutral-800/60 rounded-md" />
      </div>
      <div className="h-20 rounded-lg border border-neutral-800 bg-neutral-900/60" />
      <div className="overflow-hidden rounded-lg border border-neutral-800 bg-neutral-900">
        <div className="bg-neutral-950 px-6 py-3 border-b border-neutral-800 flex justify-between">
          {[24, 24, 20, 16, 16, 16].map((width, index) => (
            <div key={index} className="h-4 bg-neutral-800 rounded" style={{ width: `${width * 4}px` }} />
          ))}
        </div>
        <div className="divide-y divide-neutral-800">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="px-6 py-4 flex items-center justify-between">
              {[32, 36, 20, 12, 12, 16].map((width, index) => (
                <div key={index} className="h-4 bg-neutral-800/70 rounded" style={{ width: `${width * 4}px` }} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** A deep link — from the graph, a findings card, an error — pre-fills the filter. */
function initialFiltersFromUrl(params: URLSearchParams): Partial<SessionFilters> {
  const initial: Partial<SessionFilters> = {};
  const stateName = params.get('stateName');
  const workflowName = params.get('workflowName');
  if (stateName) initial.stateName = [stateName];
  if (workflowName) initial.workflowName = [workflowName];
  if (params.get('errorContains')) initial.errorContains = params.get('errorContains')!;
  if (params.get('endUser')) initial.endUser = params.get('endUser')!;
  if (params.get('abandoned') === '1') initial.outcome = 'abandoned';
  if (params.get('hasError') === '1') initial.errors = 'with';
  if (params.get('q')) initial.q = params.get('q')!;
  return initial;
}

function SessionsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { appId, selectedOrgId, isLoading: isApplicationsLoading, error: applicationsError } =
    useSelectedApplication();
  const { preferences } = usePreferences();
  const pageSize = preferences.tablePageSize;
  const [environmentId, setEnvironmentId] = usePersistedFilter('sessions:environment', '');
  const [filtersExpanded, setFiltersExpanded] = useState(false);

  // A deep link wins over what was stored: the reader asked for it just now.
  const initial = useMemo(() => initialFiltersFromUrl(searchParams), [searchParams]);
  const controller = useSessionFilters(initial);
  const { filters, toQuery, activeCount } = controller;

  // Keyset pagination. A cursor stack rather than a page number, because a session
  // completing between two page loads shifts every following row under an offset --
  // so a reader paging through silently skips some sessions and sees others twice.
  const [cursorStack, setCursorStack] = useState<string[]>([]);
  const cursor = cursorStack[cursorStack.length - 1] ?? null;

  const queryString = useMemo(() => {
    const params = toQuery();
    params.set('limit', String(pageSize));
    if (environmentId) params.set('environmentId', environmentId);
    if (cursor) params.set('cursor', cursor);
    return params.toString();
  }, [toQuery, pageSize, environmentId, cursor]);

  const { data: environments } = useQuery<Environment[]>({
    queryKey: ['application-environments', appId],
    queryFn: async () => {
      const res = await authenticatedFetch(`${REPORT_ENGINE}/applications/${appId}/environments`);
      if (!res.ok) throw new Error('Failed to load environments');
      return res.json();
    },
    enabled: !!appId,
  });

  const { data, isLoading, error, isFetching } = useQuery<SessionsResponse>({
    queryKey: ['sessions', appId, queryString],
    queryFn: async () => {
      const res = await authenticatedFetch(
        `${REPORT_ENGINE}/applications/${appId}/sessions?${queryString}`,
      );
      if (!res.ok) throw new Error('Failed to fetch sessions');
      return res.json();
    },
    enabled: !!appId,
  });

  // Any change to what is being asked for invalidates the cursor stack: a cursor is a
  // position within one result set and means nothing in another.
  useEffect(() => {
    setCursorStack([]);
  }, [pageSize, environmentId, filters]);

  // The count above has to say which environment it covers -- otherwise "12 sessions"
  // silently means something different depending on a filter the reader may not have set.
  const activeEnvironmentName = useMemo(() => {
    const resolved = environmentId || data?.environmentId;
    return environments?.find((environment) => environment.id === resolved)?.name
      ?? (resolved ? 'the selected environment' : 'the default environment');
  }, [environments, environmentId, data?.environmentId]);

  // Offered in the dropdowns, so a reader is never shown a filter that matches nothing.
  const observedFacets = useMemo(() => {
    const browsers = new Set<string>();
    const releases = new Set<string>();
    for (const session of data?.sessions ?? []) {
      if (session.browserName) browsers.add(session.browserName);
      if (session.releaseVersion) releases.add(session.releaseVersion);
    }
    return {
      browsers: [...browsers].sort(),
      releases: [...releases].sort(),
      states: filters.stateName,
    };
  }, [data?.sessions, filters.stateName]);

  if (!selectedOrgId) return <div className="text-neutral-400">No organization is selected.</div>;
  if (isApplicationsLoading) return <SessionsSkeleton />;
  if (applicationsError) return <div className="text-red-400">Error: {(applicationsError as Error).message}</div>;
  if (!appId) return <ApplicationRequiredState feature="Session" />;

  if (isLoading) return <SessionsSkeleton />;
  if (error) return <div className="text-red-400">Error: {(error as Error).message}</div>;

  // Only an application that has never reported a session anywhere is an instrumentation
  // problem. An environment that happens to be empty is not, and telling that reader to
  // install the SDK -- while hiding the filter that would get them back -- sends them
  // after a bug that does not exist.
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

  const countLabel = data
    ? `${data.total}${data.totalIsExact ? '' : '+'} session${data.total === 1 ? '' : 's'}`
    : '0 sessions';

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Sessions</h1>
          <p className="mt-1 text-sm text-neutral-400">
            {countLabel}
            {activeCount > 0 ? ' matching' : ''} in {activeEnvironmentName}
            {data && activeCount === 0 && data.applicationTotal !== data.total
              ? ` · ${data.applicationTotal} across all environments`
              : ''}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={`/sessions/users?appId=${appId}`}
            className="text-sm text-blue-400 transition-colors hover:text-blue-300"
          >
            Browse users →
          </Link>
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
                  <option key={environment.id} value={environment.id}>{environment.name}</option>
                ))}
              </select>
            </label>
          )}
        </div>
      </div>

      <SessionFilterBar
        controller={controller}
        facets={observedFacets}
        expanded={filtersExpanded}
        onExpandedChange={setFiltersExpanded}
      />

      {/* A facet exists only once a session completes, so an in-flight session cannot
          satisfy a filter. Said out loud rather than silently omitted -- a reader who
          just reproduced a bug is exactly who will look inside that window. */}
      {data && data.excludedInFlight > 0 && (
        <p className="text-xs text-amber-400/80">
          {data.excludedInFlight} session{data.excludedInFlight === 1 ? ' is' : 's are'} still
          recording and cannot be filtered yet. They appear once they finish, within about a minute.
        </p>
      )}

      <div className={`overflow-hidden rounded-lg border border-neutral-800 bg-neutral-900 ${isFetching ? 'opacity-60' : ''}`}>
        <table className="min-w-full divide-y divide-neutral-800">
          <caption className="sr-only">
            Recorded sessions, most recent first, with the user, device, duration and error count of each.
          </caption>
          <thead className="bg-neutral-950">
            <tr>
              {['Session', 'User', 'Device', 'Started', 'Duration', 'Events', 'Errors', ''].map((heading) => (
                <th
                  key={heading}
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-neutral-400"
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800 bg-neutral-900">
            {data?.sessions.map((session) => (
              <tr
                key={session.id}
                className="cursor-pointer hover:bg-neutral-800/50"
                onClick={() => router.push(`/sessions/${session.id}?appId=${appId}`)}
              >
                <td className="px-4 py-3 font-mono text-xs text-neutral-400">
                  {session.id.slice(0, 8)}…{session.id.slice(-4)}
                  {session.abandoned && (
                    <span className="ml-2 rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-400 ring-1 ring-amber-500/20">
                      abandoned
                    </span>
                  )}
                  {session.qaRunId && (
                    <span className="ml-2 rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] text-neutral-400">
                      guided run
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm">
                  {session.endUserId ? (
                    <Link
                      href={`/sessions/users/${encodeURIComponent(session.endUserId)}?appId=${appId}`}
                      onClick={(event) => event.stopPropagation()}
                      className="text-blue-400 transition-colors hover:text-blue-300"
                    >
                      {session.endUserLabel ?? session.endUserId.slice(0, 12)}
                    </Link>
                  ) : (
                    // Anonymous is the honest label. Showing the browser id as if it were
                    // a person would invite a reader to treat one device as one user.
                    <span className="text-neutral-600">{session.anonymousId ? 'anonymous' : '—'}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-neutral-400">
                  {session.deviceType ?? '—'}
                  {session.browserName ? <span className="text-neutral-600"> · {session.browserName}</span> : null}
                </td>
                <td className="px-4 py-3 text-sm text-neutral-300">{formatTime(session.startTime)}</td>
                <td className="px-4 py-3 text-sm text-neutral-300">{formatDuration(session.durationMs)}</td>
                <td className="px-4 py-3 text-sm text-neutral-400">{session.eventCount ?? '—'}</td>
                <td className="px-4 py-3 text-sm">
                  {session.errorCount != null && session.errorCount > 0
                    ? <span className="font-medium text-red-400">{session.errorCount}</span>
                    : <span className="text-neutral-500">{session.errorCount ?? '—'}</span>}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/sessions/${session.id}?appId=${appId}`}
                    className="text-sm text-blue-400 transition-colors hover:text-blue-300"
                    onClick={(event) => event.stopPropagation()}
                  >
                    Replay →
                  </Link>
                </td>
              </tr>
            ))}
            {data?.sessions.length === 0 && (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center text-sm text-neutral-500">
                  {activeCount > 0 ? (
                    <>
                      No sessions match these filters in {activeEnvironmentName}.
                      {' '}
                      <button
                        type="button"
                        onClick={controller.clear}
                        className="text-blue-400 transition-colors hover:text-blue-300"
                      >
                        Clear filters
                      </button>
                    </>
                  ) : environmentId ? (
                    <>
                      No sessions in {activeEnvironmentName}.{' '}
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
                    `No sessions in ${activeEnvironmentName}. Start a demonstration to capture session data.`
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {(cursorStack.length > 0 || data?.cursor) && (
        <div className="flex items-center justify-between pt-1">
          <Button
            onClick={() => setCursorStack((stack) => stack.slice(0, -1))}
            disabled={cursorStack.length === 0}
            variant="secondary"
            size="sm"
          >
            ← Previous
          </Button>
          <span className="text-sm text-neutral-500">
            {cursorStack.length === 0 ? 'Most recent' : `${cursorStack.length} page${cursorStack.length === 1 ? '' : 's'} back`}
          </span>
          <Button
            onClick={() => data?.cursor && setCursorStack((stack) => [...stack, data.cursor!])}
            disabled={!data?.cursor}
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
