import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { ProductPlaceholder } from "@/components/product-tour";
import { CaseStudyExplorer } from "@/components/case-study-explorer";
import { CaseWalkthroughStepper } from "@/components/case-walkthrough-stepper";
import "../solutions/developers/developers.css";
import "./case-studies.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://domain-name.com";
const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.domain-name.com";

export const metadata: Metadata = {
  title: "Case Studies & Software QA Examples",
  description:
    "Explore practical software QA scenarios and verified customer stories showing how teams investigate workflows, compare expected and observed behavior, and review testing evidence.",
  alternates: { canonical: "/case-studies" },
  openGraph: {
    title: "Case Studies & Software QA Examples | Tellann",
    description:
      "See how declared workflows and observed behavior expose gaps worth testing — through genuine customer stories and clearly labeled illustrative scenarios.",
    url: `${siteUrl}/case-studies`,
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
  ["#evidence-standard", "Evidence standard"],
  ["#featured", "Featured"],
  ["#stories", "Stories"],
  ["#workflow", "Workflow"],
  ["#challenges", "Challenges"],
  ["#process", "Process"],
  ["#results", "Results"],
  ["#by-team", "By team"],
  ["#how-to-read", "How to read"],
];

type Classification = { label: string; copy: string };

const classifications: Classification[] = [
  {
    label: "Verified customer story",
    copy: "A real customer-approved account of using Tellann, with documented evidence, attributable outcomes, and publication consent.",
  },
  {
    label: "Documented pilot or internal study",
    copy: "A clearly identified evaluation with a defined environment, repeatable workflow, and disclosed limitations.",
  },
  {
    label: "Illustrative scenario",
    copy: "A fictional, synthetic application example created to explain how Tellann's capabilities could be used. Not a customer success claim.",
  },
];

const challenges: { title: string; copy: string; href: string }[] = [
  {
    title: "Passing tests but missing workflows",
    copy: "Distinguishing test execution from demonstrated behavior.",
    href: "/product/behavior-graphs",
  },
  {
    title: "Incomplete onboarding",
    copy: "Comparing expected steps with a captured journey.",
    href: "/product/flow-declaration",
  },
  {
    title: "Unclear release-readiness evidence",
    copy: "Reviewing unverified workflow states and report context.",
    href: "/product/qa-reports",
  },
  {
    title: "Difficult-to-follow user journeys",
    copy: "Connecting interactions with state transitions.",
    href: "/product/session-replay",
  },
  {
    title: "Unexpected endpoint behavior",
    copy: "Examining supported endpoint observations in workflow context.",
    href: "/product/endpoint-intelligence",
  },
  {
    title: "Small team, limited testing time",
    copy: "Prioritizing critical user journeys for validation.",
    href: "/product/guided-qa-runs",
  },
];

const processSteps: [string, string][] = [
  ["Declare intent", "Specify the behavior a workflow is expected to support."],
  ["Bind the workspace", "Connect the relevant development workspace through Tellann Desktop."],
  ["Review instrumentation", "Explicitly review proposed instrumentation rather than allowing silent changes."],
  ["Demonstrate behavior", "Execute the application journey in a managed browser environment."],
  ["Reconcile evidence", "Compare observed states and transitions with what was declared."],
  ["Review the QA report", "Understand demonstrated behavior, gaps, and areas needing further testing."],
];

const teamStories: { title: string; copy: string; story: string; href: string }[] = [
  {
    title: "For developers",
    copy: "Follow execution evidence, inspect unexpected transitions, and determine what needs debugging or reproduction.",
    story: "Suggested story: Investigating an incomplete checkout journey.",
    href: "/case-studies/checkout-workflow-validation-example",
  },
  {
    title: "For QA engineers",
    copy: "Compare expected scenarios against demonstrations to identify missing evidence and refine validation plans.",
    story: "Suggested story: Examining alternate onboarding paths.",
    href: "/case-studies/onboarding-journey-validation-example",
  },
  {
    title: "For engineering managers",
    copy: "Learn what a workflow report can establish, how to communicate limitations, and how to prioritize remaining risk.",
    story: "Suggested story: Reviewing evidence before a release decision.",
    href: "/case-studies/payment-transfer-workflow-example",
  },
  {
    title: "For product teams",
    copy: "Explore the distance between written acceptance criteria and demonstrated experience.",
    story: "Suggested story: Assessing an assessment-submission workflow.",
    href: "/case-studies/assessment-submission-workflow-example",
  },
];

const howToRead: string[] = [
  "What application and workflow were examined?",
  "What behavior was expected?",
  "Which features of Tellann were actually used?",
  "What execution evidence was available?",
  "What did reconciliation identify?",
  "What follow-up investigation occurred?",
  "What conclusion is supported?",
  "What remains unknown?",
];

const relatedResources: { title: string; copy: string; href: string }[] = [
  { title: "Product Overview", copy: "Understand Tellann's workflow and capabilities.", href: "/product" },
  { title: "Research", copy: "Explore the methods behind behavioral evidence.", href: "/research" },
  { title: "Guides", copy: "Learn techniques for improving software validation.", href: "/resources#guides" },
];

export default function CaseStudiesPage() {
  const structuredData = [
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: "Tellann Case Studies",
      description: metadata.description,
      url: `${siteUrl}/case-studies`,
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
        { "@type": "ListItem", position: 2, name: "Resources", item: `${siteUrl}/resources` },
        { "@type": "ListItem", position: 3, name: "Case Studies", item: `${siteUrl}/case-studies` },
      ],
    },
  ];

  return (
    <main className="dev-page cs-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      {/* Hero */}
      <section className="dev-hero">
        <div className="dev-shell dev-hero-copy">
          <p className="dev-kicker" data-aos="fade-up">
            Tellann in practice
          </p>
          <h1 data-aos="fade-up" data-aos-delay="60">
            See the thinking behind better software decisions.
          </h1>
          <p data-aos="fade-up" data-aos-delay="120">
            Explore real-world workflow challenges, practical demonstrations, and —
            where available — verified stories of how teams use Tellann to
            understand application behavior.
          </p>
          <div className="dev-capability-strip" data-aos="fade-up" data-aos-delay="150">
            {["Workflow validation", "QA evidence", "Behavioral insights"].map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
          <div className="dev-actions" data-aos="fade-up" data-aos-delay="180">
            <a className="dev-button dev-button-solid" href="#stories">
              Explore the stories <span>↓</span>
            </a>
            <Link className="dev-button" href="/product/how-it-works">
              See how Tellann works <span>→</span>
            </Link>
          </div>
        </div>
        <div className="dev-shell dev-hero-media">
          <ProductPlaceholder
            label="Expected journey, captured demonstration and reviewable evidence — checkout workflow example"
            dimensions="1600 × 1100"
            displayDimensions="1180 × 560"
          />
          <p>
            Desktop 1180 × 560 px · Tablet 100% width, max 460 px height · Mobile
            100% width, 260–320 px collapses to a vertical sequence · Expected →
            Observed → Evidence fades in once over ~3–4s, then static · Respects
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

      {/* Evidence standard */}
      <Section
        id="evidence-standard"
        surface
        eyebrow="Understand the evidence"
        title="Know what each story actually demonstrates."
        copy="Every story on this page carries one of three labels. They are neutral descriptions, not a ranking — treat them as equally honest, not equally strong evidence."
      >
        <div className="dev-shell cs-classification-grid" data-aos="tellann-panel" data-aos-delay="120">
          {classifications.map((item) => (
            <article key={item.label}>
              <b>{item.label}</b>
              <p>{item.copy}</p>
            </article>
          ))}
        </div>
        <p className="dev-shell cs-notice" data-aos="fade-up" data-aos-delay="160">
          Every story currently published on this page is labeled <b>Illustrative scenario</b>.
          Tellann has not yet published a verified customer story or a documented pilot.
        </p>
      </Section>

      {/* Featured case study */}
      <section className="dev-section" id="featured">
        <div className="dev-shell dev-split">
          <div className="dev-split-visual" data-aos="tellann-panel" data-aos-delay="120">
            <ProductPlaceholder
              label="Declared checkout journey vs. captured demonstration — illustrative scenario"
              dimensions="1600 × 900"
              displayDimensions="620 × 350"
            />
          </div>
          <div className="dev-split-copy">
            <p className="dev-kicker" data-aos="fade-up">
              Illustrative scenario · E-commerce
            </p>
            <h2 data-aos="fade-up" data-aos-delay="60">
              What happens when a checkout demonstration ends before payment?
            </h2>
            <p data-aos="fade-up" data-aos-delay="120">
              Follow a hypothetical e-commerce team as they define an expected
              checkout journey, inspect the demonstrated behavior, and identify
              what still needs validation.
            </p>
            <p className="cs-audience-line" data-aos="fade-up" data-aos-delay="150">
              Developers · QA engineers · Product teams
            </p>
            <Link
              className="dev-inline-link"
              href="/case-studies/checkout-workflow-validation-example"
              data-aos="fade-up"
              data-aos-delay="180"
            >
              Explore the example <span>→</span>
            </Link>
          </div>
        </div>
        <p className="dev-shell dev-media-note">
          Whole section ~1200 × 500 px · Visual master 1600 × 900 px (16:9) ·
          Displayed ~620 × 350 px · Illustrative scenario, not a published
          customer story
        </p>
      </section>

      {/* Browse + grid */}
      <Section
        id="stories"
        surface
        eyebrow="Explore challenges relevant to your team"
        title="Different workflows. Different questions. One need for clearer evidence."
        copy="Browse by audience. Every story below is a clearly labeled illustrative scenario."
      >
        <div className="dev-shell">
          <CaseStudyExplorer />
        </div>
      </Section>

      {/* Interactive workflow example */}
      <Section
        id="workflow"
        eyebrow="See how a workflow becomes evidence"
        title="See how a workflow becomes evidence."
        copy="Explore a simplified checkout journey and learn how Tellann connects expected behavior, demonstrated execution and the questions that remain."
      >
        <p className="dev-shell cs-tag-line" data-aos="fade-up" data-aos-delay="100">
          Example workflow · Synthetic data · Illustrative
        </p>
        <div className="dev-shell" data-aos="tellann-panel" data-aos-delay="140">
          <CaseWalkthroughStepper />
        </div>
      </Section>

      {/* Challenges Tellann helps investigate */}
      <Section
        id="challenges"
        surface
        eyebrow="Common software challenges"
        title="Common software challenges, explained through real workflows."
      >
        <div className="dev-shell cs-challenge-grid" data-aos="tellann-panel" data-aos-delay="120">
          {challenges.map((item) => (
            <Link key={item.title} href={item.href}>
              <b>{item.title}</b>
              <span>{item.copy}</span>
            </Link>
          ))}
        </div>
      </Section>

      {/* Tellann process in practice */}
      <Section
        id="process"
        eyebrow="How it works in practice"
        title="From application intent to a clearer picture of quality."
      >
        <div className="dev-shell dev-workflow-flow" data-aos="tellann-panel" data-aos-delay="120">
          {processSteps.map(([name, copy], index) => (
            <div key={name}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <b>{name}</b>
              <p>{copy}</p>
              {index < processSteps.length - 1 ? <i>→</i> : null}
            </div>
          ))}
        </div>
        <Link className="dev-text-link" data-aos="fade-up" href="/product/how-it-works">
          How Tellann works →
        </Link>
      </Section>

      {/* Results and evidence */}
      <Section
        id="results"
        surface
        eyebrow="What the evidence showed"
        title="What the evidence showed."
        copy="For verified studies, this is where genuine outcomes replace illustrative numbers."
      >
        <div className="dev-shell dev-report">
          <div>
            <p className="dev-kicker" data-aos="fade-up">
              Illustrative report output
            </p>
            <h3 className="cs-report-heading" data-aos="fade-up" data-aos-delay="60">
              A clearer account of what was — and wasn&rsquo;t — demonstrated.
            </h3>
            <div className="dev-stat-grid" data-aos="tellann-panel" data-aos-delay="120">
              <span>
                <b>4</b>
                <small>Declared states</small>
              </span>
              <span>
                <b>3</b>
                <small>Observed states</small>
              </span>
              <span>
                <b>1</b>
                <small>Not observed</small>
              </span>
            </div>
            <p className="dev-sample-note">
              Synthetic checkout example only. These are not customer results or
              a claim about Tellann&rsquo;s performance.
            </p>
          </div>
          <div className="dev-report-visual" data-aos="tellann-panel" data-aos-delay="160">
            <ProductPlaceholder
              label="Illustrative QA report excerpt — declared vs. observed checkout states"
              dimensions="1600 × 1000"
              displayDimensions="560 × 350"
            />
          </div>
        </div>
      </Section>

      {/* Stories by team type */}
      <Section
        id="by-team"
        eyebrow="See how the same evidence supports different decisions"
        title="See how the same evidence supports different decisions."
      >
        <div className="dev-shell dev-usecase-grid" data-aos="tellann-panel" data-aos-delay="120">
          {teamStories.map((item) => (
            <article key={item.title}>
              <b>{item.title}</b>
              <p>{item.copy}</p>
              <span>
                <Link href={item.href} className="dev-inline-link">
                  → {item.story}
                </Link>
              </span>
            </article>
          ))}
        </div>
      </Section>

      {/* Video case studies */}
      <section className="dev-section dev-video is-surface" id="video">
        <div className="dev-shell-narrow">
          <p className="dev-kicker" data-aos="fade-up">
            Watch the workflow, not just the outcome
          </p>
          <h2 data-aos="fade-up" data-aos-delay="60">
            Watch the workflow, not just the outcome.
          </h2>
          <div className="dev-video-media" data-aos="tellann-panel" data-aos-delay="120">
            <ProductPlaceholder
              label="Checkout workflow walkthrough — illustrative, synthetic data"
              dimensions="1920 × 1080"
              displayDimensions="720 × 405"
            />
            <p>
              Desktop 720 × 405 px · Mobile full width, 16:9 · Poster 1280 × 720
              px · 3–5 min · Illustrative, synthetic data · Click-to-play, no
              autoplay with sound · Captions and transcript included
            </p>
          </div>
        </div>
      </section>

      {/* How to read a case study */}
      <Section
        id="how-to-read"
        eyebrow="Know what to expect"
        title="Know what each story actually demonstrates."
        copy="A case study describing incomplete observations should not end with a confirmed defect unless that defect was separately confirmed."
      >
        <ol className="dev-shell cs-checklist" data-aos="fade-up" data-aos-delay="120">
          {howToRead.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      </Section>

      {/* Related resources */}
      <Section surface eyebrow="Continue exploring" title="Related resources.">
        <div className="dev-shell dev-related-grid" data-aos="tellann-panel" data-aos-delay="120">
          {relatedResources.map((item) => (
            <Link key={item.href} href={item.href}>
              <b>{item.title}</b>
              <span>{item.copy}</span>
              <i>Explore →</i>
            </Link>
          ))}
        </div>
      </Section>

      {/* Share your story */}
      <section className="dev-section cs-share">
        <div className="dev-shell-narrow">
          <p className="dev-kicker" data-aos="fade-up">
            Have a workflow worth sharing?
          </p>
          <h2 data-aos="fade-up" data-aos-delay="60">
            Have a workflow worth sharing?
          </h2>
          <p data-aos="fade-up" data-aos-delay="120">
            If you&rsquo;re using Tellann to investigate an important application
            workflow, we&rsquo;d be interested in learning about your experience
            and, with your permission, exploring whether it could become a case
            study.
          </p>
          <div className="dev-actions" data-aos="fade-up" data-aos-delay="160">
            <Link className="dev-button dev-button-solid" href="/contact?topic=case-study">
              Contact the Tellann team <span>→</span>
            </Link>
          </div>
          <small>
            Submitting an inquiry does not itself grant Tellann permission to
            publish details or data. Separate publication consent must be
            obtained.
          </small>
        </div>
      </section>

      {/* Final CTA */}
      <section className="dev-final">
        <div className="dev-shell">
          <p className="dev-kicker" data-aos="fade-up">
            Explore your own workflows
          </p>
          <h2 data-aos="fade-up" data-aos-delay="60">
            Your application has a story. Understand what the evidence says.
          </h2>
          <p data-aos="fade-up" data-aos-delay="120">
            Explore how Tellann helps teams declare expected behavior,
            demonstrate application workflows, reconcile observations, and
            review QA evidence.
          </p>
          <div className="dev-actions" data-aos="fade-up" data-aos-delay="180">
            <a className="dev-button dev-button-solid" href={appUrl}>
              Start free <span>↗</span>
            </a>
            <Link className="dev-button" href="/product">
              Explore the product <span>→</span>
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
