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

type Category = "FAILURE" | "ALTERNATIVE" | "RECOVERY" | "EDGE_CASE";

type FindingStatus =
  | "NOT_OBSERVED"
  | "DEMONSTRATED"
  | "NOT_APPLICABLE"
  | "DISMISSED";

type Finding = {
  id: string;
  name: string;
  category: Category;
  severity: "HIGH" | "MEDIUM" | "LOW";
  sourceState: string;
  targetState: string;
  rule: string;
  supporting: string;
  sessions: string[];
};

const categoryLabels: Record<Category, string> = {
  FAILURE: "Failure flow",
  ALTERNATIVE: "Alternative flow",
  RECOVERY: "Recovery flow",
  EDGE_CASE: "Edge-case flow",
};

const statusLabels: Record<FindingStatus, string> = {
  NOT_OBSERVED: "Not observed",
  DEMONSTRATED: "Demonstrated",
  NOT_APPLICABLE: "Not applicable",
  DISMISSED: "Dismissed",
};

const workflows: Record<string, Finding[]> = {
  Checkout: [
    {
      id: "checkout-payment-failure",
      name: "PAYMENT_FAILURE",
      category: "FAILURE",
      severity: "HIGH",
      sourceState: "CHECKOUT",
      targetState: "PAYMENT_FAILURE",
      rule: "SUCCESS_TO_FAILURE",
      supporting: "PAYMENT_SUCCESS observed",
      sessions: ["SES-3817", "SES-3824", "SES-3901"],
    },
    {
      id: "checkout-session-timeout",
      name: "SESSION_TIMEOUT",
      category: "EDGE_CASE",
      severity: "HIGH",
      sourceState: "CHECKOUT",
      targetState: "SESSION_TIMEOUT",
      rule: "FAST_RESPONSE_TO_TIMEOUT",
      supporting: "POST /checkout responded in 412 ms",
      sessions: ["SES-3817", "SES-4012"],
    },
    {
      id: "checkout-retry-payment",
      name: "RETRY_PAYMENT",
      category: "RECOVERY",
      severity: "MEDIUM",
      sourceState: "PAYMENT_FAILURE",
      targetState: "CHECKOUT",
      rule: "FAILURE_TO_RECOVERY",
      supporting: "Payment failure path proposed for this workflow",
      sessions: [],
    },
    {
      id: "checkout-out-of-stock",
      name: "OUT_OF_STOCK",
      category: "ALTERNATIVE",
      severity: "MEDIUM",
      sourceState: "CART_ACTIVE",
      targetState: "OUT_OF_STOCK",
      rule: "CONFIGURED_ALTERNATIVE",
      supporting: "Cart workflow exists",
      sessions: ["SES-3824"],
    },
    {
      id: "checkout-guest-checkout",
      name: "GUEST_CHECKOUT",
      category: "ALTERNATIVE",
      severity: "LOW",
      sourceState: "CART_ACTIVE",
      targetState: "CHECKOUT",
      rule: "CONFIGURED_ALTERNATIVE",
      supporting: "Alternative checkout pattern configured for this workflow",
      sessions: [],
    },
    {
      id: "checkout-cart-expiration",
      name: "CART_EXPIRATION",
      category: "EDGE_CASE",
      severity: "LOW",
      sourceState: "CART_ACTIVE",
      targetState: "CART_EXPIRED",
      rule: "FAST_RESPONSE_TO_TIMEOUT",
      supporting: "Cart state observed across 18 sessions",
      sessions: ["SES-3901"],
    },
  ],
  Authentication: [
    {
      id: "auth-login-failure",
      name: "LOGIN_FAILURE",
      category: "FAILURE",
      severity: "HIGH",
      sourceState: "LOGIN_FORM",
      targetState: "LOGIN_FAILURE",
      rule: "SUCCESS_TO_FAILURE",
      supporting: "LOGIN_SUCCESS observed",
      sessions: ["SES-3702", "SES-3744"],
    },
    {
      id: "auth-session-expiration",
      name: "SESSION_EXPIRATION",
      category: "EDGE_CASE",
      severity: "HIGH",
      sourceState: "AUTHENTICATED",
      targetState: "SESSION_EXPIRED",
      rule: "FAST_RESPONSE_TO_TIMEOUT",
      supporting: "Authenticated state observed across 34 sessions",
      sessions: ["SES-3702"],
    },
    {
      id: "auth-password-reset",
      name: "PASSWORD_RESET",
      category: "RECOVERY",
      severity: "MEDIUM",
      sourceState: "LOGIN_FAILURE",
      targetState: "AUTHENTICATED",
      rule: "FAILURE_TO_RECOVERY",
      supporting: "Login failure path proposed for this workflow",
      sessions: [],
    },
    {
      id: "auth-account-locked",
      name: "ACCOUNT_LOCKED",
      category: "EDGE_CASE",
      severity: "MEDIUM",
      sourceState: "LOGIN_FORM",
      targetState: "ACCOUNT_LOCKED",
      rule: "SUCCESS_TO_FAILURE",
      supporting: "Repeated login attempts observed",
      sessions: ["SES-3744"],
    },
    {
      id: "auth-social-login",
      name: "SOCIAL_LOGIN",
      category: "ALTERNATIVE",
      severity: "LOW",
      sourceState: "LOGIN_FORM",
      targetState: "AUTHENTICATED",
      rule: "CONFIGURED_ALTERNATIVE",
      supporting: "Alternative authentication pattern configured",
      sessions: [],
    },
  ],
  Search: [
    {
      id: "search-empty-result",
      name: "EMPTY_SEARCH_RESULT",
      category: "EDGE_CASE",
      severity: "MEDIUM",
      sourceState: "SEARCH_RESULTS",
      targetState: "EMPTY_RESULTS",
      rule: "POPULATED_TO_EMPTY",
      supporting: "SEARCH_RESULTS observed with 24 items",
      sessions: ["SES-4101", "SES-4118"],
    },
    {
      id: "search-api-failure",
      name: "SEARCH_API_FAILURE",
      category: "FAILURE",
      severity: "MEDIUM",
      sourceState: "PRODUCTS",
      targetState: "SEARCH_ERROR",
      rule: "SUCCESS_TO_FAILURE",
      supporting: "GET /search returned 200 in every observed session",
      sessions: ["SES-4101"],
    },
    {
      id: "search-timeout",
      name: "SEARCH_TIMEOUT",
      category: "EDGE_CASE",
      severity: "LOW",
      sourceState: "PRODUCTS",
      targetState: "SEARCH_TIMEOUT",
      rule: "FAST_RESPONSE_TO_TIMEOUT",
      supporting: "GET /search responded in 180 ms",
      sessions: [],
    },
    {
      id: "search-filtered-browse",
      name: "FILTERED_BROWSE",
      category: "ALTERNATIVE",
      severity: "LOW",
      sourceState: "PRODUCTS",
      targetState: "PRODUCT_VIEW",
      rule: "CONFIGURED_ALTERNATIVE",
      supporting: "Product listing workflow exists",
      sessions: [],
    },
  ],
  Registration: [
    {
      id: "reg-invalid-form",
      name: "INVALID_FORM_DATA",
      category: "FAILURE",
      severity: "HIGH",
      sourceState: "REGISTRATION_FORM",
      targetState: "VALIDATION_ERROR",
      rule: "VALID_TO_INVALID",
      supporting: "FORM_SUBMITTED observed with valid input",
      sessions: ["SES-3960", "SES-3988"],
    },
    {
      id: "reg-email-exists",
      name: "EMAIL_ALREADY_EXISTS",
      category: "FAILURE",
      severity: "MEDIUM",
      sourceState: "REGISTRATION_FORM",
      targetState: "EMAIL_EXISTS",
      rule: "SUCCESS_TO_FAILURE",
      supporting: "REGISTERED observed",
      sessions: ["SES-3960"],
    },
    {
      id: "reg-resend-verification",
      name: "RESEND_VERIFICATION",
      category: "RECOVERY",
      severity: "MEDIUM",
      sourceState: "EMAIL_UNVERIFIED",
      targetState: "EMAIL_VERIFIED",
      rule: "FAILURE_TO_RECOVERY",
      supporting: "Email verification step observed",
      sessions: [],
    },
    {
      id: "reg-trial-signup",
      name: "TRIAL_SIGNUP",
      category: "ALTERNATIVE",
      severity: "LOW",
      sourceState: "ANONYMOUS",
      targetState: "REGISTERED",
      rule: "CONFIGURED_ALTERNATIVE",
      supporting: "Alternative signup pattern configured",
      sessions: [],
    },
  ],
};

