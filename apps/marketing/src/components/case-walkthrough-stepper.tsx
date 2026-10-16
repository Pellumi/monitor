"use client";

import { useState } from "react";
import { ProductPlaceholder } from "@/components/product-tour";

type Stage = {
  key: string;
  label: string;
  title: string;
  explanation: string;
  visualLabel: string;
};

const stages: Stage[] = [
  {
    key: "declare",
    label: "Declare",
    title: "Define the expected journey",
    explanation:
      "The team declares four important checkout states — Cart, Checkout, Payment, Confirm. These represent expected behavior, not recorded execution.",
    visualLabel: "Declared checkout journey — Cart, Checkout, Payment, Confirm",
  },
  {
    key: "demonstrate",
    label: "Demonstrate",
    title: "Show the journey in a managed browser",
    explanation:
      "Tellann Desktop opens a guided run. Someone walks through the workflow once, and Tellann captures what actually happened along the way.",
    visualLabel: "Guided demonstration run — managed browser capturing the checkout walkthrough",
  },
  {
    key: "reconcile",
    label: "Reconcile",
    title: "Compare declared intent with observed behavior",
    explanation:
      "Declared states are checked against the captured evidence. Cart, Checkout and Payment are confirmed. Confirm was not observed in this run.",
    visualLabel: "Reconciliation — declared states against observed evidence",
  },
  {
    key: "review",
    label: "Review",
    title: "Read the resulting QA report excerpt",
    explanation:
      "The gap becomes a reviewable finding: 3 of 4 declared states confirmed, 1 not observed — a question for the team, not yet a confirmed defect.",
    visualLabel: "QA report excerpt — 3 of 4 declared states confirmed",
  },
];

export function CaseWalkthroughStepper() {
  const [index, setIndex] = useState(0);
  const stage = stages[index];

  return (
    <div className="cs-walkthrough">
      <div className="cs-step-bar" role="tablist" aria-label="Case walkthrough step">
        {stages.map((item, itemIndex) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={index === itemIndex}
            className={index === itemIndex ? "is-active" : ""}
            onClick={() => setIndex(itemIndex)}
          >
            <span>{String(itemIndex + 1).padStart(2, "0")}</span>
            {item.label}
          </button>
        ))}
      </div>

      <div className="cs-step-body" aria-live="polite">
        <ProductPlaceholder
          label={stage.visualLabel}
          dimensions="1600 × 900"
          displayDimensions="760 × 428"
        />
        <div className="cs-step-panel">
          <p className="cs-step-kicker">
            Step {index + 1} of {stages.length}
          </p>
          <h3>{stage.title}</h3>
          <p>{stage.explanation}</p>
        </div>
      </div>

      <div className="cs-step-nav">
        <button
          type="button"
          onClick={() => setIndex((current) => Math.max(0, current - 1))}
          disabled={index === 0}
        >
          ← Previous
        </button>
        <button
          type="button"
          onClick={() => setIndex((current) => Math.min(stages.length - 1, current + 1))}
          disabled={index === stages.length - 1}
        >
          Next step →
        </button>
      </div>
    </div>
  );
}
