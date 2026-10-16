import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { docsLinks } from "@/config/site-routes";
import { CoverageFindingsToggle } from "@/components/coverage-findings-toggle";
import { ProductPlaceholder } from "@/components/product-tour";
import "./developers.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://domain-name.com";
const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.domain-name.com";

export const metadata: Metadata = {
  title: "Behavioral QA & Workflow Intelligence for Developers",
  description:
    "Understand how your application behaves with Tellann. Discover workflows, inspect frontend and backend activity, identify missing paths, and generate QA reports from guided demonstrations.",
  alternates: { canonical: "/solutions/developers" },
  openGraph: {
    title: "Behavioral QA & Workflow Intelligence for Developers | Tellann",
    description:
      "Demonstrate workflows. Discover behavior. Find the gaps — without rewriting your application.",
    url: `${siteUrl}/solutions/developers`,
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
  ["#pain-points", "Pain points"],
  ["#workflow", "Workflow"],
  ["#workspace", "Workspace"],
  ["#behavior-graph", "Behavior graphs"],
  ["#missing-paths", "Missing paths"],
  ["#reconciliation", "Reconciliation"],
  ["#reports", "Reports"],
  ["#faq", "FAQ"],
];

const painPoints: [string, string][] = [
  [
    "Scattered workflow logic",
    "A single user journey can cross components, routes and backend services.",
  ],
  [
    "Unexplored edge cases",
    "Loading, empty, failed and recovery states can escape routine testing.",
  ],
  [
    "Hard-to-reconstruct behavior",
    "Investigating a defect often starts with incomplete steps and missing context.",
  ],
  [
    "Fragmented QA evidence",
    "Logs, screenshots, test results and product requirements rarely tell one coherent story.",
  ],
];

const workflowSteps: [string, string][] = [
  ["Declare", "Define intended workflows"],
  ["Bind", "Connect a local project"],
  ["Instrument", "Review the proposed changes"],
  ["Demonstrate", "Walk through the application"],
  ["Reconcile", "Compare intent and evidence"],
  ["Report", "Inspect coverage and gaps"],
];

const workspaceItems: [string, string][] = [
  ["Workspace", "Project and branch context"],
  ["Intent", "Declared workflow checkpoints"],
  ["Instrumentation proposal", "Reviewable diff, not a silent edit"],
  ["Review diff", "Inspect before anything is applied"],
  ["Approve", "You decide what gets added"],
  ["Rollback", "Reversible if something's wrong"],
];

const frameworks: [string, string][] = [
  ["JS", "JavaScript"],
  ["TS", "TypeScript"],
  ["⚛", "React"],
  ["N", "Next.js"],
  ["⬡", "Node.js"],
  ["Ex", "Express"],
  ["Ns", "NestJS"],
  ["F", "Fastify"],
];

const useCases: [string, string, string][] = [
  [
    "Before shipping a feature",
    "Demonstrate the new workflow and examine what the run covered — and what still needs checking.",
    "A clearer picture of feature coverage.",
  ],
  [
    "When reviewing a complex workflow",
    "Visualize the states and transitions recorded during a real demonstration.",
    "Less guesswork when discussing behavior.",
  ],
  [
    "When investigating a failed path",
    "Inspect the replay timeline and endpoint evidence associated with the demonstrated scenario.",
    "More context for debugging.",
  ],
  [
    "When delivering client software",
    "Generate a structured QA report to document observed behavior and outstanding gaps.",
    "Shareable evidence of validation work.",
  ],
];

const relatedLinks: [string, string, string][] = [
  ["Developer Demonstration", "Teach Tellann how the software behaves.", "/product/demonstration-mode"],
  ["Behavior Graphs", "See application workflows as connected states.", "/product/behavior-graphs"],
  ["Coverage Analysis", "Understand what has and hasn't been demonstrated.", "/product/coverage"],
  ["Session Replay", "Reconstruct what occurred during a run.", "/product/session-replay"],
  ["Endpoint Intelligence", "Understand APIs involved in workflows.", "/product/endpoint-intelligence"],
  ["Reconciliation", "Compare intended behavior with observed behavior.", "/product/reconciliation"],
];

const videoBeats: [string, string][] = [
  ["0–28s", "Tellann Desktop connects a repository and the checkout flow is declared."],
  ["28–60s", "A proposed instrumentation diff is reviewed and approved."],
  ["60–92s", "A checkout walkthrough is demonstrated and the behavior graph builds."],
  ["92–120s", "A retry-payment path appears as not observed, then the QA report."],
];

const faqs: [string, string][] = [
  [
    "Do I need to rewrite my application to use Tellann?",
    "No wholesale rewrite is intended. The desktop agent works with a bound local workspace and supports instrumentation planning. Depending on the plan and application, developers may review assisted instrumentation or add instrumentation manually.",
  ],
  [
    "Does Tellann automatically write all my tests?",
    "No. The Phase 1 product focuses on guided demonstrations, behavioral modeling, coverage analysis and reconciliation, rather than autonomous test generation.",
  ],
  [
    "Can I use Tellann with React and Next.js?",
    "Those are among the documented frontend integration targets. Confirm the availability of specific SDK versions in the documentation.",
  ],
  [
    "Does Tellann inspect backend endpoints?",
    "Yes, when the applicable backend instrumentation is configured and the relevant evidence is captured during the run.",
  ],
  [
    "Can I run demonstrations without production traffic?",
    "Yes. This is a central purpose of Developer Demonstration Mode.",
  ],
  [
    "What happens if Tellann cannot observe an expected workflow?",
    "It can identify an evidence gap relative to declared intent. Further investigation may determine whether the path is untested, unavailable or incorrectly implemented.",
  ],
  [
    "Does Tellann send my source code to the cloud?",
    "Source files remain local by default. The product may transmit derived projections and captured behavioral evidence, with separate consent for raw-source uploads.",
  ],
  [
    "Is Tellann free for individual developers?",
    "The pricing specifications define a Free plan and paid options. See Tellann pricing for current entitlements and limits.",
  ],
];

export default function DevelopersSolutionPage() {
  const structuredData = [
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: "Tellann for Developers",
      description: metadata.description,
      url: `${siteUrl}/solutions/developers`,
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
          name: "Developers",
          item: `${siteUrl}/solutions/developers`,
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
            Tellann for developers
          </p>
          <h1 data-aos="fade-up" data-aos-delay="60">
            Understand what your application actually does.
          </h1>
          <p data-aos="fade-up" data-aos-delay="120">
            Your code describes how an application is built. Tellann helps
            you see how it behaves. Demonstrate real workflows, discover
            application states, inspect API activity, and uncover quality
            gaps before they go unnoticed.
          </p>
          <div className="dev-actions" data-aos="fade-up" data-aos-delay="180">
            <a className="dev-button dev-button-solid" href={appUrl}>
              Start building with Tellann <span>→</span>
            </a>
            <a className="dev-button" href="#developer-video">
              Watch a demonstration <span>↓</span>
            </a>
          </div>
          <div className="dev-capability-strip" data-aos="fade-up" data-aos-delay="220">
            {["Guided QA runs", "Workflow discovery", "Missing paths", "Evidence-backed reports"].map(
              (item) => (
                <span key={item}>{item}</span>
              ),
            )}
          </div>
        </div>
        <div className="dev-shell dev-hero-media">
          <ProductPlaceholder
            label="Checkout workflow — example run / interactive React or SVG behavior graph"
            dimensions="1600 × 800"
            displayDimensions="1180 × 560"
          />
          <p>
            Desktop 1180 × 560 px (~2:1) · Tablet 100% width, max 520 px
            height · Mobile 100% width, ~350–450 px height · Workspace
            appears, states connect, an intended retry path appears dashed
            and is labeled &ldquo;not observed,&rdquo; then a finding card
            fades in · 4s build-in, then static · Respects
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

      {/* 03 Pain points */}
      <Section
        id="pain-points"
        surface
        eyebrow="Developer pain points"
        title="You can read the code. But can you see every path it takes?"
        copy="Modern applications span components, routes, APIs and states. Understanding one function is easy. Understanding the complete behavior of an application is harder."
      >
        <div className="dev-shell dev-pain-grid" data-aos="tellann-panel" data-aos-delay="120">
          {painPoints.map(([title, copy]) => (
            <article key={title}>
              <b>{title}</b>
              <p>{copy}</p>
            </article>
          ))}
        </div>
      </Section>

      {/* 04 How Tellann works for developers */}
      <Section
        id="workflow"
        eyebrow="How Tellann works for developers"
        title="From your local project to an evidence-backed QA report."
        copy="Tellann is not a website-only recording tool. The desktop agent handles the local workspace and guided browser demonstration."
      >
        <div className="dev-shell dev-workflow-flow" data-aos="tellann-panel" data-aos-delay="120">
          {workflowSteps.map(([name, copy], index) => (
            <div key={name}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <b>{name}</b>
              <p>{copy}</p>
              {index < workflowSteps.length - 1 ? <i>→</i> : null}
            </div>
          ))}
        </div>
        <Media
          visual={{
            label: "Six-step workflow timeline with selectable step previews / interactive design",
            master: "1200 × 300",
            display: "1200 × 300",
          }}
          note="Canvas 1200 × 300 px · Node width ~170 px · Gap 24 px · Thin monochrome connectors · 1.5s animation on first viewport entry · Vertical six-step timeline on mobile"
        />
      </Section>

      {/* 05 Local workspace & desktop agent */}
      <section className="dev-section is-surface" id="workspace">
        <div className="dev-shell dev-split">
          <div className="dev-split-copy">
            <p className="dev-kicker" data-aos="fade-up">
              Local-first development
            </p>
            <h2 data-aos="fade-up" data-aos-delay="60">
              Work with your real codebase. Keep control of your working
              tree.
            </h2>
            <p data-aos="fade-up" data-aos-delay="120">
              Tellann Desktop connects to your project, helps locate workflow
              checkpoints, and supports controlled instrumentation. Proposed
              source changes are reviewable and reversible.
            </p>
            <div className="dev-detected-list" data-aos="fade-up" data-aos-delay="160">
              {workspaceItems.map(([label, copy]) => (
                <span key={label}>
                  <b>{label}</b>
                  <small>{copy}</small>
                </span>
              ))}
            </div>
            <Link className="dev-inline-link" href="/desktop" data-aos="fade-up" data-aos-delay="200">
              Explore Tellann Desktop <span>→</span>
            </Link>
          </div>
          <div className="dev-split-visual dev-workspace-visual" data-aos="tellann-panel" data-aos-delay="120">
            <ProductPlaceholder
              label="Tellann Desktop workspace with an instrumentation proposal / product UI design"
              dimensions="1440 × 900"
              displayDimensions="680 × 500"
            />
            <div className="dev-diff-panel">
              <ProductPlaceholder
                label="Instrumentation diff panel / overlay UI design"
                dimensions="560 × 300"
                displayDimensions="300 × 161"
              />
            </div>
          </div>
        </div>
        <p className="dev-shell dev-media-note">
          Primary mockup 1440 × 900 px · Displayed 680 × 500 px · Diff panel
          560 × 300 px, floating over the lower-left edge · Mobile screenshot
          crop 720 × 900 px · Section height 680–780 px desktop · Starts with
          workspace selection, reveals code analysis, shows a proposed
          instrumentation diff — never a silent source change
        </p>
      </section>

      {/* 06 Behavior graph & workflow discovery */}
      <section className="dev-section" id="behavior-graph">
        <div className="dev-shell dev-split">
          <div className="dev-split-copy">
            <p className="dev-kicker" data-aos="fade-up">
              Behavioral graphs
            </p>
            <h2 data-aos="fade-up" data-aos-delay="60">
              Stop imagining the workflow. See the path your application
              took.
            </h2>
            <p data-aos="fade-up" data-aos-delay="120">
              Tellann transforms recorded interactions into states, actions,
              transitions and workflows, creating a visual model of
              application behavior.
            </p>
            <p className="dev-outcome" data-aos="fade-up" data-aos-delay="160">
              A developer should be able to see how a checkout workflow moves
              through the application and where alternate states branch
              away.
            </p>
            <Link
              className="dev-inline-link"
              href="/product/behavior-graphs"
              data-aos="fade-up"
              data-aos-delay="200"
            >
              Explore Behavior Graphs <span>→</span>
            </Link>
          </div>
          <div className="dev-split-visual" data-aos="tellann-panel" data-aos-delay="120">
            <ProductPlaceholder
              label="Checkout behavior graph — illustrative data / SVG or React Flow design"
              dimensions="1400 × 720"
              displayDimensions="680 × 480"
            />
          </div>
        </div>
        <p className="dev-shell dev-media-note">
          Canvas 1400 × 720 px · Displayed 680 × 480 px, full-width on smaller
          tablets · Initial state appears, observed transitions draw left to
          right, alternative branches appear, unobserved intended branches
          display dashed, a finding panel identifies the evidence gap
        </p>
      </section>

      {/* 07 Find missing states and workflows */}
      <Section
        id="missing-paths"
        surface
        eyebrow="Uncover the untested"
        title="The bugs you haven't encountered deserve attention too."
        copy="Happy-path demonstrations tell only part of the story. Tellann helps identify expected application states and workflow paths that have not yet been observed."
      >
        <div className="dev-shell-wide" data-aos="tellann-panel" data-aos-delay="120">
          <CoverageFindingsToggle />
        </div>
        <p className="dev-shell dev-media-note">
          Primary mockup 1440 × 900 px · Desktop rendered 700 × 500 px ·
          Mobile visual 720 × 960 px · 600–900 ms transition per step ·
          Observed, Not observed, Potential missing state and Undeclared are
          distinguished — an unobserved path is never presented as a
          confirmed defect
        </p>
      </Section>

      {/* 08 Frontend and backend intelligence */}
      <Section
        eyebrow="Frontend and backend intelligence"
        title="Understand both sides of the interaction."
        copy="A developer sees a user click a button. But the button may initiate an API request, trigger a database-backed operation, return a response, and update the UI. Tellann helps correlate the frontend and backend evidence captured during a demonstration."
      >
        <div className="dev-shell dev-trace" data-aos="tellann-panel" data-aos-delay="120">
          {[
            ["Frontend", "User selects Checkout", "UI event · BUTTON_CLICK"],
            ["Backend", "POST /api/checkout", "240 ms · HTTP 200 · Request completed"],
            ["Result", "Checkout state updated", "Observed transition · CHECKOUT → ORDER_COMPLETE"],
          ].map(([label, line, meta], index, list) => (
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
            label: "One action, connected evidence — example trace / interactive design",
            master: "1400 × 900",
            display: "680 × 520",
          }}
          note="Master 1400 × 900 px · Display 680 × 520 px · Mobile stacked flow diagram, min 320 px wide · Button click, request transmission, response, UI state update · 3–4 seconds, then static and readable without playback"
        />
        <div className="dev-shell dev-inline-grid">
          {[
            ["Connect user actions to API activity.", "Understand which requests were associated with a demonstrated workflow."],
            ["Inspect response behavior.", "Review captured response times, error outcomes and endpoint evidence."],
            ["Investigate with context.", "Move from an application interaction to the supporting recorded technical activity."],
          ].map(([title, copy]) => (
            <article key={title}>
              <b>{title}</b>
              <p>{copy}</p>
            </article>
          ))}
        </div>
        <div className="dev-shell dev-link-row">
          <Link href="/product/endpoint-intelligence" className="dev-inline-link">
            Explore Endpoint Intelligence <span>→</span>
          </Link>
        </div>
      </Section>

      {/* 09 Session replay and investigation */}
      <section className="dev-section is-surface" id="session-replay">
        <div className="dev-shell dev-split">
          <div className="dev-split-copy">
            <p className="dev-kicker" data-aos="fade-up">
              Session replay & debugging
            </p>
            <h2 data-aos="fade-up" data-aos-delay="60">
              Stop relying on incomplete descriptions of what happened.
            </h2>
            <p data-aos="fade-up" data-aos-delay="120">
              Reconstruct the sequence of recorded interactions, inspect
              transitions and associated events, and understand the context
              around a demonstrated workflow. Session replay is a behavioral
              reconstruction from captured events, not necessarily a literal
              video recording of the screen.
            </p>
            <Link
              className="dev-inline-link"
              href="/product/session-replay"
              data-aos="fade-up"
              data-aos-delay="160"
            >
              Explore Session Replay <span>→</span>
            </Link>
          </div>
          <div className="dev-split-visual" data-aos="tellann-panel" data-aos-delay="120">
            <ProductPlaceholder
              label="Session replay — checkout demonstration / event timeline and application view"
              dimensions="1600 × 1000"
              displayDimensions="700 × 480"
            />
            <div className="dev-replay-events">
              {["00:01 Page view", "00:03 Click", "00:04 API call", "00:05 Response"].map((event) => (
                <span key={event}>{event}</span>
              ))}
            </div>
            <div className="dev-replay-scrubber" aria-hidden="true">
              <i style={{ width: "23%" }} />
            </div>
            <small className="dev-replay-time">00:05 / 00:22</small>
          </div>
        </div>
        <p className="dev-shell dev-media-note">
          Source screenshot 1600 × 1000 px · Desktop rendering 700 × 480 px ·
          Mobile simplified view 720 × 1050 px · Optional replay clip 1920 ×
          1080 px, 8–12s loop with pause/play · Fidelity is never overstated
          beyond what is actually reconstructed
        </p>
      </section>

      {/* 10 Flow declaration and reconciliation */}
      <Section
        id="reconciliation"
        eyebrow="Flow declaration & reconciliation"
        title="Your application should do one thing. Does the evidence agree?"
        copy="Declare expected workflows, demonstrate your application, and compare what was intended against what was actually observed."
      >
        <div className="dev-shell dev-compare" data-aos="tellann-panel" data-aos-delay="120">
          <article>
            <span>Declared intent</span>
            <ul>
              {["Checkout", "Payment success", "Payment failure", "Retry payment"].map((item) => (
                <li key={item}>
                  <i aria-hidden="true">·</i>
                  {item}
                </li>
              ))}
            </ul>
          </article>
          <b aria-hidden="true">vs</b>
          <article>
            <span>Observed</span>
            <ul>
              {[
                ["✓", "Checkout"],
                ["✓", "Payment success"],
                ["✓", "Payment failure"],
                ["?", "Retry not observed"],
              ].map(([glyph, item]) => (
                <li key={item} className={glyph === "?" ? "is-open" : ""}>
                  <i aria-hidden="true">{glyph}</i>
                  {item}
                </li>
              ))}
            </ul>
          </article>
        </div>
        <Media
          visual={{
            label: "Declared intent compared against observed behavior / interactive design",
            master: "1600 × 1000",
            display: "720 × 520",
          }}
          note="Master 1600 × 1000 px · Display 720 × 520 px · Mobile stacked graphs, ~720 × 1100 px equivalent · Matching nodes join, mismatches become visible, findings summary enters · 2.5–3.5s · Classifications are Confirmed, True Gap and Undeclared — a true gap is only shown when the reconciliation rules justify that conclusion"
        />
        <div className="dev-shell dev-link-row">
          <Link href="/product/flow-declaration" className="dev-inline-link">
            Explore Flow Declaration <span>→</span>
          </Link>
          <Link href="/product/reconciliation" className="dev-inline-link">
            Explore Reconciliation <span>→</span>
          </Link>
        </div>
      </Section>

      {/* 11 Developer QA reports */}
      <section className="dev-section is-surface" id="reports">
        <div className="dev-shell dev-heading">
          <p className="dev-kicker" data-aos="fade-up">
            Developer QA reports
          </p>
          <h2 data-aos="fade-up" data-aos-delay="60">
            Turn a walkthrough into evidence you can share.
          </h2>
          <p data-aos="fade-up" data-aos-delay="120">
            Tellann transforms a completed demonstration into structured
            reporting that helps you understand the observed behavior,
            coverage gaps and findings worth investigating.
          </p>
        </div>
        <div className="dev-shell dev-report" data-aos="tellann-panel" data-aos-delay="120">
          <div className="dev-report-copy">
            <div className="dev-stat-grid">
              {[
                ["Coverage", "76%"],
                ["Workflows", "14"],
                ["Unobserved paths", "3"],
              ].map(([label, value]) => (
                <span key={label}>
                  <b>{value}</b>
                  <small>{label}</small>
                </span>
              ))}
            </div>
            <dl className="dev-report-findings">
              {[
                ["Checkout retry", "Not observed"],
                ["Empty cart state", "Requires verification"],
                ["Payment API", "Response time finding"],
              ].map(([finding, status]) => (
                <div key={finding}>
                  <dt>{finding}</dt>
                  <dd>{status}</dd>
                </div>
              ))}
            </dl>
            <p className="dev-sample-note">
              All figures are illustrative rather than actual Tellann
              measurements. No fake composite application quality score.
            </p>
          </div>
          <div className="dev-report-visual">
            <ProductPlaceholder
              label="Commerce application QA run — example report / portrait report UI design"
              dimensions="1440 × 1000"
              displayDimensions="680 × 500"
            />
            <div className="dev-export-card">
              <ProductPlaceholder
                label="Optional floating export card"
                dimensions="320 × 180"
              />
            </div>
          </div>
        </div>
        <div className="dev-shell dev-report-roles">
          {[
            ["Full-stack developers", "Share an end-to-end view of a workflow."],
            ["Freelancers", "Include a QA report as part of project delivery."],
            ["Technical leads", "Review evidence and gaps with the team."],
            ["Indie founders", "Keep a record of demonstrated functionality as the application evolves."],
          ].map(([role, copy]) => (
            <article key={role}>
              <b>{role}</b>
              <p>{copy}</p>
            </article>
          ))}
        </div>
      </section>

      {/* 12 Real developer use cases */}
      <Section
        eyebrow="Where Tellann fits into your workflow"
        title={<>When would I actually use Tellann?</>}
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

      {/* 13 Framework compatibility */}
      <Section
        surface
        eyebrow="Built around what you already use"
        title="Built around the technologies you already use."
      >
        <div className="dev-shell dev-framework-grid" data-aos="tellann-panel" data-aos-delay="120">
          {frameworks.map(([glyph, label]) => (
            <article key={label}>
              <span>{glyph}</span>
              <b>{label}</b>
            </article>
          ))}
        </div>
        <p className="dev-shell dev-media-note">
          Logo container 72 × 72 px · Glyph 48 × 48 px · Eight-column grid on
          desktop, four columns on mobile · Official framework logos should
          replace these typographic placeholders where licensing permits
        </p>
        <Link className="dev-text-link" data-aos="fade-up" href={docsLinks.sdk.href}>
          Explore SDK documentation →
        </Link>
      </Section>

      {/* 14 Source code and privacy */}
      <Section
        eyebrow="Source code and privacy"
        title="Your source code belongs on your machine."
        copy="Tellann's desktop agent analyzes your workspace locally by default. Source code is not transmitted without explicit consent, while behavioral evidence and permitted derived information support the platform's analysis."
      >
        <div className="dev-shell dev-trust-grid" data-aos="tellann-panel" data-aos-delay="120">
          <ProductPlaceholder
            label="Local development machine to Tellann cloud trust-boundary diagram / SVG design"
            dimensions="1600 × 760"
            displayDimensions="1080 × 510"
          />
          <div>
            <article>
              <span>Source code</span>
              <p>Stays on your machine. Not transmitted without explicit consent.</p>
            </article>
            <article>
              <span>Workflow checkpoints</span>
              <p>Captured locally as declared intent is bound to the project.</p>
            </article>
            <article>
              <span>Reviewed instrumentation</span>
              <p>Proposed, diffed, and approved before anything is applied.</p>
            </article>
            <article>
              <span>Permitted evidence</span>
              <p>Behavior graphs, coverage, reconciliation and QA reports.</p>
            </article>
          </div>
        </div>
        <Link className="dev-text-link" data-aos="fade-up" href="/desktop/security">
          Explore Desktop Security →
        </Link>
      </Section>

      {/* 15 Developer demonstration video */}
      <section className="dev-section is-surface dev-video" id="developer-video">
        <div className="dev-shell-narrow">
          <p className="dev-kicker" data-aos="fade-up">
            Developer demonstration
          </p>
          <h2 data-aos="fade-up" data-aos-delay="60">
            From codebase to QA report: Tellann for developers.
          </h2>
          <div className="dev-video-media" data-aos="tellann-panel" data-aos-delay="120">
            <ProductPlaceholder
              label="Developer demonstration video placeholder"
              dimensions="1920 × 1080"
              displayDimensions="960 × 540"
            />
            <p>
              Desktop 960 × 540 px · Mobile full width, 16:9 · Poster 1600 ×
              900 px · 90–120s · MP4 H.264 + WebM, VTT captions, click-to-play
              — no autoplay with sound · Genuine application footage, not
              generic motion graphics
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

      {/* 16 Related product capabilities */}
      <Section eyebrow="Continue exploring" title="Explore the tools behind the workflow.">
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

      {/* 17 Developer FAQ */}
      <section className="dev-section dev-faq" id="faq">
        <div className="dev-shell dev-faq-grid">
          <div>
            <p className="dev-kicker" data-aos="fade-up">
              Developer FAQ
            </p>
            <h2 data-aos="fade-up" data-aos-delay="60">
              Questions developers ask first.
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

      {/* 18 Final conversion CTA */}
      <section className="dev-final">
        <div className="dev-shell">
          <p className="dev-kicker" data-aos="fade-up">
            Build with more confidence
          </p>
          <h2 data-aos="fade-up" data-aos-delay="60">
            Your code tells one story. See what your application actually
            does.
          </h2>
          <p data-aos="fade-up" data-aos-delay="120">
            Connect a workspace, demonstrate a workflow, and turn recorded
            behavior into actionable QA evidence.
          </p>
          <div className="dev-actions" data-aos="fade-up" data-aos-delay="180">
            <a className="dev-button dev-button-solid" href={appUrl}>
              Start free <span>↗</span>
            </a>
            <Link className="dev-button" href={docsLinks.home.href}>
              View documentation <span>→</span>
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
