import type { Metadata } from "next";
import Link from "next/link";
import { BehaviorGraphExplorer } from "@/components/behavior-graph-explorer";
import { ProductPlaceholder } from "@/components/product-tour";
import "./behavior-graphs.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://domain-name.com";
const dashboardUrl =
  process.env.NEXT_PUBLIC_APP_URL || "https://app.domain-name.com";

export const metadata: Metadata = {
  title: "Behavior Graphs: Map How Your Software Actually Behaves | Tellann",
  description:
    "See how Tellann turns observed application sessions into states, actions, transitions, workflows, and Behavior Graphs for coverage, gap detection, replay context, and behavioral QA.",
  alternates: { canonical: "/product/behavior-graphs" },
  openGraph: {
    title: "Behavior Graphs: Map How Your Software Actually Behaves | Tellann",
    description:
      "Turn application behavior into a structural model your engineering and QA teams can reason about.",
    url: `${siteUrl}/product/behavior-graphs`,
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

const concepts = [
  [
    "01",
    "State",
    "Where the user or system is.",
    "CHECKOUT · CART_ACTIVE · PAYMENT_FAILURE",
  ],
  [
    "02",
    "Action",
    "What caused something to happen.",
    "BUTTON_CLICK · FORM_SUBMITTED · API_RESPONSE",
  ],
  ["03", "Transition", "How the application moved.", "CART_ACTIVE → CHECKOUT"],
  [
    "04",
    "Workflow",
    "What business objective the sequence represents.",
    "Product → Cart → Checkout → Payment",
  ],
];

const faqs = [
  [
    "What is a Behavior Graph?",
    "A Behavior Graph is a structural model of meaningful application states and the observed actions and transitions connecting them into workflows.",
  ],
  [
    "Do I draw the graph manually?",
    "No. Tellann reconstructs the graph from captured demonstration sessions, while keeping the resulting model traceable to its source evidence.",
  ],
  [
    "Is this an infrastructure graph?",
    "No. It maps product and business behavior: the states users encounter, the actions they take, and the paths the application follows.",
  ],
  [
    "Does a missing path always mean a bug?",
    "No. Missing states and paths are analytical findings that help a team decide what should be demonstrated, tested, or investigated next.",
  ],
  [
    "Can graph elements lead back to evidence?",
    "Yes. Nodes and transitions are designed to remain connected to the sessions, events, and endpoint context that produced them.",
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
    <section className={`graph-split${reverse ? " is-reverse" : ""}`}>
      <div className="graph-shell graph-split-grid">
        <div className="graph-copy">
          <p className="graph-kicker">{eyebrow}</p>
          <h2>{title}</h2>
          <p>{copy}</p>
          {children}
        </div>
        <VisualPlaceholder {...visual} />
      </div>
    </section>
  );
}

export default function BehaviorGraphsPage() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Tellann Behavior Graphs",
    description: metadata.description,
    url: `${siteUrl}/product/behavior-graphs`,
  };

  return (
    <main className="graph-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      <section className="graph-hero pt-20!">
        <div className="graph-shell graph-hero-copy">
          <p className="graph-kicker">Behavior graphs</p>
          <h1>See your application as a network of behavior.</h1>
          <p>
            Tellann reconstructs observed sessions into states, actions,
            transitions, and workflows—creating a Behavior Graph that shows how
            your application actually behaves and provides the foundation for
            coverage analysis, missing-state detection, and behavioral QA.
          </p>
          <div className="graph-actions">
            <a className="is-primary" href="#explorer">
              Explore a Behavior Graph <span>↓</span>
            </a>
            <a href="#construction">
              See how graphs are built <span>↓</span>
            </a>
          </div>
        </div>
        <div className="graph-shell-wide graph-hero-visual">
          <VisualPlaceholder
            label="Hero Behavior Graph / SVG or canvas design"
            master="1920 × 1180"
            display="1380 × 800"
          />
          <p>
            Desktop design: 1920 × 1180 px · Display: 1380 × 800 px · Mobile
            alternative: 1080 × 1440 px
          </p>
        </div>
      </section>

      <section className="graph-intro">
        <div className="graph-shell graph-heading">
          <p className="graph-kicker">A behavioral model</p>
          <h2>A structural model of what your software actually does.</h2>
          <p>
            A Behavior Graph represents meaningful application states and the
            observed actions that move the application between them. Connected
            transitions form workflows, allowing teams to reason about business
            processes rather than isolated telemetry.
          </p>
        </div>
        <div
          className="graph-shell graph-formula"
          aria-label="Behavior Graph formula"
        >
          {[
            ["State", "CHECKOUT"],
            ["Action", "SUBMIT_PAYMENT"],
            ["Transition", "CHECKOUT → SUCCESS"],
            ["Workflow", "Purchase"],
          ].map(([label, value], index) => (
            <div key={label}>
              <span>{label}</span>
              <b>{value}</b>
              {index < 3 ? <i>+</i> : <i>→</i>}
            </div>
          ))}
          <strong>Behavior Graph</strong>
        </div>
        <div className="graph-contained-visual">
          <VisualPlaceholder
            label="Graph anatomy / animated SVG design"
            master="1600 × 900"
            display="1000 × 562"
          />
        </div>
      </section>

      <section className="graph-anatomy">
        <div className="graph-shell graph-heading">
          <p className="graph-kicker">Anatomy of behavior</p>
          <h2>Four concepts describe the application.</h2>
          <p>
            The model grows from a small vocabulary. Each layer adds context
            without breaking the connection to the observation beneath it.
          </p>
        </div>
        <div className="graph-shell graph-concept-grid">
          {concepts.map(([number, title, copy, example]) => (
            <article key={title}>
              <span>{number}</span>
              <h3>{title}</h3>
              <p>{copy}</p>
              <code>{example}</code>
            </article>
          ))}
        </div>
        <div className="graph-shell graph-category-strip">
          {[
            ["Navigation", "Products"],
            ["UI", "Modal open"],
            ["Business", "Cart active"],
            ["Error", "Payment failed"],
            ["System", "API unavailable"],
          ].map(([type, example]) => (
            <div key={type}>
              <span>{type}</span>
              <b>{example}</b>
            </div>
          ))}
        </div>
        <div className="graph-contained-visual">
          <VisualPlaceholder
            label="State categories / semantic node design"
            master="1440 × 900"
            display="900 × 562"
          />
        </div>
      </section>

      <SplitSection
        eyebrow="Actions & transitions"
        title="Behavior exists in the movement between states."
        copy="Actions provide the trigger. Transitions describe the movement. Together they preserve both what changed and what caused the application to change."
        visual={{
          label: "Transition demo / animated SVG design",
          master: "1440 × 720",
          display: "900 × 450",
        }}
      >
        <div className="graph-stat-row">
          <span>
            <small>Frequency</small>
            <b>148</b>
          </span>
          <span>
            <small>Success rate</small>
            <b>96%</b>
          </span>
          <span>
            <small>Average duration</small>
            <b>420ms</b>
          </span>
        </div>
        <div className="graph-chip-row">
          {["Success", "Failure", "Retry", "Loop", "Exit"].map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
      </SplitSection>

      <SplitSection
        reverse
        eyebrow="Workflow discovery"
        title="Transitions become business workflows."
        copy="Tellann groups connected state and transition sequences into meaningful objectives such as registration, login, checkout, password reset, or subscription purchase."
        visual={{
          label: "Workflow clustering / animated SVG design",
          master: "1800 × 1000",
          display: "1100 × 611",
        }}
      >
        <ul className="graph-definition-list">
          <li>Entry and exit state</li>
          <li>States and transitions</li>
          <li>Success and failure paths</li>
        </ul>
      </SplitSection>

      <section className="graph-construction" id="construction">
        <div className="graph-shell graph-heading">
          <p className="graph-kicker">Graph construction</p>
          <h2>The graph is discovered from sessions—not manually drawn.</h2>
          <p>
            Observed events are ordered into sessions, meaningful states are
            extracted, transitions connect them, and related paths become
            workflows.
          </p>
        </div>
        <div className="graph-shell graph-pipeline">
          {[
            "Capture events",
            "Build session",
            "Extract states",
            "Detect transitions",
            "Discover workflows",
            "Build graph",
          ].map((item, index) => (
            <div key={item}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <b>{item}</b>
              {index < 5 ? <i>→</i> : null}
            </div>
          ))}
        </div>
        <div className="graph-contained-visual">
          <VisualPlaceholder
            label="Graph construction / SVG or HTML animation design"
            master="1920 × 1080"
            display="1200 × 675"
          />
        </div>
      </section>

      <section className="graph-explorer-section" id="explorer">
        <div className="graph-shell graph-heading">
          <p className="graph-kicker">Interactive graph explorer</p>
          <h2>Explore behavior instead of staring at telemetry.</h2>
          <p>
            Choose an example workflow, inspect its evidence, and reveal the
            endpoint context attached to the selected state. The canvas remains
            a dimension-accurate placeholder for the final graph renderer.
          </p>
        </div>
        <div className="graph-shell-wide">
          <BehaviorGraphExplorer />
        </div>
      </section>

      <section className="graph-evidence">
        <div className="graph-shell graph-heading">
          <p className="graph-kicker">Evidence at every layer</p>
          <h2>Every node and path carries evidence.</h2>
          <p>
            State, transition, and workflow metrics turn the graph into a
            measurable model while preserving the demonstrations behind each
            result.
          </p>
        </div>
        <div className="graph-shell graph-metric-grid">
          <article>
            <span>State metrics</span>
            <h3>Where behavior happened.</h3>
            <p>Visit count · Sessions · Demonstrations · Time spent</p>
          </article>
          <article>
            <span>Transition metrics</span>
            <h3>How behavior moved.</h3>
            <p>Frequency · Success rate · Failure rate · Average duration</p>
          </article>
          <article>
            <span>Workflow metrics</span>
            <h3>What the path accomplished.</h3>
            <p>Completion · Coverage · Error paths · Demonstrated outcomes</p>
          </article>
        </div>
        <div className="graph-contained-visual">
          <VisualPlaceholder
            label="Graph metrics / product UI design"
            master="1600 × 1000"
            display="760 × 475"
          />
        </div>
      </section>

      <SplitSection
        eyebrow="Coverage through structure"
        title="Coverage becomes visible when behavior has structure."
        copy="Tellann can identify which states, transitions, paths, and workflows were observed during a demonstration—and which remain outside the available evidence."
        visual={{
          label: "Coverage graph / animated SVG design",
          master: "1600 × 900",
          display: "1000 × 562",
        }}
      >
        <div className="graph-coverage-value">
          <span>Demonstrated coverage</span>
          <b>72%</b>
          <small>Sample data</small>
        </div>
      </SplitSection>

      <SplitSection
        reverse
        eyebrow="Missing behavior"
        title="The empty spaces in the graph can matter as much as the nodes."
        copy="Potential loading, empty, error, recovery, and alternate paths appear as questions for the team—not as guaranteed defects."
        visual={{
          label: "Gap detection / animated SVG design",
          master: "1600 × 900",
          display: "1000 × 562",
        }}
      >
        <div className="graph-gap-list">
          <span>
            PAYMENT_FAILURE <b>Not demonstrated</b>
          </span>
          <span>
            EMPTY_CART <b>Not demonstrated</b>
          </span>
          <span>
            SESSION_TIMEOUT <b>Not demonstrated</b>
          </span>
        </div>
      </SplitSection>

      <section className="graph-context">
        <div className="graph-shell graph-context-grid">
          <article>
            <p className="graph-kicker">Graph + replay</p>
            <h2>Every graph path can lead back to behavioral evidence.</h2>
            <p>
              Select a transition, find the supporting session, and jump to the
              relevant moment in the reconstructed timeline.
            </p>
            <VisualPlaceholder
              label="Graph to Session Replay / product video placeholder"
              master="1920 × 1200"
              display="1000 × 625"
            />
          </article>
          <article>
            <p className="graph-kicker">Graph + endpoints</p>
            <h2>Connect interface behavior to backend behavior.</h2>
            <p>
              Reveal the API calls associated with a state change without
              splitting frontend and backend evidence into unrelated views.
            </p>
            <VisualPlaceholder
              label="Endpoint overlay / interactive SVG or UI design"
              master="1600 × 1000"
              display="900 × 562"
            />
          </article>
        </div>
      </section>

      <SplitSection
        eyebrow="Graph evolution"
        title="One demonstration starts the map. More observations expand it."
        copy="Additional controlled demonstrations can attach new branches and update observed frequencies without implying continuous production learning."
        visual={{
          label: "Graph evolution / animated SVG design",
          master: "1800 × 1000",
          display: "1100 × 611",
        }}
      >
        <div className="graph-chip-row">
          <span>Demo 01 · Login</span>
          <span>Demo 02 · Cart</span>
          <span>Demo 03 · Checkout</span>
        </div>
      </SplitSection>

      <section className="graph-application-map">
        <div className="graph-shell graph-heading">
          <p className="graph-kicker">Application map</p>
          <h2>Workflows connect into an application-wide behavioral map.</h2>
          <p>
            Registration, login, checkout, search, and profile behavior can sit
            inside one larger application model instead of becoming disconnected
            flowcharts.
          </p>
        </div>
        <div className="graph-shell-wide">
          <VisualPlaceholder
            label="Application-wide behavior map / canvas or SVG design"
            master="1920 × 1200"
            display="1280 × 800"
          />
        </div>
      </section>

      <section className="graph-technical">
        <div className="graph-shell graph-technical-grid">
          <article>
            <p className="graph-kicker">Versioning</p>
            <h2>Behavior can be preserved as the application evolves.</h2>
            <p>
              Graph snapshots retain application-version and creation context so
              behavior can be compared and explained over time.
            </p>
            <VisualPlaceholder
              label="Graph version history / SVG design"
              master="1200 × 500"
              display="1000 × 417"
            />
          </article>
          <article>
            <p className="graph-kicker">Traceability</p>
            <h2>Every graph element should have evidence behind it.</h2>
            <p>
              Move from graph node to transition, session, event, and endpoint
              while retaining the chain of evidence.
            </p>
            <VisualPlaceholder
              label="Evidence trace / SVG design"
              master="1400 × 700"
              display="900 × 450"
            />
          </article>
        </div>
      </section>

      <section className="graph-future">
        <div className="graph-shell graph-heading">
          <p className="graph-kicker">Where the graph leads</p>
          <h2>
            The same behavioral model can support progressively deeper
            intelligence.
          </h2>
          <p>
            Current product direction stays distinct from planned intelligence
            so the page does not promise capabilities before they exist.
          </p>
        </div>
        <div className="graph-shell graph-phase-grid">
          <article>
            <span>Phase 01 · Product direction</span>
            <p>
              Workflow discovery · Behavior Graphs · Coverage · Missing states
              and flows · Replay context
            </p>
          </article>
          <article>
            <span>Phase 02 · Planned</span>
            <p>
              Production journey intelligence · Workflow health · Behavioral
              evolution · Error correlation
            </p>
          </article>
          <article>
            <span>Phase 03 · Planned</span>
            <p>
              Regression intelligence · Release comparison · Predictive quality
              signals
            </p>
          </article>
        </div>
      </section>

      <section className="graph-faq">
        <div className="graph-shell graph-faq-grid">
          <div>
            <p className="graph-kicker">FAQ</p>
            <h2>Questions behind the graph.</h2>
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

      <section className="graph-final">
        <div className="graph-shell">
          <p className="graph-kicker">Build your first Behavior Graph</p>
          <h2>Show Tellann a workflow. See the behavior emerge.</h2>
          <p>
            Connect an application, demonstrate a real workflow, and turn the
            resulting session into a model your team can reason about.
          </p>
          <div className="graph-actions">
            <a className="is-primary" href={dashboardUrl}>
              Start a demonstration <span>↗</span>
            </a>
            <Link href="/product/how-it-works">
              See how Tellann works <span>→</span>
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
