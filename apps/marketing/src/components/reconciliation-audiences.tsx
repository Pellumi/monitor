"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { ProductPlaceholder } from "@/components/product-tour";

type AudienceId = "DEVELOPER" | "QA" | "ENGINEERING_LEADER" | "PRODUCT";

type PanelGroup = {
  label: string;
  /** Glyph carries the meaning alongside the label — never colour alone. */
  glyph?: string;
  muted?: boolean;
  items: string[];
};

type ReconciliationAudience = {
  id: AudienceId;
  tab: string;
  headline: string;
  painPoint: string;
  benefits: { title: string; copy: string }[];
  stats?: [string, string][];
  groups: PanelGroup[];
  visual: { label: string; master: string; display: string };
  relatedHref: string;
  relatedLabel: string;
};

/* One data model, one renderer — persona messaging stays easy to edit. */
const audiences: ReconciliationAudience[] = [
  {
    id: "DEVELOPER",
    tab: "Developers",
    headline: "Know when implementation differs from intent.",
    painPoint:
      "A successful happy path does not tell you whether every intended branch can actually be reached.",
    benefits: [
      {
        title: "Find expected behavior that never appeared.",
        copy: "See the states and transitions your team expected but the demonstration never reached.",
      },
      {
        title: "Spot unexpected behavior.",
        copy: "Surface observed behavior that was never part of the intended workflow.",
      },
      {
        title: "Jump from a result to its evidence.",
        copy: "Move into the behavior graph, session, or replay instead of reproducing behavior from scratch.",
      },
      {
        title: "Separate implementation from specification.",
        copy: "Undeclared behavior might be unexpected code — or intent nobody wrote down.",
      },
    ],
    groups: [
      {
        label: "Expected",
        glyph: "·",
        items: ["Checkout", "Success", "Payment failure", "Retry"],
      },
      { label: "Observed", glyph: "·", items: ["Checkout", "Success"] },
      {
        label: "Tellann",
        glyph: "○",
        muted: true,
        items: ["Payment failure — True gap", "Retry — True gap"],
      },
    ],
    visual: {
      label: "Declared graph beside observed graph with a selected true gap / product UI design",
      master: "1600 × 900",
      display: "900 × 506",
    },
    relatedHref: "/product/behavior-graphs",
    relatedLabel: "See states, actions, and transitions in behavior graphs",
  },
  {
    id: "QA",
    tab: "QA engineers",
    headline: "Know exactly which expected scenarios still lack evidence.",
    painPoint:
      "“Did we remember to test everything?” is hard to answer. “Which expected paths have behavioral evidence?” is not.",
    benefits: [
      {
        title: "Turn requirements into an evidence baseline.",
        copy: "Every expected path either has behavioral evidence behind it or it does not.",
      },
      {
        title: "Tell an explicit gap from an inferred one.",
        copy: "A suggested missing state is worth considering. A true gap is behavior your team said should be reachable.",
      },
      {
        title: "Prioritize the next demonstration.",
        copy: "The true-gap list is already the checklist for your next walkthrough.",
      },
      {
        title: "Stop comparing by hand.",
        copy: "No more reading a QA plan beside a walkthrough summary to work out what is left.",
      },
    ],
    stats: [
      ["Confirmed", "11"],
      ["True gaps", "3"],
      ["Undeclared", "2"],
    ],
    groups: [
      {
        label: "Confirmed",
        glyph: "✓",
        items: ["Add to cart", "Checkout", "Payment success"],
      },
      {
        label: "True gaps",
        glyph: "○",
        muted: true,
        items: ["Payment failure", "Session timeout", "Retry payment"],
      },
      {
        label: "Undeclared",
        glyph: "+",
        items: ["Promo rejected", "Cart merge"],
      },
    ],
    visual: {
      label: "Checkout reconciliation checklist / product UI design",
      master: "1440 × 900",
      display: "800 × 500",
    },
    relatedHref: "/product/coverage",
    relatedLabel: "Explore behavioral coverage",
  },
  {
    id: "ENGINEERING_LEADER",
    tab: "Engineering leaders",
    headline: "Get a clearer view of pre-production quality risk.",
    painPoint:
      "Before shipping, you want to know whether the declared workflows that matter were actually exercised during QA.",
    benefits: [
      {
        title: "Get an overview without opening raw sessions.",
        copy: "One summary per workflow: declared, confirmed, still unresolved.",
      },
      {
        title: "Find critical workflows with unresolved behavior.",
        copy: "Expected behavior with no evidence behind it is the part worth asking about.",
      },
      {
        title: "See where QA effort should go next.",
        copy: "The unresolved list is a plan, not a verdict.",
      },
      {
        title: "Ask a better release question.",
        copy: "Not “did QA finish?” but “which declared Checkout behaviors still have no evidence?”",
      },
    ],
    stats: [
      ["Declared", "14"],
      ["Confirmed", "11"],
      ["True gaps", "3"],
      ["Undeclared", "2"],
    ],
    groups: [
      {
        label: "Needs review",
        glyph: "○",
        muted: true,
        items: ["Payment failure", "Session timeout", "Retry payment"],
      },
    ],
    visual: {
      label: "Checkout reconciliation summary / product UI design",
      master: "1400 × 850",
      display: "800 × 486",
    },
    relatedHref: "/product/qa-reports",
    relatedLabel: "Generate behavioral QA reports",
  },
  {
    id: "PRODUCT",
    tab: "Product teams",
    headline: "Verify that implemented behavior still matches product intent.",
    painPoint:
      "Requirements describe what the product should do. Reconciliation shows which parts of that have been demonstrated — and what happened that nobody specified.",
    benefits: [
      {
        title: "Make intended product behavior explicit.",
        copy: "Purchase, fail payment gracefully, retry, cancel — written down as behavior, not prose.",
      },
      {
        title: "Discover behavior nobody specified.",
        copy: "Undeclared behavior is the most interesting column on the page for a product team.",
      },
      {
        title: "Keep intent and implementation connected.",
        copy: "When requirements change, the declared baseline changes with them.",
      },
      {
        title: "Decide what becomes expected behavior.",
        copy: "Observed-but-undeclared behavior can be promoted into intent — with your confirmation.",
      },
    ],
    stats: [
      ["Observed", "4 times"],
      ["Workflow", "Checkout"],
    ],
    groups: [
      { label: "Undeclared", glyph: "+", items: ["Promo code rejected"] },
      {
        label: "Worth asking",
        glyph: "·",
        muted: true,
        items: [
          "Is this expected?",
          "Did requirements miss it?",
          "Should it become part of the flow?",
        ],
      },
    ],
    visual: {
      label: "Undeclared behavior review / product UI design",
      master: "1400 × 850",
      display: "800 × 486",
    },
    relatedHref: "/product/flow-declaration",
    relatedLabel: "Declare expected application workflows",
  },
];

