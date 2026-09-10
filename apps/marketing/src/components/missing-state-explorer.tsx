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

type Category = "LOADING" | "EMPTY" | "ERROR" | "RECOVERY";

type FindingStatus =
  | "NOT_OBSERVED"
  | "DEMONSTRATED"
  | "NOT_APPLICABLE"
  | "DISMISSED";

type StateFinding = {
  id: string;
  name: string;
  category: Category;
  severity: "HIGH" | "MEDIUM" | "LOW";
  relatedState: string;
  rule: string;
  supporting: string;
  sessions: string[];
};

const categoryLabels: Record<Category, string> = {
  LOADING: "Loading state",
  EMPTY: "Empty state",
  ERROR: "Error state",
  RECOVERY: "Recovery state",
};

const statusLabels: Record<FindingStatus, string> = {
  NOT_OBSERVED: "Not observed",
  DEMONSTRATED: "Demonstrated",
  NOT_APPLICABLE: "Not applicable",
  DISMISSED: "Dismissed",
};

const notApplicableReasons = [
  "Application does not support this condition",
  "Handled externally",
  "Duplicate state",
  "Other",
];

const workflows: Record<string, StateFinding[]> = {
  Checkout: [
    {
      id: "checkout-loading",
      name: "CHECKOUT_LOADING",
      category: "LOADING",
      severity: "MEDIUM",
      relatedState: "CHECKOUT",
      rule: "REQUEST_RESPONSE_GAP",
      supporting: "POST /checkout observed with a 412 ms response",
      sessions: ["SES-3817", "SES-3824"],
    },
    {
      id: "checkout-payment-failure",
      name: "PAYMENT_FAILURE",
      category: "ERROR",
      severity: "HIGH",
      relatedState: "PAYMENT_SUCCESS",
      rule: "SUCCESS_TO_FAILURE",
      supporting: "PAYMENT_SUCCESS observed",
      sessions: ["SES-3817", "SES-3824", "SES-3901"],
    },
    {
      id: "checkout-empty-cart",
      name: "EMPTY_CART",
      category: "EMPTY",
      severity: "MEDIUM",
      relatedState: "CART_ACTIVE",
      rule: "POPULATED_TO_EMPTY",
      supporting: "CART_ACTIVE observed with 3 items",
      sessions: ["SES-3824"],
    },
    {
      id: "checkout-retry-payment",
      name: "RETRY_PAYMENT",
      category: "RECOVERY",
      severity: "MEDIUM",
      relatedState: "PAYMENT_FAILURE",
      rule: "FAILURE_TO_RECOVERY",
      supporting: "Payment failure state proposed for this workflow",
      sessions: [],
    },
    {
      id: "checkout-payment-timeout",
      name: "PAYMENT_TIMEOUT",
      category: "ERROR",
      severity: "LOW",
      relatedState: "PAYMENT_SUCCESS",
      rule: "FAST_RESPONSE_TO_TIMEOUT",
      supporting: "POST /payment responded in 412 ms",
      sessions: [],
    },
  ],
  Search: [
    {
      id: "search-loading",
      name: "SEARCH_LOADING",
      category: "LOADING",
      severity: "MEDIUM",
      relatedState: "SEARCH_RESULTS",
      rule: "REQUEST_RESPONSE_GAP",
      supporting: "GET /search observed with a 180 ms response",
      sessions: ["SES-4101"],
    },
    {
      id: "search-no-results",
      name: "NO_RESULTS",
      category: "EMPTY",
      severity: "HIGH",
      relatedState: "SEARCH_RESULTS",
      rule: "POPULATED_TO_EMPTY",
      supporting: "SEARCH_RESULTS observed with 24 items",
      sessions: ["SES-4101", "SES-4118"],
    },
    {
      id: "search-error",
      name: "SEARCH_ERROR",
      category: "ERROR",
      severity: "MEDIUM",
      relatedState: "SEARCH_RESULTS",
      rule: "SUCCESS_TO_FAILURE",
      supporting: "GET /search returned 200 in every observed session",
      sessions: ["SES-4118"],
    },
    {
      id: "search-retry",
      name: "RETRY_SEARCH",
      category: "RECOVERY",
      severity: "LOW",
      relatedState: "SEARCH_ERROR",
      rule: "FAILURE_TO_RECOVERY",
      supporting: "Search error state proposed for this workflow",
      sessions: [],
    },
  ],
  Authentication: [
    {
      id: "auth-error",
      name: "AUTHENTICATION_ERROR",
      category: "ERROR",
      severity: "HIGH",
      relatedState: "AUTHENTICATED",
      rule: "SUCCESS_TO_FAILURE",
      supporting: "LOGIN_SUCCESS observed",
      sessions: ["SES-3702", "SES-3744"],
    },
    {
      id: "auth-loading",
      name: "LOGIN_LOADING",
      category: "LOADING",
      severity: "LOW",
      relatedState: "LOGIN_FORM",
      rule: "REQUEST_RESPONSE_GAP",
      supporting: "POST /auth/login observed with a 260 ms response",
      sessions: ["SES-3702"],
    },
    {
      id: "auth-validation",
      name: "VALIDATION_ERROR",
      category: "ERROR",
      severity: "MEDIUM",
      relatedState: "LOGIN_FORM",
      rule: "VALID_TO_INVALID",
      supporting: "FORM_SUBMITTED observed with valid input",
      sessions: ["SES-3744"],
    },
    {
      id: "auth-retry",
      name: "RETRY_LOGIN",
      category: "RECOVERY",
      severity: "MEDIUM",
      relatedState: "AUTHENTICATION_ERROR",
      rule: "FAILURE_TO_RECOVERY",
      supporting: "Authentication error state proposed for this workflow",
      sessions: [],
    },
  ],
  Notifications: [
    {
      id: "notif-empty",
      name: "NO_NOTIFICATIONS",
      category: "EMPTY",
      severity: "MEDIUM",
      relatedState: "NOTIFICATION_LIST",
      rule: "POPULATED_TO_EMPTY",
      supporting: "NOTIFICATION_LIST observed with 7 items",
      sessions: ["SES-4210"],
    },
    {
      id: "notif-loading",
      name: "NOTIFICATIONS_LOADING",
      category: "LOADING",
      severity: "LOW",
      relatedState: "NOTIFICATION_LIST",
      rule: "REQUEST_RESPONSE_GAP",
      supporting: "GET /notifications observed with a 140 ms response",
      sessions: [],
    },
    {
      id: "notif-error",
      name: "NOTIFICATION_ERROR",
      category: "ERROR",
      severity: "LOW",
      relatedState: "NOTIFICATION_LIST",
      rule: "SUCCESS_TO_FAILURE",
      supporting: "GET /notifications returned 200",
      sessions: [],
    },
  ],
};

