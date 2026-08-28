import type { Metadata } from "next";
import Link from "next/link";

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.domain-name.com";
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://domain-name.com";

export const metadata: Metadata = {
  title: "Company",
  description:
    "Learn why Tellann exists, the principles behind behavioral quality intelligence, and where the company is going.",
  alternates: { canonical: "/company" },
  openGraph: {
    title: "Company | Tellann",
    description:
      "Tellann is building the behavioral intelligence layer for software quality.",
    url: `${siteUrl}/company`,
    type: "website",
  },
};

const evidenceSignals = [
  "Navigation",
  "Clicks",
  "State changes",
  "API activity",
  "Failures",
  "Workflow completion",
  "Response times",
];

const buildLayers = [
  ["01", "Observe", "Understand what actually happened across an application."],
  ["02", "Model", "Turn interactions into states, transitions, and workflows."],
  ["03", "Evaluate", "Measure coverage and surface meaningful quality gaps."],
];

const principles = [
  [
    "01 / Evidence",
    "Evidence over assumption.",
    "Ground quality decisions in observed software behavior.",
  ],
  [
    "02 / Understanding",
    "Understand before automating.",
    "Build a trustworthy model before asking software to act on it.",
  ],
  [
    "03 / Explainability",
    "Intelligence should show its evidence.",
    "A recommendation without evidence is just another opinion.",
  ],
  [
    "04 / Privacy",
    "Observe behavior without collecting what you shouldn't.",
    "Minimize, mask, and exclude sensitive information by design.",
  ],
  [
    "05 / Trust",
    "Earn developer trust.",
    "Stay transparent, predictable, lightweight, and useful.",
  ],
  [
    "06 / Evolution",
    "Today's architecture should not become tomorrow's ceiling.",
    "Build foundations that can evolve with the product vision.",
  ],
];

const audiences = [
  [
    "Software engineers",
    "Understand workflows, failures, and regressions with behavioral context.",
  ],
  [
    "QA engineers",
    "See coverage, gaps, and overlooked paths from real evidence.",
  ],
  [
    "Engineering leaders",
    "Know whether important behavior has actually been validated.",
  ],
  [
    "Product teams",
    "Develop clearer evidence about journeys, friction, and product behavior.",
  ],
];

function ArrowLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className="company-text-link">
      {children}
      <span aria-hidden="true">→</span>
    </Link>
  );
}

