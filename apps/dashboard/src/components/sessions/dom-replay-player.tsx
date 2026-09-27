'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { authenticatedFetch } from '@/lib/authenticated-fetch';

/**
 * Visual playback of a session's DOM recording.
 *
 * Deliberately a *slave* to the existing event timeline rather than a second player with
 * its own clock. The scrubber, speed control and keyboard shortcuts in the page above
 * already work and readers already know them; two clocks would drift and the reader would
 * have to reconcile them. So this takes an offset and seeks there.
 *
 * rrweb's replayer is loaded dynamically for the same reason the recorder is: a session
 * with no recording, which is most of them, should not download a player.
 */

interface ManifestChunk {
  seq: number;
  startOffsetMs: number;
  endOffsetMs: number;
  eventCount: number;
  hasFullSnapshot: boolean;
  trigger: string;
  encoding: string;
  bytes: number;
  url: string;
  isPresigned: boolean;
}

interface ReplayManifest {
  sessionId: string;
  format: string | null;
  available: boolean;
  startTime?: string;
  totalBytes?: number;
  chunks: ManifestChunk[];
}

interface DomReplayPlayerProps {
  sessionId: string;
  /** Where the event timeline currently is, in ms from the session's first event. */
  offsetMs: number;
  isPlaying: boolean;
  speed: number;
  /** Told once, so the page can show the rails-only layout when there is no recording. */
  onAvailabilityChange?: (available: boolean) => void;
}

type LoadState =
  | { kind: 'loading' }
  | { kind: 'unavailable'; reason: string }
  | { kind: 'ready' }
  | { kind: 'error'; message: string };

/** Decompresses a chunk and parses its newline-delimited rrweb events. */
async function loadChunk(chunk: ManifestChunk): Promise<unknown[]> {
  // A presigned URL goes straight to object storage, so it must not carry our cookies; a
  // relative URL is our own streaming route and must.
  const response = chunk.isPresigned
    ? await fetch(chunk.url)
    : await authenticatedFetch(chunk.url);
  if (!response.ok) throw new Error(`Chunk ${chunk.seq} failed with ${response.status}`);

  let text: string;
  if (chunk.encoding === 'gzip') {
    // A presigned object-storage response usually arrives with Content-Encoding: gzip and
    // the browser has already inflated it. Our own route sets that header too. Where the
    // header is absent -- some adapters do not set it -- DecompressionStream handles it.
    const buffer = await response.arrayBuffer();
    const looksGzipped = new Uint8Array(buffer.slice(0, 2)).join(',') === '31,139';
    if (looksGzipped && typeof (globalThis as any).DecompressionStream === 'function') {
      const stream = new Blob([buffer]).stream()
        .pipeThrough(new (globalThis as any).DecompressionStream('gzip'));
      text = await new Response(stream).text();
    } else {
      text = new TextDecoder().decode(buffer);
    }
  } else {
    text = await response.text();
  }

  return text.split('\n').filter(Boolean).map((line) => JSON.parse(line));
}

