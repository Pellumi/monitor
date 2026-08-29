import type { Metadata } from "next";
import Link from "next/link";
import { ProductPreviewCarousel } from "@/components/product-preview-carousel";

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.domain-name.com";
const docsUrl =
  process.env.NEXT_PUBLIC_DOCS_URL || "https://docs.domain-name.com";
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://domain-name.com";

export const metadata: Metadata = {
  title: "Behavioral Quality Intelligence for Software Teams",
  description:
    "Tellann observes application behavior, discovers workflows, measures coverage, identifies missing states and flows, replays sessions, and generates QA intelligence.",
  alternates: { canonical: "/" },
};

const problems = [
  [
    "Missing paths",
    "The happy path passes. The failure path was never demonstrated.",
    ["Payment failure", "Session timeout", "Out of stock", "Password reset"],
  ],
  [
    "Missing states",
    "Your workflow exists. Its edge states do not.",
    ["Loading", "Empty", "Error", "Recovery", "404"],
  ],
  [
    "Unknown coverage",
    "You know code coverage—but not how much real application behavior you validated.",
    ["Workflow", "State", "Transition", "Endpoint"],
  ],
  [
    "Expensive investigation",
    "A failure happens. Your team reconstructs the journey manually.",
    ["Logs", "Screenshots", "Requests", "Reproduction"],
  ],
];

const steps = [
  [
    "01",
    "Connect",
    "Create an application, install the Tellann SDK, and configure your application key.",
  ],
  [
    "02",
    "Demonstrate",
    "Start a session and use your application normally—from registration through checkout.",
  ],
  [
    "03",
    "Model behavior",
    "Events become sessions, states, transitions, workflows, and a Behavior Graph.",
  ],
  [
    "04",
    "Review intelligence",
    "Inspect coverage, missing flows, replays, endpoints, and QA reports.",
  ],
];

const personas = [
  [
    "Developers",
    "Understand workflows, inspect sessions, and find behavior you never accounted for.",
    "/solutions/developers",
  ],
  [
    "QA engineers",
    "Measure workflow coverage and surface missing states, flows, and failure scenarios.",
    "/solutions/qa-engineers",
  ],
  [
    "Engineering leaders",
    "See what your team has actually demonstrated and validated.",
    "/solutions/engineering-leaders",
  ],
  [
    "Startup teams",
    "Build stronger QA visibility without first building a large QA operation.",
    "/solutions/startups",
  ],
];

const plans = [
  [
    "Free",
    "$0",
    ["1 application", "1 user", "14-day retention", "Core Tellann workflow"],
  ],
  [
    "Solo",
    "$29",
    ["3 applications", "3 users", "90-day retention", "Advanced reports"],
  ],
  [
    "Team",
    "$99",
    [
      "10 applications",
      "10 users",
      "180-day retention",
      "Collaboration + RBAC",
    ],
  ],
];

const resources = [
  [
    "What is behavioral testing?",
    "A practical introduction to testing software through observed states, actions, and workflows.",
    "/guides",
  ],
  [
    "Workflow coverage vs code coverage",
    "Why executed code and validated user behavior answer different quality questions.",
    "/product/coverage",
  ],
  [
    "How to identify missing user flows",
    "A structured approach to finding failure, recovery, and edge-case paths.",
    "/product/missing-flows",
  ],
];

function VisualPlaceholder({
  label,
  dimensions,
  className = "",
}: {
  label: string;
  dimensions: string;
  className?: string;
}) {
  const [width, height] = dimensions.match(/\d+/g)?.map(Number) ?? [1200, 640];

  return (
    <div
      className={`home-visual-placeholder ${className}`}
      role="img"
      aria-label={`${label} placeholder, intended size ${dimensions}`}
      data-placeholder-width={width}
      data-placeholder-height={height}
      style={{
        width: `min(100%, ${width}px)`,
        aspectRatio: `${width} / ${height}`,
      }}
    >
      <span>Visual placeholder</span>
      <strong>{label}</strong>
      <code>{dimensions}</code>
    </div>
  );
}

