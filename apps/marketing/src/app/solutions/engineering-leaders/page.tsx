import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { docsLinks } from "@/config/site-routes";
import { ProductPlaceholder } from "@/components/product-tour";
import { QACoverageDimensions } from "@/components/qa-coverage-dimensions";
import { LeadershipRoleTabs } from "@/components/leadership-role-tabs";
import "../developers/developers.css";
import "./engineering-leaders.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://domain-name.com";
const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.domain-name.com";

export const metadata: Metadata = {
  title: "Software Quality Visibility for Engineering Leaders",
  description:
    "Help engineering leaders understand workflow coverage, identify quality gaps, and make better-informed release decisions with Tellann's behavioral QA reports.",
  alternates: { canonical: "/solutions/engineering-leaders" },
  openGraph: {
    title: "Software Quality Visibility for Engineering Leaders | Tellann",
    description:
      "Lead with evidence. Not assumptions. See the quality evidence behind what your team ships.",
    url: `${siteUrl}/solutions/engineering-leaders`,
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
  ["#challenges", "Challenges"],
  ["#visibility", "Visibility"],
  ["#coverage", "Coverage"],
  ["#gaps", "Gaps"],
  ["#reconciliation", "Reconciliation"],
  ["#release-reviews", "Release reviews"],
  ["#roles", "By role"],
  ["#faq", "FAQ"],
];

const challenges: [string, string][] = [
  [
    "Limited quality visibility",
    "A successful test run doesn't automatically reveal all untested states and workflows.",
  ],
  [
    "Fragmented team context",
    "Developers, QA and product teams may describe the same feature using different evidence.",
  ],
  [
    "Release uncertainty",
    "Deciding whether to release becomes harder when important behavioral gaps are unclear.",
  ],
  [
    "Reporting overhead",
    "Engineering managers spend time gathering and interpreting findings across tools and conversations.",
  ],
];

const teamWorkflowSteps: [string, string, string][] = [
  ["Product + QA", "Define expected behavior", "Declare the workflows that matter."],
  ["Developer", "Prepare the application", "Connect the workspace and review instrumentation."],
  ["QA + Developer", "Demonstrate the workflows", "Exercise functionality through Tellann Desktop."],
  ["Tellann", "Analyze the evidence", "Build behavior graphs and reconcile captured activity."],
  ["Engineering team", "Review findings", "Inspect coverage and outstanding gaps."],
  ["Engineering leader", "Make the next decision", "Use the report to guide further validation."],
];

const outstandingGaps: [string, string, string][] = [
  ["Checkout", "Payment retry not observed", "Demonstrate recovery flow"],
  ["Authentication", "Session timeout not observed", "Validate expiry behavior"],
  ["Registration", "Validation-error path not observed", "Review invalid-input scenario"],
];

const sharedRoles: [string, string][] = [
  ["Developers", "What happened in the application?"],
  ["QA engineers", "Which scenarios need validation?"],
  ["Engineering leaders", "What evidence informs our next decision?"],
];

const releaseRows: [string, string][] = [
  ["Authentication", "Observed"],
  ["Checkout success", "Observed"],
  ["Payment retry", "Not observed"],
  ["Password recovery", "Needs review"],
];

const investigationLevels: [string, string, string][] = [
  ["01 / Report", "Report", "Payment retry path not observed"],
  ["02 / Workflow", "Workflow", "Inspect expected and observed transitions"],
  ["03 / Evidence", "Evidence", "Review captured events and endpoint activity"],
];

const useCases: [string, string][] = [
  [
    "Before a release",
    "Understand which important workflows still lack evidence, then use the outstanding gaps to guide final validation.",
  ],
  [
    "During engineering reviews",
    "Bring developers and QA engineers into the same discussion with shared behavioral evidence instead of conflicting recollections.",
  ],
  [
    "After a feature change",
    "Review the updated workflow and its recorded behavior, and identify what needs to be demonstrated again.",
  ],
  [
    "As the engineering team grows",
    "Use declared flows and structured QA reports as a repeatable, consistent validation practice.",
  ],
];

const adoptionSteps: [string, string][] = [
  ["Choose one workflow", "Start with registration, checkout, authentication or another business-critical path."],
  ["Prepare the application", "Connect the supported workspace and complete the required instrumentation setup."],
  ["Run a controlled demonstration", "Capture behavioral evidence for that workflow."],
  ["Review the results together", "Use the report to identify what needs further testing and decide whether to expand."],
];

const relatedLinks: [string, string, string][] = [
  ["QA Reports", "Review structured validation evidence.", "/product/qa-reports"],
  ["Reconciliation", "See where intended and observed behavior differ.", "/product/reconciliation"],
  ["Flow Declaration", "Create a shared definition of intended workflows.", "/product/flow-declaration"],
  ["Behavior Graphs", "Visualize demonstrated application paths.", "/product/behavior-graphs"],
  ["Coverage Analysis", "Identify workflows and states without sufficient evidence.", "/product/coverage"],
  ["Endpoint Intelligence", "Review captured backend activity tied to workflows.", "/product/endpoint-intelligence"],
];

const videoBeats: [string, string][] = [
  ["0–25s", "Several isolated testing artifacts are difficult to compare."],
  ["25–54s", "Important application workflows are declared, then demonstrated by the team."],
  ["54–84s", "Workflow coverage builds, and a missing recovery path becomes visible."],
  ["84–100s", "A structured QA report helps the team identify its next validation action."],
];

const faqs: [string, string][] = [
  [
    "How does Tellann help engineering managers?",
    "It provides structured evidence about demonstrated workflows, coverage gaps, and QA findings, allowing managers to discuss specific validation questions with their teams.",
  ],
  [
    "Can Tellann tell us whether an application is safe to release?",
    "No. Tellann supports release reviews with behavioral evidence. Final release decisions must also consider correctness, security, performance, business requirements, and other relevant validation.",
  ],
  [
    "Does Tellann replace QA engineers?",
    "No. It helps QA and engineering teams understand demonstrated application behavior and identify gaps requiring further investigation.",
  ],
  [
    "Can CTOs see quality reports without inspecting raw events?",
    "The reporting system is designed to summarize captured evidence into readable reports. Access depends on team roles and subscription entitlements.",
  ],
  [
    "Can Tellann monitor production systems continuously?",
    "Continuous production monitoring is planned for a later phase and is not part of the Phase 1 Behavioral QA MVP.",
  ],
  [
    "Can we evaluate Tellann on a single application?",
    "Yes. A single application and critical workflow are appropriate starting points, subject to available plan limits.",
  ],
  [
    "Does Tellann support collaboration across engineering teams?",
    "Collaboration, membership and governance capabilities depend on the subscription plan. The published pricing and entitlement information define the exact limits.",
  ],
  [
    "Does Tellann upload our codebase?",
    "Source analysis is local-first. Raw source uploads require explicit consent, while permitted behavioral evidence and derived information may be transmitted for analysis.",
  ],
];

export default function EngineeringLeadersSolutionPage() {
  const structuredData = [
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: "Tellann for Engineering Leaders",
      description: metadata.description,
      url: `${siteUrl}/solutions/engineering-leaders`,
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
          name: "Engineering Leaders",
          item: `${siteUrl}/solutions/engineering-leaders`,
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
            Tellann for engineering leaders
          </p>
          <h1 data-aos="fade-up" data-aos-delay="60">
            Lead with evidence. Not assumptions.
          </h1>
          <p data-aos="fade-up" data-aos-delay="120">
            Give your engineering team a clearer view of application quality.
            Understand which critical workflows have been demonstrated,
            identify outstanding gaps, and bring evidence into decisions
            about what to validate before release.
          </p>
          <div className="dev-actions" data-aos="fade-up" data-aos-delay="180">
            <a className="dev-button dev-button-solid" href={appUrl}>
              Start evaluating Tellann <span>→</span>
            </a>
            <a className="dev-button" href="#leadership-demo">
              See the platform in action <span>↓</span>
            </a>
          </div>
          <div className="dev-capability-strip" data-aos="fade-up" data-aos-delay="220">
            {["Workflow visibility", "Coverage evidence", "Quality reports", "Team alignment"].map(
              (item) => (
                <span key={item}>{item}</span>
              ),
            )}
          </div>
        </div>
        <div className="dev-shell dev-hero-media">
          <ProductPlaceholder
            label="Application quality evidence dashboard — illustrative run data / React or SVG design"
            dimensions="1600 × 900"
            displayDimensions="1180 × 580"
          />
          <p>
            Desktop 1180 × 580 px · Tablet 960 × 540 px, responsive · Mobile
            100% width, stacked 720 × 950 px asset · Declared and observed
            workflow summaries populate, the captured workflow graph draws,
            an unobserved path is identified, then an investigation summary
            appears · ~3.8s build-in, then static · No Release Ready badge or
            invented aggregate quality score — evidence only · Respects
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

      {/* 03 Leadership challenges */}
      <Section
        id="challenges"
        surface
        eyebrow="Leadership challenges"
        title="Leading engineering means making decisions with incomplete information."
        copy="Your team may know which tests passed. But understanding what was actually demonstrated, where coverage is incomplete, and what deserves attention before release can still require several meetings, dashboards, and manual reports."
      >
        <div className="dev-shell el-challenge-grid" data-aos="tellann-panel" data-aos-delay="120">
          {challenges.map(([title, copy]) => (
            <article key={title}>
              <div className="el-icon-placeholder" aria-hidden="true">
                Icon
                <br />
                96×96
              </div>
              <b>{title}</b>
              <p>{copy}</p>
            </article>
          ))}
        </div>
      </Section>

      {/* 04 Visibility without guesswork */}
      <section className="dev-section" id="visibility">
        <div className="dev-shell dev-split">
          <div className="dev-split-copy">
            <p className="dev-kicker" data-aos="fade-up">
              Quality visibility
            </p>
            <h2 data-aos="fade-up" data-aos-delay="60">
              One clearer view of the evidence behind your release.
            </h2>
            <p data-aos="fade-up" data-aos-delay="120">
              Tellann brings demonstrated workflow coverage, missing states,
              reconciliation results, and QA findings into a structured
              picture of the application. Instead of interpreting isolated
              test results, you can see what was validated and what still
              needs review.
            </p>
            <ul className="el-status-list" data-aos="fade-up" data-aos-delay="160">
              {[
                ["✓", "Authentication", "Observed"],
                ["◐", "Checkout", "Partially observed", "is-partially-observed"],
                ["○", "Password recovery", "Not observed", "is-not-observed"],
              ].map(([glyph, label, status, modifier]) => (
                <li key={label} className={modifier ?? ""}>
                  <i aria-hidden="true">{glyph}</i>
                  <b>{label}</b>
                  <span>{status}</span>
                </li>
              ))}
            </ul>
            <p className="dev-outcome" data-aos="fade-up" data-aos-delay="180">
              Checkout retry path requires additional demonstration evidence.
              Illustrative evidence summary, not live organizational
              telemetry.
            </p>
          </div>
          <div className="dev-split-visual" data-aos="tellann-panel" data-aos-delay="120">
            <ProductPlaceholder
              label="Application quality evidence report — Commerce Application / product UI design"
              dimensions="1600 × 1000"
              displayDimensions="700 × 520"
            />
          </div>
        </div>
        <p className="dev-shell dev-media-note">
          Source canvas 1600 × 1000 px · Desktop rendered 700 × 520 px ·
          Mobile screenshot first, then text, 720 × 1100 px · Three regions:
          application and run context, coverage by critical workflow,
          outstanding findings with supporting evidence · Sections reveal
          over 800 ms
        </p>
      </section>

      {/* 05 How Tellann works for engineering teams */}
      <Section
        id="team-workflow"
        surface
        eyebrow="How your team uses Tellann"
        title="Your team demonstrates. Tellann helps everyone understand."
        copy="Engineering leaders are unlikely to be the person configuring SDKs or operating a managed browser. The value comes from how responsibilities connect across the team."
      >
        <div className="dev-shell dev-workflow-flow" data-aos="tellann-panel" data-aos-delay="120">
          {teamWorkflowSteps.map(([role, name, copy], index) => (
            <div key={name}>
              <span>{role}</span>
              <b>{name}</b>
              <p>{copy}</p>
              {index < teamWorkflowSteps.length - 1 ? <i>→</i> : null}
            </div>
          ))}
        </div>
        <p className="dev-shell dev-media-note">
          Master 1600 × 520 px · Desktop rendered 1200 × 390 px · Mobile
          vertical timeline, 720 × 1200 px · Three role groups differentiated
          with iconography, not color alone · One-time connector
          progression, 1.5s · Optional: selecting a step shows a one-sentence
          explanation
        </p>
        <div className="dev-shell dev-link-row">
          <Link href="/product/how-it-works" className="dev-inline-link">
            Understand How Tellann Works <span>→</span>
          </Link>
        </div>
      </Section>

      {/* 06 Coverage and evidence visibility */}
      <Section
        id="coverage"
        eyebrow="Coverage and evidence visibility"
        title="Know which critical workflows have supporting evidence."
        copy="Coverage is not synonymous with correctness. Tellann can provide evidence that a workflow, state, or transition was observed. A leader must still consider the type of validation performed and whether the application's behavior meets the relevant acceptance criteria."
      >
        <div className="dev-shell-wide" data-aos="tellann-panel" data-aos-delay="120">
          <QACoverageDimensions />
        </div>
        <p className="dev-shell dev-media-note">
          Main dashboard master 1600 × 1000 px · Desktop rendered 680 × 520
          px · Mobile 720 × 1100 px · Coverage-dimension switcher transitions
          in 200–300 ms · Understand validation scope, find gaps in critical
          workflows, and direct future testing — Tellann does not
          automatically rank organization-wide risk unless that algorithm is
          actually available
        </p>
        <div className="dev-shell dev-link-row">
          <Link href="/product/coverage" className="dev-inline-link">
            Explore Coverage Analysis <span>→</span>
          </Link>
        </div>
      </Section>

      {/* 07 Prioritize outstanding gaps */}
      <Section
        id="gaps"
        surface
        eyebrow="Outstanding quality gaps"
        title="Give your next QA discussion a starting point."
        copy="Leaders care less about having a long list of findings and more about understanding which findings are relevant to release objectives. Tellann provides the evidence; human leaders determine business criticality and release priority."
      >
        <div className="dev-shell el-gaps-board" data-aos="tellann-panel" data-aos-delay="120">
          {outstandingGaps.map(([workflow, finding, action]) => (
            <div key={workflow}>
              <b>{workflow}</b>
              <p>{finding}</p>
              <span>→ {action}</span>
            </div>
          ))}
        </div>
        <p className="dev-shell dev-media-note">
          Master 1440 × 960 px · Desktop rendered 680 × 500 px · Mobile 720 ×
          1100 px · Findings appear in sequence, 150 ms apart · Each finding
          carries its evidence basis — application, declared workflow,
          demonstration run, observed state · Marketing UI says
          &ldquo;Requires review&rdquo; or &ldquo;Not observed,&rdquo; never
          &ldquo;Critical defect&rdquo; unless a verification process
          actually established that classification
        </p>
      </Section>

      {/* 08 Declared intent vs observed behavior */}
      <Section
        id="reconciliation"
        eyebrow="Declared intent vs observed behavior"
        title="Connect product expectations to engineering evidence."
        copy="Tellann compares declared application behavior against captured demonstrations, allowing engineering teams to see where implementation evidence matches expectations, where a meaningful gap exists, and where unexpected behavior requires review."
      >
        <div className="dev-shell dev-compare" data-aos="tellann-panel" data-aos-delay="120">
          <article>
            <span>Declared intent</span>
            <ul>
              {["User starts checkout", "Payment succeeds", "Payment fails", "User retries"].map(
                (item) => (
                  <li key={item}>
                    <i aria-hidden="true">·</i>
                    {item}
                  </li>
                ),
              )}
            </ul>
          </article>
          <b aria-hidden="true">vs</b>
          <article>
            <span>Observed evidence</span>
            <ul>
              {[
                ["✓", "Checkout observed"],
                ["✓", "Success observed"],
                ["✓", "Failure observed"],
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
          Source 1920 × 1080 px · Desktop rendered 960 × 540 px · Mobile
          static or vertically arranged SVG rather than a shrunk animation ·
          An illustrative comparison, not an assertion that an unobserved
          path is broken · Optional 10–12s silent animation with user pause
          controls, no unnecessary continuous looping
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

      {/* 09 Team alignment and shared evidence */}
      <section className="dev-section is-surface" id="shared-evidence">
        <div className="dev-shell dev-heading">
          <p className="dev-kicker" data-aos="fade-up">
            Team alignment and shared evidence
          </p>
          <h2 data-aos="fade-up" data-aos-delay="60">
            Help every team discuss the same behavior.
          </h2>
          <p data-aos="fade-up" data-aos-delay="120">
            A declared workflow establishes the expected behavior.
            Demonstration evidence shows what was observed. Reconciliation
            findings and QA reports give developers, testers, and product
            stakeholders a common reference when deciding what needs to
            happen next.
          </p>
        </div>
        <div className="dev-shell">
          <div className="el-shared-grid" data-aos="tellann-panel" data-aos-delay="120">
            {sharedRoles.map(([role, question]) => (
              <div key={role}>
                <b>{role}</b>
                <p>{question}</p>
              </div>
            ))}
          </div>
          <div className="el-shared-report" aria-hidden="true">
            Shared QA report
          </div>
          <p className="dev-media-note" style={{ marginTop: 20 }}>
            Master 1600 × 720 px · Desktop rendered 1100 × 500 px · Tablet
            three cards above the shared report · Mobile vertical cards ·
            Connecting lines animate once, 1.5s · Team collaboration and
            governance follow published plan capabilities — not unlimited
            members or org-wide sharing on every plan
          </p>
          <div className="dev-link-row">
            <Link href="/pricing" className="dev-inline-link">
              Explore Team Plans <span>→</span>
            </Link>
          </div>
        </div>
      </section>

      {/* 10 Evidence for release reviews */}
      <Section
        id="release-reviews"
        eyebrow="Evidence for release reviews"
        title="Make release discussions more specific."
        copy="A leader's release meeting should move beyond “QA said it looks good.” Tellann supports evidence-backed conversations about which workflows have been exercised and which uncertainties remain. The release decision remains with the engineering organization."
      >
        <table className="dev-shell el-release-table" data-aos="fade-up" data-aos-delay="120">
          <thead>
            <tr>
              <th>Workflow — Commerce Platform, Candidate Build</th>
              <th>Evidence status</th>
            </tr>
          </thead>
          <tbody>
            {releaseRows.map(([workflow, status]) => (
              <tr key={workflow}>
                <td>{workflow}</td>
                <td>{status}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="dev-shell el-open-question" data-aos="fade-up" data-aos-delay="160">
          <span>Open question</span>
          <p>Should the team validate payment recovery before release?</p>
        </div>
        <p className="dev-shell dev-media-note">
          Source 1440 × 1000 px · Desktop rendered 700 × 520 px · Mobile 720
          × 1000 px · No generated &ldquo;Go/No-Go&rdquo; verdict as the
          visual centerpiece — an open release question and evidence summary
          instead · Subtle row reveal only, no further animation needed
        </p>
        <div className="dev-shell dev-link-row">
          <Link href="/product/qa-reports" className="dev-inline-link">
            Explore QA Reports <span>→</span>
          </Link>
        </div>
      </Section>

      {/* 11 Investigate without micromanaging */}
      <Section
        surface
        eyebrow="Investigate without micromanaging"
        title="Go from a report to the supporting evidence."
        copy="Engineering leaders should not need to sit through a full demonstration just to understand the context behind a finding. Tellann's reports act as an entry point into underlying behavioral evidence, so technical team members can inspect recorded sessions, transitions, and endpoint activity."
      >
        <div className="dev-shell el-investigation-grid" data-aos="tellann-panel" data-aos-delay="120">
          {investigationLevels.map(([step, title, caption], index) => (
            <div key={step}>
              <span>{step}</span>
              <ProductPlaceholder
                label={`${title} — illustrative detail / UI screenshot`}
                dimensions="1200 × 800"
                displayDimensions="350 × 240"
              />
              <b>{title}</b>
              <p>{caption}</p>
              {index < investigationLevels.length - 1 ? <i>→</i> : null}
            </div>
          ))}
        </div>
        <p className="dev-shell dev-media-note">
          Three progressively detailed screenshots, each source 1200 × 800
          px, rendered 350 × 240 px · Desktop horizontal three-card sequence,
          mobile vertically stacked · Selecting a card can enlarge its
          preview in a 0.2–0.3s transition
        </p>
        <div className="dev-shell dev-link-row">
          <Link href="/product/session-replay" className="dev-inline-link">
            Explore Session Replay <span>→</span>
          </Link>
        </div>
      </Section>

      {/* 12 Leadership use cases */}
      <Section
        id="use-cases"
        eyebrow="Weekly engineering decisions"
        title="Better evidence for the decisions engineering leaders make every week."
      >
        <div className="dev-shell dev-usecase-grid" data-aos="tellann-panel" data-aos-delay="120">
          {useCases.map(([title, copy]) => (
            <article key={title}>
              <b>{title}</b>
              <p>{copy}</p>
            </article>
          ))}
        </div>
      </Section>

      {/* 13 Value by leadership role */}
      <Section
        id="roles"
        surface
        eyebrow="Value by leadership role"
        title="Different responsibilities. One clearer evidence base."
      >
        <div className="dev-shell" data-aos="tellann-panel" data-aos-delay="120">
          <LeadershipRoleTabs />
        </div>
        <p className="dev-shell dev-media-note">
          Desktop component 1100 × 420 px · Mobile full width, variable
          height · 200ms content crossfade · No separate screenshots needed —
          this is one of the few interactions worth implementing, since the
          audience classes genuinely have different responsibilities
        </p>
      </Section>

      {/* 14 Leadership demonstration video */}
      <section className="dev-section dev-video" id="leadership-demo">
        <div className="dev-shell-narrow">
          <p className="dev-kicker" data-aos="fade-up">
            Leadership demonstration
          </p>
          <h2 data-aos="fade-up" data-aos-delay="60">
            From QA evidence to better engineering decisions.
          </h2>
          <div className="dev-video-media" data-aos="tellann-panel" data-aos-delay="120">
            <ProductPlaceholder
              label="Engineering leadership overview video placeholder"
              dimensions="1920 × 1080"
              displayDimensions="960 × 540"
            />
            <p>
              Desktop 960 × 540 px · Mobile full width, 16:9 · Poster 1600 ×
              900 px · 75–100s · MP4 H.264 + WebM, VTT captions, click-to-play
              — no autoplay with sound · Calm, credible, decision-focused
              narration · No invented customer logos, fabricated ROI results,
              or unsupported percentages
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

      {/* 15 Adoption and integration */}
      <Section
        id="adoption"
        surface
        eyebrow="Adoption and integration"
        title="Introduce behavioral QA without replacing your existing process."
        copy="Engineering leaders should see a credible adoption path that does not require an organization-wide migration."
      >
        <div className="dev-shell dev-workflow-flow" data-aos="tellann-panel" data-aos-delay="120">
          {adoptionSteps.map(([name, copy], index) => (
            <div key={name}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <b>{name}</b>
              <p>{copy}</p>
              {index < adoptionSteps.length - 1 ? <i>→</i> : null}
            </div>
          ))}
        </div>
        <p className="dev-shell dev-media-note">
          Master graphic 1440 × 600 px · Desktop rendered 1120 × 470 px ·
          Mobile 720 × 1000 px vertical sequence · 1.5s stage progression
        </p>
        <div className="dev-shell dev-link-row">
          <Link href="/desktop" className="dev-inline-link">
            Explore Tellann Desktop <span>→</span>
          </Link>
          <Link href={docsLinks.home.href} className="dev-inline-link">
            View documentation <span>→</span>
          </Link>
        </div>
      </Section>

      {/* 16 Security, privacy and governance */}
      <Section
        eyebrow="Security, privacy and governance"
        title="Understand the evidence without surrendering control of your code."
        copy="For CTOs and engineering managers, information handling is an important buying consideration."
      >
        <div className="dev-shell dev-trust-grid" data-aos="tellann-panel" data-aos-delay="120">
          <ProductPlaceholder
            label="Local source repository to Tellann Desktop to Tellann Cloud analysis — data-flow diagram / SVG design"
            dimensions="1600 × 760"
            displayDimensions="1050 × 500"
          />
          <div>
            <article>
              <span>Local-first source analysis</span>
              <p>The desktop agent analyzes local source code by default. Raw source transfers require explicit consent.</p>
            </article>
            <article>
              <span>Controlled collection</span>
              <p>Captured telemetry follows Tellann&rsquo;s data-minimization, masking, and sensitive-data protection policies.</p>
            </article>
            <article>
              <span>Team governance</span>
              <p>Roles, membership, access and other enterprise-oriented controls depend on the selected subscription.</p>
            </article>
          </div>
        </div>
        <p className="dev-shell dev-media-note">
          Source 1600 × 760 px · Desktop rendered 1050 × 500 px · Mobile 720
          × 1100 px · Data-flow progression animation, 2.5s · Reports and
          behavioral evidence can be processed in Tellann&rsquo;s cloud
          architecture — not all data stays local
        </p>
        <Link className="dev-text-link" data-aos="fade-up" href="/desktop/security">
          Explore Desktop Security →
        </Link>
      </Section>

      {/* 17 Related product capabilities */}
      <Section surface eyebrow="Continue exploring" title="Explore the tools behind the evidence.">
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

      {/* 18 FAQ */}
      <section className="dev-section dev-faq" id="faq">
        <div className="dev-shell dev-faq-grid">
          <div>
            <p className="dev-kicker" data-aos="fade-up">
              Leadership FAQ
            </p>
            <h2 data-aos="fade-up" data-aos-delay="60">
              Questions engineering leaders ask first.
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

      {/* 19 Final conversion CTA */}
      <section className="dev-final">
        <div className="dev-shell">
          <p className="dev-kicker" data-aos="fade-up">
            Make quality visible
          </p>
          <h2 data-aos="fade-up" data-aos-delay="60">
            Better engineering decisions start with better evidence.
          </h2>
          <p data-aos="fade-up" data-aos-delay="120">
            Give your team a clearer way to understand demonstrated
            workflows, identify outstanding gaps, and discuss what needs
            validation next.
          </p>
          <div className="dev-actions" data-aos="fade-up" data-aos-delay="180">
            <a className="dev-button dev-button-solid" href={appUrl}>
              Start evaluating <span>↗</span>
            </a>
            <Link className="dev-button" href="/pricing">
              Explore pricing <span>→</span>
            </Link>
          </div>
          <small>
            A 14-day trial, when offered, authorizes a card for automatic
            conversion — never a hidden charge. Enterprise teams can also{" "}
            <Link href="/contact">talk to us</Link> directly.
          </small>
        </div>
      </section>
    </main>
  );
}
