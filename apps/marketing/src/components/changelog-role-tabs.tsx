"use client";

import { useState } from "react";

type RoleKey = "DEVELOPER" | "QA" | "MANAGER" | "PRODUCT" | "FOUNDER";

const roles: {
  key: RoleKey;
  label: string;
  eyebrow: string;
  question: string;
  copy: string;
  watch: string[];
}[] = [
  {
    key: "DEVELOPER",
    label: "Developers",
    eyebrow: "For developers",
    question: "What changed in the SDK, desktop agent, or workflow?",
    copy: "Releases that affect how you integrate, instrument, and debug with Tellann.",
    watch: ["Integrations and compatibility", "SDK and instrumentation changes", "Bug fixes that affect local setup"],
  },
  {
    key: "QA",
    label: "QA engineers",
    eyebrow: "For QA engineers",
    question: "What makes validation more useful?",
    copy: "Releases that change coverage, demonstrations, reconciliation, or reporting.",
    watch: ["Coverage and gap reporting", "Session replay and evidence", "Reconciliation improvements"],
  },
  {
    key: "MANAGER",
    label: "Engineering managers",
    eyebrow: "For engineering managers",
    question: "Will this affect workflows or deployments?",
    copy: "Releases with implications for reliability, control, or release decisions.",
    watch: ["Reliability and availability", "Release-readiness evidence", "Team and workspace changes"],
  },
  {
    key: "PRODUCT",
    label: "Product teams",
    eyebrow: "For product teams",
    question: "What new product capabilities are available?",
    copy: "Releases that change collaboration, visibility, or how workflows are understood.",
    watch: ["Workflow and behavior visibility", "Collaboration changes", "Usability improvements"],
  },
  {
    key: "FOUNDER",
    label: "Founders",
    eyebrow: "For startup founders",
    question: "Will it save work or make the product easier to use?",
    copy: "Releases that lower the effort required to get useful QA visibility.",
    watch: ["Setup and time to value", "Accessible features", "Pricing and plan changes"],
  },
];

export function ChangelogRoleTabs() {
  const [active, setActive] = useState<RoleKey>("DEVELOPER");
  const role = roles.find((item) => item.key === active) ?? roles[0];

  return (
    <div className="changelog-role-tabs">
      <div className="changelog-role-bar" role="tablist" aria-label="Updates by role">
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
      <div className="changelog-role-panel" aria-live="polite" key={role.key}>
        <span className="changelog-role-eyebrow">{role.eyebrow}</span>
        <h3>{role.question}</h3>
        <p>{role.copy}</p>
        <span className="changelog-role-sub">What to watch for</span>
        <ul>
          {role.watch.map((item) => (
            <li key={item}>
              <i aria-hidden="true">·</i>
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