function SectionHeading({
  eyebrow,
  title,
  copy,
}: {
  eyebrow: string;
  title: string;
  copy?: string;
}) {
  return (
    <div className="home-section-heading">
      <p>{eyebrow}</p>
      <h2>{title}</h2>
      {copy ? <span>{copy}</span> : null}
    </div>
  );
}

function TextLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className="home-text-link">
      {children}
      <span aria-hidden="true">→</span>
    </Link>
  );
}

export default function MarketingHome() {
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "Tellann",
      url: siteUrl,
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "Tellann",
      url: siteUrl,
    },
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "Tellann",
      applicationCategory: "DeveloperApplication",
      operatingSystem: "Web",
      url: siteUrl,
      description: metadata.description,
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    },
  ];

  return (
    <main className="home-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <section className="home-hero" aria-labelledby="home-hero-heading">
        <div className="home-hero-copy">
          <div className="home-hero-title-block">
            <p className="home-eyebrow">Behavioral quality intelligence</p>
            <h1 id="home-hero-heading">
              Understand how your <span>software actually behaves.</span>
            </h1>
          </div>
          <div className="home-hero-body-block">
            <p className="home-hero-lede">
              Connect Tellann, demonstrate your application, and map its
              workflows, measure coverage, uncover missing states and flows,
              replay sessions, and inspect API behavior.
            </p>
            <div className="home-actions">
              <a
                href={`${appUrl}/auth/login`}
                className="home-button home-button-primary"
              >
                Start free <span aria-hidden="true">→</span>
              </a>
              <Link
                href="/product/how-it-works"
                className="home-button home-button-secondary"
              >
                See how it works <span aria-hidden="true">→</span>
              </Link>
            </div>
            <p className="home-proof-note">
              No production traffic required. Start from a single demonstration
              session.
            </p>
          </div>
        </div>

        <div
          className="home-hero-video"
          role="img"
          aria-label="Placeholder for the Tellann demonstration video, intended size 240 by 656 pixels"
          data-placeholder-width="240"
          data-placeholder-height="656"
        >
          <span>Video placeholder</span>
          <button
            type="button"
            aria-label="Play demonstration video placeholder"
          >
            Play
          </button>
          <code>240 × 656 px</code>
        </div>

        <aside
          className="home-hero-audiences"
          aria-label="Teams Tellann is built for"
        >
          <p>Built for the teams responsible for software quality.</p>
          <div>
            {[
              "Developers",
              "QA teams",
              "Product",
              "Startups",
              "Platform",
              "Engineering",
            ].map((audience) => (
              <strong key={audience}>{audience}</strong>
            ))}
          </div>
        </aside>

        <div
          className="home-transform-line"
          aria-label="Observe, model, analyze, understand"
        >
          {["Observe", "Model", "Analyze", "Understand"].map((item, index) => (
            <span key={item}>
              {item}
              {index < 3 ? <b aria-hidden="true">→</b> : null}
            </span>
          ))}
        </div>
      </section>

      <section
        className="home-section home-product-preview"
        aria-labelledby="preview-heading"
      >
        <SectionHeading
          eyebrow="Product preview"
          title="Demonstrate once. See what you missed."
          copy="Tellann turns a developer walkthrough into a structured model of application behavior."
        />
        <ProductPreviewCarousel />
      </section>

      <section
        className="home-positioning"
        aria-labelledby="positioning-heading"
      >
        <h2 id="positioning-heading">
          Testing tells you what you planned. Monitoring tells you what broke.{" "}
          <span>Tellann models what your software actually did.</span>
        </h2>
        <div className="home-positioning-grid">
          {[
            ["Testing", "What did we test?"],
            ["Monitoring", "What failed?"],
            ["Analytics", "What did users do?"],
            ["Tellann", "How is the software behaving?"],
          ].map(([title, copy]) => (
            <article key={title}>
              <p>{title}</p>
              <strong>“{copy}”</strong>
            </article>
          ))}
        </div>
      </section>

      <section className="home-section" aria-labelledby="problem-heading">
        <SectionHeading
          eyebrow="The problem"
          title="Software quality hides between the test cases."
        />
        <div className="home-card-grid home-problem-grid">
          {problems.map(([title, copy, tags], index) => (
            <article key={title as string} className="home-card">
              <span className="home-card-index">0{index + 1}</span>
              <h3>{title as string}</h3>
              <p>{copy as string}</p>
              <div className="home-tag-list">
                {(tags as string[]).map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section
        className="home-section home-process"
        aria-labelledby="process-heading"
      >
        <SectionHeading
          eyebrow="How Tellann works"
          title="From walkthrough to quality intelligence."
        />
        <div className="home-step-grid">
          {steps.map(([number, title, copy]) => (
            <article key={number}>
              <span>{number}</span>
              <h3>{title}</h3>
              <p>{copy}</p>
            </article>
          ))}
        </div>
        <TextLink href="/product/how-it-works">
          Explore how Tellann works
        </TextLink>
      </section>

      <section
        className="home-section home-feature-split home-behavior-section"
        aria-labelledby="graph-heading"
      >
        <div className="home-feature-copy">
          <SectionHeading
            eyebrow="Behavior Graph"
            title="See your application as a living behavior graph."
            copy="Tellann converts observed states, actions, transitions, and workflows into a visual map of how your application behaves."
          />
          <TextLink href="/product/behavior-graphs">
            Explore Behavior Graphs
          </TextLink>
        </div>
        <div className="home-behavior-visual">
          <VisualPlaceholder
            label="Behavior Graph product view"
            dimensions="960 × 576 px"
          />
          <div
            className="home-behavior-rail"
            aria-label="Behavior Graph summary"
          >
            <p>
              <span>Observed path</span>
              <strong>Product view → Cart → Checkout → Payment success</strong>
            </p>
            <p>
              <span>Missing paths</span>
              <strong>Payment failure · Session timeout</strong>
            </p>
          </div>
        </div>
      </section>

      <section
        className="home-section home-feature-split"
        aria-labelledby="coverage-heading"
      >
        <div className="home-feature-copy">
          <SectionHeading
            eyebrow="Coverage analysis"
            title="Know what you covered—and what you didn’t."
            copy="Measure workflow, state, transition, endpoint, and error coverage from behavior your team actually demonstrated."
          />
          <div className="home-metric-row">
            {[
              ["Workflow", "72%"],
              ["State", "81%"],
              ["Transition", "67%"],
              ["Endpoint", "91%"],
              ["Error", "38%"],
            ].map(([label, value]) => (
              <span key={label}>
                <small>{label}</small>
                <strong>{value}</strong>
              </span>
            ))}
          </div>
          <TextLink href="/product/coverage">Learn about coverage</TextLink>
        </div>
        <VisualPlaceholder
          label="Coverage dashboard"
          dimensions="640 × 520 px"
        />
      </section>

      <section className="home-section" aria-labelledby="missing-heading">
        <SectionHeading
          eyebrow="Missing intelligence"
          title="Find the parts of the experience nobody showed you."
        />
        <div className="home-two-column">
          <article className="home-result-panel">
            <p>Missing states</p>
            <h3>States the interface needs but no session reached.</h3>
            <div className="home-result-list">
              {[
                "EMPTY_CART",
                "LOADING_PRODUCTS",
                "NO_RESULTS",
                "404_PAGE",
                "AUTHENTICATION_ERROR",
              ].map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
            <TextLink href="/product/missing-states">
              Explore missing states
            </TextLink>
          </article>
          <article className="home-result-panel">
            <p>Missing flows</p>
            <h3>Alternative and recovery journeys nobody demonstrated.</h3>
            <div className="home-result-list">
              {[
                "PAYMENT_FAILURE",
                "RETRY_PAYMENT",
                "PASSWORD_RESET",
                "SESSION_EXPIRATION",
                "OUT_OF_STOCK",
              ].map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
            <TextLink href="/product/missing-flows">
              Explore missing flows
            </TextLink>
          </article>
        </div>
      </section>

      <section
        className="home-section home-feature-split home-reverse"
        aria-labelledby="replay-heading"
      >
        <div className="home-feature-copy">
          <SectionHeading
            eyebrow="Session replay"
            title="Replay the behavior, not just the screen."
            copy="Reconstruct sessions from meaningful events and inspect the workflow, API calls, errors, and state changes together."
          />
          <TextLink href="/product/session-replay">
            Explore Session Replay
          </TextLink>
        </div>
        <VisualPlaceholder
          label="Behavioral session replay"
          dimensions="1200 × 640 px"
        />
      </section>

      <section className="home-section" aria-labelledby="endpoint-heading">
        <SectionHeading
          eyebrow="Endpoint intelligence"
          title="Connect frontend behavior to backend performance."
          copy="See request volume, latency, and error rates in the context of the workflows that produced them."
        />
        <VisualPlaceholder
          label="Endpoint intelligence table"
          dimensions="1200 × 520 px"
        />
        <div className="home-insight-row">
          <span>
            <small>Slow endpoint</small>
            <strong>GET /search · 942 ms</strong>
          </span>
          <span>
            <small>Error-prone endpoint</small>
            <strong>POST /payment · 3.8%</strong>
          </span>
        </div>
        <TextLink href="/product/endpoint-intelligence">
          Explore Endpoint Intelligence
        </TextLink>
      </section>

      <section
        className="home-section home-feature-split"
        aria-labelledby="reports-heading"
      >
        <div className="home-feature-copy">
          <SectionHeading
            eyebrow="QA reports"
            title="Turn observed behavior into something your team can act on."
            copy="Share workflow coverage, missing states and flows, session findings, and endpoint intelligence in the format your team needs."
          />
          <div className="home-tag-list">
            {["PDF", "CSV", "JSON", "HTML"].map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
          </div>
          <TextLink href="/product/qa-reports">Explore QA Reports</TextLink>
        </div>
        <VisualPlaceholder
          label="Application Quality Report"
          dimensions="1200 × 680 px"
        />
      </section>

      <section className="home-section" aria-labelledby="personas-heading">
        <SectionHeading
          eyebrow="Who it’s for"
          title="Built for teams responsible for software quality."
        />
        <div className="home-card-grid">
          {personas.map(([title, copy, href]) => (
            <article key={title} className="home-card">
              <h3>{title}</h3>
              <p>{copy}</p>
              <TextLink href={href}>{`Tellann for ${title}`}</TextLink>
            </article>
          ))}
        </div>
      </section>

      <section className="home-security" aria-labelledby="security-heading">
        <div className="home-section">
          <SectionHeading
            eyebrow="Security and privacy"
            title="Observe behavior without collecting what you shouldn’t."
            copy="Privacy filtering happens before sensitive information enters Tellann’s analytics pipeline."
          />
          <div className="home-security-grid">
            {[
              [
                "Observes",
                [
                  "Routes",
                  "Clicks",
                  "State transitions",
                  "API metadata",
                  "Latency",
                  "Errors",
                ],
              ],
              [
                "Masks",
                [
                  "Emails",
                  "Names",
                  "User identifiers",
                  "IP addresses",
                  "Phone numbers",
                ],
              ],
              [
                "Excludes",
                [
                  "Passwords",
                  "Card details",
                  "CVVs",
                  "JWTs",
                  "Access tokens",
                  "API secrets",
                ],
              ],
            ].map(([title, items]) => (
              <article key={title as string}>
                <p>Tellann {String(title).toLowerCase()}</p>
                {(items as string[]).map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </article>
            ))}
          </div>
          <div className="home-trust-row">
            {[
              "Filtering before transmission",
              "Tenant isolation",
              "Encryption in transit",
              "Encryption at rest",
              "Role-based access",
            ].map((item) => (
              <span key={item}>✓ {item}</span>
            ))}
          </div>
          <TextLink href="/security">Read about Tellann Security</TextLink>
        </div>
      </section>

      <section
        className="home-section home-developer"
        aria-labelledby="developer-heading"
      >
        <div className="home-feature-copy">
          <SectionHeading
            eyebrow="Developer experience"
            title="A few lines to start observing behavior."
            copy="Install the SDK, initialize Tellann for your application, then begin a demonstration session."
          />
          <div className="home-sdk-list">
            {[
              "React",
              "Next.js",
              "Node.js",
              "Express",
              "NestJS",
              "Fastify",
            ].map((sdk) => (
              <span key={sdk}>{sdk}</span>
            ))}
          </div>
          <div className="home-actions">
            <Link
              href="/developers/quickstart"
              className="home-button home-button-primary"
            >
              Read quickstart
            </Link>
            <a href={docsUrl} className="home-button home-button-secondary">
              View documentation
            </a>
          </div>
        </div>
        <pre className="home-code">
          <code>
            <span>$ npm install @tellann/react</span>
            {`\n\n`}Tellann.initialize({"{"}
            {`\n  `}applicationId: &quot;...&quot;,{`\n  `}apiKey:
            &quot;...&quot;,{`\n  `}environment: &quot;development&quot;{`\n`}
            {"}"});
          </code>
        </pre>
        <div
          className="home-architecture"
          aria-label="Tellann architecture overview"
        >
          {[
            "Your application",
            "Tellann SDK",
            "Behavior events",
            "Session",
            "Behavior Graph",
            "Quality analysis",
          ].map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
      </section>

      <section className="home-section" aria-labelledby="pricing-heading">
        <SectionHeading
          eyebrow="Pricing"
          title="Start with one application. Scale when you need to."
        />
        <div className="home-pricing-grid">
          {plans.map(([name, price, features], index) => (
            <article
              key={name as string}
              className={index === 2 ? "is-featured" : ""}
            >
              <p>{name as string}</p>
              <h3>
                {price as string}
                <small>{index ? " / month" : ""}</small>
              </h3>
              <ul>
                {(features as string[]).map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
              <Link href={index === 0 ? `${appUrl}/auth/login` : "/pricing"}>
                {index === 0 ? "Start free" : "View plan"}{" "}
                <span aria-hidden="true">→</span>
              </Link>
            </article>
          ))}
        </div>
        <p className="home-pricing-note">
          Business and Enterprise plans are also available.
        </p>
        <TextLink href="/pricing">Compare all plans</TextLink>
      </section>

      <section className="home-section" aria-labelledby="resources-heading">
        <SectionHeading
          eyebrow="Resources"
          title="Learn about behavioral quality."
        />
        <div className="home-resource-grid">
          {resources.map(([title, copy, href]) => (
            <article key={title}>
              <span>Guide</span>
              <h3>{title}</h3>
              <p>{copy}</p>
              <TextLink href={href}>Read guide</TextLink>
            </article>
          ))}
        </div>
        <TextLink href="/resources">View all resources</TextLink>
      </section>

      <section className="home-roadmap" aria-labelledby="roadmap-heading">
        <div>
          <p className="home-eyebrow">Product direction</p>
          <h2 id="roadmap-heading">Behavior is only the beginning.</h2>
          <p>
            Tellann begins with demonstrated application behavior. That
            foundation can later support production intelligence, release
            comparison, and autonomous validation.
          </p>
          <TextLink href="/roadmap">View roadmap</TextLink>
        </div>
        <div className="home-roadmap-stages">
          <span>
            <small>Now</small>
            <strong>Behavioral QA</strong>
          </span>
          <span>
            <small>Next</small>
            <strong>Production intelligence</strong>
          </span>
          <span>
            <small>Future</small>
            <strong>Autonomous validation</strong>
          </span>
        </div>
      </section>

      <section className="home-final-cta" aria-labelledby="final-cta-heading">
        <p className="home-eyebrow">Start with one session</p>
        <h2 id="final-cta-heading">Show Tellann how your application works.</h2>
        <p>
          Start with a demonstration session and turn what happened into
          workflows, coverage, and QA insight.
        </p>
        <div className="home-actions">
          <a
            href={`${appUrl}/auth/login`}
            className="home-button home-button-primary"
          >
            Start free <span aria-hidden="true">→</span>
          </a>
          <Link
            href="/developers/quickstart"
            className="home-button home-button-secondary"
          >
            Read the quickstart
          </Link>
        </div>
        <small>No production traffic required.</small>
      </section>
    </main>
  );
}
