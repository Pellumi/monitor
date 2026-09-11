import type { Metadata } from "next";
import Link from "next/link";
import type { CSSProperties } from "react";
import { MissingStateExplorer } from "@/components/missing-state-explorer";
import { ProductPlaceholder } from "@/components/product-tour";
import "./missing-states.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://domain-name.com";
const dashboardUrl =
  process.env.NEXT_PUBLIC_APP_URL || "https://app.domain-name.com";

export const metadata: Metadata = {
  title:
    "Missing State Detection — Find Unobserved Application States | Tellann",
  description:
    "See how Tellann identifies potential loading, empty, error, and recovery states that were not observed during application demonstrations, explains why they were surfaced, and connects them to workflows and behavioral coverage.",
  alternates: { canonical: "/product/missing-states" },
  openGraph: {
    title:
      "Missing State Detection — Find Unobserved Application States | Tellann",
    description:
      "Surface the loading, empty, error, and recovery conditions your demonstration never reached.",
    url: `${siteUrl}/product/missing-states`,
    type: "website",
  },
};

type Visual = { label: string; master: string; display: string };

function VisualPlaceholder({ label, master, display }: Visual) {
  return (
    <ProductPlaceholder
      label={label}
      dimensions={master}
      displayDimensions={display}
    />
  );
}

const vocabulary: [string, string][] = [
  ["Observed", "Behavioral evidence exists for this state."],
  [
    "Unobserved",
    "The state exists in the selected model, but no selected session reached it.",
  ],
  [
    "Potential missing state",
    "Tellann inferred or expected a relevant state that has not been observed.",
  ],
  [
    "Failed state",
    "The state was actually observed and represents a failure condition.",
  ],
];

const categories: [string, string, string, string][] = [
  [
    "Loading",
    "What exists while work is in progress?",
    "CHECKOUT_LOADING",
    "REQUEST_RESPONSE_GAP",
  ],
  [
    "Empty",
    "What happens when useful content is absent?",
    "EMPTY_CART",
    "POPULATED_TO_EMPTY",
  ],
  [
    "Error",
    "What happens when something fails?",
    "AUTHENTICATION_ERROR",
    "SUCCESS_TO_FAILURE",
  ],
  [
    "Recovery",
    "What state allows the user or system to recover?",
    "RETRY_PAYMENT",
    "FAILURE_TO_RECOVERY",
  ],
];

const ruleMatrix: [string, string, string, string][] = [
  ["Success", "Failure", "LOGIN_SUCCESS", "LOGIN_FAILURE"],
  ["Populated", "Empty", "PRODUCT_SEARCH", "EMPTY_SEARCH_RESULT"],
  ["Valid", "Invalid", "FORM_SUBMITTED", "INVALID_FORM_DATA"],
  ["Response", "Timeout", "API_RESPONSE", "API_TIMEOUT"],
];

const stateVsFlow: [string, string, string][] = [
  ["Unit", "One meaningful condition", "Sequence of conditions and transitions"],
  [
    "Example",
    "PAYMENT_FAILURE",
    "Checkout → Payment failure → Retry payment",
  ],
  [
    "Question",
    "Was this condition ever reached?",
    "Was this path ever exercised?",
  ],
  ["Graph form", "Usually a node", "Multiple nodes and edges"],
  ["Related coverage", "State coverage", "Workflow and path coverage"],
];

const dispositions: [string, string][] = [
  ["State exists", "but was never demonstrated."],
  ["State should exist", "but may not be implemented."],
  ["State is not applicable", "to this application."],
];

const reportGroups: [string, string[]][] = [
  ["Loading", ["CHECKOUT_LOADING"]],
  ["Empty", ["EMPTY_CART", "NO_RESULTS"]],
  ["Error", ["PAYMENT_FAILURE", "AUTHENTICATION_ERROR"]],
  ["Recovery", ["RETRY_PAYMENT"]],
];

const notMeanings: string[] = [
  "the application is broken",
  "the state is required by the specification",
  "the state can actually occur",
  "the developer forgot to implement something",
  "a test has failed",
  "Tellann has proven a defect exists",
];

