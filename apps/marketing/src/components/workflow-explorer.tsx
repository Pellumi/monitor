"use client";

import { useState } from "react";
import { ProductPlaceholder } from "@/components/product-tour";

const workflowData = {
  Checkout: { entry: "PRODUCT_VIEW", exit: "ORDER_COMPLETE", states: 12, transitions: 18, sessions: 143, coverage: "75%", api: "POST /cart · POST /checkout · POST /payment" },
  Registration: { entry: "ANONYMOUS", exit: "REGISTERED", states: 8, transitions: 11, sessions: 96, coverage: "81%", api: "POST /auth/register · POST /email/verify" },
  Login: { entry: "ANONYMOUS", exit: "AUTHENTICATED", states: 7, transitions: 10, sessions: 184, coverage: "70%", api: "POST /auth/login · POST /auth/mfa" },
  Search: { entry: "PRODUCTS", exit: "PRODUCT_VIEW", states: 9, transitions: 13, sessions: 218, coverage: "77%", api: "GET /search · GET /products/:id" },
} as const;

type WorkflowName = keyof typeof workflowData;

export function WorkflowExplorer() {
  const [workflow, setWorkflow] = useState<WorkflowName>("Checkout");
  const [pathView, setPathView] = useState<"observed" | "missing">("observed");
  const [apiVisible, setApiVisible] = useState(false);
  const selected = workflowData[workflow];

  return (
    <div className="workflow-explorer">
      <header>
        <label><span>Workflow</span><select value={workflow} onChange={(event) => setWorkflow(event.target.value as WorkflowName)}>{Object.keys(workflowData).map((name) => <option key={name}>{name}</option>)}</select></label>
        <div className="workflow-explorer-controls" aria-label="Workflow display controls">
          <button type="button" className={pathView === "observed" ? "is-active" : ""} aria-pressed={pathView === "observed"} onClick={() => setPathView("observed")}>Observed paths</button>
          <button type="button" className={pathView === "missing" ? "is-active" : ""} aria-pressed={pathView === "missing"} onClick={() => setPathView("missing")}>Missing paths</button>
          <button type="button" className={apiVisible ? "is-active" : ""} aria-pressed={apiVisible} onClick={() => setApiVisible((value) => !value)}>{apiVisible ? "API context on" : "Show API context"}</button>
        </div>
      </header>
      <div className="workflow-explorer-layout">
        <nav aria-label="Discovered workflows">
          <p>Workflow inventory</p>
          {(Object.keys(workflowData) as WorkflowName[]).map((name, index) => <button key={name} type="button" className={workflow === name ? "is-active" : ""} aria-pressed={workflow === name} onClick={() => setWorkflow(name)}><span>{String(index + 1).padStart(2, "0")}</span>{name}</button>)}
        </nav>
        <div className="workflow-explorer-canvas">
          <ProductPlaceholder label={`${workflow} workflow / ${pathView} path explorer canvas`} dimensions="1280 × 780" displayDimensions="1280 × 780" />
          {apiVisible ? <span className="workflow-api-context">{selected.api}</span> : null}
        </div>
        <aside aria-live="polite">
          <p>Selected workflow</p><h3>{workflow.toUpperCase()}</h3>
          <dl>
            <div><dt>Entry</dt><dd>{selected.entry}</dd></div><div><dt>Exit</dt><dd>{selected.exit}</dd></div><div><dt>States</dt><dd>{selected.states}</dd></div><div><dt>Transitions</dt><dd>{selected.transitions}</dd></div><div><dt>Observed sessions</dt><dd>{selected.sessions}</dd></div><div><dt>Coverage</dt><dd>{selected.coverage}</dd></div>
          </dl>
          <small>Illustrative demonstration data</small>
        </aside>
      </div>
    </div>
  );
}