type WorkflowName = keyof typeof workflows;

const categoryFilters = [
  { key: "ALL", label: "All" },
  { key: "FAILURE", label: "Failure" },
  { key: "ALTERNATIVE", label: "Alternative" },
  { key: "RECOVERY", label: "Recovery" },
  { key: "EDGE_CASE", label: "Edge case" },
] as const;

type CategoryFilter = (typeof categoryFilters)[number]["key"];

const statusFilters = [
  { key: "ALL", label: "All" },
  { key: "NOT_OBSERVED", label: "Not observed" },
  { key: "DEMONSTRATED", label: "Demonstrated" },
] as const;

type StatusFilter = (typeof statusFilters)[number]["key"];

export function MissingFlowExplorer() {
  const [workflow, setWorkflow] = useState<WorkflowName>("Checkout");
  const [category, setCategory] = useState<CategoryFilter>("ALL");
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [view, setView] = useState<"graph" | "list">("graph");
  const [selectedId, setSelectedId] = useState(workflows.Checkout[0].id);
  const [overrides, setOverrides] = useState<Record<string, FindingStatus>>({});

  const findings = workflows[workflow];
  const statusOf = (finding: Finding): FindingStatus =>
    overrides[finding.id] ?? "NOT_OBSERVED";

  const visibleFindings = useMemo(
    () =>
      findings.filter((finding) => {
        const matchesCategory =
          category === "ALL" || finding.category === category;
        const matchesStatus =
          status === "ALL" || (overrides[finding.id] ?? "NOT_OBSERVED") === status;
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

  const selectWorkflow = (value: WorkflowName) => {
    setWorkflow(value);
    setSelectedId(workflows[value][0].id);
  };

  const setFindingStatus = (id: string, next: FindingStatus) =>
    setOverrides((current) => ({ ...current, [id]: next }));

  const notObservedCount = findings.filter(
    (finding) => statusOf(finding) === "NOT_OBSERVED",
  ).length;

  return (
    <div className="flows-explorer">
      <header className="flows-explorer-header">
        <div className="flows-explorer-title">
          <p>Missing flows</p>
          <b>{notObservedCount} potential flows not observed</b>
        </div>
        <div className="flows-explorer-controls">
          <div className="flows-explorer-workflow">
            <label htmlFor="flows-explorer-workflow">Workflow</label>
            <Select
              value={workflow}
              onValueChange={(value) => selectWorkflow(value as WorkflowName)}
              className="flows-select"
            >
              <SelectTrigger
                id="flows-explorer-workflow"
                className="flows-select-trigger"
              >
                <SelectValue placeholder="Choose workflow">
                  {workflow}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="flows-select-content">
                <SelectGroup>
                  {(Object.keys(workflows) as WorkflowName[]).map((item) => (
                    <SelectItem
                      key={item}
                      value={item}
                      className="flows-select-item"
                    >
                      {item}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <div className="flows-view-toggle">
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

      <div className="flows-explorer-findings">
        <p className="flows-filter-label">Category</p>
        <div className="flows-filter-row">
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
        <p className="flows-filter-label">Status</p>
        <div className="flows-filter-row">
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
        <div className="flows-finding-list">
          <p className="flows-finding-count" aria-live="polite">
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
                onClick={() => setSelectedId(finding.id)}
              >
                <span aria-hidden="true">
                  {findingStatus === "DEMONSTRATED" ? "✓" : "┄"}
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
            <p className="flows-empty">No findings match these filters.</p>
          ) : null}
        </div>
        <small className="flows-sample-note">Sample application data</small>
      </div>

      <div className="flows-explorer-canvas">
        {view === "graph" ? (
          <div className="flows-canvas-stage">
            <ProductPlaceholder
              label={`${workflow} workflow / observed paths with dashed missing-flow branches`}
              dimensions="1876 × 1160"
              displayDimensions="938 × 580"
            />
            <span className="flows-canvas-legend">
              ━━ Observed · ┄┄ Potential flow not observed
            </span>
          </div>
        ) : (
          <div className="flows-canvas-list">
            <div className="flows-list-block">
              <p>Observed</p>
              <ul>
                <li>
                  <i aria-hidden="true">━</i> {workflow} → success path
                </li>
              </ul>
            </div>
            <div className="flows-list-block">
              <p>Potential gaps</p>
              <ul>
                {visibleFindings.map((finding) => (
                  <li key={finding.id}>
                    <i aria-hidden="true">
                      {statusOf(finding) === "DEMONSTRATED" ? "━" : "┄"}
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

      <div className="flows-explorer-inspector" aria-live="polite">
        <div className="flows-inspector-identity">
          <p>{statusLabels[statusOf(selected)]}</p>
          <b>{selected.name}</b>
          <span>{categoryLabels[selected.category]}</span>
        </div>
        <dl>
          <div>
            <dt>Workflow</dt>
            <dd>{workflow}</dd>
          </div>
          <div>
            <dt>Observed parent</dt>
            <dd>{selected.sourceState}</dd>
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
            <dt>Severity</dt>
            <dd>{selected.severity}</dd>
          </div>
        </dl>
        <div className="flows-inspector-actions">
          {statusOf(selected) === "NOT_OBSERVED" ? (
            <>
              <button
                type="button"
                className="is-primary"
                onClick={() => setFindingStatus(selected.id, "DEMONSTRATED")}
              >
                Demonstrate this path
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
