"use client";

import { useMemo, useState } from "react";
import { ProductPlaceholder } from "@/components/product-tour";

type Category = "NAVIGATION" | "UI" | "BUSINESS" | "ERROR" | "SYSTEM";

type Provenance =
  | "USER_AUTHORED"
  | "SUGGESTED_ACCEPTED"
  | "DEMONSTRATION_PROMOTED";

type FlowState = {
  id: string;
  name: string;
  category: Category;
  provenance: Provenance;
  boundary?: "ENTRY" | "TERMINAL";
};

type Suggestion = {
  id: string;
  name: string;
  category: Category;
  source: string;
  rationale: string;
};

const categories: Category[] = [
  "NAVIGATION",
  "UI",
  "BUSINESS",
  "ERROR",
  "SYSTEM",
];

const categoryLabels: Record<Category, string> = {
  NAVIGATION: "Navigation",
  UI: "UI",
  BUSINESS: "Business",
  ERROR: "Error",
  SYSTEM: "System",
};

const initialStates: FlowState[] = [
  {
    id: "product-view",
    name: "PRODUCT_VIEW",
    category: "NAVIGATION",
    provenance: "USER_AUTHORED",
    boundary: "ENTRY",
  },
  {
    id: "cart-active",
    name: "CART_ACTIVE",
    category: "BUSINESS",
    provenance: "USER_AUTHORED",
  },
  {
    id: "checkout",
    name: "CHECKOUT",
    category: "BUSINESS",
    provenance: "USER_AUTHORED",
  },
  {
    id: "payment-pending",
    name: "PAYMENT_PENDING",
    category: "BUSINESS",
    provenance: "USER_AUTHORED",
  },
];

const initialSuggestions: Suggestion[] = [
  {
    id: "payment-failure",
    name: "PAYMENT_FAILURE",
    category: "ERROR",
    source: "Pattern library",
    rationale:
      "A declared payment success path commonly needs a corresponding failure path.",
  },
  {
    id: "retry-payment",
    name: "RETRY_PAYMENT",
    category: "BUSINESS",
    source: "Pattern library",
    rationale:
      "A failure state usually needs a recovery branch back into the flow.",
  },
  {
    id: "session-timeout",
    name: "SESSION_TIMEOUT",
    category: "SYSTEM",
    source: "Cross-application pattern",
    rationale:
      "Aggregate structural patterns often bound a checkout flow with an expiry condition.",
  },
];

const completionSteps = [
  "Review complete",
  "Graph snapshot frozen",
  "Ruleset compiled",
];

const slug = (value: string) =>
  value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-") || "state";

/**
 * Public demonstration of the declared-flow editor.
 *
 * It exposes only the controls listed for the marketing demo — add, connect,
 * undo, fit, zoom, review, save, complete — rather than the full authoring
 * surface, and it never adds a suggestion to the flow without an explicit
 * acceptance.
 */
