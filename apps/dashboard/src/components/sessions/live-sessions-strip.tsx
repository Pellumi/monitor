'use client';

import Link from 'next/link';
import { useLiveSessions } from '@/hooks/use-live-sessions';

/**
 * What is happening right now, above the list of what already happened.
 *
 * Deliberately a strip rather than a table: it is glanceable, it does not compete with the
 * filtered results below, and it disappears entirely when nothing is recording — which is
 * most of the time for most applications, and an empty "Live" panel would be a permanent
 * reminder of nothing.
 */

interface LiveSessionsStripProps {
  appId: string;
  environmentId: string | null;
  /** Off while the reader is filtering: a live feed would fight the list they are reading. */
  enabled: boolean;
}

function secondsAgo(iso: string): string {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  return `${Math.round(seconds / 60)}m ago`;
}

export function LiveSessionsStrip({ appId, environmentId, enabled }: LiveSessionsStripProps) {
  const { sessions, state } = useLiveSessions(appId, environmentId, enabled);

  const active = sessions.filter((session) => !session.isComplete);
  // Nothing recording and nothing wrong: say nothing.
  if (state === 'offline' || active.length === 0) return null;

  return (
    <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.04] px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-emerald-400">
          <span className="relative flex h-2 w-2">
            {/* Only animates while the stream is actually connected -- a pulsing dot on a
                reconnecting stream claims something untrue. */}
            {state === 'live' && (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            )}
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
          </span>
          {state === 'live' ? 'Recording now' : 'Reconnecting'}
        </span>

        <div className="flex flex-wrap items-center gap-2">
          {active.slice(0, 6).map((session) => (
            <Link
              key={session.id}
              href={`/sessions/${session.id}?appId=${appId}`}
              className="group flex items-center gap-2 rounded-md border border-neutral-800 bg-neutral-950/60 px-2.5 py-1 text-xs transition-colors hover:border-neutral-700"
            >
              <span className="font-mono text-neutral-400 group-hover:text-neutral-200">
                {session.endUserLabel ?? 'anonymous'}
              </span>
              <span className="text-neutral-600">
                {session.eventCount} event{session.eventCount === 1 ? '' : 's'}
              </span>
              <span className="text-neutral-700">{secondsAgo(session.lastActivityAt)}</span>
            </Link>
          ))}
          {active.length > 6 && (
            <span className="text-xs text-neutral-600">+{active.length - 6} more</span>
          )}
        </div>
      </div>

      <p className="mt-2 text-[11px] leading-relaxed text-neutral-600">
        These are still recording, so they are not searchable yet — a session becomes
        filterable about a minute after its last event.
      </p>
    </div>
  );
}
