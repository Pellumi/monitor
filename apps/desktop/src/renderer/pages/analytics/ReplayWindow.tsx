import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";

declare global {
  interface Window {
    replayBridge?: {
      ready(): void;
      onEvents(callback: (events: unknown[]) => void): () => void;
    };
  }
}

/**
 * The Session Replay window's entire UI. Runs with no Tellann bridge — see
 * preload/replay-preload.ts — so it never touches window.tellann, IPC beyond
 * the one events channel, or any desktop-context state. The events array it
 * receives was already fetched and gunzipped by the main process; this
 * window's only job is to hand them to rrweb's Replayer inside a sandboxed
 * iframe (no allow-scripts — the recorded DOM is untrusted) and drive
 * play/pause from here, matching the web dashboard's "parent owns the clock"
 * model so the player never free-runs its own timer.
 */
export function ReplayWindow({ sessionId }: { sessionId: string }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const replayerRef = useRef<any>(null);
  const [status, setStatus] = useState<"loading" | "empty" | "ready" | "error">("loading");
  const [playing, setPlaying] = useState(false);
  const [offsetMs, setOffsetMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);

  useEffect(() => {
    if (!window.replayBridge) {
      setStatus("error");
      return;
    }
    const unsubscribe = window.replayBridge.onEvents(async (events) => {
      if (!events.length) {
        setStatus("empty");
        return;
      }
      try {
        const { Replayer } = await import("rrweb");
        if (!rootRef.current) return;
        const replayer = new Replayer(events as any, {
          root: rootRef.current,
          skipInactive: false,
          mouseTail: false,
        });
        // The recorded page is untrusted content — strip script execution
        // from the iframe rrweb builds, matching the web player's isolation.
        const iframe = rootRef.current.querySelector("iframe");
        iframe?.setAttribute("sandbox", "");
        replayerRef.current = replayer;
        const first = events[0] as { timestamp: number };
        const last = events[events.length - 1] as { timestamp: number };
        setDurationMs(Math.max(0, last.timestamp - first.timestamp));
        setStatus("ready");
      } catch {
        setStatus("error");
      }
    });
    window.replayBridge.ready();
    return unsubscribe;
  }, []);

  const togglePlay = () => {
    const replayer = replayerRef.current;
    if (!replayer) return;
    if (playing) {
      replayer.pause();
      setPlaying(false);
    } else {
      replayer.play(offsetMs);
      setPlaying(true);
    }
  };

  const seek = (ms: number) => {
    const replayer = replayerRef.current;
    setOffsetMs(ms);
    if (!replayer) return;
    if (playing) replayer.play(ms);
    else replayer.pause(ms);
  };

  return (
    <div className="replay-window">
      <header className="replay-window-toolbar">
        <strong>Session Replay</strong>
        <span className="muted">{sessionId}</span>
      </header>
      <div className="replay-window-stage" ref={rootRef}>
        {status === "loading" ? <div className="page-empty">Loading recording…</div> : null}
        {status === "empty" ? <div className="page-empty">This session has no DOM recording.</div> : null}
        {status === "error" ? <div className="page-empty">Could not load this recording.</div> : null}
      </div>
      {status === "ready" ? (
        <footer className="replay-window-controls">
          <button type="button" className="button" onClick={togglePlay}>
            {playing ? <Pause size={14} /> : <Play size={14} />}
          </button>
          <input
            type="range"
            min={0}
            max={durationMs}
            value={offsetMs}
            onChange={(event) => seek(Number(event.target.value))}
            style={{ flex: 1 }}
          />
          <span className="muted">
            {Math.round(offsetMs / 1000)}s / {Math.round(durationMs / 1000)}s
          </span>
        </footer>
      ) : null}
    </div>
  );
}
