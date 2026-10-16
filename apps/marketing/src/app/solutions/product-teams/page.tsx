import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { JourneyBranchToggle } from "@/components/journey-branch-toggle";
import { ProductJourneyCoverage } from "@/components/product-journey-coverage";
import { ProductPlaceholder } from "@/components/product-tour";
import { ProductRoleSelector } from "@/components/product-role-selector";
import { ReconciliationViewToggle } from "@/components/reconciliation-view-toggle";
import "../developers/developers.css";
import "./product-teams.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://domain-name.com";
const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.domain-name.com";

export const metadata: Metadata = {
  title: "User Journey Validation & Product QA for Teams",
  description:
    "Help product teams validate intended user journeys, compare requirements with demonstrated application behavior, discover gaps, and review evidence with Tellann.",
  alternates: { canonical: "/solutions/product-teams" },
  openGraph: {
    title: "User Journey Validation & Product QA for Teams | Tellann",
    description:
      "You define the experience. Tellann helps you see whether the demonstrated application matches it.",
    url: `${siteUrl}/solutions/product-teams`,
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
  copy?: ReactNode;
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

type Visual = { label: string; master: string; display: string };

function Media({ visual, note }: { visual: Visual; note: string }) {
  return (
    <div className="dev-media">
      <ProductPlaceholder
        label={visual.label}
        dimensions={visual.master}
        displayDimensions={visual.display}
      />
      <p>{note}</p>
    </div>
  );
}

const jumpLinks: [string, string][] = [
  ["#expectation-gap", "Expectation gap"],
  ["#how-it-works", "How it works"],
  ["#flow-declaration", "Flow declaration"],
  ["#missing-scenarios", "Missing scenarios"],
  ["#reconciliation", "Reconciliation"],
  ["#acceptance", "Acceptance"],
  ["#coverage", "Coverage"],
  ["#faq", "FAQ"],
];

const expectationGapCards: [string, string][] = [
  [
    "Requirements get lost in translation",
    "What was described in a product specification may not be fully reflected in the demonstrated workflow.",
  ],
  [
    "Important journeys have hidden branches",
    "Success, failure, validation and recovery paths may receive different levels of attention.",
  ],
  [
    "Acceptance discussions lack shared evidence",
    "Product, QA and engineering may describe the same functionality differently.",
  ],
  [
    "Feature completion is difficult to evaluate",
    "A completed ticket does not necessarily mean every intended state or path has been validated.",
  ],
];

const approachSteps: [string, string][] = [
  ["Define", "Describe intended journeys"],
  ["Prepare", "Engineering connects the application"],
  ["Demonstrate", "QA or developers exercise the workflows"],
  ["Observe", "Tellann builds behavior evidence"],
  ["Compare", "Review intention against observation"],
  ["Decide", "Identify what needs more validation"],
];

const responsibilities: [string, string][] = [
  [
    "Product team",
    "Defines intended outcomes, important workflows, alternative paths and expectations.",
  ],
  [
    "Developer",
    "Connects the local application and prepares the technical demonstration environment.",
  ],
  ["QA or developer", "Performs the guided workflow demonstration."],
  [
    "Tellann",
    "Constructs observed behavioral evidence and reconciles it with declared intent.",
  ],
  ["Product team", "Reviews findings and clarifies requirements."],
  ["QA", "Decides which scenarios should be validated next."],
];

const declarationCallouts = [
  "Human-owned expectations",
  "Define before instrumentation",
  "Suggested branches require review",
  "Reusable intent model",
  "Flow history for reconciliation",
];

const scenarioGrid: [string, string][] = [
  [
    "Successful journey",
    "The user completes the expected action and reaches the intended outcome.",
  ],
  [
    "Failure scenario",
    "An operation fails and the application should communicate what happened.",
  ],
  [
    "Recovery scenario",
    "The user retries an unsuccessful operation or follows an alternative path.",
  ],
  [
    "Validation scenario",
    "The user enters incomplete or invalid information and receives appropriate guidance.",
  ],
];

const reconciliationClassifications: [string, string][] = [
  ["Confirmed", "This intended behavior has matching evidence."],
  [
    "True gap",
    "The declared and observed models have a validated reconciliation difference.",
  ],
  ["Undeclared", "The demonstration revealed behavior outside the declared flow."],
];

const undeclaredTrace: [string, string, string][] = [
  ["Step 1", "Search", "User searches for a product"],
  ["Step 2", "Product unavailable", "Not part of the declared flow"],
  ["Step 3", "Return to results", "Undeclared branch observed"],
];

const acceptanceRows: [string, string][] = [
  ["User can review the cart", "Observed"],
  ["User can submit a valid payment", "Observed"],
  ["User receives an error when payment fails", "Not observed"],
  ["User can retry after failure", "Not observed"],
];

const collaborationRoles: [string, string][] = [
  ["Product teams", "Define what the experience should do."],
  ["Developers", "Prepare and demonstrate the implemented application."],
  ["QA engineers", "Review evidence and investigate gaps."],
];

const reportValuePoints: [string, string][] = [
  ["Clearer reviews", "Clearer feature-review discussions."],
  ["Evidence for journeys", "Evidence for intended versus demonstrated journeys."],
  [
    "Easier identification",
    "Easier identification of unresolved acceptance questions.",
  ],
  [
    "Shared reference",
    "A shared reference for further testing or product clarification.",
  ],
];

const useCases: [string, string, string][] = [
  [
    "Launching a new onboarding flow",
    "Define the sign-up and activation journey, then review which intended states were demonstrated.",
    "Clarity about outstanding onboarding validation.",
  ],
  [
    "Improving checkout",
    "Review successful payments alongside failure, cancellation and recovery scenarios.",
    "A clearer picture of checkout behavior.",
  ],
  [
    "Changing authentication",
    "Compare expected login, failure and recovery paths with evidence from a guided run.",
    "More informed feature acceptance.",
  ],
  [
    "Preparing an MVP launch",
    "Identify the critical user journeys that should be exercised before product delivery.",
    "A practical evidence base for launch discussions.",
  ],
];

const videoBeats: [string, string][] = [
  [
    "0–25s",
    "A planned checkout journey is described, then declared with success, failure and retry branches.",
  ],
  [
    "25–52s",
    "A developer connects the application and a QA practitioner completes a guided walkthrough.",
  ],
  [
    "52–80s",
    "Declared and observed graphs appear side by side; the unobserved retry path is highlighted.",
  ],
  [
    "80–110s",
    "The team reviews a reconciliation report and identifies the next validation step.",
  ],
];

const adoptionSteps: [string, string][] = [
  [
    "Choose a critical journey.",
    "Select onboarding, checkout, registration or another important product experience.",
  ],
  [
    "Declare what should happen.",
    "Define intended outcomes and the essential alternative paths.",
  ],
  [
    "Ask the team to demonstrate it.",
    "Developers and QA prepare the application and run the workflow through Tellann Desktop.",
  ],
  [
    "Review the findings.",
    "Compare intended and observed behavior, clarify gaps, and identify the next validation task.",
  ],
];

const relatedLinks: [string, string, string][] = [
  ["Flow Declaration", "Define intended user journeys.", "/product/flow-declaration"],
  ["Reconciliation", "Compare expectations and observed behavior.", "/product/reconciliation"],
  ["Behavior Graphs", "Understand demonstrated paths.", "/product/behavior-graphs"],
  ["Coverage Analysis", "Identify missing validation evidence.", "/product/coverage"],
  ["QA Reports", "Review findings with the team.", "/product/qa-reports"],
  ["Session Replay", "Inspect the recorded interaction sequence.", "/product/session-replay"],
];

const faqs: [string, string][] = [
  [
    "Can a product manager use Tellann without writing code?",
    "Yes. Product managers can declare intended workflows through the dashboard without installing the desktop agent. Application binding, instrumentation and guided demonstrations may require developer or QA involvement.",
  ],
  [
    "Does Tellann automatically understand my product requirements?",
    "Product teams explicitly define intended workflows. Tellann may suggest additional branches, but suggested states and paths require appropriate user acceptance.",
  ],
  [
    "Can Tellann determine whether a feature meets its acceptance criteria?",
    "Tellann can provide behavioral evidence that supports acceptance reviews. It does not replace product judgment or automatically certify that every acceptance criterion has been satisfied.",
  ],
  [
    "Can I see the user journeys my application supports?",
    "Tellann can visualize workflows and transitions captured during guided demonstrations.",
  ],
  [
    "Does Tellann identify missing product journeys?",
    "It can highlight intended workflows and states that lack supporting evidence and report observed behavior outside the declaration.",
  ],
  [
    "Does Tellann analyze live customer funnels?",
    "Continuous production behavioral analytics is outside the Phase 1 MVP. The current focus is guided demonstrations and intent reconciliation.",
  ],
  [
    "Can my product team collaborate with engineering?",
    "Yes, through appropriate declaration, reporting and collaboration workflows, subject to plan entitlements.",
  ],
  [
    "Can I use Tellann for MVP acceptance testing?",
    "Yes. An MVP's critical user journeys are a suitable starting point for declaring expectations and reviewing demonstration evidence.",
  ],
];

export default function ProductTeamsSolutionPage() {
  const structuredData = [
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: "Tellann for Product Teams",
      description: metadata.description,
      url: `${siteUrl}/solutions/product-teams`,
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
        { "@type": "ListItem", position: 2, name: "Solutions", item: `${siteUrl}/solutions` },
        {
          "@type": "ListItem",
          position: 3,
          name: "Product Teams",
          item: `${siteUrl}/solutions/product-teams`,
        },
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
    <main className="dev-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      {/* 02 Hero */}
      <section className="dev-hero">
        <div className="dev-shell dev-hero-copy">
          <p className="dev-kicker" data-aos="fade-up">
            Tellann for product teams
          </p>
          <h1 data-aos="fade-up" data-aos-delay="60">
            Know whether your product behaves the way you intended.
          </h1>
          <p data-aos="fade-up" data-aos-delay="120">
            Define what your application should do. See what your team
            actually demonstrated. Tellann brings intended journeys and
            observed behavior together, helping you discover gaps, validate
            product expectations, and collaborate with engineering using real
            evidence.
          </p>
          <div className="dev-actions" data-aos="fade-up" data-aos-delay="180">
            <a className="dev-button dev-button-solid" href={appUrl}>
              Start with your product journey <span>→</span>
            </a>
            <a className="dev-button" href="#how-it-works">
              See how Tellann works <span>↓</span>
            </a>
          </div>
          <div className="dev-capability-strip" data-aos="fade-up" data-aos-delay="220">
            {["Define journeys", "Validate expectations", "Discover gaps", "Share evidence"].map(
              (item) => (
                <span key={item}>{item}</span>
              ),
            )}
          </div>
        </div>
        <div className="dev-shell dev-hero-media">
          <ProductPlaceholder
            label="Intended vs demonstrated checkout journey — example evidence / interactive React or SVG graph"
            dimensions="1600 × 900"
            displayDimensions="1180 × 580"
          />
          <p>
            Desktop 1180 × 580 px · Tablet 960 × 540 px, fluid · Mobile custom
            stacked design, 720 × 1050 px · Declared journey appears, observed
            journey populates, corresponding states connect, missing retry
            evidence is identified, a reconciliation summary appears · ~3.8s
            build-in, then static · Respects prefers-reduced-motion · A
            missing path is never characterized as a broken feature merely
            because it wasn&rsquo;t observed
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

      {/* 03 The product expectation gap */}
      <Section
        id="expectation-gap"
        surface
        eyebrow="The product expectation gap"
        title="A feature can be delivered without every expectation being demonstrated."
        copy="Requirements describe the intended experience. Design shows how it should look. Implementation turns it into software. But teams still need a reliable way to compare those expectations against how the application behaves."
      >
        <div className="dev-shell dev-pain-grid" data-aos="tellann-panel" data-aos-delay="120">
          {expectationGapCards.map(([title, copy]) => (
            <article key={title}>
              <b>{title}</b>
              <p>{copy}</p>
            </article>
          ))}
        </div>
      </Section>

      {/* 04 How Tellann works for product teams */}
      <Section
        id="how-it-works"
        eyebrow="From product expectations to evidence"
        title="From product expectations to a clearer picture of what was built."
        copy="A product team can declare intended flows in the web dashboard before a desktop agent is ever installed. Engineering still prepares the technical demonstration, and QA or a developer performs the guided walkthrough."
      >
        <div className="dev-shell dev-workflow-flow" data-aos="tellann-panel" data-aos-delay="120">
          {approachSteps.map(([name, copy], index) => (
            <div key={name}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <b>{name}</b>
              <p>{copy}</p>
              {index < approachSteps.length - 1 ? <i>→</i> : null}
            </div>
          ))}
        </div>
        <div className="dev-shell dev-detected-list" data-aos="fade-up" data-aos-delay="160">
          {responsibilities.map(([role, copy], index) => (
            <span key={`${role}-${index}`}>
              <b>{role}</b>
              <small>{copy}</small>
            </span>
          ))}
        </div>
        <Media
          visual={{
            label: "Six-stage product team workflow diagram with selectable step previews / interactive design",
            master: "1600 × 540",
            display: "1200 × 390",
          }}
          note="Master 1600 × 540 px · Displayed 1200 × 390 px · Mobile 720 × 1250 px vertical timeline · Connector progresses through the steps over ~1.5s · Clicking a step expands an explanatory sentence"
        />
        <div className="dev-shell dev-link-row">
          <Link href="/product/flow-declaration" className="dev-inline-link">
            Explore Flow Declaration <span>→</span>
          </Link>
        </div>
      </Section>

      {/* 05 Define your intended user journeys */}
      <Section
        id="flow-declaration"
        eyebrow="Flow declaration"
        title="Give your product expectations a structure everyone can understand."
        copy="Describe the journeys your application is supposed to support—from successful outcomes to validation errors and recovery paths. Tellann turns that declaration into a model that can later be compared with demonstrated behavior."
      >
        <div className="dev-shell-wide" data-aos="tellann-panel" data-aos-delay="120">
          <JourneyBranchToggle />
        </div>
        <p className="dev-shell dev-media-note">
          Main source 1600 × 1000 px · Desktop display 700 × 520 px · Mobile
          display 720 × 1100 px · Text left, diagram right · Success/failure
          branch toggle transitions in 200–300 ms · Section height 700–820 px
        </p>
        <div className="dev-shell dev-capability-strip" data-aos="fade-up" data-aos-delay="160">
          {declarationCallouts.map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
        <div className="dev-shell dev-link-row">
          <Link href="/product/flow-declaration" className="dev-inline-link">
            Explore Flow Declaration <span>→</span>
          </Link>
        </div>
      </Section>

      {/* 06 Discover scenarios that were overlooked */}
      <Section
        id="missing-scenarios"
        surface
        eyebrow="Don't stop at the happy path"
        title="Don't stop at the ideal user journey."
        copy="Most product flows are designed around a successful outcome. But users may enter incomplete information, encounter failed requests, lose connectivity, or need to retry an operation. Tellann helps product teams consider these alternate scenarios and see which ones have supporting demonstration evidence."
      >
        <div className="dev-shell dev-pain-grid" data-aos="tellann-panel" data-aos-delay="120">
          {scenarioGrid.map(([title, copy]) => (
            <article key={title}>
              <b>{title}</b>
              <p>{copy}</p>
            </article>
          ))}
        </div>
        <Media
          visual={{
            label: "Product journey map with alternate paths — example journey tree / interactive design",
            master: "1440 × 900",
            display: "680 × 500",
          }}
          note="Master 1440 × 900 px · Displayed 680 × 500 px · Mobile vertical, 720 × 1100 px · Successful path draws first, alternative paths reveal 200 ms apart · ~3s"
        />
        <p className="dev-shell dev-outcome">
          Tellann can help surface relevant branches and missing evidence, but
          the product team remains responsible for deciding which user
          experiences are intentional and required.
        </p>
        <div className="dev-shell dev-link-row">
          <Link href="/product/missing-flows" className="dev-inline-link">
            Explore Missing Flow Detection <span>→</span>
          </Link>
        </div>
      </Section>

      {/* 07 Intended versus demonstrated behavior */}
      <Section
        id="reconciliation"
        eyebrow="Behavior reconciliation"
        title="See where the demonstrated experience matches your vision—and where it doesn't."
        copy="Tellann compares your declared workflows with captured application behavior, making it easier to identify supported expectations, missing evidence, and unexpected paths."
      >
        <div className="dev-shell dev-inline-grid" data-aos="tellann-panel" data-aos-delay="120">
          {reconciliationClassifications.map(([title, copy]) => (
            <article key={title}>
              <b>{title}</b>
              <p>{copy}</p>
            </article>
          ))}
        </div>
        <div className="dev-shell-wide" data-aos="tellann-panel" data-aos-delay="160">
          <ReconciliationViewToggle />
        </div>
        <p className="dev-shell dev-media-note">
          Source canvas 1600 × 1000 px · Desktop display 720 × 540 px · Tablet
          100% width · Mobile vertically stacked, 720 × 1200 px · A true gap is
          a reconciliation classification, not automatically proof of a
          software bug
        </p>
        <div className="dev-shell dev-link-row">
          <Link href="/product/flow-declaration" className="dev-inline-link">
            Explore Flow Declaration <span>→</span>
          </Link>
          <Link href="/product/reconciliation" className="dev-inline-link">
            Explore Reconciliation <span>→</span>
          </Link>
        </div>
      </Section>

      {/* 08 Unexpected behavior and product discovery */}
      <Section
        surface
        eyebrow="Product discovery"
        title="Sometimes the application shows you a path you never planned."
        copy="Not every difference is a missing feature. Sometimes a demonstration reveals a path that the team didn't explicitly declare — an overlooked requirement, an acceptable alternative, or behavior needing further review."
      >
        <div className="dev-shell dev-trace" data-aos="tellann-panel" data-aos-delay="120">
          {undeclaredTrace.map(([label, line, meta], index, list) => (
            <span key={label}>
              <small>{label}</small>
              <b>{line}</b>
              <i>{meta}</i>
              {index < list.length - 1 ? <em aria-hidden="true">→</em> : null}
            </span>
          ))}
        </div>
        <Media
          visual={{
            label: "Undeclared behavior example — illustrative observed path / design",
            master: "1440 × 820",
            display: "680 × 460",
          }}
          note="Master 1440 × 820 px · Displayed 680 × 460 px · Mobile 720 × 900 px · New branch appears, then a review question reveals · ~2.5s"
        />
        <p className="dev-shell dev-outcome">
          Is this an intended alternative journey that should be declared, or
          does it require a product change? The website emphasizes human
          review and explicit acceptance of changes to declared intent, not
          silently updating product requirements.
        </p>
      </Section>

      {/* 09 Acceptance criteria and product validation */}
      <Section
        id="acceptance"
        eyebrow="Acceptance & validation"
        title="Give feature acceptance more than a completed checklist."
        copy="Acceptance criteria explain what a feature is expected to do. Tellann helps organize the underlying workflows and supplies demonstration evidence that can support a more informed feature review."
      >
        <dl className="dev-shell-narrow dev-report-findings" data-aos="tellann-panel" data-aos-delay="120">
          {acceptanceRows.map(([expectation, status]) => (
            <div key={expectation}>
              <dt>{expectation}</dt>
              <dd>{status}</dd>
            </div>
          ))}
        </dl>
        <p className="dev-shell dev-sample-note">
          These statuses indicate demonstration evidence, not a formal
          automatic pass/fail verdict for every acceptance criterion.
        </p>
        <Media
          visual={{
            label: "Acceptance review panel — intended behaviors and supporting evidence / design",
            master: "1440 × 1000",
            display: "700 × 500",
          }}
          note="Master 1440 × 1000 px · Displayed 700 × 500 px · Mobile 720 × 1100 px · Selecting an acceptance item highlights the supporting observed state or evidence · 200 ms row transition"
        />
        <p className="dev-shell dev-outcome">
          Tellann does not automatically import Jira, Linear, Notion, Figma or
          PRD files as acceptance criteria unless those integrations have
          been delivered.
        </p>
        <div className="dev-shell dev-link-row">
          <Link href="/product/flow-declaration" className="dev-inline-link">
            See How Flow Declaration Works <span>→</span>
          </Link>
        </div>
      </Section>

      {/* 10 Product journey coverage */}
      <Section
        id="coverage"
        surface
        eyebrow="Product journey coverage"
        title="Understand how much of the intended journey has been demonstrated."
        copy="Product teams don't necessarily need detailed code coverage. They need to understand which parts of their intended experience have supporting validation evidence."
      >
        <div className="dev-shell-wide" data-aos="tellann-panel" data-aos-delay="120">
          <ProductJourneyCoverage />
        </div>
        <p className="dev-shell dev-media-note">
          Main canvas 1600 × 960 px · Desktop display 700 × 520 px · Mobile
          720 × 1050 px · Progress bar and row changes animate 250–600 ms ·
          Coverage is derived from the supported evidence model, not a
          marketing-only metric
        </p>
        <div className="dev-shell dev-link-row">
          <Link href="/product/coverage" className="dev-inline-link">
            Explore Coverage Analysis <span>→</span>
          </Link>
        </div>
      </Section>

      {/* 11 Product and engineering collaboration */}
      <Section
        eyebrow="Shared evidence"
        title="Keep product, QA, and engineering aligned around the same experience."
        copy="Tellann creates a common behavioral reference so every role reviews the same evidence rather than a secondhand description of it."
      >
        <div className="dev-shell dev-inline-grid" data-aos="tellann-panel" data-aos-delay="120">
          {collaborationRoles.map(([title, copy]) => (
            <article key={title}>
              <b>{title}</b>
              <p>{copy}</p>
            </article>
          ))}
        </div>
        <Media
          visual={{
            label: "Shared product, QA and engineering flow-reconciliation report / design",
            master: "1600 × 700",
            display: "1100 × 470",
          }}
          note="Master 1600 × 700 px · Desktop display 1100 × 470 px · Mobile 720 × 1150 px, vertically connected · Role cards connect to a central report over ~1.5s"
        />
        <p className="dev-shell dev-outcome">
          Collaboration benefits apply as appropriate for team-enabled plans —
          not every account includes multi-member collaboration.
        </p>
        <div className="dev-shell dev-link-row">
          <Link href="/pricing" className="dev-inline-link">
            Explore Plans for Teams <span>→</span>
          </Link>
        </div>
      </Section>

      {/* 12 Reports for product reviews */}
      <section className="dev-section is-surface">
        <div className="dev-shell dev-heading">
          <p className="dev-kicker" data-aos="fade-up">
            Reports for product reviews
          </p>
          <h2 data-aos="fade-up" data-aos-delay="60">
            Bring evidence into your next product review.
          </h2>
          <p data-aos="fade-up" data-aos-delay="120">
            Instead of relying only on demonstrations, ticket updates, or
            verbal explanations, product teams can review structured findings
            about intended journeys, observed behavior, and outstanding
            validation gaps.
          </p>
        </div>
        <div className="dev-shell dev-report" data-aos="tellann-panel" data-aos-delay="120">
          <div className="dev-report-copy">
            <div className="dev-stat-grid">
              {[
                ["Declared states", "5"],
                ["Observed", "4"],
                ["Requires review", "1"],
              ].map(([label, value]) => (
                <span key={label}>
                  <b>{value}</b>
                  <small>{label}</small>
                </span>
              ))}
            </div>
            <dl className="dev-report-findings">
              {[
                ["Outstanding finding", "Account recovery declared, not observed"],
                [
                  "Suggested team discussion",
                  "New demonstration, or revise the intended journey?",
                ],
              ].map(([finding, status]) => (
                <div key={finding}>
                  <dt>{finding}</dt>
                  <dd>{status}</dd>
                </div>
              ))}
            </dl>
            <p className="dev-sample-note">
              Illustrative report content rather than genuine run results.
              Exportable reports where supported.
            </p>
          </div>
          <div className="dev-report-visual">
            <ProductPlaceholder
              label="Flow reconciliation report — customer onboarding / design"
              dimensions="1440 × 1000"
              displayDimensions="700 × 520"
            />
            <div className="dev-export-card">
              <ProductPlaceholder label="Secondary finding detail overlay" dimensions="800 × 600" displayDimensions="350 × 260" />
            </div>
          </div>
        </div>
        <div className="dev-shell dev-report-roles">
          {reportValuePoints.map(([label, copy]) => (
            <article key={label}>
              <b>{label}</b>
              <p>{copy}</p>
            </article>
          ))}
        </div>
        <div className="dev-shell dev-link-row">
          <Link href="/product/qa-reports" className="dev-inline-link">
            Explore QA Reports <span>→</span>
          </Link>
        </div>
      </section>

      {/* 13 Product team use cases */}
      <Section
        id="use-cases"
        eyebrow="Real product journeys"
        title="Wherever a user journey matters, expectations matter too."
      >
        <div className="dev-shell dev-usecase-grid" data-aos="tellann-panel" data-aos-delay="120">
          {useCases.map(([title, copy, outcome]) => (
            <article key={title}>
              <b>{title}</b>
              <p>{copy}</p>
              <span>{outcome}</span>
            </article>
          ))}
        </div>
      </Section>

      {/* 14 Value by product role */}
      <Section
        surface
        eyebrow="Value by role"
        title="Built for the different people who define product success."
      >
        <div className="dev-shell-wide" data-aos="tellann-panel" data-aos-delay="120">
          <ProductRoleSelector />
        </div>
        <p className="dev-shell dev-media-note">
          Desktop 1100 × 450 px · Mobile natural height · Role selector
          scrolls horizontally on small screens rather than shrinking labels
          to unreadable sizes · 200 ms crossfade
        </p>
      </Section>

      {/* 15 Product team demonstration video */}
      <section className="dev-section dev-video" id="product-video">
        <div className="dev-shell-narrow">
          <p className="dev-kicker" data-aos="fade-up">
            Product team demonstration
          </p>
          <h2 data-aos="fade-up" data-aos-delay="60">
            From product requirements to demonstrated behavior.
          </h2>
          <div className="dev-video-media" data-aos="tellann-panel" data-aos-delay="120">
            <ProductPlaceholder
              label="Product team demonstration video placeholder"
              dimensions="1920 × 1080"
              displayDimensions="960 × 540"
            />
            <p>
              Desktop 960 × 540 px · Mobile full width, 16:9 · Poster 1600 ×
              900 px · 90–110s · MP4 H.264 + WebM, VTT captions,
              click-to-play — no autoplay with sound · A genuine
              flow-declaration and reconciliation interface, not generic
              motion graphics
            </p>
          </div>
          <div className="dev-video-beats" data-aos="fade-up" data-aos-delay="160">
            {videoBeats.map(([time, copy]) => (
              <div key={time}>
                <small>{time}</small>
                <p>{copy}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 16 Adoption workflow */}
      <Section
        surface
        eyebrow="Start small"
        title="Start with one important user journey."
        copy="Product teams can begin with one workflow rather than migrate their entire product process. A product manager does not need to write instrumentation code to create a declared intent graph."
      >
        <div className="dev-shell dev-pain-grid" data-aos="tellann-panel" data-aos-delay="120">
          {adoptionSteps.map(([title, copy]) => (
            <article key={title}>
              <b>{title}</b>
              <p>{copy}</p>
            </article>
          ))}
        </div>
        <div className="dev-shell dev-link-row">
          <Link href="/product" className="dev-inline-link">
            Explore How Tellann Works <span>→</span>
          </Link>
        </div>
      </Section>

      {/* 17 Privacy and responsible data collection */}
      <Section
        eyebrow="Privacy and responsible data collection"
        title="Review product behavior without exposing unnecessary data."
        copy="This matters for product managers handling workflows that involve customer accounts, authentication, payments, or personal information."
      >
        <div className="dev-shell dev-trust-grid" data-aos="tellann-panel" data-aos-delay="120">
          <ProductPlaceholder
            label="Local desktop agent to Tellann analysis services trust-boundary diagram / SVG design"
            dimensions="1600 × 700"
            displayDimensions="1050 × 450"
          />
          <div>
            <article>
              <span>Sensitive-data protection</span>
              <p>Behavioral collection follows masking and data-minimization rules.</p>
            </article>
            <article>
              <span>Local-first source analysis</span>
              <p>Source code stays on the developer's machine by default.</p>
            </article>
            <article>
              <span>Controlled collaboration</span>
              <p>Access to shared evidence follows available account roles and entitlements.</p>
            </article>
          </div>
        </div>
        <Link className="dev-text-link" data-aos="fade-up" href="/desktop/security">
          Explore Desktop Security →
        </Link>
      </Section>

      {/* 18 Related product capabilities */}
      <Section eyebrow="Continue exploring" title="Explore the capabilities behind the workflow.">
        <div className="dev-shell dev-related-grid" data-aos="tellann-panel" data-aos-delay="120">
          {relatedLinks.map(([label, copy, href]) => (
            <Link key={href} href={href}>
              <b>{label}</b>
              <span>{copy}</span>
              <i>Explore →</i>
            </Link>
          ))}
        </div>
      </Section>

      {/* 19 Product Teams FAQ */}
      <section className="dev-section dev-faq" id="faq">
        <div className="dev-shell dev-faq-grid">
          <div>
            <p className="dev-kicker" data-aos="fade-up">
              Product Teams FAQ
            </p>
            <h2 data-aos="fade-up" data-aos-delay="60">
              Questions product teams ask first.
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

      {/* 20 Final conversion CTA */}
      <section className="dev-final">
        <div className="dev-shell">
          <p className="dev-kicker" data-aos="fade-up">
            From product vision to behavioral evidence
          </p>
          <h2 data-aos="fade-up" data-aos-delay="60">
            You know what your product should do. See what it actually
            demonstrates.
          </h2>
          <p data-aos="fade-up" data-aos-delay="120">
            Define your important user journeys, compare them with observed
            behavior, and bring clearer evidence into product decisions.
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
            For team plans, see <Link href="/pricing">Tellann pricing</Link>.
            A 14-day trial, when offered, authorizes a card for automatic
            conversion — never a hidden charge.
          </small>
        </div>
      </section>
    </main>
  );
}
