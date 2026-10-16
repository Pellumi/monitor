"use client";

import { useState } from "react";
import { ProductPlaceholder } from "@/components/product-tour";

type Branch = "SUCCESS" | "FAILURE";

const branches: { key: Branch; label: string }[] = [
  { key: "SUCCESS", label: "Success path" },
  { key: "FAILURE", label: "Failure path" },
];

const declaredSteps = ["Product selected", "Add to cart", "Checkout", "Payment submitted"];

const branchSteps: Record<Branch, [string, string]> = {
  SUCCESS: ["Order confirmed", "Expected successful outcome"],
  FAILURE: ["Display error, then retry", "Declared recovery path"],
};

export function JourneyBranchToggle() {
  const [branch, setBranch] = useState<Branch>("SUCCESS");

  return (
    <div className="dev-findings">
      <div
        className="dev-findings-bar"
        role="tablist"
        aria-label="Declared checkout journey branch"
      >
        {branches.map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={branch === item.key}
            className={branch === item.key ? "is-active" : ""}
            onClick={() => setBranch(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="dev-findings-body">
        <ProductPlaceholder
          label="Declared checkout journey — interactive flow editor / React design"
          dimensions="1600 × 1000"
          displayDimensions="700 × 520"
        />
        <div className="dev-findings-panel" aria-live="polite">
          <ul className="dev-findings-list">
            {declaredSteps.map((step) => (
              <li key={step}>
                <i aria-hidden="true">·</i>
                <b>{step}</b>
              </li>
            ))}
          </ul>
          <ul className="dev-findings-list" key={branch}>
            <li>
              <i aria-hidden="true">→</i>
              <b>{branchSteps[branch][0]}</b>
              <small>{branchSteps[branch][1]}</small>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
