"use client";

import { useState } from "react";

type SourceTier =
  | "INTERNAL_LIBRARY"
  | "CROSS_TENANT"
  | "ASSISTIVE_ENRICHMENT";

type Status = "PENDING" | "ACCEPTED" | "REJECTED";

type Suggestion = {
  id: string;
  parentState: string;
  name: string;
  category: "NAVIGATION" | "UI" | "BUSINESS" | "ERROR" | "SYSTEM";
  sourceTier: SourceTier;
  rationale: string;
};

/** Public wording for each internal source tier. */
export const sourceLabels: Record<SourceTier, string> = {
  INTERNAL_LIBRARY: "Pattern library",
  CROSS_TENANT: "Cross-application pattern",
  ASSISTIVE_ENRICHMENT: "Assistive enrichment",
};

const categoryLabels: Record<Suggestion["category"], string> = {
  NAVIGATION: "Navigation state",
  UI: "UI state",
  BUSINESS: "Business state",
  ERROR: "Error state",
  SYSTEM: "System state",
};

const suggestions: Suggestion[] = [
  {
    id: "login-failure",
    parentState: "LOGIN",
    name: "LOGIN_FAILURE",
    category: "ERROR",
    sourceTier: "INTERNAL_LIBRARY",
    rationale:
      "A declared login success path commonly needs a corresponding failure path.",
  },
  {
    id: "account-locked",
    parentState: "LOGIN_FAILURE",
    name: "ACCOUNT_LOCKED",
    category: "ERROR",
    sourceTier: "INTERNAL_LIBRARY",
    rationale:
      "Repeated authentication failure is usually bounded by a lock-out condition.",
  },
  {
    id: "password-reset",
    parentState: "LOGIN_FAILURE",
    name: "PASSWORD_RESET_REQUESTED",
    category: "BUSINESS",
    sourceTier: "CROSS_TENANT",
    rationale:
      "Anonymized structural patterns across applications frequently place a recovery branch here.",
  },
  {
    id: "session-timeout",
    parentState: "AUTHENTICATED",
    name: "SESSION_TIMEOUT",
    category: "SYSTEM",
    sourceTier: "CROSS_TENANT",
    rationale:
      "Authenticated states are commonly paired with an expiry condition in aggregate structure data.",
  },
  {
    id: "device-verification",
    parentState: "AUTHENTICATED",
    name: "DEVICE_VERIFICATION_REQUIRED",
    category: "SYSTEM",
    sourceTier: "ASSISTIVE_ENRICHMENT",
    rationale:
      "A novel state name with no internal match. The candidate was normalized and schema-validated before it was shown.",
  },
];

export function SuggestionReview() {
  const [statuses, setStatuses] = useState<Record<string, Status>>({});
  const [openRationale, setOpenRationale] = useState<string | null>(null);

  const statusOf = (id: string): Status => statuses[id] ?? "PENDING";
  const decide = (id: string, next: Status) =>
    setStatuses((current) => ({ ...current, [id]: next }));

  const accepted = suggestions.filter(
    (item) => statusOf(item.id) === "ACCEPTED",
  );
  const rejected = suggestions.filter(
    (item) => statusOf(item.id) === "REJECTED",
  );
  const pending = suggestions.filter((item) => statusOf(item.id) === "PENDING");

  return (
    <div className="decl-suggestions">
      <header className="decl-suggestions-header">
        <div>
          <p className="decl-panel-label">Suggestion queue</p>
          <b>
            {pending.length} pending · {accepted.length} accepted ·{" "}
            {rejected.length} rejected
          </b>
        </div>
        <p>
          A suggestion never becomes declared intent until a human accepts it.
        </p>
      </header>

      <div className="decl-suggestion-rail">
        {suggestions.map((item) => {
          const status = statusOf(item.id);
          const isOpen = openRationale === item.id;
          return (
            <article
              key={item.id}
              className={`decl-suggestion-card is-${status.toLowerCase()}`}
            >
              <p className="decl-suggestion-parent">
                After <b>{item.parentState}</b>
              </p>
              <b className="decl-suggestion-name">{item.name}</b>
              <span className="decl-suggestion-category">
                {categoryLabels[item.category]}
              </span>
              <button
                type="button"
                className="decl-suggestion-why"
                aria-expanded={isOpen}
                onClick={() => setOpenRationale(isOpen ? null : item.id)}
              >
                Why this was suggested <i aria-hidden="true">{isOpen ? "−" : "+"}</i>
              </button>
              {isOpen ? (
                <p className="decl-suggestion-rationale">{item.rationale}</p>
              ) : null}
              <p className="decl-suggestion-source">
                <small>Source</small>
                <i>{sourceLabels[item.sourceTier]}</i>
              </p>
              <div className="decl-suggestion-actions">
                {status === "PENDING" ? (
                  <>
                    <button
                      type="button"
                      className="is-primary"
                      onClick={() => decide(item.id, "ACCEPTED")}
                    >
                      Accept
                    </button>
                    <button
                      type="button"
                      onClick={() => decide(item.id, "REJECTED")}
                    >
                      Reject
                    </button>
                  </>
                ) : (
                  <>
                    <span className="decl-suggestion-status">
                      {status === "ACCEPTED"
                        ? "Accepted · now declared intent"
                        : "Rejected · recorded, not resurfaced"}
                    </span>
                    <button type="button" onClick={() => decide(item.id, "PENDING")}>
                      Undo
                    </button>
                  </>
                )}
              </div>
            </article>
          );
        })}
      </div>

      <div className="decl-suggestion-outcome" aria-live="polite">
        <div>
          <p className="decl-panel-label">Declared intent</p>
          <ul className="decl-node-list">
            {["LOGIN", "AUTHENTICATED"].map((state) => (
              <li key={state}>
                <i aria-hidden="true">○</i>
                <b>{state}</b>
                <small>USER_AUTHORED</small>
              </li>
            ))}
            {accepted.map((item) => (
              <li key={item.id} className="decl-node-enter">
                <i aria-hidden="true">○</i>
                <b>{item.name}</b>
                <small>SUGGESTED_ACCEPTED</small>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="decl-panel-label">Rejected, retained</p>
          {rejected.length === 0 ? (
            <p className="decl-panel-copy">
              Nothing rejected yet. Rejections are recorded so an unchanged
              suggestion is not proposed again.
            </p>
          ) : (
            <ul className="decl-node-list is-rejected">
              {rejected.map((item) => (
                <li key={item.id}>
                  <i aria-hidden="true">×</i>
                  <b>{item.name}</b>
                  <small>REJECTED</small>
                </li>
              ))}
            </ul>
          )}
          <p className="decl-sample-note">Illustrative application data</p>
        </div>
      </div>
    </div>
  );
}
