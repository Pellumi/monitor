import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { CheckoutExampleToggle } from "@/components/checkout-example-toggle";
import { ProductPlaceholder } from "@/components/product-tour";
import { ReconciliationAudiences } from "@/components/reconciliation-audiences";
import { ReconciliationWorkflowExplorer } from "@/components/reconciliation-workflow-explorer";
import { UndeclaredReview } from "@/components/undeclared-review";
import "./reconciliation.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://domain-name.com";
const dashboardUrl =
  process.env.NEXT_PUBLIC_APP_URL || "https://app.domain-name.com";

export const metadata: Metadata = {
  // Absolute, so the layout's "%s | Tellann" template doesn't append a second suffix.
  title: {
    absolute:
      "Software Workflow Reconciliation — Compare Expected vs Actual Behavior | Tellann",
  },
  description:
    "Compare intended software workflows with observed application behavior. Tellann shows what was confirmed, what expected behavior was never reached, and what happened that nobody declared.",
  alternates: { canonical: "/product/reconciliation" },
  openGraph: {
    title:
      "Software Workflow Reconciliation — Compare Expected vs Actual Behavior | Tellann",
    description:
      "Compare what your software should do with what it actually did.",
    url: `${siteUrl}/product/reconciliation`,
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
  narrow = false,
  children,
}: {
  eyebrow: string;
  title: string;
  copy?: string;
  id?: string;
  surface?: boolean;
  narrow?: boolean;
  children: ReactNode;
}) {
  return (
    <section className={`recon-section${surface ? " is-surface" : ""}`} id={id}>
      <div
        className={`recon-shell recon-heading${narrow ? " is-narrow" : ""}`}
      >
        <p className="recon-kicker" data-aos="fade-up">
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

/** Media centred under the heading, with its dimension note beneath. */
function Media({ visual, note }: { visual: Visual; note: string }) {
  return (
    <div className="recon-media">
      <VisualPlaceholder {...visual} />
      <p>{note}</p>
    </div>
  );
}

const jumpLinks: [string, string][] = [
  ["#outcomes", "Three outcomes"],
  ["#how", "How it works"],
  ["#roles", "By role"],
  ["#explorer", "Explorer"],
  ["#report", "Report"],
  ["#faq", "FAQ"],
];

const outcomes: [string, string, string, string, string][] = [
  [
    "✓",
    "Confirmed",
    "Payment success",
    "Payment success",
    "Your expectation is backed by behavioral evidence.",
  ],
  [
    "○",
    "True gap",
    "Payment failure",
    "—",
    "An expected part of the workflow was never reached.",
  ],
  [
    "+",
    "Undeclared",
    "—",
    "Promo rejected",
    "The application did something that was not part of the declared flow.",
  ],
];

const steps: [string, string][] = [
  ["Define", "Describe the workflow that matters — Checkout, success, payment failure, retry."],
  ["Demonstrate", "Use your application normally through Tellann's demonstration environment."],
  ["Observe", "Tellann builds the behavior it actually witnessed."],
  ["Reconcile", "Tellann compares both and shows confirmed behavior, true gaps, and undeclared behavior."],
];

const secondaryAudiences: [string, string][] = [
  [
    "Startup teams",
    "Get stronger QA visibility without building a large QA operation.",
  ],
  [
    "SaaS teams",
    "Keep changing workflows aligned with the behavior your team expects.",
  ],
  [
    "Enterprise teams",
    "Review intended and demonstrated behavior across complex applications.",
  ],
];

const reportAudiences: [string, string][] = [
  ["Developer", "Which expected states never appeared?"],
  ["QA engineer", "Which scenarios still need evidence?"],
  ["Engineering lead", "Which important flows remain unresolved?"],
  ["Product manager", "Which observed behaviors weren't part of intent?"],
];

const comparison: [string, string, string][] = [
  [
    "Workflow discovery",
    "What workflows did Tellann observe?",
    "/product/workflow-discovery",
  ],
  ["Coverage", "How much behavior was exercised?", "/product/coverage"],
  [
    "Missing states",
    "Which conditions may deserve testing?",
    "/product/missing-states",
  ],
  ["Missing flows", "Which paths may deserve testing?", "/product/missing-flows"],
  [
    "Reconciliation",
    "Did observed behavior match what the team explicitly expected?",
    "",
  ],
];

const useCases: [string, string, string[]][] = [
  [
    "Before release",
    "Check whether the critical behavior your team expected was actually exercised during QA.",
    ["Declared 14", "Confirmed 11", "Unresolved 3"],
  ],
  [
    "A new workflow",
    "Declare a new Checkout or Registration path, demonstrate it, and immediately see what remains unconfirmed.",
    ["Declare", "Demonstrate", "Reconcile"],
  ],
  [
    "Unexpected behavior",
    "Surface application behavior that appeared during a walkthrough but was never part of the expected flow.",
    ["Observed", "Not declared", "Review"],
  ],
  [
    "Changing requirements",
    "Update intended behavior when requirements change, then measure future demonstrations against the new baseline.",
    ["Checkout v3", "Checkout v4", "New baseline"],
  ],
];

const faqs: [string, string][] = [
  [
    "What is software workflow reconciliation?",
    "It is a comparison between the application behavior a team expects and the behavior that was actually observed. Tellann returns one of three answers for every behavior: confirmed, a true gap, or undeclared.",
  ],
  [
    "How does Tellann know what my application should do?",
    "Through Flow Declaration, where your team describes the workflows the application is intended to support. It is optional, and you only declare the workflows that matter.",
  ],
  [
    "What is a true gap?",
    "Behavior your team explicitly expected that was not observed in the selected demonstration.",
  ],
  [
    "What is undeclared behavior?",
    "Behavior Tellann observed that was not part of your declared workflow.",
  ],
  [
    "Does undeclared mean there is a bug?",
    "No. It may be an incomplete declaration, legitimate behavior nobody wrote down, or something unintended. It is surfaced for review rather than treated as an error.",
  ],
  [
    "How is reconciliation different from coverage?",
    "Coverage measures how much behavior was exercised. Reconciliation compares that behavior against what your team explicitly expected.",
  ],
  [
    "How is it different from missing-state detection?",
    "Missing-state detection infers a condition that may be worth testing. A true gap comes from a human declaring that the behavior should be reachable — a stronger signal.",
  ],
  [
    "Do I need to declare every application workflow?",
    "No. Declare the workflows worth validating; the rest of Tellann keeps working on observed behavior alone.",
  ],
  [
    "Does Tellann automatically change my declared flow?",
    "No. Observed behavior can be promoted into intent, but only with explicit human confirmation.",
  ],
  [
    "Does reconciliation use AI to decide whether behavior is correct?",
    "No. Reconciliation is computed from your declared intent and recorded evidence. Assistive intelligence is limited to helping teams draft intent.",
  ],
  [
    "Can I see the evidence behind a result?",
    "Yes. Every result stays connected to the behavior graph, the run that produced it, and the sessions behind it.",
  ],
  [
    "Does Tellann reconcile production traffic today?",
    "Not yet. Today reconciliation compares declared intent against demonstration evidence; production-aware comparison is a planned phase.",
  ],
];

export default function ReconciliationPage() {
  const structuredData = [
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: "Tellann Software Workflow Reconciliation",
      description: metadata.description,
      url: `${siteUrl}/product/reconciliation`,
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
    <main className="recon-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      {/* 02 Hero */}
      <section className="recon-hero pt-20!">
        <div className="recon-shell recon-hero-copy">
          <p className="recon-kicker" data-aos="fade-up">
            Workflow reconciliation
          </p>
          <h1 data-aos="fade-up" data-aos-delay="60">
            Compare what your software should do with what it actually did.
          </h1>
          <p data-aos="fade-up" data-aos-delay="120">
            Tellann compares the workflows your team expects with the behavior
            captured during a demonstration — showing what was confirmed, what
            was never reached, and what happened that nobody declared.
          </p>
          <div className="recon-actions">
            <a className="is-primary" href="#explorer">
              See reconciliation in action <span>↓</span>
            </a>
            <Link href="/product/flow-declaration">
              Explore Flow Declaration <span>→</span>
            </Link>
            <Link href="/product/how-it-works" className="is-quiet">
              How Tellann works <span>→</span>
            </Link>
          </div>
        </div>

        <div
          className="recon-shell-wide recon-hero-media recon-desktop-media"
          data-aos="tellann-panel"
        >
          <VisualPlaceholder
            label="Expected workflow, observed workflow, and the reconciled result / interactive SVG or canvas design"
            master="1920 × 1120"
            display="1320 × 740"
          />
          <p>
            Master 1920 × 1120 px · Desktop display 1320 × 740 px · 9–11 second
            build, then interactive · Expected draws, observed appears, matching
            states connect, then 2 Confirmed · 2 True gaps · 1 Undeclared
            resolves · Does not loop
          </p>
        </div>
        <div className="recon-mobile-media">
          <VisualPlaceholder
            label="Mobile hero / expected, observed and result stacked vertically"
            master="1080 × 1440"
            display="1080 × 1440"
          />
          <p>
            Mobile master 1080 × 1440 px (3:4) · Displayed responsively ·
            Expected above observed, result summary underneath
          </p>
        </div>

        <nav className="recon-shell recon-jump" aria-label="On this page">
          {jumpLinks.map(([href, label]) => (
            <a key={href} href={href}>
              {label}
            </a>
          ))}
        </nav>
      </section>

      {/* 03 The problem */}
      <Section
        surface
        eyebrow="The problem"
        title="Teams know what software is supposed to do. That is not always what it actually does."
        copy="Requirements describe expected behavior. QA plans describe the scenarios that matter. Developers implement those flows. Until the application is exercised, there is still a gap between intention and evidence."
      >
        <div className="recon-shell recon-problem" data-aos="tellann-panel">
          <article>
            <span>Expected</span>
            <ul>
              {[
                "Add to cart",
                "Pay",
                "Handle payment failure",
                "Retry",
              ].map((item) => (
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
                ["✓", "Added to cart"],
                ["✓", "Paid successfully"],
                ["?", "Payment failure never occurred"],
                ["?", "Retry never occurred"],
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
            label: "Expected workflow and observed workflow meeting at a comparison / animated SVG design",
            master: "1600 × 800",
            display: "1000 × 500",
          }}
          note="Master 1600 × 800 px · Display 1000 × 500 px · 4–5 seconds · Expected slides in from the left, observed from the right, the result resolves in the centre"
        />
      </Section>

      {/* 04-05 Three outcomes */}
      <Section
        id="outcomes"
        eyebrow="Three outcomes"
        title="Tellann gives you one answer for every expected and observed behavior."
        copy="No scores to interpret and no judgement about whether your software is correct. Just three plain answers."
      >
        <div className="recon-shell recon-outcome-cards">
          {outcomes.map(([glyph, name, expected, observed, copy], index) => (
            <article
              key={name}
              data-aos="fade-up"
              data-aos-delay={String((index + 1) * 60)}
            >
              <span>
                <i aria-hidden="true">{glyph}</i>
                {name}
              </span>
              <dl>
                <div>
                  <dt>Expected</dt>
                  <dd>{expected}</dd>
                </div>
                <div>
                  <dt>Observed</dt>
                  <dd>{observed}</dd>
                </div>
              </dl>
              <p>{copy}</p>
            </article>
          ))}
        </div>
        <p className="recon-shell recon-note">
          <b>In plain terms:</b> a <b>true gap</b> is expected behavior that was
          never observed. <b>Undeclared</b> is behavior Tellann observed that was
          not part of your declared flow.
        </p>
      </Section>

      {/* 06 How it works */}
      <Section
        surface
        id="how"
        eyebrow="How it works"
        title="From intention to evidence in four steps."
      >
        <ol className="recon-shell recon-steps">
          {steps.map(([name, copy], index) => (
            <li
              key={name}
              data-aos="fade-up"
              data-aos-delay={String((index + 1) * 60)}
            >
              <small>{String(index + 1).padStart(2, "0")}</small>
              <b>{name}</b>
              <p>{copy}</p>
            </li>
          ))}
        </ol>
        <Media
          visual={{
            label: "Declare, demonstrate, observe, reconcile / animated SVG design",
            master: "1800 × 700",
            display: "1100 × 428",
          }}
          note="Master 1800 × 700 px · Display 1100 × 428 px · One continuous horizontal sequence on desktop, stacked vertically on mobile"
        />
      </Section>

      {/* 07 Benefits by role */}
      <section className="recon-section recon-roles" id="roles">
        <div className="recon-shell recon-heading">
          <p className="recon-kicker" data-aos="fade-up">
            Benefits by role
          </p>
          <h2 data-aos="fade-up" data-aos-delay="60">
            One comparison. Different answers for every team.
          </h2>
          <p data-aos="fade-up" data-aos-delay="120">
            The same reconciliation result answers a different question
            depending on who is reading it.
          </p>
        </div>
        <div className="recon-shell-wide" data-aos="tellann-panel">
          <ReconciliationAudiences />
        </div>
        <div className="recon-shell recon-secondary">
          {secondaryAudiences.map(([name, copy]) => (
            <article key={name}>
              <b>{name}</b>
              <p>{copy}</p>
            </article>
          ))}
        </div>
      </section>

      {/* 08 Checkout example */}
      <Section
        surface
        id="example"
        eyebrow="A realistic example"
        title="See reconciliation through one Checkout workflow."
        copy="Switch between what the team expected, what the demonstration produced, and the comparison between them."
      >
        <div className="recon-shell-wide" data-aos="tellann-panel">
          <CheckoutExampleToggle />
          <p className="recon-media-note">
            Master 1800 × 1000 px · Display 1100 × 611 px · 8 second build, then
            the toggle takes over
          </p>
        </div>
      </Section>

      {/* 09 Interactive explorer */}
      <section className="recon-section" id="explorer">
        <div className="recon-shell recon-heading">
          <p className="recon-kicker" data-aos="fade-up">
            Reconciliation explorer
          </p>
          <h2 data-aos="fade-up" data-aos-delay="60">
            Go from summary to the exact behavior that needs attention.
          </h2>
          <p data-aos="fade-up" data-aos-delay="120">
            Filter by outcome, open a behavior, and read why it landed where it
            did. Product terminology stays tucked behind a details toggle.
          </p>
        </div>
        <div className="recon-shell-wide" data-aos="tellann-panel">
          <ReconciliationWorkflowExplorer />
        </div>
        <p className="recon-shell recon-media-note">
          Explorer 1280 × 800 px inside a 1400 px container · Inner graph canvas
          placeholder 920 × 520 px · Every outcome is available as a list, and
          carried by glyph and label rather than colour alone
        </p>
      </section>

      {/* 10 True gaps */}
      <Section
        surface
        id="true-gaps"
        eyebrow="True gaps"
        title="Know when “we didn't see it” becomes “we expected this and never saw it.”"
        copy="This is the difference between a suggestion worth considering and an expectation with no evidence behind it."
      >
        <div className="recon-shell recon-gap-compare" data-aos="tellann-panel">
          <article>
            <span>Potential gap</span>
            <b>Payment failure</b>
            <p>Suggested by Tellann from the structure around observed behavior.</p>
            <small>Worth considering</small>
          </article>
          <article className="is-primary">
            <span>True gap</span>
            <b>Payment failure</b>
            <p>Declared by your team, and never observed in the selected run.</p>
            <small>Expected, still unproven</small>
          </article>
        </div>
        <Media
          visual={{
            label: "Potential gap beside true gap / SVG design",
            master: "1600 × 700",
            display: "1000 × 438",
          }}
          note="Master 1600 × 700 px · Display 1000 × 438 px · Two cards resolving side by side"
        />
        <div className="recon-shell recon-link-row">
          <Link href="/product/missing-states" className="recon-inline-link">
            Find missing application states <span>→</span>
          </Link>
          <Link href="/product/missing-flows" className="recon-inline-link">
            Find missing workflow paths <span>→</span>
          </Link>
        </div>
      </Section>

      {/* 11 Undeclared behavior */}
      <section className="recon-section" id="undeclared">
        <div className="recon-shell recon-heading">
          <p className="recon-kicker" data-aos="fade-up">
            Undeclared behavior
          </p>
          <h2 data-aos="fade-up" data-aos-delay="60">
            Discover behavior your team never specified.
          </h2>
          <p data-aos="fade-up" data-aos-delay="120">
            Undeclared does not automatically mean wrong. It tells your team
            there is behavior worth reviewing.
          </p>
        </div>
        <div className="recon-shell recon-split" data-aos="tellann-panel">
          <VisualPlaceholder
            label="Undeclared behavior review / product UI design"
            master="1400 × 800"
            display="800 × 457"
          />
          <UndeclaredReview />
        </div>
        <p className="recon-shell recon-media-note">
          Master 1400 × 800 px · Display 800 × 457 px · The review prompt beside
          it is live — nothing changes until someone answers it
        </p>
      </section>

      {/* 12 Evidence */}
      <Section
        surface
        id="evidence"
        eyebrow="Evidence"
        title="Reconciliation doesn't stop at a label."
        copy="Every result stays connected to the behavior that produced it, so a finding can be inspected rather than trusted."
      >
        <div className="recon-shell recon-trace" data-aos="tellann-panel">
          {[
            "True gap · Payment failure",
            "Declared Checkout flow",
            "Observed Checkout run",
            "Behavior graph",
            "Related sessions",
            "Session replay",
          ].map((step, index, list) => (
            <span key={step}>
              <b>{step}</b>
              {index < list.length - 1 ? <i aria-hidden="true">→</i> : null}
            </span>
          ))}
        </div>
        <Media
          visual={{
            label: "Finding traced back to its session evidence / product video",
            master: "1920 × 1200",
            display: "1000 × 625",
          }}
          note="Master 1920 × 1200 px · Display 1000 × 625 px · 8–10 seconds · Open reconciliation, select a true gap, open the observed run, session timeline, behavior graph, back to the finding · Poster frame, explicit play"
        />
        <div className="recon-shell recon-link-row">
          <Link href="/product/session-replay" className="recon-inline-link">
            Inspect sessions with Session Replay <span>→</span>
          </Link>
          <Link href="/product/behavior-graphs" className="recon-inline-link">
            Explore behavior graphs <span>→</span>
          </Link>
        </div>
      </Section>

      {/* 13 Demonstration mode */}
      <Section
        eyebrow="Demonstration mode"
        title="One demonstration can turn intent into evidence."
        copy="Declare the workflow, walk through it once, and the comparison is waiting when the run finishes."
      >
        <div className="recon-shell recon-trace is-vertical" data-aos="tellann-panel">
          {[
            "Declare Checkout",
            "Start guided demonstration",
            "Use Checkout",
            "Tellann builds observed behavior",
            "Reconcile",
          ].map((step, index, list) => (
            <span key={step}>
              <b>{step}</b>
              {index < list.length - 1 ? <i aria-hidden="true">→</i> : null}
            </span>
          ))}
        </div>
        <Media
          visual={{
            label: "Declared flow to guided demonstration to reconciliation / product video",
            master: "1920 × 1200",
            display: "1100 × 688",
          }}
          note="Master 1920 × 1200 px · Display 1100 × 688 px · 12–15 seconds · Open the declared Checkout flow, demonstrate, stop, then confirmed, true gaps, and undeclared appear · Poster frame shows the final reconciliation state"
        />
        <div className="recon-shell recon-link-row">
          <Link
            href="/product/demonstration-mode"
            className="recon-inline-link"
          >
            See how Developer Demonstration Mode works <span>→</span>
          </Link>
        </div>
      </Section>

      {/* 14 Multiple runs */}
      <Section
        surface
        eyebrow="Multiple runs"
        title="Run it again. Reconciliation updates as the evidence grows."
        copy="Each new demonstration can turn previously unresolved intent into evidence."
      >
        <div className="recon-shell recon-runs" data-aos="tellann-panel">
          <article>
            <span>Run 1</span>
            <dl>
              {[
                ["Confirmed", "8"],
                ["True gaps", "5"],
                ["Undeclared", "1"],
              ].map(([term, value]) => (
                <div key={term}>
                  <dt>{term}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </article>
          <b aria-hidden="true">→</b>
          <article className="is-primary">
            <span>Run 2 · demonstrate payment failure</span>
            <dl>
              {[
                ["Confirmed", "10"],
                ["True gaps", "3"],
                ["Undeclared", "1"],
              ].map(([term, value]) => (
                <div key={term}>
                  <dt>{term}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </article>
        </div>
        <Media
          visual={{
            label: "Run 1 to run 2 with newly confirmed nodes becoming solid / animated SVG design",
            master: "1600 × 900",
            display: "1000 × 562",
          }}
          note="Master 1600 × 900 px · Display 1000 × 562 px · 6–7 seconds · Before and after, with newly confirmed nodes turning solid"
        />
      </Section>

      {/* 15 Report */}
      <section className="recon-section" id="report">
        <div className="recon-shell recon-heading">
          <p className="recon-kicker" data-aos="fade-up">
            Flow reconciliation report
          </p>
          <h2 data-aos="fade-up" data-aos-delay="60">
            Share the result without making everyone open the graph.
          </h2>
          <p data-aos="fade-up" data-aos-delay="120">
            One artifact that answers a different question for each person who
            opens it.
          </p>
        </div>
        <div className="recon-shell recon-report" data-aos="tellann-panel">
          <div className="recon-report-copy">
            <div className="recon-stat-grid">
              {[
                ["Declared states", "14"],
                ["Observed states", "12"],
                ["Confirmed", "11"],
                ["True gaps", "3"],
                ["Undeclared", "2"],
                ["Workflow", "Checkout"],
              ].map(([term, value]) => (
                <span key={term}>
                  <small>{term}</small>
                  <b>{value}</b>
                </span>
              ))}
            </div>
            <dl className="recon-report-audiences">
              {reportAudiences.map(([role, question]) => (
                <div key={role}>
                  <dt>{role}</dt>
                  <dd>{question}</dd>
                </div>
              ))}
            </dl>
            <p className="recon-sample-note">Illustrative figures</p>
            <Link href="/product/qa-reports" className="recon-inline-link">
              Generate behavioral QA reports <span>→</span>
            </Link>
          </div>
          <VisualPlaceholder
            label="Flow reconciliation report / portrait report UI design"
            master="1000 × 1280"
            display="600 × 768"
          />
        </div>
      </section>

      {/* 16 Human control + AI positioning */}
      <Section
        surface
        eyebrow="Human control"
        title="Tellann compares intent. It doesn't rewrite it."
        copy="A conflict between what you declared and what was observed is surfaced for review. It never silently changes your declaration."
      >
        <div className="recon-shell recon-control" data-aos="tellann-panel">
          {[
            ["Observed behavior", "may reveal something new."],
            ["Tellann asks", "“Is this expected?”"],
            ["You decide", "Add it, or leave it undeclared."],
          ].map(([term, copy], index) => (
            <span key={term}>
              <small>{String(index + 1).padStart(2, "0")}</small>
              <b>{term}</b>
              <i>{copy}</i>
            </span>
          ))}
        </div>
        <Media
          visual={{
            label: "Observed behavior, prompt, human decision / SVG design",
            master: "1400 × 700",
            display: "900 × 450",
          }}
          note="Master 1400 × 700 px · Display 900 × 450 px · Three steps resolving downward"
        />
        <p className="recon-shell recon-note">
          <b>On AI:</b> reconciliation is based on behavioral evidence — not a
          model guessing whether your software is correct. Assistive
          intelligence can help a team draft intent; graphs, coverage,
          reconciliation, and findings are computed from recorded evidence.
        </p>
      </Section>

      {/* 17 Optionality */}
      <Section
        eyebrow="Optional by design"
        title="Don't want to declare flows first? Tellann can still observe your application."
        copy="Reconciliation needs declared intent. The rest of the platform does not."
      >
        <div className="recon-shell recon-paths" data-aos="tellann-panel">
          <article>
            <span>With declaration</span>
            <b>Intent + observation = reconciliation</b>
            <ul>
              {["Confirmed behavior", "True gaps", "Undeclared behavior"].map(
                (item) => (
                  <li key={item}>{item}</li>
                ),
              )}
            </ul>
          </article>
          <article>
            <span>Without declaration</span>
            <b>Observation on its own</b>
            <ul>
              {[
                "Behavior graph",
                "Coverage",
                "Missing states",
                "Missing flows",
              ].map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
        </div>
        <Media
          visual={{
            label: "Declared path beside observation-only path / SVG design",
            master: "1600 × 800",
            display: "1000 × 500",
          }}
          note="Master 1600 × 800 px · Display 1000 × 500 px · Two parallel routes through the same platform"
        />
        <div className="recon-shell recon-link-row">
          <Link
            href="/product/workflow-discovery"
            className="recon-inline-link"
          >
            Turn interactions into discovered workflows <span>→</span>
          </Link>
        </div>
      </Section>

      {/* 18 Compared with other analysis */}
      <Section
        surface
        eyebrow="Compared with"
        title="Reconciliation answers a different question from Tellann's other analysis."
      >
        <div
          className="recon-shell recon-compare-table"
          data-aos="tellann-panel"
          role="table"
          aria-label="What each Tellann capability answers"
        >
          <div role="row" className="is-head">
            <span role="columnheader">Capability</span>
            <span role="columnheader">Question it answers</span>
          </div>
          {comparison.map(([name, question, href]) => (
            <div role="row" key={name} className={href ? "" : "is-primary"}>
              <span role="cell">
                {href ? <Link href={href}>{name}</Link> : name}
              </span>
              <span role="cell">{question}</span>
            </div>
          ))}
        </div>
      </Section>

      {/* 19 Use cases */}
      <Section
        eyebrow="Use cases"
        title="Where reconciliation becomes useful."
      >
        <div className="recon-shell recon-use-cases">
          {useCases.map(([name, copy, chips], index) => (
            <article
              key={name}
              data-aos="fade-up"
              data-aos-delay={String((index + 1) * 60)}
            >
              <b>{name}</b>
              <p>{copy}</p>
              <div>
                {chips.map((chip) => (
                  <span key={chip}>{chip}</span>
                ))}
              </div>
            </article>
          ))}
        </div>
      </Section>

      {/* 20 Phase evolution */}
      <Section
        surface
        eyebrow="What comes next"
        title="Today, intent meets demonstration. The same model extends further."
        copy="Declared, demonstrated, and production behavior are kept as separate models, so a future comparison never has to overwrite an existing one."
      >
        <div className="recon-shell recon-phases" data-aos="tellann-panel">
          <article>
            <span>Available now</span>
            <b>Declared vs demonstrated</b>
          </article>
          <article className="is-planned">
            <span>Planned · Phase 2</span>
            <b>Declared vs demonstrated vs production</b>
          </article>
        </div>
        <Media
          visual={{
            label: "Phase 1 and planned phase 2 comparison model / SVG design",
            master: "1600 × 700",
            display: "1000 × 438",
          }}
          note="Master 1600 × 700 px · Display 1000 × 438 px · Two-column model diagram, planned column clearly labelled"
        />
      </Section>

      {/* 21 FAQ */}
      <section className="recon-section recon-faq" id="faq">
        <div className="recon-shell recon-faq-grid">
          <div>
            <p className="recon-kicker" data-aos="fade-up">
              FAQ
            </p>
            <h2 data-aos="fade-up" data-aos-delay="60">
              Questions about expected vs actual behavior.
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

      {/* 22 Final CTA */}
      <section className="recon-final">
        <div className="recon-shell">
          <p className="recon-kicker" data-aos="fade-up">
            Intent, meet evidence
          </p>
          <h2 data-aos="fade-up" data-aos-delay="60">
            See whether the software did what your team said it should.
          </h2>
          <p data-aos="fade-up" data-aos-delay="120">
            Define an important workflow, demonstrate it once, and let Tellann
            show what was confirmed, what expected behavior was never reached,
            and what happened that nobody declared.
          </p>
          <div className="recon-actions">
            <a className="is-primary" href={dashboardUrl}>
              Start free <span>↗</span>
            </a>
            <Link href="/product/flow-declaration">
              Explore Flow Declaration <span>→</span>
            </Link>
            <Link href="/product/demonstration-mode" className="is-quiet">
              See Demonstration Mode <span>→</span>
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
