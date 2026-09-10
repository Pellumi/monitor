"use client";

import { useEffect, useMemo, useState } from "react";
import { ProductPlaceholder } from "@/components/product-tour";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type PathStatus = "observed" | "unobserved";

type CoveragePath = {
  label: string;
  status: PathStatus;
  category: string;
  sessions: number;
  states: number;
  transitions: number;
  errors: number;
};

type WorkflowCoverage = {
  workflow: number;
  state: number;
  transition: number;
  endpoint: number;
  error: number;
  observedPaths: number;
  missingPaths: number;
  paths: CoveragePath[];
};

const workflows: Record<string, WorkflowCoverage> = {
  Checkout: {
    workflow: 72,
    state: 81,
    transition: 69,
    endpoint: 87,
    error: 42,
    observedPaths: 18,
    missingPaths: 7,
    paths: [
      {
        label: "PRODUCT_VIEW → CART_ACTIVE",
        status: "observed",
        category: "Primary path",
        sessions: 24,
        states: 2,
        transitions: 1,
        errors: 0,
      },
      {
        label: "CART_ACTIVE → CHECKOUT",
        status: "observed",
        category: "Primary path",
        sessions: 18,
        states: 2,
        transitions: 1,
        errors: 0,
      },
      {
        label: "CHECKOUT → PAYMENT_SUCCESS",
        status: "observed",
        category: "Primary path",
        sessions: 15,
        states: 2,
        transitions: 1,
        errors: 0,
      },
      {
        label: "CHECKOUT → PAYMENT_FAILURE",
        status: "unobserved",
        category: "Failure path",
        sessions: 0,
        states: 2,
        transitions: 1,
        errors: 0,
      },
      {
        label: "CHECKOUT → SESSION_TIMEOUT",
        status: "unobserved",
        category: "Edge-case path",
        sessions: 0,
        states: 2,
        transitions: 1,
        errors: 0,
      },
      {
        label: "PAYMENT_FAILURE → PAYMENT_RETRY",
        status: "unobserved",
        category: "Recovery path",
        sessions: 0,
        states: 2,
        transitions: 1,
        errors: 0,
      },
      {
        label: "CART_ACTIVE → INVENTORY_CHANGED",
        status: "unobserved",
        category: "Alternative path",
        sessions: 0,
        states: 2,
        transitions: 1,
        errors: 0,
      },
    ],
  },
  Registration: {
    workflow: 61,
    state: 70,
    transition: 58,
    endpoint: 74,
    error: 25,
    observedPaths: 4,
    missingPaths: 5,
    paths: [
      {
        label: "REGISTRATION_FORM → SUBMITTED",
        status: "observed",
        category: "Primary path",
        sessions: 21,
        states: 2,
        transitions: 1,
        errors: 0,
      },
      {
        label: "SUBMITTED → REGISTERED",
        status: "observed",
        category: "Primary path",
        sessions: 19,
        states: 2,
        transitions: 1,
        errors: 0,
      },
      {
        label: "REGISTERED → EMAIL_VERIFIED",
        status: "observed",
        category: "Primary path",
        sessions: 12,
        states: 2,
        transitions: 1,
        errors: 0,
      },
      {
        label: "SUBMITTED → VALIDATION_ERROR",
        status: "unobserved",
        category: "Failure path",
        sessions: 0,
        states: 2,
        transitions: 1,
        errors: 0,
      },
      {
        label: "SUBMITTED → EMAIL_EXISTS",
        status: "unobserved",
        category: "Alternative path",
        sessions: 0,
        states: 2,
        transitions: 1,
        errors: 0,
      },
      {
        label: "SUBMITTED → NETWORK_FAILURE",
        status: "unobserved",
        category: "Failure path",
        sessions: 0,
        states: 2,
        transitions: 1,
        errors: 0,
      },
    ],
  },
  Search: {
    workflow: 77,
    state: 74,
    transition: 72,
    endpoint: 91,
    error: 18,
    observedPaths: 9,
    missingPaths: 4,
    paths: [
      {
        label: "PRODUCTS → SEARCH_RESULTS",
        status: "observed",
        category: "Primary path",
        sessions: 42,
        states: 2,
        transitions: 1,
        errors: 0,
      },
      {
        label: "SEARCH_RESULTS → PRODUCT_VIEW",
        status: "observed",
        category: "Primary path",
        sessions: 31,
        states: 2,
        transitions: 1,
        errors: 0,
      },
      {
        label: "PRODUCTS → SEARCH_LOADING",
        status: "unobserved",
        category: "Loading state",
        sessions: 0,
        states: 2,
        transitions: 1,
        errors: 0,
      },
      {
        label: "PRODUCTS → NO_RESULTS",
        status: "unobserved",
        category: "Empty state",
        sessions: 0,
        states: 2,
        transitions: 1,
        errors: 0,
      },
      {
        label: "SEARCH_RESULTS → SEARCH_ERROR",
        status: "unobserved",
        category: "Failure path",
        sessions: 0,
        states: 2,
        transitions: 1,
        errors: 0,
      },
    ],
  },
  Login: {
    workflow: 70,
    state: 76,
    transition: 66,
    endpoint: 83,
    error: 31,
    observedPaths: 11,
    missingPaths: 6,
    paths: [
      {
        label: "ANONYMOUS → LOGIN_FORM",
        status: "observed",
        category: "Primary path",
        sessions: 38,
        states: 2,
        transitions: 1,
        errors: 0,
      },
      {
        label: "LOGIN_FORM → AUTHENTICATED",
        status: "observed",
        category: "Primary path",
        sessions: 34,
        states: 2,
        transitions: 1,
        errors: 0,
      },
      {
        label: "LOGIN_FORM → INVALID_PASSWORD",
        status: "unobserved",
        category: "Failure path",
        sessions: 0,
        states: 2,
        transitions: 1,
        errors: 0,
      },
      {
        label: "LOGIN_FORM → ACCOUNT_LOCKED",
        status: "unobserved",
        category: "Edge-case path",
        sessions: 0,
        states: 2,
        transitions: 1,
        errors: 0,
      },
      {
        label: "LOGIN_FORM → MFA_CHALLENGE",
        status: "unobserved",
        category: "Alternative path",
        sessions: 0,
        states: 2,
        transitions: 1,
        errors: 0,
      },
      {
        label: "AUTHENTICATED → SESSION_EXPIRED",
        status: "unobserved",
        category: "Recovery path",
        sessions: 0,
        states: 2,
        transitions: 1,
        errors: 0,
      },
    ],
  },
};

