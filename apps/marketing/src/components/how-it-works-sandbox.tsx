"use client";

import { useState } from "react";

const stages = [
  { action: "Visit product", state: "PRODUCT_VIEW" },
  { action: "Add to cart", state: "CART_ACTIVE" },
  { action: "Checkout", state: "CHECKOUT" },
] as const;

export function HowItWorksSandbox() {
  const [observed, setObserved] = useState(0);

  return (
    <div
      className="hiw-sandbox"
      aria-label="Illustrative behavior model sandbox"
    >
      <div className="hiw-sandbox-app">
        <p className="hiw-kicker">Demo application</p>
        <h3>Build a checkout path.</h3>
        <p>Perform the next application action and watch the model update.</p>
        <div className="hiw-sandbox-actions">
          {stages.map((stage, index) => (
            <button
              key={stage.state}
              type="button"
              disabled={index > observed}
              data-complete={index < observed}
              onClick={() =>
                setObserved((current) => Math.max(current, index + 1))
              }
            >
              <span>{String(index + 1).padStart(2, "0")}</span>
              {stage.action}
              <i aria-hidden="true">{index < observed ? "✓" : "→"}</i>
            </button>
          ))}
        </div>
        <button
          className="hiw-reset"
          type="button"
          onClick={() => setObserved(0)}
          disabled={observed === 0}
        >
          Reset example
        </button>
      </div>
      <div className="hiw-sandbox-model" aria-live="polite">
        <p className="hiw-kicker">Tellann model</p>
        <div className="hiw-mini-graph">
          {stages.map((stage, index) => (
            <div
              key={stage.state}
              className={index < observed ? "is-observed" : ""}
            >
              <span>{stage.state}</span>
              {index < stages.length - 1 ? <i aria-hidden="true">↓</i> : null}
            </div>
          ))}
        </div>
        <dl>
          <div>
            <dt>States observed</dt>
            <dd>{observed}</dd>
          </div>
          <div>
            <dt>Transitions observed</dt>
            <dd>{Math.max(0, observed - 1)}</dd>
          </div>
        </dl>
        <small>
          Illustrative sample only. No application data is captured.
        </small>
      </div>
    </div>
  );
}
