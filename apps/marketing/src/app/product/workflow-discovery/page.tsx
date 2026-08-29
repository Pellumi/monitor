import type { Metadata } from "next";
import Link from "next/link";
import { ProductPlaceholder } from "@/components/product-tour";
import { WorkflowExplorer } from "@/components/workflow-explorer";
import "./workflow-discovery.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://domain-name.com";
const dashboardUrl =
  process.env.NEXT_PUBLIC_APP_URL || "https://app.domain-name.com";

export const metadata: Metadata = {
  title:
    "Workflow Discovery — Automatically Map Application Workflows | Tellann",
  description:
    "See how Tellann discovers application workflows from observed behavior, identifies entry and exit points, maps states and transitions, measures coverage, exposes missing paths, and connects workflows to sessions and API activity.",
  alternates: { canonical: "/product/workflow-discovery" },
  openGraph: {
    title:
      "Workflow Discovery — Automatically Map Application Workflows | Tellann",
    description:
      "Turn observed application behavior into structured, evidence-backed workflows.",
    url: `${siteUrl}/product/workflow-discovery`,
    type: "website",
  },
};

type Visual = {
  label: string;
  master: string;
  display: string;
  className?: string;
};
function VisualPlaceholder({ label, master, display, className = "" }: Visual) {
  return (
    <ProductPlaceholder
      label={label}
      dimensions={master}
      displayDimensions={display}
      className={className}
    />
  );
}

const faqs = [
  [
    "What is Workflow Discovery?",
    "Workflow Discovery identifies connected regions of observed behavior that represent meaningful processes such as registration, login, checkout, or password recovery.",
  ],
  [
    "How does Tellann identify a workflow?",
    "Tellann reconstructs sessions, extracts states and transitions, recognizes recurring connected paths, and proposes meaningful workflow boundaries from that evidence.",
  ],
  [
    "Do I have to manually name workflows?",
    "No. Tellann can propose workflow labels from observed structure and context, while keeping names reviewable rather than presenting an inferred label as unquestionable truth.",
  ],
  [
    "What is a workflow entry point?",
    "An entry point is the state or transition where a meaningful process begins, such as PRODUCT_VIEW for a checkout workflow.",
  ],
  [
    "Can a workflow have several paths?",
    "Yes. A workflow can preserve success, failure, recovery, retry, and alternate paths around the same objective.",
  ],
  [
    "Can I replay the evidence behind a workflow?",
    "Phase 1 connects discovered workflows to their supporting demonstration sessions and reconstructed replay context.",
  ],
  [
    "Does this monitor production users?",
    "Not in the current Phase 1 positioning. Workflow Discovery begins from controlled demonstration evidence rather than claiming continuous production journey intelligence.",
  ],
  [
    "Does Tellann automatically generate tests?",
    "Generated validation scenarios belong to future product direction. Current workflow discovery structures evidence for coverage, missing-path analysis, and QA planning.",
  ],
];

function SplitSection({
  eyebrow,
  title,
  copy,
  visual,
  reverse = false,
  children,
}: {
  eyebrow: string;
  title: string;
  copy: string;
  visual: Visual;
  reverse?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <section className={`workflow-split${reverse ? " is-reverse" : ""}`}>
      <div className="workflow-shell workflow-split-grid">
        <div className="workflow-copy">
          <p className="workflow-kicker">{eyebrow}</p>
          <h2>{title}</h2>
          <p>{copy}</p>
          {children}
        </div>
        <VisualPlaceholder {...visual} />
      </div>
    </section>
  );
}

