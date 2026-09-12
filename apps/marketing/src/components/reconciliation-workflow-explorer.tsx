"use client";

import { useState } from "react";
import { ProductPlaceholder } from "@/components/product-tour";

type Outcome = "CONFIRMED" | "TRUE_GAP" | "UNDECLARED";

type Finding = {
  id: string;
  name: string;
  outcome: Outcome;
  /** Plain-English explanation. Product terminology lives in `technical`. */
  plain: string;
  origin: string;
  technical: [string, string][];
};

const labels: Record<Outcome, string> = {
  CONFIRMED: "Confirmed",
  TRUE_GAP: "True gap",
  UNDECLARED: "Undeclared",
};

const glyphs: Record<Outcome, string> = {
  CONFIRMED: "✓",
  TRUE_GAP: "○",
  UNDECLARED: "+",
};

const confirmed = (name: string): Finding => ({
  id: name.toLowerCase().replace(/\s+/g, "-"),
  name,
  outcome: "CONFIRMED",
  plain:
    "Your team expected this behavior, and Tellann observed it during the selected demonstration.",
  origin: "Team authored",
  technical: [
    ["Classification", "CONFIRMED"],
    ["Declared", "Yes"],
    ["Observed", "Yes"],
    ["Declared origin", "USER_AUTHORED"],
    ["Declared in", "Checkout v3"],
    ["Evidence basis", "Guided run DEM-3817"],
  ],
});

const findings: Finding[] = [
  confirmed("Product view"),
  confirmed("Product detail"),
  confirmed("Cart active"),
  confirmed("Cart updated"),
  confirmed("Checkout"),
  confirmed("Shipping selected"),
  confirmed("Payment method selected"),
  confirmed("Payment pending"),
  confirmed("Payment success"),
  confirmed("Order confirmed"),
  confirmed("Order email sent"),
  {
    id: "payment-failure",
    name: "Payment failure",
    outcome: "TRUE_GAP",
    plain:
      "Your team declared this behavior. Tellann did not observe it during the selected demonstration.",
    origin: "Team authored",
    technical: [
      ["Classification", "TRUE_GAP"],
      ["Declared", "Yes"],
      ["Observed", "No"],
      ["Declared origin", "USER_AUTHORED"],
      ["Declared in", "Checkout v3"],
      ["Evidence basis", "Guided run DEM-3817"],
    ],
  },
  {
    id: "session-timeout",
    name: "Session timeout",
    outcome: "TRUE_GAP",
    plain:
      "Your team declared this behavior. The demonstration never reached it, so it still has no evidence behind it.",
    origin: "Accepted suggestion",
    technical: [
      ["Classification", "TRUE_GAP"],
      ["Declared", "Yes"],
      ["Observed", "No"],
      ["Declared origin", "SUGGESTED_ACCEPTED"],
      ["Declared in", "Checkout v3"],
      ["Evidence basis", "Guided run DEM-3817"],
    ],
  },
  {
    id: "retry-payment",
    name: "Retry payment",
    outcome: "TRUE_GAP",
    plain:
      "Recovery after a failed payment was expected. Because the failure never happened, the retry was never exercised either.",
    origin: "Team authored",
    technical: [
      ["Classification", "TRUE_GAP"],
      ["Declared", "Yes"],
      ["Observed", "No"],
      ["Declared origin", "USER_AUTHORED"],
      ["Declared in", "Checkout v3"],
      ["Evidence basis", "Guided run DEM-3817"],
    ],
  },
  {
    id: "promo-code-rejected",
    name: "Promo code rejected",
    outcome: "UNDECLARED",
    plain:
      "Tellann observed this during the run, but it was not part of the declared Checkout flow. Worth a review — not automatically wrong.",
    origin: "Observed only",
    technical: [
      ["Classification", "UNDECLARED"],
      ["Declared", "No"],
      ["Observed", "Yes"],
      ["Declared origin", "—"],
      ["Observed provenance", "TELEMETRY_OBSERVED"],
      ["Evidence basis", "Guided run DEM-3817"],
    ],
  },
  {
    id: "cart-merge",
    name: "Cart merge",
    outcome: "UNDECLARED",
    plain:
      "An anonymous cart was merged into the signed-in account. Nobody declared it, and it may simply be behavior nobody wrote down.",
    origin: "Observed only",
    technical: [
      ["Classification", "UNDECLARED"],
      ["Declared", "No"],
      ["Observed", "Yes"],
      ["Declared origin", "—"],
      ["Observed provenance", "TELEMETRY_OBSERVED"],
      ["Evidence basis", "Guided run DEM-3817"],
    ],
  },
];

const filters = [
  { key: "ALL", label: "All" },
  { key: "CONFIRMED", label: "Confirmed" },
  { key: "TRUE_GAP", label: "True gaps" },
  { key: "UNDECLARED", label: "Undeclared" },
] as const;

type Filter = (typeof filters)[number]["key"];

