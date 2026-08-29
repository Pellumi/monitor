"use client";

import { useState } from "react";

const views = [
  {
    key: "demonstrate",
    label: "Demonstrate",
    title: "Teach Tellann by using your application.",
    copy: "Walk through real workflows while Tellann captures the behavioral evidence needed to reconstruct the session.",
    asset: "Developer Demonstration UI / video placeholder",
    dimensions: "1600 × 1000",
  },
  {
    key: "model",
    label: "Model",
    title: "Turn events into a behavioral model.",
    copy: "Observed states, actions, transitions, and workflows become a connected Behavior Graph.",
    asset: "Behavior Graph / animated SVG placeholder",
    dimensions: "1800 × 1100",
  },
  {
    key: "analyze",
    label: "Analyze",
    title: "See what was covered, and what was not.",
    copy: "Measure workflow, state, transition, endpoint, and error coverage against demonstrated behavior.",
    asset: "Coverage dashboard / UI placeholder",
    dimensions: "1600 × 1000",
  },
  {
    key: "investigate",
    label: "Investigate",
    title: "Follow findings back to their evidence.",
    copy: "Replay the session timeline and inspect the frontend and endpoint activity behind a quality gap.",
    asset: "Session Replay / video placeholder",
    dimensions: "1920 × 1200",
  },
  {
    key: "report",
    label: "Report",
    title: "Give teams evidence they can act on.",
    copy: "Package graphs, coverage, gaps, sessions, and endpoint findings into focused QA reports.",
    asset: "QA report / portrait image placeholder",
    dimensions: "1000 × 1280",
  },
] as const;

export function ProductTour() {
  const [active, setActive] = useState(0);
  const view = views[active];

  return (
    <div className="product-tour">
      <div
        className="product-tour-tabs"
        role="tablist"
        aria-label="Product overview views"
      >
        {views.map((item, index) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={active === index}
            aria-controls="product-tour-panel"
            id={`product-tab-${item.key}`}
            onClick={() => setActive(index)}
          >
            <span>{String(index + 1).padStart(2, "0")}</span>
            {item.label}
          </button>
        ))}
      </div>
      <div
        className="product-tour-panel"
        id="product-tour-panel"
        role="tabpanel"
        aria-labelledby={`product-tab-${view.key}`}
      >
        <div>
          <p className="product-kicker">{view.label}</p>
          <h3>{view.title}</h3>
          <p>{view.copy}</p>
        </div>
        <ProductPlaceholder label={view.asset} dimensions={view.dimensions} />
      </div>
    </div>
  );
}

export function ProductPlaceholder({
  label,
  dimensions,
  className = "",
}: {
  label: string;
  dimensions: string;
  className?: string;
}) {
  const ratio = dimensions.replaceAll(" ", "").split("×").map(Number);
  return (
    <div
      className={`product-placeholder ${className}`}
      style={{ aspectRatio: `${ratio[0]} / ${ratio[1]}` }}
      role="img"
      aria-label={`${label}, ${dimensions} pixels`}
    >
      <span>Visual placeholder</span>
      <b>{label}</b>
      <small>{dimensions} px</small>
    </div>
  );
}
