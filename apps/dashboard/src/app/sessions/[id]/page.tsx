'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams, useParams } from 'next/navigation';
import Link from 'next/link';

const REPORT_ENGINE = '/api-gateway';

const EVENT_COLOR: Record<string, string> = {
  PAGE_VIEW:           'bg-blue-500',
  ROUTE_CHANGE:        'bg-blue-400',
  BUTTON_CLICK:        'bg-violet-400',
  LINK_CLICK:          'bg-fuchsia-400',
  FORM_SUBMIT:         'bg-green-500',
  FORM_SUBMITTED:      'bg-emerald-500',
  API_REQUEST:         'bg-neutral-400',
  ERROR_EVENT:         'bg-red-500',
  ERROR_OCCURRED:      'bg-red-500',
  UNHANDLED_EXCEPTION: 'bg-red-600',
  SERVER_ERROR:        'bg-red-600',
  CLIENT_ERROR:        'bg-red-400',
  BUSINESS_EVENT:      'bg-amber-400',
  STATE_ENTERED:       'bg-teal-500',
  STATE_TRANSITION:    'bg-indigo-500',
  WORKFLOW_STARTED:    'bg-cyan-500',
  WORKFLOW_COMPLETED:  'bg-emerald-500',
  WORKFLOW_FAILED:     'bg-rose-500',
};

const EVENT_TEXT: Record<string, string> = {
  PAGE_VIEW:           'text-blue-400',
  ROUTE_CHANGE:        'text-blue-300',
  BUTTON_CLICK:        'text-violet-400',
  LINK_CLICK:          'text-fuchsia-400',
  FORM_SUBMIT:         'text-green-400',
  FORM_SUBMITTED:      'text-emerald-400',
  API_REQUEST:         'text-neutral-400',
  ERROR_EVENT:         'text-red-400',
  ERROR_OCCURRED:      'text-red-400',
  UNHANDLED_EXCEPTION: 'text-red-500',
  SERVER_ERROR:        'text-red-500',
  CLIENT_ERROR:        'text-red-300',
  BUSINESS_EVENT:      'text-amber-400',
  STATE_ENTERED:       'text-teal-400',
  STATE_TRANSITION:    'text-indigo-400',
  WORKFLOW_STARTED:    'text-cyan-400',
  WORKFLOW_COMPLETED:  'text-emerald-400',
  WORKFLOW_FAILED:     'text-rose-400',
};

function formatOffset(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `+${m}:${String(s % 60).padStart(2, '0')}`;
}

function StatusBadge({ code }: { code: number }) {
  const color = code < 300 ? 'text-green-400' : code < 400 ? 'text-yellow-400' : 'text-red-400';
  return <span className={`font-mono text-xs font-semibold ${color}`}>{code}</span>;
}

interface ReplayData {
  sessionId: string;
  applicationId: string;
  startTime: string;
  endTime: string;
  durationMs: number;
  eventCount: number;
  isComplete: boolean;
  workflowPath: string[];
  stateTransitions: Array<{
    eventType: string;
    offset: number;
    timestamp: string;
    fromState: string | null;
    toState: string | null;
    action: string | null;
  }>;
  timeline: Array<{
    offset: number;
    eventType: string;
    metadata: Record<string, any>;
    timestamp: string;
  }>;
  apiCalls: Array<{
    endpoint: string;
    method: string;
    statusCode: number;
    durationMs: number;
    offset: number;
  }>;
  errors: Array<{ message: string; stack: string | null; offset: number }>;
}

import { Suspense } from 'react';

