"use client";

import { useState } from "react";
import { ProductPlaceholder } from "@/components/product-tour";

type Mode = "EXPECTED" | "OBSERVED" | "RECONCILED";

const modes: { key: Mode; label: string; copy: string }[] = [
  {
    key: "EXPECTED",
    label: "Expected",
    copy: "The Checkout workflow your team declared, including the branches that only happen when something goes wrong.",
  },
  {
    key: "OBSERVED",
    label: "Observed",
    copy: "What the demonstration actually produced — plus one thing nobody had declared.",
  },
  {
    key: "RECONCILED",
    label: "Reconciled",
    copy: "One answer for every expected and observed behavior in the workflow.",
  },
];

const expected = [
  "Product",
  "Cart",
  "Checkout",
  "Payment",
  "Success",
  "Payment failure",
  "Retry",
];

const observed = [
  "Product",
  "Cart",
  "Checkout",
  "Payment",
  "Success",
  "Promo rejected",
];

const reconciled: [string, string, string][] = [
  ["Product", "Confirmed", "✓"],
  ["Cart", "Confirmed", "✓"],
  ["Checkout", "Confirmed", "✓"],
  ["Payment", "Confirmed", "✓"],
  ["Success", "Confirmed", "✓"],
  ["Payment failure", "True gap", "○"],
  ["Retry", "True gap", "○"],
  ["Promo rejected", "Undeclared", "+"],
];

export function CheckoutExampleToggle() {
  const [mode, setMode] = useState<Mode>("EXPECTED");
  const active = modes.find((item) => item.key === mode)!;

  return (
    <div className="recon-example">
      <div className="recon-example-bar" role="tablist" aria-label="Checkout example view">
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

      <div className="recon-example-body">
        <ProductPlaceholder
          label={`Checkout ${active.label.toLowerCase()} workflow / animated SVG design`}
          dimensions="1800 × 1000"
          displayDimensions="1100 × 611"
        />
        <div className="recon-example-panel" aria-live="polite">
          <p className="recon-panel-label">{active.label}</p>
          <p className="recon-panel-copy">{active.copy}</p>
          <ul className="recon-outcome-list" key={mode}>
            {mode === "RECONCILED"
              ? reconciled.map(([name, status, glyph]) => (
                  <li
                    key={name}
                    className={`is-${status.toLowerCase().replace(" ", "-")}`}
                  >
                    <i aria-hidden="true">{glyph}</i>
                    <b>{name}</b>
                    <small>{status}</small>
                  </li>
                ))
              : (mode === "EXPECTED" ? expected : observed).map((name) => (
                  <li key={name}>
                    <i aria-hidden="true">·</i>
                    <b>{name}</b>
                  </li>
                ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
