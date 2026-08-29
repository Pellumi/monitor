import type { Metadata } from "next";
import Link from "next/link";
import { DemonstrationRecorder } from "@/components/demonstration-recorder";
import { ProductPlaceholder } from "@/components/product-tour";
import "./demonstration-mode.css";

export const metadata: Metadata = {
  title: "Developer Demonstration Mode: Behavioral QA by Tellann",
  description:
    "Demonstrate real application workflows and see how Tellann turns observed behavior into sessions, workflows, Behavior Graphs, coverage, gaps, replay, endpoint insight and QA reports.",
  alternates: { canonical: "/product/demonstration-mode" },
};

type Media = { label: string; dimensions: string };
function MasterPlaceholder({
  label,
  dimensions,
}: {
  label: string;
  dimensions: string;
}) {
  return (
    <ProductPlaceholder
      label={label}
      dimensions={dimensions}
      displayDimensions={dimensions}
    />
  );
}
function Feature({
  eyebrow,
  title,
  copy,
  media,
  reverse = false,
  children,
  href,
  label,
}: {
  eyebrow: string;
  title: string;
  copy: string;
  media: Media;
  reverse?: boolean;
  children?: React.ReactNode;
  href?: string;
  label?: string;
}) {
  return (
    <section className={`demo-feature${reverse ? " is-reverse" : ""}`}>
      <div className="demo-shell demo-feature-copy">
        <p className="demo-kicker">{eyebrow}</p>
        <h2>{title}</h2>
        <p>{copy}</p>
        {children}
        {href && label ? (
          <Link href={href}>
            {label}
            <span>→</span>
          </Link>
        ) : null}
      </div>
      <MasterPlaceholder {...media} />
    </section>
  );
}

const faqs = [
  [
    "What is Developer Demonstration Mode?",
    "It is the developer-led workflow for showing Tellann how an application behaves through a controlled walkthrough.",
  ],
  [
    "Do I need to manually define workflows?",
    "No. Tellann reconstructs workflows from the states and transitions observed during demonstrations.",
  ],
  [
    "How long can a demonstration be?",
    "Operational limits depend on the configured product environment; this page does not invent a universal maximum.",
  ],
  [
    "What does Tellann capture?",
    "Configured navigation, UI, form, state, API, error and session metadata after privacy filtering.",
  ],
  [
    "Can I label a demonstration?",
    "Yes. Labels can distinguish the application, workflow, release or purpose of a session.",
  ],
  [
    "What is the difference between Guided and Exploratory mode?",
    "Guided sessions intentionally cover known workflows. Exploratory sessions navigate freely to broaden the behavioral model.",
  ],
  [
    "Can I run multiple demonstrations?",
    "Yes. Multiple sessions can contribute new observed paths to one application model.",
  ],
  [
    "Does each demonstration create a new Behavior Graph?",
    "No. A demonstration can expand the accumulated graph for its application rather than replacing it.",
  ],
  [
    "How are missing flows identified?",
    "Tellann compares observed evidence with important adjacent error, recovery and alternative paths.",
  ],
  [
    "Can I replay a demonstration?",
    "Yes. Replay reconstructs the chronological behavioral telemetry; it is not simply a screen recording.",
  ],
  [
    "Does Tellann capture passwords?",
    "No. Passwords, payment secrets, tokens and private keys should be blocked before transmission.",
  ],
  [
    "Does Demonstration Mode run in production?",
    "The current Behavioral QA workflow begins with controlled developer demonstrations, not production user monitoring.",
  ],
  [
    "Does it automatically generate tests?",
    "Not in the current Behavioral QA phase. Autonomous validation is a future roadmap phase.",
  ],
] as const;