type WorkflowName = keyof typeof workflows;

const dimensions = [
  { key: "workflow", label: "Workflow" },
  { key: "state", label: "States" },
  { key: "transition", label: "Transitions" },
  { key: "endpoint", label: "Endpoints" },
  { key: "error", label: "Errors" },
] as const;

type DimensionKey = (typeof dimensions)[number]["key"];

const pathFilters = [
  { key: "all", label: "All" },
  { key: "observed", label: "Observed" },
  { key: "unobserved", label: "Unobserved" },
] as const;

type PathFilterKey = (typeof pathFilters)[number]["key"];

export function CoverageExplorer() {
  const [workflow, setWorkflow] = useState<WorkflowName>("Checkout");
  const [dimension, setDimension] = useState<DimensionKey>("workflow");
  const [pathFilter, setPathFilter] = useState<PathFilterKey>("all");
  const [view, setView] = useState<"graph" | "table">("graph");
  const [selectedPath, setSelectedPath] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);

  const data = workflows[workflow];

  const visiblePaths = useMemo(
    () =>
      data.paths
        .map((path, index) => ({ path, index }))
        .filter(
          ({ path }) => pathFilter === "all" || path.status === pathFilter,
        ),
    [data, pathFilter],
  );

  // The active filter can hide the selected path, so resolve the effective
  // selection during render rather than syncing it back through an effect.
  const activeIndex = visiblePaths.some(({ index }) => index === selectedPath)
    ? selectedPath
    : (visiblePaths[0]?.index ?? 0);

  useEffect(() => {
    if (!fullscreen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFullscreen(false);
    };
    const previousOverflow = document.body.style.overflow;
    document.addEventListener("keydown", closeOnEscape);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.body.style.overflow = previousOverflow;
    };
  }, [fullscreen]);

  const selected = data.paths[activeIndex] ?? data.paths[0];
  const activeDimension =
    dimensions.find((item) => item.key === dimension) ?? dimensions[0];

  return (
    <div className={`coverage-explorer${fullscreen ? " is-fullscreen" : ""}`}>
      <header className="coverage-explorer-header">
        <div className="coverage-explorer-workflow">
          <label htmlFor="coverage-explorer-workflow">Workflow</label>
          <Select
            value={workflow}
            onValueChange={(value) => {
              setWorkflow(value as WorkflowName);
              setSelectedPath(0);
            }}
            className="coverage-select"
          >
            <SelectTrigger
              id="coverage-explorer-workflow"
              className="coverage-select-trigger"
            >
              <SelectValue placeholder="Choose workflow">{workflow}</SelectValue>
            </SelectTrigger>
            <SelectContent className="coverage-select-content">
              <SelectGroup>
                {(Object.keys(workflows) as WorkflowName[]).map((item) => (
                  <SelectItem
                    key={item}
                    value={item}
                    className="coverage-select-item"
                  >
                    {item}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <div className="coverage-explorer-score">
          <small>Workflow coverage</small>
          <b>{data.workflow}%</b>
        </div>
      </header>

      <div className="coverage-explorer-summary">
        <p>Coverage</p>
        <div className="coverage-dimension-row" aria-label="Coverage dimension">
          {dimensions.map((item) => (
            <button
              key={item.key}
              type="button"
              className={dimension === item.key ? "is-active" : ""}
              aria-pressed={dimension === item.key}
              onClick={() => setDimension(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <dl className="coverage-dimension-list">
          {dimensions.map((item) => (
            <div
              key={item.key}
              className={dimension === item.key ? "is-active" : ""}
            >
              <dt>{item.label}</dt>
              <dd>
                <i style={{ width: `${data[item.key]}%` }} aria-hidden="true" />
                <span>{data[item.key]}%</span>
              </dd>
            </div>
          ))}
        </dl>
        <div className="coverage-path-counts">
          <span>
            <small>Observed paths</small>
            <b>{data.observedPaths}</b>
          </span>
          <span>
            <small>Missing paths</small>
            <b>{data.missingPaths}</b>
          </span>
        </div>
        <div className="coverage-path-filters" aria-label="Paths">
          {pathFilters.map((item) => (
            <button
              key={item.key}
              type="button"
              className={pathFilter === item.key ? "is-active" : ""}
              aria-pressed={pathFilter === item.key}
              onClick={() => setPathFilter(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="coverage-path-list">
          {visiblePaths.map(({ path, index }) => (
            <button
              key={path.label}
              type="button"
              className={`${index === activeIndex ? "is-current " : ""}${
                path.status === "unobserved" ? "is-unobserved" : ""
              }`}
              aria-current={index === activeIndex ? "true" : undefined}
              onClick={() => setSelectedPath(index)}
            >
              <span aria-hidden="true">
                {path.status === "observed" ? "✓" : "○"}
              </span>
              <b>{path.label}</b>
              <small>
                {path.status === "observed" ? "Observed" : "Unobserved"}
              </small>
            </button>
          ))}
        </div>
        <small className="coverage-sample-note">Sample application data</small>
      </div>

      <div className="coverage-explorer-canvas">
        <div className="coverage-canvas-bar">
          <p>
            {workflow} · {activeDimension.label} coverage
          </p>
          <div>
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
            <button
              type="button"
              className="coverage-fullscreen-toggle"
              onClick={() => setFullscreen((value) => !value)}
            >
              {fullscreen ? "Close full graph" : "Open full graph"}
            </button>
          </div>
        </div>
        {view === "graph" ? (
          <div className="coverage-canvas-stage">
            <ProductPlaceholder
              label={`${workflow} workflow / ${activeDimension.label.toLowerCase()} coverage graph canvas`}
              dimensions="1916 × 1088"
              displayDimensions="958 × 544"
            />
            <span className="coverage-canvas-legend">
              ✓ Observed · ○ Unobserved · ┄ Potential gap
            </span>
          </div>
        ) : (
          <div
            className="coverage-canvas-table"
            role="table"
            aria-label={`${workflow} coverage paths`}
          >
            <div role="row" className="is-head">
              <span role="columnheader">Path</span>
              <span role="columnheader">Category</span>
              <span role="columnheader">Sessions</span>
              <span role="columnheader">Status</span>
            </div>
            {visiblePaths.map(({ path, index }) => (
              <div
                role="row"
                key={path.label}
                className={index === activeIndex ? "is-current" : ""}
              >
                <span role="cell">{path.label}</span>
                <span role="cell">{path.category}</span>
                <span role="cell">
                  {path.status === "observed" ? path.sessions : "—"}
                </span>
                <span role="cell">
                  {path.status === "observed" ? "Observed" : "Unobserved"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="coverage-explorer-finding" aria-live="polite">
        <div>
          <p>{selected.status === "observed" ? "Observed path" : "Potential gap"}</p>
          <b>{selected.label}</b>
        </div>
        <dl>
          {selected.status === "observed" ? (
            <>
              <div>
                <dt>Observed in</dt>
                <dd>{selected.sessions} sessions</dd>
              </div>
              <div>
                <dt>States</dt>
                <dd>{selected.states}</dd>
              </div>
              <div>
                <dt>Transitions</dt>
                <dd>{selected.transitions}</dd>
              </div>
              <div>
                <dt>Errors</dt>
                <dd>{selected.errors}</dd>
              </div>
            </>
          ) : (
            <>
              <div>
                <dt>Status</dt>
                <dd>Not observed</dd>
              </div>
              <div>
                <dt>Category</dt>
                <dd>{selected.category}</dd>
              </div>
              <div>
                <dt>Related workflow</dt>
                <dd>{workflow}</dd>
              </div>
              <div>
                <dt>Suggested next step</dt>
                <dd>Demonstrate this path</dd>
              </div>
            </>
          )}
        </dl>
        <span className="coverage-finding-action">
          {selected.status === "observed"
            ? "View supporting sessions →"
            : "Demonstrate this path →"}
        </span>
      </div>
    </div>
  );
}
