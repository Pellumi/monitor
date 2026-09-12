"use client";

import { useMemo, useState } from "react";
import { ProductPlaceholder } from "@/components/product-tour";

type Classification = "CONFIRMED" | "TRUE_GAP" | "UNDECLARED";

type Origin =
  | "USER_AUTHORED"
  | "SUGGESTED_ACCEPTED"
  | "DEMONSTRATION_PROMOTED"
  | "TELEMETRY_OBSERVED";

type Item = {
  id: string;
  name: string;
  classification: Classification;
  origin: Origin;
  declaredIn: string;
  evidence: string;
  note: string;
};

const classificationLabels: Record<Classification, string> = {
  CONFIRMED: "Confirmed",
  TRUE_GAP: "True gap",
  UNDECLARED: "Undeclared",
};

const glyphs: Record<Classification, string> = {
  CONFIRMED: "✓",
  TRUE_GAP: "○",
  UNDECLARED: "+",
};

const items: Item[] = [
  {
    id: "product-view",
    name: "PRODUCT_VIEW",
    classification: "CONFIRMED",
    origin: "USER_AUTHORED",
    declaredIn: "Checkout v3",
    evidence: "Guided run DEM-3817",
    note: "Declared and observed. Evidence-backed coverage.",
  },
  {
    id: "cart-active",
    name: "CART_ACTIVE",
    classification: "CONFIRMED",
    origin: "USER_AUTHORED",
    declaredIn: "Checkout v3",
    evidence: "Guided run DEM-3817",
    note: "Declared and observed. Evidence-backed coverage.",
  },
  {
    id: "checkout",
    name: "CHECKOUT",
    classification: "CONFIRMED",
    origin: "USER_AUTHORED",
    declaredIn: "Checkout v3",
    evidence: "Guided run DEM-3817",
    note: "Declared and observed. Evidence-backed coverage.",
  },
  {
    id: "payment-success",
    name: "PAYMENT_SUCCESS",
    classification: "CONFIRMED",
    origin: "USER_AUTHORED",
    declaredIn: "Checkout v3",
    evidence: "Guided run DEM-3817",
    note: "Declared and observed. Evidence-backed coverage.",
  },
  {
    id: "payment-failed",
    name: "PAYMENT_FAILED",
    classification: "TRUE_GAP",
    origin: "USER_AUTHORED",
    declaredIn: "Checkout v3",
    evidence: "Guided run DEM-3817",
    note: "Explicitly declared and never observed. Stronger than an inferred absence because a person said it should exist.",
  },
  {
    id: "retry-payment",
    name: "RETRY_PAYMENT",
    classification: "TRUE_GAP",
    origin: "SUGGESTED_ACCEPTED",
    declaredIn: "Checkout v3",
    evidence: "Guided run DEM-3817",
    note: "Entered the declaration as an accepted suggestion, and the demonstration never reached it.",
  },
  {
    id: "session-timeout",
    name: "SESSION_TIMEOUT",
    classification: "TRUE_GAP",
    origin: "SUGGESTED_ACCEPTED",
    declaredIn: "Checkout v3",
    evidence: "Guided run DEM-3817",
    note: "Declared as an accepted suggestion. No evidence of the expiry condition in this run.",
  },
  {
    id: "promo-code-rejected",
    name: "PROMO_CODE_REJECTED",
    classification: "UNDECLARED",
    origin: "TELEMETRY_OBSERVED",
    declaredIn: "—",
    evidence: "Guided run DEM-3817",
    note: "Observed but not declared. That is a question for review, not an error by default.",
  },
  {
    id: "gift-card-applied",
    name: "GIFT_CARD_APPLIED",
    classification: "UNDECLARED",
    origin: "TELEMETRY_OBSERVED",
    declaredIn: "—",
    evidence: "Guided run DEM-3817",
    note: "Observed but not declared. It may be a legitimate flow nobody wrote down.",
  },
];

const filters = [
  { key: "ALL", label: "All" },
  { key: "CONFIRMED", label: "Confirmed" },
  { key: "TRUE_GAP", label: "True gap" },
  { key: "UNDECLARED", label: "Undeclared" },
] as const;

type Filter = (typeof filters)[number]["key"];

