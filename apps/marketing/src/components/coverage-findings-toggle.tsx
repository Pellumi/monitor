"use client";

import { useState } from "react";
import { ProductPlaceholder } from "@/components/product-tour";

type Mode = "WALKTHROUGH" | "FINDINGS";

const modes: { key: Mode; label: string }[] = [
  { key: "WALKTHROUGH", label: "Basic walkthrough" },
  { key: "FINDINGS", label: "Tellann findings" },
];

const walkthrough = ["Cart", "Checkout", "Success"];

const findings: [string, string, string][] = [
  ["Cart", "Observed", "✓"],
  ["Checkout", "Observed", "✓"],
  ["Success", "Observed", "✓"],
  ["Payment failure", "Not observed", "○"],
  ["Retry payment", "Not observed", "○"],
  ["Session timeout", "Potential missing state", "?"],
];

const findingNotes: Record<string, string> = {
  "Payment failure": "Expected failure state not observed",
  "Retry payment": "Recovery path not demonstrated",
  "Session timeout": "Session-expiry behavior not exercised",
};

export function CoverageFindingsToggle() {
  const [mode, setMode] = useState<Mode>("WALKTHROUGH");

  return (
    <div className="dev-findings">
      <div
        className="dev-findings-bar"
        role="tablist"
        aria-label="Checkout workflow view"
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
      <div className="dev-findings-body">
        <ProductPlaceholder
          label="Checkout workflow coverage / interactive HTML/CSS/SVG design"
          dimensions="1440 × 900"
          displayDimensions="700 × 500"
        />
        <div className="dev-findings-panel" aria-live="polite">
          {mode === "WALKTHROUGH" ? (
            <ul className="dev-findings-list" key={mode}>
              {walkthrough.map((step) => (
                <li key={step}>
                  <i aria-hidden="true">·</i>
                  <b>{step}</b>
                </li>
              ))}
            </ul>
          ) : (
            <ul className="dev-findings-list" key={mode}>
              {findings.map(([step, status, glyph]) => (
                <li
                  key={step}
                  className={`is-${status.toLowerCase().replaceAll(" ", "-")}`}
                >
                  <i aria-hidden="true">{glyph}</i>
                  <b>{step}</b>
                  <small>
                    {status}
                    {findingNotes[step] ? ` — ${findingNotes[step]}` : ""}
                  </small>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
