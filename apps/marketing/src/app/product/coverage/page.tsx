import type { Metadata } from "next";
import Link from "next/link";
import type { CSSProperties } from "react";
import { CoverageExplorer } from "@/components/coverage-explorer";
import { ProductPlaceholder } from "@/components/product-tour";
import "./coverage.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://domain-name.com";
const dashboardUrl =
  process.env.NEXT_PUBLIC_APP_URL || "https://app.domain-name.com";

export const metadata: Metadata = {
  title:
    "Behavioral Coverage — Measure Application Workflow Coverage | Tellann",
  description:
    "Measure demonstrated software behavior with Tellann across workflows, states, transitions, endpoints, errors, observed paths, and missing paths—and trace coverage back to supporting sessions.",
  alternates: { canonical: "/product/coverage" },
  openGraph: {
    title:
      "Behavioral Coverage — Measure Application Workflow Coverage | Tellann",
    description:
      "Turn demonstrated behavior into measurable, traceable workflow coverage.",
    url: `${siteUrl}/product/coverage`,
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

const comparisonRows: [string, string][] = [
  ["Source-code oriented", "Workflow oriented"],
  ["Lines, functions, and branches", "States, transitions, and paths"],
  ["Shows whether code executed", "Shows whether behavior was observed"],
  ["Often tied to test execution", "Derived from observed sessions"],
  [
    "Does not inherently describe business workflows",
    "Structured around application workflows",
  ],
  [
    "Does not tell you which user path produced execution",
    "Traceable to behavioral sessions",
  ],
];

const coverageDimensions: [string, string, string][] = [
  ["Workflow", "Which workflow paths were exercised?", "392 × 192"],
  ["State", "Which meaningful application states appeared?", "392 × 192"],
  ["Transition", "Which movements between states occurred?", "392 × 192"],
  ["Endpoint", "Which workflow-related endpoints were exercised?", "392 × 192"],
  ["Error", "Which error behavior was actually observed?", "392 × 192"],
];

const statusVocabulary: [string, string][] = [
  ["Observed", "Tellann has behavioral evidence."],
  ["Unobserved", "Tellann has no evidence from the selected dataset."],
  [
    "Partial",
    "Some of the behavior was exercised, but the process is incomplete.",
  ],
  [
    "Potential gap",
    "The model or configured rules indicate behavior worth exercising.",
  ],
  ["Failed", "Observed behavior actually resulted in failure."],
];

const incompleteWorkflows: [string, string, string, string, string[]][] = [
  [
    "Checkout",
    "72%",
    "18",
    "7",
    ["Payment failure", "Session timeout", "Inventory changed"],
  ],
  [
    "Registration",
    "61%",
    "4",
    "5",
    ["Invalid submission", "Existing account", "API failure"],
  ],
  [
    "Search",
    "77%",
    "9",
    "4",
    ["Loading state", "Empty results", "Search error"],
  ],
];

const endpointRows: string[][] = [
  ["GET /products", "Observed", "24"],
  ["POST /cart", "Observed", "18"],
  ["POST /checkout", "Observed", "15"],
  ["POST /payment", "Observed", "15"],
  ["POST /payment/retry", "Unobserved", "0"],
];

const comparisonMetrics: [string, string, string][] = [
  ["Workflow", "55%", "72%"],
  ["States", "64%", "81%"],
  ["Transitions", "51%", "69%"],
  ["Endpoints", "72%", "87%"],
  ["Errors", "14%", "42%"],
];

const faqs: [string, string][] = [
  [
    "What is behavioral coverage?",
    "Behavioral coverage measures which parts of a reconstructed workflow were actually exercised—its states, transitions, endpoints, errors, and paths—rather than which lines of source code ran.",
  ],
  [
    "How is Tellann coverage different from code coverage?",
    "They answer different QA questions. Code coverage tells you what executed. Tellann tells you which application behavior was observed, and links that answer back to the sessions that produced it.",
  ],
  [
    "What is workflow coverage?",
    "Workflow coverage describes how much of a discovered workflow was exercised across its observed and unobserved paths, rather than only its happy path.",
  ],
  [
    "What is state coverage?",
    "State coverage describes which meaningful application states a demonstration actually reached, and which states in the model were never entered.",
  ],
  [
    "What is transition coverage?",
    "Transition coverage describes which movements between states were observed. A state can be reached while the paths into and out of it remain unexercised.",
  ],
  [
    "What is endpoint coverage?",
    "Endpoint coverage describes which workflow-related API endpoints were exercised during the observed sessions, based on captured request and response activity.",
  ],
  [
    "What is error coverage?",
    "Error coverage describes which error behavior was actually observed. A workflow is not covered simply because its success path worked.",
  ],
  [
    "What is an observed path?",
    "An observed path is a route through the workflow that Tellann has behavioral evidence for, backed by one or more supporting sessions.",
  ],
  [
    "What is an unobserved path?",
    "An unobserved path is a route the model or configured rules suggest is worth exercising, but for which the selected dataset contains no evidence.",
  ],
  [
    "Does an unobserved path mean something is broken?",
    "No. Unobserved means there is no evidence, not that there is a defect. It is a prompt to decide whether that path should be demonstrated, tested, or investigated.",
  ],
  [
    "How are missing paths discovered?",
    "They emerge from the behavioral model around a discovered workflow—failure, alternative, recovery, and edge-case branches that connect to observed structure but were never exercised.",
  ],
  [
    "Can I see the sessions behind a coverage result?",
    "Yes. Every observed path stays connected to its supporting sessions, and those sessions open in Session Replay at the relevant moment.",
  ],
  [
    "Can I compare coverage between demonstrations?",
    "Yes. Session-to-session coverage comparison is a Phase 1 capability. It shows what a second demonstration added rather than claiming automated release regression detection.",
  ],
  [
    "Does Tellann replace unit or integration-test coverage?",
    "No. Behavioral coverage is complementary. It describes exercised application behavior, which existing code-level coverage tools do not measure.",
  ],
  [
    "Can coverage reach 100%?",
    "Coverage is measured against the behavioral model Tellann is analyzing. As demonstrations expand that model, the denominator can change, so a fixed 100% is not a meaningful finish line.",
  ],
  [
    "Does 100% coverage mean the application has no bugs?",
    "No. Coverage is evidence of exercised behavior. It is not a guarantee of correctness, and observation is not the same as verification.",
  ],
  [
    "Does Tellann measure production traffic today?",
    "No. Phase 1 coverage is measured from controlled demonstration sessions. Production coverage and real-user journey coverage are planned for a later phase.",
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
      className={`coverage-media-section${surface ? " is-surface" : ""}`}
      id={id}
    >
      <div className="coverage-shell coverage-heading">
        <p className="coverage-kicker">{eyebrow}</p>
        <h2>{title}</h2>
        <p>{copy}</p>
      </div>
      {children ? (
        <div className="coverage-shell coverage-section-detail">{children}</div>
      ) : null}
      <div className="coverage-contained-media">
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
  wide = false,
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
  wide?: boolean;
  id?: string;
  children?: React.ReactNode;
}) {
  return (
    <section
      className={`coverage-aside-section${reverse ? " is-reverse" : ""}${
        surface ? " is-surface" : ""
      }`}
      id={id}
    >
      <div className="coverage-shell coverage-heading">
        <p className="coverage-kicker">{eyebrow}</p>
        <h2>{title}</h2>
        <p>{copy}</p>
      </div>
      <div
        className={`${wide ? "coverage-shell-wide" : "coverage-shell"} coverage-aside-grid`}
        style={{ "--media-w": `${mediaWidth}px` } as CSSProperties}
      >
        <VisualPlaceholder {...visual} />
        <div className="coverage-aside-panel">{children}</div>
      </div>
    </section>
  );
}

export default function CoveragePage() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Tellann Behavioral Coverage",
    description: metadata.description,
    url: `${siteUrl}/product/coverage`,
  };

  return (
    <main className="coverage-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      <section className="coverage-hero pt-20!">
        <div className="coverage-shell coverage-hero-copy">
          <p className="coverage-kicker">Behavioral coverage</p>
          <h1>Know what your workflow covered—and what it didn&apos;t.</h1>
          <p>
            Tellann turns demonstrated behavior into measurable workflow
            coverage across states, transitions, endpoints, errors, and
            paths—then shows the evidence behind what was observed and what
            remains unseen.
          </p>
          <div className="coverage-actions">
            <a className="is-primary" href="#explorer">
              Explore coverage <span>↓</span>
            </a>
            <a href="#dimensions">
              See how it is measured <span>↓</span>
            </a>
            <Link href="/product/workflow-discovery">
              Explore Workflow Discovery <span>→</span>
            </Link>
          </div>
        </div>
        <div className="coverage-shell-wide coverage-hero-media coverage-desktop-media">
          <VisualPlaceholder
            label="Hero coverage graph / observed and unobserved workflow paths"
            master="1920 × 1120"
            display="1320 × 760"
          />
          <p>
            Master 1920 × 1120 px · Desktop display 1320 × 760 px · 8–10 second
            reveal, then interactive · Solid = observed, dashed = unobserved
          </p>
        </div>
        <div className="coverage-mobile-media">
          <VisualPlaceholder
            label="Mobile coverage graph / simplified observed and unobserved branches"
            master="1080 × 1350"
            display="1080 × 1350"
          />
          <p>
            Mobile master 1080 × 1350 px · Displayed responsively · Simplified
            to a single workflow branch
          </p>
        </div>
      </section>

      <section className="coverage-meaning">
        <div className="coverage-shell coverage-heading">
          <p className="coverage-kicker">What behavioral coverage means</p>
          <h2>Coverage becomes useful when it describes behavior.</h2>
          <p>
            Raw event volume is not coverage. Coverage begins after events
            become a session, a session becomes a workflow, and that workflow
            has states, transitions, and paths worth measuring.
          </p>
        </div>
        <div className="coverage-shell coverage-contrast">
          <article>
            <span>Event volume</span>
            <b>428</b>
            <p>captured events</p>
            <small>
              A count of telemetry tells you the recorder worked. It does not
              tell you which behavior you exercised.
            </small>
          </article>
          <i aria-hidden="true">→</i>
          <article className="is-primary">
            <span>Checkout workflow</span>
            <div>
              {[
                ["12", "states"],
                ["18", "transitions"],
                ["6", "observed paths"],
                ["3", "unobserved paths"],
                ["72%", "coverage"],
              ].map(([value, label]) => (
                <p key={label}>
                  <b>{value}</b>
                  <small>{label}</small>
                </p>
              ))}
            </div>
          </article>
        </div>
        <div className="coverage-contained-media">
          <VisualPlaceholder
            label="Events to workflow model to coverage / animated SVG design"
            master="1600 × 900"
            display="1000 × 562"
          />
          <p>
            Master 1600 × 900 px · Display 1000 × 562 px · 6 second sequence ·
            Events, workflow model, then observed, missing, and incomplete
          </p>
        </div>
      </section>

      <section className="coverage-denominator">
        <div className="coverage-shell coverage-heading">
          <p className="coverage-kicker">Never a number on its own</p>
          <h2>Every percentage should carry its behavioral model with it.</h2>
          <p>
            A coverage score is only meaningful when you can walk from the
            number down to the paths and sessions underneath it.
          </p>
        </div>
        <div className="coverage-shell coverage-denominator-chain">
          {[
            ["72%", "Coverage of what?"],
            ["Checkout workflow", "The measured process"],
            ["12 states", "The conditions in the model"],
            ["18 transitions", "The movements between them"],
            ["15 observed paths", "Backed by evidence"],
            ["5 unobserved paths", "No evidence yet"],
            ["Supporting sessions", "The demonstrations behind it"],
          ].map(([value, label], index, list) => (
            <div key={value}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <b>{value}</b>
              <p>{label}</p>
              {index < list.length - 1 ? <i aria-hidden="true">↓</i> : null}
            </div>
          ))}
        </div>
      </section>

      <section className="coverage-versus-section">
        <div className="coverage-shell coverage-heading">
          <p className="coverage-kicker">Coverage vs code coverage</p>
          <h2>
            Code coverage asks what executed. Tellann asks what behavior you
            exercised.
          </h2>
          <p>
            These are not competing numbers. They answer different QA questions,
            and a team can reasonably want both.
          </p>
        </div>
        <div className="coverage-shell coverage-versus">
          <article>
            <span>Code coverage</span>
            <div className="coverage-bar" aria-hidden="true">
              <i style={{ width: "82%" }} />
            </div>
            <b>82%</b>
            <p>Statements executed during the test run.</p>
          </article>
          <article className="is-primary">
            <span>Tellann behavioral coverage</span>
            <div className="coverage-branch">
              <b>Checkout</b>
              <span>Product</span>
              <span>Cart</span>
              <span>Checkout</span>
              <div>
                <span>Success ✓</span>
                <span className="is-unobserved">Failure ○</span>
              </div>
            </div>
            <p>Workflow behavior observed across states, paths, and errors.</p>
          </article>
        </div>
        <div
          className="coverage-shell coverage-compare-table"
          role="table"
          aria-label="Code coverage compared with Tellann behavioral coverage"
        >
          <div role="row" className="is-head">
            <span role="columnheader">Code coverage</span>
            <span role="columnheader">Tellann behavioral coverage</span>
          </div>
          {comparisonRows.map(([code, tellann]) => (
            <div role="row" key={code}>
              <span role="cell">{code}</span>
              <span role="cell">{tellann}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="coverage-dimensions" id="dimensions">
        <div className="coverage-shell coverage-heading">
          <p className="coverage-kicker">Five dimensions</p>
          <h2>Coverage has more than one dimension.</h2>
          <p>
            One percentage cannot describe a workflow. Tellann measures five
            distinct dimensions and keeps each of them separately inspectable.
          </p>
        </div>
        <div className="coverage-shell coverage-dimension-cards">
          {coverageDimensions.map(([title, question, master]) => (
            <article key={title}>
              <span>{title}</span>
              <p>{question}</p>
              <ProductPlaceholder
                label={`${title} coverage / miniature data visualization`}
                dimensions={master}
                displayDimensions="196 × 96"
              />
            </article>
          ))}
        </div>
      </section>

      <AsideSection
        wide
        eyebrow="Workflow coverage"
        title="Did you exercise the workflow—or only its happy path?"
        copy="A demonstrated success path is a start, not a finished measurement. Workflow coverage separates the route you took from the routes that remain unexercised."
        mediaWidth={1000}
        visual={{
          label: "Workflow coverage graph / SVG or product UI design",
          master: "1600 × 1000",
          display: "1000 × 625",
        }}
      >
        <p className="coverage-kicker">Checkout</p>
        <div className="coverage-metric-block">
          <span>
            <small>Coverage</small>
            <b>75%</b>
          </span>
          <span>
            <small>Observed paths</small>
            <b>15</b>
          </span>
          <span>
            <small>Missing paths</small>
            <b>5</b>
          </span>
        </div>
        <p className="coverage-panel-label">Observed</p>
        <ul className="coverage-status-list">
          <li>
            <i aria-hidden="true">✓</i> Product → Cart → Checkout → Payment
            success
          </li>
        </ul>
        <p className="coverage-panel-label">Not observed</p>
        <ul className="coverage-status-list is-unobserved">
          {[
            "Payment failure",
            "Session timeout",
            "Inventory changed",
            "Out of stock",
          ].map((item) => (
            <li key={item}>
              <i aria-hidden="true">○</i> {item}
            </li>
          ))}
        </ul>
        <small className="coverage-sample-note">Sample application</small>
      </AsideSection>

      <AsideSection
        reverse
        surface
        eyebrow="State coverage"
        title="Which application states did the demonstration actually reach?"
        copy="A workflow model contains more conditions than a single run will visit. State coverage keeps the reached and unreached conditions side by side."
        mediaWidth={820}
        visual={{
          label: "State coverage inventory / animated SVG design",
          master: "1440 × 900",
          display: "820 × 512",
        }}
      >
        <p className="coverage-panel-label">Observed</p>
        <ul className="coverage-status-list">
          {[
            "PRODUCT_VIEW",
            "CART_ACTIVE",
            "CHECKOUT",
            "PAYMENT_PENDING",
            "PAYMENT_SUCCESS",
          ].map((item) => (
            <li key={item}>
              <i aria-hidden="true">✓</i> {item}
            </li>
          ))}
        </ul>
        <p className="coverage-panel-label">Not observed</p>
        <ul className="coverage-status-list is-unobserved">
          {[
            "PAYMENT_FAILURE",
            "EMPTY_CART",
            "CHECKOUT_LOADING",
            "SESSION_EXPIRED",
          ].map((item) => (
            <li key={item}>
              <i aria-hidden="true">○</i> {item}
            </li>
          ))}
        </ul>
      </AsideSection>

      <AsideSection
        eyebrow="Transition coverage"
        title="A state matters. The path into and out of it matters too."
        copy="Reaching CHECKOUT says nothing about how the application left it. Transition coverage measures the movements, including the ones that never happened."
        mediaWidth={900}
        visual={{
          label: "Transition coverage / animated SVG design",
          master: "1500 × 800",
          display: "900 × 480",
        }}
      >
        <div className="coverage-edge-list">
          {[
            ["CART_ACTIVE → CHECKOUT", "observed"],
            ["CHECKOUT → PAYMENT_SUCCESS", "observed"],
            ["CHECKOUT → PAYMENT_FAILURE", "unobserved"],
            ["CHECKOUT → SESSION_TIMEOUT", "unobserved"],
          ].map(([edge, status]) => (
            <span key={edge} className={status === "observed" ? "" : "is-gap"}>
              <i aria-hidden="true">{status === "observed" ? "✓" : "○"}</i>
              <b>{edge}</b>
              <small>{status === "observed" ? "Observed" : "Unobserved"}</small>
            </span>
          ))}
        </div>
        <p className="coverage-panel-copy">
          Transition frequencies are calculated from reconstructed sessions
          before they contribute to any coverage result.
        </p>
      </AsideSection>

      <section className="coverage-endpoints">
        <div className="coverage-shell coverage-heading">
          <p className="coverage-kicker">Endpoint coverage</p>
          <h2>See which backend behavior supported the demonstrated workflow.</h2>
          <p>
            Interface behavior and backend behavior belong to the same
            measurement. Endpoint coverage reports the requests that actually
            participated in the observed workflow.
          </p>
        </div>
        <div
          className="coverage-shell coverage-aside-grid"
          style={{ "--media-w": "760px" } as CSSProperties}
        >
          <VisualPlaceholder
            label="Endpoint coverage / product UI design"
            master="1600 × 1000"
            display="760 × 475"
          />
          <div className="coverage-aside-panel">
            <p className="coverage-panel-copy">
              Endpoint coverage is built from observed request and response
              activity correlated to the session. Tellann does not claim an
              endpoint exists from source-code analysis if it was never
              observed.
            </p>
            <Link
              href="/product/endpoint-intelligence"
              className="coverage-inline-link"
            >
              Explore Endpoint Intelligence <span>→</span>
            </Link>
          </div>
        </div>
        <div
          className="coverage-shell coverage-endpoint-table"
          role="table"
          aria-label="Checkout workflow endpoint coverage"
        >
          <div role="row" className="is-head">
            <span role="columnheader">Endpoint</span>
            <span role="columnheader">Status</span>
            <span role="columnheader">Sessions</span>
          </div>
          {endpointRows.map(([endpoint, status, sessions]) => (
            <div
              role="row"
              key={endpoint}
              className={status === "Observed" ? "" : "is-gap"}
            >
              <span role="cell">{endpoint}</span>
              <span role="cell">
                <i aria-hidden="true">{status === "Observed" ? "✓" : "○"}</i>
                {status}
              </span>
              <span role="cell">{sessions}</span>
            </div>
          ))}
        </div>
        <small className="coverage-shell coverage-sample-note">
          Sample application data
        </small>
      </section>

      <AsideSection
        reverse
        surface
        eyebrow="Error coverage"
        title="A workflow is not covered simply because success worked."
        copy="Failure, rejection, timeout, and recovery behavior are part of the workflow. Error coverage keeps that half of the process visible instead of assuming it away."
        mediaWidth={900}
        visual={{
          label: "Error coverage branch graph / SVG design",
          master: "1440 × 850",
          display: "900 × 531",
        }}
      >
        <p className="coverage-kicker">Payment</p>
        <div className="coverage-edge-list">
          {[
            ["Successful payment", "observed"],
            ["Payment rejected", "unobserved"],
            ["Gateway error", "unobserved"],
            ["Timeout", "unobserved"],
            ["Retry", "unobserved"],
          ].map(([label, status]) => (
            <span key={label} className={status === "observed" ? "" : "is-gap"}>
              <i aria-hidden="true">{status === "observed" ? "✓" : "○"}</i>
              <b>{label}</b>
              <small>{status === "observed" ? "Observed" : "Unobserved"}</small>
            </span>
          ))}
        </div>
      </AsideSection>

      <section className="coverage-language">
        <div className="coverage-shell coverage-heading">
          <p className="coverage-kicker">Observed vs unobserved</p>
          <h2>Coverage is a map of evidence and absence.</h2>
          <p>
            The same visual language runs through every coverage surface, and it
            never relies on color alone to carry the meaning.
          </p>
        </div>
        <div className="coverage-shell coverage-legend">
          {[
            ["Solid node", "Observed state", "✓"],
            ["Solid edge", "Observed transition", "✓"],
            ["Dashed node", "Potential state not observed", "○"],
            ["Dashed edge", "Potential path not observed", "○"],
            ["Evidence count", "Number of supporting observations", "15"],
          ].map(([term, meaning, glyph]) => (
            <article key={term}>
              <i aria-hidden="true">{glyph}</i>
              <b>{term}</b>
              <p>{meaning}</p>
            </article>
          ))}
        </div>
        <div className="coverage-shell coverage-panels">
          <article>
            <p className="coverage-kicker">Selecting an observed path</p>
            <b>PRODUCT → CART → CHECKOUT → SUCCESS</b>
            <dl>
              {[
                ["Observed in", "15 sessions"],
                ["States", "4"],
                ["Transitions", "3"],
                ["Errors", "0"],
              ].map(([term, value]) => (
                <div key={term}>
                  <dt>{term}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
            <span className="coverage-panel-action">
              View supporting sessions →
            </span>
          </article>
          <article className="is-gap">
            <p className="coverage-kicker">Selecting an unobserved path</p>
            <b>CHECKOUT → PAYMENT_FAILURE</b>
            <dl>
              {[
                ["Status", "Not observed"],
                ["Category", "Failure path"],
                ["Related workflow", "Checkout"],
                ["Suggested next step", "Demonstrate this path"],
              ].map(([term, value]) => (
                <div key={term}>
                  <dt>{term}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
            <span className="coverage-panel-action">
              Demonstrate this path →
            </span>
          </article>
        </div>
        <p className="coverage-shell coverage-note">
          <b>Not a defect:</b> an unobserved path is an absence of evidence. It
          is a question for the team, not an automatic bug report.
        </p>
      </section>

      <section className="coverage-explorer-section" id="explorer">
        <div className="coverage-shell coverage-heading">
          <p className="coverage-kicker">Interactive coverage explorer</p>
          <h2>Explore coverage from score to evidence.</h2>
          <p>
            Choose a workflow, switch between the five dimensions, filter to
            observed or unobserved paths, and open the finding behind any one of
            them. The graph canvas remains a dimension-accurate placeholder for
            the final renderer.
          </p>
        </div>
        <div className="coverage-shell-wide">
          <CoverageExplorer />
        </div>
        <p className="coverage-shell coverage-note">
          <b>Graph or table:</b> coverage is never encoded through color alone.
          Every path is reachable as a table row with an explicit status, and
          the graph view carries the same ✓, ○, and dashed-edge vocabulary.
        </p>
      </section>

      <MediaSection
        surface
        eyebrow="Coverage on the Behavior Graph"
        title="The graph shows exactly where coverage exists."
        copy="Coverage is an overlay on the behavioral model, not a separate dashboard. Observed regions resolve; unobserved branches stay dashed and dimmed."
        note="Master 1920 × 1200 px · Display 1000 × 625 px · 7–9 second loop · Open graph, select coverage, resolve observed regions, open the coverage panel"
        visual={{
          label: "Behavior Graph coverage overlay / product recording",
          master: "1920 × 1200",
          display: "1000 × 625",
        }}
      >
        <div className="coverage-overlay-chain">
          {[
            "Open the Behavior Graph",
            "Select coverage",
            "Observed regions resolve",
            "Unobserved branches stay dashed",
            "Open the coverage panel",
          ].map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
        <div>
          <p className="coverage-panel-copy">
            Because the overlay sits on the same model that Workflow Discovery
            produced, a coverage result and a graph structure never drift into
            two different stories about the application.
          </p>
          <Link href="/product/behavior-graphs" className="coverage-inline-link">
            Explore Behavior Graphs <span>→</span>
          </Link>
        </div>
      </MediaSection>

      <section className="coverage-incomplete">
        <div className="coverage-shell coverage-heading">
          <p className="coverage-kicker">Incomplete workflows</p>
          <h2>A workflow can exist without being fully exercised.</h2>
          <p>
            Discovering a workflow and exercising a workflow are different
            achievements. Incomplete coverage describes the second one honestly.
          </p>
        </div>
        <div className="coverage-shell coverage-incomplete-cards">
          {incompleteWorkflows.map(
            ([name, coverage, observed, unobserved, gaps]) => (
              <article key={name}>
                <span>{name}</span>
                <b>{coverage}</b>
                <div>
                  <p>
                    <small>Observed paths</small>
                    <i>{observed}</i>
                  </p>
                  <p>
                    <small>Unobserved paths</small>
                    <i>{unobserved}</i>
                  </p>
                </div>
                <small>Potential gaps</small>
                <ul>
                  {gaps.map((gap) => (
                    <li key={gap}>{gap}</li>
                  ))}
                </ul>
              </article>
            ),
          )}
        </div>
        <p className="coverage-shell coverage-note">
          <b>Incomplete coverage, not a broken workflow:</b> the wording matters.
          A workflow with unexercised branches is under-demonstrated, which is a
          different finding from a workflow that failed.
        </p>
      </section>

      <section className="coverage-critical">
        <div className="coverage-shell coverage-heading">
          <p className="coverage-kicker">Critical gaps</p>
          <h2>Not every uncovered path deserves equal attention.</h2>
          <p>
            Low coverage on a critical workflow is a different signal from low
            coverage on a peripheral one. Priority comes from configured
            workflow importance rather than an inferred guess.
          </p>
        </div>
        <div className="coverage-shell coverage-critical-grid">
          <article>
            <p className="coverage-kicker">Critical workflow</p>
            <b>Checkout</b>
            <dl>
              {[
                ["Criticality", "High"],
                ["Coverage", "45%"],
                ["Missing paths", "5"],
              ].map(([term, value]) => (
                <div key={term}>
                  <dt>{term}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
            <small>Potential gaps</small>
            <ul className="coverage-status-list is-unobserved">
              {["Payment failure", "Session timeout", "Inventory change"].map(
                (item) => (
                  <li key={item}>
                    <i aria-hidden="true">○</i> {item}
                  </li>
                ),
              )}
            </ul>
          </article>
          <div className="coverage-priority">
            <p className="coverage-kicker">Workflow priority</p>
            {["Critical", "High", "Normal", "Low"].map((level, index) => (
              <span key={level} className={index === 0 ? "is-active" : ""}>
                {level}
              </span>
            ))}
            <p className="coverage-panel-copy">
              Criticality is a configured product decision. Tellann highlights
              low coverage against that configuration instead of silently
              inferring which workflows matter to your business.
            </p>
          </div>
        </div>
      </section>

      <MediaSection
        eyebrow="Missing states + coverage"
        title="Sometimes the missing piece is a state, not an entire workflow."
        copy="Loading, empty, error, and recovery conditions are easy to skip in a demonstration and easy to miss in production. Coverage makes their absence explicit."
        note="Master 1600 × 900 px · Display 1000 × 562 px · Observed flow, then loading, empty, and error placeholders appear"
        visual={{
          label: "Missing state analysis / animated SVG design",
          master: "1600 × 900",
          display: "1000 × 562",
        }}
      >
        <div>
          <p className="coverage-kicker">Search</p>
          <p className="coverage-panel-label">Observed</p>
          <ul className="coverage-status-list">
            <li>
              <i aria-hidden="true">✓</i> Results populated
            </li>
          </ul>
        </div>
        <div>
          <p className="coverage-panel-label">Potential missing states</p>
          <ul className="coverage-status-list is-unobserved">
            {["Loading", "Empty results", "API error"].map((item) => (
              <li key={item}>
                <i aria-hidden="true">○</i> {item}
              </li>
            ))}
          </ul>
          <Link href="/product/missing-states" className="coverage-inline-link">
            Explore Missing States <span>→</span>
          </Link>
        </div>
      </MediaSection>

      <MediaSection
        surface
        eyebrow="Missing flows + coverage"
        title="Sometimes the missing piece is an entire branch."
        copy="A missing flow is a complete path the model expects but the demonstration never took—grouped into error, alternative, and recovery flows rather than a flat list."
        note="Master 1600 × 900 px · Display 1000 × 562 px · Observed branch, then unobserved branches extend from the same entry state"
        visual={{
          label: "Missing flow analysis / animated SVG design",
          master: "1600 × 900",
          display: "1000 × 562",
        }}
      >
        <div>
          <p className="coverage-kicker">Login</p>
          <p className="coverage-panel-label">Observed</p>
          <ul className="coverage-status-list">
            <li>
              <i aria-hidden="true">✓</i> Credentials → Authenticated
            </li>
          </ul>
        </div>
        <div>
          <p className="coverage-panel-label">Unobserved</p>
          <ul className="coverage-status-list is-unobserved">
            {[
              "Invalid password",
              "Account locked",
              "Password reset",
              "Session expired",
            ].map((item) => (
              <li key={item}>
                <i aria-hidden="true">○</i> {item}
              </li>
            ))}
          </ul>
          <Link href="/product/missing-flows" className="coverage-inline-link">
            Explore Missing Flows <span>→</span>
          </Link>
        </div>
      </MediaSection>

      <MediaSection
        eyebrow="Coverage + session evidence"
        title="Every observed path should be backed by sessions."
        copy="A coverage result that cannot name its evidence is just a number. Each observed path leads to its supporting sessions, and each session opens in replay."
        note="Master 1920 × 1200 px · Display 1000 × 625 px · 8–10 second loop · Coverage, observed path, supporting sessions, replay"
        visual={{
          label: "Coverage to Session Replay / product recording",
          master: "1920 × 1200",
          display: "1000 × 625",
        }}
      >
        <div>
          <p className="coverage-kicker">Observed path</p>
          <ul className="coverage-status-list">
            <li>
              <i aria-hidden="true">✓</i> Product → Cart → Checkout → Success
            </li>
          </ul>
          <p className="coverage-panel-copy">
            Observed in 15 sessions. Selecting one opens the reconstructed
            timeline at the relevant moment.
          </p>
        </div>
        <div>
          <p className="coverage-panel-label">Supporting sessions</p>
          <div className="coverage-session-chips">
            {["SES-3817", "SES-3824", "SES-3901", "SES-4012", "SES-4044"].map(
              (item) => (
                <span key={item}>{item}</span>
              ),
            )}
          </div>
          <Link href="/product/session-replay" className="coverage-inline-link">
            Explore Session Replay <span>→</span>
          </Link>
        </div>
      </MediaSection>

      <MediaSection
        surface
        eyebrow="Coverage comparison"
        title="See what changed between demonstrations."
        copy="Comparing two demonstration sessions shows what the second one added to the behavioral model. This is demonstrated-coverage comparison, not automated release regression detection."
        note="Master 1800 × 1000 px · Display 1100 × 611 px · 6 second sequence · Session A graph, session B graph, newly observed state, coverage delta"
        visual={{
          label: "Session coverage comparison / animated SVG or UI design",
          master: "1800 × 1000",
          display: "1100 × 611",
        }}
      >
        <div
          className="coverage-comparison-table"
          role="table"
          aria-label="Coverage compared across two demonstration sessions"
        >
          <div role="row" className="is-head">
            <span role="columnheader">Dimension</span>
            <span role="columnheader">Session A</span>
            <span role="columnheader">Session B</span>
          </div>
          {comparisonMetrics.map(([dimension, a, b]) => (
            <div role="row" key={dimension}>
              <span role="cell">{dimension}</span>
              <span role="cell">{a}</span>
              <span role="cell">{b}</span>
            </div>
          ))}
        </div>
        <div>
          <p className="coverage-panel-label">Newly observed</p>
          <ul className="coverage-status-list">
            <li>
              <i aria-hidden="true">✓</i> PAYMENT_FAILURE
            </li>
          </ul>
          <p className="coverage-panel-copy">
            All values illustrative. Session-to-session comparison is a Phase 1
            capability; release-level regression analysis is planned for a later
            phase.
          </p>
        </div>
      </MediaSection>

      <AsideSection
        reverse
        eyebrow="Coverage report"
        title="Turn coverage into a QA artifact."
        copy="The Flow Coverage Report packages workflow completeness—coverage across all five dimensions, observed paths, and missing paths—into something a team can circulate and act on."
        mediaWidth={600}
        visual={{
          label: "Flow Coverage Report / portrait report UI design",
          master: "1000 × 1280",
          display: "600 × 768",
        }}
      >
        <div className="coverage-report-summary">
          {[
            ["Application", "Storefront Demo"],
            ["Workflow", "CHECKOUT"],
            ["Coverage", "75%"],
            ["Observed paths", "15"],
            ["Missing paths", "5"],
          ].map(([term, value]) => (
            <span key={term}>
              <small>{term}</small>
              <b>{value}</b>
            </span>
          ))}
        </div>
        <p className="coverage-panel-label">Coverage metrics</p>
        <dl className="coverage-report-metrics">
          {[
            ["Workflow", "75%"],
            ["State", "83%"],
            ["Transition", "71%"],
            ["Endpoint", "89%"],
            ["Error", "40%"],
          ].map(([term, value]) => (
            <div key={term}>
              <dt>{term}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        <p className="coverage-panel-label">Missing</p>
        <ul className="coverage-status-list is-unobserved">
          {[
            "Payment failure",
            "Out of stock",
            "Inventory changed",
            "Session timeout",
            "Gateway failure",
          ].map((item) => (
            <li key={item}>
              <i aria-hidden="true">○</i> {item}
            </li>
          ))}
        </ul>
        <div className="coverage-export-strip">
          <small>Export</small>
          {["PDF", "CSV", "JSON", "HTML"].map((format) => (
            <span key={format}>{format}</span>
          ))}
        </div>
        <Link href="/product/qa-reports" className="coverage-inline-link">
          View QA Reports <span>→</span>
        </Link>
      </AsideSection>

      <MediaSection
        surface
        eyebrow="Improving coverage"
        title="The next useful demonstration is the one that fills a real gap."
        copy="Coverage becomes actionable when it tells you what to demonstrate next. Analyze, find a gap, demonstrate it, and the behavioral model expands."
        note="Master 1600 × 900 px · Display 1000 × 562 px · Coverage, missing branch selected, new demonstration, branch becomes observed"
        visual={{
          label: "Coverage improvement loop / animated SVG design",
          master: "1600 × 900",
          display: "1000 × 562",
        }}
      >
        <div className="coverage-loop">
          {[
            ["01", "Analyze", "Demonstrate Checkout success. Coverage 45%."],
            ["02", "Find gap", "Payment failure and session timeout surface."],
            ["03", "Demonstrate", "Record the payment-failure path."],
            ["04", "Re-analyze", "The branch becomes observed."],
            ["05", "Expand", "The model grows and coverage resolves upward."],
          ].map(([number, title, copy]) => (
            <span key={title}>
              <small>{number}</small>
              <b>{title}</b>
              <i>{copy}</i>
            </span>
          ))}
        </div>
        <div>
          <div className="coverage-gap-cta">
            <p>
              <b>PAYMENT_FAILURE</b>
              <small>Not observed</small>
            </p>
            <span>Demonstrate this path →</span>
          </div>
          <p className="coverage-panel-copy">
            The illustrated percentages are examples. A real result depends on
            the workflow model and the demonstrations behind it.
          </p>
        </div>
      </MediaSection>

      <section className="coverage-caveats">
        <div className="coverage-shell coverage-heading">
          <p className="coverage-kicker">What coverage does not mean</p>
          <h2>Coverage is evidence—not a guarantee.</h2>
          <p>
            A coverage score describes the behavioral surface you exercised
            against the model Tellann is analyzing. It does not describe
            correctness.
          </p>
        </div>
        <div className="coverage-shell coverage-caveat-grid">
          {[
            [
              "90% coverage",
              "does not mean the application is 90% bug-free.",
            ],
            [
              "100% observed workflow coverage",
              "does not mean every possible failure condition has been tested.",
            ],
            [
              "An unobserved path",
              "does not automatically mean there is a bug.",
            ],
            [
              "Observation",
              "is not verification. Tellann saw the behavior; it did not assert that the behavior was correct.",
            ],
          ].map(([claim, correction]) => (
            <article key={claim}>
              <b>{claim}</b>
              <p>{correction}</p>
            </article>
          ))}
        </div>
        <div className="coverage-shell coverage-vocabulary">
          <p className="coverage-kicker">Status vocabulary</p>
          <dl>
            {statusVocabulary.map(([term, meaning]) => (
              <div key={term}>
                <dt>{term}</dt>
                <dd>{meaning}</dd>
              </div>
            ))}
          </dl>
          <p className="coverage-panel-copy">
            Tellann avoids <b>passed</b> as a coverage status. Passing implies
            validation criteria were applied, and observation alone does not
            apply them.
          </p>
        </div>
      </section>

      <section className="coverage-future">
        <div className="coverage-shell coverage-heading">
          <p className="coverage-kicker">Where coverage goes next</p>
          <h2>Current measurement stays separate from planned intelligence.</h2>
          <p>
            Phase 1 measures demonstrated behavior. Production coverage and
            release-level analysis are labelled as planned rather than blended
            into what exists today.
          </p>
        </div>
        <div className="coverage-shell coverage-phase-grid">
          <article>
            <span>Phase 01 · Behavioral QA</span>
            <p>
              Workflow coverage · State coverage · Transition coverage ·
              Endpoint coverage · Error coverage · Observed and unobserved paths
              · Session comparison · Coverage reports
            </p>
          </article>
          <article>
            <span>Phase 02 · Planned</span>
            <p>
              Production coverage comparison · Workflow-health context ·
              Real-user journey coverage · Behavior trends
            </p>
          </article>
          <article>
            <span>Phase 03 · Planned</span>
            <p>
              Release coverage delta · Regression analysis · Generated
              validation coverage · Risk-oriented quality intelligence
            </p>
          </article>
        </div>
      </section>

      <section className="coverage-faq">
        <div className="coverage-shell coverage-faq-grid">
          <div>
            <p className="coverage-kicker">FAQ</p>
            <h2>Questions behind the percentage.</h2>
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

      <section className="coverage-final">
        <div className="coverage-shell">
          <p className="coverage-kicker">See what you haven&apos;t exercised</p>
          <h2>Turn one workflow into measurable behavioral coverage.</h2>
          <p>
            Demonstrate an application workflow and see which states,
            transitions, endpoints, errors, and paths Tellann observed—and where
            the remaining gaps may be.
          </p>
          <div className="coverage-actions">
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
