import type { Metadata } from "next";
import Link from "next/link";
import { DesktopRouteCallout } from "@/components/desktop-route-callout";
import { ArchitectureAccordion } from "@/components/architecture-accordion";
import { HowItWorksSandbox } from "@/components/how-it-works-sandbox";
import { HowItWorksProgress } from "@/components/how-it-works-progress";
import { ProductPlaceholder } from "@/components/product-tour";
import "./how-it-works.css";

export const metadata: Metadata = {
  title: "How Tellann Works — From Application Behavior to QA Intelligence",
  description:
    "See how Tellann captures application behavior, reconstructs sessions, discovers workflows, builds Behavior Graphs, measures coverage, identifies gaps, analyzes endpoints and generates QA reports.",
  alternates: { canonical: "/product/how-it-works" },
};

const steps = [
  ["connect", "Connect"],
  ["demonstrate", "Demonstrate"],
  ["capture", "Capture"],
  ["session", "Session"],
  ["states", "States"],
  ["workflows", "Workflows"],
  ["graph", "Graph"],
  ["coverage", "Coverage"],
  ["gaps", "Gaps"],
  ["endpoints", "Endpoints"],
  ["replay", "Replay"],
  ["reports", "Report"],
] as const;

type StepProps = {
  id: string;
  number: string;
  eyebrow: string;
  title: string;
  copy: string;
  label: string;
  dimensions: string;
  displayDimensions: string;
  reverse?: boolean;
  children?: React.ReactNode;
  href?: string;
  linkLabel?: string;
};

function ProcessStep({
  id,
  number,
  eyebrow,
  title,
  copy,
  label,
  dimensions,
  displayDimensions,
  reverse,
  children,
  href,
  linkLabel,
}: StepProps) {
  const displayWidth = Number(displayDimensions.split("×")[0].trim());
  return (
    <section className={`hiw-step${reverse ? " is-reverse" : ""}`} id={id}>
      <div
        className={`hiw-shell hiw-step-grid${displayWidth >= 1000 ? " is-wide-visual" : ""}`}
      >
        <div className="hiw-step-copy">
          <p className="hiw-kicker">
            Step {number} · {eyebrow}
          </p>
          <h2>{title}</h2>
          <p>{copy}</p>
          {children}
          {href && linkLabel ? (
            <Link className="hiw-text-link" href={href}>
              {linkLabel}
              <span>→</span>
            </Link>
          ) : null}
        </div>
        <ProductPlaceholder
          label={label}
          dimensions={dimensions}
          displayDimensions={displayDimensions}
        />
      </div>
    </section>
  );
}

const faqs = [
  [
    "Do I need to manually define workflows?",
    "No. Tellann reconstructs connected states and transitions from demonstrated behavior, then presents the resulting workflows for review.",
  ],
  [
    "Does Tellann require production traffic?",
    "No. You can start with a controlled developer demonstration and no production traffic.",
  ],
  [
    "What exactly does the SDK capture?",
    "Behavioral metadata such as navigation, clicks, state transitions, API activity and errors. Privacy rules filter protected values before transmission.",
  ],
  [
    "How does Tellann identify a workflow?",
    "It groups connected state and transition sequences that accomplish a recognizable objective, such as checkout or registration.",
  ],
  [
    "What is a Behavior Graph?",
    "It is the connected model of observed application states, actions, transitions and workflows.",
  ],
  [
    "How is coverage calculated?",
    "Tellann compares observed evidence across workflows, states, transitions, endpoints and error paths.",
  ],
  [
    "How are missing flows detected?",
    "Observed paths are compared with expected or adjacent paths to surface unexercised loading, empty, failure, recovery and alternative behavior.",
  ],
  [
    "Is session replay a video recording?",
    "No. It is a chronological behavioral reconstruction from captured telemetry, not a traditional screen recording.",
  ],
  [
    "Does Tellann capture passwords or sensitive data?",
    "Passwords, payment secrets, access tokens, API secrets and private keys should never be collected. Supported identifiers can be masked or hashed.",
  ],
  [
    "What happens after I end a demonstration?",
    "Tellann finalizes the session, updates behavioral models, calculates coverage and prepares investigation views and QA evidence.",
  ],
  [
    "Can multiple demonstrations contribute to one application model?",
    "Yes. Each demonstration can add new observed states, paths and workflows to the same application model.",
  ],
  [
    "Does Tellann generate automated tests today?",
    "Not in the current Behavioral QA phase. Automated test generation belongs to the planned autonomous validation phase.",
  ],
] as const;