export default function WorkflowDiscoveryPage() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Tellann Workflow Discovery",
    description: metadata.description,
    url: `${siteUrl}/product/workflow-discovery`,
  };
  return (
    <main className="workflow-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      <section className="workflow-hero">
        <div className="workflow-shell workflow-hero-copy">
          <p className="workflow-kicker">Workflow discovery</p>
          <h1>See the workflows hidden inside application behavior.</h1>
          <p>
            Tellann reconstructs observed sessions into states and transitions,
            then identifies the connected regions that represent meaningful
            processes—giving engineering and QA teams workflows they can
            explore, measure, and trace back to evidence.
          </p>
          <div className="workflow-actions">
            <a className="is-primary" href="#explorer">
              Explore a discovered workflow <span>↓</span>
            </a>
            <a href="#discovery">
              See how discovery works <span>↓</span>
            </a>
          </div>
        </div>
        <div className="workflow-shell-wide workflow-hero-media workflow-desktop-media">
          <VisualPlaceholder
            label="Hero workflow discovery / SVG or canvas design"
            master="1920 × 1150"
            display="1360 × 800"
          />
          <p>
            Master: 1920 × 1150 px · Intended desktop display: 1360 × 800 px
          </p>
        </div>
        <div className="workflow-mobile-media">
          <VisualPlaceholder
            label="Mobile workflow discovery / simplified SVG design"
            master="1080 × 1440"
            display="1080 × 1440"
          />
          <p>
            Mobile master: 1080 × 1440 px · Responsive display preserves the 3:4
            ratio
          </p>
        </div>
      </section>

      <section className="workflow-transformation">
        <div className="workflow-shell workflow-heading">
          <p className="workflow-kicker">From events to objectives</p>
          <h2>Workflows emerge from observed behavior.</h2>
          <p>
            Events say something happened. States explain where the application
            was. Transitions describe movement. Workflow Discovery identifies
            which connected sequences represent a meaningful process.
          </p>
        </div>
        <div className="workflow-shell workflow-sequence">
          {[
            "Events",
            "Sessions",
            "States",
            "Transitions",
            "Behavior Graph",
            "Workflow",
          ].map((item, index) => (
            <div key={item}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <b>{item}</b>
              {index < 5 ? <i>→</i> : null}
            </div>
          ))}
        </div>
        <div className="workflow-contained-media">
          <VisualPlaceholder
            label="Events to workflow / animated SVG design"
            master="1800 × 1000"
            display="1100 × 611"
          />
        </div>
      </section>

      <section className="workflow-anatomy">
        <div className="workflow-shell workflow-heading">
          <p className="workflow-kicker">Workflow anatomy</p>
          <h2>A workflow is behavior with an objective.</h2>
          <p>
            A workflow contains an entry state, a connected set of states and
            transitions, success and failure branches, and one or more
            meaningful outcomes.
          </p>
        </div>
        <div className="workflow-shell workflow-anatomy-grid">
          {[
            ["01", "Entry", "Where the process begins.", "PRODUCT_VIEW"],
            [
              "02",
              "States",
              "Meaningful conditions along the way.",
              "CART_ACTIVE · CHECKOUT",
            ],
            [
              "03",
              "Paths",
              "Success, failure, and recovery branches.",
              "SUCCESS · FAILURE · RETRY",
            ],
            ["04", "Exit", "Where the objective resolves.", "ORDER_COMPLETE"],
          ].map(([number, title, copy, example]) => (
            <article key={title}>
              <span>{number}</span>
              <h3>{title}</h3>
              <p>{copy}</p>
              <code>{example}</code>
            </article>
          ))}
        </div>
        <div className="workflow-contained-media">
          <VisualPlaceholder
            label="Workflow anatomy / SVG design"
            master="1600 × 1000"
            display="900 × 562"
          />
        </div>
      </section>

      <section className="workflow-discovery" id="discovery">
        <div className="workflow-shell workflow-heading">
          <p className="workflow-kicker">Automatic discovery</p>
          <h2>The workflow is discovered not manually wired together.</h2>
          <p>
            Tellann observes repeated connected behavior, proposes boundaries
            around meaningful paths, and keeps the proposed workflow linked to
            the sessions that produced it.
          </p>
        </div>
        <div className="workflow-shell workflow-discovery-steps">
          {["Observe", "Repeat", "Cluster", "Bound", "Name", "Measure"].map(
            (step, index) => (
              <div key={step}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <b>{step}</b>
              </div>
            ),
          )}
        </div>
        <div className="workflow-contained-media">
          <VisualPlaceholder
            label="Automatic workflow discovery / animated SVG design"
            master="1800 × 1000"
            display="1100 × 611"
          />
        </div>
        <p className="workflow-shell workflow-note">
          <b>Reviewable labels:</b> Tellann can propose names from observed
          context, but an inferred label remains distinct from a manually
          confirmed product requirement.
        </p>
      </section>

      <SplitSection
        eyebrow="Entry points"
        title="Where does a workflow actually begin?"
        copy="An entry point marks the state or transition where a meaningful objective starts. The same application screen can participate in different workflows depending on the path and intent around it."
        visual={{
          label: "Entry-point diagram / SVG design",
          master: "1400 × 700",
          display: "900 × 450",
        }}
      >
        <div className="workflow-chip-row">
          <span>PRODUCT_VIEW</span>
          <span>LOGIN_FORM</span>
          <span>SETTINGS</span>
        </div>
      </SplitSection>

      <SplitSection
        reverse
        eyebrow="Exit points"
        title="And where is the objective considered complete?"
        copy="Exit points describe how the workflow resolves. A successful outcome, a failure state, or a recovery path can each provide a meaningful boundary without pretending every path ends happily."
        visual={{
          label: "Entry and exit comparison / SVG design",
          master: "1500 × 600",
          display: "1000 × 400",
        }}
      >
        <div className="workflow-definition">
          <span>
            <small>Entry</small>
            <b>PRODUCT_VIEW</b>
          </span>
          <i>→</i>
          <span>
            <small>Exit</small>
            <b>ORDER_COMPLETE</b>
          </span>
        </div>
      </SplitSection>

      <SplitSection
        eyebrow="Workflow boundaries"
        title="Tellann separates meaningful processes from the larger graph."
        copy="Connected behavior can belong to a broad application graph. Discovery isolates the region that serves a recognizable objective while preserving its relationships to nearby states."
        visual={{
          label: "Workflow boundary discovery / animated SVG design",
          master: "1800 × 1000",
          display: "1100 × 611",
        }}
      >
        <ul className="workflow-list">
          <li>Recognize repeated connected paths</li>
          <li>Identify entry and exit markers</li>
          <li>Preserve alternate branches</li>
          <li>Keep source evidence attached</li>
        </ul>
      </SplitSection>

      <section className="workflow-paths">
        <div className="workflow-shell workflow-heading">
          <p className="workflow-kicker">Paths and outcomes</p>
          <h2>Real workflows branch.</h2>
          <p>
            Success is only one path. Failures, retries, recoveries, and
            alternate outcomes often reveal the states that teams most need to
            demonstrate and validate.
          </p>
        </div>
        <div className="workflow-shell workflow-path-grid">
          {[
            ["Success", "Observed completion path"],
            ["Failure", "Observed unsuccessful outcome"],
            ["Recovery", "Return from a failure state"],
            ["Alternative", "A different valid route"],
          ].map(([title, copy]) => (
            <article key={title}>
              <span>{title}</span>
              <p>{copy}</p>
              <VisualPlaceholder
                label={`${title} path / miniature workflow graph`}
                master="540 × 400"
                display="270 × 200"
              />
            </article>
          ))}
        </div>
      </section>

      <SplitSection
        reverse
        eyebrow="Recurring behavior"
        title="Repeated paths reveal the workflows that keep happening."
        copy="As controlled demonstrations repeat a connected sequence, Tellann can distinguish recurring structure from a one-off collection of unrelated events."
        visual={{
          label: "Recurring workflow pattern / frequency animation design",
          master: "1500 × 800",
          display: "960 × 512",
        }}
      >
        <div className="workflow-stat-row">
          <span>
            <small>Observed sessions</small>
            <b>143</b>
          </span>
          <span>
            <small>Recurring path</small>
            <b>Product → Checkout</b>
          </span>
        </div>
      </SplitSection>

      <section className="workflow-explorer-section" id="explorer">
        <div className="workflow-shell workflow-heading">
          <p className="workflow-kicker">Interactive workflow explorer</p>
          <h2>Explore discovered workflows as living structures.</h2>
          <p>
            Select a workflow, compare observed and missing paths, inspect
            boundaries and metrics, and reveal associated API context around a
            dimension-accurate placeholder for the final graph renderer.
          </p>
        </div>
        <div className="workflow-shell-wide">
          <WorkflowExplorer />
        </div>
      </section>

      <section className="workflow-inventory">
        <div className="workflow-shell workflow-heading">
          <p className="workflow-kicker">Workflow inventory</p>
          <h2>Turn an application into an inventory of behavior.</h2>
          <p>
            A structured inventory lets teams find critical workflows,
            understand their current evidence, and choose where another
            demonstration is needed.
          </p>
        </div>
        <div
          className="workflow-shell workflow-table"
          role="table"
          aria-label="Illustrative workflow inventory"
        >
          <div role="row" className="is-head">
            <span>Workflow</span>
            <span>Entry</span>
            <span>Exit</span>
            <span>Sessions</span>
            <span>Coverage</span>
          </div>
          {[
            ["Checkout", "PRODUCT_VIEW", "ORDER_COMPLETE", "143", "75%"],
            ["Registration", "ANONYMOUS", "REGISTERED", "96", "81%"],
            ["Login", "ANONYMOUS", "AUTHENTICATED", "184", "70%"],
            ["Search", "PRODUCTS", "PRODUCT_VIEW", "218", "77%"],
            ["Password recovery", "LOGIN", "PASSWORD_RESET", "42", "58%"],
          ].map((row) => (
            <div role="row" key={row[0]}>
              {row.map((cell) => (
                <span role="cell" key={cell}>
                  {cell}
                </span>
              ))}
            </div>
          ))}
        </div>
      </section>

      <SplitSection
        eyebrow="Workflow metrics"
        title="A discovered workflow becomes measurable."
        copy="Tellann can summarize demonstration evidence around workflow structure without claiming Phase 2 production abandonment or friction intelligence."
        visual={{
          label: "Workflow metrics / product UI design",
          master: "1600 × 900",
          display: "800 × 450",
        }}
      >
        <div className="workflow-metrics">
          <span>
            Entry <b>PRODUCT_VIEW</b>
          </span>
          <span>
            Exit <b>ORDER_COMPLETE</b>
          </span>
          <span>
            States <b>12</b>
          </span>
          <span>
            Transitions <b>18</b>
          </span>
          <span>
            Coverage <b>75%</b>
          </span>
        </div>
      </SplitSection>

      <SplitSection
        reverse
        eyebrow="Workflow coverage"
        title="Discovery gives coverage something meaningful to measure."
        copy="Instead of counting isolated events, coverage can describe which states, transitions, and paths within a meaningful workflow were actually exercised."
        visual={{
          label: "Workflow coverage / animated SVG design",
          master: "1600 × 900",
          display: "1000 × 562",
        }}
      >
        <div className="workflow-coverage">
          <span>
            <small>Observed paths</small>
            <b>15</b>
          </span>
          <span>
            <small>Missing paths</small>
            <b>5</b>
          </span>
          <span>
            <small>Coverage</small>
            <b>75%</b>
          </span>
        </div>
      </SplitSection>

      <SplitSection
        eyebrow="Missing and incomplete workflows"
        title="A discovered workflow also makes its missing branches visible."
        copy="Potential failure, recovery, alternative, and edge-case paths can be surfaced as questions for the team. Not observed does not automatically mean defective."
        visual={{
          label: "Missing workflow paths / animated SVG design",
          master: "1600 × 900",
          display: "1000 × 562",
        }}
      >
        <div className="workflow-gaps">
          <span>
            INVALID_PASSWORD <b>Potential gap</b>
          </span>
          <span>
            ACCOUNT_LOCKED <b>Not observed</b>
          </span>
          <span>
            SESSION_EXPIRED <b>Not observed</b>
          </span>
        </div>
      </SplitSection>

      <section className="workflow-evidence">
        <div className="workflow-shell workflow-evidence-grid">
          <article>
            <p className="workflow-kicker">Workflow + sessions</p>
            <h2>
              Every discovered workflow should lead back to what was observed.
            </h2>
            <p>
              Open the supporting sessions and move from the workflow into the
              reconstructed timeline that produced it.
            </p>
            <VisualPlaceholder
              label="Workflow to Session Replay / product video placeholder"
              master="1920 × 1200"
              display="1000 × 625"
            />
          </article>
          <article>
            <p className="workflow-kicker">Workflow + endpoints</p>
            <h2>See the APIs involved in a workflow.</h2>
            <p>
              Reveal backend requests on the transitions where they
              participated, keeping interface and endpoint behavior connected.
            </p>
            <VisualPlaceholder
              label="Workflow endpoint overlay / interactive SVG or UI design"
              master="1600 × 1000"
              display="900 × 562"
            />
          </article>
        </div>
      </section>

      <SplitSection
        reverse
        eyebrow="Multiple demonstrations"
        title="New demonstrations can reveal new workflows and new branches."
        copy="Registration, search, checkout, and payment recovery can emerge across separate controlled demonstrations and join one application inventory."
        visual={{
          label: "Multi-demonstration workflow discovery / animated SVG design",
          master: "1800 × 1000",
          display: "1100 × 611",
        }}
      >
        <div className="workflow-stat-row">
          <span>
            <small>Workflows</small>
            <b>4 → 6</b>
          </span>
          <span>
            <small>Observed paths</small>
            <b>12 → 21</b>
          </span>
        </div>
      </SplitSection>

      <SplitSection
        eyebrow="Workflow reports"
        title="A discovered workflow can become a QA artifact."
        copy="Package the workflow graph, state and transition inventories, success and failure paths, and evidence-backed recommendations into a focused report."
        visual={{
          label: "Workflow Report / portrait UI design",
          master: "1000 × 1280",
          display: "760 × 973",
        }}
      >
        <ul className="workflow-list">
          <li>Workflow graph</li>
          <li>State and transition inventory</li>
          <li>Success and failure paths</li>
          <li>Recommendations</li>
        </ul>
      </SplitSection>

      <section className="workflow-comparison">
        <div className="workflow-shell workflow-heading">
          <p className="workflow-kicker">Observed, not manually maintained</p>
          <h2>
            The map should follow the application.
          </h2>
          <p>
            Tellann derives workflow structure from evidence while keeping the
            distinction between observed behavior and expected requirements
            explicit.
          </p>
        </div>
        <div className="workflow-shell workflow-compare">
          <article>
            <span>Traditional workflow documentation</span>
            {[
              "Manually drawn",
              "Often outdated",
              "Describes intended flow",
              "Separate from telemetry",
              "Difficult to measure",
            ].map((item) => (
              <p key={item}>{item}</p>
            ))}
          </article>
          <article>
            <span>Tellann Workflow Discovery</span>
            {[
              "Derived from observed sessions",
              "Regenerated from evidence",
              "Represents observed flow",
              "Traceable to sessions and events",
              "Feeds coverage analysis",
            ].map((item) => (
              <p key={item}>{item}</p>
            ))}
          </article>
        </div>
        <div className="workflow-shell workflow-observed">
          <article>
            <span>Observed workflow</span>
            <h3>What Tellann saw happen.</h3>
            <p>
              Evidence-backed states and transitions reconstructed from
              demonstrations.
            </p>
          </article>
          <article>
            <span>Expected or potential path</span>
            <h3>What may still need evidence.</h3>
            <p>
              A path suggested by rules, declared intent, or analysis that was
              not observed.
            </p>
          </article>
        </div>
      </section>

      <section className="workflow-relationships">
        <div className="workflow-shell workflow-heading">
          <p className="workflow-kicker">The quality reasoning chain</p>
          <h2>
            Behavior Graphs provide the map. Workflow Discovery gives the map
            meaning.
          </h2>
          <p>
            A discovered workflow becomes the unit that coverage, missing-path
            analysis, evidence review, and QA reporting can reason about.
          </p>
        </div>
        <div className="workflow-shell workflow-relation-flow">
          {[
            "Behavior Graph",
            "Workflow Discovery",
            "Flow Coverage",
            "Missing Paths",
            "QA Report",
          ].map((item, index) => (
            <div key={item}>
              <b>{item}</b>
              {index < 4 ? <i>→</i> : null}
            </div>
          ))}
        </div>
        <div className="workflow-shell workflow-inline-link">
          <Link href="/product/behavior-graphs">
            Explore Behavior Graphs <span>→</span>
          </Link>
        </div>
      </section>

      <section className="workflow-future">
        <div className="workflow-shell workflow-heading">
          <p className="workflow-kicker">
            Where workflow intelligence goes next
          </p>
          <h2>The model can support progressively deeper intelligence.</h2>
          <p>
            Future capabilities stay explicitly labelled as planned rather than
            being blended into the current demonstration-led product.
          </p>
        </div>
        <div className="workflow-shell workflow-phase-grid">
          <article>
            <span>Phase 01 · Product direction</span>
            <p>
              Discovery · Boundaries · Entry and exit points · Workflow maps ·
              Coverage · Missing paths
            </p>
          </article>
          <article>
            <span>Phase 02 · Planned</span>
            <p>
              Production workflow models · Common journeys · Abandonment ·
              Friction · Bottlenecks · Health
            </p>
          </article>
          <article>
            <span>Phase 03 · Planned</span>
            <p>
              Workflow comparison · Regression detection · Generated validation
              scenarios · Behavioral anomaly detection
            </p>
          </article>
        </div>
      </section>

      <section className="workflow-faq">
        <div className="workflow-shell workflow-faq-grid">
          <div>
            <p className="workflow-kicker">FAQ</p>
            <h2>Questions behind discovery.</h2>
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

      <section className="workflow-final">
        <div className="workflow-shell">
          <p className="workflow-kicker">Discover your first workflow</p>
          <h2>Show Tellann what happens. Let the workflow emerge.</h2>
          <p>
            Record a demonstration and turn observed states and transitions into
            structured workflows your team can explore, measure, and use as QA
            evidence.
          </p>
          <div className="workflow-actions">
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
