import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { CoverageFindingsToggle } from "@/components/coverage-findings-toggle";
import { ProductPlaceholder } from "@/components/product-tour";
import { QACoverageDimensions } from "@/components/qa-coverage-dimensions";
import "../developers/developers.css";
import "./qa-engineers.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://domain-name.com";
const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.domain-name.com";

export const metadata: Metadata = {
  title: "QA Testing & Workflow Coverage Solutions",
  description:
    "Discover how Tellann helps QA engineers visualize workflow coverage, identify missing states and paths, inspect session evidence, and generate actionable QA reports.",
  alternates: { canonical: "/solutions/qa-engineers" },
  openGraph: {
    title: "QA Testing & Workflow Coverage Solutions | Tellann",
    description:
      "Testing tells you what passed. Tellann helps you see what hasn't been covered.",
    url: `${siteUrl}/solutions/qa-engineers`,
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
  ["#coverage", "Coverage"],
  ["#missing-states", "Missing states"],
  ["#missing-flows", "Missing flows"],
  ["#reconciliation", "Reconciliation"],
  ["#reports", "QA reports"],
  ["#use-cases", "Use cases"],
  ["#faq", "FAQ"],
];

const painPoints: [string, string][] = [
  [
    "Unexplored paths",
    "The happy path works, but failure, retry and alternative routes may remain untested.",
  ],
  [
    "Hidden UI states",
    "Loading, empty, error and timeout states can be overlooked during routine validation.",
  ],
  [
    "Incomplete testing evidence",
    "A test result may not clearly show which states and transitions were actually exercised.",
  ],
  [
    "Time-consuming reports",
    "Turning scattered observations into a coherent quality report takes effort.",
  ],
];

const approachSteps: [string, string][] = [
  ["Define", "Describe expected flows"],
  ["Prepare", "Connect and instrument"],
  ["Demonstrate", "Exercise the application"],
  ["Observe", "Capture behavioral evidence"],
  ["Analyze", "Find coverage gaps"],
  ["Report", "Review actionable findings"],
];

const stateTypes: [string, string][] = [
  ["Loading states", "Does the interface behave correctly while a request is in flight?"],
  ["Empty states", "What appears when there is no data to show?"],
  ["Validation errors", "How are invalid inputs surfaced to the user?"],
  ["Timeout states", "What happens when a request takes too long?"],
  ["Authentication failures", "Is a failed login or session handled clearly?"],
  ["Recovery states", "Can the user return to a working state afterward?"],
];

const flowScenarios: [string, string][] = [
  ["Failure flow", "What happens after an operation fails?"],
  ["Recovery flow", "Can the user successfully retry?"],
  ["Alternative flow", "Is there another supported route to the same goal?"],
  ["Edge-case flow", "What happens under less common conditions?"],
];

const reconciliationClassifications: [string, string][] = [
  ["Confirmed", "Observed evidence supports the declared behavior."],
  ["True gap", "The reconciliation rules establish a meaningful difference between intended and observed behavior."],
  ["Undeclared", "Behavior was observed that was not represented in the declared intent."],
];

const guidedRunSteps: [string, string][] = [
  ["Open Tellann Desktop", "Start from the connected workspace"],
  ["Select application and flow", "Choose the intended workflow to demonstrate"],
  ["Launch managed browser", "Tellann prepares a controlled session"],
  ["Perform workflow actions", "Exercise the application as a user would"],
  ["Complete guided run", "End the session once the workflow is finished"],
  ["Review generated evidence", "Inspect what was captured"],
];

const reportRoles: [string, string][] = [
  ["QA engineer", "Record investigated gaps and supporting evidence"],
  ["QA lead", "See areas requiring additional testing effort"],
  ["Developer", "Understand the relevant behavior without vague reproduction notes"],
  ["Product manager", "See whether intended workflows have been demonstrated"],
];

const useCases: [string, string, string][] = [
  [
    "Validate a checkout flow",
    "The happy path works, but failure and retry paths are uncertain.",
    "Map observed checkout behavior and identify paths requiring further validation.",
  ],
  [
    "Review registration and login",
    "Authentication involves validation, errors and recovery states.",
    "Compare expected authentication behavior with demonstration evidence.",
  ],
  [
    "Revisit a changed feature",
    "An update may introduce differences in a previously demonstrated workflow.",
    "Run the updated workflow again and inspect the available behavior comparisons.",
  ],
  [
    "Prepare a QA handoff",
    "Several findings need to be communicated with supporting context.",
    "Produce a structured report containing evidence and outstanding gaps.",
  ],
];

const integrationSteps: [string, string][] = [
  ["Requirements", "Define user stories and intended workflows"],
  ["Test planning", "Scope manual and automated coverage"],
  ["Existing tests", "Run your manual and automated suite"],
  ["Guided demonstration", "Walk through the application with Tellann"],
  ["Coverage review", "Inspect behavioral coverage and reconciliation"],
  ["Investigate & report", "Follow up on findings and share results"],
];

const relatedLinks: [string, string, string][] = [
  ["Coverage Analysis", "Identify what was exercised.", "/product/coverage"],
  ["Missing State Detection", "Find state-level blind spots.", "/product/missing-states"],
  ["Missing Flow Detection", "Discover alternate and recovery paths.", "/product/missing-flows"],
  ["Flow Declaration", "Define intended behavior.", "/product/flow-declaration"],
  ["Reconciliation", "Compare intent and evidence.", "/product/reconciliation"],
  ["Session Replay", "Review a demonstrated sequence.", "/product/session-replay"],
  ["Endpoint Intelligence", "Inspect API-related evidence.", "/product/endpoint-intelligence"],
  ["QA Reports", "Share findings and coverage.", "/product/qa-reports"],
  ["Behavior Graphs", "See the demonstrated workflow as connected states.", "/product/behavior-graphs"],
];

const videoBeats: [string, string][] = [
  ["0–25s", "A successful checkout walkthrough runs, with unexplored paths nearby."],
  ["25–54s", "Checkout, payment failure and retry scenarios are declared, then demonstrated."],
  ["54–85s", "The observed workflow graph builds and coverage gaps are inspected."],
  ["85–120s", "Session evidence is reviewed and the QA report summarizes findings."],
];

const faqs: [string, string][] = [
  [
    "Can Tellann replace manual testing?",
    "No. It provides behavioral evidence and helps identify gaps, but manual testing and QA judgment remain important.",
  ],
  [
    "Does Tellann generate automated test cases?",
    "Autonomous test generation is not a Phase 1 MVP capability. The current focus is guided demonstrations, behavioral analysis and reporting.",
  ],
  [
    "Can I identify missing edge cases?",
    "Tellann can surface expected states and paths that are not represented in the captured evidence. It cannot guarantee discovery of every possible edge case.",
  ],
  [
    "Can I use Tellann without production traffic?",
    "Yes. The Phase 1 demonstration workflow is specifically designed to generate insights from controlled application walkthroughs.",
  ],
  [
    "Do I need coding experience?",
    "QA practitioners can understand coverage, reconciliation and reports without deep implementation knowledge. Initial desktop workspace setup and instrumentation may require help from a developer.",
  ],
  [
    "Can I compare expected and actual workflows?",
    "Yes. Declared intent and observed behavior are two core models in Tellann's reconciliation approach.",
  ],
  [
    "Does a coverage percentage mean the application is ready to release?",
    "No. The percentage must be interpreted within its evidence basis. It does not replace functional correctness, security testing, performance validation or professional release assessment.",
  ],
  [
    "Can QA leads share reports with developers?",
    "The platform's reporting and collaboration capabilities are designed to support shared review, subject to account permissions and plan entitlements.",
  ],
];

export default function QAEngineersSolutionPage() {
  const structuredData = [
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: "Tellann for QA Engineers",
      description: metadata.description,
      url: `${siteUrl}/solutions/qa-engineers`,
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
          name: "QA Engineers",
          item: `${siteUrl}/solutions/qa-engineers`,
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
            Tellann for QA engineers
          </p>
          <h1 data-aos="fade-up" data-aos-delay="60">
            Know what you&rsquo;ve tested. Discover what you&rsquo;ve missed.
          </h1>
          <p data-aos="fade-up" data-aos-delay="120">
            Your tests reveal what works in the scenarios you&rsquo;ve
            exercised. Tellann helps uncover the gaps beyond them&mdash;mapping
            demonstrated workflows, highlighting unobserved states and paths,
            and giving you evidence to guide your next round of testing.
          </p>
          <div className="dev-actions" data-aos="fade-up" data-aos-delay="180">
            <a className="dev-button dev-button-solid" href={appUrl}>
              Start exploring with Tellann <span>→</span>
            </a>
            <a className="dev-button" href="#how-it-works">
              See how it works <span>↓</span>
            </a>
          </div>
          <div className="dev-capability-strip" data-aos="fade-up" data-aos-delay="220">
            {["Workflow coverage", "Missing scenarios", "Session evidence", "QA reports"].map(
              (item) => (
                <span key={item}>{item}</span>
              ),
            )}
          </div>
        </div>
        <div className="dev-shell dev-hero-media">
          <ProductPlaceholder
            label="Checkout workflow coverage — example evidence / interactive React or SVG graph"
            dimensions="1600 × 800"
            displayDimensions="1180 × 560"
          />
          <p>
            Desktop 1180 × 560 px (~2:1) · Tablet 100% width, max 540 px
            height · Mobile 100% width, 400–480 px height · Observed states
            appear and connect, an expected failure/retry branch appears and
            is identified as unobserved, then a coverage-gap summary fades in
            · ~3.5s build-in, then static · Respects
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

      {/* 03 QA pain points */}
      <Section
        id="pain-points"
        surface
        eyebrow="QA pain points"
        title="The hardest defects often live outside the paths you already tested."
        copy="Every release introduces new states, alternative paths and failure conditions. Keeping track of what was exercised—and what remains uncertain—becomes increasingly difficult."
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

      {/* 04 The Tellann approach */}
      <Section
        id="how-it-works"
        eyebrow="From assumptions to evidence"
        title="Turn a guided walkthrough into a clearer testing picture."
        copy="A QA engineer can contribute to flow declaration, carry out a guided demonstration, then review the resulting evidence. Initial workspace binding and instrumentation may still need a developer."
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
        <Media
          visual={{
            label: "Six-step QA workflow diagram with selectable step previews / interactive design",
            master: "1400 × 360",
            display: "1180 × 300",
          }}
          note="Master 1400 × 360 px · Displayed 1180 × 300 px · Connector progresses through the steps over ~1.4s · Vertical six-step sequence on mobile · All steps render immediately with reduced motion"
        />
        <div className="dev-shell dev-link-row">
          <Link href="/product/guided-qa-runs" className="dev-inline-link">
            Explore Guided QA Runs <span>→</span>
          </Link>
        </div>
      </Section>

      {/* 05 Workflow coverage visibility */}
      <Section
        id="coverage"
        eyebrow="Workflow coverage visibility"
        title="See what was covered—and where evidence is missing."
        copy="Tellann maps demonstrated workflows and evaluates coverage across observed states, transitions and paths, helping QA engineers understand how much of the intended behavior has been exercised."
      >
        <div className="dev-shell-wide" data-aos="tellann-panel" data-aos-delay="120">
          <QACoverageDimensions />
        </div>
        <p className="dev-shell dev-media-note">
          Main dashboard mockup 1600 × 1000 px · Desktop rendered 680 × 520 px
          · Mobile 720 × 1000 px · Coverage-type selector transitions in
          180–250 ms · A percentage represents demonstrated evidence for a
          dimension, not total code coverage or production-wide reliability
        </p>
        <div className="dev-shell dev-link-row">
          <Link href="/product/coverage" className="dev-inline-link">
            Explore Coverage Analysis <span>→</span>
          </Link>
        </div>
      </Section>

      {/* 06 Missing application states */}
      <Section
        id="missing-states"
        surface
        eyebrow="Catch the states that don't appear"
        title="Catch the states that don't appear in the happy path."
        copy="A checkout may work when payment succeeds. But what happens when a request times out, the cart is empty, or the payment fails? Tellann helps surface states that haven't been demonstrated so you can decide what deserves further testing."
      >
        <div className="dev-shell-wide" data-aos="tellann-panel" data-aos-delay="120">
          <CoverageFindingsToggle />
        </div>
        <p className="dev-shell dev-media-note">
          Primary mockup 1440 × 900 px · Desktop rendered 700 × 500 px ·
          Mobile visual 720 × 960 px · 600–900 ms transition per step ·
          Observed, Not observed, Potential missing state and Undeclared are
          distinguished — an unobserved state is never presented as a
          confirmed defect
        </p>
        <div className="dev-shell dev-detected-list" data-aos="fade-up" data-aos-delay="160">
          {stateTypes.map(([label, copy]) => (
            <span key={label}>
              <b>{label}</b>
              <small>{copy}</small>
            </span>
          ))}
        </div>
        <div className="dev-shell dev-link-row">
          <Link href="/product/missing-states" className="dev-inline-link">
            Explore Missing State Detection <span>→</span>
          </Link>
        </div>
      </Section>

      {/* 07 Missing flows and recovery paths */}
      <Section
        id="missing-flows"
        eyebrow="The failure path is part of the experience"
        title="The failure path is part of the user experience."
        copy="A state is a condition, such as a failed payment. A flow is the sequence of actions and transitions through which an application enters, handles and recovers from that condition. Tellann helps organize and surface unobserved paths, without guaranteeing that every possible edge case is discovered from a single walkthrough."
      >
        <dl className="dev-shell-narrow dev-report-findings" data-aos="tellann-panel" data-aos-delay="120">
          {flowScenarios.map(([scenario, question]) => (
            <div key={scenario}>
              <dt>{scenario}</dt>
              <dd>{question}</dd>
            </div>
          ))}
        </dl>
        <Media
          visual={{
            label: "Payment workflow — example flow / branch graph design",
            master: "1400 × 800",
            display: "680 × 480",
          }}
          note="Master 1400 × 800 px · Displayed 680 × 480 px · Mobile 720 × 900 px · The successful path draws first, then the alternative branch appears as a dotted line · 2.5–3s"
        />
        <div className="dev-shell dev-link-row">
          <Link href="/product/missing-flows" className="dev-inline-link">
            Explore Missing Flow Detection <span>→</span>
          </Link>
        </div>
      </Section>

      {/* 08 Declared intent vs observed behavior */}
      <Section
        id="reconciliation"
        surface
        eyebrow="Reconciliation"
        title="Compare what should happen with what the evidence shows."
        copy="A requirements document describes expected behavior. A test or demonstration supplies evidence. Tellann places those two perspectives side by side."
      >
        <div className="dev-shell dev-inline-grid" data-aos="tellann-panel" data-aos-delay="120">
          {reconciliationClassifications.map(([title, copy]) => (
            <article key={title}>
              <b>{title}</b>
              <p>{copy}</p>
            </article>
          ))}
        </div>
        <div className="dev-shell dev-compare" data-aos="tellann-panel" data-aos-delay="160">
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
        <p className="dev-shell dev-media-note">
          Source canvas 1600 × 1000 px · Desktop rendered 720 × 530 px ·
          Mobile 720 × 1100 px, stacked · Matching nodes connect, differences
          are highlighted · 2.5–3s
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

      {/* 09 Guided QA demonstrations */}
      <section className="dev-section" id="guided-demo">
        <div className="dev-shell dev-split">
          <div className="dev-split-copy">
            <p className="dev-kicker" data-aos="fade-up">
              Guided QA demonstrations
            </p>
            <h2 data-aos="fade-up" data-aos-delay="60">
              Demonstrate a workflow. Let the evidence build around it.
            </h2>
            <p data-aos="fade-up" data-aos-delay="120">
              A QA practitioner performs a controlled demonstration with
              Tellann Desktop after the application has been connected and
              instrumented. The same button never appears to start a real QA
              run unless it genuinely hands off to the desktop agent.
            </p>
            <div className="dev-detected-list" data-aos="fade-up" data-aos-delay="160">
              {guidedRunSteps.map(([label, copy]) => (
                <span key={label}>
                  <b>{label}</b>
                  <small>{copy}</small>
                </span>
              ))}
            </div>
            <Link
              className="dev-inline-link"
              href="/product/guided-qa-runs"
              data-aos="fade-up"
              data-aos-delay="200"
            >
              Learn about Guided QA Runs <span>→</span>
            </Link>
          </div>
          <div className="dev-split-visual" data-aos="tellann-panel" data-aos-delay="120">
            <ProductPlaceholder
              label="Guided QA run interface — desktop agent and managed browser / product UI design"
              dimensions="1920 × 1080"
              displayDimensions="720 × 450"
            />
          </div>
        </div>
        <p className="dev-shell dev-media-note">
          Master capture 1920 × 1080 px · Desktop rendered 720 × 450 px ·
          Mobile crop 720 × 900 px · Optional short video 1920 × 1080, 15–20s
        </p>
      </section>

      {/* 10 Session replay and evidence inspection */}
      <section className="dev-section is-surface" id="session-replay">
        <div className="dev-shell dev-split">
          <div className="dev-split-copy">
            <p className="dev-kicker" data-aos="fade-up">
              Session replay & evidence inspection
            </p>
            <h2 data-aos="fade-up" data-aos-delay="60">
              When something fails, follow the evidence.
            </h2>
            <p data-aos="fade-up" data-aos-delay="120">
              Tellann reconstructs a chronological timeline from captured
              interactions and related events. QA engineers can use it to
              review what occurred during a demonstration and share context
              with developers — a reconstruction of behavioral telemetry,
              not necessarily a literal screen recording.
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
              label="Session replay — checkout demonstration / event timeline design"
              dimensions="1600 × 1000"
              displayDimensions="700 × 500"
            />
            <div className="dev-replay-events">
              {[
                "00:02 Checkout page opened",
                "00:05 Payment method selected",
                "00:09 Payment submitted",
                "00:11 Payment failure state entered",
              ].map((event) => (
                <span key={event}>{event}</span>
              ))}
            </div>
            <div className="dev-replay-scrubber" aria-hidden="true">
              <i style={{ width: "58%" }} />
            </div>
            <small className="dev-replay-time">00:11 / 00:19</small>
          </div>
        </div>
        <p className="dev-shell dev-media-note">
          Source screenshot 1600 × 1000 px · Desktop rendered 700 × 500 px ·
          Mobile 720 × 1100 px, timeline-first crop · Optional silent clip
          10–12s · No autoplay with sound
        </p>
      </section>

      {/* 11 Endpoint and error context */}
      <Section
        id="endpoint-context"
        eyebrow="Endpoint and error context"
        title={<>Go beyond &ldquo;the button didn&rsquo;t work.&rdquo;</>}
        copy="A failed workflow can involve frontend state, an API request, a response or an error. Tellann connects captured endpoint evidence to the demonstrated behavior so QA engineers have more useful context for investigation."
      >
        <div className="dev-shell dev-trace" data-aos="tellann-panel" data-aos-delay="120">
          {[
            ["Request", "POST /api/checkout", "User submits payment"],
            ["Response", "HTTP 500", "180 ms · Request completed with an error"],
            ["Result", "Payment error state", "Observed transition · QA finding"],
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
            label: "Endpoint evidence chain — example trace / interactive design",
            master: "1400 × 900",
            display: "660 × 480",
          }}
          note="Master 1400 × 900 px · Displayed 660 × 480 px · Mobile vertical cards, 720 × 1000 px · Response event appears, followed by the UI failure state · 2–3s"
        />
        <div className="dev-shell dev-inline-grid">
          {[
            ["More precise defect descriptions.", "Describe a failure with the request, response and resulting state, not just a screenshot."],
            ["Easier communication with engineering.", "Share the same evidence a developer would need to start investigating."],
            ["Less dependence on isolated screenshots.", "See which endpoint outcomes accompanied a demonstrated workflow."],
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

      {/* 12 QA reports and handoff */}
      <section className="dev-section is-surface" id="reports">
        <div className="dev-shell dev-heading">
          <p className="dev-kicker" data-aos="fade-up">
            QA reports and handoff
          </p>
          <h2 data-aos="fade-up" data-aos-delay="60">
            Turn your findings into a report the team can use.
          </h2>
          <p data-aos="fade-up" data-aos-delay="120">
            Bring observed workflows, coverage evidence, missing states,
            missing paths and endpoint findings into a structured QA report
            that supports testing decisions and engineering conversations.
          </p>
        </div>
        <div className="dev-shell dev-report" data-aos="tellann-panel" data-aos-delay="120">
          <div className="dev-report-copy">
            <div className="dev-stat-grid">
              {[
                ["Coverage", "76%"],
                ["Missing states", "11"],
                ["Endpoint findings", "3"],
              ].map(([label, value]) => (
                <span key={label}>
                  <b>{value}</b>
                  <small>{label}</small>
                </span>
              ))}
            </div>
            <dl className="dev-report-findings">
              {[
                ["Evidence basis", "1 guided run · Checkout flow"],
                ["Payment failure", "Not observed"],
                ["Recommended follow-up", "Demonstrate payment-failure and retry paths"],
              ].map(([finding, status]) => (
                <div key={finding}>
                  <dt>{finding}</dt>
                  <dd>{status}</dd>
                </div>
              ))}
            </dl>
            <p className="dev-sample-note">
              All figures are illustrative rather than actual Tellann
              measurements. A report does not automatically certify an
              application as release-ready.
            </p>
          </div>
          <div className="dev-report-visual">
            <ProductPlaceholder
              label="Commerce platform QA report — example layout / portrait report UI design"
              dimensions="1440 × 1000"
              displayDimensions="700 × 520"
            />
            <div className="dev-export-card">
              <ProductPlaceholder
                label="Optional floating report preview"
                dimensions="500 × 680"
              />
            </div>
          </div>
        </div>
        <div className="dev-shell dev-report-roles">
          {reportRoles.map(([role, copy]) => (
            <article key={role}>
              <b>{role}</b>
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

      {/* 13 QA use cases */}
      <Section
        id="use-cases"
        eyebrow="Practical answers for real testing situations"
        title="Practical answers for real testing situations."
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

      {/* 14 Manual QA and automated QA */}
      <Section
        surface
        eyebrow="Whatever your testing approach"
        title="A clearer picture of coverage, whatever your testing approach."
      >
        <div className="dev-shell dev-usecase-grid" data-aos="tellann-panel" data-aos-delay="120">
          <article>
            <b>For manual QA engineers</b>
            <p>
              Perform a guided exploratory walkthrough, inspect recorded
              paths and use the resulting gaps to direct further manual
              validation.
            </p>
          </article>
          <article>
            <b>For automation QA engineers</b>
            <p>
              Use behavioral coverage evidence alongside your scripted tests
              to assess which user journeys and application states still
              need attention.
            </p>
          </article>
        </div>
        <p className="dev-shell dev-outcome">
          Tellann does not replace Selenium, Playwright, Cypress, unit
          testing, integration testing or manual QA judgment. Its Phase 1
          role is to make application behavior and gaps visible through
          demonstrated evidence.
        </p>
      </Section>

      {/* 15 QA workflow video */}
      <section className="dev-section dev-video" id="qa-video">
        <div className="dev-shell-narrow">
          <p className="dev-kicker" data-aos="fade-up">
            QA demonstration
          </p>
          <h2 data-aos="fade-up" data-aos-delay="60">
            How Tellann helps QA engineers uncover untested workflows.
          </h2>
          <div className="dev-video-media" data-aos="tellann-panel" data-aos-delay="120">
            <ProductPlaceholder
              label="QA workflow demonstration video placeholder"
              dimensions="1920 × 1080"
              displayDimensions="960 × 540"
            />
            <p>
              Desktop 960 × 540 px · Mobile full width, 16:9 · Poster 1600 ×
              900 px · 90–120s · MP4 H.264 + WebM, VTT captions,
              click-to-play — no autoplay with sound · Genuine product
              capture with simple animated annotations, not generic motion
              graphics
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

      {/* 16 Fit into existing QA practices */}
      <Section
        id="workflow-integration"
        surface
        eyebrow="Add behavioral evidence to how you already test"
        title="Add behavioral evidence to the way you already test."
        copy="QA engineers should not interpret Tellann as a requirement to abandon their existing tools or methodology."
      >
        <div className="dev-shell dev-workflow-flow" data-aos="tellann-panel" data-aos-delay="120">
          {integrationSteps.map(([name, copy], index) => (
            <div key={name}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <b>{name}</b>
              <p>{copy}</p>
              {index < integrationSteps.length - 1 ? <i>→</i> : null}
            </div>
          ))}
        </div>
        <p className="dev-shell dev-media-note">
          Master canvas 1400 × 600 px · Desktop rendered 1120 × 470 px ·
          Vertical step sequence on mobile · Single line-drawing animation,
          1.5–2s · Arbitrary externally executed test suites are not
          automatically imported into Tellann unless that integration is
          implemented
        </p>
      </Section>

      {/* 17 Privacy and evidence protection */}
      <Section
        id="privacy"
        eyebrow="Privacy and evidence protection"
        title="Useful testing evidence. Responsible data handling."
        copy="A QA demonstration may interact with authentication forms, personal information or payment-related interfaces. Tellann's privacy architecture is designed to protect sensitive information."
      >
        <div className="dev-shell dev-trust-grid" data-aos="tellann-panel" data-aos-delay="120">
          <ProductPlaceholder
            label="Local desktop agent to Tellann analysis services trust-boundary diagram / SVG design"
            dimensions="1400 × 700"
            displayDimensions="1050 × 420"
          />
          <div>
            <article>
              <span>Privacy by default</span>
              <p>Sensitive values are subject to collection restrictions and masking.</p>
            </article>
            <article>
              <span>Local source handling</span>
              <p>Source code is processed locally by default, with consent required for raw-source uploads.</p>
            </article>
            <article>
              <span>Controlled evidence</span>
              <p>Recorded evidence and reports follow access and retention controls.</p>
            </article>
          </div>
        </div>
        <Link className="dev-text-link" data-aos="fade-up" href="/desktop/security">
          Explore Desktop Security →
        </Link>
      </Section>

      {/* 18 Related product capabilities */}
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

      {/* 19 QA FAQ */}
      <section className="dev-section dev-faq" id="faq">
        <div className="dev-shell dev-faq-grid">
          <div>
            <p className="dev-kicker" data-aos="fade-up">
              QA FAQ
            </p>
            <h2 data-aos="fade-up" data-aos-delay="60">
              Questions QA engineers ask first.
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
            Test with better visibility
          </p>
          <h2 data-aos="fade-up" data-aos-delay="60">
            The next issue you catch could be on a path you haven&rsquo;t
            tested yet.
          </h2>
          <p data-aos="fade-up" data-aos-delay="120">
            Map demonstrated behavior, uncover coverage gaps and turn your
            findings into evidence your team can use.
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