export function DomReplayPlayer({
  sessionId,
  offsetMs,
  isPlaying,
  speed,
  onAvailabilityChange,
}: DomReplayPlayerProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const replayerRef = useRef<any>(null);
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [meta, setMeta] = useState<{ chunks: number; bytes: number; errorTriggered: boolean } | null>(null);

  // ── Load the manifest, then the chunks, then build the replayer ─────────────
  useEffect(() => {
    let cancelled = false;

    async function build() {
      try {
        const response = await authenticatedFetch(`/api-gateway/sessions/${sessionId}/replay/manifest`);
        if (response.status === 402 || response.status === 403) {
          // Not entitled, which is a plan answer rather than a failure.
          if (!cancelled) {
            setState({ kind: 'unavailable', reason: 'Visual replay is not included in this plan.' });
            onAvailabilityChange?.(false);
          }
          return;
        }
        if (!response.ok) throw new Error(`Manifest failed with ${response.status}`);

        const manifest = (await response.json()) as ReplayManifest;
        if (cancelled) return;

        if (!manifest.available || manifest.chunks.length === 0) {
          setState({
            kind: 'unavailable',
            // The common case, and worth explaining: the default mode only records when
            // something goes wrong, so an absence here is usually good news.
            reason: 'No DOM recording for this session. Recording is on-error by default, so sessions that completed cleanly have none.',
          });
          onAvailabilityChange?.(false);
          return;
        }

        // Only chunks that can be played from. A chunk with no full snapshot before it has
        // nothing to apply its mutations to -- the hint can be wrong, since the collector
        // never parses a body, so the first usable snapshot is found rather than assumed.
        const firstSnapshot = manifest.chunks.findIndex((chunk) => chunk.hasFullSnapshot);
        const playable = manifest.chunks.slice(firstSnapshot === -1 ? 0 : firstSnapshot);

        const loaded = await Promise.all(playable.map(loadChunk));
        if (cancelled) return;

        const events = loaded.flat();
        if (events.length < 2) {
          setState({ kind: 'unavailable', reason: 'The recording for this session is too short to play.' });
          onAvailabilityChange?.(false);
          return;
        }

        const { Replayer } = await import('rrweb');
        if (cancelled || !hostRef.current) return;

        // replaceChildren rather than innerHTML: nothing untrusted is being assigned
        // either way, but the idiom should not appear in a file that handles recorded
        // customer DOM.
        hostRef.current.replaceChildren();

        // The recorded DOM is untrusted content from the customer's users' browsers.
        // rrweb renders it into a sandboxed iframe with no allow-scripts, so recorded
        // markup is displayed and never executed -- which is the only reason showing it
        // in the dashboard is safe at all.
        replayerRef.current = new Replayer(events as any, {
          root: hostRef.current,
          // The page above owns the clock. Skipping inactivity here would desynchronise
          // the two, so the player follows real time and is seeked instead.
          skipInactive: false,
          showWarning: false,
          mouseTail: false,
          speed,
        });
        replayerRef.current.pause(0);

        setMeta({
          chunks: playable.length,
          bytes: manifest.totalBytes ?? 0,
          errorTriggered: manifest.chunks.some((chunk) => chunk.trigger === 'ERROR'),
        });
        setState({ kind: 'ready' });
        onAvailabilityChange?.(true);
      } catch (error) {
        if (cancelled) return;
        setState({ kind: 'error', message: error instanceof Error ? error.message : 'Playback failed' });
        onAvailabilityChange?.(false);
      }
    }

    void build();
    return () => {
      cancelled = true;
      try { replayerRef.current?.destroy?.(); } catch { /* already gone */ }
      replayerRef.current = null;
    };
    // `speed` is applied through setConfig below rather than by rebuilding.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // ── Follow the timeline ────────────────────────────────────────────────────
  const seek = useCallback((ms: number, play: boolean) => {
    const replayer = replayerRef.current;
    if (!replayer) return;
    try {
      if (play) replayer.play(Math.max(0, ms));
      else replayer.pause(Math.max(0, ms));
    } catch {
      // Seeking past the end of a partial recording is normal for an error-triggered
      // capture, which covers only the seconds around the failure.
    }
  }, []);

  useEffect(() => {
    if (state.kind !== 'ready') return;
    seek(offsetMs, isPlaying);
  }, [state.kind, offsetMs, isPlaying, seek]);

  useEffect(() => {
    if (state.kind !== 'ready') return;
    try { replayerRef.current?.setConfig?.({ speed }); } catch { /* older build */ }
  }, [state.kind, speed]);

  if (state.kind === 'loading') {
    return (
      <div className="flex h-full min-h-[280px] items-center justify-center rounded-lg border border-neutral-800 bg-neutral-950 text-sm text-neutral-500">
        <span className="animate-pulse">Loading recording…</span>
      </div>
    );
  }

  if (state.kind === 'unavailable' || state.kind === 'error') {
    return (
      <div className="flex h-full min-h-[280px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-neutral-800 bg-neutral-950 px-8 text-center">
        <p className="text-sm text-neutral-400">
          {state.kind === 'error' ? 'Could not play this recording' : 'No visual recording'}
        </p>
        <p className="max-w-md text-xs leading-relaxed text-neutral-600">
          {state.kind === 'error' ? state.message : state.reason}
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border border-neutral-800 bg-neutral-950">
      <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-2">
        <span className="text-xs uppercase tracking-wider text-neutral-500">Screen</span>
        {meta && (
          <span className="flex items-center gap-2 text-[11px] text-neutral-600">
            {meta.errorTriggered && (
              // Worth flagging: an error-triggered recording covers the seconds around the
              // failure, not the whole session, so a reader seeking elsewhere sees nothing
              // and should know why.
              <span className="rounded bg-red-500/10 px-1.5 py-0.5 font-medium text-red-400 ring-1 ring-red-500/20">
                captured on error
              </span>
            )}
            {meta.chunks} chunk{meta.chunks === 1 ? '' : 's'}
            {meta.bytes > 0 && ` · ${(meta.bytes / 1024 / 1024).toFixed(1)} MB`}
          </span>
        )}
      </div>
      {/* rrweb sizes its own iframe from the recorded viewport; the wrapper scrolls rather
          than scaling, so text stays legible at whatever size the user's screen was. */}
      <div ref={hostRef} className="tellann-replay-host flex-1 overflow-auto bg-white" />
    </div>
  );
}