export default function CompanyPage() {
  const organizationJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Tellann",
    url: siteUrl,
    description: metadata.description,
  };

  return (
    <main className="company-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
      />

      <section className="company-hero" aria-labelledby="company-heading">
        <div className="company-hero-copy pt-12.5!">
          <p className="company-eyebrow">About Tellann</p>
          <h1 id="company-heading">
            Software should be able to explain <span>its own quality.</span>
          </h1>
          <p className="company-lede">
            Tellann is building a behavioral quality intelligence platform that
            helps software teams understand how their applications behave, what
            they have actually validated, and where quality gaps remain.
          </p>
          <div className="company-actions">
            <Link
              href="/product"
              className="company-button company-button-solid"
            >
              Explore the product <span aria-hidden="true">→</span>
            </Link>
            <Link href="#why-tellann" className="company-button">
              Read our story <span aria-hidden="true">↓</span>
            </Link>
          </div>
        </div>
        <div
          className="company-thesis"
          aria-label="Tellann quality intelligence progression"
        >
          {["Observe", "Understand", "Evaluate", "Explain"].map(
            (stage, index) => (
              <div key={stage}>
                <span>0{index + 1}</span>
                <strong>{stage}</strong>
                {index < 3 ? <b aria-hidden="true">↓</b> : null}
              </div>
            ),
          )}
        </div>
      </section>

      <section
        id="why-tellann"
        className="company-section company-story"
        aria-labelledby="why-heading"
      >
        <div className="company-section-intro">
          <p className="company-eyebrow">Why Tellann exists</p>
          <h2 id="why-heading">
            Quality became harder to understand as software became easier to
            change.
          </h2>
        </div>
        <div
          className="company-pressure-line"
          aria-label="Pressures on modern software quality"
        >
          {[
            "Faster releases",
            "Larger applications",
            "Distributed systems",
            "More journeys",
            "Higher expectations",
          ].map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
        <p className="company-story-conclusion mt-6!">
          Software now changes faster than teams can manually reason about its
          behavior.
        </p>
        <div className="company-narrative-grid mt-6">
          <article>
            <span>01</span>
            <h3>Tests describe what teams expected.</h3>
            <p>
              They matter, but they cannot independently describe every behavior
              that exists.
            </p>
          </article>
          <article>
            <span>02</span>
            <h3>Monitoring describes technical health.</h3>
            <p>It reveals errors, latency, infrastructure state, and traces.</p>
          </article>
          <article>
            <span>03</span>
            <h3>Analytics describes what users did.</h3>
            <p>
              It explains adoption and journeys, but not whether the software
              behaved correctly.
            </p>
          </article>
        </div>
        <p className="company-question mt-6!">
          Is this software behaving correctly as a system of workflows?
        </p>
      </section>

      <section className="company-evidence" aria-labelledby="evidence-heading">
        <div className="company-section-intro">
          <p className="company-eyebrow">The evidence already exists</p>
          <h2 id="evidence-heading">
            Software leaves behind evidence of its own quality. Most teams just
            do not have a model for reading it.
          </h2>
        </div>
        <div className="company-signal-grid">
          {evidenceSignals.map((signal) => (
            <span key={signal}>{signal}</span>
          ))}
        </div>
        <div
          className="company-model-flow"
          aria-label="From behavioral evidence to Behavior Graph"
        >
          {[
            "Behavioral evidence",
            "Sessions",
            "States",
            "Transitions",
            "Workflows",
            "Behavior Graph",
          ].map((item, index) => (
            <span key={item}>
              <strong>{item}</strong>
              {index < 5 ? <b aria-hidden="true">→</b> : null}
            </span>
          ))}
        </div>
      </section>

      <section className="company-belief" aria-labelledby="belief-heading">
        <p className="company-eyebrow">Our core belief</p>
        <h2 id="belief-heading">
          Applications generate enough behavioral data to reveal their own
          quality state.
        </h2>
        <p>
          If software behavior can be observed, reconstructed, and modeled,
          teams can reason about quality from evidenc, not only from what they
          remembered to test.
        </p>
      </section>

      <section className="company-section" aria-labelledby="building-heading">
        <div className="company-section-intro">
          <p className="company-eyebrow">What we are building</p>
          <h2 id="building-heading">
            The behavioral intelligence layer for software quality.
          </h2>
        </div>
        <div className="company-build-grid">
          {buildLayers.map(([number, title, copy]) => (
            <article key={title}>
              <span>{number}</span>
              <h3>{title}</h3>
              <p>{copy}</p>
            </article>
          ))}
        </div>
        <div className="company-today">
          <div>
            <p className="company-eyebrow">Today / Behavioral QA</p>
            <h3>Start with demonstrated behavior.</h3>
          </div>
          <ul>
            {[
              "Developer demonstrations",
              "Behavior Graphs",
              "Workflow discovery",
              "Coverage analysis",
              "Missing states and flows",
              "Session replay",
              "Endpoint intelligence",
              "QA reports",
            ].map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <ArrowLink href="/product">Explore Tellann</ArrowLink>
        </div>
      </section>

      <section className="company-category" aria-labelledby="category-heading">
        <div className="company-section-intro">
          <p className="company-eyebrow">Behavioral quality intelligence</p>
          <h2 id="category-heading">
            Tellann sits between QA, observability, and product analytics.
          </h2>
        </div>
        <div className="company-category-grid">
          {[
            ["Traditional QA", "What did we test?"],
            ["Observability", "What happened technically?"],
            ["Product analytics", "What did users do?"],
            [
              "Tellann",
              "What behavior exists, what is missing, and what does that reveal about quality?",
            ],
          ].map(([title, copy], index) => (
            <article key={title} className={index === 3 ? "is-tellann" : ""}>
              <span>0{index + 1}</span>
              <h3>{title}</h3>
              <p>{copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section
        className="company-mission"
        aria-label="Tellann mission and vision"
      >
        <article>
          <p className="company-eyebrow">Mission</p>
          <h2>
            Help software teams discover, understand, and resolve quality issues
            before they impact users by transforming application behavior into
            continuously evolving quality intelligence.
          </h2>
        </article>
        <article>
          <p className="company-eyebrow">Vision</p>
          <h2>
            Become the intelligence layer that enables software applications to
            understand, evaluate, and communicate their own operational quality.
          </h2>
        </article>
      </section>

      <section
        className="company-section company-evolution"
        aria-labelledby="evolution-heading"
      >
        <div className="company-section-intro">
          <p className="company-eyebrow">Product evolution</p>
          <h2 id="evolution-heading">We are building this in stages.</h2>
        </div>
        <div className="company-phase-grid">
          <article>
            <span>01 / Now</span>
            <h3>Behavioral QA</h3>
            <p>
              Build quality intelligence from developer demonstrations,
              sessions, workflows, coverage, and gaps.
            </p>
          </article>
          <article>
            <span>02 / Next</span>
            <h3>Production intelligence</h3>
            <p>
              Understand workflow health, journeys, errors, and application
              behavior continuously in production.
            </p>
          </article>
          <article>
            <span>03 / Future</span>
            <h3>Autonomous validation</h3>
            <p>
              Use accumulated behavioral knowledge for evidence-driven
              validation and quality recommendations.
            </p>
          </article>
        </div>
        <ArrowLink href="/roadmap">Explore the full roadmap</ArrowLink>
      </section>

      <section className="company-section" aria-labelledby="principles-heading">
        <div className="company-section-intro">
          <p className="company-eyebrow">Company principles</p>
          <h2 id="principles-heading">The ideas that shape how we build.</h2>
        </div>
        <div className="company-principles-grid">
          {principles.map(([label, title, copy]) => (
            <article key={label}>
              <span>{label}</span>
              <h3>{title}</h3>
              <p>{copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section
        className="company-audiences"
        aria-labelledby="audiences-heading"
      >
        <div className="company-section-intro">
          <p className="company-eyebrow">Who we build for</p>
          <h2 id="audiences-heading">
            For the people accountable when software does not behave as
            expected.
          </h2>
        </div>
        <div className="company-audience-grid">
          {audiences.map(([title, copy]) => (
            <article key={title}>
              <h3>{title}</h3>
              <p>{copy}</p>
            </article>
          ))}
        </div>
        <div className="company-org-row">
          {[
            "Startups",
            "SaaS businesses",
            "Growing engineering teams",
            "Enterprise organizations",
          ].map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
      </section>

      <section className="company-trust" aria-labelledby="trust-heading">
        <div className="company-section-intro">
          <p className="company-eyebrow">Trust & responsibility</p>
          <h2 id="trust-heading">Observation requires responsibility.</h2>
        </div>
        <div className="company-trust-grid">
          {[
            [
              "Privacy",
              "Sensitive-data exclusion · Configurable masking · Privacy before transmission",
            ],
            [
              "Security",
              "Authenticated access · Tenant isolation · Encryption · RBAC",
            ],
            [
              "Transparency",
              "Documented collection · Clear event taxonomy · Explainable reports",
            ],
            [
              "Control",
              "Retention policies · Privacy rules · Exports · Deployment controls",
            ],
          ].map(([title, copy]) => (
            <article key={title}>
              <h3>{title}</h3>
              <p>{copy}</p>
            </article>
          ))}
        </div>
        <blockquote>
          Tellann is designed to understand application behavior, not collect
          the contents of people’s private lives.
        </blockquote>
        <ArrowLink href="/security">Read about security</ArrowLink>
      </section>

      <section
        className="company-branches"
        aria-label="Learn more about Tellann"
      >
        <article>
          <p className="company-eyebrow">Careers</p>
          <h2 className="mt-2!">Help build the intelligence layer for software quality.</h2>
          <p>
            We are not currently listing open roles, but you can follow our
            progress and future opportunities.
          </p>
          <ArrowLink href="/careers">Explore careers</ArrowLink>
        </article>
        <article>
          <p className="company-eyebrow">Brand & press</p>
          <h2 className="mt-2!">Tellann in one sentence.</h2>
          <p>
            Tellann observes software behavior, models application workflows,
            measures behavioral coverage, and helps engineering teams identify
            quality gaps.
          </p>
          <div>
            <ArrowLink href="/brand">Brand resources</ArrowLink>
            <ArrowLink href="/contact">Contact us</ArrowLink>
          </div>
        </article>
      </section>

      <section
        className="company-final-cta"
        aria-labelledby="company-cta-heading"
      >
        <p className="company-eyebrow">Start with one workflow</p>
        <h2 id="company-cta-heading">
          See what your application’s behavior can tell you.
        </h2>
        <p>
          Connect Tellann, demonstrate a workflow, and begin turning observed
          behavior into quality evidence.
        </p>
        <div className="company-actions">
          <a
            href={`${appUrl}/auth/login`}
            className="company-button company-button-solid"
          >
            Start free <span aria-hidden="true">→</span>
          </a>
          <Link href="/product" className="company-button">
            Explore the product <span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>
    </main>
  );
}
