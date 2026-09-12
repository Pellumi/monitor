"use client";

import { useState } from "react";
import { ProductPlaceholder } from "@/components/product-tour";

type Mode = "DECLARED" | "DEMONSTRATED" | "RECONCILED";

type Row = {
  name: string;
  declared: boolean;
  observed: boolean;
  origin: string;
};

const rows: Row[] = [
  {
    name: "PRODUCT_VIEW",
    declared: true,
    observed: true,
    origin: "USER_AUTHORED",
  },
  {
    name: "CART_ACTIVE",
    declared: true,
    observed: true,
    origin: "USER_AUTHORED",
  },
  { name: "CHECKOUT", declared: true, observed: true, origin: "USER_AUTHORED" },
  {
    name: "PAYMENT_SUCCESS",
    declared: true,
    observed: true,
    origin: "USER_AUTHORED",
  },
  {
    name: "PAYMENT_FAILURE",
    declared: true,
    observed: false,
    origin: "USER_AUTHORED",
  },
  {
    name: "RETRY_PAYMENT",
    declared: true,
    observed: false,
    origin: "SUGGESTED_ACCEPTED",
  },
  {
    name: "PROMO_CODE_REJECTED",
    declared: false,
    observed: true,
    origin: "TELEMETRY_OBSERVED",
  },
];

const modes: { key: Mode; label: string; note: string }[] = [
  {
    key: "DECLARED",
    label: "Declared",
    note: "What the team said should happen. Intent only — no telemetry.",
  },
  {
    key: "DEMONSTRATED",
    label: "Demonstrated",
    note: "What telemetry proved happened during the demonstration.",
  },
  {
    key: "RECONCILED",
    label: "Reconciled",
    note: "The comparison. Neither graph is overwritten by the other.",
  },
];

function classify(row: Row) {
  if (row.declared && row.observed) return "Confirmed";
  if (row.declared) return "True gap";
  return "Undeclared";
}

export function IntentObservationToggle() {
  const [mode, setMode] = useState<Mode>("DECLARED");
  const active = modes.find((item) => item.key === mode)!;

  const visible = rows.filter((row) =>
    mode === "DECLARED"
      ? row.declared
      : mode === "DEMONSTRATED"
        ? row.observed
        : true,
  );

  return (
    <div className="decl-toggle">
      <div className="decl-toggle-bar" role="tablist" aria-label="Graph view">
        {modes.map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={mode === item.key}
            className={mode === item.key ? "is-active" : ""}
            onClick={() => setMode(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="decl-toggle-body">
        <ProductPlaceholder
          label={`${active.label} graph / interactive SVG design`}
          dimensions="1600 × 900"
          displayDimensions="1000 × 562"
        />
        <div className="decl-toggle-panel" aria-live="polite">
          <p className="decl-panel-label">{active.label}</p>
          <p className="decl-panel-copy">{active.note}</p>
          <ul className="decl-node-list">
            {visible.map((row) => {
              const status = classify(row);
              return (
                <li
                  key={row.name}
                  className={
                    mode === "RECONCILED"
                      ? `is-${status.toLowerCase().replace(" ", "-")}`
                      : row.declared && !row.observed && mode === "DECLARED"
                        ? "is-intent"
                        : ""
                  }
                >
                  <i aria-hidden="true">
                    {mode === "DECLARED"
                      ? "○"
                      : mode === "DEMONSTRATED"
                        ? "●"
                        : status === "Confirmed"
                          ? "✓"
                          : status === "True gap"
                            ? "○"
                            : "+"}
                  </i>
                  <b>{row.name}</b>
                  <small>
                    {mode === "RECONCILED" ? status : row.origin}
                  </small>
                </li>
              );
            })}
          </ul>
          <p className="decl-sample-note">Illustrative application data</p>
        </div>
      </div>
    </div>
  );
}
