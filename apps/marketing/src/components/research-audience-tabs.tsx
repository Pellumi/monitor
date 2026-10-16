"use client";

import { useState } from "react";

type RoleKey = "DEVELOPER" | "QA" | "MANAGER" | "PRODUCT" | "FOUNDER";

const roles: {
  key: RoleKey;
  label: string;
  eyebrow: string;
  question: string;
  copy: string;
  directions: string[];
}[] = [
  {
    key: "DEVELOPER",
    label: "Developers",
    eyebrow: "Research perspective · Developers",
    question: "How can I understand what a workflow actually executed?",
    copy: "Explore state modeling, execution traces, graph construction, and the limits of different kinds of technical evidence.",
    directions: [
      "Behavior modeling methods",
      "State identification reliability",
      "Endpoint and workflow correlation",
    ],
  },
  {
    key: "QA",
    label: "QA Engineers",
    eyebrow: "Research perspective · QA Engineers",
    question: "What have we not demonstrated yet, and how do I prioritize it?",
    copy: "Investigate coverage definitions, missing-path classification, and how to distinguish an unobserved state from a confirmed defect.",
    directions: [
      "Workflow coverage interpretation",
      "Missing-state and missing-flow classification",
      "Evidence reproducibility",
    ],
  },
  {
    key: "MANAGER",
    label: "Engineering Managers",
    eyebrow: "Research perspective · Engineering Managers",
    question: "What does a coverage number in a release report actually mean?",
    copy: "Understand denominator definitions, evidence scope, and how to interpret aggregate quality metrics without overstating them.",
    directions: [
      "Quality and decision-making frameworks",
      "Evidence scope and reporting limits",
      "Release-readiness interpretation",
    ],
  },
  {
    key: "PRODUCT",
    label: "Product Managers",
    eyebrow: "Research perspective · Product Managers",
    question: "Does the implemented behavior reflect what we specified?",
    copy: "See how declared intent can be compared with demonstrated execution, and what that comparison can and cannot establish.",
    directions: [
      "Intent and observation methods",
      "Requirements-to-behavior comparison",
      "Communicating reconciliation uncertainty",
    ],
  },
  {
    key: "FOUNDER",
    label: "Startup Founders",
    eyebrow: "Research perspective · Startup Founders",
    question: "How much testing evidence is enough before shipping?",
    copy: "Weigh practical testing tradeoffs, reliability, and cost without assuming a large, dedicated QA operation.",
    directions: [
      "Quality and decision-making frameworks",
      "Privacy-aware instrumentation",
      "Workflow coverage interpretation",
    ],
  },
];

export function ResearchAudienceTabs() {
  const [active, setActive] = useState<RoleKey>("DEVELOPER");
  const role = roles.find((item) => item.key === active) ?? roles[0];

  return (
    <div className="research-audience-tabs">
      <div className="research-audience-bar" role="tablist" aria-label="Research perspective">
        {roles.map((item) => (
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
      <div className="research-audience-panel" aria-live="polite" key={role.key}>
        <span className="research-audience-eyebrow">{role.eyebrow}</span>
        <h3>{role.question}</h3>
        <p>{role.copy}</p>
        <span className="research-audience-sub">Relevant research directions</span>
        <ul>
          {role.directions.map((direction) => (
            <li key={direction}>
              <i aria-hidden="true">·</i>
              {direction}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
