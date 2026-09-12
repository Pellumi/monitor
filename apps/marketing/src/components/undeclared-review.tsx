"use client";

import { useState } from "react";

type Decision = "PENDING" | "ADDED" | "LEFT";

export function UndeclaredReview() {
  const [decision, setDecision] = useState<Decision>("PENDING");

  return (
    <div className="recon-review-card" aria-live="polite">
      <span className="recon-pill is-undeclared">
        <i aria-hidden="true">+</i>
        Undeclared
      </span>
      <b>Promo code rejected</b>
      <dl>
        <div>
          <dt>Observed</dt>
          <dd>4 times</dd>
        </div>
        <div>
          <dt>Workflow</dt>
          <dd>Checkout</dd>
        </div>
        <div>
          <dt>In expected flow</dt>
          <dd>No</dd>
        </div>
      </dl>

      {decision === "PENDING" ? (
        <>
          <p>This behavior wasn&apos;t declared. Is it expected?</p>
          <div className="recon-review-actions">
            <button
              type="button"
              className="is-primary"
              onClick={() => setDecision("ADDED")}
            >
              Yes, add to intent
            </button>
            <button type="button" onClick={() => setDecision("LEFT")}>
              Leave undeclared
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="recon-review-result">
            {decision === "ADDED"
              ? "Added to the declared Checkout flow. Future runs will reconcile against it, and the change is recorded as promoted from a demonstration."
              : "Left undeclared. It stays visible for review, and nothing about the declared flow changed."}
          </p>
          <div className="recon-review-actions">
            <button type="button" onClick={() => setDecision("PENDING")}>
              Reset example
            </button>
          </div>
        </>
      )}
    </div>
  );
}
