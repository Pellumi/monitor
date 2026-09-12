"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { ProductPlaceholder } from "@/components/product-tour";

type AudienceId = "DEVELOPER" | "QA" | "MANAGER" | "PRODUCT";

type Audience = {
  id: AudienceId;
  tab: string;
  headline: string;
  core: string;
  benefits: string[];
  panelLabel: string;
  panel: [string, string][];
  visual: { label: string; master: string; display: string };
  relatedHref: string;
  relatedLabel: string;
};

const audiences: Audience[] = [
  {
    id: "DEVELOPER",
    tab: "Developer",
    headline: "Spend less time wiring instrumentation by hand.",
    core: "You still review the code. You stop doing the repetitive part.",
    benefits: [
      "Tellann finds the likely checkpoint locations.",
      "Proposed changes arrive already organized as a plan.",
      "Diffs can be reviewed before anything is applied.",
      "The agent applies the patch instead of leaving you the edits.",
      "Validation catches breakage attributable to the plan.",
      "Rollback stays available afterwards.",
    ],
    panelLabel: "What you still own",
    panel: [
      ["Review the diff", "Yours"],
      ["Approve the plan", "Yours"],
      ["Locate checkpoints", "Tellann"],
      ["Apply and validate", "Tellann"],
    ],
    visual: {
      label: "Developer reviewing a proposed patch set / product UI design",
      master: "1400 × 850",
      display: "800 × 486",
    },
    relatedHref: "/desktop",
    relatedLabel: "Bind a workspace with Tellann Desktop",
  },
  {
    id: "QA",
    tab: "QA engineer",
    headline: "Get observable workflows without becoming the instrumentation coordinator.",
    core: "Spend QA time validating behavior, not chasing instrumentation setup.",
    benefits: [
      "Focus on what needs validation, not where SDK calls belong.",
      "Turn declared flows into observable checkpoints.",
      "Confirm what was instrumented before the demonstration starts.",
      "Review validation outcomes for each applied plan.",
      "Inspect the instrumentation report when the run finishes.",
    ],
    panelLabel: "Before the demonstration",
    panel: [
      ["Declared flow", "CHECKOUT"],
      ["Checkpoints applied", "6"],
      ["Validation", "Passed"],
      ["Ready to demonstrate", "Yes"],
    ],
    visual: {
      label: "Instrumentation state before a QA demonstration / product UI design",
      master: "1400 × 850",
      display: "800 × 486",
    },
    relatedHref: "/product/flow-declaration",
    relatedLabel: "Declare expected application workflows",
  },
  {
    id: "MANAGER",
    tab: "Engineering manager",
    headline: "Automation with an audit trail.",
    core: "Increase developer speed without turning the working tree into a black box.",
    benefits: [
      "Human approval is still required for every plan.",
      "The workspace and the approving user are both attributable.",
      "Branch policy constrains where changes are allowed to land.",
      "Applied plans keep a recorded rollback.",
      "Validation and rollback outcomes are recorded.",
    ],
    panelLabel: "Recorded for every plan",
    panel: [
      ["Proposed", "IN-4418"],
      ["Approved by", "A named member"],
      ["Applied to", "qa/tellann-instrumentation"],
      ["Outcome", "Validated · rollback available"],
    ],
    visual: {
      label: "Instrumentation audit history / product UI design",
      master: "1400 × 850",
      display: "800 × 486",
    },
    relatedHref: "/security",
    relatedLabel: "Review how Tellann protects product data",
  },
  {
    id: "PRODUCT",
    tab: "Product manager",
    headline: "Get from intended workflow to observable workflow faster.",
    core: "Less time preparing the observation layer. More time understanding whether the product behaves as intended.",
    benefits: [
      "Declared flows become demonstrable sooner.",
      "Product intent connects to real application evidence.",
      "Less setup friction before a QA demonstration.",
      "More reliable coverage and reconciliation evidence.",
    ],
    panelLabel: "From intent to evidence",
    panel: [
      ["Declare the flow", "Product + QA"],
      ["Instrument it", "Tellann, after approval"],
      ["Demonstrate it", "QA"],
      ["Reconcile it", "Tellann"],
    ],
    visual: {
      label: "Declared flow becoming an observable flow / product UI design",
      master: "1400 × 850",
      display: "800 × 486",
    },
    relatedHref: "/product/reconciliation",
    relatedLabel: "Compare intended behavior with observed behavior",
  },
];

export function InstrumentationAudiences() {
  const [activeId, setActiveId] = useState<AudienceId>("DEVELOPER");
  const selectId = useId();
  const active = audiences.find((item) => item.id === activeId)!;

  return (
    <div className="instr-persona">
      <div
        className="instr-persona-tabs"
        role="tablist"
        aria-label="Automated instrumentation benefits by role"
      >
        {audiences.map((audience) => (
          <button
            key={audience.id}
            type="button"
            role="tab"
            id={`instr-tab-${audience.id}`}
            aria-selected={activeId === audience.id}
            aria-controls="instr-persona-panel"
            className={activeId === audience.id ? "is-active" : ""}
            onClick={() => setActiveId(audience.id)}
          >
            {audience.tab}
          </button>
        ))}
      </div>

      <div className="instr-persona-select">
        <label htmlFor={selectId}>Who are you?</label>
        <select
          id={selectId}
          value={activeId}
          onChange={(event) => setActiveId(event.target.value as AudienceId)}
        >
          {audiences.map((audience) => (
            <option key={audience.id} value={audience.id}>
              {audience.tab}
            </option>
          ))}
        </select>
      </div>

      <div
        className="instr-persona-body"
        id="instr-persona-panel"
        role="tabpanel"
        aria-labelledby={`instr-tab-${active.id}`}
        key={active.id}
      >
        <div className="instr-persona-copy">
          <h3>{active.headline}</h3>
          <ul className="instr-benefit-list">
            {active.benefits.map((benefit) => (
              <li key={benefit}>{benefit}</li>
            ))}
          </ul>
          <p className="instr-persona-core">{active.core}</p>
          <Link href={active.relatedHref} className="instr-inline-link">
            {active.relatedLabel} <span>→</span>
          </Link>
        </div>

        <div className="instr-persona-visual">
          <ProductPlaceholder
            label={active.visual.label}
            dimensions={active.visual.master}
            displayDimensions={active.visual.display}
          />
          <div className="instr-persona-panel-detail">
            <p className="instr-panel-label">{active.panelLabel}</p>
            <dl>
              {active.panel.map(([term, value]) => (
                <div key={term}>
                  <dt>{term}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}