export function ReconciliationAudiences() {
  const [activeId, setActiveId] = useState<AudienceId>("QA");
  const selectId = useId();
  const active = audiences.find((item) => item.id === activeId)!;

  return (
    <div className="recon-persona">
      <div
        className="recon-persona-tabs"
        role="tablist"
        aria-label="Reconciliation benefits by role"
      >
        {audiences.map((audience) => (
          <button
            key={audience.id}
            type="button"
            role="tab"
            id={`recon-tab-${audience.id}`}
            aria-selected={activeId === audience.id}
            aria-controls="recon-persona-panel"
            className={activeId === audience.id ? "is-active" : ""}
            onClick={() => setActiveId(audience.id)}
          >
            {audience.tab}
          </button>
        ))}
      </div>

      <div className="recon-persona-select">
        <label htmlFor={selectId}>Who are you?</label>
        <select
          id={selectId}
          value={activeId}
          onChange={(event) => setActiveId(event.target.value as AudienceId)}
        >
          {audiences.map((audience) => (
            <option key={audience.id} value={audience.id}>
              {audience.tab}
            </option>
          ))}
        </select>
      </div>

      <div
        className="recon-persona-body"
        id="recon-persona-panel"
        role="tabpanel"
        aria-labelledby={`recon-tab-${active.id}`}
        key={active.id}
      >
        <div className="recon-persona-copy">
          <h3>{active.headline}</h3>
          <p className="recon-persona-pain">{active.painPoint}</p>
          <dl className="recon-benefit-list">
            {active.benefits.map((benefit) => (
              <div key={benefit.title}>
                <dt>{benefit.title}</dt>
                <dd>{benefit.copy}</dd>
              </div>
            ))}
          </dl>
          <Link href={active.relatedHref} className="recon-inline-link">
            {active.relatedLabel} <span>→</span>
          </Link>
        </div>

        <div className="recon-persona-visual">
          <ProductPlaceholder
            label={active.visual.label}
            dimensions={active.visual.master}
            displayDimensions={active.visual.display}
          />
          <div className="recon-persona-panel-detail">
            {active.stats ? (
              <div className="recon-stat-row">
                {active.stats.map(([label, value]) => (
                  <span key={label}>
                    <small>{label}</small>
                    <b>{value}</b>
                  </span>
                ))}
              </div>
            ) : null}
            <div className="recon-group-row">
              {active.groups.map((group) => (
                <div key={group.label}>
                  <p className="recon-panel-label">{group.label}</p>
                  <ul className={group.muted ? "is-muted" : ""}>
                    {group.items.map((item) => (
                      <li key={item}>
                        {group.glyph ? (
                          <i aria-hidden="true">{group.glyph}</i>
                        ) : null}
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
