"use client";

import { useState } from "react";
import { ProductPlaceholder } from "@/components/product-tour";

type Role = "PM" | "PO" | "ANALYST" | "FOUNDER";

const roles: {
  key: Role;
  label: string;
  title: string;
  copy: string;
  items: string[];
}[] = [
  {
    key: "PM",
    label: "PM",
    title: "For product managers",
    copy: "Keep intended user journeys visible throughout implementation and validation.",
    items: [
      "Declare the experience the product should support",
      "Review demonstrated behavior against intended flows",
      "Use evidence when discussing outstanding product work",
    ],
  },
  {
    key: "PO",
    label: "PO",
    title: "For product owners",
    copy: "Confirm acceptance expectations are reflected in demonstrated behavior.",
    items: [
      "Define acceptance expectations as intended states and paths",
      "Review supporting evidence before a feature sign-off",
      "Identify gaps that still need further validation",
    ],
  },
  {
    key: "ANALYST",
    label: "Analyst",
    title: "For business analysts",
    copy: "Check whether every relevant path and exception was considered.",
    items: [
      "Review branches, exceptions and validation states",
      "Compare declared and observed scenarios",
      "Flag undeclared behavior for product review",
    ],
  },
  {
    key: "FOUNDER",
    label: "Founder",
    title: "For product-focused founders",
    copy: "Validate that the MVP behaves the way it was planned.",
    items: [
      "Declare the few critical journeys that matter most",
      "Ask the team to demonstrate them with Tellann Desktop",
      "Use evidence to decide what needs attention next",
    ],
  },
];

export function ProductRoleSelector() {
  const [active, setActive] = useState<Role>("PM");
  const role = roles.find((item) => item.key === active) ?? roles[0];

  return (
    <div className="dev-findings">
      <div className="dev-findings-bar" role="tablist" aria-label="Product role">
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
      <div className="dev-findings-body">
        <ProductPlaceholder
          label={`${role.title} — illustrative role view / interactive design`}
          dimensions="1100 × 450"
        />
        <div className="dev-findings-panel pt-role-panel" aria-live="polite" key={role.key}>
          <h3>{role.title}</h3>
          <p>{role.copy}</p>
          <ul>
            {role.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
