"use client";

import { useState } from "react";
import { ProductPlaceholder } from "@/components/product-tour";

const workflows = {
  Checkout: {
    category: "BUSINESS",
    sessions: "143",
    incoming: "CART_ACTIVE",
    outgoing: "PAYMENT_SUCCESS · PAYMENT_FAILURE",
    endpoint: "POST /payment",
  },
  Registration: {
    category: "BUSINESS",
    sessions: "96",
    incoming: "ANONYMOUS",
    outgoing: "REGISTERED · VALIDATION_ERROR",
    endpoint: "POST /auth/register",
  },
  Search: {
    category: "NAVIGATION",
    sessions: "218",
    incoming: "PRODUCTS",
    outgoing: "SEARCH_RESULTS · NO_RESULTS",
    endpoint: "GET /search",
  },
  Profile: {
    category: "UI",
    sessions: "71",
    incoming: "AUTHENTICATED",
    outgoing: "PROFILE_UPDATED · VALIDATION_ERROR",
    endpoint: "PATCH /profile",
  },
} as const;

type Workflow = keyof typeof workflows;

export function BehaviorGraphExplorer() {
  const [workflow, setWorkflow] = useState<Workflow>("Checkout");
  const [showEndpoints, setShowEndpoints] = useState(false);
  const selected = workflows[workflow];

  return (
    <div className="graph-explorer">
      <header className="graph-explorer-bar">
        <label>
          <span>Workflow</span>
          <select
            value={workflow}
            onChange={(event) => setWorkflow(event.target.value as Workflow)}
          >
            {Object.keys(workflows).map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <div aria-label="Graph controls">
          <button type="button">Fit graph</button>
          <button type="button" aria-label="Zoom in">
            +
          </button>
          <button type="button" aria-label="Zoom out">
            −
          </button>
          <button
            type="button"
            className={showEndpoints ? "is-active" : ""}
            aria-pressed={showEndpoints}
            onClick={() => setShowEndpoints((value) => !value)}
          >
            {showEndpoints ? "API context on" : "Show API context"}
          </button>
        </div>
      </header>
      <div className="graph-explorer-body">
        <nav aria-label="Example workflows">
          <p>Observed workflows</p>
          {(Object.keys(workflows) as Workflow[]).map((item, index) => (
            <button
              key={item}
              type="button"
              className={workflow === item ? "is-active" : ""}
              aria-pressed={workflow === item}
              onClick={() => setWorkflow(item)}
            >
              <span>{String(index + 1).padStart(2, "0")}</span>
              {item}
            </button>
          ))}
        </nav>
        <div className="graph-explorer-canvas">
          <ProductPlaceholder
            label={`${workflow} workflow / interactive behavior graph canvas`}
            dimensions="1280 × 780"
            displayDimensions="1280 × 780"
          />
          {showEndpoints ? (
            <span className="graph-endpoint-badge">{selected.endpoint}</span>
          ) : null}
        </div>
        <aside aria-live="polite">
          <p>Selected state</p>
          <h3>{workflow.toUpperCase()}</h3>
          <dl>
            <div>
              <dt>Category</dt>
              <dd>{selected.category}</dd>
            </div>
            <div>
              <dt>Observed sessions</dt>
              <dd>{selected.sessions}</dd>
            </div>
            <div>
              <dt>Incoming</dt>
              <dd>{selected.incoming}</dd>
            </div>
            <div>
              <dt>Outgoing</dt>
              <dd>{selected.outgoing}</dd>
            </div>
            <div>
              <dt>Associated API</dt>
              <dd>{selected.endpoint}</dd>
            </div>
          </dl>
          <small>Sample demonstration data</small>
        </aside>
      </div>
    </div>
  );
}