export function FlowBuilderDemo() {
  const [states, setStates] = useState<FlowState[]>(initialStates);
  const [history, setHistory] = useState<FlowState[][]>([]);
  const [suggestions, setSuggestions] =
    useState<Suggestion[]>(initialSuggestions);
  const [rejected, setRejected] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState("payment-pending");
  const [view, setView] = useState<"graph" | "list">("graph");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draftCategory, setDraftCategory] = useState<Category>("BUSINESS");
  const [status, setStatus] = useState<"DRAFT" | "COMPILING" | "COMPLETE">(
    "DRAFT",
  );
  const [version, setVersion] = useState(3);
  const [step, setStep] = useState(0);

  const selected = useMemo(
    () => states.find((state) => state.id === selectedId) ?? states[0],
    [states, selectedId],
  );

  const commit = (next: FlowState[]) => {
    setHistory((current) => [...current, states]);
    setStates(next);
  };

  const undo = () => {
    setHistory((current) => {
      if (current.length === 0) return current;
      setStates(current[current.length - 1]);
      return current.slice(0, -1);
    });
  };

  const addState = () => {
    const name = draftName.trim().toUpperCase().replace(/\s+/g, "_");
    if (!name) return;
    const id = `${slug(name)}-${states.length}`;
    commit([
      ...states,
      { id, name, category: draftCategory, provenance: "USER_AUTHORED" },
    ]);
    setSelectedId(id);
    setDraftName("");
    setDrawerOpen(false);
    if (status === "COMPLETE") setStatus("DRAFT");
  };

  const acceptSuggestion = (suggestion: Suggestion) => {
    const id = `${suggestion.id}-accepted`;
    commit([
      ...states,
      {
        id,
        name: suggestion.name,
        category: suggestion.category,
        provenance: "SUGGESTED_ACCEPTED",
      },
    ]);
    setSuggestions((current) =>
      current.filter((item) => item.id !== suggestion.id),
    );
    setSelectedId(id);
    if (status === "COMPLETE") setStatus("DRAFT");
  };

  const rejectSuggestion = (suggestion: Suggestion) => {
    setSuggestions((current) =>
      current.filter((item) => item.id !== suggestion.id),
    );
    setRejected((current) => [...current, suggestion.name]);
  };

  const markComplete = () => {
    setStatus("COMPILING");
    setStep(0);
    completionSteps.forEach((_, index) => {
      window.setTimeout(() => setStep(index + 1), 700 * (index + 1));
    });
    window.setTimeout(
      () => setStatus("COMPLETE"),
      700 * completionSteps.length + 500,
    );
  };

  const reopen = () => {
    setStatus("DRAFT");
    setVersion((current) => current + 1);
    setStep(0);
  };

  return (
    <div className="decl-builder">
      <header className="decl-builder-header">
        <div className="decl-builder-identity">
          <b>CHECKOUT</b>
          <span className={`decl-status-pill is-${status.toLowerCase()}`}>
            {status === "COMPILING" ? "Compiling" : status}
          </span>
          <small>
            {status === "COMPLETE"
              ? `v${version} · Ruleset updated`
              : `Draft v${version} · Last edited just now`}
          </small>
        </div>
        <div className="decl-builder-toolbar">
          <button type="button" onClick={() => setDrawerOpen(true)}>
            + State
          </button>
          <button type="button">Connect</button>
          <button type="button" onClick={undo} disabled={history.length === 0}>
            Undo
          </button>
          <button type="button">Fit</button>
          <button type="button">Zoom +</button>
          <button type="button">Zoom −</button>
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
        </div>
      </header>

      <div className="decl-builder-rail">
        <p className="decl-panel-label">Flow states</p>
        <ul className="decl-builder-states">
          {states.map((state, index) => (
            <li key={state.id}>
              <button
                type="button"
                className={selected?.id === state.id ? "is-current" : ""}
                aria-current={selected?.id === state.id ? "true" : undefined}
                onClick={() => setSelectedId(state.id)}
              >
                <small>{String(index + 1).padStart(2, "0")}</small>
                <b>{state.name}</b>
                <i>
                  {categoryLabels[state.category]}
                  {state.boundary ? ` · ${state.boundary}` : ""}
                  {state.provenance === "SUGGESTED_ACCEPTED"
                    ? " · Accepted"
                    : ""}
                </i>
              </button>
            </li>
          ))}
        </ul>

        <p className="decl-panel-label">
          Suggestions
          <span className="decl-count">{suggestions.length}</span>
        </p>
        <ul className="decl-builder-suggestions">
          {suggestions.map((suggestion) => (
            <li key={suggestion.id}>
              <b>{suggestion.name}</b>
              <small>
                {categoryLabels[suggestion.category]} · {suggestion.source}
              </small>
              <p>{suggestion.rationale}</p>
              <div>
                <button
                  type="button"
                  className="is-primary"
                  onClick={() => acceptSuggestion(suggestion)}
                >
                  Accept
                </button>
                <button
                  type="button"
                  onClick={() => rejectSuggestion(suggestion)}
                >
                  Reject
                </button>
              </div>
            </li>
          ))}
          {suggestions.length === 0 ? (
            <li className="decl-builder-empty">
              No pending suggestions.
              {rejected.length > 0
                ? ` ${rejected.length} rejected suggestion${
                    rejected.length > 1 ? "s" : ""
                  } recorded, so it is not resurfaced unchanged.`
                : ""}
            </li>
          ) : null}
        </ul>
      </div>

      <div className="decl-builder-canvas">
        {drawerOpen ? (
          <div
            className="decl-builder-drawer"
            role="dialog"
            aria-label="Add state"
          >
            <p className="decl-panel-label">Add state</p>
            <label htmlFor="decl-state-name">State name</label>
            <input
              id="decl-state-name"
              value={draftName}
              placeholder="Payment failure"
              onChange={(event) => setDraftName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") addState();
              }}
            />
            <fieldset>
              <legend>Category</legend>
              {categories.map((category) => (
                <label key={category}>
                  <input
                    type="radio"
                    name="decl-state-category"
                    checked={draftCategory === category}
                    onChange={() => setDraftCategory(category)}
                  />
                  {categoryLabels[category]}
                </label>
              ))}
            </fieldset>
            <div className="decl-drawer-actions">
              <button type="button" className="is-primary" onClick={addState}>
                Add state
              </button>
              <button type="button" onClick={() => setDrawerOpen(false)}>
                Cancel
              </button>
            </div>
          </div>
        ) : null}

        {view === "graph" ? (
          <div className="decl-canvas-stage">
            <ProductPlaceholder
              label="Declared flow canvas / interactive graph design"
              dimensions="1880 × 1080"
              displayDimensions="940 × 540"
            />
          </div>
        ) : (
          <div className="decl-canvas-list">
            <p className="decl-panel-label">Checkout · list view</p>
            <ol>
              {states.map((state) => (
                <li key={state.id}>
                  <b>{state.name}</b>
                  <small>
                    {categoryLabels[state.category]} · {state.provenance}
                    {state.boundary ? ` · ${state.boundary}` : ""}
                  </small>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>

      <div className="decl-builder-inspector" aria-live="polite">
        <div className="decl-builder-selected">
          <p className="decl-panel-label">Selected state</p>
          <b>{selected?.name}</b>
        </div>
        <dl>
          <div>
            <dt>Category</dt>
            <dd>{selected ? categoryLabels[selected.category] : "—"}</dd>
          </div>
          <div>
            <dt>Origin</dt>
            <dd>{selected?.provenance}</dd>
          </div>
          <div>
            <dt>Boundary</dt>
            <dd>{selected?.boundary ?? "In-flow"}</dd>
          </div>
          <div>
            <dt>Flow version</dt>
            <dd>v{version}</dd>
          </div>
        </dl>
      </div>

      <footer className="decl-builder-footer">
        <span className="decl-builder-progress" aria-live="polite">
          {status === "COMPILING" ? (
            completionSteps.map((label, index) => (
              <i key={label} className={index < step ? "is-done" : ""}>
                {label}
              </i>
            ))
          ) : status === "COMPLETE" ? (
            <i className="is-done">
              Complete · {states.length} states · ruleset recompiled
            </i>
          ) : (
            <i>
              Draft · {states.length} states · {suggestions.length} suggestion
              {suggestions.length === 1 ? "" : "s"} pending
            </i>
          )}
        </span>
        <div className="decl-builder-footer-actions">
          <button type="button">Save draft</button>
          {status === "COMPLETE" ? (
            <button type="button" className="is-primary" onClick={reopen}>
              Reopen for editing
            </button>
          ) : (
            <button
              type="button"
              className="is-primary"
              onClick={markComplete}
              disabled={status === "COMPILING"}
            >
              Mark flow complete
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}
