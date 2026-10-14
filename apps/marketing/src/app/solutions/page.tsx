import type { Metadata } from "next";
import Link from "next/link";
import { Fragment } from "react";
import { docsLinks } from "@/config/site-routes";
import { ProductPlaceholder } from "@/components/product-tour";
import "./solutions.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://domain-name.com";
const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.domain-name.com";

export const metadata: Metadata = {
  title: "Software Quality Solutions for Developers, QA & Product Teams",
  description:
    "Explore how Tellann helps developers, QA teams, product teams and engineering leaders understand application behavior, measure workflow coverage, identify quality gaps and compare intended behavior with observed evidence.",
  alternates: { canonical: "/solutions" },
  openGraph: {
    title: "Software Quality Solutions for Developers, QA & Product Teams | Tellann",
    description:
      "One behavioral model. Different questions answered — for developers, QA engineers, product teams and engineering leaders.",
    url: `${siteUrl}/solutions`,
    type: "website",
  },
};

const audiences = [
  {
    glyph: "</>",
    title: "For Developers",
    problem:
      "Stop piecing application behavior together from scattered logs, test cases, and assumptions.",
    outcomes: [
      "See workflows as Tellann observed them",
      "Inspect states and transitions",
      "Replay demonstration sessions",
      "Understand endpoint behavior",
      "Find missing paths",
    ],
    outcome:
      "Understand what your application actually demonstrated — not merely what the code was supposed to do.",
    href: "/solutions/developers",
    linkLabel: "Explore Tellann for Developers",
  },
  {
    glyph: "✓",
    title: "For QA Teams",
    problem:
      "Knowing what you tested is useful. Knowing what you missed is more valuable.",
    outcomes: [
      "Measure behavioral coverage",
      "Identify missing states",
      "Find missing failure paths",
      "Review application workflows",
      "Generate QA reports",
    ],
    outcome:
      "Turn a walkthrough into evidence for where testing effort should go next.",
    href: "/solutions/qa-engineers",
    linkLabel: "Explore Tellann for QA",
  },
  {
    glyph: "▣",
    title: "For Engineering Leaders",
    problem:
      "Release confidence should not depend entirely on asking, “Did all the tests pass?”",
    outcomes: [
      "See coverage across important workflows",
      "Understand identified quality gaps",
      "Review evidence-backed QA reports",
      "Create a shared behavioral picture",
      "Reduce fragmented quality information",
    ],
    outcome: "Give engineering discussions a common source of behavioral evidence.",
    href: "/solutions/engineering-leaders",
    linkLabel: "Explore Tellann for Engineering Leaders",
  },
  {
    glyph: "⇄",
    title: "For Product Teams",
    problem:
      "Product requirements describe what should happen. Implementation tells another story.",
    outcomes: [
      "Declare intended workflows",
      "Compare intent against demonstrated behavior",
      "See unexpected states",
      "See workflows not demonstrated",
      "Understand implementation gaps",
    ],
    outcome:
      "Turn product intent into something that can actually be checked against the software.",
    href: "/solutions/product-teams",
    linkLabel: "Explore Tellann for Product Teams",
  },
] as const;

const workflowSteps = ["Declare", "Connect", "Demonstrate", "Observe", "Reconcile", "Report"];

const outcomeMatrix = [
  ["Developer", "What did the application actually do?", "Sessions, workflows, states, endpoints"],
  ["QA engineer", "What did we fail to exercise?", "Coverage, missing states, missing flows"],
  ["Product team", "Does implementation match intent?", "Declaration and reconciliation"],
  ["Engineering leader", "What evidence do we have?", "QA reports and behavioral visibility"],
] as const;