function ReplayViewerContent() {
  const params       = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const appId        = searchParams.get('appId') ?? '';
  const sessionId    = params.id;

  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  // ─── Playback state ──────────────────────────────────────────────────────────
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);   // 0.5x, 1x, 2x, 4x
  const eventListRef = useRef<HTMLDivElement>(null);
  const playbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const SPEED_OPTIONS = [0.5, 1, 2, 4];

  const goToEvent = useCallback((idx: number | null) => {
    setSelectedIdx(idx);
  }, []);

  const goNext = useCallback(() => {
    if (!data) return;
    setSelectedIdx(prev => {
      const next = (prev === null ? 0 : prev + 1);
      return next < data.timeline.length ? next : prev;
    });
  }, [data]);

  const goPrev = useCallback(() => {
    setSelectedIdx(prev => {
      if (prev === null || prev <= 0) return 0;
      return prev - 1;
    });
  }, []);

  // Auto-advance playback
  useEffect(() => {
    if (!isPlaying || !data) return;
    if (selectedIdx !== null && selectedIdx >= data.timeline.length - 1) {
      setIsPlaying(false);
      return;
    }
    const currentIdx = selectedIdx ?? -1;
    const nextIdx = currentIdx + 1;
    if (nextIdx >= data.timeline.length) {
      setIsPlaying(false);
      return;
    }
    // Calculate delay based on actual time gap between events
    const currentOffset = currentIdx >= 0 ? data.timeline[currentIdx].offset : 0;
    const nextOffset = data.timeline[nextIdx].offset;
    const gap = Math.max(50, (nextOffset - currentOffset) / playbackSpeed);
    const clampedGap = Math.min(gap, 3000 / playbackSpeed); // Cap max wait

    playbackTimerRef.current = setTimeout(() => {
      setSelectedIdx(nextIdx);
    }, clampedGap);

    return () => {
      if (playbackTimerRef.current) clearTimeout(playbackTimerRef.current);
    };
  }, [isPlaying, selectedIdx, playbackSpeed, data]);

  // Auto-scroll event list to selected event
  useEffect(() => {
    if (selectedIdx === null || !eventListRef.current) return;
    const el = eventListRef.current.children[selectedIdx] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [selectedIdx]);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Ignore if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      switch (e.key) {
        case ' ':
          e.preventDefault();
          setIsPlaying(p => !p);
          break;
        case 'ArrowRight':
          e.preventDefault();
          setIsPlaying(false);
          goNext();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          setIsPlaying(false);
          goPrev();
          break;
        case '1': setPlaybackSpeed(0.5); break;
        case '2': setPlaybackSpeed(1); break;
        case '3': setPlaybackSpeed(2); break;
        case '4': setPlaybackSpeed(4); break;
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goNext, goPrev]);

  const { data, isLoading, error } = useQuery<ReplayData>({
    queryKey: ['session-replay', sessionId],
    queryFn: async () => {
      const res = await fetch(`${REPORT_ENGINE}/sessions/${sessionId}/replay`);
      if (!res.ok) throw new Error('Failed to fetch replay');
      return res.json();
    },
  });

  if (isLoading) return (
    <div className="flex h-full items-center justify-center text-neutral-400 animate-pulse">
      Loading replay…
    </div>
  );
  if (error) return <div className="text-red-400">Error: {(error as Error).message}</div>;
  if (!data)  return null;

  const selected = selectedIdx !== null ? data.timeline[selectedIdx] : null;
  const totalMs  = data.durationMs || 1;

  return (
    <div className="flex h-full flex-col space-y-4 overflow-hidden">

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 flex-shrink-0">
        <div>
          <div className="flex items-center gap-3">
            <Link href={`/sessions?appId=${appId}`} className="text-neutral-500 hover:text-neutral-300 text-sm transition-colors">
              ← Sessions
            </Link>
            <h1 className="text-xl font-bold font-mono">{sessionId.slice(0, 8)}…{sessionId.slice(-4)}</h1>
          </div>
          <p className="mt-1 text-sm text-neutral-400">
            {data.eventCount} events · {Math.round(data.durationMs / 1000)}s duration
            <span className={`ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
              data.isComplete
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
            }`}>
              {data.isComplete ? 'Complete' : 'In Progress'}
            </span>
          </p>
        </div>
        {data.workflowPath.length > 0 && (
          <div className="flex flex-wrap items-center gap-1 max-w-2xl">
            {data.workflowPath.map((state, i) => (
              <span key={i} className="flex items-center gap-1">
                <span className="rounded bg-neutral-800 px-2 py-0.5 font-mono text-xs text-neutral-200 border border-neutral-700">
                  {state}
                </span>
                {i < data.workflowPath.length - 1 && (
                  <span className="text-neutral-600 text-xs">→</span>
                )}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Timeline scrubber */}
      <div className="flex-shrink-0 rounded-lg border border-neutral-800 bg-neutral-950 p-4">
        <p className="mb-2 text-xs text-neutral-500 uppercase tracking-wider">Event Timeline</p>
        <div className="relative h-6 rounded bg-neutral-900 overflow-hidden">
          {/* Progress indicator line */}
          {selectedIdx !== null && (
            <div
              className="absolute top-0 h-full w-0.5 bg-red-500 z-10 transition-all duration-150"
              style={{ left: `${(data.timeline[selectedIdx].offset / totalMs) * 100}%` }}
            />
          )}
          {data.timeline.map((ev, i) => (
            <button
              key={i}
              title={`${ev.eventType} @ ${formatOffset(ev.offset)}`}
              onClick={() => { setIsPlaying(false); goToEvent(i); }}
              style={{ left: `${(ev.offset / totalMs) * 100}%` }}
              className={`absolute top-1 h-4 w-1.5 rounded-full transition-all hover:scale-150 ${
                EVENT_COLOR[ev.eventType] ?? 'bg-neutral-400'
              } ${selectedIdx === i ? 'scale-150 ring-2 ring-white' : ''}`}
            />
          ))}
        </div>
        <div className="mt-1 flex justify-between text-xs text-neutral-600">
          <span>+0:00</span>
          <span>{formatOffset(data.durationMs)}</span>
        </div>
      </div>

      {/* Playback controls */}
      <div className="flex-shrink-0 flex items-center justify-between gap-4 rounded-lg border border-neutral-800 bg-neutral-950 px-4 py-2.5">
        <div className="flex items-center gap-2">
          {/* Prev */}
          <button
            onClick={() => { setIsPlaying(false); goPrev(); }}
            disabled={selectedIdx === null || selectedIdx <= 0}
            className="flex h-7 w-7 items-center justify-center rounded-md border border-neutral-800 bg-neutral-900 text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            title="Previous event (←)"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          {/* Play / Pause */}
          <button
            onClick={() => setIsPlaying(p => !p)}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors"
            title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
          >
            {isPlaying ? (
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="4" width="4" height="16" rx="1" />
              </svg>
            ) : (
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>
          {/* Next */}
          <button
            onClick={() => { setIsPlaying(false); goNext(); }}
            disabled={selectedIdx !== null && selectedIdx >= data.timeline.length - 1}
            className="flex h-7 w-7 items-center justify-center rounded-md border border-neutral-800 bg-neutral-900 text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            title="Next event (→)"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Time display */}
        <div className="font-mono text-xs text-neutral-400">
          <span className="text-white">
            {selectedIdx !== null ? formatOffset(data.timeline[selectedIdx].offset) : '+0:00'}
          </span>
          <span className="text-neutral-600 mx-1">/</span>
          <span>{formatOffset(data.durationMs)}</span>
          {selectedIdx !== null && (
            <span className="text-neutral-600 ml-2">
              Event {selectedIdx + 1} of {data.timeline.length}
            </span>
          )}
        </div>

        {/* Speed selector */}
        <div className="flex items-center gap-1">
          <span className="text-xs text-neutral-600 mr-1">Speed</span>
          {SPEED_OPTIONS.map(speed => (
            <button
              key={speed}
              onClick={() => setPlaybackSpeed(speed)}
              className={`rounded px-2 py-1 text-xs font-bold transition-colors ${
                playbackSpeed === speed
                  ? 'bg-blue-600 text-white'
                  : 'bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-800'
              }`}
            >
              {speed}x
            </button>
          ))}
        </div>

        {/* Keyboard hints */}
        <div className="hidden lg:flex items-center gap-2 text-xs text-neutral-600">
          <kbd className="rounded border border-neutral-800 bg-neutral-900 px-1.5 py-0.5 text-neutral-500">Space</kbd>
          <span>play</span>
          <kbd className="rounded border border-neutral-800 bg-neutral-900 px-1.5 py-0.5 text-neutral-500">← →</kbd>
          <span>step</span>
          <kbd className="rounded border border-neutral-800 bg-neutral-900 px-1.5 py-0.5 text-neutral-500">1-4</kbd>
          <span>speed</span>
        </div>
      </div>

      {/* Main body — 3-pane layout */}
      <div className="flex flex-1 gap-4 overflow-hidden min-h-0">

        {/* Event list */}
        <div className="w-72 flex-shrink-0 flex flex-col overflow-hidden rounded-lg border border-neutral-800 bg-neutral-900">
          <div className="border-b border-neutral-800 px-4 py-2 text-xs font-medium uppercase tracking-wider text-neutral-500">
            Events
          </div>
          <div ref={eventListRef} className="flex-1 overflow-y-auto divide-y divide-neutral-800">
            {data.timeline.map((ev, i) => (
              <button
                key={i}
                onClick={() => setSelectedIdx(i)}
                className={`w-full text-left px-4 py-3 hover:bg-neutral-800/60 transition-colors ${
                  selectedIdx === i ? 'bg-neutral-800' : ''
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-xs font-mono font-medium truncate ${EVENT_TEXT[ev.eventType] ?? 'text-neutral-400'}`}>
                    {ev.eventType}
                  </span>
                  <span className="text-xs text-neutral-600 flex-shrink-0">{formatOffset(ev.offset)}</span>
                </div>
                {ev.metadata?.url && (
                  <div className="mt-0.5 text-xs text-neutral-500 truncate">{ev.metadata.url}</div>
                )}
                {ev.metadata?.endpoint && (
                  <div className="mt-0.5 text-xs text-neutral-500 truncate">
                    {ev.metadata.method} {ev.metadata.endpoint}
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Detail panel */}
        <div className="flex-1 flex flex-col overflow-hidden rounded-lg border border-neutral-800 bg-neutral-900">
          <div className="border-b border-neutral-800 px-4 py-2 text-xs font-medium uppercase tracking-wider text-neutral-500">
            {selected ? `${selected.eventType} @ ${formatOffset(selected.offset)}` : 'Select an event'}
          </div>
          <div className="flex-1 overflow-auto p-4">
            {selected ? (
              <pre className="text-xs text-neutral-300 font-mono whitespace-pre-wrap leading-relaxed">
                {JSON.stringify(selected.metadata, null, 2)}
              </pre>
            ) : (
              <p className="text-sm text-neutral-600">Click an event in the list or timeline to inspect its metadata.</p>
            )}
          </div>
        </div>

        {/* Right column — State Transitions + API calls + errors */}
        <div className="w-72 flex-shrink-0 flex flex-col gap-4 overflow-hidden">

          {/* State Transitions (Gap 5) */}
          {data.stateTransitions && data.stateTransitions.length > 0 && (
            <div className="flex flex-col overflow-hidden rounded-lg border border-neutral-800 bg-neutral-900" style={{ maxHeight: '35%' }}>
              <div className="border-b border-neutral-800 px-4 py-2 text-xs font-medium uppercase tracking-wider text-indigo-400">
                State Transitions ({data.stateTransitions.length})
              </div>
              <div className="flex-1 overflow-y-auto divide-y divide-neutral-800">
                {data.stateTransitions.map((st, i) => (
                  <div key={i} className="px-4 py-2">
                    <div className="flex items-center gap-1.5">
                      {st.fromState && (
                        <>
                          <span className="font-mono text-xs text-neutral-300 truncate">{st.fromState}</span>
                          <span className="text-neutral-600 text-xs">→</span>
                        </>
                      )}
                      <span className="font-mono text-xs text-teal-400 truncate">{st.toState ?? st.eventType}</span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-neutral-600">
                      <span>{formatOffset(st.offset)}</span>
                      {st.action && <span className="text-neutral-500">· {st.action}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* API calls */}
          <div className="flex flex-col overflow-hidden rounded-lg border border-neutral-800 bg-neutral-900" style={{ maxHeight: '35%' }}>
            <div className="border-b border-neutral-800 px-4 py-2 text-xs font-medium uppercase tracking-wider text-neutral-500">
              API Calls ({data.apiCalls.length})
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-neutral-800">
              {data.apiCalls.length === 0 && (
                <p className="px-4 py-4 text-xs text-neutral-600">No API calls recorded.</p>
              )}
              {data.apiCalls.map((call, i) => (
                <div key={i} className="px-4 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs text-neutral-400 truncate">{call.method} {call.endpoint}</span>
                    <StatusBadge code={call.statusCode} />
                  </div>
                  <div className="mt-0.5 text-xs text-neutral-600">{call.durationMs}ms · {formatOffset(call.offset)}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Errors */}
          <div className="flex flex-col overflow-hidden rounded-lg border border-neutral-800 bg-neutral-900 flex-1">
            <div className="border-b border-neutral-800 px-4 py-2 text-xs font-medium uppercase tracking-wider text-red-500">
              Errors ({data.errors.length})
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-neutral-800">
              {data.errors.length === 0 && (
                <p className="px-4 py-4 text-xs text-neutral-600">No errors in this session.</p>
              )}
              {data.errors.map((err, i) => (
                <div key={i} className="px-4 py-2">
                  <p className="text-xs text-red-400 font-medium">{err.message}</p>
                  <p className="text-xs text-neutral-600 mt-0.5">{formatOffset(err.offset)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ReplayViewerPage() {
  return (
    <Suspense fallback={
      <div className="flex h-full items-center justify-center text-neutral-400 animate-pulse">
        Loading replay…
      </div>
    }>
      <ReplayViewerContent />
    </Suspense>
  );
}
