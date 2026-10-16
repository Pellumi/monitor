"use client";

import { useState } from "react";
import { ProductPlaceholder } from "@/components/product-tour";

type Mode = "COMPARE" | "FINDINGS";

const modes: { key: Mode; label: string }[] = [
  { key: "COMPARE", label: "Compare" },
  { key: "FINDINGS", label: "Findings" },
];

const intended = ["Cart", "Checkout", "Payment success", "Payment failure", "Retry"];

const demonstrated: [string, string][] = [
  ["Cart", "✓"],
  ["Checkout", "✓"],
  ["Payment success", "✓"],
  ["Payment failure", "✓"],
  ["Retry not observed", "?"],
];

const findings: [string, string, string][] = [
  ["Cart", "Confirmed", ""],
  ["Checkout", "Confirmed", ""],
  ["Payment success", "Confirmed", ""],
  ["Payment failure", "Confirmed", ""],
  ["Retry", "True gap", "is-not-observed"],
];

export function ReconciliationViewToggle() {
  const [mode, setMode] = useState<Mode>("COMPARE");

  return (
    <div className="dev-findings">
      <div
        className="dev-findings-bar"
        role="tablist"
        aria-label="Checkout journey reconciliation view"
      >
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
      {mode === "COMPARE" ? (
        <div className="dev-compare" aria-live="polite">
          <article>
            <span>Intended</span>
            <ul>
              {intended.map((item) => (
                <li key={item}>
                  <i aria-hidden="true">·</i>
                  {item}
                </li>
              ))}
            </ul>
          </article>
          <b aria-hidden="true">vs</b>
          <article>
            <span>Demonstrated</span>
            <ul>
              {demonstrated.map(([item, glyph]) => (
                <li key={item} className={glyph === "?" ? "is-open" : ""}>
                  <i aria-hidden="true">{glyph}</i>
                  {item}
                </li>
              ))}
            </ul>
          </article>
        </div>
      ) : (
        <div className="dev-findings-body" aria-live="polite">
          <ProductPlaceholder
            label="Checkout journey reconciliation — example findings / interactive design"
            dimensions="1600 × 1000"
            displayDimensions="720 × 540"
          />
          <ul className="dev-findings-list dev-findings-panel">
            {findings.map(([step, status, tone]) => (
              <li key={step} className={tone}>
                <i aria-hidden="true">{tone === "is-not-observed" ? "?" : "✓"}</i>
                <b>{step}</b>
                <small>{status}</small>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