const capabilities = [
  ["Developer Demonstration", "Teach Tellann how the software behaves.", "/product/demonstration-mode"],
  ["Behavior Graph", "See application workflows as connected states.", "/product/behavior-graphs"],
  ["Coverage Analysis", "Understand what has and hasn't been demonstrated.", "/product/coverage"],
  ["Missing State Detection", "Find overlooked loading, empty, error and failure states.", "/product/missing-states"],
  ["Missing Flow Detection", "Surface recovery, alternative and edge-case paths.", "/product/missing-flows"],
  ["Session Replay", "Reconstruct what occurred during a run.", "/product/session-replay"],
  ["Endpoint Intelligence", "Understand APIs involved in workflows.", "/product/endpoint-intelligence"],
  ["Reconciliation", "Compare intended behavior with observed behavior.", "/product/reconciliation"],
] as const;

const faqs: [string, string][] = [
  [
    "Who is Tellann for?",
    "Tellann is built for software engineers, QA engineers, technical product managers, engineering leaders, and startup teams validating a single application. Each role sees the same behavioral evidence through a different lens.",
  ],
  [
    "Does Tellann replace QA engineers?",
    "No. Tellann provides behavioral evidence and helps teams identify coverage gaps. It is designed to support QA work, not to replace QA engineers or existing testing practices.",
  ],
  [
    "Do developers need to manually write test cases first?",
    "No. Developer Demonstration Mode begins with a real walkthrough. Tellann reconstructs workflows, states, and transitions from what was demonstrated, rather than from hand-written test scripts.",
  ],
  [
    "Can product teams use Tellann without reading technical telemetry?",
    "Yes. Flow declaration and reconciliation are designed to turn behavior into workflow and gap language a product team can read directly, without inspecting raw events.",
  ],
  [
    "Does Tellann upload my source code?",
    "No. Source code stays local by default. Sensitive values are filtered before collection, and only behavioral evidence — not raw source — is sent to Tellann for analysis.",
  ],
  [
    "Can Tellann monitor production today?",
    "Not yet. The current product observes developer-led demonstration sessions. Continuous production monitoring is a planned future phase, not a Phase 1 capability.",
  ],
  [
    "Which plan is right for a small team or startup?",
    "Start on the Free plan to validate one application with the full behavioral QA workflow, then move to Solo or Team as your coverage and collaboration needs grow. See Tellann pricing for details.",
  ],
];

function SolutionSection({
  eyebrow,
  title,
  copy,
  steps,
  outcome,
  links,
  visual,
  reverse = false,
}: {
  eyebrow: string;
  title: string;
  copy: string;
  steps?: string[];
  outcome: string;
  links: { label: string; href: string; muted?: boolean }[];
  visual: { label: string; dimensions: string };
  reverse?: boolean;
}) {
  return (
    <section className={`solutions-persona${reverse ? " is-reverse" : ""}`}>
      <div className="solutions-shell solutions-persona-grid">
        <div className="solutions-persona-copy">
          <p className="solutions-kicker" data-aos="fade-up">
            {eyebrow}
          </p>
          <h2 data-aos="fade-up" data-aos-delay="60">
            {title}
          </h2>
          <p data-aos="fade-up" data-aos-delay="120">
            {copy}
          </p>
          {steps ? (
            <div className="solutions-mini-flow" data-aos="fade-up" data-aos-delay="160">
              {steps.map((step, index) => (
                <Fragment key={step}>
                  <span>{step}</span>
                  {index < steps.length - 1 ? <i>→</i> : null}
                </Fragment>
              ))}
            </div>
          ) : null}
          <p className="solutions-outcome" data-aos="fade-up" data-aos-delay="180">
            {outcome}
          </p>
          <div className="solutions-persona-links">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={link.muted ? "is-muted" : ""}
              >
                {link.label} <span>→</span>
              </Link>
            ))}
          </div>
        </div>
        <div className="solutions-persona-visual">
          <ProductPlaceholder label={visual.label} dimensions={visual.dimensions} />
        </div>
      </div>
    </section>
  );
}

