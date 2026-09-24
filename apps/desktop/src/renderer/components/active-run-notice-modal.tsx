import { useEffect, useRef, useState } from 'react';
import { Activity, TriangleAlert, X } from 'lucide-react';
import type { GuidedRunState } from '@tellann/browser-observer';

/**
 * Why the run is being raised: because it has been left alone for a while, or
 * because it stands in the way of something the user just tried to do.
 */
export type ActiveRunNoticeKind = 'reminder' | 'scope';

function formatElapsed(startedAt: string, now: number): string {
  const total = Math.max(0, Math.floor((now - new Date(startedAt).valueOf()) / 1000));
  if (!Number.isFinite(total)) return 'just now';
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (hours) return `${hours}h ${String(minutes).padStart(2, '0')}m`;
  if (minutes) return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
  return `${seconds}s`;
}

function host(targetUrl: string): string {
  try {
    return new URL(targetUrl).host;
  } catch {
    return targetUrl;
  }
}

/**
 * The run the user walked away from, brought to them. Capture never stops on
 * its own, so this is the one place outside the run page that can both take
 * them back to it and end it — leaving it recording unattended, or losing it
 * behind a page they never returned to, are the two failures it exists for.
 */
export function ActiveRunNoticeModal({
  kind,
  run,
  applicationName,
  busy,
  onOpenRun,
  onEndRun,
  onDismiss,
}: {
  kind: ActiveRunNoticeKind;
  run: GuidedRunState;
  applicationName: string | null;
  busy: boolean;
  onOpenRun(): void;
  onEndRun(): void;
  onDismiss(): void;
}) {
  const openButtonRef = useRef<HTMLButtonElement>(null);
  const [now, setNow] = useState(() => Date.now());
  const paused = run.status === 'PAUSED';

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    openButtonRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onDismiss();
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('keydown', closeOnEscape);
      previouslyFocused?.focus();
    };
  }, [busy, onDismiss]);

  const title = kind === 'scope'
    ? 'End this QA run before switching application'
    : paused
      ? 'Your QA run is paused and still open'
      : 'Your QA run is still recording';
  const summary = kind === 'scope'
    ? `This run belongs to ${applicationName ?? 'the current application'}. Tellann records one run at a time, against the application it was started for, so the scope stays put until the run ends.`
    : paused
      ? 'Nothing is being captured while it is paused, and it will stay that way until you resume or end it.'
      : 'It has been capturing on its own since you left the run page. Open it when you are ready, or end it to generate its report.';

  return (
    <div
      className="desktop-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onDismiss();
      }}
    >
      <div
        className="desktop-modal qa-run-error-modal active-run-notice"
        data-kind={kind}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="active-run-notice-title"
        aria-describedby="active-run-notice-summary"
      >
        <button
          type="button"
          className="desktop-modal-close"
          aria-label="Dismiss"
          disabled={busy}
          onClick={onDismiss}
        >
          <X size={16} />
        </button>

        <div className="qa-run-error-heading">
          <span className="qa-run-error-icon" aria-hidden="true">
            {kind === 'scope' ? <TriangleAlert size={20} /> : <Activity size={20} />}
          </span>
          <div>
            <h2 id="active-run-notice-title">{title}</h2>
            <p id="active-run-notice-summary">{summary}</p>
          </div>
        </div>

        <div className="qa-run-error-target">
          <span>{paused ? 'Paused run' : 'Recording'}</span>
          <code>
            {host(run.targetUrl)} · {formatElapsed(run.startedAt, now)} · {run.runId.slice(0, 8)}
          </code>
        </div>

        <div className="confirm-modal-actions">
          <button
            type="button"
            className="button confirm-modal-btn-cancel"
            disabled={busy}
            onClick={onDismiss}
          >
            {kind === 'scope' ? 'Stay here' : 'Not now'}
          </button>
          <button
            type="button"
            className="button confirm-modal-btn-cancel is-danger"
            disabled={busy}
            onClick={onEndRun}
          >
            {busy ? 'Ending…' : 'End run'}
          </button>
          <button
            ref={openButtonRef}
            type="button"
            className="button confirm-modal-btn-action"
            disabled={busy}
            onClick={onOpenRun}
          >
            Open the run
          </button>
        </div>
      </div>
    </div>
  );
}
