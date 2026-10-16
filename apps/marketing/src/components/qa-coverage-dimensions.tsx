"use client";

import { useState } from "react";
import { ProductPlaceholder } from "@/components/product-tour";

type Dimension = "WORKFLOWS" | "STATES" | "TRANSITIONS";

const dimensions: {
  key: Dimension;
  label: string;
  percentage: string;
  items: [string, string, string][];
}[] = [
  {
    key: "WORKFLOWS",
    label: "Workflows",
    percentage: "76%",
    items: [
      ["Checkout success", "Observed", "✓"],
      ["Order confirmation", "Observed", "✓"],
      ["Payment failure", "Not observed", "○"],
      ["Retry payment", "Not observed", "○"],
    ],
  },
  {
    key: "STATES",
    label: "States",
    percentage: "82%",
    items: [
      ["Loading", "Observed", "✓"],
      ["Payment failed", "Observed", "✓"],
      ["Empty cart", "Not observed", "○"],
      ["Session timeout", "Potential missing state", "?"],
    ],
  },
  {
    key: "TRANSITIONS",
    label: "Transitions",
    percentage: "68%",
    items: [
      ["Cart → Checkout", "Observed", "✓"],
      ["Checkout → Payment failed", "Observed", "✓"],
      ["Payment failed → Retry", "Not observed", "○"],
    ],
  },
];

export function QACoverageDimensions() {
  const [active, setActive] = useState<Dimension>("WORKFLOWS");
  const dimension = dimensions.find((item) => item.key === active) ?? dimensions[0];

  return (
    <div className="dev-findings">
      <div className="dev-findings-bar" role="tablist" aria-label="Coverage dimension">
        {dimensions.map((item) => (
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
          label="Workflow coverage dashboard — illustrative data / interactive HTML design"
          dimensions="1600 × 1000"
          displayDimensions="680 × 520"
        />
        <div className="dev-findings-panel" aria-live="polite">
          <div className="qa-coverage-stat">
            <b>{dimension.percentage}</b>
            <small>{dimension.label} coverage · Illustrative data</small>
          </div>
          <ul className="dev-findings-list" key={dimension.key}>
            {dimension.items.map(([step, status, glyph]) => (
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