const countOf = (key: Filter) =>
  key === "ALL"
    ? findings.length
    : findings.filter((item) => item.outcome === key).length;

export function ReconciliationWorkflowExplorer() {
  const [filter, setFilter] = useState<Filter>("TRUE_GAP");
  const [selectedId, setSelectedId] = useState("payment-failure");
  const [view, setView] = useState<"graph" | "list">("graph");
  const [showTechnical, setShowTechnical] = useState(false);

  const visible = findings.filter(
    (item) => filter === "ALL" || item.outcome === filter,
  );

  // A filter can hide the selected row, so resolve the effective selection
  // during render rather than syncing it back through an effect.
  const selected =
    visible.find((item) => item.id === selectedId) ?? visible[0] ?? findings[0];

  return (
    <div className="recon-explorer">
      <header className="recon-explorer-header">
        <div className="recon-explorer-title">
          <p className="recon-panel-label">Workflow</p>
          <b>Checkout</b>
        </div>
        <div className="recon-explorer-summary">
          {(["CONFIRMED", "TRUE_GAP", "UNDECLARED"] as Outcome[]).map(
            (outcome) => (
              <span key={outcome}>
                <i aria-hidden="true">{glyphs[outcome]}</i>
                <b>{countOf(outcome)}</b>
                <small>{labels[outcome]}</small>
              </span>
            ),
          )}
        </div>
        <div className="recon-view-toggle">
          <button
            type="button"
            className={view === "graph" ? "is-active" : ""}
            aria-pressed={view === "graph"}
            onClick={() => setView("graph")}
          >
            Graph
          </button>
          <button
            type="button"
            className={view === "list" ? "is-active" : ""}
            aria-pressed={view === "list"}
            onClick={() => setView("list")}
          >
            List
          </button>
        </div>
      </header>

      <div className="recon-explorer-filters">
        <p className="recon-panel-label">Filter</p>
        <div className="recon-filter-rows">
          {filters.map((item) => (
            <button
              key={item.key}
              type="button"
              className={filter === item.key ? "is-active" : ""}
              aria-pressed={filter === item.key}
              onClick={() => setFilter(item.key)}
            >
              <b>{item.label}</b>
              <span>{countOf(item.key)}</span>
            </button>
          ))}
        </div>
        <div className="recon-finding-list">
          <p className="recon-finding-count" aria-live="polite">
            {visible.length} of {findings.length} behaviors
          </p>
          {visible.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`is-${item.outcome.toLowerCase()}${
                selected.id === item.id ? " is-current" : ""
              }`}
              aria-current={selected.id === item.id ? "true" : undefined}
              onClick={() => {
                setSelectedId(item.id);
                setShowTechnical(false);
              }}
            >
              <i aria-hidden="true">{glyphs[item.outcome]}</i>
              <b>{item.name}</b>
              <small>{labels[item.outcome]}</small>
            </button>
          ))}
        </div>
      </div>

      <div className="recon-explorer-canvas">
        {view === "graph" ? (
          <div className="recon-canvas-stage">
            <ProductPlaceholder
              label="Reconciled Checkout workflow / interactive graph design"
              dimensions="1840 × 1040"
              displayDimensions="920 × 520"
            />
          </div>
        ) : (
          <div className="recon-canvas-list">
            {(["CONFIRMED", "TRUE_GAP", "UNDECLARED"] as Outcome[]).map(
              (outcome) => (
                <div key={outcome}>
                  <p className="recon-panel-label">{labels[outcome]}</p>
                  <ul>
                    {findings
                      .filter((item) => item.outcome === outcome)
                      .map((item) => (
                        <li key={item.id}>
                          <i aria-hidden="true">{glyphs[outcome]}</i>
                          {item.name}
                        </li>
                      ))}
                  </ul>
                </div>
              ),
            )}
          </div>
        )}
      </div>

      <div className="recon-explorer-detail" aria-live="polite">
        <div className="recon-detail-identity">
          <span className={`recon-pill is-${selected.outcome.toLowerCase()}`}>
            <i aria-hidden="true">{glyphs[selected.outcome]}</i>
            {labels[selected.outcome]}
          </span>
          <b>{selected.name}</b>
        </div>
        <div className="recon-detail-copy">
          <p>{selected.plain}</p>
          <p className="recon-detail-origin">
            <small>Declared origin</small>
            <i>{selected.origin}</i>
          </p>
          {showTechnical ? (
            <dl className="recon-detail-technical">
              {selected.technical.map(([term, value]) => (
                <div key={term}>
                  <dt>{term}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>
        <div className="recon-detail-actions">
          <button type="button">View expected flow</button>
          <button type="button">View related session</button>
          <button
            type="button"
            className="is-quiet"
            aria-expanded={showTechnical}
            onClick={() => setShowTechnical((current) => !current)}
          >
            Technical details <i aria-hidden="true">{showTechnical ? "−" : "+"}</i>
          </button>
        </div>
      </div>
    </div>
  );
}