export default function SolutionsPage() {
  const structuredData = [
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: "Tellann Solutions",
      description: metadata.description,
      url: `${siteUrl}/solutions`,
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
        { "@type": "ListItem", position: 2, name: "Solutions", item: `${siteUrl}/solutions` },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqs.map(([question, answer]) => ({
        "@type": "Question",
        name: question,
        acceptedAnswer: { "@type": "Answer", text: answer },
      })),
    },
  ];

  return (
    <main className="solutions-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      {/* 02 Hero */}
      <section className="solutions-hero">
        <div className="solutions-shell solutions-hero-copy">
          <p className="solutions-kicker" data-aos="fade-up">
            Solutions
          </p>
          <h1 data-aos="fade-up" data-aos-delay="60">
            See software quality <span>from where you stand.</span>
          </h1>
          <p data-aos="fade-up" data-aos-delay="120">
            Developers, QA teams, product teams, and engineering leaders all
            ask different questions about quality. Tellann turns demonstrated
            application behavior into evidence each team can understand and
            act on.
          </p>
          <div className="solutions-actions" data-aos="fade-up" data-aos-delay="180">
            <a className="solutions-button solutions-button-solid" href="#choose-your-role">
              Find your solution <span>↓</span>
            </a>
            <Link className="solutions-button" href="/product/how-it-works">
              See how Tellann works <span>→</span>
            </Link>
          </div>
        </div>
        <div className="solutions-shell solutions-hero-media">
          <ProductPlaceholder
            label="Declared intent vs. observed behavior reconciliation diagram"
            dimensions="1280 × 620"
          />
          <p>
            Desktop 1180–1280 × 560–640 px (~2:1) · Mobile calc(100vw − 32px)
            × 420–500 px, stacked Declared → Observed → Gap · Declared graph
            appears, observed graph builds, matching states connect, gap
            highlights, report settles · 3–4s build-in, then static · Respects
            prefers-reduced-motion
          </p>
        </div>
      </section>

      {/* 03 Audience selector */}
      <section className="solutions-section" id="choose-your-role">
        <div className="solutions-shell">
          <header className="solutions-section-head">
            <p className="solutions-kicker" data-aos="fade-up">
              Choose what matters to you
            </p>
            <h2 data-aos="fade-up" data-aos-delay="60">
              What does quality
              <br />
              mean to your team?
            </h2>
            <p data-aos="fade-up" data-aos-delay="120">
              The same application can create very different questions
              depending on who is looking at it.
            </p>
          </header>
          <div className="solutions-audience-grid" data-aos="tellann-panel" data-aos-delay="120">
            {audiences.map((audience) => (
              <article key={audience.href}>
                <div className="solutions-icon-placeholder" aria-hidden="true">
                  Icon
                  <br />
                  96×96
                </div>
                <h3>{audience.title}</h3>
                <p className="solutions-problem">{audience.problem}</p>
                <ul>
                  {audience.outcomes.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                <p className="solutions-outcome">{audience.outcome}</p>
                <Link href={audience.href}>
                  {audience.linkLabel} <span>→</span>
                </Link>
              </article>
            ))}
          </div>
          <div className="solutions-size-note" data-aos="fade-up" data-aos-delay="160">
            <span>
              Running a small team? Every plan — including Free — carries the
              same behavioral QA workflow, sized for how many applications and
              people you have.
            </span>
            <Link href="/pricing">Compare plans for teams of any size →</Link>
          </div>
        </div>
      </section>

      {/* 04 Shared problem */}
      <section className="solutions-section is-surface">
        <div className="solutions-shell">
          <header className="solutions-section-head">
            <p className="solutions-kicker" data-aos="fade-up">
              One product, many perspectives
            </p>
            <h2 data-aos="fade-up" data-aos-delay="60">
              Different roles.
              <br />
              One source of truth.
            </h2>
            <p data-aos="fade-up" data-aos-delay="120">
              After segmenting by role, every team reconnects around the same
              underlying evidence.
            </p>
          </header>
          <div className="solutions-shared-flow" data-aos="tellann-panel" data-aos-delay="120">
            <div>
              <span>Product says</span>
              <b>&ldquo;This workflow should exist.&rdquo;</b>
              <i aria-hidden="true">→</i>
            </div>
            <div>
              <span>Developer demonstrates</span>
              <b>&ldquo;This is what the application does.&rdquo;</b>
              <i aria-hidden="true">→</i>
            </div>
            <div>
              <span>Tellann observes</span>
              <b>&ldquo;This is what the evidence shows.&rdquo;</b>
            </div>
          </div>
          <div className="solutions-shared-outcomes" data-aos="tellann-panel" data-aos-delay="180">
            <div>
              <small>Developers</small>
              <p>See behavior.</p>
            </div>
            <div>
              <small>QA</small>
              <p>See gaps.</p>
            </div>
            <div>
              <small>Product</small>
              <p>See intent alignment.</p>
            </div>
            <div>
              <small>Leaders</small>
              <p>See evidence.</p>
            </div>
          </div>
        </div>
      </section>

      {/* 05-08 Persona deep dives */}
      <SolutionSection
        eyebrow="For software engineers"
        title="See your application as a system of behavior, not just files and functions."
        copy="Demonstrate a workflow once. Tellann captures the behavior, builds a session, discovers states, and assembles a behavior graph you can inspect for gaps."
        steps={["Demonstrate workflow", "Capture behavior", "Build session", "Discover states", "Build behavior graph", "Inspect gaps"]}
        outcome="Understand what your application actually demonstrated — not merely what the code was supposed to do."
        links={[
          { label: "Explore Tellann for Developers", href: "/solutions/developers" },
          { label: "Developer Demonstration Mode", href: "/product/demonstration-mode", muted: true },
          { label: "Behavior Graphs", href: "/product/behavior-graphs", muted: true },
        ]}
        visual={{ label: "Checkout flow behavior graph / product UI design", dimensions: "660 × 520" }}
      />

      <SolutionSection
        reverse
        eyebrow="For QA teams"
        title="Move from “what did we test?” to “what did we miss?”"
        copy="Tellann measures workflow, state, transition, endpoint, and error coverage against a demonstration, then ranks the gaps that deserve attention first."
        outcome="Turn a walkthrough into evidence for where testing effort should go next."
        links={[
          { label: "Explore Tellann for QA", href: "/solutions/qa-engineers" },
          { label: "Coverage Analysis", href: "/product/coverage", muted: true },
          { label: "Missing Flows & States", href: "/product/missing-flows", muted: true },
        ]}
        visual={{ label: "Coverage dashboard with missing failure paths / product UI design", dimensions: "680 × 500" }}
      />

      <SolutionSection
        eyebrow="For engineering leaders"
        title="Give quality conversations evidence everyone can see."
        copy="Replace “did all the tests pass?” with a shared behavioral picture: workflows discovered, coverage achieved, and the gaps still worth a conversation."
        outcome="Give engineering discussions a common source of behavioral evidence."
        links={[
          { label: "Explore Tellann for Engineering Leaders", href: "/solutions/engineering-leaders" },
          { label: "QA Reports", href: "/product/qa-reports", muted: true },
        ]}
        visual={{ label: "Application quality report summary / product UI design", dimensions: "720 × 520" }}
      />

      <SolutionSection
        reverse
        eyebrow="For product teams"
        title="Compare what you designed with what was actually demonstrated."
        copy="Declare the workflows your product should support. Tellann reconciles them against observed behavior so intent and implementation stay connected."
        outcome="Turn product intent into something that can actually be checked against the software."
        links={[
          { label: "Explore Tellann for Product Teams", href: "/solutions/product-teams" },
          { label: "Flow Declaration", href: "/product/flow-declaration", muted: true },
          { label: "Reconciliation", href: "/product/reconciliation", muted: true },
        ]}
        visual={{ label: "Intended vs. observed workflow reconciliation / product UI design", dimensions: "700 × 540" }}
      />

      {/* Explainer video */}
      <section className="solutions-section solutions-video">
        <div className="solutions-shell-narrow">
          <p className="solutions-kicker" data-aos="fade-up">
            Tellann for your team
          </p>
          <h2 data-aos="fade-up" data-aos-delay="60">
            One application. Different questions. One behavioral model.
          </h2>
          <div className="solutions-video-media" data-aos="tellann-panel" data-aos-delay="120">
            <ProductPlaceholder
              label="“Tellann for your team” explainer video placeholder"
              dimensions="960 × 540"
            />
            <p>
              Desktop 960 × 540 px · Tablet 720 × 405 px · Mobile
              calc(100vw − 32px), 16:9 · Poster 1600 × 900 px · 60–80s ·
              MP4/WebM, muted preview, captions available, no autoplay with
              sound
            </p>
          </div>
          <div className="solutions-video-beats" data-aos="fade-up" data-aos-delay="160">
            <div>
              <small>0–20s</small>
              <p>Developer and QA ask different questions about the same app.</p>
            </div>
            <div>
              <small>20–44s</small>
              <p>Product and engineering ask what the evidence shows.</p>
            </div>
            <div>
              <small>44–70s</small>
              <p>Declare → Demonstrate → Reconcile → Report, in one pass.</p>
            </div>
            <div>
              <small>70–80s</small>
              <p>One behavioral model. Different answers for every team.</p>
            </div>
          </div>
        </div>
      </section>

      {/* 11 How Tellann works */}
      <section className="solutions-section is-surface">
        <div className="solutions-shell">
          <header className="solutions-section-head">
            <p className="solutions-kicker" data-aos="fade-up">
              How Tellann works
            </p>
            <h2 data-aos="fade-up" data-aos-delay="60">
              One workflow.
              <br />
              Different value for every team.
            </h2>
            <p data-aos="fade-up" data-aos-delay="120">
              Every persona above draws from the same six-step loop.
            </p>
          </header>
          <div className="solutions-workflow-flow" data-aos="tellann-panel" data-aos-delay="120">
            {workflowSteps.map((step, index) => (
              <div key={step}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <b>{step}</b>
                {index < workflowSteps.length - 1 ? <i>→</i> : null}
              </div>
            ))}
          </div>
          <Link className="solutions-text-link" data-aos="fade-up" href="/product/how-it-works">
            See the full workflow, step by step →
          </Link>
        </div>
      </section>

      {/* 12 Outcome matrix */}
      <section className="solutions-section">
        <div className="solutions-shell">
          <header className="solutions-section-head">
            <p className="solutions-kicker" data-aos="fade-up">
              One model, different outcomes
            </p>
            <h2 data-aos="fade-up" data-aos-delay="60">
              One behavioral model.
              <br />
              Different questions answered.
            </h2>
          </header>
          <table className="solutions-matrix" data-aos="fade-up" data-aos-delay="120">
            <thead>
              <tr>
                <th>Audience</th>
                <th>Their question</th>
                <th>Tellann gives them</th>
              </tr>
            </thead>
            <tbody>
              {outcomeMatrix.map(([audience, question, answer]) => (
                <tr key={audience}>
                  <td>{audience}</td>
                  <td>{question}</td>
                  <td>{answer}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 13 Capability to outcome */}
      <section className="solutions-section is-surface">
        <div className="solutions-shell">
          <header className="solutions-section-head">
            <p className="solutions-kicker" data-aos="fade-up">
              Capability → outcome
            </p>
            <h2 data-aos="fade-up" data-aos-delay="60">
              Not a feature list.
              <br />
              What it means for you.
            </h2>
          </header>
          <div className="solutions-capability-grid" data-aos="tellann-panel" data-aos-delay="120">
            {capabilities.map(([label, outcome, href]) => (
              <Link key={href} href={href}>
                <b>{label}</b>
                <span>{outcome}</span>
                <i>Explore →</i>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* 14 Trust / privacy */}
      <section className="solutions-section">
        <div className="solutions-shell">
          <header className="solutions-section-head">
            <p className="solutions-kicker" data-aos="fade-up">
              Privacy by design
            </p>
            <h2 data-aos="fade-up" data-aos-delay="60">
              Understand behavior.
              <br />
              Not secrets.
            </h2>
          </header>
          <div className="solutions-trust-grid" data-aos="tellann-panel" data-aos-delay="120">
            <ProductPlaceholder
              label="Local-machine-to-Tellann privacy boundary diagram"
              dimensions="1050 × 420"
            />
            <div>
              <article>
                <span>Source code</span>
                <p>Stays local by default.</p>
              </article>
              <article>
                <span>Sensitive values</span>
                <p>Protected before collection.</p>
              </article>
              <article>
                <span>Behavioral evidence</span>
                <p>Sent to Tellann for analysis.</p>
              </article>
              <article>
                <span>Privacy controls</span>
                <p>Applied before data enters the platform.</p>
              </article>
            </div>
          </div>
          <Link className="solutions-text-link" data-aos="fade-up" href={docsLinks.privacy.href}>
            Read privacy principles →
          </Link>
        </div>
      </section>

      {/* 15 Platform evolution */}
      <section className="solutions-section is-surface">
        <div className="solutions-shell">
          <header className="solutions-section-head">
            <p className="solutions-kicker" data-aos="fade-up">
              Platform evolution
            </p>
            <h2 data-aos="fade-up" data-aos-delay="60">
              Start with demonstrated behavior.
              <br />
              Build toward continuous intelligence.
            </h2>
          </header>
          <div className="solutions-evolution-grid" data-aos="tellann-panel" data-aos-delay="120">
            <article>
              <span>Today · Available</span>
              <h3>Behavioral QA</h3>
              <p>
                Declare
                <br />
                Demonstrate
                <br />
                Discover
                <br />
                Reconcile
                <br />
                Report
              </p>
            </article>
            <article>
              <span>Next · Planned</span>
              <h3>Production Intelligence</h3>
              <p>
                Production behavior
                <br />
                Journey intelligence
                <br />
                Workflow health
                <br />
                Error correlation
              </p>
            </article>
            <article>
              <span>Future · Roadmap</span>
              <h3>Autonomous Intelligence</h3>
              <p>
                Regression intelligence
                <br />
                Validation
                <br />
                Simulation
                <br />
                Quality intelligence
              </p>
            </article>
          </div>
          <Link className="solutions-text-link" data-aos="fade-up" href="/roadmap">
            View the Tellann roadmap →
          </Link>
        </div>
      </section>

      {/* 16 FAQ */}
      <section className="solutions-section solutions-faq">
        <div className="solutions-shell solutions-faq-grid">
          <div>
            <p className="solutions-kicker" data-aos="fade-up">
              Solutions FAQ
            </p>
            <h2>
              The model,
              <br />
              made clear.
            </h2>
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

      {/* 17 Final CTA */}
      <section className="solutions-final">
        <div className="solutions-shell">
          <p className="solutions-kicker" data-aos="fade-up">
            Start with one application
          </p>
          <h2>
            Show Tellann how your software should behave. Then show it what
            actually happens.
          </h2>
          <p>
            Turn a guided demonstration into workflows, coverage, quality
            gaps, and evidence your whole team can use.
          </p>
          <div className="solutions-actions" data-aos="fade-up" data-aos-delay="180">
            <a className="solutions-button solutions-button-solid" href={appUrl}>
              Start free <span>↗</span>
            </a>
            <Link className="solutions-button" href="/product">
              Explore the product <span>→</span>
            </Link>
          </div>
          <small>For developers · QA · product · engineering</small>
        </div>
      </section>
    </main>
  );
}
