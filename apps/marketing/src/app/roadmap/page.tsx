import type { Metadata } from "next";
import Link from "next/link";
import "./roadmap.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://domain-name.com";
const docsUrl =
  process.env.NEXT_PUBLIC_DOCS_URL || "https://docs.domain-name.com";

export const metadata: Metadata = {
  title: "Tellann Roadmap — Behavioral QA to Autonomous Validation",
  description:
    "Explore the Tellann product roadmap, from behavioral QA and workflow intelligence to production monitoring, release validation, and future autonomous quality intelligence.",
  alternates: { canonical: "/roadmap" },
  openGraph: {
    title: "Tellann Roadmap — Behavioral QA to Autonomous Validation",
    description:
      "See what Tellann supports today, what is planned next, and what remains an exploratory product direction.",
    url: `${siteUrl}/roadmap`,
    type: "website",
  },
};

type Status = "AVAILABLE" | "IN PROGRESS" | "PLANNED" | "EXPLORING";
type RoadmapItem = {
  id: string;
  title: string;
  description: string;
  status: Status;
  category: string;
  capabilities: string[];
  rationale?: string;
};

const phaseOne: RoadmapItem[] = [
  {
    id: "developer-demonstration",
    title: "Developer Demonstration Mode",
    description:
      "Teach Tellann how an application behaves by performing real workflows instead of describing them manually.",
    status: "AVAILABLE",
    category: "Observe",
    capabilities: [
      "Guided walkthroughs",
      "Event capture",
      "Session reconstruction",
    ],
  },
  {
    id: "behavior-graphs",
    title: "Behavior Graphs",
    description:
      "Turn observed application behavior into connected states, actions, transitions, and workflows.",
    status: "AVAILABLE",
    category: "Model",
    capabilities: [
      "State discovery",
      "Transition discovery",
      "Workflow mapping",
    ],
  },
  {
    id: "behavioral-coverage",
    title: "Behavioral Coverage",
    description:
      "Understand which workflows, states, transitions, endpoints, and errors were actually demonstrated.",
    status: "AVAILABLE",
    category: "Analyze",
    capabilities: ["Workflow coverage", "State coverage", "Endpoint coverage"],
  },
  {
    id: "quality-gaps",
    title: "Quality Gaps",
    description:
      "Reveal loading, empty, error, recovery, alternative, failure, and edge-case paths that remain unseen.",
    status: "AVAILABLE",
    category: "Analyze",
    capabilities: ["Missing states", "Missing flows", "Evidence links"],
  },
  {
    id: "session-endpoints",
    title: "Sessions & Endpoints",
    description:
      "Inspect reconstructed session timelines alongside the application endpoints involved in each workflow.",
    status: "AVAILABLE",
    category: "Observe",
    capabilities: ["Session replay", "Endpoint activity", "Request context"],
  },
  {
    id: "qa-reporting",
    title: "QA Reporting",
    description:
      "Turn captured behavioral evidence into focused reports for engineering, QA, and product review.",
    status: "IN PROGRESS",
    category: "Communicate",
    capabilities: ["Coverage reports", "Gap reports", "Graph reports"],
  },
];

const phaseTwo: RoadmapItem[] = [
  {
    id: "production-monitoring",
    title: "Production Monitoring",
    description:
      "Move from isolated demonstrations to continuous understanding of real-user application behavior.",
    status: "PLANNED",
    category: "Production",
    capabilities: [
      "Continuous ingestion",
      "Behavioral trends",
      "Real-user context",
    ],
  },
  {
    id: "journey-intelligence",
    title: "Journey Intelligence",
    description:
      "Understand where users progress, repeat actions, encounter friction, and abandon important workflows.",
    status: "PLANNED",
    category: "Journeys",
    capabilities: ["Common journeys", "Abandonment", "Workflow bottlenecks"],
  },
  {
    id: "workflow-health",
    title: "Workflow Health",
    description:
      "Continuously evaluate whether important production workflows remain healthy as usage changes.",
    status: "PLANNED",
    category: "Analytics",
    capabilities: ["Success rate", "Latency", "Errors", "Health trends"],
    rationale:
      "Detect degradation before it becomes widespread customer impact.",
  },
  {
    id: "continuous-endpoints",
    title: "Continuous Endpoint Intelligence",
    description:
      "Evolve demonstration-time endpoint analysis into ongoing API performance and stability understanding.",
    status: "PLANNED",
    category: "Endpoints",
    capabilities: ["Usage rankings", "Slow APIs", "Unstable APIs"],
  },
  {
    id: "database-intelligence",
    title: "Database Intelligence",
    description:
      "Connect application workflows to the database behavior that supports them.",
    status: "PLANNED",
    category: "Data",
    capabilities: [
      "Frequent queries",
      "Expensive queries",
      "Optimization signals",
    ],
  },
  {
    id: "error-correlation",
    title: "Error Correlation",
    description:
      "Connect a failure to its session, workflow path, API activity, logs, and database context.",
    status: "PLANNED",
    category: "Investigation",
    capabilities: [
      "Failure context",
      "Cross-system evidence",
      "Investigation packages",
    ],
  },
];