type WorkflowName = keyof typeof workflows;

const categoryFilters = [
  { key: "ALL", label: "All" },
  { key: "LOADING", label: "Loading" },
  { key: "EMPTY", label: "Empty" },
  { key: "ERROR", label: "Error" },
  { key: "RECOVERY", label: "Recovery" },
] as const;

type CategoryFilter = (typeof categoryFilters)[number]["key"];

const statusFilters = [
  { key: "ALL", label: "All" },
  { key: "NOT_OBSERVED", label: "Not observed" },
  { key: "DEMONSTRATED", label: "Demonstrated" },
] as const;

type StatusFilter = (typeof statusFilters)[number]["key"];

export function MissingStateExplorer() {
  const [workflow, setWorkflow] = useState<WorkflowName>("Checkout");
  const [category, setCategory] = useState<CategoryFilter>("ALL");
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [view, setView] = useState<"graph" | "list">("graph");
  const [selectedId, setSelectedId] = useState(workflows.Checkout[0].id);
  const [overrides, setOverrides] = useState<Record<string, FindingStatus>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [showReason, setShowReason] = useState(false);

  const findings = workflows[workflow];
  const statusOf = (finding: StateFinding): FindingStatus =>
    overrides[finding.id] ?? "NOT_OBSERVED";

  const visibleFindings = useMemo(
    () =>
      findings.filter((finding) => {
        const matchesCategory =
          category === "ALL" || finding.category === category;
        const matchesStatus =
          status === "ALL" ||
          (overrides[finding.id] ?? "NOT_OBSERVED") === status;
        return matchesCategory && matchesStatus;
      }),
    [findings, category, status, overrides],
  );

  // The active filters can hide the selected finding, so resolve the effective
  // selection during render instead of syncing it back through an effect.
  const selected =
    visibleFindings.find((finding) => finding.id === selectedId) ??
    visibleFindings[0] ??
    findings[0];

  const selectFinding = (id: string) => {
    setSelectedId(id);
    setShowReason(false);
  };

  const selectWorkflow = (value: WorkflowName) => {
    setWorkflow(value);
    setSelectedId(workflows[value][0].id);
    setShowReason(false);
  };

  const setFindingStatus = (id: string, next: FindingStatus) => {
    setOverrides((current) => ({ ...current, [id]: next }));
    setShowReason(next === "NOT_APPLICABLE");
  };

  const notObservedCount = findings.filter(
    (finding) => statusOf(finding) === "NOT_OBSERVED",
  ).length;

  const observedStates: Record<WorkflowName, string[]> = {
    Checkout: ["CART_ACTIVE", "CHECKOUT", "PAYMENT_SUCCESS"],
    Search: ["PRODUCTS", "SEARCH_RESULTS", "PRODUCT_VIEW"],
    Authentication: ["ANONYMOUS", "LOGIN_FORM", "AUTHENTICATED"],
    Notifications: ["AUTHENTICATED", "NOTIFICATION_LIST"],
  };

  return (
    <div className="states-explorer">
      <header className="states-explorer-header">
        <div className="states-explorer-title">
          <p>Missing states</p>
          <b>{notObservedCount} potential states not observed</b>
        </div>
        <div className="states-explorer-controls">
          <div className="states-explorer-workflow">
            <label htmlFor="states-explorer-workflow">Workflow</label>
            <Select
              value={workflow}
              onValueChange={(value) => selectWorkflow(value as WorkflowName)}
              className="states-select"
            >
              <SelectTrigger
                id="states-explorer-workflow"
                className="states-select-trigger"
              >
                <SelectValue placeholder="Choose workflow">
                  {workflow}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="states-select-content">
                <SelectGroup>
                  {(Object.keys(workflows) as WorkflowName[]).map((item) => (
                    <SelectItem
                      key={item}
                      value={item}
                      className="states-select-item"
                    >
                      {item}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <div className="states-view-toggle">
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

      <div className="states-explorer-findings">
        <p className="states-filter-label">Category</p>
        <div className="states-filter-row">
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
        <p className="states-filter-label">Status</p>
        <div className="states-filter-row">
          {statusFilters.map((item) => (
            <button
              key={item.key}
              type="button"
              className={status === item.key ? "is-active" : ""}
              aria-pressed={status === item.key}
              onClick={() => setStatus(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="states-finding-list">
          <p className="states-finding-count" aria-live="polite">
            {visibleFindings.length} of {findings.length} findings
          </p>
          {visibleFindings.map((finding) => {
            const findingStatus = statusOf(finding);
            return (
              <button
                key={finding.id}
                type="button"
                className={`${selected?.id === finding.id ? "is-current " : ""}${
                  findingStatus === "NOT_OBSERVED" ? "" : "is-resolved"
                }`}
                aria-current={selected?.id === finding.id ? "true" : undefined}
                onClick={() => selectFinding(finding.id)}
              >
                <span aria-hidden="true">
                  {findingStatus === "DEMONSTRATED" ? "✓" : "○"}
                </span>
                <b>{finding.name}</b>
                <small>
                  {categoryLabels[finding.category]} ·{" "}
                  {statusLabels[findingStatus]}
                </small>
              </button>
            );
          })}
          {visibleFindings.length === 0 ? (
            <p className="states-empty">No findings match these filters.</p>
          ) : null}
        </div>
        <small className="states-sample-note">Sample application data</small>
      </div>

      <div className="states-explorer-canvas">
        {view === "graph" ? (
          <div className="states-canvas-stage">
            <ProductPlaceholder
              label={`${workflow} workflow / observed states with dashed potential state nodes`}
              dimensions="1876 × 1160"
              displayDimensions="938 × 580"
            />
            <span className="states-canvas-legend">
              ● Observed · ○ Potential state not observed
            </span>
          </div>
        ) : (
          <div className="states-canvas-list">
            <div className="states-list-block">
              <p>Observed</p>
              <ul>
                {observedStates[workflow].map((state) => (
                  <li key={state}>
                    <i aria-hidden="true">●</i>
                    <b>{state}</b>
                  </li>
                ))}
              </ul>
            </div>
            <div className="states-list-block">
              <p>Potential states</p>
              <ul>
                {visibleFindings.map((finding) => (
                  <li key={finding.id}>
                    <i aria-hidden="true">
                      {statusOf(finding) === "DEMONSTRATED" ? "●" : "○"}
                    </i>
                    <b>{finding.name}</b>
                    <small>
                      {categoryLabels[finding.category]} ·{" "}
                      {statusLabels[statusOf(finding)]}
                    </small>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>

      <div className="states-explorer-inspector" aria-live="polite">
        <div className="states-inspector-identity">
          <p>{statusLabels[statusOf(selected)]}</p>
          <b>{selected.name}</b>
          <span>{categoryLabels[selected.category]}</span>
        </div>
        {showReason && statusOf(selected) === "NOT_APPLICABLE" ? (
          <div className="states-reason-picker">
            <p>Why is this not applicable?</p>
            <div>
              {notApplicableReasons.map((reason) => (
                <button
                  key={reason}
                  type="button"
                  className={reasons[selected.id] === reason ? "is-active" : ""}
                  aria-pressed={reasons[selected.id] === reason}
                  onClick={() =>
                    setReasons((current) => ({
                      ...current,
                      [selected.id]: reason,
                    }))
                  }
                >
                  {reason}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <dl>
            <div>
              <dt>Workflow</dt>
              <dd>{workflow}</dd>
            </div>
            <div>
              <dt>Related observed state</dt>
              <dd>{selected.relatedState}</dd>
            </div>
            <div>
              <dt>Detection basis</dt>
              <dd>Rule-based</dd>
            </div>
            <div>
              <dt>Rule</dt>
              <dd>{selected.rule}</dd>
            </div>
            <div>
              <dt>Supporting behavior</dt>
              <dd>{selected.supporting}</dd>
            </div>
            <div>
              <dt>Priority</dt>
              <dd>{selected.severity}</dd>
            </div>
          </dl>
        )}
        <div className="states-inspector-actions">
          {statusOf(selected) === "NOT_OBSERVED" ? (
            <>
              <button
                type="button"
                className="is-primary"
                onClick={() => setFindingStatus(selected.id, "DEMONSTRATED")}
              >
                Demonstrate this state
              </button>
              <button
                type="button"
                onClick={() => setFindingStatus(selected.id, "NOT_APPLICABLE")}
              >
                Not applicable
              </button>
              <button
                type="button"
                onClick={() => setFindingStatus(selected.id, "DISMISSED")}
              >
                Dismiss
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setFindingStatus(selected.id, "NOT_OBSERVED")}
            >
              Reset finding
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