export function ReconciliationExplorer() {
  const [filter, setFilter] = useState<Filter>("ALL");
  const [selectedId, setSelectedId] = useState("payment-failed");
  const [view, setView] = useState<"graph" | "list">("graph");
  const [promoted, setPromoted] = useState<string[]>([]);

  const counts = useMemo(
    () => ({
      ALL: items.length,
      CONFIRMED: items.filter(
        (item) =>
          item.classification === "CONFIRMED" || promoted.includes(item.id),
      ).length,
      TRUE_GAP: items.filter((item) => item.classification === "TRUE_GAP")
        .length,
      UNDECLARED: items.filter(
        (item) =>
          item.classification === "UNDECLARED" && !promoted.includes(item.id),
      ).length,
    }),
    [promoted],
  );

  const classificationOf = (item: Item): Classification =>
    promoted.includes(item.id) ? "CONFIRMED" : item.classification;

  const visible = items.filter(
    (item) => filter === "ALL" || classificationOf(item) === filter,
  );

  // Filters can hide the selected row, so resolve the effective selection
  // during render rather than syncing it back through an effect.
  const selected =
    visible.find((item) => item.id === selectedId) ?? visible[0] ?? items[0];

  const selectedClassification = classificationOf(selected);

  return (
    <div className="decl-reconciler">
      <header className="decl-reconciler-header">
        <div>
          <p className="decl-panel-label">Checkout reconciliation</p>
          <b>
            Declared 14 · Observed 12 · Confirmed {counts.CONFIRMED} · True gaps{" "}
            {counts.TRUE_GAP} · Undeclared {counts.UNDECLARED}
          </b>
        </div>
        <div className="decl-view-toggle">
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

      <div className="decl-reconciler-filters">
        <p className="decl-panel-label">Filter</p>
        <div className="decl-filter-rows">
          {filters.map((item) => (
            <button
              key={item.key}
              type="button"
              className={filter === item.key ? "is-active" : ""}
              aria-pressed={filter === item.key}
              onClick={() => setFilter(item.key)}
            >
              <b>{item.label}</b>
              <span>{counts[item.key]}</span>
            </button>
          ))}
        </div>
        <div className="decl-reconciler-list">
          <p className="decl-reconciler-count" aria-live="polite">
            {visible.length} of {items.length} nodes
          </p>
          {visible.map((item) => {
            const classification = classificationOf(item);
            return (
              <button
                key={item.id}
                type="button"
                className={`is-${classification.toLowerCase()}${
                  selected.id === item.id ? " is-current" : ""
                }`}
                aria-current={selected.id === item.id ? "true" : undefined}
                onClick={() => setSelectedId(item.id)}
              >
                <span aria-hidden="true">{glyphs[classification]}</span>
                <b>{item.name}</b>
                <small>
                  {classificationLabels[classification]} ·{" "}
                  {promoted.includes(item.id)
                    ? "DEMONSTRATION_PROMOTED"
                    : item.origin}
                </small>
              </button>
            );
          })}
        </div>
        <p className="decl-sample-note">Illustrative application data</p>
      </div>

      <div className="decl-reconciler-canvas">
        {view === "graph" ? (
          <div className="decl-canvas-stage">
            <ProductPlaceholder
              label="Reconciled graph / declared and observed nodes with classification badges"
              dimensions="1840 × 1060"
              displayDimensions="920 × 530"
            />
          </div>
        ) : (
          <div className="decl-canvas-list">
            <p className="decl-panel-label">Reconciled nodes</p>
            <ol>
              {visible.map((item) => (
                <li key={item.id}>
                  <b>{item.name}</b>
                  <small>
                    {classificationLabels[classificationOf(item)]} ·{" "}
                    {item.declaredIn}
                  </small>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>

      <div className="decl-reconciler-inspector" aria-live="polite">
        <div className="decl-reconciler-identity">
          <span className={`decl-class-pill is-${selectedClassification.toLowerCase()}`}>
            {classificationLabels[selectedClassification]}
          </span>
          <b>{selected.name}</b>
          <small>{selected.note}</small>
        </div>
        <dl>
          <div>
            <dt>Declared</dt>
            <dd>
              {selectedClassification === "UNDECLARED" ? "No" : "Yes"}
            </dd>
          </div>
          <div>
            <dt>Observed</dt>
            <dd>{selectedClassification === "TRUE_GAP" ? "No" : "Yes"}</dd>
          </div>
          <div>
            <dt>Origin</dt>
            <dd>
              {promoted.includes(selected.id)
                ? "DEMONSTRATION_PROMOTED"
                : selected.origin}
            </dd>
          </div>
          <div>
            <dt>Declared in</dt>
            <dd>{promoted.includes(selected.id) ? "Checkout v4" : selected.declaredIn}</dd>
          </div>
          <div>
            <dt>Evidence basis</dt>
            <dd>{selected.evidence}</dd>
          </div>
        </dl>
        <div className="decl-reconciler-actions">
          {selectedClassification === "UNDECLARED" ? (
            <button
              type="button"
              className="is-primary"
              onClick={() =>
                setPromoted((current) => [...current, selected.id])
              }
            >
              Add to declared flow
            </button>
          ) : promoted.includes(selected.id) ? (
            <button
              type="button"
              onClick={() =>
                setPromoted((current) =>
                  current.filter((id) => id !== selected.id),
                )
              }
            >
              Leave undeclared
            </button>
          ) : (
            <button type="button">View declared flow</button>
          )}
          <button type="button">View run</button>
        </div>
      </div>
    </div>
  );
}
