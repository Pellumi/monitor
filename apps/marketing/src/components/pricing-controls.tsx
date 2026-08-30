"use client";

import { useState } from "react";
import type { PlanDefinition, PlanTypeKey } from "@tellann/shared";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.domain-name.com";

const comparisonRows: ReadonlyArray<
  readonly [label: string, requiredFeatures: readonly string[]]
> = [
  ["Replay a walkthrough when something goes wrong", ["SESSION_REPLAY"]],
  [
    "Find screens and user paths your tests missed",
    ["MISSING_STATE_DETECTION", "MISSING_FLOW_DETECTION"],
  ],
  [
    "Compare expected journeys with what actually happened",
    ["DOCUMENT_FLOW_INFERENCE"],
  ],
  [
    "Have Tellann set up and check instrumentation for you",
    ["AUTOMATED_INSTRUMENTATION"],
  ],
  [
    "Review QA work together in a shared workspace",
    ["TEAM_COLLABORATION", "SHARED_DASHBOARDS"],
  ],
  [
    "Control who can access and change each application",
    ["RBAC", "APPLICATION_PERMISSIONS"],
  ],
  [
    "Connect your tools and track important account changes",
    ["API_ACCESS", "AUDIT_LOGS"],
  ],
  [
    "Use company sign-in and host Tellann in your own environment",
    ["SSO", "SELF_HOSTING"],
  ],
] as const;

function planIncludesAllFeatures(
  plan: PlanDefinition,
  requiredFeatures: readonly string[],
) {
  const enabledFeatures = new Set<string>(
    plan.features
      .filter((feature) => feature.enabled)
      .map((feature) => feature.feature),
  );
  return requiredFeatures.every((feature) => enabledFeatures.has(feature));
}

