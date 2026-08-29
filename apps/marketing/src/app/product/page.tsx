import type { Metadata } from "next";
import Link from "next/link";
import { ProductPlaceholder, ProductTour } from "@/components/product-tour";
import "./product.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://domain-name.com";
const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.domain-name.com";
const docsUrl =
  process.env.NEXT_PUBLIC_DOCS_URL || "https://docs.domain-name.com";

export const metadata: Metadata = {
  title: "Tellann Product — Behavioral QA & Software Quality Intelligence",
  description:
    "See how Tellann turns demonstrated application behavior into workflow maps, behavior graphs, coverage analysis, session replays, missing-state detection, endpoint insights, and QA reports.",
  alternates: { canonical: "/product" },
  openGraph: {
    title: "Tellann Product — Behavioral QA & Software Quality Intelligence",
    description:
      "Observe application behavior, reconstruct workflows, find quality gaps, and turn evidence into QA intelligence.",
    url: `${siteUrl}/product`,
    type: "website",
  },
};

const featureLinks = [
  ["Developer Demonstration", "/product/demonstration-mode"],
  ["Behavior Graphs", "/product/behavior-graphs"],
  ["Workflow Discovery", "/product/workflow-discovery"],
  ["Coverage Analysis", "/product/coverage"],
  ["Missing States & Flows", "/product/missing-states"],
  ["Session Replay", "/product/session-replay"],
  ["Endpoint Intelligence", "/product/endpoint-intelligence"],
  ["QA Reports", "/product/qa-reports"],
];

const reports = [
  "Executive Quality Report",
  "Flow Coverage Report",
  "Behavior Graph Report",
  "Missing Flow Report",
  "Missing State Report",
  "Session Analysis Report",
  "Endpoint Intelligence Report",
];

function ProductSection({
  eyebrow,
  title,
  copy,
  href,
  linkLabel,
  placeholder,
  reverse = false,
  children,
}: {
  eyebrow: string;
  title: string;
  copy: string;
  href: string;
  linkLabel: string;
  placeholder: { label: string; dimensions: string; className?: string };
  reverse?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <section className={`product-feature${reverse ? " is-reverse" : ""}`}>
      <div className="product-shell product-feature-grid">
        <div className="product-feature-copy">
          <p className="product-kicker">{eyebrow}</p>
          <h2>{title}</h2>
          <p>{copy}</p>
          {children}
          <Link href={href}>
            {linkLabel} <span>→</span>
          </Link>
        </div>
        <ProductPlaceholder {...placeholder} />
      </div>
    </section>
  );
}

