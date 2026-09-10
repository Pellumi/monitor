"use client";

import { useMemo, useState } from "react";
import { ProductPlaceholder } from "@/components/product-tour";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

type EndpointObservation = {
  id: string;
  method: Method;
  route: string;
  requests: number;
  averageResponseTime: number;
  errors: number;
  sessions: number;
  health: string;
  transition: string;
  states: string[];
  slow: boolean;
  frequent: boolean;
};

const workflows: Record<string, EndpointObservation[]> = {
  Checkout: [
    {
      id: "checkout-products",
      method: "GET",
      route: "/products/:id",
      requests: 42,
      averageResponseTime: 184,
      errors: 0,
      sessions: 24,
      health: "Observed normally",
      transition: "PRODUCT_VIEW → PRODUCT_READY",
      states: ["PRODUCT_VIEW", "PRODUCT_READY"],
      slow: false,
      frequent: true,
    },
    {
      id: "checkout-cart",
      method: "POST",
      route: "/cart",
      requests: 28,
      averageResponseTime: 143,
      errors: 0,
      sessions: 18,
      health: "Observed normally",
      transition: "PRODUCT_READY → CART_ACTIVE",
      states: ["PRODUCT_READY", "CART_ACTIVE"],
      slow: false,
      frequent: true,
    },
    {
      id: "checkout-checkout",
      method: "POST",
      route: "/checkout",
      requests: 18,
      averageResponseTime: 418,
      errors: 0,
      sessions: 18,
      health: "Observed normally",
      transition: "CART_ACTIVE → PAYMENT_PENDING",
      states: ["CART_ACTIVE", "PAYMENT_PENDING"],
      slow: false,
      frequent: false,
    },
    {
      id: "checkout-payment",
      method: "POST",
      route: "/payment",
      requests: 15,
      averageResponseTime: 891,
      errors: 2,
      sessions: 15,
      health: "Slow · elevated errors",
      transition: "PAYMENT_PENDING → PAYMENT_SUCCESS / PAYMENT_FAILURE",
      states: ["PAYMENT_PENDING", "PAYMENT_SUCCESS", "PAYMENT_FAILURE"],
      slow: true,
      frequent: false,
    },
  ],
  Authentication: [
    {
      id: "auth-login",
      method: "POST",
      route: "/auth/login",
      requests: 38,
      averageResponseTime: 260,
      errors: 0,
      sessions: 34,
      health: "Observed normally",
      transition: "LOGIN_FORM → AUTHENTICATED",
      states: ["LOGIN_FORM", "AUTHENTICATED"],
      slow: false,
      frequent: true,
    },
    {
      id: "auth-profile",
      method: "GET",
      route: "/profile",
      requests: 34,
      averageResponseTime: 96,
      errors: 0,
      sessions: 34,
      health: "Observed normally",
      transition: "AUTHENTICATED → PROFILE_READY",
      states: ["AUTHENTICATED", "PROFILE_READY"],
      slow: false,
      frequent: true,
    },
  ],
  Search: [
    {
      id: "search-search",
      method: "GET",
      route: "/search",
      requests: 31,
      averageResponseTime: 371,
      errors: 0,
      sessions: 28,
      health: "Slow",
      transition: "PRODUCTS → SEARCH_RESULTS",
      states: ["PRODUCTS", "SEARCH_RESULTS"],
      slow: true,
      frequent: true,
    },
    {
      id: "search-products",
      method: "GET",
      route: "/products",
      requests: 48,
      averageResponseTime: 184,
      errors: 0,
      sessions: 42,
      health: "Observed normally",
      transition: "SEARCH_RESULTS → PRODUCT_VIEW",
      states: ["SEARCH_RESULTS", "PRODUCT_VIEW"],
      slow: false,
      frequent: true,
    },
  ],
};

type WorkflowName = keyof typeof workflows;

const categoryFilters = [
  { key: "ALL", label: "All" },
  { key: "SLOW", label: "Slow" },
  { key: "ERROR", label: "High error" },
  { key: "FREQUENT", label: "Frequently observed" },
] as const;

type CategoryFilter = (typeof categoryFilters)[number]["key"];

const methodFilters = [
  "ALL",
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
] as const;

type MethodFilter = (typeof methodFilters)[number];

function errorRate(endpoint: EndpointObservation) {
  if (endpoint.requests === 0 || endpoint.errors === 0) return "0%";
  return `${((endpoint.errors / endpoint.requests) * 100).toFixed(1)}%`;
}

