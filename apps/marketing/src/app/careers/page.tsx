import type { Metadata } from "next";
import Link from "next/link";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://domain-name.com";

export const metadata: Metadata = {
  title: "Careers at Tellann | Build Behavioral Quality Intelligence",
  description:
    "Explore careers at Tellann and help build behavioral intelligence systems for software quality, workflow modeling, session analysis, developer tooling, and distributed infrastructure.",
  alternates: { canonical: "/careers" },
  openGraph: {
    title: "Careers at Tellann | Build Behavioral Quality Intelligence",
    description: "Help build software that can understand its own behavior.",
    url: `${siteUrl}/careers`,
    type: "website",
  },
};

const challenges = [
  [
    "Event systems",
    "Handle behavioral telemetry while preserving ordering, traceability, and tenant isolation.",
  ],
  [
    "Behavioral modeling",
    "Convert noisy event streams into meaningful states, transitions, and workflows.",
  ],
  [
    "Graph systems",
    "Build models that stay explainable as applications become more complex.",
  ],
  [
    "Replay",
    "Reconstruct useful behavioral timelines without relying on raw screen recordings.",
  ],
  [
    "Privacy",
    "Observe enough to understand behavior without collecting what should never leave the customer environment.",
  ],
  [
    "Distributed analytics",
    "Coordinate ingestion, processing, persistence, and reporting without creating an operational maze.",
  ],
];

const principles = [
  [
    "Evidence",
    "Evidence over assumption",
    "We prefer observable evidence to confident guesses.",
  ],
  [
    "Understanding",
    "Understand before automating",
    "We model behavior before delegating consequential decisions to automation.",
  ],
  [
    "Explainability",
    "Explain what the system knows",
    "A finding should always be traceable to evidence.",
  ],
  [
    "Privacy",
    "Privacy is architecture",
    "Privacy belongs in capture and processing design, not only in legal copy.",
  ],
  [
    "Evolution",
    "Build systems that evolve",
    "Today’s foundation should make the long-term product possible.",
  ],
  [
    "Trust",
    "Developer trust is earned",
    "Instrumentation should be transparent, predictable, lightweight, and useful.",
  ],
];

const stackGroups = [
  ["Application", ["TypeScript", "React", "Next.js"]],
  [
    "SDK ecosystem",
    ["JavaScript", "React", "Node.js", "Express", "NestJS", "Fastify"],
  ],
  ["Event processing", ["OpenTelemetry", "Kafka", "Redis"]],
  ["Data", ["PostgreSQL", "ClickHouse", "Object storage", "Graph storage"]],
  [
    "Infrastructure",
    ["Containers", "Kubernetes", "Cloud infrastructure", "CI/CD"],
  ],
  ["Observability", ["OpenTelemetry", "Prometheus", "Grafana", "Loki"]],
];

const workAreas = [
  [
    "SDK & instrumentation",
    [
      "Browser capture",
      "Framework integrations",
      "Event tracking",
      "Privacy filtering",
      "Performance overhead",
    ],
  ],
  [
    "Backend platform",
    [
      "Ingestion",
      "APIs",
      "Authentication",
      "Tenant isolation",
      "Processing coordination",
    ],
  ],
  [
    "Behavioral systems",
    [
      "State discovery",
      "Transition modeling",
      "Workflow discovery",
      "Graph generation",
      "Coverage",
    ],
  ],
  [
    "Data & analytics",
    [
      "Telemetry analytics",
      "Aggregation",
      "Historical analysis",
      "Query performance",
    ],
  ],
  [
    "Product engineering",
    [
      "Dashboard",
      "Graph visualization",
      "Session replay",
      "Reports",
      "Developer onboarding",
    ],
  ],
  [
    "Infrastructure & reliability",
    [
      "Streaming",
      "Orchestration",
      "Observability",
      "Scaling",
      "Disaster recovery",
    ],
  ],
];

const candidateValues = [
  ["Systems thinking", "Reason beyond one function, service, or component."],
  ["Curiosity", "Investigate behavior before assuming its cause."],
  ["Precision", "Separate what the evidence shows from what you suspect."],
  [
    "Ownership",
    "Carry a problem from understanding through implementation and validation.",
  ],
  [
    "Communication",
    "Explain complex technical ideas without hiding behind jargon.",
  ],
  [
    "Constructive skepticism",
    "Challenge a design—including ours—when the evidence says it is wrong.",
  ],
];

function CareerLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link className="careers-link" href={href}>
      {children}
      <span aria-hidden="true">→</span>
    </Link>
  );
}

function SectionIntro({
  eyebrow,
  title,
  copy,
}: {
  eyebrow: string;
  title: string;
  copy?: string;
}) {
  return (
    <div className="careers-intro">
      <p className="careers-eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
      {copy ? <p>{copy}</p> : null}
    </div>
  );
}