const phaseThree: RoadmapItem[] = [
  {
    id: "test-generation",
    title: "Behavior-driven Test Generation",
    description:
      "Generate positive, negative, and edge-case scenarios that remain traceable to observed behavior.",
    status: "EXPLORING",
    category: "Validation",
    capabilities: ["Positive paths", "Failure paths", "Evidence traceability"],
  },
  {
    id: "regression-detection",
    title: "Regression Detection",
    description:
      "Compare behavioral baselines across releases and identify missing workflows or unexpected transitions.",
    status: "EXPLORING",
    category: "Releases",
    capabilities: [
      "Graph comparison",
      "Workflow deviations",
      "Release evidence",
    ],
  },
  {
    id: "failure-simulation",
    title: "Failure Simulation",
    description:
      "Model failures against known workflows to assess how an application responds under pressure.",
    status: "EXPLORING",
    category: "Resilience",
    capabilities: ["Network failure", "Service failure", "Timeout behavior"],
  },
  {
    id: "anomaly-detection",
    title: "Behavioral Anomalies",
    description:
      "Identify meaningful changes in workflow use, abandonment, latency, and error behavior.",
    status: "EXPLORING",
    category: "Intelligence",
    capabilities: [
      "Historical baselines",
      "Abnormal changes",
      "Supporting evidence",
    ],
  },
  {
    id: "quality-intelligence",
    title: "Quality Intelligence",
    description:
      "Combine graphs, failures, regressions, anomalies, and performance into explainable quality direction.",
    status: "EXPLORING",
    category: "Intelligence",
    capabilities: [
      "Risk identification",
      "Prioritization",
      "Explainable recommendations",
    ],
  },
];

const currentCapabilities = [
  "Developer Demonstration",
  "Behavior Graphs",
  "Workflow Discovery",
  "Session Replay",
  "Coverage Analysis",
  "Missing States",
  "Missing Flows",
  "Endpoint Intelligence",
  "QA Reports",
];

function StatusMark({ status }: { status: Status }) {
  return (
    <span
      className={`roadmap-status status-${status.toLowerCase().replace(" ", "-")}`}
    >
      <i aria-hidden="true" />
      {status}
    </span>
  );
}

function CapabilityCard({
  item,
  phase,
}: {
  item: RoadmapItem;
  phase: "Phase 1" | "Phase 2" | "Phase 3";
}) {
  return (
    <article className="roadmap-card" id={item.id}>
      <header>
        <span>{item.category}</span>
        <StatusMark status={item.status} />
      </header>
      <h3>{item.title}</h3>
      <p>{item.description}</p>
      <div className="roadmap-card-list">
        <span>Includes</span>
        {item.capabilities.map((capability) => (
          <b key={capability}>{capability}</b>
        ))}
      </div>
      {item.rationale ? (
        <footer>
          <span>Why it matters</span>
          <p>{item.rationale}</p>
        </footer>
      ) : (
        <footer>
          <span>Direction</span>
          <p>{phase}</p>
        </footer>
      )}
    </article>
  );
}

