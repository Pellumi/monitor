'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Sessions recording right now.
 *
 * A reader who has just asked a user to reproduce something wants to watch it arrive. Until
 * now the only option was to reload the list and hope.
 *
 * Degrades the way the notifications provider does: a stream that keeps failing is given up
 * on rather than retried forever, and the caller is told, so the UI can stop implying it is
 * watching something it is not.
 */

export interface LiveSession {
  id: string;
  startTime: string;
  lastActivityAt: string;
  eventCount: number;
  endUserLabel: string | null;
  deviceType: string | null;
  isComplete: boolean;
}

export type LiveStreamState = 'connecting' | 'live' | 'reconnecting' | 'offline';

/** Failures after which the stream is abandoned rather than retried indefinitely. */
const MAX_FAILURES = 4;
/** How long a session stays in the list after its last event. */
const RETAIN_MS = 2 * 60_000;

export interface UseLiveSessions {
  sessions: LiveSession[];
  state: LiveStreamState;
}

export function useLiveSessions(
  appId: string | null,
  environmentId: string | null,
  enabled: boolean,
): UseLiveSessions {
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [state, setState] = useState<LiveStreamState>('connecting');
  const failuresRef = useRef(0);

  useEffect(() => {
    if (!enabled || !appId) {
      setState('offline');
      setSessions([]);
      return;
    }

    let source: EventSource | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    const connect = () => {
      if (cancelled) return;

      // Under /sessions, not /applications/:id/sessions/live: the gateway forwards the
      // latter through a helper that buffers the entire response, so an event stream would
      // never return. /sessions is proxied as a stream.
      const params = new URLSearchParams({ applicationId: appId });
      if (environmentId) params.set('environmentId', environmentId);

      source = new EventSource(
        `/api-gateway/sessions/live?${params.toString()}`,
        { withCredentials: true },
      );

      source.addEventListener('open', () => {
        failuresRef.current = 0;
        setState('live');
      });

      source.addEventListener('session', (event) => {
        try {
          const incoming = JSON.parse((event as MessageEvent).data) as LiveSession;
          setSessions((current) => {
            // Replace in place, so a session receiving events does not appear twice and does
            // not jump around as its count rises.
            const next = current.filter((session) => session.id !== incoming.id);
            next.unshift(incoming);
            return next.slice(0, 20);
          });
        } catch {
          // A malformed frame is not worth tearing the stream down for.
        }
      });

      source.addEventListener('error', () => {
        source?.close();
        source = null;
        failuresRef.current += 1;

        if (failuresRef.current >= MAX_FAILURES) {
          // Giving up is the honest outcome. EventSource would reconnect forever, and a
          // "live" badge that is not live is worse than no badge.
          setState('offline');
          return;
        }

        setState('reconnecting');
        retryTimer = setTimeout(connect, Math.min(1_000 * failuresRef.current, 5_000));
      });
    };

    connect();

    // Drops sessions that have gone quiet, so a stale row does not sit in a pane whose whole
    // claim is that it shows what is happening now.
    const sweep = setInterval(() => {
      const cutoff = Date.now() - RETAIN_MS;
      setSessions((current) => current.filter(
        (session) => new Date(session.lastActivityAt).getTime() > cutoff,
      ));
    }, 15_000);

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      clearInterval(sweep);
      source?.close();
    };
  }, [appId, environmentId, enabled]);

  return { sessions, state };
}
