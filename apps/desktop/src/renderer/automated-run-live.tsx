/**
 * The automated half of the live run page.
 *
 * An automated run has no one driving the browser — Tellann does, following the
 * Flow itself — so what there is to show is phase and step progress, a textual
 * log of what happened, and, on the rare step a human has to do, a handover card
 * asking for it. These pieces are composed into the full live run page
 * (`LiveRunPage` in pages.tsx) once a `GuidedRunState` exists for the run, and
 * alone, via `AutomatedPreparingView`, during the brief window before it does.
 */
import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { Globe2, Play, Square, UserRound } from "lucide-react";
import type { AutomatedRunStatus } from "@tellann/desktop-contracts";
import { describeExecutionPhase } from "./automation-shared";

const bridge = () => window.tellann?.automation;

/** Wires the handover/stop actions to the automation bridge, with a shared busy flag. */
export function useAutomatedRunControl() {
  const [busy, setBusy] = useState(false);
  const api = bridge();
  const act = useCallback(async (action: () => Promise<unknown> | undefined) => {
    setBusy(true);
    try {
      await action();
    } catch {
      // the status stream shows what happened
    } finally {
      setBusy(false);
    }
  }, []);
  return {
    busy,
    available: Boolean(api),
    confirm: () => act(() => api?.confirmSignedIn()),
    cancel: () => act(() => api?.cancel()),
  };
}

