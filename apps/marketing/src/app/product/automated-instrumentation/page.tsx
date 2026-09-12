import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { InstrumentationAudiences } from "@/components/instrumentation-audiences";
import { InstrumentationDiffReview } from "@/components/instrumentation-diff-review";
import { InstrumentationPlanHero } from "@/components/instrumentation-plan-hero";
import { InstrumentationValidationDemo } from "@/components/instrumentation-validation-demo";
import { ProductPlaceholder } from "@/components/product-tour";
import "./automated-instrumentation.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://domain-name.com";

export const metadata: Metadata = {
  title: "Automated Instrumentation for Behavioral QA | Tellann",
  description:
    "Automatically instrument application workflows with Tellann. Review every proposed code change, approve scoped instrumentation, validate the result, and roll back safely when needed.",
  alternates: { canonical: "/product/automated-instrumentation" },
  openGraph: {
    title: "Automated Instrumentation for Behavioral QA | Tellann",
    description:
      "Instrument your application without giving up control. Tellann proposes; you approve.",
    url: `${siteUrl}/product/automated-instrumentation`,
    type: "website",
  },
};

type Visual = { label: string; master: string; display: string };

function VisualPlaceholder({ label, master, display }: Visual) {
  return (
    <ProductPlaceholder
      label={label}
      dimensions={master}
      displayDimensions={display}
    />
  );
}

