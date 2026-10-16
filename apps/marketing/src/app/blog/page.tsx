import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { docsLinks } from "@/config/site-routes";
import { ProductPlaceholder } from "@/components/product-tour";
import { BlogArticleExplorer } from "@/components/blog-article-explorer";
import { BlogNewsletterForm } from "@/components/blog-newsletter-form";
import "./blog.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://domain-name.com";
const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.domain-name.com";

export const metadata: Metadata = {
  title: "Tellann Blog | Software Quality, Testing & Engineering Insights",
  description:
    "Explore practical perspectives on software testing, behavioral QA, workflow coverage, application reliability, product engineering, and building better software.",
  alternates: { canonical: "/blog" },
  openGraph: {
    title: "Tellann Blog | Software Quality, Testing & Engineering Insights",
    description:
      "Engineering ideas, testing strategies, and product perspectives on how software actually behaves.",
    url: `${siteUrl}/blog`,
    type: "website",
  },
};

function Section({
  eyebrow,
  title,
  copy,
  id,
  surface = false,
  narrow = false,
  children,
}: {
  eyebrow: string;
  title: ReactNode;
  copy?: string;
  id?: string;
  surface?: boolean;
  narrow?: boolean;
  children: ReactNode;
}) {
  return (
    <section className={`blog-section${surface ? " is-surface" : ""}`} id={id}>
      <div className={narrow ? "blog-shell-narrow" : "blog-shell"}>
        <div className="blog-heading">
          <p className="blog-kicker" data-aos="fade-up">
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
      </div>
    </section>
  );
}

const audiences: {
  glyph: string;
  title: string;
  question: string;
  links: { label: string; href: string }[];
}[] = [
  {
    glyph: "</>",
    title: "Developers",
    question: "How do we make application behavior easier to understand?",
    links: [
      { label: "Code Coverage vs Workflow Coverage", href: "/blog/code-coverage-vs-workflow-coverage" },
      { label: "Your Tests Pass. But What Have You Actually Proven?", href: "/blog/your-tests-pass-but-what-have-you-actually-proven" },
    ],
  },
  {
    glyph: "✓",
    title: "QA engineers",
    question: "How do we find what our existing tests overlook?",
    links: [
      { label: "The Hidden Cost of Untested Failure Paths", href: "/blog/hidden-cost-of-untested-failure-paths" },
      { label: "Code Coverage vs Workflow Coverage", href: "/blog/code-coverage-vs-workflow-coverage" },
    ],
  },
  {
    glyph: "▣",
    title: "Engineering leaders",
    question: "What evidence should influence release decisions?",
    links: [
      { label: "Your Tests Pass. But What Have You Actually Proven?", href: "/blog/your-tests-pass-but-what-have-you-actually-proven" },
      { label: "What Is Behavioral QA, and Why Does It Matter?", href: "/blog/what-is-behavioral-qa" },
    ],
  },
  {
    glyph: "⇄",
    title: "Product teams",
    question: "How do we know implementation reflects requirements?",
    links: [
      { label: "From Product Requirements to Observable Behavior", href: "/blog/from-requirements-to-observable-behavior" },
      { label: "What Is Behavioral QA, and Why Does It Matter?", href: "/blog/what-is-behavioral-qa" },
    ],
  },
  {
    glyph: "⟡",
    title: "Founders",
    question: "How much testing is enough before shipping?",
    links: [
      { label: "A Practical QA Strategy for Small Teams", href: "/blog/qa-strategy-for-small-teams" },
      { label: "What Is Behavioral QA, and Why Does It Matter?", href: "/blog/what-is-behavioral-qa" },
    ],
  },
];

const series: { number: string; title: string; copy: string; href: string }[] = [
  {
    number: "SERIES 01",
    title: "Understanding Software Behavior",
    copy: "How states, transitions, workflows and observable evidence reveal what an application has actually done.",
    href: "/blog/series/understanding-software-behavior",
  },
  {
    number: "SERIES 02",
    title: "The Gaps We Don't Test",
    copy: "Exploring missing states, alternative paths, failure handling, and the limitations of common coverage metrics.",
    href: "/blog/series/the-gaps-we-dont-test",
  },
  {
    number: "SERIES 03",
    title: "Intent vs Reality",
    copy: "What requirements, demonstrations, testing evidence, and product behavior can tell teams about implementation quality.",
    href: "/blog/series/intent-vs-reality",
  },
];

