"use client";

import { useState } from "react";
import { ProductPlaceholder } from "@/components/product-tour";

type Journey = "ONBOARDING" | "CHECKOUT";

const journeys: {
  key: Journey;
  label: string;
  fraction: string;
  items: [string, string, string][];
}[] = [
  {
    key: "ONBOARDING",
    label: "Onboarding",
    fraction: "4 / 5",
    items: [
      ["Sign-up", "Observed", "✓"],
      ["Email verification", "Observed", "✓"],
      ["Profile setup", "Observed", "✓"],
      ["Welcome experience", "Observed", "✓"],
      ["Recovery path", "Not observed", "○"],
    ],
  },
  {
    key: "CHECKOUT",
    label: "Checkout",
    fraction: "3 / 4",
    items: [
      ["Cart reviewed", "Observed", "✓"],
      ["Payment submitted", "Observed", "✓"],
      ["Order confirmed", "Observed", "✓"],
      ["Retry after failure", "Not observed", "○"],
    ],
  },
];

export function ProductJourneyCoverage() {
  const [active, setActive] = useState<Journey>("ONBOARDING");
  const journey = journeys.find((item) => item.key === active) ?? journeys[0];

  return (
    <div className="dev-findings">
      <div className="dev-findings-bar" role="tablist" aria-label="Product journey">
        {journeys.map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={active === item.key}
            className={active === item.key ? "is-active" : ""}
            onClick={() => setActive(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="dev-findings-body">
        <ProductPlaceholder
          label="Product journey coverage — illustrative data / interactive HTML design"
          dimensions="1600 × 960"
          displayDimensions="700 × 520"
        />
        <div className="dev-findings-panel" aria-live="polite">
          <div className="pt-coverage-stat">
            <b>{journey.fraction}</b>
            <small>{journey.label} states demonstrated · Illustrative data</small>
          </div>
          <ul className="dev-findings-list" key={journey.key}>
            {journey.items.map(([step, status, glyph]) => (
              <li key={step} className={`is-${status.toLowerCase().replaceAll(" ", "-")}`}>
                <i aria-hidden="true">{glyph}</i>
                <b>{step}</b>
                <small>{status}</small>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
