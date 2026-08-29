"use client";

import { useState } from "react";

const actions = [
  { label: "Browse product", event: "PAGE_VISIT", state: "PRODUCT_BROWSING" },
  { label: "Add to cart", event: "BUTTON_CLICK", state: "CART_ACTIVE" },
  { label: "Checkout", event: "STATE_TRANSITION", state: "CHECKOUT" },
  { label: "Submit payment", event: "API_REQUEST", state: "PAYMENT_SUCCESS" },
] as const;

export function DemonstrationRecorder() {
  const [recording, setRecording] = useState(false);
  const [complete, setComplete] = useState(false);
  const [performed, setPerformed] = useState(0);

  function start() {
    setRecording(true);
    setComplete(false);
    setPerformed(0);
  }
  function stop() {
    setRecording(false);
    setComplete(true);
  }

  return (
    <div className="demo-recorder" data-recording={recording}>
      <div className="demo-recorder-app">
        <div className="demo-recorder-bar">
          <span>Sample commerce application</span>
          <i>
            {recording
              ? "Demonstration active"
              : complete
                ? "Analysis ready"
                : "Ready"}
          </i>
        </div>
        <div className="demo-recorder-stage">
          <p className="demo-kicker">Illustrative workflow</p>
          <h3>Complete a checkout.</h3>
          <div className="demo-recorder-actions">
            {actions.map((action, index) => (
              <button
                key={action.label}
                type="button"
                disabled={!recording || index > performed}
                data-complete={index < performed}
                onClick={() =>
                  setPerformed((value) => Math.max(value, index + 1))
                }
              >
                <span>{String(index + 1).padStart(2, "0")}</span>
                {action.label}
                <i>{index < performed ? "✓" : "→"}</i>
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="demo-observer">
        <div className="demo-observer-status">
          <span className={recording ? "is-live" : ""}>
            ●{" "}
            {recording ? "Recording" : complete ? "Complete" : "Not recording"}
          </span>
          <b>{recording ? "02:14" : "00:00"}</b>
        </div>
        <dl>
          <div>
            <dt>Workflow</dt>
            <dd>{performed > 1 ? "Checkout" : "—"}</dd>
          </div>
          <div>
            <dt>Events</dt>
            <dd>{performed * 46}</dd>
          </div>
          <div>
            <dt>States observed</dt>
            <dd>{performed * 3}</dd>
          </div>
          <div>
            <dt>API requests</dt>
            <dd>{performed * 6}</dd>
          </div>
          <div>
            <dt>Errors</dt>
            <dd>{performed === 4 ? 1 : 0}</dd>
          </div>
        </dl>
        <div className="demo-event-feed" aria-live="polite">
          {actions.slice(0, performed).map((action, index) => (
            <span key={action.event}>
              <i>{`08:42:${17 + index * 2}`}</i>
              {action.event}
              <b>{action.state}</b>
            </span>
          ))}
        </div>
        {!recording && !complete ? (
          <button type="button" onClick={start}>
            Start demonstration <span>→</span>
          </button>
        ) : null}
        {recording ? (
          <button type="button" onClick={stop} disabled={performed === 0}>
            Stop demonstration <span>■</span>
          </button>
        ) : null}
        {complete ? (
          <div className="demo-analysis">
            <span>✓ Session reconstructed</span>
            <span>✓ {performed * 3} states discovered</span>
            <span>✓ Behavior Graph updated</span>
            <button type="button" onClick={start}>
              Run another demonstration
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