const engineeringStories: { title: string; copy: string; href: string }[] = [
  {
    title: "What missing states reveal about application design.",
    copy: "Loading, empty, failed and recovery states are easy to skip and expensive to discover later.",
    href: "/blog/hidden-cost-of-untested-failure-paths",
  },
  {
    title: "When session replay is useful — and when it isn't.",
    copy: "Reconstructed behavior is not a substitute for declared intent.",
    href: "/blog/what-is-behavioral-qa",
  },
  {
    title: "How frontend and backend behavior become one workflow.",
    copy: "A single user action often spans components, requests, and state updates.",
    href: "/blog/code-coverage-vs-workflow-coverage",
  },
];

const teamStories: { title: string; copy: string; href: string }[] = [
  {
    title: "Design decisions behind our desktop-first demonstration workflow.",
    copy: "Why a guided walkthrough, rather than production traffic, is where Tellann starts.",
    href: "/blog/why-tellann-is-built-around-declared-intent",
  },
  {
    title: "How Tellann thinks about privacy and local source-code handling.",
    copy: "What stays on a developer's machine, and what doesn't.",
    href: "/blog/why-tellann-is-built-around-declared-intent",
  },
];

const relatedResources: { title: string; copy: string; href: string }[] = [
  { title: "Resource Hub", copy: "Learn about behavioral QA from the ground up.", href: "/resources" },
  { title: "Technical Documentation", copy: "Install, configure, and integrate Tellann.", href: docsLinks.home.href },
  { title: "Product Updates", copy: "See what the platform has actually shipped.", href: "/changelog" },
];