function Section({
  eyebrow,
  title,
  copy,
  id,
  surface = false,
  children,
}: {
  eyebrow: string;
  title: string;
  copy?: string;
  id?: string;
  surface?: boolean;
  children: ReactNode;
}) {
  return (
    <section className={`instr-section${surface ? " is-surface" : ""}`} id={id}>
      <div className="instr-shell instr-heading">
        <p className="instr-kicker" data-aos="fade-up">
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

/** Designed asset centred under the heading, with its dimension note beneath. */
function Media({ visual, note }: { visual: Visual; note: string }) {
  return (
    <div className="instr-media">
      <VisualPlaceholder {...visual} />
      <p>{note}</p>
    </div>
  );
}

const jumpLinks: [string, string][] = [
  ["#lifecycle", "How it works"],
  ["#review", "Review the diff"],
  ["#safety", "Validate & roll back"],
  ["#roles", "By role"],
  ["#report", "Report"],
  ["#plans", "Plans"],
  ["#faq", "FAQ"],
];

const lifecycle: [string, string][] = [
  ["Detect", "Find existing instrumentation and installed SDKs."],
  ["Plan", "Scope a plan to the flow you asked for."],
  ["Review", "Present every proposed change as a diff."],
  ["Approve", "Wait for an authorized member to say yes."],
  ["Apply", "Write the patch set to the bound workspace."],
  ["Validate", "Check the build and tests."],
  ["Roll back", "Reverse the plan if it caused the failure."],
];

const manualProblems: [string, string, string][] = [
  [
    "Finding the right files",
    "Where does “checkout complete” actually happen?",
    "Tellann analyzes the bound workspace and locates the flow checkpoints.",
  ],
  [
    "Knowing what already exists",
    "Is this workflow already instrumented?",
    "Existing instrumentation and installed SDKs are detected before a plan is written.",
  ],
  [
    "Keeping it consistent",
    "Are the frontend and backend describing the same workflow?",
    "One plan covers the flow end to end rather than file by file.",
  ],
];

const capabilities: [string, string[]][] = [
  ["Workflow boundaries", ["CHECKOUT_STARTED", "CHECKOUT_COMPLETE"]],
  ["States", ["AUTHENTICATED", "PAYMENT_FAILED"]],
  ["Transitions", ["CART → CHECKOUT"]],
  ["Frontend behavior", ["page", "component", "form", "interaction"]],
  ["Backend behavior", ["request", "response", "error", "latency"]],
  ["Flow checkpoints", ["entry", "milestone", "terminal state"]],
];

const trustCards: [string, string][] = [
  [
    "Review first",
    "Tellann cannot write to your working tree without an approved plan.",
  ],
  [
    "Source stays local",
    "Raw source stays on the developer machine by default.",
  ],
  [
    "Secrets stay out of the diff",
    "Displayed instrumentation diffs are redacted before you see them.",
  ],
  [
    "Every change can be reversed",
    "Applied plans include a recorded rollback.",
  ],
];

const planMatrix: [string, string, string][] = [
  ["Free", "Manual", "Tellann shows you what needs to be instrumented. You apply the changes."],
  ["Local", "Manual", "Tellann shows you what needs to be instrumented. You apply the changes."],
  ["Solo", "Basic", "Tellann can apply single-flow instrumentation for you after approval."],
  ["Team", "Advanced", "Multi-flow plans and bootstrap instrumentation."],
  ["Business", "Advanced", "Multi-flow plans and bootstrap instrumentation."],
  ["Enterprise", "Advanced", "Multi-flow plans and bootstrap instrumentation."],
];

const workflowChain: [string, boolean][] = [
  ["Declare flow", false],
  ["Bind workspace", false],
  ["Analyze code", false],
  ["Instrument", true],
  ["Demonstrate", false],
  ["Build behavior graph", false],
  ["Reconcile", false],
  ["Coverage + QA report", false],
];

const related: [string, string, string][] = [
  [
    "/desktop",
    "Tellann Desktop",
    "Bind a workspace and let Tellann analyze the local codebase.",
  ],
  [
    "/product/flow-declaration",
    "Flow Declaration",
    "Define the workflows Tellann should prepare to observe.",
  ],
  [
    "/product/demonstration-mode",
    "Demonstration Mode",
    "Run the instrumented application through a controlled walkthrough.",
  ],
  [
    "/product/reconciliation",
    "Reconciliation",
    "Compare what you intended with what Tellann actually observed.",
  ],
];

const faqs: [string, string][] = [
  [
    "What is automated instrumentation?",
    "Tellann prepares the behavioral instrumentation a declared workflow needs, presents the changes for review, and — when the plan allows — applies them through the desktop agent after approval.",
  ],
  [
    "Does Tellann change my source without asking?",
    "No. An approved instrumentation plan is required before any write to your working tree. There is no path that skips the approval step.",
  ],
  [
    "Can I see what will change first?",
    "Yes. Every proposed change is presented as a reviewable diff, file by file, with secrets redacted before display.",
  ],
  [
    "What if the instrumentation breaks my build?",
    "Tellann validates applied plans. A validation failure attributable to the plan triggers a rollback that restores the branch to its previous state.",
  ],
  [
    "Does my source code get uploaded?",
    "Source analysis runs locally by default. Tellann receives derived projections — checkpoint locations, graph topology, analysis warnings — rather than your raw files. Transmitting raw source requires explicit consent for a named purpose.",
  ],
  [
    "Does AI edit my source code?",
    "No. Tellann may use bounded assistive intelligence elsewhere for drafting or enrichment, but model output is never executed or written directly into a customer system. Instrumentation changes go through the planned, reviewed, approved workflow.",
  ],
  [
    "Can I use my own QA branch?",
    "Yes. Branch policy constrains which branch instrumentation is allowed to land on, and the original branch state can be restored afterwards.",
  ],
  [
    "Can I still use Tellann without automated instrumentation?",
    "Yes. Tellann still produces the instrumentation plan; you apply it manually and continue with the demonstration. Automated instrumentation saves time — it does not gate the workflow.",
  ],
  [
    "Which plans include automated instrumentation?",
    "Solo includes Basic automation for single-flow plans. Team, Business, and Enterprise include Advanced automation for multi-flow and bootstrap plans. Free and Local use manual instrumentation.",
  ],
];

export default function AutomatedInstrumentationPage() {
  const structuredData = [
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: "Tellann Automated Instrumentation",
      description: metadata.description,
      url: `${siteUrl}/product/automated-instrumentation`,
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
        {
          "@type": "ListItem",
          position: 2,
          name: "Product",
          item: `${siteUrl}/product`,
        },
        {
          "@type": "ListItem",
          position: 3,
          name: "Automated Instrumentation",
          item: `${siteUrl}/product/automated-instrumentation`,
        },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "Tellann Desktop",
      applicationCategory: "DeveloperApplication",
      operatingSystem: "Windows, macOS, Linux",
      description:
        "Tellann Desktop binds a local workspace, analyzes the codebase, and applies approved instrumentation plans locally with validation and rollback.",
      url: `${siteUrl}/desktop`,
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
    <main className="instr-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      {/* 02 Hero */}
      <section className="instr-hero pt-20!">
        <div className="instr-shell instr-hero-grid">
          <div className="instr-hero-copy">
            <p className="instr-kicker" data-aos="fade-up">
              Automated instrumentation · Tellann Desktop
            </p>
            <h1 data-aos="fade-up" data-aos-delay="120">
              Instrument your application without giving up control.
            </h1>
            <p data-aos="fade-up" data-aos-delay="180">
              Tellann analyzes your bound workspace, finds the code behind the
              workflows you want to demonstrate, and prepares the instrumentation
              needed to observe them. Review the diff, approve the plan, and let
              Tellann apply, validate, and roll back when necessary.
            </p>
            <div className="instr-actions">
              <Link className="is-primary" href="/desktop/download">
                Start with Tellann Desktop <span>→</span>
              </Link>
              <a href="#lifecycle">
                See how instrumentation works <span>↓</span>
              </a>
            </div>
          </div>
          <div className="instr-hero-visual" data-aos="tellann-panel">
            <InstrumentationPlanHero />
            <p className="instr-media-note">
              Interactive HTML · Displayed 720 × 470 px · Static fallback master
              1600 × 1050 px · Plays once on load, then stops
            </p>
          </div>
        </div>
        <p className="instr-shell instr-hero-line" data-aos="fade-up">
          Nothing changes until you approve it.
        </p>
        <nav className="instr-shell instr-jump" aria-label="On this page">
          {jumpLinks.map(([href, label]) => (
            <a key={href} href={href}>
              {label}
            </a>
          ))}
        </nav>
      </section>

      {/* 04 Tellann proposes. You decide. */}
      <Section
        surface
        id="lifecycle"
        eyebrow="Automation, with review"
        title="Tellann proposes. You decide."
        copy="Automated instrumentation does not give Tellann unrestricted permission to modify your project. The desktop agent creates a scoped plan, shows you the proposed changes, and waits for an authorized member to approve them."
      >
        <ol className="instr-shell instr-lifecycle">
          {lifecycle.map(([name, detail], index) => (
            <li
              key={name}
              data-aos="fade-up"
              data-aos-delay={String(Math.min((index + 1) * 60, 420))}
            >
              <small>{String(index + 1).padStart(2, "0")}</small>
              <b>{name}</b>
              <p>{detail}</p>
            </li>
          ))}
        </ol>
        <p className="instr-shell instr-note">
          <b>The distinction that matters:</b> Tellann automates the repetitive
          part of instrumentation — not the decision to change your code.
        </p>
      </Section>

      {/* 05 Why instrumentation exists */}
      <Section
        eyebrow="Why instrumentation exists"
        title="Tellann needs to know where meaningful behavior happens."
        copy="When someone completes checkout, authenticates, or retries a payment, Tellann needs reliable evidence that the transition actually happened."
      >
        <div className="instr-shell instr-compare" data-aos="tellann-panel">
          <article>
            <span>Raw application</span>
            <ul>
              {["User clicks “Pay”", "Application logic runs", "Order is completed"].map(
                (item) => (
                  <li key={item}>{item}</li>
                ),
              )}
            </ul>
          </article>
          <b aria-hidden="true">→</b>
          <article className="is-primary">
            <span>With behavioral instrumentation</span>
            <ul>
              {[
                "User clicks “Pay”",
                "CHECKOUT_STARTED",
                "PAYMENT_SUBMITTED",
                "ORDER_COMPLETE",
              ].map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
        </div>
        <p className="instr-shell instr-caption">
          Instrumentation gives Tellann reliable behavioral checkpoints it can
          use to build workflows, measure coverage, and reconcile observed
          behavior against intent.
        </p>
      </Section>

      {/* 06 Find the checkpoints */}
      <Section
        surface
        eyebrow="Finding the checkpoints"
        title="Find the right checkpoints without searching the entire codebase."
        copy="The hard part is not adding a tracking call. It is knowing where every meaningful one belongs."
      >
        <div className="instr-shell instr-problems">
          {manualProblems.map(([title, question, answer], index) => (
            <article
              key={title}
              data-aos="fade-up"
              data-aos-delay={String((index + 1) * 60)}
            >
              <b>{title}</b>
              <p className="instr-problem-question">{question}</p>
              <p>{answer}</p>
            </article>
          ))}
        </div>
        <Media
          visual={{
            label:
              "Repository tree mapped to a declared checkout flow / SVG or UI design",
            master: "1600 × 900",
            display: "1200 × 675",
          }}
          note="Master 1600 × 900 px · Display 1200 × 675 px · 1.5–2.2 second connector draw on scroll · Flow nodes trace to Checkout.tsx, payment.ts, and confirmation.ts · Does not loop"
        />
      </Section>

      {/* 07 Review the diff */}
      <section className="instr-section" id="review">
        <div className="instr-shell instr-heading">
          <p className="instr-kicker" data-aos="fade-up">
            Review
          </p>
          <h2 data-aos="fade-up" data-aos-delay="60">
            Review the code before Tellann touches the code.
          </h2>
          <p data-aos="fade-up" data-aos-delay="120">
            Every proposed change is presented as a diff first. Switch between
            the affected files, compare before and after, then approve or reject
            the plan as a whole.
          </p>
        </div>
        <div className="instr-shell-wide instr-review-grid" data-aos="tellann-panel">
          <div className="instr-review-copy">
            <p className="instr-panel-label">What a plan contains</p>
            <dl className="instr-spec-list">
              {[
                ["Scope", "One declared flow, not the whole repository"],
                ["Presentation", "A diff per affected file"],
                ["Redaction", "Secrets removed before display"],
                ["Write access", "None until the plan is approved"],
              ].map(([term, value]) => (
                <div key={term}>
                  <dt>{term}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
            <p className="instr-panel-copy">
              Rejecting a plan costs nothing. The working tree is never touched
              while you are still deciding.
            </p>
          </div>
          <InstrumentationDiffReview />
        </div>
        <p className="instr-shell instr-media-note">
          Interactive HTML · Displayed 900 × 570 px · Static fallback master 1500
          × 950 px · Falls back to one file at a time below 900 px rather than
          shrinking a desktop code viewer
        </p>
      </section>

      {/* 08 Apply, validate, roll back */}
      <Section
        surface
        id="safety"
        eyebrow="Apply · validate · roll back"
        title="Applied does not mean trusted. Tellann validates the result."
        copy="The agent writes the patch set locally, checks the build and tests, and reverses the plan when the failure is attributable to it."
      >
        <div className="instr-shell" data-aos="tellann-panel">
          <InstrumentationValidationDemo />
        </div>
        <Media
          visual={{
            label:
              "Apply, validate, keep or roll back sequence / SVG or UI design",
            master: "1400 × 700",
            display: "1000 × 500",
          }}
          note="Master 1400 × 700 px · Display 1000 × 500 px · Apply 500 ms · Validation 800 ms · Failure 350 ms · Rollback 700 ms · Restore 350 ms"
        />
      </Section>

      {/* Trust statement */}
      <section className="instr-statement">
        <div className="instr-shell">
          <h2 data-aos="fade-up">Automation should be reversible.</h2>
          <p data-aos="fade-up" data-aos-delay="60">
            Every applied Tellann instrumentation plan has a recorded rollback.
          </p>
        </div>
      </section>

      {/* 09 Local-first source handling */}
      <Section
        eyebrow="Your source stays local"
        title="Tellann works with your source code on your machine."
        copy="The desktop agent performs codebase analysis locally. By default Tellann receives derived projections — code topology, checkpoint locations, analysis warnings — not your raw source files."
      >
        <div className="instr-shell instr-boundary" data-aos="tellann-panel">
          <article>
            <span>Your machine</span>
            <ul>
              {[
                "Repository",
                "Code analysis",
                "Instrumentation plan",
                "Apply",
                "Rollback",
              ].map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <small>Raw source stays here by default</small>
          </article>
          <b aria-hidden="true">derived projections →</b>
          <article>
            <span>Tellann cloud</span>
            <ul>
              {[
                "Checkpoint locations",
                "Graph topology",
                "Analysis warnings",
                "Instrumentation results",
              ].map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <small>No raw files without explicit consent</small>
          </article>
        </div>
        <Media
          visual={{
            label: "Local machine and cloud trust boundary / SVG design",
            master: "1400 × 760",
            display: "1100 × 600",
          }}
          note="Master 1400 × 760 px · Display 1100 × 600 px · Repository and desktop agent above the boundary, derived projections crossing it"
        />
        <p className="instr-shell instr-note">
          <b>Your repository is not uploaded just because Tellann needs to
          understand it.</b> If raw source ever does need to be transmitted, that
          requires explicit consent for a named purpose — and the permission does
          not generalize across purposes or sessions.
        </p>
      </Section>

      {/* 10 Branch safety */}
      <Section
        surface
        eyebrow="Branch safety"
        title="Keep instrumentation where it belongs."
        copy="Organizations can control which branch Tellann is allowed to use, and the branch you were on is restored when the run finishes."
      >
        <div className="instr-shell instr-branch" data-aos="tellann-panel">
          <div className="instr-branch-tree">
            <span>main</span>
            <span className="is-child">feature/checkout</span>
            <span className="is-child is-target">
              qa/tellann-instrumentation
              <small>changes applied here</small>
            </span>
          </div>
          <ol className="instr-branch-steps">
            {[
              ["Original branch", "feature/checkout"],
              ["Instrumentation branch", "qa/tellann-instrumentation"],
              ["Run completed", "Evidence captured"],
              ["Original branch restored", "feature/checkout"],
            ].map(([term, value]) => (
              <li key={term}>
                <small>{term}</small>
                <b>{value}</b>
              </li>
            ))}
          </ol>
        </div>
        <Media
          visual={{
            label: "Branch policy and restore-on-completion / SVG design",
            master: "1200 × 600",
            display: "900 × 450",
          }}
          note="Master 1200 × 600 px · Display 900 × 450 px · 500–700 ms branch-restore animation on scroll"
        />
      </Section>

      {/* 11 What gets instrumented + existing detection */}
      <Section
        eyebrow="What gets instrumented"
        title="Behavioral checkpoints, not a rewrite of your application."
        copy="Instrumentation targets the things Tellann later needs as evidence — and nothing else."
      >
        <div className="instr-shell instr-capabilities">
          {capabilities.map(([name, items], index) => (
            <article
              key={name}
              data-aos="fade-up"
              data-aos-delay={String(Math.min((index + 1) * 60, 360))}
            >
              <b>{name}</b>
              <div>
                {items.map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>
            </article>
          ))}
        </div>

        <div className="instr-shell instr-detection" data-aos="tellann-panel">
          <div>
            <h3>No need to instrument what is already instrumented.</h3>
            <p>
              Tellann detects existing instrumentation and installed SDKs before
              it prepares a plan, so a proposal only covers what is actually
              missing.
            </p>
          </div>
          <div className="instr-detection-lists">
            <div>
              <p className="instr-panel-label">Detected</p>
              <ul>
                {[
                  "@tellann/frontend-sdk",
                  "Session capture",
                  "Navigation tracking",
                ].map((item) => (
                  <li key={item}>
                    <i aria-hidden="true">✓</i>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="instr-panel-label">Missing</p>
              <ul className="is-missing">
                {[
                  "CHECKOUT workflow checkpoints",
                  "Payment failure state",
                  "Order completion state",
                ].map((item) => (
                  <li key={item}>
                    <i aria-hidden="true">○</i>
                    {item}
                  </li>
                ))}
              </ul>
              <p className="instr-detection-result">Recommended plan · 6 additions</p>
            </div>
          </div>
        </div>
        <Media
          visual={{
            label: "Existing instrumentation detection / product UI design",
            master: "1400 × 850",
            display: "1000 × 607",
          }}
          note="Master 1400 × 850 px · Display 1000 × 607 px · Detected and missing columns resolving into a recommended plan"
        />
      </Section>

      {/* 12 Benefits by role */}
      <section className="instr-section instr-roles is-surface" id="roles">
        <div className="instr-shell instr-heading">
          <p className="instr-kicker" data-aos="fade-up">
            By role
          </p>
          <h2 data-aos="fade-up" data-aos-delay="60">
            Automated instrumentation for your role.
          </h2>
          <p data-aos="fade-up" data-aos-delay="120">
            The same approval-gated workflow returns different time to different
            people on the team.
          </p>
        </div>
        <div className="instr-shell-wide" data-aos="tellann-panel">
          <InstrumentationAudiences />
        </div>
        <div className="instr-shell instr-admin">
          <div>
            <p className="instr-panel-label">Organization &amp; platform admin</p>
            <b>Decide who can change what — and where.</b>
            <p>
              Approving a plan requires a member-or-above role on a workspace
              that user has bound. Role alone is not sufficient: entitlement,
              device trust, and workspace trust are separate checks.
            </p>
          </div>
          <div className="instr-admin-chips">
            {[
              "Workspace trust",
              "Branch policy",
              "Role controls",
              "Entitlement checks",
              "Device trust",
              "Audit history",
            ].map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        </div>
      </section>

      {/* 13 + 19 Basic vs advanced, and plans */}
      <Section
        id="plans"
        eyebrow="Availability"
        title="Automation that scales with your workspace."
        copy="Automated instrumentation saves time; it does not gate the Tellann workflow. Where it is unavailable, Tellann still produces the plan and you apply it yourself."
      >
        <div className="instr-shell instr-tiers" data-aos="tellann-panel">
          <article>
            <span>Basic · Solo</span>
            <b>Single-flow instrumentation plans</b>
            <ul>
              {[
                "Instrument login",
                "Instrument checkout",
                "Instrument onboarding",
                "One declared workflow at a time",
              ].map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
          <article className="is-primary">
            <span>Advanced · Team, Business, Enterprise</span>
            <b>Multi-flow plans and bootstrap instrumentation</b>
            <ul>
              {[
                "Several declared workflows in one plan",
                "Bootstrap a workspace that has no instrumentation yet",
                "Broader coverage before a release walkthrough",
              ].map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
        </div>

        <div
          className="instr-shell instr-plan-table"
          role="table"
          aria-label="Automated instrumentation by plan"
        >
          <div role="row" className="is-head">
            <span role="columnheader">Plan</span>
            <span role="columnheader">Automation</span>
            <span role="columnheader">What that means</span>
          </div>
          {planMatrix.map(([plan, tier, meaning]) => (
            <div role="row" key={plan} className={tier === "Manual" ? "is-muted" : ""}>
              <span role="rowheader">{plan}</span>
              <span role="cell">{tier}</span>
              <span role="cell">{meaning}</span>
            </div>
          ))}
        </div>
        <div className="instr-shell instr-link-row">
          <Link href="/pricing" className="instr-inline-link">
            Compare Tellann plans <span>→</span>
          </Link>
        </div>
      </Section>

      {/* 14 Instrumentation report */}
      <section className="instr-section is-surface" id="report">
        <div className="instr-shell instr-heading">
          <p className="instr-kicker" data-aos="fade-up">
            Instrumentation report
          </p>
          <h2 data-aos="fade-up" data-aos-delay="60">
            Know exactly what changed.
          </h2>
          <p data-aos="fade-up" data-aos-delay="120">
            Every plan produces a report — including the ones that failed
            validation and were rolled back.
          </p>
        </div>
        <div className="instr-shell instr-report" data-aos="tellann-panel">
          <div className="instr-report-copy">
            <div className="instr-report-cards">
              <article>
                <span>Applied · validated</span>
                <dl>
                  {[
                    ["Plan", "IN-4418"],
                    ["Approved by", "A named member"],
                    ["Files affected", "4"],
                    ["Checkpoints added", "8"],
                    ["Validation", "Passed"],
                    ["Rollback", "Available"],
                  ].map(([term, value]) => (
                    <div key={term}>
                      <dt>{term}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
                </dl>
              </article>
              <article className="is-failed">
                <span>Rolled back</span>
                <dl>
                  {[
                    ["Status", "Rolled back"],
                    ["Reason", "Validation failed"],
                    ["Working tree", "Restored"],
                    ["Rollback", "Completed"],
                  ].map(([term, value]) => (
                    <div key={term}>
                      <dt>{term}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
                </dl>
              </article>
            </div>
            <p className="instr-sample-note">Illustrative figures</p>
          </div>
          <VisualPlaceholder
            label="Instrumentation report / product UI design"
            master="1600 × 1050"
            display="1100 × 720"
          />
        </div>
        <p className="instr-shell instr-media-note">
          Master 1600 × 1050 px · Display 1100 × 720 px · Report rows reveal at
          40–60 ms per item on scroll
        </p>
      </section>

      {/* 15 Video */}
      <Section
        eyebrow="Watch it work"
        title="Automated instrumentation in about a minute."
        copy="Repository, declared flow, plan, diff, approval, apply, validation — and the rollback path when validation fails."
      >
        <Media
          visual={{
            label: "Automated instrumentation explainer / product video",
            master: "1920 × 1080",
            display: "960 × 540",
          }}
          note="Master 1920 × 1080 px (16:9) · Desktop display 960 × 540 px · 60–75 seconds · Poster frame 1600 × 900 px · WebM with MP4 H.264 fallback · Does not autoplay; the hero animation carries the page on load"
        />
      </Section>

      {/* 16 How it fits */}
      <Section
        surface
        eyebrow="Where this sits"
        title="Instrumentation is the bridge between intent and evidence."
        copy="It is one step in the Tellann lifecycle — the one that makes the next step possible."
      >
        <ol className="instr-shell instr-chain" data-aos="tellann-panel">
          {workflowChain.map(([step, here]) => (
            <li key={step} className={here ? "is-here" : ""}>
              <b>{step}</b>
              {here ? <small>You are here</small> : null}
            </li>
          ))}
        </ol>
      </Section>

      {/* 17 Trust */}
      <Section
        eyebrow="Trust"
        title="Four things that stay true of every plan."
      >
        <div className="instr-shell instr-trust">
          {trustCards.map(([title, copy], index) => (
            <article
              key={title}
              data-aos="fade-up"
              data-aos-delay={String((index + 1) * 60)}
            >
              <b>{title}</b>
              <p>{copy}</p>
            </article>
          ))}
        </div>
        <p className="instr-shell instr-note">
          <b>On AI:</b> Tellann may use bounded assistive intelligence elsewhere
          for drafting or enrichment, but model output is never executed or
          written directly into a customer system. Instrumentation changes pass
          through the planned, reviewed, approved workflow — the same one shown
          on this page.
        </p>
      </Section>

      {/* 18 Related features */}
      <Section
        surface
        eyebrow="Related"
        title="What sits either side of instrumentation."
      >
        <div className="instr-shell instr-related">
          {related.map(([href, title, copy], index) => (
            <Link
              key={href}
              href={href}
              data-aos="fade-up"
              data-aos-delay={String((index + 1) * 60)}
            >
              <b>{title}</b>
              <p>{copy}</p>
              <i aria-hidden="true">→</i>
            </Link>
          ))}
        </div>
      </Section>

      {/* 20 FAQ */}
      <section className="instr-section instr-faq" id="faq">
        <div className="instr-shell instr-faq-grid">
          <div>
            <p className="instr-kicker" data-aos="fade-up">
              FAQ
            </p>
            <h2 data-aos="fade-up" data-aos-delay="60">
              Frequently asked questions.
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

      {/* 21 Final CTA */}
      <section className="instr-final">
        <div className="instr-shell">
          <p className="instr-kicker" data-aos="fade-up">
            Automation you can inspect, approve, and reverse
          </p>
          <h2 data-aos="fade-up" data-aos-delay="60">
            Spend less time wiring behavior. Keep control of every change.
          </h2>
          <p data-aos="fade-up" data-aos-delay="120">
            Let Tellann prepare and apply the instrumentation your workflows
            need — after you review and approve it.
          </p>
          <div className="instr-actions">
            <Link className="is-primary" href="/desktop/download">
              Start with Tellann Desktop <span>→</span>
            </Link>
            <Link href="/pricing">
              Compare plans <span>→</span>
            </Link>
          </div>
          <small>Automated instrumentation starts on Solo.</small>
        </div>
      </section>
    </main>
  );
}