export default function HowItWorksPage() {
  const dashboardUrl =
    process.env.NEXT_PUBLIC_DASHBOARD_URL ?? "http://localhost:3000";
  const docsUrl = process.env.NEXT_PUBLIC_DOCS_URL ?? "/developers/sdk";
  const schema = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: "How Tellann turns application behavior into QA intelligence",
    step: steps.map(([id, name], index) => ({
      "@type": "HowToStep",
      position: index + 1,
      name,
      url: `/product/how-it-works#${id}`,
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
      <main className="hiw-page">
        <section className="hiw-hero pt-20!">
          <div className="hiw-shell hiw-hero-copy">
            <p className="hiw-kicker">How Tellann works</p>
            <h1>
              From one application walkthrough to a map of software behavior.
            </h1>
            <p>
              Connect the SDK, start a demonstration session, and use your
              application normally. Tellann captures behavioral events,
              reconstructs sessions, discovers workflows, builds a Behavior
              Graph, measures coverage, identifies gaps, and generates QA
              evidence.
            </p>
            <div className="hiw-actions">
              <Link className="hiw-button is-primary" href={dashboardUrl}>
                Start a demonstration <span>↗</span>
              </Link>
              <Link className="hiw-button" href={docsUrl}>
                View SDK docs <span>→</span>
              </Link>
            </div>
          </div>
          <div className="hiw-shell hiw-hero-media">
            <ProductPlaceholder
              className="hiw-hero-placeholder"
              label="End-to-end Tellann lifecycle / animated process visualization"
              dimensions="1920 × 1080"
            />
            <p>
              Desktop master: 1920 × 1080 px · Mobile alternative: 1080 × 1440
              px · Animated SVG or canvas
            </p>
          </div>
        </section>

        <section className="hiw-flow" aria-labelledby="flow-title">
          <div className="hiw-shell">
            <div className="hiw-heading">
              <p className="hiw-kicker">End-to-end product flow</p>
              <h2 id="flow-title">The entire process in twelve steps.</h2>
              <p>
                Follow a single interaction as it becomes structured quality
                evidence.
              </p>
            </div>
            <nav className="hiw-flow-grid" aria-label="How Tellann works steps">
              {steps.map(([id, label], index) => (
                <Link href={`#${id}`} key={id}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <b>{label}</b>
                  <i>↓</i>
                </Link>
              ))}
            </nav>
          </div>
        </section>

        <div className="hiw-process">
          <HowItWorksProgress />
          <ProcessStep
            id="connect"
            number="01"
            eyebrow="Connect"
            title="Connect Tellann to your application."
            copy="Add the frontend or backend SDK, provide your application credentials, and verify the controlled demonstration environment before collecting behavior."
            label="SDK connection / HTML code animation placeholder"
            dimensions="1600 × 900"
            displayDimensions="1600 × 900"
            href="/developers/sdk"
            linkLabel="Read SDK documentation"
          >
            <div className="hiw-code">
              <code>npm install @tellann</code>
              <code>
                Tellann.initialize({`{`} applicationId, apiKey, environment:
                &quot;demo&quot; {`}`});
              </code>
              <span>● SDK connected</span>
            </div>
          </ProcessStep>
          <ProcessStep
            reverse
            id="demonstrate"
            number="02"
            eyebrow="Demonstrate"
            title="Start a demonstration and use the application normally."
            copy="Developer Demonstration Mode lets a team teach Tellann real behavior through guided, exploratory, or validation walkthroughs."
            label="Developer Demonstration Mode / product video placeholder"
            dimensions="1920 × 1200"
            displayDimensions="1920 × 1200"
            href="/product/demonstration-mode"
            linkLabel="Explore Demonstration Mode"
          >
            <div className="hiw-chips">
              <span>Guided</span>
              <span>Exploratory</span>
              <span>Validation</span>
            </div>
          </ProcessStep>
          <ProcessStep
            id="capture"
            number="03"
            eyebrow="Capture events"
            title="Every meaningful interaction becomes structured behavior."
            copy="Navigation, UI, form, state, API and error activity becomes a canonical event with its source, timestamp, session and metadata."
            label="Behavioral event capture / animated SVG placeholder"
            dimensions="1440 × 720"
            displayDimensions="1440 × 720"
            href="/developers/event-model"
            linkLabel="View event model"
          >
            <div className="hiw-chips">
              <span>PAGE_VISIT</span>
              <span>BUTTON_CLICK</span>
              <span>STATE_TRANSITION</span>
              <span>API_REQUEST</span>
              <span>ERROR_OCCURRED</span>
            </div>
          </ProcessStep>
          <ProcessStep
            reverse
            id="session"
            number="04"
            eyebrow="Build sessions"
            title="Events become a chronological session."
            copy="The Session Engine orders captured activity and reconstructs the journey, including its duration, event sequence, workflows and errors."
            label="Session construction / timeline UI placeholder"
            dimensions="1600 × 1000"
            displayDimensions="1600 × 1000"
          >
            <dl className="hiw-metrics">
              <div>
                <dt>Timeline completeness</dt>
                <dd>98%</dd>
              </div>
              <div>
                <dt>Ordering</dt>
                <dd>Chronological</dd>
              </div>
            </dl>
          </ProcessStep>
          <ProcessStep
            id="states"
            number="05"
            eyebrow="Extract structure"
            title="Tellann identifies where the application was and how it moved."
            copy="States describe where the user or system is, actions provide the trigger, and transitions connect the before and after."
            label="State and transition extraction / animated SVG placeholder"
            dimensions="1440 × 800"
            displayDimensions="1440 × 800"
          >
            <div className="hiw-chips">
              <span>Navigation</span>
              <span>UI</span>
              <span>Business</span>
              <span>Error</span>
              <span>System</span>
            </div>
          </ProcessStep>
          <ProcessStep
            reverse
            id="workflows"
            number="06"
            eyebrow="Discover workflows"
            title="Connected behavior becomes a workflow."
            copy="Tellann groups connected state and transition sequences into meaningful objectives such as registration, login, checkout, password reset and subscription purchase."
            label="Workflow discovery / clustered graph placeholder"
            dimensions="1600 × 900"
            displayDimensions="1600 × 900"
            href="/product/workflow-discovery"
            linkLabel="Explore workflow discovery"
          >
            <div className="hiw-sample-card">
              <span>Sample data</span>
              <b>Checkout</b>
              <small>12 states · 18 transitions · 143 observed sessions</small>
            </div>
          </ProcessStep>
          <ProcessStep
            id="graph"
            number="07"
            eyebrow="Build the model"
            title="The application becomes a Behavior Graph."
            copy="Multiple sessions contribute states, actions, transitions and workflows to one connected model derived from observed behavior."
            label="Behavior Graph construction / SVG or canvas placeholder"
            dimensions="1920 × 1140"
            displayDimensions="1920 × 1140"
            href="/product/behavior-graphs"
            linkLabel="Explore Behavior Graphs"
          >
            <div className="hiw-definition">
              <span>State</span>
              <i>→</i>
              <span>Action</span>
              <i>→</i>
              <span>Transition</span>
              <i>→</i>
              <span>Workflow</span>
            </div>
          </ProcessStep>
          <ProcessStep
            reverse
            id="coverage"
            number="08"
            eyebrow="Measure coverage"
            title="Measure what you actually exercised."
            copy="Coverage resolves across workflows, states, transitions, endpoints and error paths so teams can distinguish demonstrated evidence from assumptions."
            label="Behavioral coverage dashboard / UI placeholder"
            dimensions="1600 × 1000"
            displayDimensions="1600 × 1000"
            href="/product/coverage"
            linkLabel="Explore coverage"
          >
            <dl className="hiw-metrics">
              <div>
                <dt>Workflow</dt>
                <dd>72%</dd>
              </div>
              <div>
                <dt>States</dt>
                <dd>81%</dd>
              </div>
              <div>
                <dt>Transitions</dt>
                <dd>69%</dd>
              </div>
            </dl>
          </ProcessStep>
          <ProcessStep
            id="gaps"
            number="09"
            eyebrow="Detect gaps"
            title="Tellann looks beyond the happy path."
            copy="Observed behavior is compared with important adjacent paths to surface unexercised loading, empty, error, recovery, failure and alternative states."
            label="Observed versus missing paths / graph placeholder"
            dimensions="1600 × 1000"
            displayDimensions="1600 × 1000"
            href="/product/missing-states"
            linkLabel="Explore missing states"
          >
            <div className="hiw-gap-list">
              <span>
                <b>High</b> Payment failure
              </span>
              <span>
                <b>Medium</b> Empty cart
              </span>
              <span>
                <b>Low</b> Loading state
              </span>
            </div>
          </ProcessStep>
          <ProcessStep
            reverse
            id="endpoints"
            number="10"
            eyebrow="Analyze endpoints"
            title="See the backend behavior behind the workflow."
            copy="Captured endpoint metadata, response time and errors are correlated with the demonstrated frontend session. This is session analysis not production monitoring."
            label="Endpoint Intelligence / captured session UI placeholder"
            dimensions="1600 × 1000"
            displayDimensions="1600 × 1000"
            href="/product/endpoint-intelligence"
            linkLabel="Explore Endpoint Intelligence"
          >
            <div className="hiw-endpoints">
              <span>
                POST /cart <b>143ms</b>
              </span>
              <span>
                POST /checkout <b>418ms</b>
              </span>
              <span>
                POST /payment <b>891ms · 7.4% error</b>
              </span>
            </div>
          </ProcessStep>
          <ProcessStep
            id="replay"
            number="11"
            eyebrow="Replay and investigate"
            title="Trace an insight back to what actually happened."
            copy="Session Replay is a behavioral reconstruction from telemetry. Jump to an error, inspect its API timeline, identify the related workflow and return to the graph."
            label="Behavioral Session Replay / product video placeholder"
            dimensions="1920 × 1200"
            displayDimensions="1920 × 1200"
            href="/product/session-replay"
            linkLabel="Explore Session Replay"
          >
            <div className="hiw-timeline">
              00:00 SESSION_STARTED <i /> 00:16 API_ERROR <i /> 00:18
              ERROR_OCCURRED
            </div>
          </ProcessStep>
          <ProcessStep
            reverse
            id="reports"
            number="12"
            eyebrow="Generate reports"
            title="Turn everything into QA evidence."
            copy="Package coverage, graph structure, missing behavior, sessions and endpoint findings into focused reports for different technical and business audiences."
            label="QA report pages / composite placeholder"
            dimensions="1600 × 1100"
            displayDimensions="1600 × 1100"
            href="/product/reports"
            linkLabel="Explore reports"
          >
            <div className="hiw-chips">
              <span>PDF</span>
              <span>CSV</span>
              <span>JSON</span>
              <span>HTML</span>
            </div>
          </ProcessStep>
        </div>

        <section className="hiw-system">
          <div className="hiw-shell">
            <div className="hiw-heading">
              <p className="hiw-kicker">Behind the pipeline</p>
              <h2>One event stream. Multiple intelligence layers.</h2>
              <p>
                The same captured evidence moves through collection, session
                reconstruction, behavioral processing, storage, investigation
                and reporting.
              </p>
            </div>
            <ProductPlaceholder
              label="Tellann technical architecture / expandable SVG placeholder"
              dimensions="1800 × 1200"
            />
            <ArchitectureAccordion />
          </div>
        </section>

        <section className="hiw-privacy">
          <div className="hiw-shell">
            <div className="hiw-heading">
              <p className="hiw-kicker">Privacy throughout the flow</p>
              <h2>
                Privacy filtering happens before behavioral data becomes
                intelligence.
              </h2>
              <p>
                Capture rules mask, hash, ignore or reject protected values
                before behavioral metadata enters the Tellann pipeline.
              </p>
            </div>
            <div className="hiw-privacy-grid">
              <ProductPlaceholder
                label="Privacy filtering pipeline / animated SVG placeholder"
                dimensions="1200 × 700"
              />
              <div>
                <article>
                  <span>Collected</span>
                  <p>
                    Navigation · Clicks · State transitions · Workflow
                    information · API metadata
                  </p>
                </article>
                <article>
                  <span>Masked</span>
                  <p>User IDs · Emails · Phone numbers · IP addresses</p>
                </article>
                <article>
                  <span>Never collected</span>
                  <p>
                    Passwords · Credit cards · CVV · Tokens · API secrets ·
                    Private keys
                  </p>
                </article>
                <Link href="/privacy">
                  Read about privacy <span>→</span>
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="hiw-deepen">
          <div className="hiw-shell">
            <div className="hiw-heading">
              <p className="hiw-kicker">A model that grows</p>
              <h2>Every demonstration can deepen the behavioral model.</h2>
              <p>
                Additional controlled demonstrations contribute new observed
                paths without implying continuous production learning.
              </p>
            </div>
            <div className="hiw-demo-sequence">
              <span>
                <b>Demo 01</b>Login + Checkout
              </span>
              <i>→</i>
              <span>
                <b>Demo 02</b>Search + Profile
              </span>
              <i>→</i>
              <span>
                <b>Demo 03</b>Checkout Failure
              </span>
              <i>→</i>
              <strong>
                Expanded graph
                <br />
                Higher coverage
              </strong>
            </div>
          </div>
        </section>

        <section className="hiw-sandbox-section">
          <div className="hiw-shell">
            <div className="hiw-heading">
              <p className="hiw-kicker">Illustrative sandbox</p>
              <h2>See the model build itself.</h2>
              <p>
                Perform three sample actions. The adjacent model updates as each
                new state is observed.
              </p>
            </div>
            <HowItWorksSandbox />
          </div>
        </section>

        <DesktopRouteCallout
          eyebrow="Choose your setup"
          title="Manual SDK or Desktop-assisted."
          description="Install and configure the SDK manually, or open Tellann Desktop, attach a project, review the detected setup, and continue to the same demonstration workflow."
          items={["Create application", "Choose setup", "Run demonstration", "Tellann analysis"]}
          linkLabel="Explore the Desktop setup"
        />

        <section className="hiw-faq">
          <div className="hiw-shell hiw-faq-grid">
            <div>
              <p className="hiw-kicker">FAQ</p>
              <h2 className="mt-4!">The operational questions, answered.</h2>
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

        <section className="hiw-final">
          <div className="hiw-shell">
            <p className="hiw-kicker">Your first Behavior Graph</p>
            <h2>
              Start with one workflow.
              <br />
              See what Tellann learns.
            </h2>
            <p>
              Connect your application, record a demonstration, and turn real
              software behavior into workflows, coverage, gaps, replays,
              endpoint insights and QA reports.
            </p>
            <div className="hiw-actions">
              <Link className="hiw-button is-primary" href={dashboardUrl}>
                Start free <span>↗</span>
              </Link>
              <Link className="hiw-button" href={docsUrl}>
                Read integration docs <span>→</span>
              </Link>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
