import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { ProductPlaceholder } from "@/components/product-tour";
import { ChangelogReleaseExplorer } from "@/components/changelog-release-explorer";
import { ChangelogRoleTabs } from "@/components/changelog-role-tabs";
import { ChangelogSubscribeForm } from "@/components/changelog-subscribe-form";
import { docsLinks } from "@/config/site-routes";
import "../solutions/developers/developers.css";
import "./changelog.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://domain-name.com";
const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.domain-name.com";

export const metadata: Metadata = {
  title: "Tellann Changelog | Product Updates, Features & Fixes",
  description:
    "Explore the latest Tellann product updates, new features, improvements, fixes, desktop releases, SDK changes, and important platform announcements.",
  alternates: { canonical: "/changelog" },
  openGraph: {
    title: "Tellann Changelog | Product Updates, Features & Fixes",
    description:
      "Follow new capabilities, improvements, fixes, and platform updates across Tellann. See what changed, why it matters, and how to use it.",
    url: `${siteUrl}/changelog`,
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
    <section className={`dev-section${surface ? " is-surface" : ""}`} id={id}>
      <div className={narrow ? "dev-shell-narrow" : "dev-shell"}>
        <div className="dev-heading">
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
      </div>
    </section>
  );
}

const jumpLinks: [string, string][] = [
  ["#latest", "Latest"],
  ["#browse", "All updates"],
  ["#demonstration", "See it"],
  ["#roles", "By role"],
  ["#platforms", "Platforms"],
  ["#evolution", "Evolution"],
  ["#subscribe", "Subscribe"],
  ["#resources", "Resources"],
];

const platforms: [string, string][] = [
  ["Web", "Web App"],
  ["Dsk", "Desktop Agent"],
  ["SDK", "JS/TS SDK"],
  ["API", "API"],
  ["Svc", "Backend Services"],
  ["Int", "Integrations"],
  ["Sec", "Security & Identity"],
  ["Bil", "Billing & Subscription"],
];

const relatedResources: [string, string, string][] = [
  ["Documentation", "Learn how to use current capabilities.", docsLinks.home.href],
  ["Roadmap", "Understand possible future improvements.", "/roadmap"],
  ["Blog", "Read engineering perspectives behind product decisions.", "/blog"],
  ["Resource hub", "Find learning guides and videos.", "/resources"],
];