export default function CareersPage() {
  return (
    <main className="careers-page">
      <section className="careers-hero " aria-labelledby="careers-heading">
        <div className="careers-hero-copy pt-12.5!">
          <p className="careers-eyebrow">Careers at Tellann</p>
          <h1 id="careers-heading">
            Help build software that can understand{" "}
            <span>its own behavior.</span>
          </h1>
          <p>
            Tellann is building behavioral quality intelligence for software
            teams—starting with application observation, workflow modeling,
            coverage analysis, session reconstruction, and quality reporting.
          </p>
          <div className="careers-actions">
            <Link
              href="#open-roles"
              className="careers-button careers-button-solid"
            >
              View open roles <span aria-hidden="true">↓</span>
            </Link>
            <Link href="/product" className="careers-button">
              Learn what we are building <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
        <div
          className="careers-hero-model"
          aria-label="From events to quality intelligence"
        >
          {[
            "Events",
            "Sessions",
            "States",
            "Transitions",
            "Workflows",
            "Behavior Graph",
            "Quality intelligence",
          ].map((item, index) => (
            <span key={item}>
              <small>0{index + 1}</small>
              <strong>{item}</strong>
              {index < 6 ? <b aria-hidden="true">↓</b> : null}
            </span>
          ))}
        </div>
      </section>

      <section
        className="careers-section careers-why"
        aria-labelledby="why-careers-heading"
      >
        <SectionIntro
          eyebrow="Why work on Tellann"
          title="A difficult problem worth solving."
        />
        <div className="careers-why-grid">
          <article>
            <span>01</span>
            <h3>Software produces enormous evidence.</h3>
            <p>
              Routes, clicks, API activity, state changes, errors, timing, and
              workflow outcomes exist—but remain fragmented.
            </p>
          </article>
          <article>
            <span>02</span>
            <h3>Quality is still reconstructed manually.</h3>
            <p>
              Teams stitch together test suites, tickets, logs, dashboards,
              analytics, and human memory.
            </p>
          </article>
          <article>
            <span>03</span>
            <h3>The problem is bigger than testing.</h3>
            <p>
              Observe, understand, evaluate, explain, and eventually validate
              software behavior systematically.
            </p>
          </article>
        </div>
      </section>

      <section
        className="careers-technical"
        aria-labelledby="technical-heading"
      >
        <SectionIntro
          eyebrow="The technical problem"
          title="We are not building another dashboard over telemetry."
          copy="The work begins where raw events become an explainable model of application behavior."
        />
        <div
          className="careers-processing-flow"
          aria-label="Tellann behavioral processing flow"
        >
          {[
            "Raw events",
            "Session reconstruction",
            "State extraction",
            "Transition discovery",
            "Workflow discovery",
            "Behavior Graph",
            "Coverage analysis",
            "Quality findings",
          ].map((item, index) => (
            <span key={item}>
              <strong>{item}</strong>
              {index < 7 ? <b aria-hidden="true">→</b> : null}
            </span>
          ))}
        </div>
        <div className="careers-challenge-grid">
          {challenges.map(([title, copy], index) => (
            <article key={title}>
              <span>0{index + 1}</span>
              <h3>{title}</h3>
              <p>{copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section
        className="careers-section"
        aria-labelledby="building-careers-heading"
      >
        <SectionIntro
          eyebrow="What we are building"
          title="Build across the behavioral intelligence stack."
        />
        <div className="careers-phase-grid">
          <article>
            <span>Current</span>
            <h3>Behavioral QA</h3>
            <p>
              SDKs, ingestion, demonstrations, replay, behavior graphs,
              coverage, missing paths, endpoint analysis, and reporting.
            </p>
          </article>
          <article>
            <span>Planned</span>
            <h3>Production intelligence</h3>
            <p>
              Continuous monitoring, workflow health, journey intelligence,
              error correlation, and production behavior.
            </p>
          </article>
          <article>
            <span>Future</span>
            <h3>Autonomous validation</h3>
            <p>
              Regression analysis, failure simulation, anomaly detection,
              generated tests, and explainable recommendations.
            </p>
          </article>
        </div>
        <CareerLink href="/roadmap">Explore the product roadmap</CareerLink>
      </section>

      <section
        className="careers-principles"
        aria-labelledby="careers-principles-heading"
      >
        <SectionIntro
          eyebrow="How we think"
          title="Principles before perks."
          copy="The way we build should reflect the kind of intelligence we want Tellann to provide."
        />
        <div className="careers-principle-grid">
          {principles.map(([label, title, copy], index) => (
            <article key={label}>
              <span>
                0{index + 1} / {label}
              </span>
              <h3>{title}</h3>
              <p>{copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section
        className="careers-section careers-stack"
        aria-labelledby="stack-heading"
      >
        <SectionIntro
          eyebrow="Engineering environment"
          title="The systems behind Tellann."
          copy="Different roles touch different parts of the stack. Strong systems thinking and the ability to learn matter more than matching every keyword."
        />
        <div className="careers-stack-grid">
          {stackGroups.map(([group, items]) => (
            <article key={group as string}>
              <h3>{group as string}</h3>
              <div>
                {(items as string[]).map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section
        className="careers-work-areas"
        aria-labelledby="work-areas-heading"
      >
        <SectionIntro
          eyebrow="Areas of work"
          title="Where difficult work lives."
        />
        <div className="careers-area-grid">
          {workAreas.map(([title, items], index) => (
            <article key={title as string}>
              <span>0{index + 1}</span>
              <h3>{title as string}</h3>
              <ul>
                {(items as string[]).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
        <div className="careers-later">
          <p className="careers-eyebrow">Later</p>
          <div>
            {[
              "Regression systems",
              "Anomaly detection",
              "Generated tests",
              "Failure simulation",
              "Explainable quality intelligence",
            ].map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        </div>
      </section>

      <section className="careers-expect" aria-labelledby="expect-heading">
        <SectionIntro
          eyebrow="Working at Tellann"
          title="What you can expect from the work."
        />
        <div className="careers-expect-list">
          {[
            "High ownership",
            "Small-team decision making",
            "Direct exposure to product architecture",
            "Work across meaningful system boundaries",
            "Strong emphasis on technical reasoning",
            "A product early enough to shape",
          ].map((item, index) => (
            <span key={item}>
              <small>0{index + 1}</small>
              <strong>{item}</strong>
            </span>
          ))}
        </div>
        <p className="careers-policy-note">
          Formal location, compensation, benefits, and employment policies will
          be published when they are defined for an open role.
        </p>
      </section>

      <section
        id="open-roles"
        className="careers-openings"
        aria-labelledby="open-roles-heading"
      >
        <p className="careers-eyebrow">Open roles</p>
        <div className="careers-empty-role">
          <span>Current hiring status</span>
          <h2 id="open-roles-heading">No open roles right now.</h2>
          <p>
            We are still building. When Tellann opens new roles, they will
            appear here with the location, employment terms, responsibilities,
            and application process clearly defined.
          </p>
          <div>
            <CareerLink href="/product">
              Explore what we are building
            </CareerLink>
            <CareerLink href="/roadmap">View the roadmap</CareerLink>
          </div>
        </div>
      </section>

      <section className="careers-section" aria-labelledby="values-heading">
        <SectionIntro
          eyebrow="Candidate principles"
          title="What matters here."
        />
        <div className="careers-values-grid">
          {candidateValues.map(([title, copy]) => (
            <article key={title}>
              <h3>{title}</h3>
              <p>{copy}</p>
            </article>
          ))}
        </div>
        <blockquote>
          We should be able to explain why every interview stage exists.
        </blockquote>
      </section>

      <section className="careers-faq" aria-labelledby="careers-faq-heading">
        <SectionIntro eyebrow="Careers FAQ" title="What we can answer today." />
        <div className="careers-faq-list">
          <details>
            <summary>
              Are you currently hiring?<span aria-hidden="true">+</span>
            </summary>
            <p>
              No. New roles will be listed on this page when they are ready to
              accept applications.
            </p>
          </details>
          <details>
            <summary>
              Do I need experience with every technology in the stack?
              <span aria-hidden="true">+</span>
            </summary>
            <p>
              No. Each role will describe the experience relevant to its actual
              ownership. We value systems thinking and the ability to learn.
            </p>
          </details>
          <details>
            <summary>
              Can I send a speculative application?
              <span aria-hidden="true">+</span>
            </summary>
            <p>
              Not currently. We will not collect candidate information without a
              defined role, review process, and privacy policy for applicant
              data.
            </p>
          </details>
          <details>
            <summary>
              Where does Tellann hire?<span aria-hidden="true">+</span>
            </summary>
            <p>
              Geographic and work-model policies have not yet been published.
              Every open role will state its requirements clearly.
            </p>
          </details>
        </div>
      </section>

      <section
        className="careers-final"
        aria-labelledby="careers-final-heading"
      >
        <p className="careers-eyebrow">The foundation comes first</p>
        <h2 id="careers-final-heading">We are building the foundation now.</h2>
        <p>
          See the product, understand the problem, and follow where behavioral
          quality intelligence is going.
        </p>
        <div className="careers-actions">
          <Link href="/product" className="careers-button careers-button-solid">
            Explore Tellann <span aria-hidden="true">→</span>
          </Link>
          <Link href="/roadmap" className="careers-button">
            View roadmap <span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>
    </main>
  );
}
