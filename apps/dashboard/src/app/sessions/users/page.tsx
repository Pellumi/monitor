'use client';

import { Suspense, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { authenticatedFetch } from '@/lib/authenticated-fetch';
import { ApplicationRequiredState } from '@/components/application-required-state';
import { EmptyState } from '@/components/empty-state';
import { useSelectedApplication } from '@/hooks/use-selected-application';

/**
 * The other half of findability: a support engineer who has a name, not a session id.
 *
 * Nothing in the product could answer "show me this user" before — `Session` had no user
 * at all, and `identify()`'s id was destroyed by the SDK's sanitizer before it was sent.
 */

const REPORT_ENGINE = '/api-gateway';

interface EndUserRow {
  id: string;
  label: string;
  /** False in HASHED mode, where there is a handle but no identifier. */
  isIdentified: boolean;
  firstSeenAt: string;
  lastSeenAt: string;
  traits: Record<string, unknown>;
  sessionCount: number;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function EndUsersContent() {
  const { appId, selectedOrgId, isLoading } = useSelectedApplication();
  const [search, setSearch] = useState('');

  const { data, isLoading: isLoadingUsers, error } = useQuery<{ endUsers: EndUserRow[] }>({
    queryKey: ['end-users', appId, search],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: '50' });
      if (search.trim()) params.set('q', search.trim());
      const res = await authenticatedFetch(
        `${REPORT_ENGINE}/applications/${appId}/end-users?${params.toString()}`,
      );
      if (!res.ok) throw new Error('Failed to load users');
      return res.json();
    },
    enabled: !!appId,
  });

  if (!selectedOrgId) return <div className="text-neutral-400">No organization is selected.</div>;
  if (isLoading) return <div className="animate-pulse text-neutral-500">Loading…</div>;
  if (!appId) return <ApplicationRequiredState feature="Session" />;
  if (error) return <div className="text-red-400">Error: {(error as Error).message}</div>;

  const users = data?.endUsers ?? [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <Link href={`/sessions?appId=${appId}`} className="text-sm text-neutral-500 transition-colors hover:text-neutral-300">
              ← Sessions
            </Link>
            <h1 className="text-3xl font-bold">Users</h1>
          </div>
          <p className="mt-1 text-sm text-neutral-400">
            People your application identified, most recently seen first.
          </p>
        </div>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-wider text-neutral-500">Find a user</span>
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="user id or email"
            className="w-64 rounded-md border border-neutral-800 bg-neutral-950 px-3 py-1.5 text-sm text-neutral-200 placeholder:text-neutral-600 focus:border-neutral-600 focus:outline-none"
          />
        </label>
      </div>

      {!isLoadingUsers && users.length === 0 && (
        <EmptyState
          variant={search ? 'neutral' : 'activation'}
          illustration="telemetry"
          layout="compact"
          eyebrow={search ? 'No match' : 'No identified users'}
          title={search ? 'Nothing matches that' : 'Call identify() to name your users'}
          description={search
            // Worth saying, because in HASHED mode an absence here is expected rather
            // than a bug: the identifier is not stored, so there is nothing to match on.
            ? 'No user matches that text. If this application stores hashed identities, searching by name finds nothing — paste the exact user id instead, which hashes to the same value.'
            : 'Sessions are grouped per browser until your application tells Tellann who is using it. Call TELLANN.identifyUser(id) after sign-in and sessions will be attributed from then on, including the anonymous ones that came before.'}
          {...(search ? {} : { primaryAction: { label: 'SDK setup', href: `/applications/${encodeURIComponent(appId)}/connect` } })}
        />
      )}

      {users.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-neutral-800 bg-neutral-900">
          <table className="min-w-full divide-y divide-neutral-800">
            <caption className="sr-only">Identified users, with when they were first and last seen.</caption>
            <thead className="bg-neutral-950">
              <tr>
                {['User', 'Sessions', 'First seen', 'Last seen', ''].map((heading) => (
                  <th key={heading} scope="col" className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-neutral-400">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-neutral-800/50">
                  <td className="px-4 py-3 text-sm">
                    <Link
                      href={`/sessions/users/${encodeURIComponent(user.id)}?appId=${appId}`}
                      className="text-blue-400 transition-colors hover:text-blue-300"
                    >
                      {user.label}
                    </Link>
                    {!user.isIdentified && (
                      // The handle is a hash prefix, not a name. Labelling it prevents a
                      // reader mistaking it for a truncated identifier.
                      <span className="ml-2 rounded bg-neutral-800 px-1.5 py-0.5 font-mono text-[10px] text-neutral-500">
                        hashed
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-neutral-300">{user.sessionCount}</td>
                  <td className="px-4 py-3 text-sm text-neutral-400">{formatDate(user.firstSeenAt)}</td>
                  <td className="px-4 py-3 text-sm text-neutral-400">{formatDate(user.lastSeenAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/sessions?appId=${appId}&endUser=${encodeURIComponent(user.id)}`}
                      className="text-sm text-blue-400 transition-colors hover:text-blue-300"
                    >
                      Sessions →
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

export default function EndUsersPage() {
  return (
    <Suspense fallback={<div className="animate-pulse text-neutral-500">Loading…</div>}>
      <EndUsersContent />
    </Suspense>
  );
}
