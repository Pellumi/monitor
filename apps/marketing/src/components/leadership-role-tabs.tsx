"use client";

import { useState } from "react";

type RoleKey = "CTO" | "MANAGER" | "VP";

const roles: {
  key: RoleKey;
  label: string;
  heading: string;
  copy: string;
  points: string[];
}[] = [
  {
    key: "CTO",
    label: "CTO",
    heading: "For CTOs and founders",
    copy: "Build a more structured understanding of product-quality evidence without requiring a large, dedicated testing operation.",
    points: [
      "Identify important workflows without supporting evidence",
      "Encourage consistent validation practices",
      "Understand outstanding quality questions before release",
    ],
  },
  {
    key: "MANAGER",
    label: "Eng. Manager",
    heading: "For engineering managers and tech leads",
    copy: "Move feature acceptance and release reviews away from scattered dashboards and toward one evidence-backed report.",
    points: [
      "See whether critical features have adequate evidence before sign-off",
      "Use coverage and outstanding findings to direct the next test cycle",
      "Bring developers and QA into one report instead of three",
    ],
  },
  {
    key: "VP",
    label: "VP / Head",
    heading: "For VPs and heads of engineering",
    copy: "Give multiple teams a consistent reporting framework, scoped to the applications and roles your organization actually entitles.",
    points: [
      "Compare validation practices consistently across teams",
      "Get application-scoped visibility without reading raw telemetry",
      "Support governance and reporting standards across the org",
    ],
  },
];

export function LeadershipRoleTabs() {
  const [active, setActive] = useState<RoleKey>("CTO");
  const role = roles.find((item) => item.key === active) ?? roles[0];

  return (
    <div className="el-role-tabs">
      <div className="el-role-tabs-bar" role="tablist" aria-label="Leadership role">
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
      <div className="el-role-panel" aria-live="polite" key={role.key}>
        <h3>{role.heading}</h3>
        <p>{role.copy}</p>
        <ul>
          {role.points.map((point) => (
            <li key={point}>
              <i aria-hidden="true">·</i>
              {point}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
