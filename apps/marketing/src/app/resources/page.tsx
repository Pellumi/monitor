import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { ProductPlaceholder } from "@/components/product-tour";
import { docsLinks } from "@/config/site-routes";
import "../solutions/developers/developers.css";
import "./resources.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://domain-name.com";
const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.domain-name.com";

export const metadata: Metadata = {
  title: "Software QA Resources, Guides & Tutorials",
  description:
    "Explore Tellann guides, tutorials, videos and resources for behavioral QA, workflow coverage, session replay, missing states, API analysis and software quality.",
  alternates: { canonical: "/resources" },
  openGraph: {
    title: "Software QA Resources, Guides & Tutorials | Tellann",
    description:
      "Tell us what you're trying to understand. We'll explain the concept, show how Tellann approaches it, and teach you how to use it.",
    url: `${siteUrl}/resources`,
    type: "website",
  },
};

function Section({
  eyebrow,
  title,
  copy,
  id,
  surface = false,
  children,
}: {
  eyebrow: string;
  title: ReactNode;
  copy?: string;
  id?: string;
  surface?: boolean;
  children: ReactNode;
}) {
  return (
    <section className={`dev-section${surface ? " is-surface" : ""}`} id={id}>
      <div className="dev-shell dev-heading">
        <p className="dev-kicker" data-aos="fade-up">
          {eyebrow}
        </p>
        <h2 data-aos="fade-up" data-aos-delay="60">
          {title}
        </h2>
        {copy ? (
          <p data-aos="fade-up" data-aos-delay="120">
            {copy}
          </p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

const jumpLinks: [string, string][] = [
  ["#start-here", "Start here"],
  ["#by-role", "By role"],
  ["#by-problem", "By problem"],
  ["#featured", "Featured"],
  ["#concepts", "Concepts"],
  ["#guides", "Guides"],
  ["#videos", "Videos"],
  ["#developers", "Developers"],
  ["#quality", "Quality"],
  ["#trust", "Privacy"],
  ["#updates", "Updates"],
  ["#glossary", "Glossary"],
];

const popularTopics: [string, string][] = [
  ["#concept-behavior-graphs", "Behavior Graphs"],
  ["#concept-coverage", "Workflow Coverage"],
  ["#concept-session-replay", "Session Replay"],
  ["#concept-missing-states", "Missing States"],
  ["#developers", "Desktop Agent"],
  ["#concept-reconciliation", "Reconciliation"],
];

const journeySteps: [string, string][] = [
  ["Declare", "Describe what should happen"],
  ["Demonstrate", "Show Tellann the workflow"],
  ["Observe", "Tellann reconstructs the behavior"],
  ["Compare", "Intent vs. observation"],
  ["Understand", "Coverage, gaps and QA intelligence"],
];

const starterResources: [string, string, string, string, string][] = [
  [
    "Guide · 5 min",
    "Tellann in 5 minutes",
    "What Tellann does, what problem it solves, and where it fits.",
    "Read →",
    "/resources/guides/tellann-in-5-minutes",
  ],
  [
    "Video · 3:30",
    "Watch how it works",
    "Declare a workflow, demonstrate it and inspect the results.",
    "Watch →",
    "/resources/videos/how-tellann-works",
  ],
  [
    "Tutorial · 10 min",
    "Try your first application",
    "Connect an application and complete your first guided run.",
    "Start →",
    docsLinks.quickstart.href,
  ],
];

type RoleCard = {
  kicker: string;
  question: string;
  points: string[];
  ctaLabel: string;
  ctaHref: string;
};

const roles: RoleCard[] = [
  {
    kicker: "Developer",
    question: "What actually happened in my application?",
    points: ["Application states", "Workflow transitions", "Failed API requests", "Session evidence"],
    ctaLabel: "Explore developer resources →",
    ctaHref: "/solutions/developers",
  },
  {
    kicker: "QA engineer",
    question: "What haven't we validated?",
    points: ["Workflow coverage", "Missing states", "Missing flows", "Reconciliation"],
    ctaLabel: "Explore QA resources →",
    ctaHref: "/solutions/qa-engineers",
  },
  {
    kicker: "Engineering manager",
    question: "What evidence do we have about release quality?",
    points: ["Coverage visibility", "Critical gaps", "Evidence history", "Team workflows"],
    ctaLabel: "Explore engineering leadership resources →",
    ctaHref: "/solutions/engineering-leaders",
  },
  {
    kicker: "Product team",
    question: "Does the product behave the way we intended?",
    points: ["Declared intent", "Observed workflows", "Undeclared behavior", "Workflow maps"],
    ctaLabel: "Explore product resources →",
    ctaHref: "/solutions/product-teams",
  },
  {
    kicker: "Startup founder",
    question: "How do I get QA visibility without a large QA operation?",
    points: ["Fast setup", "Guided demonstrations", "Coverage", "Small-team workflows"],
    ctaLabel: "Explore startup resources →",
    ctaHref: "/pricing",
  },
];

const problems: [string, string, string][] = [
  ["How much of our workflow have we actually validated?", "Workflow Coverage", "/product/coverage"],
  ["What happens after a user takes this action?", "Behavior Graphs", "/product/behavior-graphs"],
  ["Which states did we never reach?", "Missing States", "/product/missing-states"],
  ["Which paths were never demonstrated?", "Missing Flows", "/product/missing-flows"],
  ["Does our implementation match the workflow we intended?", "Reconciliation", "/product/reconciliation"],
  ["What happened during this run?", "Session Replay", "/product/session-replay"],
];

type Concept = {
  slug: string;
  label: string;
  copy: string;
  readTime: string;
  href: string;
};

const concepts: Concept[] = [
  {
    slug: "declared-intent",
    label: "Declared Intent",
    copy: "What a workflow is supposed to do, described before anyone demonstrates it.",
    readTime: "2 min",
    href: "/product/flow-declaration",
  },
  {
    slug: "developer-demonstration",
    label: "Developer Demonstration",
    copy: "Teaching Tellann by walking through a real workflow in your own application.",
    readTime: "2 min",
    href: "/product/demonstration-mode",
  },
  {
    slug: "behavior-graphs",
    label: "Behavior Graphs",
    copy: "Observed states, actions and transitions, connected into one behavioral model.",
    readTime: "3 min",
    href: "/product/behavior-graphs",
  },
  {
    slug: "workflow-discovery",
    label: "Workflow Discovery",
    copy: "Turning raw captured interactions into named, reviewable workflows.",
    readTime: "3 min",
    href: "/product/workflow-discovery",
  },
  {
    slug: "session-replay",
    label: "Session Replay",
    copy: "Reconstructing a demonstrated session from behavioral telemetry, not a screen recording.",
    readTime: "2 min",
    href: "/product/session-replay",
  },
  {
    slug: "coverage",
    label: "Coverage",
    copy: "How much of the intended behavior has actually been demonstrated and observed.",
    readTime: "4 min",
    href: "/product/coverage",
  },
  {
    slug: "missing-states",
    label: "Missing States & Flows",
    copy: "The states and paths that were expected but never showed up in the evidence.",
    readTime: "4 min",
    href: "/product/missing-states",
  },
  {
    slug: "reconciliation",
    label: "Reconciliation",
    copy: "Placing declared intent and observed behavior side by side to see what differs.",
    readTime: "3 min",
    href: "/product/reconciliation",
  },
  {
    slug: "qa-reports",
    label: "QA Reports",
    copy: "Turning graphs, coverage and gaps into a report a whole team can act on.",
    readTime: "2 min",
    href: "/product/qa-reports",
  },
];

type Guide = {
  category: string;
  title: string;
  copy: string;
  meta: string;
  href: string;
};

const guides: Guide[] = [
  {
    category: "QA GUIDE",
    title: "Workflow coverage vs. code coverage",
    copy: "Code coverage tells you which code executed. Workflow coverage tells you which application behaviors were actually observed.",
    meta: "QA Engineers · Developers · 7 min",
    href: "/resources/guides/workflow-coverage-vs-code-coverage",
  },
  {
    category: "GUIDE",
    title: "How to identify missing application states",
    copy: "Use observed states and paths to identify loading, empty, error and timeout states that still need validation.",
    meta: "Developers · QA Engineers · 6 min",
    href: "/resources/guides/identify-missing-application-states",
  },
  {
    category: "GUIDE",
    title: "QA strategy for early-stage startups",
    copy: "Build meaningful quality visibility around your product without first constructing a heavyweight QA operation.",
    meta: "Founders · Product Teams · 8 min",
    href: "/resources/guides/qa-strategy-for-startups",
  },
];

const videoBeats: [string, string][] = [
  ["00:00", "Application opens; the happy path runs as expected"],
  ["00:20", "The intended workflow is declared"],
  ["00:50", "Tellann Desktop opens a guided run"],
  ["01:45", "The workflow is demonstrated end to end"],
  ["02:20", "A Behavior Graph is generated from the evidence"],
  ["02:50", "Coverage and gaps are reviewed"],
  ["03:20", "Declared intent is reconciled with observed behavior"],
  ["03:50", "Findings are packaged into a QA report"],
];

const smallVideos: [string, string, string][] = [
  ["Tellann Desktop in 2 minutes", "2:14", "/resources/videos/desktop-in-2-minutes"],
  ["Understanding your Behavior Graph", "4:20", "/resources/videos/understanding-behavior-graphs"],
  ["Finding missing workflow states", "3:45", "/resources/videos/finding-missing-states"],
];

const developerCards: [string, string, string][] = [
  ["Documentation", "Guides, references and tutorials for building with Tellann.", docsLinks.home.href],
  ["SDK quickstart", "Capture your first demonstration from a connected application.", docsLinks.quickstart.href],
  ["Desktop setup", "Connect a local project and prepare it for a guided run.", "/desktop"],
  ["Event reference", "The events Tellann captures during a demonstration.", docsLinks.events.href],
  ["Automated instrumentation", "Tellann wires the SDK into your frontend; you review the diff.", "/product/automated-instrumentation"],
  ["SDK reference", "Supported frameworks: React, Next.js, Node.js, Express, NestJS, Fastify.", docsLinks.sdk.href],
];

const qaResources: [string, string][] = [
  ["Planning a guided QA run", "/product/guided-qa-runs"],
  ["Understanding workflow coverage", "/product/coverage"],
  ["Reading missing-state findings", "/product/missing-states"],
  ["Using replay as evidence", "/product/session-replay"],
];

const stakeholderResources: [string, string][] = [
  ["Reading an executive QA report", "/product/qa-reports"],
  ["What “missing” actually means", "/product/missing-flows"],
  ["Evaluating evidence before release", "/product/reconciliation"],
  ["Workflow completeness at a glance", "/product/behavior-graphs"],
];

const evolution: [string, string, string, string][] = [
  ["What shipped", "Product changelog", "See new capabilities, improvements and fixes.", "/changelog"],
  ["What's next", "Tellann roadmap", "See how Tellann evolves from behavioral QA toward production intelligence.", "/roadmap"],
];

const glossary: [string, string, string][] = [
  ["Behavior Graph", "A connected model of observed states, actions and transitions.", "/resources/glossary/behavior-graph"],
  ["Behavioral QA", "Assessing quality from demonstrated, observed behavior rather than assumptions.", "/resources/glossary/behavioral-qa"],
  ["Workflow Coverage", "How much of an intended workflow has actually been demonstrated.", "/resources/glossary/workflow-coverage"],
  ["Missing State", "A state that was expected but never appeared in the captured evidence.", "/resources/glossary/missing-state"],
  ["Missing Flow", "A path through an application that was never demonstrated.", "/resources/glossary/missing-flow"],
  ["Reconciliation", "Comparing declared intent against observed behavior.", "/resources/glossary/reconciliation"],
  ["Session Replay", "A reconstructed timeline of a demonstrated session.", "/resources/glossary/session-replay"],
  ["Declared Intent", "What a workflow is supposed to do, described ahead of demonstration.", "/resources/glossary/declared-intent"],
  ["Observed Behavior", "What the evidence shows an application actually did.", "/resources/glossary/observed-behavior"],
];

export default function ResourcesPage() {
  const structuredData = [
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: "Tellann Resources",
      description: metadata.description,
      url: `${siteUrl}/resources`,
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
        { "@type": "ListItem", position: 2, name: "Resources", item: `${siteUrl}/resources` },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      itemListElement: guides.map((guide, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: guide.title,
        url: `${siteUrl}${guide.href}`,
      })),
    },
  ];

  return (
    <main className="dev-page resources-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      {/* Hero */}
      <section className="dev-hero">
        <div className="dev-shell dev-hero-copy">
          <p className="dev-kicker" data-aos="fade-up">
            Tellann resources
          </p>
          <h1 data-aos="fade-up" data-aos-delay="60">
            Understand software behavior. Build with more confidence.
          </h1>
          <p data-aos="fade-up" data-aos-delay="120">
            Explore guides, tutorials, videos and technical resources for
            understanding application behavior, workflow coverage, missing
            states and the difference between intended and observed
            software.
          </p>
          <div className="dev-actions" data-aos="fade-up" data-aos-delay="180">
            <a className="dev-button dev-button-solid" href="#start-here">
              Explore resources <span>↓</span>
            </a>
            <Link className="dev-button" href={docsLinks.home.href}>
              Read documentation <span>→</span>
            </Link>
          </div>
          <div className="res-search" data-aos="fade-up" data-aos-delay="220">
            <div className="res-search-box">
              <span aria-hidden="true">⌕</span>
              <input
                type="text"
                placeholder="Search guides, videos and concepts..."
                aria-label="Search resources"
              />
            </div>
            <div className="res-search-popular">
              <span>Popular:</span>
              {popularTopics.map(([href, label]) => (
                <a key={label} href={href}>
                  {label}
                </a>
              ))}
            </div>
          </div>
        </div>
        <div className="dev-shell dev-hero-media">
          <ProductPlaceholder
            label="Resource constellation — Behavior Graph, Coverage, Session Replay, Missing States and Reconciliation connected around one system"
            dimensions="1400 × 1000"
            displayDimensions="1180 × 560"
          />
          <p>
            Desktop 1180 × 560 px · Tablet 100% width, max 460 px height ·
            Mobile 100% width, 260–320 px collapses to a vertical sequence ·
            Central node appears, connectors extend, resource nodes and
            labels fade in over ~450ms, then static · Respects
            prefers-reduced-motion
          </p>
        </div>

        <nav className="dev-shell dev-jump" aria-label="On this page">
          {jumpLinks.map(([href, label]) => (
            <a key={href} href={href}>
              {label}
            </a>
          ))}
        </nav>
      </section>

      {/* Start here */}
      <Section
        id="start-here"
        surface
        eyebrow="New to Tellann?"
        title="Start here."
        copy="Tellann begins with a simple idea: describe what the software should do, demonstrate what it actually does, and compare the two."
      >
        <div className="dev-shell dev-workflow-flow" data-aos="tellann-panel" data-aos-delay="120">
          {journeySteps.map(([name, copy], index) => (
            <div key={name}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <b>{name}</b>
              <p>{copy}</p>
              {index < journeySteps.length - 1 ? <i>→</i> : null}
            </div>
          ))}
        </div>
        <div className="dev-shell res-starter-grid" data-aos="fade-up" data-aos-delay="160">
          {starterResources.map(([kicker, title, copy, cta, href]) => (
            <Link key={title} href={href}>
              <b>{kicker}</b>
              <strong>{title}</strong>
              <p>{copy}</p>
              <i>{cta}</i>
            </Link>
          ))}
        </div>
      </Section>

      {/* Explore by role */}
      <Section
        id="by-role"
        eyebrow="Explore by role"
        title="Resources for the way you work."
        copy="Tellann answers different questions depending on what you are responsible for."
      >
        <div className="dev-shell res-role-grid" data-aos="tellann-panel" data-aos-delay="120">
          {roles.map((role) => (
            <article key={role.kicker}>
              <p className="res-role-kicker">{role.kicker}</p>
              <blockquote>&ldquo;{role.question}&rdquo;</blockquote>
              <ul>
                {role.points.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
              <Link className="res-role-cta" href={role.ctaHref}>
                {role.ctaLabel}
              </Link>
            </article>
          ))}
        </div>
      </Section>

      {/* Explore by problem */}
      <Section
        id="by-problem"
        surface
        eyebrow="Explore by problem"
        title="What are you trying to understand?"
        copy="Some visitors arrive with a job title. Others arrive with a problem. Both are welcome here."
      >
        <div className="dev-shell dev-usecase-grid" data-aos="tellann-panel" data-aos-delay="120">
          {problems.map(([question, concept, href]) => (
            <article key={question}>
              <b>{question}</b>
              <p>Related concept and product capability.</p>
              <span>
                <Link href={href} className="dev-inline-link">
                  → {concept}
                </Link>
              </span>
            </article>
          ))}
        </div>
      </Section>

      {/* Featured resource */}
      <section className="dev-section" id="featured">
        <div className="dev-shell dev-split">
          <div className="dev-split-visual" data-aos="tellann-panel" data-aos-delay="120">
            <ProductPlaceholder
              label="Known workflow A–B–C–D vs. observed A–B–C — the gap is the interesting part / editorial artwork"
              dimensions="1600 × 900"
              displayDimensions="620 × 350"
            />
          </div>
          <div className="dev-split-copy">
            <p className="dev-kicker" data-aos="fade-up">
              Featured guide
            </p>
            <h2 data-aos="fade-up" data-aos-delay="60">
              How behavioral QA changes what &ldquo;coverage&rdquo; means.
            </h2>
            <p data-aos="fade-up" data-aos-delay="120">
              Code coverage tells you what ran. Workflow coverage tells you
              what was actually demonstrated and observed — and what still
              isn&rsquo;t.
            </p>
            <Link
              className="dev-inline-link"
              href="/resources/guides/workflow-coverage-vs-code-coverage"
              data-aos="fade-up"
              data-aos-delay="160"
            >
              8 min read · Read guide <span>→</span>
            </Link>
          </div>
        </div>
        <p className="dev-shell dev-media-note">
          Whole section ~1200 × 430 px · Visual master 1600 × 900 px (16:9) ·
          Displayed ~580 × 326 px · Illustrative editorial artwork, not a
          photograph
        </p>
      </section>

      {/* Learn Tellann */}
      <Section
        id="concepts"
        surface
        eyebrow="Learn the system"
        title="Learn Tellann, one concept at a time."
        copy="Ordered the way the product actually works: declare, demonstrate, observe, model, analyze, reconcile, report."
      >
        <div className="dev-shell dev-related-grid" data-aos="tellann-panel" data-aos-delay="120">
          {concepts.map((concept) => (
            <Link key={concept.slug} id={`concept-${concept.slug}`} href={concept.href}>
              <b>{concept.label}</b>
              <span>{concept.copy}</span>
              <i>{concept.readTime} · Learn →</i>
            </Link>
          ))}
        </div>
      </Section>

      {/* Practical guides */}
      <Section id="guides" eyebrow="Practical guides" title="Guides for real testing situations.">
        <div className="dev-shell dev-related-grid" data-aos="tellann-panel" data-aos-delay="120">
          {guides.map((guide) => (
            <Link key={guide.href} href={guide.href}>
              <b>{guide.title}</b>
              <span>{guide.copy}</span>
              <i>
                {guide.category} · {guide.meta}
              </i>
            </Link>
          ))}
        </div>
      </Section>

      {/* Watch & learn */}
      <section className="dev-section dev-video is-surface" id="videos">
        <div className="dev-shell-narrow">
          <p className="dev-kicker" data-aos="fade-up">
            See Tellann in action
          </p>
          <h2 data-aos="fade-up" data-aos-delay="60">
            From demonstration to QA report.
          </h2>
          <div className="dev-video-media" data-aos="tellann-panel" data-aos-delay="120">
            <ProductPlaceholder
              label="From demonstration to QA report — featured product video"
              dimensions="1920 × 1080"
              displayDimensions="960 × 540"
            />
            <p>
              Desktop 960 × 540 px · Mobile full width, 16:9 · Poster 1600 ×
              900 px · 3–5 min · Click-to-play, no autoplay with sound ·
              Captions and transcript included
            </p>
          </div>
          <div className="dev-video-beats" data-aos="fade-up" data-aos-delay="160">
            {videoBeats.slice(0, 4).map(([time, copy]) => (
              <div key={time}>
                <small>{time}</small>
                <p>{copy}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="dev-shell res-video-grid" data-aos="fade-up" data-aos-delay="200">
          {smallVideos.map(([title, duration, href]) => (
            <Link key={href} href={href}>
              <ProductPlaceholder
                label={`${title} — video thumbnail`}
                dimensions="1280 × 720"
                displayDimensions="360 × 203"
              />
              <b>{title}</b>
              <span>{duration}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Building with Tellann */}
      <Section
        id="developers"
        eyebrow="Building with Tellann"
        title="Building with Tellann."
        copy="The resource hub explains the concept. Docs implement it."
      >
        <pre className="dev-shell res-code">
          <code>{'import { TELLANN } from "@tellann/frontend-sdk";'}</code>
        </pre>
        <div className="dev-shell dev-related-grid" data-aos="tellann-panel" data-aos-delay="160">
          {developerCards.map(([title, copy, href]) => (
            <Link key={title} href={href}>
              <b>{title}</b>
              <span>{copy}</span>
              <i>Start →</i>
            </Link>
          ))}
        </div>
      </Section>

      {/* Quality & stakeholder resources */}
      <Section
        id="quality"
        surface
        eyebrow="For teams responsible for quality"
        title="Quality evidence without the telemetry maze."
        copy="Move beyond counting test cases. See which workflows, states and transitions were actually demonstrated — and which remain unobserved."
      >
        <div className="res-subgroup">
          <p className="dev-shell res-subhead">For QA & engineering teams</p>
          <div className="dev-shell dev-usecase-grid" data-aos="tellann-panel" data-aos-delay="120">
            {qaResources.map(([title, href]) => (
              <article key={title}>
                <b>{title}</b>
                <p>Practical guidance for teams exercising and reviewing a demonstrated workflow.</p>
                <span>
                  <Link href={href} className="dev-inline-link">
                    → Read more
                  </Link>
                </span>
              </article>
            ))}
          </div>
        </div>
        <div className="dev-shell res-subgroup">
          <p className="res-subhead">For managers & stakeholders</p>
          <div className="dev-usecase-grid" data-aos="tellann-panel" data-aos-delay="160">
            {stakeholderResources.map(([title, href]) => (
              <article key={title}>
                <b>{title}</b>
                <p>Nontechnical framing, built so quality evidence stays understandable without JSON.</p>
                <span>
                  <Link href={href} className="dev-inline-link">
                    → Read more
                  </Link>
                </span>
              </article>
            ))}
          </div>
        </div>
      </Section>

      {/* Privacy & trust */}
      <Section
        id="trust"
        eyebrow="Learn how Tellann handles your data"
        title="Quality evidence. Responsible data handling."
        copy="Tellann observes application behavior, so you'll ask what exactly is being collected. Here's how to find out."
      >
        <div className="dev-shell dev-trust-grid" data-aos="tellann-panel" data-aos-delay="120">
          <ProductPlaceholder
            label="Application events through the privacy layer to behavioral evidence — masking diagram"
            dimensions="1200 × 720"
            displayDimensions="600 × 360"
          />
          <div>
            <article>
              <span>What Tellann observes</span>
              <p>Behavioral events and metadata: clicks, routes, states and API status.</p>
            </article>
            <article>
              <span>What Tellann masks</span>
              <p>Sensitive information is subject to collection restrictions and masking by default.</p>
            </article>
            <article>
              <span>What Tellann never needs</span>
              <p>Secrets and protected values are excluded rather than captured and redacted later.</p>
            </article>
          </div>
        </div>
        <Link className="dev-text-link" data-aos="fade-up" href={docsLinks.privacy.href}>
          Explore security & privacy →
        </Link>
      </Section>

      {/* Product evolution */}
      <Section id="updates" surface eyebrow="Product evolution" title="See where Tellann is going.">
        <div className="dev-shell res-evolution-grid" data-aos="tellann-panel" data-aos-delay="120">
          {evolution.map(([kicker, title, copy, href]) => (
            <Link key={href} href={href}>
              <b>{kicker}</b>
              <strong>{title}</strong>
              <p>{copy}</p>
              <i>{kicker === "What shipped" ? "View changelog →" : "View roadmap →"}</i>
            </Link>
          ))}
        </div>
      </Section>

      {/* Glossary */}
      <Section
        id="glossary"
        eyebrow="Glossary"
        title="Software quality, explained plainly."
        copy="Ten genuinely useful glossary entries beat five hundred SEO skeletons."
      >
        <div className="dev-shell dev-related-grid" data-aos="tellann-panel" data-aos-delay="120">
          {glossary.map(([term, definition, href]) => (
            <Link key={href} href={href}>
              <b>{term}</b>
              <span>{definition}</span>
              <i>Glossary →</i>
            </Link>
          ))}
        </div>
      </Section>

      {/* Final CTA */}
      <section className="dev-final">
        <div className="dev-shell">
          <p className="dev-kicker" data-aos="fade-up">
            Ready to look closer?
          </p>
          <h2 data-aos="fade-up" data-aos-delay="60">
            Ready to look at your own application?
          </h2>
          <p data-aos="fade-up" data-aos-delay="120">
            Declare what should happen, demonstrate a workflow, and let
            Tellann show you what the evidence says.
          </p>
          <div className="dev-actions" data-aos="fade-up" data-aos-delay="180">
            <a className="dev-button dev-button-solid" href={appUrl}>
              Start free <span>↗</span>
            </a>
            <Link className="dev-button" href={docsLinks.home.href}>
              Read the docs <span>→</span>
            </Link>
          </div>
          <small>
            A 14-day trial, when offered, authorizes a card for automatic
            conversion — never a hidden charge.
          </small>
        </div>
      </section>
    </main>
  );
}
