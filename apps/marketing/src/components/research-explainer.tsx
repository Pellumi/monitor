"use client";

import { useState } from "react";
import { ProductPlaceholder } from "@/components/product-tour";

type Mode = "DECLARED" | "DEMONSTRATED" | "COMPARE" | "INTERPRET";

const modes: { key: Mode; label: string }[] = [
  { key: "DECLARED", label: "Declared" },
  { key: "DEMONSTRATED", label: "Demonstration" },
  { key: "COMPARE", label: "Compare" },
  { key: "INTERPRET", label: "Interpret" },
];

type StateStatus = "observed" | "not-observed";

const states: { key: string; label: string; status: StateStatus }[] = [
  { key: "cart", label: "Cart", status: "observed" },
  { key: "checkout", label: "Checkout", status: "observed" },
  { key: "payment", label: "Payment", status: "not-observed" },
  { key: "confirmation", label: "Confirmation", status: "not-observed" },
];

const copy: Record<Mode, { kicker: string; body: string }> = {
  DECLARED: {
    kicker: "Step 1 · Declared journey",
    body: "A fictitious checkout application declares four states that should exist: Cart, Checkout, Payment, and Confirmation.",
  },
  DEMONSTRATED: {
    kicker: "Step 2 · Observed demonstration",
    body: "The available example demonstration reaches Checkout but does not provide evidence of Payment or Confirmation.",
  },
  COMPARE: {
    kicker: "Step 3 · Compare",
    body: "Placing the declared journey beside the demonstration makes the gap visible: two states were observed, two were not.",
  },
  INTERPRET: {
    kicker: "Step 4 · Interpret",
    body: "Missing evidence for Payment and Confirmation means those states have not been demonstrated yet — not that they are confirmed broken. They require further investigation.",
  },
};

export function ResearchExplainer() {
  const [mode, setMode] = useState<Mode>("DECLARED");

  return (
    <div className="research-explainer">
      <div className="research-explainer-bar" role="tablist" aria-label="Compare intent with observation">
        {modes.map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={mode === item.key}
            className={mode === item.key ? "is-active" : ""}
            onClick={() => setMode(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="research-explainer-body">
        <ProductPlaceholder
          label="Declared vs. demonstrated checkout journey — illustrative behavior graph"
          dimensions="1520 × 1000"
          displayDimensions="760 × 500"
          className="research-explainer-diagram"
        />
        <div className="research-explainer-panel" aria-live="polite">
          <span className="research-explainer-kicker">{copy[mode].kicker}</span>
          <p>{copy[mode].body}</p>
          <ul className="research-explainer-legend">
            {states.map((state) => {
              const resolvedStatus: StateStatus =
                mode === "DECLARED" ? "observed" : state.status;
              return (
                <li key={state.key} className={resolvedStatus === "not-observed" ? "is-open" : ""}>
                  <i aria-hidden="true">
                    {mode === "DECLARED" ? "·" : resolvedStatus === "not-observed" ? "?" : "✓"}
                  </i>
                  <b>{state.label}</b>
                  <small>
                    {mode === "DECLARED"
                      ? "Declared"
                      : resolvedStatus === "not-observed"
                        ? "Requires investigation"
                        : "Observed"}
                  </small>
                </li>
              );
            })}
          </ul>
          <small className="research-explainer-note">
            Illustrative example data — not a real customer demonstration.
          </small>
        </div>
      </div>
    </div>
  );
}
