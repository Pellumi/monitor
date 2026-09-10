import type { Metadata } from "next";
import Link from "next/link";
import type { CSSProperties } from "react";
import { MissingFlowExplorer } from "@/components/missing-flow-explorer";
import { ProductPlaceholder } from "@/components/product-tour";
import "./missing-flows.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://domain-name.com";
const dashboardUrl =
  process.env.NEXT_PUBLIC_APP_URL || "https://app.domain-name.com";

export const metadata: Metadata = {
  title:
    "Missing Flow Detection — Find Unobserved Application Paths | Tellann",
  description:
    "See how Tellann identifies likely failure, alternative, recovery, and edge-case paths that were not demonstrated, connects them to workflow coverage and behavioral evidence, and helps guide the next QA walkthrough.",
  alternates: { canonical: "/product/missing-flows" },
  openGraph: {
    title:
      "Missing Flow Detection — Find Unobserved Application Paths | Tellann",
    description:
      "Surface the failure, alternative, recovery, and edge-case paths your demonstration never reached.",
    url: `${siteUrl}/product/missing-flows`,
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

const terminology: [string, string][] = [
  ["Observed flow", "A path supported by captured behavioral evidence."],
  [
    "Unobserved flow",
    "A modeled path for which the selected dataset contains no observed evidence.",
  ],
  [
    "Potential missing flow",
    "An unobserved path surfaced by Tellann's detection rules or behavioral model.",
  ],
  [
    "Failed flow",
    "A path that was actually observed and ended in failure.",
  ],
];

const categories: [string, string, string, string][] = [
  [
    "Failure",
    "What happens when the intended action fails?",
    "Payment failure",
    "SUCCESS_TO_FAILURE",
  ],
  [
    "Alternative",
    "Is there another valid way through the workflow?",
    "Guest checkout",
    "CONFIGURED_ALTERNATIVE",
  ],
  [
    "Recovery",
    "How does the user or system recover after failure?",
    "Retry payment",
    "FAILURE_TO_RECOVERY",
  ],
  [
    "Edge case",
    "What happens under an unusual boundary condition?",
    "Session expiration",
    "FAST_RESPONSE_TO_TIMEOUT",
  ],
];

const detectionRules: [string, string][] = [
  ["Observed success", "consider the corresponding failure"],
  ["Observed populated state", "consider the empty state"],
  ["Observed valid input", "consider invalid input"],
  ["Observed fast response", "consider the timeout"],
  ["Observed failure", "consider the recovery path"],
];

const edgeCaseMatrix: [string, string, string, string][] = [
  ["Success", "Failure", "PAYMENT_SUCCESS", "PAYMENT_FAILED"],
  ["Populated", "Empty", "SEARCH_RESULTS", "EMPTY_RESULTS"],
  ["Valid", "Invalid", "FORM_SUBMITTED", "INVALID_FORM_DATA"],
  ["Responsive", "Timeout", "API_RESPONSE", "API_TIMEOUT"],
];

const flowVsState: [string, string][] = [
  ["A condition not observed", "A behavioral path not observed"],
  ["Example: EMPTY_CART", "Example: Cart → Empty cart → Continue shopping"],
  ["Example: 404_PAGE", "Example: Invalid route → 404 → Return home"],
  ["Usually one node or state", "Usually multiple states and transitions"],
  [
    "Focuses on an application condition",
    "Focuses on progression through behavior",
  ],
];

const prioritizedFindings: [string, string, string][] = [
  ["High", "Payment failure", "Checkout"],
  ["High", "Session expiration", "Authentication"],
  ["Medium", "Retry payment", "Checkout"],
  ["Medium", "Out of stock", "Checkout"],
  ["Low", "Guest checkout", "Checkout"],
];

const reportFindings: [string, string, string][] = [
  ["High", "PAYMENT_FAILURE", "Failure flow"],
  ["High", "SESSION_TIMEOUT", "Edge case"],
  ["Medium", "RETRY_PAYMENT", "Recovery flow"],
  ["Medium", "OUT_OF_STOCK", "Alternative path"],
  ["Low", "CART_EXPIRATION", "Edge case"],
];

const notMeanings: string[] = [
  "the application is broken",
  "the product requirement demands that path",
  "the path is technically possible",
  "the workflow contains a bug",
  "a test has failed",
];

const faqs: [string, string][] = [
  [
    "What is a missing flow?",
    "A missing flow is a meaningful workflow path—failure, alternative, recovery, or edge case—that Tellann's rules or behavioral model expected, but which the selected demonstrations never exercised.",
  ],
  [
    "How does Tellann identify missing flows?",
    "Detection runs inside the Coverage Analysis Engine. Tellann reconstructs the workflow, identifies which paths were observed, then applies explicit behavioral rules to the observed structure to propose complementary paths.",
  ],
  [
    "What is the difference between a missing flow and a missing state?",
    "A missing state is a single unobserved condition, such as EMPTY_CART. A missing flow is an unobserved progression through several states and transitions, such as Cart → Empty cart → Continue shopping.",
  ],
  [
    "Does a missing flow mean my application has a bug?",
    "No. A missing flow means the path was not observed in the selected demonstrations. It is a question worth answering, not a defect report.",
  ],
  [
    "What is a failure flow?",
    "A failure flow is the path taken when the intended action does not succeed—payment failure, authentication failure, or API failure, for example.",
  ],
  [
    "What is an alternative flow?",
    "An alternative flow reaches the same objective by another valid route, such as guest checkout or social login. Tellann should explain why an alternative was proposed rather than assuming every application supports one.",
  ],
  [
    "What is a recovery flow?",
    "A recovery flow is what happens after a failure—retrying a payment, resetting a password, or reconnecting a session. Many walkthroughs demonstrate failure but never demonstrate the recovery.",
  ],
  [
    "What is an edge-case flow?",
    "An edge-case flow appears under an unusual boundary condition, such as an empty result set, an expired session, or a request that never returns.",
  ],
  [
    "Does Tellann use AI to discover missing flows?",
    "No. Phase 1 is designed around explainable, rule-based detection rather than machine learning or autonomous AI.",
  ],
  [
    "Can I see why a flow was suggested?",
    "Yes. Every finding carries its detection basis and the specific rule that produced it, along with the observed behavior that supported the suggestion.",
  ],
  [
    "Can I dismiss irrelevant flows?",
    "Yes. A rule-based system will surface paths that do not apply to a particular product, so findings can be marked demonstrated, not applicable, or dismissed.",
  ],
  [
    "Can I demonstrate a missing flow afterward?",
    "Yes. A finding leads directly into Demonstration Mode with the target workflow and path already in context.",
  ],
  [
    "Will demonstrating it change coverage?",
    "Yes. Once the path is observed it stops being an unobserved path, the behavioral model expands, and coverage is recalculated against the updated model.",
  ],
  [
    "Can missing flows be linked to sessions?",
    "A missing flow has no session of its own—it was never observed. What it links to is the surrounding observed evidence: the sessions containing the related path that triggered the suggestion.",
  ],
  [
    "How do endpoint failures affect missing-flow analysis?",
    "Captured request and response metadata provides context for the workflow. An observed API error is evidence; a proposed API failure path is a suggestion, and Tellann keeps those two labelled differently.",
  ],
  [
    "Can Tellann automatically test a missing flow?",
    "No. Generated validation scenarios and autonomous testing are excluded from Phase 1 and belong to later phases.",
  ],
  [
    "Does Tellann discover missing flows from production traffic?",
    "Not today. Phase 1 works from controlled demonstrations. Production-aware rare-flow detection is planned for a later phase.",
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
      className={`flows-media-section${surface ? " is-surface" : ""}`}
      id={id}
    >
      <div className="flows-shell flows-heading">
        <p className="flows-kicker">{eyebrow}</p>
        <h2>{title}</h2>
        <p>{copy}</p>
      </div>
      {children ? (
        <div className="flows-shell flows-section-detail">{children}</div>
      ) : null}
      <div className="flows-contained-media">
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
      className={`flows-aside-section${reverse ? " is-reverse" : ""}${
        surface ? " is-surface" : ""
      }`}
      id={id}
    >
      <div className="flows-shell flows-heading">
        <p className="flows-kicker">{eyebrow}</p>
        <h2>{title}</h2>
        <p>{copy}</p>
      </div>
      <div
        className="flows-shell flows-aside-grid"
        style={{ "--media-w": `${mediaWidth}px` } as CSSProperties}
      >
        <VisualPlaceholder {...visual} />
        <div className="flows-aside-panel">{children}</div>
      </div>
    </section>
  );
}

export default function MissingFlowsPage() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Tellann Missing Flow Detection",
    description: metadata.description,
    url: `${siteUrl}/product/missing-flows`,
  };

  return (
    <main className="flows-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      <section className="flows-hero pt-20!">
        <div className="flows-shell flows-hero-copy">
          <p className="flows-kicker">Missing flow detection</p>
          <h1>See the paths your demonstration never reached.</h1>
          <p>
            Tellann analyzes demonstrated workflows to identify likely failure,
            alternative, recovery, and edge-case paths that were not
            observed—then connects those gaps back to the workflow, coverage
            model, and supporting evidence.
          </p>
          <div className="flows-actions">
            <a className="is-primary" href="#explorer">
              Explore missing flows <span>↓</span>
            </a>
            <a href="#detection">
              See how detection works <span>↓</span>
            </a>
            <Link href="/product/coverage">
              View Coverage <span>→</span>
            </Link>
          </div>
        </div>
        <div className="flows-shell-wide flows-hero-media flows-desktop-media">
          <VisualPlaceholder
            label="Hero missing-flow graph / observed path branching into unobserved paths"
            master="1920 × 1120"
            display="1320 × 760"
          />
          <p>
            Master 1920 × 1120 px · Desktop display 1320 × 760 px · 8–10 second
            reveal, then interactive · ━━ Observed, ┄┄ potential flow not
            observed
          </p>
        </div>
        <div className="flows-mobile-media">
          <VisualPlaceholder
            label="Mobile missing-flow graph / checkout success and failure branch with retry"
            master="1080 × 1350"
            display="1080 × 1350"
          />
          <p>
            Mobile master 1080 × 1350 px (4:5) · Displayed responsively ·
            Simplified to one branch pair
          </p>
        </div>
      </section>

      <section className="flows-definition">
        <div className="flows-shell flows-heading">
          <p className="flows-kicker">What a missing flow is</p>
          <h2>
            A missing flow is a meaningful path Tellann expected or inferred but
            did not observe.
          </h2>
          <p>
            Successful behavior tells Tellann what worked. Missing Flow
            Detection asks which other meaningful paths deserve to be exercised.
          </p>
        </div>
        <div className="flows-shell flows-contrast">
          <article>
            <span>Observed</span>
            <div className="flows-chain">
              <b>Login</b>
              <b>Dashboard</b>
            </div>
          </article>
          <article className="is-gap">
            <span>Not observed</span>
            <div className="flows-branch-list">
              {[
                "Login failure",
                "Password reset",
                "Account locked",
                "Session expired",
              ].map((item) => (
                <b key={item}>{item}</b>
              ))}
            </div>
          </article>
        </div>
        <div className="flows-shell flows-terminology">
          <p className="flows-kicker">Critical terminology</p>
          <dl>
            {terminology.map(([term, meaning]) => (
              <div key={term}>
                <dt>{term}</dt>
                <dd>{meaning}</dd>
              </div>
            ))}
          </dl>
          <div className="flows-rules">
            {[
              "Not observed ≠ failed",
              "Missing ≠ broken",
              "Suggested ≠ confirmed requirement",
            ].map((rule) => (
              <span key={rule}>{rule}</span>
            ))}
          </div>
        </div>
      </section>

      <MediaSection
        surface
        eyebrow="Observed vs missing"
        title="Start with what Tellann knows. Then expose what it hasn't seen."
        copy="Every missing-flow finding is anchored to observed structure. The suggestion only exists because a related path was actually demonstrated."
        note="Master 1600 × 850 px · Display 1000 × 531 px · Observed branch solid, potential branch dashed"
        visual={{
          label: "Observed path beside potential gap / SVG design",
          master: "1600 × 850",
          display: "1000 × 531",
        }}
      >
        <div className="flows-compare-pair">
          <div>
            <p className="flows-panel-label">Observed</p>
            <div className="flows-chain">
              <b>CHECKOUT</b>
              <b>PAYMENT_SUCCESS</b>
            </div>
          </div>
          <div>
            <p className="flows-panel-label">Potential gap</p>
            <div className="flows-chain is-gap">
              <b>CHECKOUT</b>
              <b>PAYMENT_FAILURE</b>
              <b>RETRY_PAYMENT</b>
            </div>
          </div>
        </div>
      </MediaSection>

      <MediaSection
        eyebrow="How detection works"
        title="Missing paths are derived from behavioral structure—not guessed in isolation."
        copy="Detection sits inside the Coverage Analysis Engine, alongside coverage calculation and missing-state detection. It reads the reconstructed workflow rather than inventing paths from nothing."
        note="Master 1800 × 1000 px · Display 1100 × 611 px · 7–8 second sequence · Session, workflow, observed path, rules, potential path, finding"
        id="detection"
        visual={{
          label: "Missing-flow detection pipeline / animated SVG design",
          master: "1800 × 1000",
          display: "1100 × 611",
        }}
      >
        <div className="flows-pipeline">
          {[
            "Demonstration",
            "Session",
            "Workflow",
            "Behavior Graph",
            "Coverage analysis",
            "Unobserved paths",
            "Missing-flow rules",
            "Potential flows",
          ].map((step, index, list) => (
            <span key={step}>
              <small>{String(index + 1).padStart(2, "0")}</small>
              <b>{step}</b>
              {index < list.length - 1 ? <i aria-hidden="true">↓</i> : null}
            </span>
          ))}
        </div>
        <div>
          <p className="flows-panel-copy">
            Because detection reads the same behavioral model that Workflow
            Discovery produced, a proposed path always attaches to a real state
            in the graph rather than floating beside it.
          </p>
          <Link href="/product/workflow-discovery" className="flows-inline-link">
            Explore Workflow Discovery <span>→</span>
          </Link>
        </div>
      </MediaSection>

      <section className="flows-categories">
        <div className="flows-shell flows-heading">
          <p className="flows-kicker">Four categories</p>
          <h2>Not every missing path represents the same kind of behavior.</h2>
          <p>
            Phase 1 groups findings into failure, alternative, recovery, and
            edge-case flows, so a list of gaps reads as distinct kinds of
            question rather than one undifferentiated backlog.
          </p>
        </div>
        <div className="flows-shell flows-category-cards">
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
                label={`${title} flow / miniature branch graph`}
                dimensions="1020 × 300"
                displayDimensions="510 × 150"
              />
            </article>
          ))}
        </div>
      </section>

      <AsideSection
        eyebrow="Failure flows"
        title="What happens when success does not happen?"
        copy="An observed success path implies a counterpart. If CHECKOUT reached PAYMENT_SUCCESS, the failure branch beside it is a path worth exercising."
        mediaWidth={900}
        visual={{
          label: "Failure flow / animated SVG design",
          master: "1500 × 850",
          display: "900 × 510",
        }}
      >
        <p className="flows-panel-label">Observed</p>
        <div className="flows-chain">
          <b>CHECKOUT</b>
          <b>PAYMENT_SUCCESS</b>
        </div>
        <p className="flows-panel-label">Potential failure path</p>
        <div className="flows-chain is-gap">
          <b>CHECKOUT</b>
          <b>PAYMENT_FAILURE</b>
        </div>
        <ul className="flows-example-list">
          {["Authentication failure", "Payment failure", "API failure"].map(
            (item) => (
              <li key={item}>{item}</li>
            ),
          )}
        </ul>
      </AsideSection>

      <AsideSection
        reverse
        surface
        eyebrow="Alternative flows"
        title="Could the same objective be reached another way?"
        copy="An alternative route reaches the same outcome differently. Tellann proposes one only where there is a basis for it—and always shows what that basis was."
        mediaWidth={900}
        visual={{
          label: "Alternative flow / SVG design",
          master: "1500 × 850",
          display: "900 × 510",
        }}
      >
        <div className="flows-reason-card">
          <b>GUEST_CHECKOUT</b>
          <dl>
            {[
              [
                "Reason",
                "Alternative checkout pattern configured for this workflow",
              ],
              ["Evidence", "Checkout workflow exists"],
              ["Status", "Not observed"],
            ].map(([term, value]) => (
              <div key={term}>
                <dt>{term}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </div>
        <p className="flows-panel-copy">
          Tellann does not assume every application supports guest checkout,
          social login, or trial signup simply because other products do. Where
          there is no basis for an alternative, none is proposed.
        </p>
      </AsideSection>

      <AsideSection
        eyebrow="Recovery flows"
        title="Failure is only half the story. What happens next?"
        copy="Many QA walkthroughs demonstrate a failure and stop there. The recovery path—retrying, resetting, reconnecting—is often the behavior that matters most to a user."
        mediaWidth={900}
        visual={{
          label: "Recovery flow / animated SVG design",
          master: "1500 × 850",
          display: "900 × 510",
        }}
      >
        <p className="flows-panel-label">Potential recovery path</p>
        <div className="flows-chain is-gap">
          <b>PAYMENT_FAILURE</b>
          <b>RETRY_PAYMENT</b>
          <b>CHECKOUT</b>
        </div>
        <ul className="flows-example-list">
          {["Retry payment", "Retry login", "Reconnect session"].map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p className="flows-panel-copy">
          A dead end in the graph is a strong signal. If a failure state has no
          outgoing observed transition, the route back is worth demonstrating.
        </p>
      </AsideSection>

      <MediaSection
        eyebrow="Edge-case flows"
        title="Some important behavior only appears at the edges."
        copy="Boundary conditions produce their own behavior. Phase 1 derives them by transforming an observed condition into its counterpart—no machine learning required."
        note="Master 1600 × 900 px · Display 1000 × 562 px · Each observed condition transforms into its counterpart"
        visual={{
          label: "Edge-case transformation matrix / animated SVG design",
          master: "1600 × 900",
          display: "1000 × 562",
        }}
      >
        <div
          className="flows-matrix"
          role="table"
          aria-label="Observed condition transformed into its edge-case counterpart"
        >
          <div role="row" className="is-head">
            <span role="columnheader">Observed</span>
            <span role="columnheader">Counterpart</span>
          </div>
          {edgeCaseMatrix.map(([left, right, from, to]) => (
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
        <p className="flows-panel-copy">
          These four transformations are the clearest illustration of how
          Phase 1 detection works without AI: an observed condition on the left
          produces a proposed counterpart on the right.
        </p>
      </MediaSection>

      <MediaSection
        surface
        eyebrow="Rule-based detection"
        title="Phase 1 begins with explainable rules."
        copy="Missing Flow Detection is required to work without machine learning or artificial intelligence. Explicit behavioral rules read the observed structure and propose plausible complements."
        note="Master 1600 × 900 px · Display 1000 × 562 px · Each rule maps an observed condition to a proposed path"
        visual={{
          label: "Rule-based detection map / HTML or SVG design",
          master: "1600 × 900",
          display: "1000 × 562",
        }}
      >
        <div className="flows-rule-map">
          {detectionRules.map(([observed, proposed]) => (
            <span key={observed}>
              <b>{observed}</b>
              <i aria-hidden="true">→</i>
              <small>{proposed}</small>
            </span>
          ))}
        </div>
        <p className="flows-note">
          <b>Why this matters:</b> the credible Phase 1 story is not that an
          intelligence engine knows what you forgot. It is that Tellann applies
          explicit behavioral rules to surface plausible gaps—and can explain
          why each one was suggested.
        </p>
      </MediaSection>

      <section className="flows-explorer-section" id="explorer">
        <div className="flows-shell flows-heading">
          <p className="flows-kicker">Interactive missing-flow explorer</p>
          <h2>Inspect every missing path in context.</h2>
          <p>
            Choose a workflow, filter by category and status, and open any
            finding to see the rule behind it. Mark a path demonstrated, not
            applicable, or dismissed—findings are a model your team curates, not
            fixed labels. The graph canvas remains a dimension-accurate
            placeholder for the final renderer.
          </p>
        </div>
        <div className="flows-shell-wide">
          <MissingFlowExplorer />
        </div>
        <p className="flows-shell flows-note">
          <b>Graph or list:</b> a dashed line is never the only way to discover
          that a path is missing. Every finding is reachable as text with an
          explicit category and status.
        </p>
      </section>

      <AsideSection
        reverse
        eyebrow="Why Tellann flagged this"
        title="Every suggestion should come with a reason."
        copy="Rule-based inference will sometimes surface paths that do not apply to your product. That is survivable only if each finding can explain itself."
        mediaWidth={720}
        visual={{
          label: "Why-flagged inspector panel / product UI design",
          master: "1200 × 800",
          display: "720 × 480",
        }}
      >
        <div className="flows-reason-card">
          <b>PAYMENT_FAILURE</b>
          <p className="flows-panel-label">Why this appears</p>
          <ol className="flows-reason-steps">
            {[
              "Checkout workflow was discovered.",
              "Payment success was observed.",
              "The failure-counterpart rule applies.",
              "No payment-failure path exists in the selected observations.",
            ].map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <dl>
            <div>
              <dt>Result</dt>
              <dd>Potential missing failure flow</dd>
            </div>
            <div>
              <dt>Detection basis</dt>
              <dd>Rule-based</dd>
            </div>
            <div>
              <dt>Rule</dt>
              <dd>SUCCESS_TO_FAILURE</dd>
            </div>
          </dl>
        </div>
        <p className="flows-panel-copy">
          Tellann reports the rule that fired rather than a fabricated
          confidence percentage. A stated rule is both more honest and more
          useful than a number with no model behind it.
        </p>
      </AsideSection>

      <MediaSection
        surface
        eyebrow="Missing flows on the Behavior Graph"
        title="See the missing branch where it belongs."
        copy="A finding is not a separate list living somewhere else. It is a dashed branch on the same graph, using the same visual language as every other Tellann surface."
        note="Master 1920 × 1200 px · Display 1000 × 625 px · 7–9 second loop · Open graph, enable missing flows, select a branch, expand why it was flagged"
        visual={{
          label: "Behavior Graph missing-flow overlay / product recording",
          master: "1920 × 1200",
          display: "1000 × 625",
        }}
      >
        <div className="flows-legend">
          {[
            ["━━", "Observed", "A path with behavioral evidence"],
            ["┄┄", "Potential gap", "A proposed path not observed"],
            ["━━", "Failed", "Observed and ended in failure"],
            ["◍", "Not applicable", "Marked irrelevant for this product"],
          ].map(([glyph, term, meaning]) => (
            <span key={term}>
              <i aria-hidden="true">{glyph}</i>
              <b>{term}</b>
              <small>{meaning}</small>
            </span>
          ))}
        </div>
        <div>
          <p className="flows-panel-copy">
            Shape, pattern, and label carry the status together. Colour is never
            the only signal, so the graph stays readable regardless of how a
            viewer perceives it.
          </p>
          <Link href="/product/behavior-graphs" className="flows-inline-link">
            Explore Behavior Graphs <span>→</span>
          </Link>
        </div>
      </MediaSection>

      <MediaSection
        eyebrow="Missing flows + coverage"
        title="Missing flows explain where coverage is incomplete."
        copy="Coverage reports a number of unobserved paths. Missing Flow Detection says what those paths actually are, which makes the number navigable instead of abstract."
        note="Master 1500 × 850 px · Display 960 × 544 px · Coverage summary opening into categorised findings"
        visual={{
          label: "Coverage to missing-flow breakdown / SVG or UI design",
          master: "1500 × 850",
          display: "960 × 544",
        }}
      >
        <div className="flows-coverage-block">
          <p className="flows-kicker">Checkout</p>
          <div>
            {[
              ["Coverage", "72%"],
              ["Observed paths", "18"],
              ["Unobserved paths", "7"],
            ].map(([term, value]) => (
              <span key={term}>
                <small>{term}</small>
                <b>{value}</b>
              </span>
            ))}
          </div>
        </div>
        <div>
          <p className="flows-panel-label">Potential missing flows</p>
          <div className="flows-breakdown">
            {[
              ["Failure", "3"],
              ["Recovery", "2"],
              ["Alternative", "1"],
              ["Edge case", "1"],
            ].map(([term, count]) => (
              <span key={term}>
                <b>{term}</b>
                <small>{count}</small>
              </span>
            ))}
          </div>
          <Link href="/product/coverage" className="flows-inline-link">
            View Coverage <span>→</span>
          </Link>
        </div>
      </MediaSection>

      <MediaSection
        surface
        eyebrow="Missing flow vs missing state"
        title="A missing state and a missing flow are not the same thing."
        copy="One describes a condition the application never entered. The other describes a progression it never took. Tellann detects both, and keeps them labelled separately."
        note="Master 1500 × 750 px · Display 960 × 480 px · A single unobserved node beside a multi-step unobserved path"
        visual={{
          label: "Missing state beside missing flow / SVG design",
          master: "1500 × 750",
          display: "960 × 480",
        }}
      >
        <div
          className="flows-vs-table"
          role="table"
          aria-label="Missing state compared with missing flow"
        >
          <div role="row" className="is-head">
            <span role="columnheader">Missing state</span>
            <span role="columnheader">Missing flow</span>
          </div>
          {flowVsState.map(([state, flow]) => (
            <div role="row" key={state}>
              <span role="cell">{state}</span>
              <span role="cell">{flow}</span>
            </div>
          ))}
        </div>
        <div>
          <p className="flows-panel-copy">
            The two analyses complement each other. A missing state often sits
            inside a missing flow, and demonstrating the flow usually resolves
            both.
          </p>
          <Link href="/product/missing-states" className="flows-inline-link">
            Explore Missing States <span>→</span>
          </Link>
        </div>
      </MediaSection>

      <MediaSection
        eyebrow="Missing flow + session evidence"
        title="A missing-flow finding should still show the evidence around it."
        copy="There is no replay for behavior that was never observed. What a finding can show is the observed evidence that produced the suggestion in the first place."
        note="Master 1920 × 1200 px · Display 1000 × 625 px · 8–10 second loop · Finding, related observations, supporting session, replay at checkout"
        visual={{
          label: "Missing-flow evidence to Session Replay / product recording",
          master: "1920 × 1200",
          display: "1000 × 625",
        }}
      >
        <div>
          <p className="flows-panel-label">Finding</p>
          <div className="flows-chain is-gap">
            <b>PAYMENT_FAILURE</b>
          </div>
          <p className="flows-panel-label">Related observed path</p>
          <div className="flows-chain">
            <b>CHECKOUT</b>
            <b>PAYMENT_SUCCESS</b>
          </div>
        </div>
        <div>
          <p className="flows-panel-label">Supporting sessions</p>
          <div className="flows-session-chips">
            {["SES-3817", "SES-3824", "SES-3901"].map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
          <p className="flows-panel-copy">
            Opening a supporting session replays the path that was observed, not
            the path that was missing—the evidence behind the question rather
            than an imagined answer.
          </p>
          <Link href="/product/session-replay" className="flows-inline-link">
            Explore Session Replay <span>→</span>
          </Link>
        </div>
      </MediaSection>

      <AsideSection
        reverse
        surface
        eyebrow="Endpoint context"
        title="Missing behavioral paths can also involve backend outcomes."
        copy="Captured request and response metadata gives a proposed path useful context. It does not turn a suggestion into proof, and Tellann labels the difference."
        mediaWidth={900}
        visual={{
          label: "Endpoint context for a missing flow / SVG or UI design",
          master: "1600 × 900",
          display: "900 × 506",
        }}
      >
        <p className="flows-panel-label">Observed</p>
        <div className="flows-chain">
          <b>POST /payment</b>
          <b>200</b>
          <b>PAYMENT_SUCCESS</b>
        </div>
        <p className="flows-panel-label">Potential flow</p>
        <div className="flows-chain is-gap">
          <b>POST /payment</b>
          <b>4xx · 5xx · timeout</b>
          <b>PAYMENT_FAILURE</b>
        </div>
        <div className="flows-boundary">
          <span>
            <b>Observed API error</b>
            <small>Evidence exists.</small>
          </span>
          <span className="is-gap">
            <b>Potential API failure flow</b>
            <small>Suggested behavior to demonstrate.</small>
          </span>
        </div>
      </AsideSection>

      <MediaSection
        eyebrow="Demonstrate the missing path"
        title="Turn a gap into the next demonstration."
        copy="A finding is only useful if it leads somewhere. Selecting one opens Demonstration Mode with the target workflow and path already in context."
        note="Master 1920 × 1200 px · Display 1100 × 688 px · 10–12 second loop · Finding, demonstrate, capture, reanalyze, path becomes observed"
        visual={{
          label: "Demonstrate-the-gap loop / product recording",
          master: "1920 × 1200",
          display: "1100 × 688",
        }}
      >
        <div className="flows-demo-card">
          <p className="flows-kicker">New demonstration</p>
          <dl>
            {[
              ["Target workflow", "Checkout"],
              ["Target path", "Payment failure"],
              ["Suggested objective", "Exercise the payment-failure branch"],
            ].map(([term, value]) => (
              <div key={term}>
                <dt>{term}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <span>Demonstrate this path →</span>
        </div>
        <div className="flows-loop">
          {[
            "Demonstrate",
            "Discover",
            "Measure coverage",
            "Find missing flow",
            "Demonstrate gap",
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
        title="A missing flow today can become observed behavior tomorrow."
        copy="Findings are not permanent labels on your application. They describe the current dataset, and they change as the observed dataset grows."
        note="Master 1600 × 900 px · Display 1000 × 562 px · Each demonstration converts a dashed branch into an observed one"
        visual={{
          label: "Multi-demonstration evolution / animated SVG design",
          master: "1600 × 900",
          display: "1000 × 562",
        }}
      >
        <div className="flows-demo-timeline">
          {[
            [
              "Demo 01",
              "Checkout success",
              "Potential gaps: payment failure, retry payment",
            ],
            ["Demo 02", "Payment failure", "Potential gap: retry payment"],
            ["Demo 03", "Retry payment", "Broader behavioral coverage"],
          ].map(([label, observed, result]) => (
            <span key={label}>
              <small>{label}</small>
              <b>{observed}</b>
              <i>{result}</i>
            </span>
          ))}
        </div>
        <div>
          <p className="flows-panel-label">Finding states</p>
          <div className="flows-state-chips">
            {[
              "NOT_OBSERVED",
              "DEMONSTRATED",
              "DISMISSED",
              "NOT_APPLICABLE",
            ].map((state) => (
              <span key={state}>{state}</span>
            ))}
          </div>
          <p className="flows-panel-copy">
            Marking a finding not applicable is a legitimate answer. A
            rule-based system will propose paths that do not apply to every
            product, and curating that model is part of using it well.
          </p>
        </div>
      </MediaSection>

      <AsideSection
        eyebrow="Prioritization"
        title="Not every missing path deserves the same attention."
        copy="Severity should come from workflow criticality, flow category, configured business importance, and coverage contribution—never from an arbitrary ranking applied at display time."
        mediaWidth={800}
        visual={{
          label: "Prioritized missing-flow findings / product UI design",
          master: "1400 × 900",
          display: "800 × 514",
        }}
      >
        <div className="flows-priority-list">
          {prioritizedFindings.map(([severity, name, workflow]) => (
            <span key={name}>
              <small>{severity}</small>
              <b>{name}</b>
              <i>{workflow}</i>
            </span>
          ))}
        </div>
        <p className="flows-panel-copy">
          The ranking model belongs server-side and should be documented before
          it is marketed as intelligent prioritization.
        </p>
        <small className="flows-sample-note">Sample application data</small>
      </AsideSection>

      <AsideSection
        reverse
        surface
        eyebrow="Missing flow report"
        title="Turn uncovered paths into a QA artifact."
        copy="The Missing Flow Report identifies workflows likely not demonstrated, grouped by category and severity, in a form a team can circulate and act on."
        mediaWidth={600}
        visual={{
          label: "Missing Flow Report / portrait report UI design",
          master: "1000 × 1280",
          display: "600 × 768",
        }}
      >
        <div className="flows-report-summary">
          {[
            ["Application", "Storefront Demo"],
            ["Workflow", "CHECKOUT"],
            ["Coverage", "72%"],
            ["Missing flows", "5"],
          ].map(([term, value]) => (
            <span key={term}>
              <small>{term}</small>
              <b>{value}</b>
            </span>
          ))}
        </div>
        <div className="flows-report-list">
          {reportFindings.map(([severity, name, category]) => (
            <span key={name}>
              <small>{severity}</small>
              <b>{name}</b>
              <i>{category}</i>
            </span>
          ))}
        </div>
        <div className="flows-export-strip">
          <small>Export</small>
          {["PDF", "JSON", "CSV", "HTML"].map((format) => (
            <span key={format}>{format}</span>
          ))}
        </div>
        <Link href="/product/qa-reports" className="flows-inline-link">
          View QA Reports <span>→</span>
        </Link>
      </AsideSection>

      <section className="flows-caveats">
        <div className="flows-shell flows-heading">
          <p className="flows-kicker">What a missing flow does not mean</p>
          <h2>A suggested path is a question—not automatically a defect.</h2>
          <p>
            A missing flow indicates that Tellann identified behavior worth
            considering that was not observed in the selected demonstrations.
            That is all it indicates.
          </p>
        </div>
        <div className="flows-shell flows-not-list">
          <p>A missing flow does not necessarily mean:</p>
          <ul>
            {notMeanings.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <div className="flows-shell flows-copy-compare">
          <article>
            <span>Avoid</span>
            <b>Bug found · Payment failure missing</b>
            <b>Failed test · Session timeout missing</b>
          </article>
          <article className="is-primary">
            <span>Use</span>
            <b>Potential gap · Payment failure was not observed</b>
            <b>Not demonstrated · Session timeout has not been observed</b>
          </article>
        </div>
        <div className="flows-shell flows-controls">
          <p className="flows-kicker">Curation controls</p>
          <div>
            {["Demonstrate", "Mark expected", "Not applicable", "Dismiss"].map(
              (action) => (
                <span key={action}>{action}</span>
              ),
            )}
          </div>
          <p>
            These let a team curate the behavioral model instead of treating
            Tellann&apos;s suggestions as unquestionable truth.
          </p>
        </div>
      </section>

      <section className="flows-future">
        <div className="flows-shell flows-heading">
          <p className="flows-kicker">Where detection goes next</p>
          <h2>Explainable rules first. Intelligence later, and labelled.</h2>
          <p>
            Phase 1 works without AI or machine learning by design. Later phases
            are named as planned rather than folded into what exists today.
          </p>
        </div>
        <div className="flows-shell flows-phase-grid">
          <article>
            <span>Phase 01 · Behavioral QA</span>
            <p>
              Rule-based missing-flow detection · Failure flows · Alternative
              flows · Recovery flows · Edge-case flows · Coverage integration ·
              Demonstration-driven analysis · Missing Flow reports
            </p>
          </article>
          <article>
            <span>Phase 02 · Planned</span>
            <p>
              Production-aware rare flows · Observed production failures ·
              Journey interruptions · Latency-driven edge cases
            </p>
          </article>
          <article>
            <span>Phase 03 · Planned</span>
            <p>
              Autonomous validation scenarios · Generated tests · Failure
              simulation · Regression detection · Behavioral risk assessment
            </p>
          </article>
        </div>
      </section>

      <section className="flows-faq">
        <div className="flows-shell flows-faq-grid">
          <div>
            <p className="flows-kicker">FAQ</p>
            <h2>Questions behind the gaps.</h2>
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

      <section className="flows-final">
        <div className="flows-shell">
          <p className="flows-kicker">Go beyond the happy path</p>
          <h2>Find the path you haven&apos;t demonstrated yet.</h2>
          <p>
            Show Tellann a workflow, inspect the failure, alternative, recovery,
            and edge-case paths that remain unobserved, and use those gaps to
            guide your next demonstration.
          </p>
          <div className="flows-actions">
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