const faqs: [string, string][] = [
  [
    "What is a missing state?",
    "A missing state is a meaningful application condition—loading, empty, error, or recovery—that Tellann expected or inferred from the observed behavior but did not see reached in the selected demonstrations.",
  ],
  [
    "How does Tellann identify missing states?",
    "Detection runs in the Coverage Analysis Engine. Tellann extracts the observed states from reconstructed sessions, builds the workflow and graph around them, then applies explicit behavioral rules to propose complementary conditions.",
  ],
  [
    "What is the difference between an unobserved state and a missing state?",
    "An unobserved state already exists in the selected model but no session reached it. A potential missing state is one Tellann inferred from a rule because a related condition was observed.",
  ],
  [
    "What types of states can Tellann detect?",
    "Phase 1 organizes detection around loading, empty, error, and recovery states.",
  ],
  [
    "What is a loading state?",
    "A loading state is what exists while work is in progress—the condition between a request being issued and its result arriving, such as CHECKOUT_LOADING or SEARCH_LOADING.",
  ],
  [
    "What is an empty state?",
    "An empty state is what the application shows when there is no useful content: an empty cart, no search results, or no notifications.",
  ],
  [
    "What is an error state?",
    "An error state is the condition reached when something fails—a 404, a 500, a validation error, or an authentication error.",
  ],
  [
    "What is a recovery state?",
    "A recovery state lets the user or system continue after a failure, such as retry payment, retry upload, or retry submission. It is often the condition teams forget to demonstrate.",
  ],
  [
    "Does a missing state mean my application has a bug?",
    "No. It means the condition was not observed in the selected evidence. That is a question worth answering, not a defect report.",
  ],
  [
    "How is a missing state different from a missing flow?",
    "A state is a single condition; a flow is a sequence. PAYMENT_FAILURE is a state. Checkout → Payment failure → Retry payment is a flow.",
  ],
  [
    "Does Tellann use AI to identify missing states?",
    "No. Phase 1 is built on explainable, rule-based detection rather than machine learning or autonomous AI.",
  ],
  [
    "Can I see why a state was suggested?",
    "Yes. Every finding reports its detection basis, the specific rule that fired, and the observed behavior that supported the suggestion.",
  ],
  [
    "Can I dismiss a state that does not apply?",
    "Yes. Findings can be marked demonstrated, not applicable, or dismissed, and a not-applicable finding can record why so the model stays useful.",
  ],
  [
    "Can I demonstrate a missing state later?",
    "Yes. A finding leads into Demonstration Mode with the workflow and target state already in context.",
  ],
  [
    "Will demonstrating a missing state change coverage?",
    "Yes. Once the condition is observed it becomes part of the behavioral model, and state coverage is recalculated against that updated model.",
  ],
  [
    "Can I inspect sessions related to a missing state?",
    "A missing state has no replay of its own—it was never observed. What you can open is the surrounding evidence: the sessions containing the related observed state that triggered the suggestion.",
  ],
  [
    "Can missing states involve backend or API behavior?",
    "Yes. Captured request, response, latency, and error metadata provides context, so states tied to a 4xx, 5xx, or timeout outcome can be proposed with a stated basis.",
  ],
  [
    "Does Tellann automatically create tests for missing states?",
    "No. Generated edge-case tests and automated validation are excluded from Phase 1 and belong to later phases.",
  ],
];

function MediaSection({
  eyebrow,
  title,
  copy,
  visual,
  note,
  surface = false,
  id,
  children,
}: {
  eyebrow: string;
  title: string;
  copy: string;
  visual: Visual;
  note?: string;
  surface?: boolean;
  id?: string;
  children?: React.ReactNode;
}) {
  return (
    <section
      className={`states-media-section${surface ? " is-surface" : ""}`}
      id={id}
    >
      <div className="states-shell states-heading">
        <p className="states-kicker" data-aos="fade-up">{eyebrow}</p>
        <h2 data-aos="fade-up" data-aos-delay="60">{title}</h2>
        <p data-aos="fade-up" data-aos-delay="120">{copy}</p>
      </div>
      {children ? (
        <div className="states-shell states-section-detail">{children}</div>
      ) : null}
      <div className="states-contained-media">
        <VisualPlaceholder {...visual} />
        {note ? <p>{note}</p> : null}
      </div>
    </section>
  );
}

function AsideSection({
  eyebrow,
  title,
  copy,
  visual,
  mediaWidth,
  reverse = false,
  surface = false,
  id,
  children,
}: {
  eyebrow: string;
  title: string;
  copy: string;
  visual: Visual;
  mediaWidth: number;
  reverse?: boolean;
  surface?: boolean;
  id?: string;
  children?: React.ReactNode;
}) {
  return (
    <section
      className={`states-aside-section${reverse ? " is-reverse" : ""}${
        surface ? " is-surface" : ""
      }`}
      id={id}
    >
      <div className="states-shell states-heading">
        <p className="states-kicker" data-aos="fade-up">{eyebrow}</p>
        <h2 data-aos="fade-up" data-aos-delay="60">{title}</h2>
        <p data-aos="fade-up" data-aos-delay="120">{copy}</p>
      </div>
      <div className="states-shell states-aside-grid" data-aos="tellann-panel"
        style={{ "--media-w": `${mediaWidth}px` } as CSSProperties}
      >
        <VisualPlaceholder {...visual} />
        <div className="states-aside-panel">{children}</div>
      </div>
    </section>
  );
}