export default function BlogPage() {
  const structuredData = [
    {
      "@context": "https://schema.org",
      "@type": "Blog",
      name: "Tellann Blog",
      description: metadata.description,
      url: `${siteUrl}/blog`,
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
        { "@type": "ListItem", position: 2, name: "Blog", item: `${siteUrl}/blog` },
      ],
    },
  ];

  return (
    <main className="blog-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      {/* 02 Hero */}
      <section className="blog-hero">
        <div className="blog-shell">
          <p className="blog-kicker" data-aos="fade-up">
            The Tellann Blog
          </p>
          <h1 data-aos="fade-up" data-aos-delay="60">
            Better software begins with better questions.
          </h1>
          <p data-aos="fade-up" data-aos-delay="120">
            Explore engineering ideas, testing strategies, product perspectives, and
            lessons on understanding how software actually behaves.
          </p>
          <div className="blog-capability-strip" data-aos="fade-up" data-aos-delay="180">
            {["Engineering", "Software Quality", "Product Thinking"].map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        </div>
        <div className="blog-hero-grid" aria-hidden="true" />
      </section>

      {/* 03 Featured article */}
      <section className="blog-section blog-featured">
        <div className="blog-shell">
          <p className="blog-kicker" data-aos="fade-up">
            Featured story
          </p>
          <Link
            href="/blog/your-tests-pass-but-what-have-you-actually-proven"
            className="blog-featured-card"
            data-aos="tellann-panel"
            data-aos-delay="120"
          >
            <ProductPlaceholder
              label="Your tests can pass while your workflows remain unproven — featured cover image"
              dimensions="1600 × 900"
              displayDimensions="650 × 366"
              className="blog-featured-media"
            />
            <div className="blog-featured-body">
              <span className="blog-card-category">Software Quality</span>
              <h2>Your tests can pass while your workflows remain unproven.</h2>
              <p>
                Code coverage shows execution. Workflow evidence helps explain which
                application behaviors were observed — and which remain uncertain.
              </p>
              <div className="blog-card-meta">
                <span>9 min read</span>
                <span>Engineering &amp; QA</span>
              </div>
              <span className="blog-inline-link">
                Read the story <i>→</i>
              </span>
            </div>
          </Link>
        </div>
      </section>

      {/* 04-05 Search, category navigation and latest stories */}
      <section className="blog-section is-surface">
        <div className="blog-shell">
          <BlogArticleExplorer />
        </div>
      </section>

      {/* 06 Explore by audience */}
      <Section
        eyebrow="Choose what matters to you"
        title="Different responsibilities. Shared questions about quality."
      >
        <div className="blog-audience-grid" data-aos="tellann-panel" data-aos-delay="120">
          {audiences.map((audience) => (
            <article key={audience.title}>
              <span className="blog-audience-glyph" aria-hidden="true">
                {audience.glyph}
              </span>
              <h3>{audience.title}</h3>
              <p>{audience.question}</p>
              <div className="blog-audience-links">
                {audience.links.map((link) => (
                  <Link key={link.href} href={link.href}>
                    {link.label}
                  </Link>
                ))}
              </div>
            </article>
          ))}
        </div>
      </Section>

      {/* 07 Featured editorial series */}
      <Section
        surface
        eyebrow="Editorial series"
        title="Explore the ideas shaping better software quality."
      >
        <div className="blog-series-grid" data-aos="tellann-panel" data-aos-delay="120">
          {series.map((item) => (
            <Link key={item.href} href={item.href} className="blog-series-card">
              <ProductPlaceholder
                label={`${item.title} — series cover`}
                dimensions="1200 × 1500"
                displayDimensions="200 × 250"
              />
              <div>
                <span>{item.number}</span>
                <h3>{item.title}</h3>
                <p>{item.copy}</p>
                <small>Recommended: 4–6 articles</small>
              </div>
            </Link>
          ))}
        </div>
      </Section>

      {/* 08 Engineering & QA insights */}
      <Section
        eyebrow="Engineering & QA insights"
        title="For the people who build and validate."
      >
        <div className="blog-split-feature" data-aos="tellann-panel" data-aos-delay="120">
          <Link
            href="/blog/hidden-cost-of-untested-failure-paths"
            className="blog-split-feature-main"
          >
            <ProductPlaceholder
              label="Checkout workflow with observed success and unobserved failure branches — illustrative diagram"
              dimensions="1600 × 900"
              displayDimensions="700 × 394"
            />
            <div>
              <span className="blog-card-category">QA &amp; Testing</span>
              <h3>The hidden cost of untested failure paths</h3>
              <p>Why validating the happy path is rarely enough.</p>
            </div>
          </Link>
          <div className="blog-split-feature-list">
            {engineeringStories.map((story) => (
              <Link key={story.title} href={story.href}>
                <b>{story.title}</b>
                <p>{story.copy}</p>
              </Link>
            ))}
          </div>
        </div>
      </Section>

      {/* 09 Product & workflow thinking */}
      <section className="blog-section is-surface">
        <div className="blog-shell blog-product-split">
          <div>
            <p className="blog-kicker" data-aos="fade-up">
              Product &amp; workflow thinking
            </p>
            <h2 data-aos="fade-up" data-aos-delay="60">
              Software quality is a product question, too.
            </h2>
            <p data-aos="fade-up" data-aos-delay="120">
              Good software is not just code that runs. It is an experience that
              behaves consistently with what its users and creators expect.
            </p>
            <p className="blog-sample-note" data-aos="fade-up" data-aos-delay="160">
              Illustrative example: a missing observation means a path has not been
              demonstrated by the available evidence — not that the underlying feature
              is absent or broken.
            </p>
            <Link className="blog-inline-link" href="/blog/from-requirements-to-observable-behavior">
              Read the story <i>→</i>
            </Link>
          </div>
          <div data-aos="tellann-panel" data-aos-delay="120">
            <ProductPlaceholder
              label="Intended vs. observed workflow comparison — Add to cart, Checkout, Payment outcome / Not observed"
              dimensions="540 × 360"
            />
          </div>
        </div>
      </section>

      {/* 10 Videos and visual stories */}
      <section className="blog-section blog-video">
        <div className="blog-shell-narrow">
          <p className="blog-kicker" data-aos="fade-up">
            Videos &amp; visual stories
          </p>
          <h2 data-aos="fade-up" data-aos-delay="60">
            Some ideas are easier to see.
          </h2>
          <div className="blog-video-split" data-aos="tellann-panel" data-aos-delay="120">
            <ProductPlaceholder
              label="Why coverage is more than execution — featured video"
              dimensions="1920 × 1080"
              displayDimensions="720 × 405"
            />
            <div className="blog-video-card">
              <span>VISUAL STORY</span>
              <h3>Why coverage is more than execution</h3>
              <ProductPlaceholder
                label="What does a behavior graph represent? — video card"
                dimensions="1280 × 720"
                displayDimensions="360 × 203"
              />
              <p>Watch →</p>
            </div>
          </div>
          <p className="blog-media-note" data-aos="fade-up" data-aos-delay="160">
            Click-to-play, captioned, no autoplay with sound. Motion graphics use
            Tellann&rsquo;s black, white and greyscale palette — no animated code as
            filler.
          </p>
        </div>
      </section>

      {/* 11 From the Tellann team */}
      <Section surface eyebrow="Building in the open" title="From the Tellann team.">
        <div className="blog-team-grid" data-aos="tellann-panel" data-aos-delay="120">
          <Link href="/blog/why-tellann-is-built-around-declared-intent" className="blog-team-main">
            <ProductPlaceholder
              label="Why Tellann focuses on behavioral evidence — team article cover"
              dimensions="1200 × 675"
              displayDimensions="650 × 366"
            />
            <div>
              <span className="blog-card-category">Inside Tellann</span>
              <h3>Why Tellann focuses on behavioral evidence</h3>
              <p>Lessons from building reliable workflow models.</p>
            </div>
          </Link>
          <div className="blog-team-list">
            {teamStories.map((story) => (
              <Link key={story.title} href={story.href}>
                <b>{story.title}</b>
                <p>{story.copy}</p>
              </Link>
            ))}
            <Link className="blog-inline-link" href="/company">
              Meet the team <i>→</i>
            </Link>
          </div>
        </div>
      </Section>

      {/* 12 Newsletter */}
      <section className="blog-section blog-newsletter">
        <div className="blog-shell-narrow">
          <p className="blog-kicker" data-aos="fade-up">
            Good ideas, delivered occasionally
          </p>
          <h2 data-aos="fade-up" data-aos-delay="60">
            Get thoughtful articles on software quality, behavioral testing, and
            meaningful updates from Tellann.
          </h2>
          <div data-aos="fade-up" data-aos-delay="120">
            <BlogNewsletterForm />
          </div>
        </div>
      </section>

      {/* 13 Browse the archive */}
      <section className="blog-section blog-archive">
        <div className="blog-shell">
          <Link className="blog-text-link" href="#latest-thinking">
            View all articles <i>→</i>
          </Link>
        </div>
      </section>

      {/* 14 Related learning resources */}
      <Section surface eyebrow="Continue exploring" title="Related learning resources.">
        <div className="blog-related-grid" data-aos="tellann-panel" data-aos-delay="120">
          {relatedResources.map((item) => (
            <Link key={item.href} href={item.href}>
              <b>{item.title}</b>
              <span>{item.copy}</span>
              <i>Explore →</i>
            </Link>
          ))}
        </div>
      </Section>

      {/* 15 Final CTA */}
      <section className="blog-final">
        <div className="blog-shell">
          <p className="blog-kicker" data-aos="fade-up">
            From ideas to evidence
          </p>
          <h2 data-aos="fade-up" data-aos-delay="60">
            See what your application actually demonstrated.
          </h2>
          <p data-aos="fade-up" data-aos-delay="120">
            Go from intended workflows to observed behavior, coverage,
            reconciliation, and QA reports with Tellann.
          </p>
          <div className="blog-actions" data-aos="fade-up" data-aos-delay="180">
            <a className="blog-button blog-button-solid" href={appUrl}>
              Start free <span>↗</span>
            </a>
            <Link className="blog-button" href="/product">
              Explore the product <span>→</span>
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