export default function ProductPage() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Tellann",
    applicationCategory: "DeveloperApplication",
    operatingSystem: "Web, Windows, macOS, Linux",
    description: metadata.description,
    url: `${siteUrl}/product`,
    offers: {
      "@type": "Offer",
      url: `${siteUrl}/pricing`,
      price: "0",
      priceCurrency: "USD",
    },
  };

  return (
    <main className="product-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <section className="product-hero">
        <div className="product-shell product-hero-copy">
          <p className="product-kicker">Behavioral QA platform</p>
          <h1>
            See how your software <span>actually behaves.</span>
          </h1>
          <p>
            Tellann observes an application being used, reconstructs its
            behavior, turns that behavior into workflows, measures what was
            covered or missed, and gives engineering teams evidence about
            software quality.
          </p>
          <div className="product-actions">
            <a className="product-button product-button-solid" href={appUrl}>
              Start a demonstration <span>↗</span>
            </a>
            <a className="product-button" href="#overview">
              See how Tellann works <span>↓</span>
            </a>
          </div>
        </div>
        <div className="product-shell product-hero-media">
          <ProductPlaceholder
            label="Product overview / hero video placeholder"
            dimensions="1920 × 1200"
            className="product-placeholder-hero"
          />
          <p>
            Desktop master: 1920 × 1200 px · Mobile alternative: 1080 × 1350 px
            · Muted looping product overview with static poster required
          </p>
        </div>
      </section>

      <section className="product-pipeline" id="overview">
        <div className="product-shell">
          <header className="product-section-head">
            <p className="product-kicker">Product intelligence pipeline</p>
            <h2>
              From interaction
              <br />
              to understanding.
            </h2>
            <p>
              Every Tellann view begins with the same evidence: observed
              application behavior.
            </p>
          </header>
          <div className="product-pipeline-flow">
            {[
              "Connect",
              "Demonstrate",
              "Capture",
              "Reconstruct",
              "Model",
              "Analyze",
              "Report",
            ].map((step, index) => (
              <div key={step}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <b>{step}</b>
                {index < 6 ? <i>→</i> : null}
              </div>
            ))}
          </div>
          <ProductPlaceholder
            label="Intelligence pipeline / animated SVG placeholder"
            dimensions="1440 × 540"
          />
        </div>
      </section>

      <section className="product-overview">
        <div className="product-shell">
          <header className="product-section-head">
            <p className="product-kicker">One platform</p>
            <h2>
              Multiple views
              <br />
              of quality.
            </h2>
            <p>
              Move from demonstration to model, analysis, investigation, and
              communication without losing the evidence connecting them.
            </p>
          </header>
          <ProductTour />
        </div>
      </section>

      <ProductSection
        eyebrow="Developer Demonstration Mode"
        title="Don't describe the workflow. Demonstrate it."
        copy="Use your application normally while Tellann captures navigation, clicks, state changes, API activity, and workflow evidence. No production traffic is required to begin."
        href="/product/demonstration-mode"
        linkLabel="Explore Demonstration Mode"
        placeholder={{
          label: "Developer Demonstration Mode / video UI placeholder",
          dimensions: "1600 × 1000",
        }}
      >
        <div className="product-mini-flow">
          <span>Walkthrough</span>
          <i>→</i>
          <span>Events</span>
          <i>→</i>
          <span>Session</span>
        </div>
      </ProductSection>

      <ProductSection
        reverse
        eyebrow="Behavior Graph"
        title="Your application, reconstructed as behavior."
        copy="Tellann organizes observed states, actions, transitions, and workflows into a living behavioral map of the application."
        href="/product/behavior-graphs"
        linkLabel="Explore Behavior Graphs"
        placeholder={{
          label: "Behavior Graph / SVG or canvas placeholder",
          dimensions: "1800 × 1100",
          className: "product-placeholder-graph",
        }}
      >
        <div className="product-definition">
          <span>State</span>
          <span>Action</span>
          <span>Transition</span>
          <span>Workflow</span>
        </div>
      </ProductSection>

      <ProductSection
        eyebrow="Workflow Discovery"
        title="Workflows emerge from what users actually do."
        copy="Sessions are reconstructed into meaningful paths so engineering and QA teams can understand how business-critical behavior connects."
        href="/product/workflow-discovery"
        linkLabel="Explore Workflow Discovery"
        placeholder={{
          label: "Workflow discovery / interface placeholder",
          dimensions: "1600 × 1000",
        }}
      >
        <ul className="product-observed-list">
          <li>Product view → Cart → Checkout</li>
          <li>Sign in → Workspace → Application</li>
          <li>Search → Result → Detail</li>
        </ul>
      </ProductSection>

      <section className="product-quality">
        <div className="product-shell">
          <header className="product-section-head">
            <p className="product-kicker">Coverage & quality gaps</p>
            <h2>
              Quality is also what
              <br />
              you never exercised.
            </h2>
            <p>
              Tellann measures observed coverage and surfaces important states
              and paths that remain absent from the evidence.
            </p>
          </header>
          <div className="product-quality-grid">
            <article>
              <ProductPlaceholder
                label="Coverage dashboard / UI placeholder"
                dimensions="1600 × 1000"
              />
              <div>
                <span>Coverage analysis</span>
                <h3>Know what you covered.</h3>
                <p>Workflow · State · Transition · Endpoint · Error</p>
                <Link href="/product/coverage">Explore coverage →</Link>
              </div>
            </article>
            <article>
              <ProductPlaceholder
                label="Missing-path graph / animated SVG placeholder"
                dimensions="1600 × 1100"
              />
              <div>
                <span>Quality gaps</span>
                <h3>See what remains unseen.</h3>
                <p>Loading · Empty · Error · Recovery · Alternative paths</p>
                <Link href="/product/missing-states">
                  Explore missing states →
                </Link>
              </div>
            </article>
          </div>
        </div>
      </section>

      <ProductSection
        reverse
        eyebrow="Session Replay"
        title="Follow the evidence back to the session."
        copy="Reconstruct what happened, in what order, which state changed, and which endpoints participated—without relying only on a screen recording."
        href="/product/session-replay"
        linkLabel="Explore Session Replay"
        placeholder={{
          label: "Session Replay / video UI placeholder",
          dimensions: "1920 × 1200",
        }}
      >
        <div className="product-timeline">
          <span>00:04 Route change</span>
          <span>00:12 Add to cart</span>
          <span>00:21 Payment error</span>
        </div>
      </ProductSection>

      <ProductSection
        eyebrow="Endpoint Intelligence"
        title="Connect user behavior to API behavior."
        copy="Correlate captured demonstration activity with API requests, response times, errors, and endpoint metadata. This is demonstration analysis—not production monitoring."
        href="/product/endpoint-intelligence"
        linkLabel="Explore Endpoint Intelligence"
        placeholder={{
          label: "Endpoint Intelligence / UI table placeholder",
          dimensions: "1600 × 1000",
        }}
      >
        <div className="product-endpoint-table">
          <span>
            GET /products <b>184 ms</b>
          </span>
          <span>
            POST /checkout <b>486 ms</b>
          </span>
          <span>
            POST /payment <b>893 ms</b>
          </span>
        </div>
      </ProductSection>

      <section className="product-reports">
        <div className="product-shell product-reports-grid">
          <div>
            <p className="product-kicker">QA reports</p>
            <h2>From telemetry to something your team can act on.</h2>
            <p>
              Turn the same behavioral evidence into reports designed for
              different review and decision contexts.
            </p>
            <div className="product-report-list">
              {reports.map((report) => (
                <span key={report}>{report}</span>
              ))}
            </div>
            <small>Export as PDF · CSV · JSON · HTML</small>
            <Link href="/product/qa-reports">Explore QA Reports →</Link>
          </div>
          <div className="product-report-stack">
            <i />
            <i />
            <ProductPlaceholder
              label="QA Report / portrait image placeholder"
              dimensions="1000 × 1280"
            />
          </div>
        </div>
      </section>

      <section className="product-connected">
        <div className="product-shell">
          <header className="product-section-head">
            <p className="product-kicker">Connected intelligence</p>
            <h2>
              One behavior.
              <br />
              Multiple perspectives.
            </h2>
            <p>
              These are not isolated tools. They are different views over the
              same observed application behavior.
            </p>
          </header>
          <ProductPlaceholder
            label="Connected product ecosystem / animated SVG placeholder"
            dimensions="1400 × 900"
          />
          <div className="product-connected-labels">
            {[
              "Session Replay",
              "Coverage",
              "Behavior Graph",
              "Endpoints",
              "QA Reports",
              "Missing States",
              "Missing Flows",
            ].map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        </div>
      </section>

      <section className="product-audience">
        <div className="product-shell">
          <header className="product-section-head">
            <p className="product-kicker">Built for software teams</p>
            <h2>
              Shared evidence,
              <br />
              different questions.
            </h2>
            <p>
              Give every technical role a clearer view of the same application
              behavior.
            </p>
          </header>
          <div className="product-audience-grid">
            {[
              [
                "Software engineers",
                "Understand failures, endpoints, and workflows without reconstructing every interaction manually.",
                "API / PATH",
              ],
              [
                "QA engineers",
                "See demonstrated coverage, missing states, and unobserved paths.",
                "72% / GAP",
              ],
              [
                "Engineering teams",
                "Build a shared behavioral picture of application quality.",
                "GRAPH / TEAM",
              ],
              [
                "Technical product teams",
                "Understand which business workflows were actually exercised.",
                "FLOW / VALUE",
              ],
            ].map(([title, copy, visual]) => (
              <article key={title}>
                <span>{visual}</span>
                <h3>{title}</h3>
                <p>{copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="product-privacy">
        <div className="product-shell">
          <header className="product-section-head">
            <p className="product-kicker">Privacy by design</p>
            <h2>
              Observe behavior.
              <br />
              Not secrets.
            </h2>
            <p>
              Sensitive values should be filtered before behavioral evidence
              reaches Tellann.
            </p>
          </header>
          <div className="product-privacy-grid">
            <ProductPlaceholder
              label="Privacy filtering pipeline / animated SVG placeholder"
              dimensions="1200 × 620"
            />
            <div>
              <article>
                <span>Captured</span>
                <p>
                  Navigation
                  <br />
                  Clicks
                  <br />
                  State transitions
                  <br />
                  API metadata
                  <br />
                  Workflow behavior
                </p>
              </article>
              <article>
                <span>Masked</span>
                <p>
                  Email
                  <br />
                  User identifiers
                  <br />
                  Phone numbers
                  <br />
                  IP addresses
                </p>
              </article>
              <article>
                <span>Never captured</span>
                <p>
                  Passwords
                  <br />
                  Credit card numbers
                  <br />
                  Access tokens
                  <br />
                  API secrets
                  <br />
                  Private keys
                </p>
              </article>
            </div>
          </div>
          <Link className="product-text-link" href="/security/privacy">
            Read privacy principles →
          </Link>
        </div>
      </section>

      <section className="product-evolution">
        <div className="product-shell">
          <header className="product-section-head">
            <p className="product-kicker">Product evolution</p>
            <h2>Built to evolve with the software it observes.</h2>
            <p>
              The current product establishes behavioral evidence. Future phases
              build production context and validation intelligence on top.
            </p>
          </header>
          <div className="product-evolution-grid">
            <article>
              <span>Now · Available</span>
              <h3>Behavioral QA</h3>
              <p>
                Demonstrations
                <br />
                Behavior Graphs
                <br />
                Coverage
                <br />
                Quality gaps
                <br />
                Replay
                <br />
                Endpoints
                <br />
                Reports
              </p>
            </article>
            <article>
              <span>Next · Planned</span>
              <h3>Production Intelligence</h3>
              <p>
                Production monitoring
                <br />
                Workflow health
                <br />
                Journey intelligence
                <br />
                Error correlation
              </p>
            </article>
            <article>
              <span>Later · Exploring</span>
              <h3>Autonomous Validation</h3>
              <p>
                Regression detection
                <br />
                Test generation
                <br />
                Failure simulation
                <br />
                Quality intelligence
              </p>
            </article>
          </div>
          <Link className="product-text-link" href="/roadmap">
            Explore the roadmap →
          </Link>
        </div>
      </section>

      <section className="product-feature-directory">
        <div className="product-shell">
          <p className="product-kicker">Explore the platform</p>
          <div>
            {featureLinks.map(([label, href], index) => (
              <Link key={href} href={href}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <b>{label}</b>
                <i>→</i>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="product-faq">
        <div className="product-shell product-faq-grid">
          <div>
            <p className="product-kicker">Product FAQ</p>
            <h2>
              The model,
              <br />
              made clear.
            </h2>
          </div>
          <div>
            {[
              [
                "What does Tellann actually capture?",
                "Tellann captures behavioral events such as navigation, clicks, state transitions, workflow activity, and configured API metadata while applying privacy filters.",
              ],
              [
                "Do I need to write test cases first?",
                "No. Developer Demonstration Mode begins with a real walkthrough and reconstructs behavioral evidence from what was demonstrated.",
              ],
              [
                "Does Tellann require production traffic?",
                "No. The current Behavioral QA product starts from developer-led demonstration sessions. Production Intelligence is a planned future phase.",
              ],
              [
                "Does Tellann replace my testing tools?",
                "No. Tellann adds behavioral evidence, coverage, and investigation context alongside the tools and practices your team already uses.",
              ],
              [
                "Does Tellann use autonomous AI testing today?",
                "No. Autonomous validation belongs to the exploratory roadmap and is not presented as current Phase 1 functionality.",
              ],
              [
                "Can I use Tellann with React and Node.js?",
                "Yes. React and Node.js are part of the current SDK scope, alongside defined JavaScript and TypeScript integrations.",
              ],
            ].map(([question, answer]) => (
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

      <section className="product-final">
        <div className="product-shell">
          <p className="product-kicker">Start observing</p>
          <h2>Teach Tellann how your application behaves.</h2>
          <p>
            Connect an application, record your first demonstration, and turn
            observed behavior into a clearer picture of software quality.
          </p>
          <div className="product-actions">
            <a className="product-button product-button-solid" href={appUrl}>
              Start for free <span>↗</span>
            </a>
            <a className="product-button" href={docsUrl}>
              Read the docs <span>↗</span>
            </a>
          </div>
          <small>
            Start with one application and a single demonstration session.
          </small>
        </div>
      </section>
    </main>
  );
}