export default function MissingStatesPage() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Tellann Missing State Detection",
    description: metadata.description,
    url: `${siteUrl}/product/missing-states`,
  };

  return (
    <main className="states-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      <section className="states-hero pt-20!">
        <div className="states-shell states-hero-copy">
          <p className="states-kicker" data-aos="fade-up">Missing state detection</p>
          <h1 data-aos="fade-up" data-aos-delay="60">See the application states your demonstration never reached.</h1>
          <p data-aos="fade-up" data-aos-delay="120">
            Tellann analyzes demonstrated behavior to surface meaningful
            loading, empty, error, and recovery states that were not
            observed—then shows where those states belong in your workflow and
            why they deserve attention.
          </p>
          <div className="states-actions">
            <a className="is-primary" href="#explorer">
              Explore missing states <span>↓</span>
            </a>
            <a href="#detection">
              See how detection works <span>↓</span>
            </a>
            <Link href="/product/missing-flows">
              Explore Missing Flows <span>→</span>
            </Link>
          </div>
        </div>
        <div className="states-shell-wide states-hero-media states-desktop-media" data-aos="tellann-panel">
          <VisualPlaceholder
            label="Hero missing-state graph / observed search path expanding into potential states"
            master="1920 × 1120"
            display="1320 × 760"
          />
          <p>
            Master 1920 × 1120 px · Desktop display 1320 × 760 px · 8–10 second
            reveal, then interactive · Solid = observed, dashed = potential
            state not observed
          </p>
        </div>
        <div className="states-mobile-media">
          <VisualPlaceholder
            label="Mobile missing-state graph / search, loading, results, empty and retry"
            master="1080 × 1350"
            display="1080 × 1350"
          />
          <p>
            Mobile master 1080 × 1350 px (4:5) · Displayed responsively ·
            Simplified to a single workflow branch
          </p>
        </div>
      </section>

      <section className="states-definition">
        <div className="states-shell states-heading">
          <p className="states-kicker" data-aos="fade-up">What a missing state is</p>
          <h2 data-aos="fade-up" data-aos-delay="60">
            A missing state is a meaningful application condition Tellann
            expected or inferred but did not observe.
          </h2>
          <p data-aos="fade-up" data-aos-delay="120">
            The states you never see are often the states that expose how
            resilient your software really is. A workflow can look entirely
            successful while never exercising its loading, empty, error, or
            recovery conditions.
          </p>
        </div>
        <div className="states-shell states-examples">
          {[
            "CHECKOUT_LOADING",
            "EMPTY_CART",
            "NO_RESULTS",
            "AUTHENTICATION_ERROR",
            "PAYMENT_FAILURE",
            "RETRY_PAYMENT",
          ].map((state) => (
            <span key={state}>{state}</span>
          ))}
        </div>
        <div className="states-shell states-vocabulary">
          <p className="states-kicker" data-aos="fade-up">Status vocabulary</p>
          <dl>
            {vocabulary.map(([term, meaning]) => (
              <div key={term}>
                <dt>{term}</dt>
                <dd>{meaning}</dd>
              </div>
            ))}
          </dl>
          <div className="states-rules">
            {[
              "Unobserved ≠ failed",
              "Missing ≠ broken",
              "Suggested ≠ required",
              "Not demonstrated ≠ impossible",
            ].map((rule) => (
              <span key={rule}>{rule}</span>
            ))}
          </div>
        </div>
      </section>

      <MediaSection
        surface
        eyebrow="Observed vs missing"
        title="What worked tells you only one side of the application."
        copy="A successful demonstration establishes one condition per decision point. The complementary conditions around it stay unexercised until someone goes looking for them."
        note="Master 1600 × 850 px · Display 1000 × 531 px · Observed column solid, potential column dashed"
        visual={{
          label: "Observed states beside potential states / SVG design",
          master: "1600 × 850",
          display: "1000 × 531",
        }}
      >
        <div className="states-compare-pair">
          <div>
            <p className="states-panel-label">Observed</p>
            <div className="states-chain">
              <b>SEARCH</b>
              <b>SEARCH_RESULTS</b>
            </div>
          </div>
          <div>
            <p className="states-panel-label">Potential states</p>
            <div className="states-chain is-gap">
              <b>SEARCH_LOADING</b>
              <b>NO_RESULTS</b>
              <b>SEARCH_ERROR</b>
              <b>RETRY_SEARCH</b>
            </div>
          </div>
        </div>
      </MediaSection>

      <MediaSection
        eyebrow="How detection works"
        title="Missing states emerge from the behavioral model around what you observed."
        copy="Detection never invents a condition out of nowhere. It reads the states and transitions the demonstration produced, then asks which complementary conditions the structure implies."
        note="Master 1800 × 1000 px · Display 1100 × 611 px · 7–8 second sequence · Session, observed states, workflow, pattern, potential state, finding"
        id="detection"
        visual={{
          label: "Missing-state detection pipeline / animated SVG design",
          master: "1800 × 1000",
          display: "1100 × 611",
        }}
      >
        <div className="states-pipeline">
          {[
            "Demonstration",
            "Session",
            "Observed states",
            "Transitions",
            "Workflow",
            "Behavior Graph",
            "Coverage analysis",
            "State rules",
            "Potential missing states",
          ].map((step, index, list) => (
            <span key={step}>
              <small>{String(index + 1).padStart(2, "0")}</small>
              <b>{step}</b>
              {index < list.length - 1 ? <i aria-hidden="true">↓</i> : null}
            </span>
          ))}
        </div>
        <div>
          <p className="states-panel-copy">
            Because the analysis sits on the same model that Workflow Discovery
            produced, a proposed state always has a place to attach in the
            graph—between two observed conditions, or branching from one.
          </p>
          <Link
            href="/product/workflow-discovery"
            className="states-inline-link"
          >
            Explore Workflow Discovery <span>→</span>
          </Link>
        </div>
      </MediaSection>

      <section className="states-taxonomy">
        <div className="states-shell states-heading">
          <p className="states-kicker" data-aos="fade-up">State taxonomy</p>
          <h2 data-aos="fade-up" data-aos-delay="60">Four kinds of condition worth checking.</h2>
          <p data-aos="fade-up" data-aos-delay="120">
            Grouping findings by condition type keeps a list of gaps readable.
            Loading, empty, error, and recovery each ask a different question
            about the same workflow.
          </p>
        </div>
        <div className="states-shell states-category-cards" data-aos="tellann-panel">
          {categories.map(([title, question, example, rule]) => (
            <article key={title}>
              <span>{title}</span>
              <p>{question}</p>
              <div>
                <small>Example</small>
                <b>{example}</b>
                <small>Rule</small>
                <b>{rule}</b>
              </div>
              <ProductPlaceholder
                label={`${title} state / miniature state graph`}
                dimensions="1020 × 280"
                displayDimensions="510 × 140"
              />
            </article>
          ))}
        </div>
        <p className="states-shell states-note">
          <b>On security states:</b> the QA reporting taxonomy anticipates a
          security-state category. It stays out of this page until the
          implemented detection model explicitly supports it.
        </p>
      </section>

      <AsideSection
        eyebrow="Loading states"
        title="What does the user see while the application is waiting?"
        copy="A demonstration that jumps from action to result skips the condition in between. The structural gap between a request and its response is where a loading state belongs."
        mediaWidth={900}
        visual={{
          label: "Missing loading state / animated SVG design",
          master: "1500 × 850",
          display: "900 × 510",
        }}
      >
        <p className="states-panel-label">Observed</p>
        <div className="states-chain">
          <b>SEARCH</b>
          <b>SEARCH_RESULTS</b>
        </div>
        <p className="states-panel-label">Potential missing state</p>
        <div className="states-chain is-gap">
          <b>SEARCH_LOADING</b>
        </div>
        <ul className="states-example-list" data-aos="tellann-panel">
          {["PRODUCT_LOADING", "CHECKOUT_LOADING", "SEARCH_LOADING"].map(
            (item) => (
              <li key={item}>{item}</li>
            ),
          )}
        </ul>
      </AsideSection>

      <AsideSection
        reverse
        surface
        eyebrow="Empty states"
        title="What happens when there is nothing to show?"
        copy="A populated result is one half of a decision point. If only the populated condition was demonstrated, the empty counterpart is worth surfacing."
        mediaWidth={900}
        visual={{
          label: "Missing empty state / animated SVG design",
          master: "1500 × 850",
          display: "900 × 510",
        }}
      >
        <p className="states-panel-label">Observed</p>
        <div className="states-chain">
          <b>SEARCH_RESULTS</b>
          <b>RESULTS_FOUND</b>
        </div>
        <p className="states-panel-label">Potential missing state</p>
        <div className="states-chain is-gap">
          <b>NO_RESULTS</b>
        </div>
        <ul className="states-example-list" data-aos="tellann-panel">
          {["EMPTY_CART", "NO_SEARCH_RESULTS", "NO_NOTIFICATIONS"].map(
            (item) => (
              <li key={item}>{item}</li>
            ),
          )}
        </ul>
      </AsideSection>

      <AsideSection
        eyebrow="Error states"
        title="What happens when the expected action fails?"
        copy="Error conditions are presented as product states, not alarms. A finding names the condition and its status—nothing more dramatic than that."
        mediaWidth={900}
        visual={{
          label: "Missing error state / SVG or product UI design",
          master: "1500 × 850",
          display: "900 × 510",
        }}
      >
        <div className="states-finding-card">
          <span>Error state</span>
          <b>AUTHENTICATION_ERROR</b>
          <dl>
            {[
              ["Status", "Not observed"],
              ["Related observed state", "AUTHENTICATED"],
              ["Rule", "SUCCESS_TO_FAILURE"],
            ].map(([term, value]) => (
              <div key={term}>
                <dt>{term}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </div>
        <ul className="states-example-list" data-aos="tellann-panel">
          {["404", "500", "VALIDATION_ERROR", "AUTHENTICATION_ERROR"].map(
            (item) => (
              <li key={item}>{item}</li>
            ),
          )}
        </ul>
      </AsideSection>

      <MediaSection
        surface
        eyebrow="Recovery states"
        title="After failure, can the workflow recover?"
        copy="A failure state with no outgoing observed transition is a dead end in the graph. The condition that leads back into the workflow is a state-design question, not just an error to log."
        note="Master 1600 × 900 px · Display 1000 × 562 px · Failure state, dead end highlighted, recovery node connects back"
        visual={{
          label: "Missing recovery state / animated SVG design",
          master: "1600 × 900",
          display: "1000 × 562",
        }}
      >
        <div>
          <p className="states-panel-label">Potential recovery path</p>
          <div className="states-chain is-gap">
            <b>PAYMENT_FAILURE</b>
            <b>RETRY_PAYMENT</b>
            <b>PAYMENT_SUCCESS</b>
          </div>
        </div>
        <div>
          <p className="states-panel-label">Examples</p>
          <ul className="states-example-list" data-aos="tellann-panel">
            {["RETRY_PAYMENT", "RETRY_UPLOAD", "RETRY_SUBMISSION"].map(
              (item) => (
                <li key={item}>{item}</li>
              ),
            )}
          </ul>
          <p className="states-panel-copy">
            Many QA walkthroughs validate that a failure appears and stop there.
            Whether the user can get back on track is the part that usually goes
            undemonstrated.
          </p>
        </div>
      </MediaSection>

      <MediaSection
        eyebrow="Rule-based detection"
        title="Phase 1 uses explainable rules—not opaque AI guesses."
        copy="Detection is required to work without machine learning or artificial intelligence. Each observed condition on the left produces a proposed counterpart on the right."
        note="Master 1600 × 900 px · Display 1000 × 562 px · 5–6 second sequence · Arrows appear one at a time"
        visual={{
          label: "Observed-to-proposed rule matrix / animated SVG design",
          master: "1600 × 900",
          display: "1000 × 562",
        }}
      >
        <div
          className="states-matrix"
          role="table"
          aria-label="Observed condition transformed into the condition to check for"
        >
          <div role="row" className="is-head">
            <span role="columnheader">Observed</span>
            <span role="columnheader">Check for</span>
          </div>
          {ruleMatrix.map(([left, right, from, to]) => (
            <div role="row" key={from}>
              <span role="cell">
                <small>{left}</small>
                <b>{from}</b>
              </span>
              <span role="cell">
                <small>{right}</small>
                <b>{to}</b>
              </span>
            </div>
          ))}
        </div>
        <p className="states-note">
          <b>The credible claim:</b> not that AI knows every state your app
          forgot, but that Tellann applies explainable behavioral rules to what
          was demonstrated and surfaces states worth checking—so findings can be
          inspected, challenged, dismissed, or demonstrated.
        </p>
      </MediaSection>

      <section className="states-explorer-section" id="explorer">
        <div className="states-shell states-heading">
          <p className="states-kicker" data-aos="fade-up">Interactive missing-state explorer</p>
          <h2 data-aos="fade-up" data-aos-delay="60">Inspect missing states where they belong in the workflow.</h2>
          <p data-aos="fade-up" data-aos-delay="120">
            Choose a workflow, filter by condition type and status, and open any
            finding to see the rule that produced it. Mark a state demonstrated,
            not applicable, or dismissed—and record why when it does not apply.
            The graph canvas remains a dimension-accurate placeholder for the
            final renderer.
          </p>
        </div>
        <div className="states-shell-wide" data-aos="tellann-panel">
          <MissingStateExplorer />
        </div>
        <p className="states-shell states-note">
          <b>Graph or list:</b> observed, potential, error, and recovery are
          carried by label and shape, never by colour alone, and every finding
          is reachable as text.
        </p>
      </section>

      <AsideSection
        reverse
        eyebrow="Why Tellann flagged this"
        title="A finding should explain itself."
        copy="An explainable rule engine is only trustworthy if each suggestion can show its reasoning. Every finding names the workflow, the observed neighbour, and the rule that fired."
        mediaWidth={720}
        visual={{
          label: "Why-flagged inspector panel / product UI design",
          master: "1200 × 800",
          display: "720 × 480",
        }}
      >
        <div className="states-reason-card">
          <b>PAYMENT_FAILURE</b>
          <p className="states-panel-label">Why this appears</p>
          <ol className="states-reason-steps">
            {[
              "Checkout workflow was discovered.",
              "PAYMENT_SUCCESS was observed.",
              "The Success → Failure rule applies.",
              "PAYMENT_FAILURE was not observed in the selected demonstrations.",
            ].map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <dl>
            <div>
              <dt>Result</dt>
              <dd>Potential missing error state</dd>
            </div>
            <div>
              <dt>Detection type</dt>
              <dd>Rule-based</dd>
            </div>
            <div>
              <dt>Rule</dt>
              <dd>SUCCESS_TO_FAILURE</dd>
            </div>
          </dl>
        </div>
        <p className="states-panel-copy">
          Tellann reports the rule that fired rather than a fabricated
          confidence percentage. A stated rule can be argued with; a number with
          no model behind it cannot.
        </p>
      </AsideSection>

      <MediaSection
        surface
        eyebrow="Missing states on the Behavior Graph"
        title="A missing state becomes easier to understand when you can see its neighbors."
        copy="A proposed condition sits in the same graph as the observed ones, using the same renderer and the same visual language as every other Tellann surface."
        note="Master 1920 × 1200 px · Display 1000 × 625 px · 7–9 second loop · Open graph, enable missing states, select a node, expand why it was flagged"
        visual={{
          label: "Behavior Graph missing-state overlay / product recording",
          master: "1920 × 1200",
          display: "1000 × 625",
        }}
      >
        <div className="states-legend">
          {[
            ["●", "Solid node", "Observed state"],
            ["○", "Dashed node", "Potential state not observed"],
            ["━", "Solid edge", "Observed transition"],
            ["┄", "Dashed edge", "Potential transition"],
          ].map(([glyph, term, meaning]) => (
            <span key={term}>
              <i aria-hidden="true">{glyph}</i>
              <b>{term}</b>
              <small>{meaning}</small>
            </span>
          ))}
        </div>
        <div>
          <p className="states-panel-copy">
            This page does not introduce a separate graph language. A missing
            state is the same model with an analysis overlay on top of it.
          </p>
          <Link href="/product/behavior-graphs" className="states-inline-link">
            Explore Behavior Graphs <span>→</span>
          </Link>
        </div>
      </MediaSection>

      <MediaSection
        eyebrow="Missing states + coverage"
        title="A state you never reached is part of the coverage story."
        copy="State coverage is one of the five Phase 1 coverage dimensions. Missing-state findings say which specific conditions account for the part that was not reached."
        note="Master 1600 × 900 px · Display 1000 × 562 px · Behavior graph beside the state-coverage panel"
        visual={{
          label: "State coverage integration / SVG or product UI design",
          master: "1600 × 900",
          display: "1000 × 562",
        }}
      >
        <div className="states-coverage-block">
          <p className="states-kicker" data-aos="fade-up">Checkout</p>
          <div>
            {[
              ["State coverage", "81%"],
              ["Observed", "9"],
              ["Potential gaps", "3"],
            ].map(([term, value]) => (
              <span key={term}>
                <small>{term}</small>
                <b>{value}</b>
              </span>
            ))}
          </div>
        </div>
        <div>
          <p className="states-panel-label">Observed</p>
          <ul className="states-status-list" data-aos="tellann-panel">
            {["CART_ACTIVE", "CHECKOUT", "PAYMENT_SUCCESS"].map((item) => (
              <li key={item}>
                <i aria-hidden="true">✓</i> {item}
              </li>
            ))}
          </ul>
          <p className="states-panel-label">Potential / unobserved</p>
          <ul className="states-status-list is-unobserved" data-aos="tellann-panel">
            {["CHECKOUT_LOADING", "PAYMENT_FAILURE", "RETRY_PAYMENT"].map(
              (item) => (
                <li key={item}>
                  <i aria-hidden="true">○</i> {item}
                </li>
              ),
            )}
          </ul>
          <Link href="/product/coverage" className="states-inline-link">
            View Coverage <span>→</span>
          </Link>
        </div>
      </MediaSection>

      <MediaSection
        surface
        eyebrow="Missing state vs missing flow"
        title="A state is a condition. A flow is a sequence."
        copy="The two analyses answer neighbouring questions and Tellann keeps them separate. One asks whether a condition was ever reached; the other asks whether a path was ever exercised."
        note="Master 1500 × 750 px · Display 960 × 480 px · A single unobserved node beside a multi-step unobserved path"
        visual={{
          label: "Missing state beside missing flow / SVG design",
          master: "1500 × 750",
          display: "960 × 480",
        }}
      >
        <div className="states-vs-table" data-aos="tellann-panel"
          role="table"
          aria-label="Missing state compared with missing flow"
        >
          <div role="row" className="is-head">
            <span role="columnheader" />
            <span role="columnheader">Missing state</span>
            <span role="columnheader">Missing flow</span>
          </div>
          {stateVsFlow.map(([label, state, flow]) => (
            <div role="row" key={label}>
              <span role="cell">{label}</span>
              <span role="cell">{state}</span>
              <span role="cell">{flow}</span>
            </div>
          ))}
        </div>
        <div>
          <p className="states-panel-copy">
            A missing state often sits inside a missing flow. Demonstrating the
            flow usually resolves both, which is why the two findings link to
            each other rather than competing.
          </p>
          <Link href="/product/missing-flows" className="states-inline-link">
            Explore Missing Flows <span>→</span>
          </Link>
        </div>
      </MediaSection>

      <MediaSection
        eyebrow="Session evidence"
        title="A missing state has no replay—but the surrounding behavior does."
        copy="You cannot replay a condition that was never observed. What you can inspect is what actually happened around the place where Tellann inferred the gap."
        note="Master 1920 × 1200 px · Display 1000 × 625 px · 8–10 second loop · Finding, surrounding evidence, supporting session, replay with the related state highlighted"
        visual={{
          label: "Missing-state evidence to Session Replay / product recording",
          master: "1920 × 1200",
          display: "1000 × 625",
        }}
      >
        <div>
          <p className="states-panel-label">Finding</p>
          <div className="states-chain is-gap">
            <b>PAYMENT_FAILURE</b>
          </div>
          <p className="states-panel-label">Related observed state</p>
          <div className="states-chain">
            <b>PAYMENT_SUCCESS</b>
          </div>
        </div>
        <div>
          <p className="states-panel-label">Supporting sessions</p>
          <div className="states-session-chips">
            {["SES-3817", "SES-3824", "SES-3901"].map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
          <p className="states-panel-copy">
            Opening one replays the observed condition that triggered the
            suggestion—evidence for the question, not a fabrication of the
            answer.
          </p>
          <Link href="/product/session-replay" className="states-inline-link">
            Explore Session Replay <span>→</span>
          </Link>
        </div>
      </MediaSection>

      <AsideSection
        reverse
        surface
        eyebrow="Endpoint context"
        title="Some missing states are closely tied to backend outcomes."
        copy="Captured request, response, latency, and error metadata gives a proposed condition a concrete basis—while keeping observed evidence and suggested behavior clearly distinct."
        mediaWidth={900}
        visual={{
          label: "Endpoint context for a missing state / animated SVG design",
          master: "1600 × 900",
          display: "900 × 506",
        }}
      >
        <p className="states-panel-label">Observed</p>
        <div className="states-chain">
          <b>POST /payment</b>
          <b>200</b>
          <b>PAYMENT_SUCCESS</b>
        </div>
        <p className="states-panel-label">Potential state</p>
        <div className="states-chain is-gap">
          <b>POST /payment</b>
          <b>4xx · 5xx</b>
          <b>PAYMENT_FAILURE</b>
        </div>
        <div className="states-boundary">
          <span>
            <b>Observed API error</b>
            <small>Evidence exists.</small>
          </span>
          <span className="is-gap">
            <b>Potential error state</b>
            <small>Suggested condition to demonstrate.</small>
          </span>
        </div>
        <p className="states-panel-copy">
          A fast, consistently successful response is itself a signal—the
          Response → Timeout rule proposes the condition that has never been
          exercised.
        </p>
      </AsideSection>

      <MediaSection
        eyebrow="Demonstrate the missing state"
        title="Turn an unobserved state into behavioral evidence."
        copy="A finding is only useful if it leads somewhere. Selecting one opens Demonstration Mode with the workflow and target condition already in context."
        note="Master 1920 × 1200 px · Display 1100 × 688 px · 10–12 second loop · Select the state, demonstrate, capture, reanalyze, node becomes observed"
        visual={{
          label: "Demonstrate-the-state loop / product recording",
          master: "1920 × 1200",
          display: "1100 × 688",
        }}
      >
        <div className="states-demo-card">
          <p className="states-kicker" data-aos="fade-up">New demonstration</p>
          <dl>
            {[
              ["Workflow", "Cart"],
              ["Target state", "EMPTY_CART"],
              ["Objective", "Reach and demonstrate the empty-cart condition"],
            ].map(([term, value]) => (
              <div key={term}>
                <dt>{term}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <span>Start demonstration →</span>
        </div>
        <div className="states-loop">
          {[
            "Demonstrate",
            "Discover states",
            "Measure coverage",
            "Identify missing state",
            "Demonstrate state",
            "Reanalyze",
            "Expand graph",
          ].map((step, index, list) => (
            <span key={step}>
              <b>{step}</b>
              {index < list.length - 1 ? <i aria-hidden="true">→</i> : null}
            </span>
          ))}
        </div>
      </MediaSection>

      <MediaSection
        surface
        eyebrow="Multiple demonstrations"
        title="A missing state can become observed as the model grows."
        copy="Findings describe the current dataset, not a permanent verdict on your application. Each demonstration removes a condition from the list."
        note="Master 1600 × 900 px · Display 1000 × 562 px · Each demonstration turns a dashed node solid"
        visual={{
          label: "Multi-demonstration state evolution / animated SVG design",
          master: "1600 × 900",
          display: "1000 × 562",
        }}
      >
        <div className="states-demo-timeline" data-aos="tellann-panel">
          {[
            [
              "Demo 01",
              "Search success",
              "Potential: NO_RESULTS, SEARCH_LOADING, SEARCH_ERROR",
            ],
            [
              "Demo 02",
              "No results",
              "Potential: SEARCH_LOADING, SEARCH_ERROR",
            ],
            ["Demo 03", "API timeout", "Potential: SEARCH_LOADING"],
          ].map(([label, observed, result]) => (
            <span key={label}>
              <small>{label}</small>
              <b>{observed}</b>
              <i>{result}</i>
            </span>
          ))}
        </div>
        <div>
          <p className="states-panel-label">Finding lifecycle</p>
          <div className="states-state-chips">
            {[
              "NOT_OBSERVED",
              "DEMONSTRATED",
              "NOT_APPLICABLE",
              "DISMISSED",
            ].map((state) => (
              <span key={state}>{state}</span>
            ))}
          </div>
          <p className="states-panel-copy">
            An explainable rule engine needs a way for teams to reject
            irrelevant suggestions. NO_NOTIFICATIONS may simply not apply to
            your product, and saying so is a legitimate outcome.
          </p>
        </div>
      </MediaSection>

      <section className="states-priority">
        <div className="states-shell states-heading">
          <p className="states-kicker" data-aos="fade-up">Prioritization &amp; review</p>
          <h2 data-aos="fade-up" data-aos-delay="60">Focus on the missing states that matter to important workflows.</h2>
          <p data-aos="fade-up" data-aos-delay="120">
            Priority comes from configured workflow importance, the condition
            type, and declared business criticality—not from an invented
            business-impact score.
          </p>
        </div>
        <div className="states-shell states-priority-grid">
          <article>
            <span>Error state</span>
            <b>PAYMENT_FAILURE</b>
            <dl>
              {[
                ["Workflow", "Checkout"],
                ["Priority", "High"],
                ["Status", "Not observed"],
                ["Reason", "Success → Failure rule"],
              ].map(([term, value]) => (
                <div key={term}>
                  <dt>{term}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </article>
          <div className="states-review">
            <p className="states-kicker" data-aos="fade-up">Review actions</p>
            <div className="states-review-actions">
              {["Demonstrate", "Mark expected", "Not applicable", "Dismiss"].map(
                (action) => (
                  <span key={action}>{action}</span>
                ),
              )}
            </div>
            <p className="states-panel-label">If not applicable, why?</p>
            <ul className="states-reason-options">
              {[
                "Application does not support this condition",
                "Handled externally",
                "Duplicate state",
                "Other",
              ].map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
            <p className="states-panel-copy">
              That feedback keeps the model useful and could later improve
              detection quality.
            </p>
          </div>
        </div>
      </section>

      <AsideSection
        reverse
        eyebrow="Missing state report"
        title="Turn missing application conditions into a QA artifact."
        copy="The Missing State Report groups detected conditions by category so a team can review loading, empty, error, and recovery gaps together rather than as one flat list."
        mediaWidth={600}
        visual={{
          label: "Missing State Report / portrait report UI design",
          master: "1000 × 1280",
          display: "600 × 768",
        }}
      >
        <div className="states-report-summary">
          {[
            ["Application", "Storefront Demo"],
            ["Detected states", "6"],
          ].map(([term, value]) => (
            <span key={term}>
              <small>{term}</small>
              <b>{value}</b>
            </span>
          ))}
        </div>
        {reportGroups.map(([group, states]) => (
          <div className="states-report-group" key={group}>
            <small>{group}</small>
            {states.map((state) => (
              <span key={state}>
                <b>{state}</b>
                <i>Not observed</i>
              </span>
            ))}
          </div>
        ))}
        <div className="states-export-strip">
          <small>Export</small>
          {["PDF", "CSV", "JSON", "HTML"].map((format) => (
            <span key={format}>{format}</span>
          ))}
        </div>
        <Link href="/product/qa-reports" className="states-inline-link">
          View QA Reports <span>→</span>
        </Link>
      </AsideSection>

      <section className="states-caveats">
        <div className="states-shell states-heading">
          <p className="states-kicker" data-aos="fade-up">What a missing state does not mean</p>
          <h2 data-aos="fade-up" data-aos-delay="60">A missing state is a QA question—not automatically a bug.</h2>
          <p data-aos="fade-up" data-aos-delay="120">
            Tellann has identified a condition worth considering that was not
            observed in the selected behavioral evidence. That is the entire
            claim.
          </p>
        </div>
        <div className="states-shell states-not-list" data-aos="tellann-panel">
          <p>A missing state does not necessarily mean:</p>
          <ul>
            {notMeanings.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <div className="states-shell states-copy-compare">
          <article>
            <span>Avoid</span>
            <b>Bug detected · Empty cart missing</b>
            <b>Error · Loading state missing</b>
            <b>Tellann knows you forgot this state</b>
          </article>
          <article className="is-primary">
            <span>Use</span>
            <b>Potential missing state · Empty cart was not observed</b>
            <b>Not observed · Checkout loading may require validation</b>
            <b>
              Tellann surfaced this state because the Populated → Empty rule
              applies
            </b>
          </article>
        </div>
        <div className="states-shell states-dispositions">
          <p className="states-kicker" data-aos="fade-up">
            Detection and implementation are not the same thing
          </p>
          <div>
            {dispositions.map(([claim, rest], index) => (
              <span key={claim}>
                <small>{String(index + 1).padStart(2, "0")}</small>
                <b>{claim}</b>
                <i>{rest}</i>
              </span>
            ))}
          </div>
          <p>
            These three situations look identical in a flat list, so Tellann
            keeps a finding&apos;s disposition—unknown, observed, expected, or
            not applicable—distinct from its detection status.
          </p>
        </div>
      </section>

      <section className="states-future">
        <div className="states-shell states-heading">
          <p className="states-kicker" data-aos="fade-up">Where state detection goes next</p>
          <h2 data-aos="fade-up" data-aos-delay="60">Explainable rules first. Intelligence later, and labelled.</h2>
          <p data-aos="fade-up" data-aos-delay="120">
            Phase 1 works without production traffic, machine learning, AI, or
            manual workflow modeling. Later phases stay named as planned.
          </p>
        </div>
        <div className="states-shell states-phase-grid" data-aos="tellann-panel">
          <article>
            <span>Phase 01 · Behavioral QA</span>
            <p>
              Loading-state detection · Empty-state detection · Error-state
              detection · Recovery-state detection · Rule-based edge-case
              generation · Coverage integration · Missing State reports
            </p>
          </article>
          <article>
            <span>Phase 02 · Planned</span>
            <p>
              Production-observed rare states · Real failure-state frequencies ·
              Journey interruption states · Workflow-health context
            </p>
          </article>
          <article>
            <span>Phase 03 · Planned</span>
            <p>
              Automated validation of missing states · Generated edge-case tests
              · Failure simulation · Regression analysis · Behavioral anomaly
              detection · Autonomous quality reasoning
            </p>
          </article>
        </div>
      </section>

      <section className="states-faq">
        <div className="states-shell states-faq-grid">
          <div>
            <p className="states-kicker" data-aos="fade-up">FAQ</p>
            <h2 data-aos="fade-up" data-aos-delay="60">Questions behind the conditions.</h2>
          </div>
          <div>
            {faqs.map(([question, answer]) => (
              <details key={question}>
                <summary>
                  {question}
                  <span>+</span>
                </summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="states-final">
        <div className="states-shell">
          <p className="states-kicker" data-aos="fade-up">Look beyond the states you saw</p>
          <h2 data-aos="fade-up" data-aos-delay="60">Find the application condition you haven&apos;t demonstrated yet.</h2>
          <p data-aos="fade-up" data-aos-delay="120">
            Demonstrate a workflow and let Tellann surface loading, empty,
            error, and recovery states that remain unobserved—then turn those
            gaps into the next QA walkthrough.
          </p>
          <div className="states-actions">
            <a className="is-primary" href={dashboardUrl}>
              Start free <span>↗</span>
            </a>
            <Link href="/product/demonstration-mode">
              Explore Demonstration Mode <span>→</span>
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