export default function ChangelogPage() {
  const structuredData = [
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: "Tellann Changelog",
      description: metadata.description,
      url: `${siteUrl}/changelog`,
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
        { "@type": "ListItem", position: 2, name: "Resources", item: `${siteUrl}/resources` },
        { "@type": "ListItem", position: 3, name: "Changelog", item: `${siteUrl}/changelog` },
      ],
    },
  ];

  return (
    <main className="dev-page changelog-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      {/* Hero */}
      <section className="dev-hero">
        <div className="dev-shell dev-hero-copy">
          <p className="dev-kicker" data-aos="fade-up">
            Tellann changelog
          </p>
          <h1 data-aos="fade-up" data-aos-delay="60">
            Built, improved, and documented.
          </h1>
          <p data-aos="fade-up" data-aos-delay="120">
            Follow new capabilities, improvements, fixes, and platform
            updates across Tellann. See what changed, why it matters, and
            how to use it.
          </p>
          <div className="dev-capability-strip" data-aos="fade-up" data-aos-delay="160">
            {["Features", "Improvements", "Fixes", "Security"].map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
          <div className="dev-actions" data-aos="fade-up" data-aos-delay="200">
            <a className="dev-button dev-button-solid" href="#latest">
              See latest updates <span>↓</span>
            </a>
            <Link className="dev-button" href="/roadmap">
              Explore roadmap <span>→</span>
            </Link>
          </div>
        </div>
        <div className="dev-shell dev-hero-media">
          <ProductPlaceholder
            label="Vertical stack of release records with connectors showing the product evolving over time — hero illustration"
            dimensions="1200 × 1000"
            displayDimensions="430 × 360"
          />
          <p>
            Desktop ~430 × 360 px · Mobile 100% width, 260–320 px collapses
            to a vertical sequence · Timeline line appears, three abstract
            update cards reveal in sequence, then static (~1.8–2.4s) ·
            Respects prefers-reduced-motion
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

      {/* Latest release highlight */}
      <section className="dev-section" id="latest">
        <div className="dev-shell">
          <div className="dev-heading">
            <p className="dev-kicker" data-aos="fade-up">
              The latest from Tellann
            </p>
            <h2 data-aos="fade-up" data-aos-delay="60">
              What shipped most recently.
            </h2>
          </div>
          <div className="changelog-latest-card" data-aos="tellann-panel" data-aos-delay="120">
            <ProductPlaceholder
              label="A clearer way to review workflow evidence — illustrative release cover"
              dimensions="1600 × 900"
              displayDimensions="650 × 366"
            />
            <div className="changelog-latest-body">
              <span className="changelog-tag">Feature · Web app</span>
              <h2>A clearer way to review workflow evidence.</h2>
              <p>
                Explore how a release note can explain improvements to QA
                reporting: what changed, which users benefit, and where to
                learn more.
              </p>
              <small>
                Conceptual release illustration. Not a claim that this
                update has shipped.
              </small>
            </div>
          </div>
        </div>
      </section>

      {/* Browse updates: filters and timeline */}
      <section className="dev-section is-surface" id="browse">
        <div className="dev-shell">
          <div className="dev-heading">
            <p className="dev-kicker" data-aos="fade-up">
              Explore product updates
            </p>
            <h2 data-aos="fade-up" data-aos-delay="60">
              Find the update that matters to you.
            </h2>
          </div>
          <ChangelogReleaseExplorer />
        </div>
      </section>

      {/* Featured visual demonstration */}
      <section className="dev-section dev-video" id="demonstration">
        <div className="dev-shell-narrow">
          <p className="dev-kicker" data-aos="fade-up">
            See it, not just read it
          </p>
          <h2 data-aos="fade-up" data-aos-delay="60">
            See what changed, not just what it&rsquo;s called.
          </h2>
          <div className="dev-video-media" data-aos="tellann-panel" data-aos-delay="120">
            <ProductPlaceholder
              label="Updated workflow reconciliation view — release screenshot"
              dimensions="1600 × 900"
              displayDimensions="740 × 416"
            />
            <p>
              Desktop ~740 × 416 px · Mobile full width, 16:9 · Poster-first,
              lazy-loaded when a video is used · Captions mandatory, no
              autoplay audio
            </p>
          </div>
        </div>
      </section>

      {/* Updates by role */}
      <Section
        id="roles"
        eyebrow="Explore by role"
        title="The updates that matter to your work."
        copy="Most readers don't need Tellann's internal architecture to understand why a release matters."
      >
        <div data-aos="tellann-panel" data-aos-delay="120">
          <ChangelogRoleTabs />
        </div>
      </Section>

      {/* Platform & compatibility */}
      <Section
        id="platforms"
        surface
        eyebrow="Platform and compatibility"
        title="Know exactly where an update applies."
        copy="Tellann spans multiple technical surfaces, so every release note states its scope."
      >
        <div className="dev-framework-grid" data-aos="tellann-panel" data-aos-delay="120">
          {platforms.map(([glyph, label]) => (
            <article key={label}>
              <span>{glyph}</span>
              <b>{label}</b>
            </article>
          ))}
        </div>
        <p className="dev-outcome" data-aos="fade-up" data-aos-delay="160">
          The most important distinction is between the browser dashboard
          and the desktop demonstration environment. Guided runs happen in
          the desktop agent, using a local workspace and a managed browser —
          the web dashboard presents evidence and reports and can hand off
          to the agent, but doesn&rsquo;t execute runs independently.
        </p>
      </Section>

      {/* Product evolution */}
      <Section
        id="evolution"
        eyebrow="Product evolution"
        title="How Tellann is evolving."
        copy="A short retrospective connects released updates to the product's larger direction."
      >
        <div className="changelog-phase-card" data-aos="tellann-panel" data-aos-delay="120">
          <span className="changelog-tag">Phase 1 · Active</span>
          <b>Behavioral QA and declared-intent reconciliation.</b>
          <p>
            Declare expected behavior, demonstrate real workflows, and
            compare declared intent against observed evidence. Later phases
            will appear here as milestones only once they have actually
            shipped.
          </p>
        </div>
        <Link className="dev-text-link" href="/roadmap">
          Curious about what comes next? View the roadmap <span>→</span>
        </Link>
      </Section>

      {/* Subscribe */}
      <section className="dev-section changelog-subscribe" id="subscribe">
        <div className="dev-shell-narrow">
          <p className="dev-kicker" data-aos="fade-up">
            Stay informed
          </p>
          <h2 data-aos="fade-up" data-aos-delay="60">
            Stay informed when Tellann changes.
          </h2>
          <p data-aos="fade-up" data-aos-delay="100">
            Receive important feature releases, improvements, compatibility
            updates, and relevant security announcements.
          </p>
          <div data-aos="fade-up" data-aos-delay="140">
            <ChangelogSubscribeForm />
          </div>
        </div>
      </section>

      {/* Related resources */}
      <Section id="resources" eyebrow="Continue exploring" title="Go deeper when an update matters to you.">
        <div className="changelog-related-grid" data-aos="tellann-panel" data-aos-delay="120">
          {relatedResources.map(([title, copy, href]) => (
            <Link key={href} href={href}>
              <b>{title}</b>
              <span>{copy}</span>
              <i>Explore →</i>
            </Link>
          ))}
        </div>
      </Section>

      {/* Final CTA */}
      <section className="dev-final">
        <div className="dev-shell">
          <p className="dev-kicker" data-aos="fade-up">
            Discover what Tellann can help you understand
          </p>
          <h2 data-aos="fade-up" data-aos-delay="60">
            Discover what Tellann can help you understand.
          </h2>
          <p data-aos="fade-up" data-aos-delay="120">
            Explore the platform&rsquo;s approach to declared workflows,
            guided demonstrations, observed behavior, reconciliation, and QA
            reporting.
          </p>
          <div className="dev-actions" data-aos="fade-up" data-aos-delay="180">
            <a className="dev-button dev-button-solid" href={appUrl}>
              Start free <span>↗</span>
            </a>
            <Link className="dev-button" href="/product">
              Explore Tellann <span>→</span>
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