/** The card asking a person to do the one thing Tellann cannot: approve a step, do a manual step, or sign in. */
export function AutomatedHandoverCard({
  status,
  busy,
  onConfirm,
  onCancel,
}: {
  status: AutomatedRunStatus;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (status.state !== "AWAITING_USER" || !status.awaitingUser) return null;
  return (
    <section className="automated-handover" role="alert">
      <UserRound size={18} />
      <div>
        {status.awaitingUser.kind === "CONFIRM_STEP" ? (
          <>
            <strong>Approve this step</strong>
            <p>{status.awaitingUser.detail}</p>
            <p className="field-hint">The Flow marks this step as one a person approves first. Declining stops the run here; nothing further is done to your application.</p>
            <div className="automated-inline">
              <button className="button primary" type="button" disabled={busy} onClick={onConfirm}><Play size={14} /> Approve and continue</button>
              <button className="button" type="button" disabled={busy} onClick={onCancel}><Square size={14} /> Decline and stop</button>
            </div>
          </>
        ) : status.awaitingUser.kind === "MANUAL_STEP" ? (
          <>
            <strong>Tellann needs you to do a step</strong>
            <p>{status.awaitingUser.detail}</p>
            <p className="field-hint">The browser Tellann opened is in front of you. Nothing you type there is recorded. When you have done it, come back here and Tellann will check it worked and carry on.</p>
            <button className="button primary" type="button" disabled={busy} onClick={onConfirm}><Play size={14} /> I have done it</button>
          </>
        ) : (
          <>
            <strong>Tellann needs you to sign in</strong>
            <p>{status.awaitingUser.detail}</p>
            <p className="field-hint">The browser Tellann opened is in front of you. Nothing you type there is recorded, and Tellann never tries to get past a CAPTCHA. When you are in, come back here.</p>
            <button className="button primary" type="button" disabled={busy} onClick={onConfirm}><Play size={14} /> I have signed in</button>
          </>
        )}
      </div>
    </section>
  );
}

/** The finished card: what happened, and, on anything but failure, where to see it. */
export function AutomatedOutcomeCard({ status, runHref }: { status: AutomatedRunStatus; runHref: string }) {
  if (status.state !== "FINISHED" || !status.outcome) return null;
  return (
    <section className="automated-outcome" data-tone={status.outcome.tone}>
      <p>{status.outcome.message}</p>
      {status.outcome.nextStep ? <p className="field-hint">{status.outcome.nextStep}</p> : null}
      {status.outcome.result !== "FAILED" ? <Link className="button primary" to={runHref}>Open the run</Link> : null}
    </section>
  );
}

/**
 * The one lifecycle control an automated run gets: stop. It must go through
 * the automation bridge, not the generic guided-run end IPC, since the
 * automation manager — not the observer — owns this run.
 */
export function AutomatedStopControl({
  status,
  busy,
  onStop,
}: {
  status: AutomatedRunStatus;
  busy: boolean;
  onStop: () => void;
}) {
  if (status.state === "FINISHED") return null;
  return (
    <button className="button" type="button" disabled={busy} onClick={onStop}>
      <Square size={14} /> Stop the run
    </button>
  );
}

/**
 * Phase, steps taken and the state Tellann is aiming for — the automated-specific
 * facts the normal route/viewport/interaction-mode block has no equivalent for.
 */
export function AutomatedRunPhaseFacts({ status }: { status: AutomatedRunStatus }) {
  return (
    <div className="run-facts">
      <article>
        <small>Phase</small>
        <strong>{status.phase ? describeExecutionPhase(status.phase) : "Working"}</strong>
        <span>{status.currentStateKey ? `In ${status.currentStateKey}` : "Not yet in a declared state"}</span>
      </article>
      <article>
        <small>Steps taken</small>
        <strong>{status.steps}</strong>
        <span>Since the run started.</span>
      </article>
      <article>
        <small>Target state</small>
        <strong>{status.targetStateKey}</strong>
        <span>What this run is aiming to reach.</span>
      </article>
    </div>
  );
}

/** The scrolling log of what the run has done. */
export function AutomatedEventsLog({ status }: { status: AutomatedRunStatus }) {
  return (
    <ol className="automated-events" aria-label="What the run has done">
      {status.events.map((event, index) => (
        <li key={`${event.at}:${index}`} data-tone={event.tone}>
          <time>{new Date(event.at).toLocaleTimeString()}</time>
          <span>{event.text}</span>
        </li>
      ))}
    </ol>
  );
}

/** A handful of skeleton bars standing in for rows that have nothing to show yet. */
function SkeletonLines({ count }: { count: number }) {
  return (
    <div className="automated-skeleton-list" aria-hidden="true">
      {Array.from({ length: count }).map((_, index) => (
        <span key={index} className="skeleton-line" />
      ))}
    </div>
  );
}

/**
 * What `LiveRunPage` shows before a `GuidedRunState` exists for this run — from
 * the moment an automated run starts until its browser actually opens. Shaped
 * like the live run page itself (same toolbar, same three panes) so the swap
 * to the real thing is a fill-in, not a layout jump: whatever this view
 * already has real data for (phase, steps, target, a handover, an outcome, the
 * event log) renders for real, and whatever can only come from the
 * `GuidedRunState` that doesn't exist yet — expected states, the current
 * route, findings, evidence — renders as a skeleton.
 */
export function AutomatedPreparingView({ status }: { status: AutomatedRunStatus }) {
  const control = useAutomatedRunControl();
  const finished = status.state === "FINISHED";
  const awaitingUser = status.state === "AWAITING_USER";
  const disabled = control.busy || !control.available;
  const hasEvents = status.events.length > 0;
  return (
    <div className="live-run-page">
      <header className="run-toolbar">
        <div className="run-toolbar-title">
          <h1>{finished ? status.outcome?.title ?? "Finished" : status.phase ? describeExecutionPhase(status.phase) : "Opening the browser"}</h1>
          <span className="run-toolbar-subtitle">
            {status.currentStateKey ? `In ${status.currentStateKey} · ` : ""}aiming for {status.targetStateKey}
          </span>
        </div>
        <div className="run-toolbar-meters">
          <span
            className="status-pill"
            data-tone={finished ? (status.outcome?.result === "COMPLETED" ? "success" : "danger") : awaitingUser ? "warning" : "progress"}
          >
            <span aria-hidden="true" />
            {finished ? "Finished" : awaitingUser ? "Awaiting you" : "Preparing"}
          </span>
          <span>{status.steps} step{status.steps === 1 ? "" : "s"}</span>
        </div>
        <div className="run-toolbar-actions">
          <AutomatedStopControl status={status} busy={disabled} onStop={control.cancel} />
        </div>
      </header>

      <section className="live-flow" aria-hidden="true">
        <div className="flow-panel-bar">
          <span>Expected states</span>
        </div>
        <SkeletonLines count={6} />
      </section>

      <section className="live-browser">
        <div className="browser-toolbar">
          <Globe2 size={16} />
          <strong>Managed Chromium</strong>
          <span className="browser-toolbar-route skeleton-line" aria-hidden="true" />
        </div>
        <div className="run-workspace">
          <AutomatedHandoverCard status={status} busy={disabled} onConfirm={control.confirm} onCancel={control.cancel} />
          <AutomatedOutcomeCard status={status} runHref={`/applications/${status.applicationId}/qa-runs/${status.runId}`} />
          <AutomatedRunPhaseFacts status={status} />
          {hasEvents ? (
            <section className="run-timeline">
              <header>
                <h2>What's happened</h2>
                <span>{status.events.length} event{status.events.length === 1 ? "" : "s"}</span>
              </header>
              <AutomatedEventsLog status={status} />
            </section>
          ) : (
            <section className="run-findings" aria-hidden="true">
              <header>
                <h2>Findings</h2>
              </header>
              <div style={{ padding: 14 }}>
                <SkeletonLines count={2} />
              </div>
            </section>
          )}
        </div>
      </section>

      <aside className="live-evidence" aria-hidden="true">
        <div className="evidence-heading">
          <h2>Live evidence</h2>
        </div>
        <div style={{ padding: 12 }}>
          <SkeletonLines count={5} />
        </div>
      </aside>
    </div>
  );
}