export default function RoadmapPage() {
  return (
    <main className="roadmap-page">
      <section className="roadmap-hero">
        <div className="roadmap-shell roadmap-hero-grid pt-20!">
          <div className="roadmap-hero-copy">
            <p className="roadmap-kicker">Tellann roadmap</p>
            <h1>
              From observing behavior to continuously{" "}
              <span>understanding quality.</span>
            </h1>
            <p>
              Tellann begins by turning demonstrated application behavior into
              quality intelligence. From there, the platform expands into
              production understanding and eventually behavior-driven autonomous
              validation.
            </p>
            <div className="roadmap-actions">
              <a
                className="roadmap-button roadmap-button-solid"
                href="#current"
              >
                See what is available now <span>↓</span>
              </a>
              <a className="roadmap-button" href="#shipped">
                Recently shipped <span>↓</span>
              </a>
            </div>
          </div>
          <div
            className="roadmap-progression"
            aria-label="Tellann product evolution from observe to validate"
          >
            {[
              ["01", "Observe", "Phase 1"],
              ["02", "Model", "Phase 1"],
              ["03", "Understand", "Phase 1"],
              ["04", "Monitor", "Phase 2"],
              ["05", "Compare", "Phase 3"],
              ["06", "Predict", "Phase 3"],
              ["07", "Validate", "Phase 3"],
            ].map(([number, label, phase], index) => (
              <div key={label} className={`roadmap-step phase-${phase.at(-1)}`}>
                <span>{number}</span>
                <b>{label}</b>
                <small>{phase}</small>
                {index < 6 ? <i aria-hidden="true">↓</i> : null}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="roadmap-legend">
        <div className="roadmap-shell roadmap-legend-grid">
          <div>
            <StatusMark status="AVAILABLE" />
            <p>Currently usable.</p>
          </div>
          <div>
            <StatusMark status="IN PROGRESS" />
            <p>Actively being developed.</p>
          </div>
          <div>
            <StatusMark status="PLANNED" />
            <p>Part of an upcoming phase.</p>
          </div>
          <div>
            <StatusMark status="EXPLORING" />
            <p>Research direction; not committed.</p>
          </div>
        </div>
      </section>

      <section className="roadmap-current" id="current">
        <div className="roadmap-shell">
          <header className="roadmap-section-head">
            <div>
              <p className="roadmap-kicker">Current product snapshot</p>
              <StatusMark status="AVAILABLE" />
            </div>
            <h2>
              What Tellann
              <br />
              is today.
            </h2>
            <p>
              Connect an application, record a demonstration, reconstruct its
              behavior, discover workflows, measure coverage, identify missing
              states and flows, inspect sessions and endpoints, and generate QA
              reports.
            </p>
          </header>
          <div className="roadmap-current-band">
            <span>Phase 1</span>
            <b>Behavioral QA</b>
            <small>Demonstrate → reconstruct → analyze → report</small>
          </div>
          <div className="roadmap-capability-strip">
            {currentCapabilities.map((capability, index) => (
              <div key={capability}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <b>{capability}</b>
              </div>
            ))}
          </div>
        </div>
      </section>

      <nav className="roadmap-index" aria-label="Roadmap phases">
        <div className="roadmap-shell">
          <span>Product evolution</span>
          <div>
            <a href="#behavioral-qa">Phase 1</a>
            <a href="#production-intelligence">Phase 2</a>
            <a href="#autonomous-validation">Phase 3</a>
            <a href="#sdk">SDKs</a>
            <a href="#shipped">Shipped</a>
          </div>
        </div>
      </nav>

      <section className="roadmap-phase roadmap-phase-one" id="behavioral-qa">
        <div className="roadmap-shell">
          <header className="roadmap-phase-head">
            <div>
              <span>01 / Now</span>
              <StatusMark status="AVAILABLE" />
            </div>
            <h2>
              Understand
              <br />
              demonstrated
              <br />
              behavior.
            </h2>
            <p>
              Generate useful QA intelligence from developer-led application
              demonstrations.
            </p>
          </header>
          <div className="roadmap-cards">
            {phaseOne.map((item) => (
              <CapabilityCard key={item.id} item={item} phase="Phase 1" />
            ))}
          </div>
        </div>
      </section>

      <section
        className="roadmap-phase roadmap-phase-two"
        id="production-intelligence"
      >
        <div className="roadmap-shell">
          <header className="roadmap-phase-head">
            <div>
              <span>02 / Next</span>
              <StatusMark status="PLANNED" />
            </div>
            <h2>
              Understand
              <br />
              production
              <br />
              behavior.
            </h2>
            <p>
              Move from demonstrations to continuous understanding of how real
              software workflows behave in production.
            </p>
          </header>
          <div className="roadmap-cards">
            {phaseTwo.map((item) => (
              <CapabilityCard key={item.id} item={item} phase="Phase 2" />
            ))}
          </div>
        </div>
      </section>

      <section
        className="roadmap-phase roadmap-phase-three"
        id="autonomous-validation"
      >
        <div className="roadmap-shell">
          <header className="roadmap-phase-head">
            <div>
              <span>03 / Future</span>
              <StatusMark status="EXPLORING" />
            </div>
            <h2>
              Turn behavioral
              <br />
              knowledge into
              <br />
              validation.
            </h2>
            <p>
              Use accumulated graphs, production telemetry, historical failures,
              and release history to help validate future behavior.
            </p>
          </header>
          <div className="roadmap-explain">
            <span>Principle / Explainability</span>
            <h3>Automation should not become a black box.</h3>
            <p>
              Future generated insights must expose supporting evidence,
              rationale, confidence, and traceability.
            </p>
          </div>
          <div className="roadmap-cards">
            {phaseThree.map((item) => (
              <CapabilityCard key={item.id} item={item} phase="Phase 3" />
            ))}
          </div>
        </div>
      </section>

      <section className="roadmap-dependencies">
        <div className="roadmap-shell">
          <header className="roadmap-section-head">
            <p className="roadmap-kicker">Product dependencies</p>
            <h2>
              Intelligence needs
              <br />
              evidence beneath it.
            </h2>
            <p>
              Later phases are built on the behavioral evidence and production
              context established before them.
            </p>
          </header>
          <div
            className="roadmap-graph"
            aria-label="High-level roadmap dependency graph"
          >
            <div className="node node-demo">
              <span>Available</span>
              <b>
                Developer
                <br />
                Demonstrations
              </b>
            </div>
            <i className="line line-one" />
            <div className="node node-graph">
              <span>Available</span>
              <b>
                Behavior
                <br />
                Graphs
              </b>
            </div>
            <i className="line line-two" />
            <div className="node node-coverage">
              <span>Phase 1</span>
              <b>Coverage</b>
            </div>
            <i className="line line-three" />
            <div className="node node-production">
              <span>Phase 2</span>
              <b>
                Production
                <br />
                Data
              </b>
            </div>
            <i className="line line-four" />
            <div className="node node-health">
              <span>Phase 2</span>
              <b>
                Workflow
                <br />
                Health
              </b>
            </div>
            <i className="line line-five" />
            <div className="node node-regression">
              <span>Phase 3</span>
              <b>Regressions</b>
            </div>
            <div className="node node-anomaly">
              <span>Phase 3</span>
              <b>Anomalies</b>
            </div>
            <i className="line line-six" />
            <div className="node node-quality">
              <span>Direction</span>
              <b>
                Quality
                <br />
                Intelligence
              </b>
            </div>
          </div>
        </div>
      </section>

      <section className="roadmap-ecosystem" id="sdk">
        <div className="roadmap-shell">
          <header className="roadmap-section-head">
            <p className="roadmap-kicker">SDK evolution</p>
            <h2>
              Expanding where
              <br />
              Tellann can observe.
            </h2>
            <p>
              Defined integrations and future platform coverage are shown
              separately from actual shipping status.
            </p>
          </header>
          <div className="roadmap-sdk-grid">
            <article>
              <span>Web / defined</span>
              {["JavaScript", "TypeScript", "React", "Next.js"].map((name) => (
                <div key={name}>
                  <b>{name}</b>
                  <StatusMark status="AVAILABLE" />
                </div>
              ))}
            </article>
            <article>
              <span>Server / defined</span>
              {["Node.js", "Express", "NestJS", "Fastify"].map((name) => (
                <div key={name}>
                  <b>{name}</b>
                  <StatusMark status="AVAILABLE" />
                </div>
              ))}
            </article>
            <article>
              <span>Future web</span>
              {["Vue", "Angular"].map((name) => (
                <div key={name}>
                  <b>{name}</b>
                  <StatusMark status="PLANNED" />
                </div>
              ))}
            </article>
            <article>
              <span>Future mobile</span>
              {["React Native", "Android", "iOS"].map((name) => (
                <div key={name}>
                  <b>{name}</b>
                  <StatusMark status="EXPLORING" />
                </div>
              ))}
            </article>
          </div>
          <div className="roadmap-enterprise">
            <div>
              <p className="roadmap-kicker">Platform & enterprise</p>
              <h3>More control where organizations need it.</h3>
            </div>
            <div>
              {[
                "SSO / federation",
                "Custom retention",
                "Private networking",
                "Data residency",
                "Self hosting",
                "Enterprise support",
              ].map((item) => (
                <span key={item}>
                  {item}
                  <b>Planned</b>
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="roadmap-shipped" id="shipped">
        <div className="roadmap-shell roadmap-shipped-grid">
          <div>
            <p className="roadmap-kicker">Recently shipped</p>
            <h2>
              Roadmap is direction.
              <br />
              Changelog is evidence.
            </h2>
          </div>
          <div>
            <span>Release records</span>
            <h3>Public release notes are not connected yet.</h3>
            <p>
              We will only list shipped work here when it can link to a real,
              dated release record. No placeholder releases or invented version
              numbers.
            </p>
            <Link href="/changelog">
              Open changelog route <b>→</b>
            </Link>
          </div>
        </div>
      </section>

      <section className="roadmap-priorities">
        <div className="roadmap-shell">
          <header className="roadmap-section-head">
            <p className="roadmap-kicker">How we prioritize</p>
            <h2>
              How we decide
              <br />
              what comes next.
            </h2>
            <p>
              Direction is shaped by product foundations, meaningful customer
              problems, evidence maturity, and trust.
            </p>
          </header>
          <div className="roadmap-priority-grid">
            {[
              [
                "Product foundation",
                "Does this strengthen Tellann's core behavioral model?",
              ],
              [
                "Customer value",
                "Does it solve a meaningful software-quality problem?",
              ],
              [
                "Evidence maturity",
                "Is there enough behavior and context for it to work reliably?",
              ],
              [
                "Trust",
                "Can it remain explainable, secure, private, and operationally reliable?",
              ],
            ].map(([title, copy], index) => (
              <article key={title}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <h3>{title}</h3>
                <p>{copy}</p>
              </article>
            ))}
          </div>
          <blockquote>
            <b>
              We deliberately do not ship later-phase intelligence merely
              because it demos well.
            </b>
            <p>
              Phase 1 establishes behavioral evidence. Phase 2 establishes
              production context. Phase 3 builds intelligence on top of both.
            </p>
          </blockquote>
        </div>
      </section>

      <section className="roadmap-feedback">
        <div className="roadmap-shell roadmap-feedback-grid">
          <div>
            <p className="roadmap-kicker">Roadmap feedback</p>
            <h2>Is something important missing?</h2>
          </div>
          <div>
            <p>
              Tell us what problem you are trying to solve. We care more about
              the underlying need than feature voting.
            </p>
            <div className="roadmap-actions">
              <Link
                className="roadmap-button roadmap-button-solid"
                href="/contact?reason=general"
              >
                Share feedback <span>→</span>
              </Link>
              <a className="roadmap-button" href={docsUrl}>
                Read the docs <span>↗</span>
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="roadmap-faq">
        <div className="roadmap-shell roadmap-faq-grid">
          <div>
            <p className="roadmap-kicker">Roadmap FAQ</p>
            <h2>
              Direction,
              <br />
              not promises.
            </h2>
          </div>
          <div>
            <details>
              <summary>
                Are roadmap items guaranteed?<span>+</span>
              </summary>
              <p>
                No. Items represent current product direction and may change as
                Tellann learns from implementation and customer evidence.
              </p>
            </details>
            <details>
              <summary>
                Why aren&apos;t there release dates?<span>+</span>
              </summary>
              <p>
                This roadmap communicates direction and status without
                publishing dates that are not sufficiently certain.
              </p>
            </details>
            <details>
              <summary>
                Is Phase 2 available today?<span>+</span>
              </summary>
              <p>
                No. Production Intelligence is shown as planned. Current Tellann
                capabilities focus on behavioral QA from demonstrated
                application behavior.
              </p>
            </details>
            <details>
              <summary>
                Is autonomous testing available?<span>+</span>
              </summary>
              <p>
                No. Autonomous validation remains an exploratory Phase 3
                direction and is not presented as current product functionality.
              </p>
            </details>
            <details>
              <summary>
                Are planned SDKs guaranteed?<span>+</span>
              </summary>
              <p>
                No. Planned and exploring labels describe current direction, not
                a release commitment.
              </p>
            </details>
          </div>
        </div>
      </section>

      <section className="roadmap-final">
        <div className="roadmap-shell">
          <p className="roadmap-kicker">Start with evidence</p>
          <h2>
            Understand what
            <br />
            your software does
            <br />
            <span>today.</span>
          </h2>
          <p>The future begins with a real application walkthrough.</p>
          <div className="roadmap-actions">
            <Link
              className="roadmap-button roadmap-button-solid"
              href="/product/demonstration-mode"
            >
              Explore Demonstration Mode <span>→</span>
            </Link>
            <Link className="roadmap-button" href="/contact?reason=general">
              Discuss the roadmap <span>→</span>
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