function formatMoney(cents: number | null, currency: "USD" | "NGN") {
  if (cents === null) return "Custom";
  return new Intl.NumberFormat(currency === "USD" ? "en-US" : "en-NG", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function planPrice(
  plan: PlanDefinition,
  billing: "monthly" | "annual",
  currency: "USD" | "NGN",
) {
  const effectiveCurrency = plan.ngnOnly ? "NGN" : currency;
  const total =
    billing === "monthly"
      ? effectiveCurrency === "NGN"
        ? plan.pricing.monthlyNgn
        : plan.pricing.monthlyUsd
      : effectiveCurrency === "NGN"
        ? plan.pricing.annualNgn
        : plan.pricing.annualUsd;
  if (billing === "annual" && total !== null && total > 0)
    return {
      value: formatMoney(Math.round(total / 12), effectiveCurrency),
      note: `${formatMoney(total, effectiveCurrency)} billed annually`,
    };
  return {
    value: formatMoney(total, effectiveCurrency),
    note:
      plan.type === "FREE"
        ? "Free forever"
        : plan.contactSales
          ? "Annual agreement"
          : "Billed monthly",
  };
}

function PlanCard({
  plan,
  billing,
  currency,
}: {
  plan: PlanDefinition;
  billing: "monthly" | "annual";
  currency: "USD" | "NGN";
}) {
  const price = planPrice(plan, billing, currency);
  const featured = plan.type === "SOLO" || plan.type === "TEAM";
  const href = plan.contactSales
    ? "/contact?plan=enterprise"
    : `${appUrl}/auth/login?plan=${plan.type.toLowerCase()}`;
  return (
    <article
      className={`pricing-plan-card pricing-plan-${plan.type.toLowerCase()}${featured ? " is-featured" : ""}`}
    >
      <div className="pricing-plan-top">
        <p>{plan.name}</p>
        {plan.type === "LOCAL" ? (
          <span>Nigeria only</span>
        ) : plan.type === "TEAM" ? (
          <span>For teams</span>
        ) : null}
      </div>
      <h3>
        {price.value}
        <small>{price.value !== "Custom" ? " / month" : ""}</small>
      </h3>
      <p className="pricing-price-note">{price.note}</p>
      <strong className="pricing-plan-audience">
        {plan.audience.slice(0, 2).join(" · ")}
      </strong>
      <p className="pricing-plan-copy">{plan.description}</p>
      <dl>
        <div>
          <dt>Applications</dt>
          <dd>
            {plan.limits.applications >= 9999
              ? "Custom"
              : plan.limits.applications}
          </dd>
        </div>
        <div>
          <dt>Users</dt>
          <dd>{plan.limits.users >= 9999 ? "Custom" : plan.limits.users}</dd>
        </div>
        <div>
          <dt>Storage</dt>
          <dd>
            {plan.limits.storageGb >= 9999
              ? "Custom"
              : `${plan.limits.storageGb} GB`}
          </dd>
        </div>
        <div>
          <dt>Retention</dt>
          <dd>
            {plan.limits.retentionDays >= 9999
              ? "Custom"
              : `${plan.limits.retentionDays} days`}
          </dd>
        </div>
      </dl>
      <ul>
        {plan.highlights.map((feature) => (
          <li key={feature}>✓ {feature}</li>
        ))}
        <li>✓ {plan.exportFormats.join(", ")} exports</li>
      </ul>
      {plan.type === "LOCAL" ? (
        <small className="pricing-local-note">
          Nigerian billing address required.
        </small>
      ) : null}
      <a href={href}>
        {plan.contactSales
          ? "Talk to sales"
          : plan.type === "FREE"
            ? "Start free"
            : `Choose ${plan.name}`}{" "}
        <span aria-hidden="true">→</span>
      </a>
    </article>
  );
}

export function PricingControls({ plans }: { plans: PlanDefinition[] }) {
  const [billing, setBilling] = useState<"monthly" | "annual">("monthly");
  const [currency, setCurrency] = useState<"USD" | "NGN">("USD");
  const [compareA, setCompareA] = useState<PlanTypeKey>("LOCAL");
  const [compareB, setCompareB] = useState<PlanTypeKey>("SOLO");
  const planA = plans.find((plan) => plan.type === compareA) ?? plans[1];
  const planB = plans.find((plan) => plan.type === compareB) ?? plans[2];

  return (
    <>
      <section className="pricing-controls" aria-label="Pricing controls">
        <div>
          <span>Billing</span>
          <button
            type="button"
            className={billing === "monthly" ? "is-active" : ""}
            onClick={() => setBilling("monthly")}
          >
            Monthly
          </button>
          <button
            type="button"
            className={billing === "annual" ? "is-active" : ""}
            onClick={() => setBilling("annual")}
          >
            Annual
          </button>
        </div>
        <div>
          <span>Currency</span>
          <button
            type="button"
            className={currency === "USD" ? "is-active" : ""}
            onClick={() => setCurrency("USD")}
          >
            USD
          </button>
          <button
            type="button"
            className={currency === "NGN" ? "is-active" : ""}
            onClick={() => setCurrency("NGN")}
          >
            NGN
          </button>
        </div>
      </section>
      <section className="pricing-plans" aria-labelledby="plans-heading">
        <div className="pricing-tier-heading">
          <p>For individuals</p>
          <h2 id="plans-heading">Start focused.</h2>
        </div>
        <div className="pricing-plan-grid pricing-individual-grid">
          {plans.slice(0, 3).map((plan) => (
            <PlanCard
              key={plan.type}
              plan={plan}
              billing={billing}
              currency={currency}
            />
          ))}
        </div>
        <div className="pricing-tier-heading">
          <p>For teams</p>
          <h2>Scale with control.</h2>
        </div>
        <div className="pricing-plan-grid pricing-team-grid">
          {plans.slice(3).map((plan) => (
            <PlanCard
              key={plan.type}
              plan={plan}
              billing={billing}
              currency={currency}
            />
          ))}
        </div>
      </section>
      <section
        className="pricing-comparison"
        aria-labelledby="comparison-heading"
      >
        <div className="pricing-section-heading">
          <p>Compare capabilities</p>
          <h2 id="comparison-heading">See where each plan unlocks more.</h2>
        </div>
        <div className="pricing-compare-selectors">
          <label>
            Plan A
            <Select
              value={compareA}
              onValueChange={(value) => setCompareA(value as PlanTypeKey)}
            >
              <SelectTrigger id="compare-plan-a">
                <SelectValue placeholder="Choose plan A">
                  {planA.name}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {plans.map((plan) => (
                    <SelectItem key={plan.type} value={plan.type}>
                      {plan.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </label>
          <label>
            Plan B
            <Select
              value={compareB}
              onValueChange={(value) => setCompareB(value as PlanTypeKey)}
            >
              <SelectTrigger id="compare-plan-b">
                <SelectValue placeholder="Choose plan B">
                  {planB.name}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {plans.map((plan) => (
                    <SelectItem key={plan.type} value={plan.type}>
                      {plan.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </label>
        </div>
        <div className="pricing-compare-table">
          <div className="pricing-compare-head">
            <span>What Tellann helps you do</span>
            <strong>{planA.name}</strong>
            <strong>{planB.name}</strong>
          </div>
          {comparisonRows.map(([label, requiredFeatures]) => (
            <div key={label}>
              <span>{label}</span>
              <b>{planIncludesAllFeatures(planA, requiredFeatures) ? "✓" : "—"}</b>
              <b>{planIncludesAllFeatures(planB, requiredFeatures) ? "✓" : "—"}</b>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