export default function DemonstrationModePage() {
  const dashboard =
    process.env.NEXT_PUBLIC_DASHBOARD_URL ?? "http://localhost:3000";
  const docs = process.env.NEXT_PUBLIC_DOCS_URL ?? "/developers/sdk";
  const schema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Tellann Developer Demonstration Mode",
    applicationCategory: "DeveloperApplication",
    operatingSystem: "Web",
  };
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
      <main className="demo-page">
        <section className="demo-hero">
          <div className="demo-shell">
            <p className="demo-kicker">Developer Demonstration Mode</p>
            <h1>Teach Tellann how your application behaves.</h1>
            <p>
              Start a demonstration session, perform the workflows that matter,
              and let Tellann observe navigation, interactions, state changes,
              API activity, and errors. When the session ends, Tellann
              reconstructs what happened and turns it into behavioral models and
              QA analysis.
            </p>
            <div className="demo-actions">
              <Link className="is-primary" href={dashboard}>
                Start a demonstration <span>↗</span>
              </Link>
              <Link href="#live-recorder">
                See the process <span>↓</span>
              </Link>
              <Link href={docs}>
                Read SDK guide <span>→</span>
              </Link>
            </div>
          </div>
          <div className="demo-master-media">
            <MasterPlaceholder
              label="Developer Demonstration Mode / hero product recording placeholder"
              dimensions="1920 × 1200"
            />
            <p>
              Master: 1920 × 1200 px · Mobile alternative: 1080 × 1350 px ·
              12–16 second muted product recording
            </p>
          </div>
        </section>
        <section className="demo-concept">
          <div className="demo-shell demo-heading">
            <p className="demo-kicker">The core idea</p>
            <h2>A walkthrough becomes structured behavioral evidence.</h2>
            <p>
              You are not writing tests or manually documenting every edge case.
              Perform a workflow and let Tellann reconstruct the states,
              transitions and quality evidence around it.
            </p>
          </div>
          <div className="demo-compare demo-shell">
            <article>
              <span className="mb-3">Traditional approach</span>
              <p>Write flows</p>
              <p>Write test cases</p>
              <p>Document edge cases</p>
              <p>Maintain everything manually</p>
            </article>
            <i>→</i>
            <article>
              <span className="mb-3">Tellann approach</span>
              <p>Perform workflow</p>
              <p>Observe behavior</p>
              <p>Reconstruct workflow</p>
              <p>Analyze quality</p>
            </article>
          </div>
          <div className="demo-contained-media">
            <MasterPlaceholder
              label="Walkthrough-to-workflow transformation / animated SVG placeholder"
              dimensions="1600 × 900"
            />
          </div>
        </section>
        <section className="demo-live" id="live-recorder">
          <div className="demo-shell demo-heading">
            <p className="demo-kicker">Live demonstration experience</p>
            <h2>Record the workflow while you actually perform it.</h2>
            <p>
              Use this illustrative recorder to see application actions become
              events, states, API context and a completed behavioral session.
            </p>
          </div>
          <div className="demo-shell-wide">
            <DemonstrationRecorder />
          </div>
        </section>
        <section className="demo-types">
          <div className="demo-shell demo-heading">
            <p className="demo-kicker">Three session types</p>
            <h2>Demonstrate with a purpose or explore freely.</h2>
            <p>
              Choose the mode that matches what your team needs to understand.
            </p>
          </div>
          <div className="demo-shell demo-type-grid">
            {[
              [
                "01",
                "Guided",
                "Intentionally demonstrate a critical workflow such as registration, login, checkout or subscription purchase.",
              ],
              [
                "02",
                "Exploratory",
                "Navigate freely to map unfamiliar screens, alternate paths and emerging workflow structure.",
              ],
              [
                "03",
                "Validation",
                "Walk through behavior after a change without claiming automated regression detection.",
              ],
            ].map(([n, t, c]) => (
              <article key={t}>
                <span>{n}</span>
                <h3>{t}</h3>
                <p>{c}</p>
                <div className="mt-3!">
                  <b>Miniature visual placeholder</b>
                  <small>720 × 480 px</small>
                </div>
              </article>
            ))}
          </div>
        </section>
        <section className="demo-capture">
          <div className="demo-shell demo-heading">
            <p className="demo-kicker">What Tellann captures</p>
            <h2>
              The demonstration is captured as behavior, not raw application
              content.
            </h2>
            <p>
              Structured event categories preserve the operational story of the
              workflow.
            </p>
          </div>
          <div className="demo-shell demo-event-groups">
            {[
              ["Navigation", "PAGE_VISIT", "ROUTE_CHANGE", "PAGE_EXIT"],
              ["UI", "BUTTON_CLICK", "LINK_CLICK", "COMPONENT_INTERACTION"],
              [
                "Forms",
                "FORM_STARTED",
                "FORM_SUBMITTED",
                "FORM_VALIDATION_FAILED",
              ],
              ["States", "STATE_ENTERED", "STATE_EXITED", "STATE_TRANSITION"],
              ["API", "API_REQUEST", "API_RESPONSE", "API_ERROR"],
              ["Errors", "ERROR_OCCURRED", "CLIENT_ERROR", "SERVER_ERROR"],
            ].map(([title, ...items]) => (
              <article key={title}>
                <h3>{title}</h3>
                {items.map((item) => (
                  <code key={item}>{item}</code>
                ))}
              </article>
            ))}
          </div>
          <div className="demo-contained-media">
            <MasterPlaceholder
              label="Behavioral event stream / animated UI placeholder"
              dimensions="1440 × 900"
            />
          </div>
        </section>
        <Feature
          eyebrow="While recording"
          title="Tellann builds context as the demonstration unfolds."
          copy="Each action becomes an event connected to session context, current state, transition, workflow and relevant API activity."
          media={{
            label: "Recording context construction / SVG and UI placeholder",
            dimensions: "1600 × 900",
          }}
        >
          <div className="demo-flow">
            <span>Action</span>
            <i>→</i>
            <span>Event</span>
            <i>→</i>
            <span>Session</span>
            <i>→</i>
            <span>State</span>
            <i>→</i>
            <span>Workflow</span>
          </div>
        </Feature>
        <Feature
          reverse
          eyebrow="After recording"
          title="Stopping the demonstration starts the analysis."
          copy="The session is ordered, states and transitions are extracted, workflows are discovered, the graph is updated, coverage and gaps are calculated, endpoints are analyzed and reports are prepared."
          media={{
            label:
              "Post-demonstration processing lifecycle / animated UI placeholder",
            dimensions: "1440 × 900",
          }}
        >
          <div className="demo-checks">
            <span>✓ Session reconstructed</span>
            <span>✓ States discovered</span>
            <span>✓ Workflows identified</span>
            <span>● Calculating coverage</span>
          </div>
        </Feature>
        <Feature
          eyebrow="Behavior Graph"
          title="The walkthrough becomes a map of application behavior."
          copy="Observed sessions contribute connected states, transitions, actions and workflow boundaries to the application’s Behavior Graph."
          media={{
            label:
              "Demonstration-derived Behavior Graph / SVG or canvas placeholder",
            dimensions: "1920 × 1140",
          }}
          href="/product/behavior-graphs"
          label="Explore Behavior Graphs"
        >
          <div className="demo-flow">
            <span>Anonymous</span>
            <i>→</i>
            <span>Authenticated</span>
            <i>→</i>
            <span>Cart</span>
            <i>→</i>
            <span>Checkout</span>
          </div>
        </Feature>
        <section className="demo-results">
          <div className="demo-shell demo-heading">
            <p className="demo-kicker">Coverage and gaps</p>
            <h2>See what you demonstrated and what you never showed.</h2>
            <p>
              Observed evidence creates measurable coverage while adjacent
              error, recovery and alternative paths become potential quality
              gaps.
            </p>
          </div>
          <div className="demo-results-grid">
            <article>
              <MasterPlaceholder
                label="Demonstration coverage dashboard / UI placeholder"
                dimensions="1600 × 1000"
              />
              <h3 className="mt-4!">Coverage generated</h3>
              <p>Workflow · State · Transition · Endpoint · Error</p>
            </article>
            <article>
              <MasterPlaceholder
                label="Observed and missing flow comparison / SVG placeholder"
                dimensions="1600 × 900"
              />
              <h3 className="mt-4!">Potential gaps surfaced</h3>
              <p>Payment failure · Retry payment · Session timeout</p>
            </article>
          </div>
          <div className="demo-shell demo-state-cards">
            {[
              "EMPTY_CART",
              "NO_RESULTS",
              "PAYMENT_FAILURE",
              "AUTHENTICATION_ERROR",
            ].map((x) => (
              <span key={x}>
                <b>{x}</b>Not observed · Potential quality gap
              </span>
            ))}
          </div>
        </section>
        <Feature
          reverse
          eyebrow="Session Replay"
          title="Replay exactly how the demonstration unfolded."
          copy="Replay reconstructs the captured behavioral timeline so an insight can be traced to its route, interaction, API activity, state transition and error evidence."
          media={{
            label: "Behavioral Session Replay / product recording placeholder",
            dimensions: "1920 × 1200",
          }}
          href="/product/session-replay"
          label="Explore Session Replay"
        >
          <div className="demo-timeline">
            00:00 SESSION_STARTED ─ 00:14 STATE_TRANSITION ─ 00:16 API_ERROR
          </div>
        </Feature>
        <Feature
          eyebrow="Endpoint analysis"
          title="See the API activity behind the demonstrated workflow."
          copy="Endpoint metadata from the controlled session explains response time and errors in the context of the workflow not as production monitoring."
          media={{
            label: "Endpoint analysis / captured session UI placeholder",
            dimensions: "1600 × 1000",
          }}
          href="/product/endpoint-intelligence"
          label="Explore Endpoint Intelligence"
        >
          <div className="demo-endpoints">
            <span>
              GET /products <b>184ms</b>
            </span>
            <span>
              POST /checkout <b>418ms</b>
            </span>
            <span>
              POST /payment <b>891ms · 7.4% errors</b>
            </span>
          </div>
        </Feature>
        <Feature
          reverse
          eyebrow="Demonstration QA Report"
          title="Every demonstration ends with something your team can use."
          copy="Package workflow coverage, missing flows and states, session evidence and endpoint findings into an evidence-based report without presenting an unsupported AI quality score."
          media={{
            label: "Demonstration QA Report stack / composite placeholder",
            dimensions: "1600 × 1100",
          }}
          href="/product/reports"
          label="Explore reports"
        >
          <div className="demo-report-stats">
            <span>
              Workflows discovered <b>6</b>
            </span>
            <span>
              Coverage <b>74%</b>
            </span>
            <span>
              Missing flows <b>5</b>
            </span>
          </div>
        </Feature>
        <Feature
          eyebrow="Multiple demonstrations"
          title="One demonstration starts the model. More demonstrations expand it."
          copy="Registration, browsing, checkout and failure-path sessions can add new observed states and paths to the same application model without implying continuous production learning."
          media={{
            label:
              "Multi-demonstration graph expansion / animated SVG placeholder",
            dimensions: "1600 × 900",
          }}
        >
          <div className="demo-flow">
            <span>Demo 01</span>
            <i>+</i>
            <span>Demo 02</span>
            <i>+</i>
            <span>Demo 03</span>
            <i>→</i>
            <span>Richer graph</span>
          </div>
        </Feature>
        <section className="demo-privacy">
          <div className="demo-shell demo-heading">
            <p className="demo-kicker">Privacy by default</p>
            <h2>Demonstrate behavior without sending Tellann your secrets.</h2>
            <p>
              Privacy controls operate before protected telemetry leaves the
              client.
            </p>
          </div>
          <div className="demo-shell demo-privacy-grid">
            <article>
              <span>Captured</span>
              <p>
                Page visits · Routes · Clicks · State transitions · API metadata
                · Errors
              </p>
            </article>
            <article>
              <span>Masked</span>
              <p>Emails · User identifiers · Phone numbers · IP addresses</p>
            </article>
            <article>
              <span>Blocked</span>
              <p>
                Passwords · CVV · Card numbers · Tokens · Secrets · Private keys
              </p>
            </article>
          </div>
          <div className="demo-contained-media">
            <MasterPlaceholder
              label="Demonstration privacy filtering / animated SVG placeholder"
              dimensions="1400 × 800"
            />
          </div>
        </section>
        <section className="demo-uses">
          <div className="demo-shell demo-heading">
            <p className="demo-kicker">When to use it</p>
            <h2>Use it whenever behavior matters more than assumptions.</h2>
            <p>Begin with the situation your team needs to understand.</p>
          </div>
          <div className="demo-shell demo-use-grid">
            {[
              ["01", "Initial application mapping"],
              ["02", "Feature QA"],
              ["03", "Release validation walkthrough"],
              ["04", "Coverage expansion"],
              ["05", "Investigation baseline"],
            ].map(([n, t]) => (
              <article key={t}>
                <span>{n}</span>
                <h3>{t}</h3>
              </article>
            ))}
          </div>
          <div className="demo-audience">
            <span>Software Engineers</span>
            <span>QA Engineers</span>
            <span>Startup Founders</span>
            <span>Technical Product Managers</span>
          </div>
        </section>
        <section className="demo-honesty">
          <div className="demo-shell demo-heading">
            <p className="demo-kicker">Clear boundaries</p>
            <h2>
              Demonstration Mode does not pretend to be something it isn’t.
            </h2>
            <p>Honest product boundaries make the evidence more useful.</p>
          </div>
          <div className="demo-shell demo-honesty-grid">
            <article>
              <h3>It is</h3>
              {[
                "Behavioral observation",
                "Workflow discovery",
                "Session reconstruction",
                "Coverage analysis",
                "Quality-gap detection",
              ].map((x) => (
                <p key={x}>✓ {x}</p>
              ))}
            </article>
            <article>
              <h3>It is not</h3>
              {[
                "Autonomous test execution",
                "Production user monitoring",
                "AI debugging",
                "Self-healing software",
                "Automated release validation",
              ].map((x) => (
                <p key={x}>× {x}</p>
              ))}
            </article>
          </div>
        </section>
        <section className="demo-faq">
          <div className="demo-shell demo-faq-grid">
            <div>
              <p className="demo-kicker">FAQ</p>
              <h2 className="mt-4">Before you press record.</h2>
            </div>
            <div>
              {faqs.map(([q, a]) => (
                <details key={q}>
                  <summary>
                    {q}
                    <span>+</span>
                  </summary>
                  <p>{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
        <section className="demo-final">
          <div className="demo-shell">
            <p className="demo-kicker">Demonstrate your first workflow</p>
            <h2>
              Your application already contains the behavior. Tellann helps you
              see it.
            </h2>
            <p>
              Connect the SDK, start a demonstration, perform a real workflow,
              and turn that session into a clearer behavioral model of your
              software.
            </p>
            <div className="demo-actions">
              <Link className="is-primary" href={dashboard}>
                Start free <span>↗</span>
              </Link>
              <Link href={docs}>
                Read the Demonstration Mode guide <span>→</span>
              </Link>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