export function EndpointExplorer() {
  const [workflow, setWorkflow] = useState<WorkflowName>("Checkout");
  const [category, setCategory] = useState<CategoryFilter>("ALL");
  const [method, setMethod] = useState<MethodFilter>("ALL");
  const [view, setView] = useState<"graph" | "table">("graph");
  const [selectedId, setSelectedId] = useState(workflows.Checkout[3].id);

  const endpoints = workflows[workflow];

  const visibleEndpoints = useMemo(
    () =>
      endpoints.filter((endpoint) => {
        const matchesMethod = method === "ALL" || endpoint.method === method;
        const matchesCategory =
          category === "ALL" ||
          (category === "SLOW" && endpoint.slow) ||
          (category === "ERROR" && endpoint.errors > 0) ||
          (category === "FREQUENT" && endpoint.frequent);
        return matchesMethod && matchesCategory;
      }),
    [endpoints, category, method],
  );

  // The active filters can hide the selected endpoint, so resolve the effective
  // selection during render instead of syncing it back through an effect.
  const selected =
    visibleEndpoints.find((endpoint) => endpoint.id === selectedId) ??
    visibleEndpoints[0] ??
    endpoints[0];

  const selectWorkflow = (value: WorkflowName) => {
    setWorkflow(value);
    setSelectedId(workflows[value][0].id);
  };

  return (
    <div className="endpoint-explorer">
      <header className="endpoint-explorer-header">
        <div className="endpoint-explorer-title">
          <p>Endpoint intelligence</p>
          <b>{endpoints.length} endpoints observed</b>
        </div>
        <div className="endpoint-explorer-controls">
          <div className="endpoint-explorer-workflow">
            <label htmlFor="endpoint-explorer-workflow">Workflow</label>
            <Select
              value={workflow}
              onValueChange={(value) => selectWorkflow(value as WorkflowName)}
              className="endpoint-select"
            >
              <SelectTrigger
                id="endpoint-explorer-workflow"
                className="endpoint-select-trigger"
              >
                <SelectValue placeholder="Choose workflow">
                  {workflow}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="endpoint-select-content">
                <SelectGroup>
                  {(Object.keys(workflows) as WorkflowName[]).map((item) => (
                    <SelectItem
                      key={item}
                      value={item}
                      className="endpoint-select-item"
                    >
                      {item}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <div className="endpoint-view-toggle">
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
              className={view === "table" ? "is-active" : ""}
              aria-pressed={view === "table"}
              onClick={() => setView("table")}
            >
              Table
            </button>
          </div>
        </div>
      </header>

      <div className="endpoint-explorer-list">
        <p className="endpoint-filter-label">Category</p>
        <div className="endpoint-filter-row">
          {categoryFilters.map((item) => (
            <button
              key={item.key}
              type="button"
              className={category === item.key ? "is-active" : ""}
              aria-pressed={category === item.key}
              onClick={() => setCategory(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <p className="endpoint-filter-label">Method</p>
        <div className="endpoint-filter-row">
          {methodFilters.map((item) => (
            <button
              key={item}
              type="button"
              className={method === item ? "is-active" : ""}
              aria-pressed={method === item}
              onClick={() => setMethod(item)}
            >
              {item === "ALL" ? "All" : item}
            </button>
          ))}
        </div>
        <div className="endpoint-list-scroll">
          <p className="endpoint-list-count" aria-live="polite">
            {visibleEndpoints.length} of {endpoints.length} endpoints
          </p>
          {visibleEndpoints.map((endpoint) => (
            <button
              key={endpoint.id}
              type="button"
              className={selected?.id === endpoint.id ? "is-current" : ""}
              aria-current={selected?.id === endpoint.id ? "true" : undefined}
              onClick={() => setSelectedId(endpoint.id)}
            >
              <span className="endpoint-method">{endpoint.method}</span>
              <b>{endpoint.route}</b>
              <small>
                {endpoint.averageResponseTime} ms · {endpoint.requests}{" "}
                observed
                {endpoint.errors > 0 ? ` · ${endpoint.errors} errors` : ""}
              </small>
            </button>
          ))}
          {visibleEndpoints.length === 0 ? (
            <p className="endpoint-empty">No endpoints match these filters.</p>
          ) : null}
        </div>
        <small className="endpoint-sample-note">Sample application data</small>
      </div>

      <div className="endpoint-explorer-canvas">
        {view === "graph" ? (
          <div className="endpoint-canvas-stage">
            <ProductPlaceholder
              label={`${workflow} workflow / states with observed endpoint activity on each transition`}
              dimensions="1876 × 1160"
              displayDimensions="938 × 580"
            />
            <span className="endpoint-canvas-legend">
              {selected.method} {selected.route} ·{" "}
              {selected.averageResponseTime} ms
            </span>
          </div>
        ) : (
          <div
            className="endpoint-canvas-table"
            role="table"
            aria-label={`${workflow} workflow transitions and their observed endpoints`}
          >
            <div role="row" className="is-head">
              <span role="columnheader">Workflow</span>
              <span role="columnheader">Transition</span>
              <span role="columnheader">Endpoint</span>
            </div>
            {visibleEndpoints.map((endpoint) => (
              <div
                role="row"
                key={endpoint.id}
                className={selected?.id === endpoint.id ? "is-current" : ""}
              >
                <span role="cell">{workflow}</span>
                <span role="cell">{endpoint.transition}</span>
                <span role="cell">
                  {endpoint.method} {endpoint.route}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="endpoint-explorer-inspector" aria-live="polite">
        <div className="endpoint-inspector-identity">
          <p>
            <span className="endpoint-method">{selected.method}</span>
            {selected.health}
          </p>
          <b>{selected.route}</b>
          <span>{selected.states.join(" · ")}</span>
        </div>
        <dl>
          <div>
            <dt>Observed requests</dt>
            <dd>{selected.requests}</dd>
          </div>
          <div>
            <dt>Average response</dt>
            <dd>{selected.averageResponseTime} ms</dd>
          </div>
          <div>
            <dt>Errors</dt>
            <dd>{selected.errors}</dd>
          </div>
          <div>
            <dt>Observed error rate</dt>
            <dd>{errorRate(selected)}</dd>
          </div>
          <div>
            <dt>Workflow</dt>
            <dd>{workflow}</dd>
          </div>
          <div>
            <dt>Associated sessions</dt>
            <dd>{selected.sessions}</dd>
          </div>
        </dl>
        <span className="endpoint-inspector-action">View sessions →</span>
      </div>
    </div>
  );
}
