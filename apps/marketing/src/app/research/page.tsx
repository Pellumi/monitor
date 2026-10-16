import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { docsLinks } from "@/config/site-routes";
import { ProductPlaceholder } from "@/components/product-tour";
import { ResearchAudienceTabs } from "@/components/research-audience-tabs";
import { ResearchExplainer } from "@/components/research-explainer";
import { ResearchNewsletterForm } from "@/components/research-newsletter-form";
import "../solutions/developers/developers.css";
import "./research.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://domain-name.com";
const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.domain-name.com";

export const metadata: Metadata = {
  title: "Tellann Research | Software Behavior, QA & Workflow Intelligence",
  description:
    "Explore Tellann's research directions, methods, and publications on software behavior, workflow coverage, testing evidence, and software-quality intelligence.",
  alternates: { canonical: "/research" },
  openGraph: {
    title: "Tellann Research | Software Behavior, QA & Workflow Intelligence",
    description:
      "What can we actually demonstrate about software behavior, and what does that evidence mean for the teams building it?",
    url: `${siteUrl}/research`,
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

const jumpLinks: [string, string][] = [
  ["#questions", "Questions"],
  ["#featured", "Featured"],
  ["#themes", "Themes"],
  ["#audience", "By role"],
  ["#methods", "Methods"],
  ["#explainer", "Explainer"],
  ["#publications", "Publications"],
  ["#benchmarks", "Benchmarks"],
  ["#practice", "In practice"],
  ["#open-questions", "Open questions"],
  ["#integrity", "Integrity"],
  ["#collaborate", "Collaborate"],
];

const keyQuestions: [string, string, string][] = [
  ["01", "What was intended?", "How can expected workflows and important states be described clearly enough to evaluate?"],
  ["02", "What was observed?", "How can executed behaviors be captured as meaningful evidence?"],
  ["03", "What is still unknown?", "How should teams distinguish unobserved behavior from confirmed defects?"],
  ["04", "What can we conclude?", "Which findings are supported by evidence, and which need more investigation?"],
];

type Theme = {
  slug: string;
  title: string;
  copy: string;
  audiences: string;
};

const themes: Theme[] = [
  {
    slug: "behavioral-modeling",
    title: "Behavioral Modeling",
    copy: "Understanding applications as states, transitions, workflows, and paths instead of treating isolated events as complete behavior.",
    audiences: "Developers · QA engineers · Researchers",
  },
  {
    slug: "intent-and-observation",
    title: "Intent and Observation",
    copy: "Studying how expected behavior can be compared with actual execution evidence without overstating what the comparison proves.",
    audiences: "Developers · Product managers · QA",
  },
  {
    slug: "workflow-coverage",
    title: "Workflow Coverage",
    copy: "Investigating which workflows have been demonstrated, how gaps are classified, and what coverage percentages leave unexplained.",
    audiences: "QA engineers · Engineering managers",
  },
  {
    slug: "evidence-and-reproducibility",
    title: "Evidence and Reproducibility",
    copy: "Examining the trustworthiness of captured runs, state identification, traceability, and repeatable evaluations.",
    audiences: "Developers · Researchers · QA",
  },
  {
    slug: "quality-and-decision-making",
    title: "Quality and Decision-Making",
    copy: "Exploring how software-quality evidence should be interpreted by engineering leaders and product teams.",
    audiences: "Engineering managers · Product teams · Founders",
  },
  {
    slug: "privacy-aware-instrumentation",
    title: "Privacy-Aware Instrumentation",
    copy: "Investigating how useful behavioral evidence can be captured while minimizing sensitive-data exposure and retaining developer control.",
    audiences: "Developers · Security teams · Engineering leaders",
  },
];

const methodology: [string, string][] = [
  ["Define the research question", "Specify the behavior, testing technique, or quality signal being investigated."],
  ["Establish a baseline", "Identify the applications, workflows, requirements, or conventional measurements used for comparison."],
  ["Design a reproducible experiment", "Document the test environment, datasets, instrumentation, and evaluation procedures."],
  ["Collect and validate evidence", "Capture relevant observations, inspect data quality, and identify excluded or inconclusive results."],
  ["Analyze findings", "Explain measured differences, uncertainty, threats to validity, and what cannot be concluded."],
  ["Publish methods and limitations", "Release sufficient methodological details to help readers evaluate the work."],
];

type Publication = {
  kicker: string;
  status: string;
  title: string;
  copy: string;
  topics: string;
};

const publications: Publication[] = [
  {
    kicker: "Methodology · Research direction",
    status: "Proposed",
    title: "Evaluating workflow coverage using declared and observed state graphs",
    copy: "A proposed method for comparing intended paths with demonstrated transitions and describing evidence gaps without conflating them with confirmed faults.",
    topics: "Behavioral Modeling · Workflow Coverage",
  },
  {
    kicker: "Working paper · Research direction",
    status: "Proposed",
    title: "What does it mean for an application state to be reliably identified?",
    copy: "A proposed investigation into how consistently a method can distinguish meaningful application states across repeated demonstrations.",
    topics: "Evidence and Reproducibility",
  },
];

const benchmarkThemes: [string, string][] = [
  ["State identification quality", "How consistently does a method distinguish meaningful application states?"],
  ["Transition representation", "How accurately are observed user or application transitions modeled?"],
  ["Workflow coverage interpretation", "What can graph-based coverage measurements establish compared with conventional metrics?"],
];

const practiceScenarios: [string, string, string][] = [
  [
    "Scenario · Developer",
    "A checkout test passed, but which workflow states were actually demonstrated?",
    "Related product area: Flow Declaration and Behavior Graphs.",
  ],
  [
    "Scenario · QA engineer",
    "A test suite executes successfully, but important alternate paths remain unexplored.",
    "Related product area: Reconciliation and QA Reports.",
  ],
  [
    "Scenario · Engineering manager",
    "A release report says 85% coverage. What does that number actually mean?",
    "Related product area: QA Reports.",
  ],
  [
    "Scenario · Product manager",
    "A feature is implemented, but the product requirements describe additional behavior.",
    "Related product area: Flow Declaration and Reconciliation.",
  ],
];

type OpenQuestion = {
  question: string;
  why: string;
  approach: string;
  limitations: string;
  status: string;
};

const openQuestions: OpenQuestion[] = [
  {
    question: "How reliably can browser demonstrations establish meaningful application-state boundaries?",
    why: "State boundaries determine what coverage and gap findings actually mean.",
    approach: "Compare state definitions produced from repeated demonstrations of the same workflow.",
    limitations: "Findings may depend heavily on the application's own architecture and framework.",
    status: "Open · No study underway",
  },
  {
    question: "How should declared workflows account for optional paths and conditional behavior?",
    why: "Real workflows branch; a declaration model that can't represent branches will misclassify valid behavior as missing.",
    approach: "Evaluate declaration formats against workflows with conditional and optional steps.",
    limitations: "Requires a representative sample of branching workflows across application types.",
    status: "Open · No study underway",
  },
  {
    question: "When do two observed executions represent the same behavioral path?",
    why: "Without a clear equivalence rule, coverage figures become inconsistent between runs.",
    approach: "Define and test criteria for path equivalence across repeated demonstrations.",
    limitations: "Equivalence criteria may need to vary by application domain.",
    status: "Open · No study underway",
  },
  {
    question: "How can reconciliation communicate uncertainty without overwhelming users?",
    why: "Reconciliation output is only useful if teams can act on it without misreading confidence levels.",
    approach: "Test alternative presentations of declared-versus-observed findings with real users.",
    limitations: "Usability findings may not generalize across all audiences described on this page.",
    status: "Open · No study underway",
  },
  {
    question: "How should teams prioritize unobserved states for further testing?",
    why: "Not every gap deserves equal attention; prioritization needs a defensible basis.",
    approach: "Investigate ranking signals such as workflow criticality and historical defect rates.",
    limitations: "Any ranking signal needs validation before it informs real prioritization decisions.",
    status: "Open · No study underway",
  },
  {
    question: "What evidence would justify moving from guided demonstrations toward production behavioral analysis?",
    why: "Production monitoring raises different privacy and reliability questions than guided demonstrations.",
    approach: "Define the evaluation criteria a production-evidence approach would need to satisfy first.",
    limitations: "This is a planned research direction, not a roadmap commitment.",
    status: "Open · Future research direction",
  },
];

const integrityPrinciples: string[] = [
  "Research claims are supported by described observations or citations.",
  "Product-generated examples are not automatically research findings.",
  "Demonstration-only evidence does not describe all possible application behavior.",
  "Unobserved behavior is not necessarily defective.",
  "Results may not generalize to every application architecture.",
  "Benchmarks need representative datasets and transparent evaluation methods.",
  "Comparisons involving Tellann should disclose that they are company-conducted research.",
  "Findings should distinguish hypotheses, preliminary observations, and validated results.",
];

const collaborators: [string, string][] = [
  ["Academic researchers", "Studying software behavior, testing methods, or evaluation frameworks."],
  ["QA engineering practitioners", "Evaluating clearly defined behavioral testing techniques."],
  ["Open-source maintainers", "Interested in reproducible workflow and coverage research."],
  ["Engineering teams", "Willing to evaluate a defined technique against a real application."],
  ["Technical educators", "Teaching software testing, QA, or behavioral evaluation."],
];

const relatedResources: [string, string, string][] = [
  ["Blog", "Accessible editorial perspectives on software quality and testing.", "/blog"],
  ["Resource Hub", "Guided learning resources for behavioral QA.", "/resources"],
  ["Documentation", "Technical implementation references.", docsLinks.home.href],
];

export default function ResearchPage() {
  const structuredData = [
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: "Tellann Research",
      description: metadata.description,
      url: `${siteUrl}/research`,
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
        { "@type": "ListItem", position: 2, name: "Research", item: `${siteUrl}/research` },
      ],
    },
  ];

  return (
    <main className="dev-page research-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      {/* Hero */}
      <section className="dev-hero">
        <div className="dev-shell dev-hero-copy">
          <p className="dev-kicker" data-aos="fade-up">
            Tellann research
          </p>
          <h1 data-aos="fade-up" data-aos-delay="60">
            Understanding what software does—and what the evidence can prove.
          </h1>
          <p data-aos="fade-up" data-aos-delay="120">
            We explore behavioral testing, application workflows, software-quality
            evidence, and the methods that help teams distinguish intended behavior
            from observed execution.
          </p>
          <div className="dev-actions" data-aos="fade-up" data-aos-delay="180">
            <a className="dev-button dev-button-solid" href="#questions">
              Explore research directions <span>↓</span>
            </a>
            <a className="dev-button" href="#methods">
              Our research approach <span>→</span>
            </a>
          </div>
        </div>
        <div className="dev-shell dev-hero-media research-hero-media">
          <ProductPlaceholder
            label="Declared workflow and observed path reconciliation — behavioral research diagram"
            dimensions="1600 × 1100"
            displayDimensions="590 × 430"
          />
          <p>
            Desktop ~590 × 430 px · Mobile 100% width × 260–340 px · Declared
            workflow appears, observed path is traced beside it, matching states
            align, a remaining unobserved state is marked for investigation · 3–4s
            build-in once, then static · Unobserved, confirmed, and
            requires-investigation states are visually distinct · Respects
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

      {/* Research mission / key questions */}
      <Section
        id="questions"
        surface
        eyebrow="Research mission"
        title="The questions behind more trustworthy software."
        copy="Software teams produce tests, logs, requirements, dashboards, and reports. But how much do those artifacts tell us about the behavior the application has actually demonstrated?"
      >
        <div className="dev-shell dev-pain-grid" data-aos="tellann-panel" data-aos-delay="120">
          {keyQuestions.map(([number, title, copy]) => (
            <article key={number}>
              <span className="research-status-tag">{number} / Research question</span>
              <b className="research-question-title">{title}</b>
              <p>{copy}</p>
            </article>
          ))}
        </div>
      </Section>

      {/* Featured investigation */}
      <section className="dev-section" id="featured">
        <div className="dev-shell">
          <p className="dev-kicker" data-aos="fade-up">
            Featured investigation
          </p>
          <div className="research-featured-card" data-aos="tellann-panel" data-aos-delay="120">
            <ProductPlaceholder
              label="Workflow coverage vs. demonstrated application behavior — research figure"
              dimensions="1600 × 900"
              displayDimensions="660 × 371"
            />
            <div className="research-featured-body">
              <span className="research-status-tag">Proposed study</span>
              <p className="research-featured-topic">Software quality · Coverage</p>
              <h2>
                Do coverage metrics tell us which application workflows have
                actually been exercised?
              </h2>
              <p>
                A research direction examining what code-level evidence can
                establish, what workflow-level observations add, and how to
                communicate the difference accurately.
              </p>
              <small>Illustrative research concept · No results claimed</small>
            </div>
          </div>
        </div>
      </section>

      {/* Explore research by theme */}
      <Section
        id="themes"
        surface
        eyebrow="Research themes"
        title="Explore the problems we're investigating."
      >
        <div className="dev-shell research-theme-grid" data-aos="tellann-panel" data-aos-delay="120">
          {themes.map((theme) => (
            <article key={theme.slug} id={`theme-${theme.slug}`}>
              <ProductPlaceholder
                label={`${theme.title} — research theme illustration`}
                dimensions="800 × 800"
                displayDimensions="96 × 96"
              />
              <h3>{theme.title}</h3>
              <p>{theme.copy}</p>
              <span>{theme.audiences}</span>
            </article>
          ))}
        </div>
      </Section>

      {/* Research for different audiences */}
      <Section
        id="audience"
        eyebrow="Research by audience"
        title="Find research relevant to your decisions."
        copy="Each role approaches research with a different question. Explore the angle most relevant to your work."
      >
        <div className="dev-shell" data-aos="tellann-panel" data-aos-delay="120">
          <ResearchAudienceTabs />
        </div>
      </Section>

      {/* How Tellann conducts research */}
      <Section
        id="methods"
        surface
        eyebrow="Our research approach"
        title="From a question to a defensible conclusion."
        copy="Visitors should be able to see how we distinguish hypotheses from findings. This describes the research standard we hold ourselves to — not a claim that every study below is complete."
      >
        <div className="dev-shell dev-workflow-flow" data-aos="tellann-panel" data-aos-delay="120">
          {methodology.map(([name, copy], index) => (
            <div key={name}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <b>{name}</b>
              <p>{copy}</p>
              {index < methodology.length - 1 ? <i>→</i> : null}
            </div>
          ))}
        </div>
      </Section>

      {/* Interactive research explainer */}
      <Section
        id="explainer"
        eyebrow="Interactive research explainer"
        title="What does it mean for a workflow to be observed?"
        copy="Follow a simplified application journey, compare expected steps with demonstrated behavior, and see why missing evidence is not necessarily the same as a confirmed defect."
      >
        <div className="dev-shell" data-aos="tellann-panel" data-aos-delay="120">
          <ResearchExplainer />
        </div>
        <p className="dev-shell dev-media-note">
          Illustrative example data, not a real customer demonstration · The
          explainer never labels an unobserved state as confirmed broken ·
          Keyboard-operable · Respects prefers-reduced-motion
        </p>
      </Section>

      {/* Publications and findings */}
      <Section
        id="publications"
        surface
        eyebrow="Publications and findings"
        title="Research papers, technical notes, and findings."
        copy="This is the principal destination for readers seeking actual research output."
      >
        <div className="dev-shell research-publications-grid" data-aos="tellann-panel" data-aos-delay="120">
          {publications.map((pub) => (
            <article key={pub.title} className="research-publication-card">
              <span className="research-status-tag">{pub.status}</span>
              <span className="research-pub-kicker">{pub.kicker}</span>
              <h3>{pub.title}</h3>
              <p>{pub.copy}</p>
              <small>{pub.topics} · Illustrative future publication entry — no paper currently asserted</small>
            </article>
          ))}
        </div>
        <div className="dev-shell research-empty-state" data-aos="fade-up" data-aos-delay="160">
          <strong>Our research publication library is being developed.</strong>
          In the meantime, explore the questions and methods guiding our work, or
          read{" "}
          <Link href={docsLinks.home.href}>the product documentation</Link>.
        </div>
      </Section>

      {/* Benchmarks and research artifacts */}
      <Section
        id="benchmarks"
        eyebrow="Benchmarks and research artifacts"
        title="Evidence you can inspect."
        copy="This area becomes especially valuable once Tellann produces credible evaluation datasets or benchmark results. Today, it introduces the themes we expect to measure."
      >
        <div className="dev-shell dev-trust-grid" data-aos="tellann-panel" data-aos-delay="120">
          <ProductPlaceholder
            label="Example research figure — placeholder only, not Tellann measurements"
            dimensions="1200 × 675"
            displayDimensions="700 × 394"
          />
          <div>
            {benchmarkThemes.map(([title, copy]) => (
              <article key={title}>
                <span>{title}</span>
                <p>{copy}</p>
              </article>
            ))}
          </div>
        </div>
        <p className="dev-shell dev-media-note">
          These are research opportunities, not completed results · No
          numerical performance outcome is stated without an actual study ·
          Placeholder figure only — the preview is an interface mockup, not a
          Tellann measurement
        </p>
      </Section>

      {/* Research in practice */}
      <Section
        id="practice"
        surface
        eyebrow="Research in practice"
        title="From research questions to practical engineering decisions."
      >
        <div className="dev-shell dev-usecase-grid" data-aos="tellann-panel" data-aos-delay="120">
          {practiceScenarios.map(([role, question, related]) => (
            <article key={role}>
              <p className="research-featured-topic" style={{ marginTop: 0, marginBottom: 10 }}>
                {role}
              </p>
              <b>{question}</b>
              <p>Illustrative scenario — not a documented customer outcome.</p>
              <span>{related}</span>
            </article>
          ))}
        </div>
      </Section>

      {/* Open questions */}
      <Section
        id="open-questions"
        eyebrow="Open questions"
        title="Questions we're still exploring."
        copy="Tellann's research page can differentiate itself by openly discussing unresolved problems."
      >
        <div className="dev-shell research-open-questions" data-aos="fade-up" data-aos-delay="120">
          {openQuestions.map((item) => (
            <details key={item.question}>
              <summary>
                {item.question}
                <span>+</span>
              </summary>
              <div className="research-oq-meta">
                <div>
                  <span>Why it matters</span>
                  <p>{item.why}</p>
                </div>
                <div>
                  <span>Current approach</span>
                  <p>{item.approach}</p>
                </div>
                <div>
                  <span>Limitations</span>
                  <p>{item.limitations}</p>
                </div>
                <div>
                  <span>Status</span>
                  <p>{item.status}</p>
                </div>
              </div>
            </details>
          ))}
        </div>
      </Section>

      {/* Research integrity and limitations */}
      <Section
        id="integrity"
        surface
        eyebrow="Research integrity"
        title="Evidence matters. So do its limits."
      >
        <div className="dev-shell research-integrity" data-aos="fade-up" data-aos-delay="120">
          <ol>
            {integrityPrinciples.map((principle) => (
              <li key={principle}>{principle}</li>
            ))}
          </ol>
          <p className="research-integrity-privacy">
            Research artifacts must not disclose customer source code,
            confidential application data, user sessions, credentials, or
            personally identifiable information without lawful authorization and
            suitable protections. Where research involves Tellann&rsquo;s desktop
            demonstrations, local code handling follows the same published
            security architecture described below — the desktop agent does not
            upload all local source code to conduct research.
          </p>
          <div className="dev-link-row">
            <Link href="/security" className="dev-inline-link">
              Read Security <span>→</span>
            </Link>
            <Link href={docsLinks.privacy.href} className="dev-inline-link">
              Read Privacy Principles <span>→</span>
            </Link>
          </div>
        </div>
      </Section>

      {/* Collaborate with Tellann */}
      <Section
        id="collaborate"
        eyebrow="Collaborate"
        title="Interested in investigating software quality with us?"
      >
        <div className="dev-shell research-collaborate-grid" data-aos="tellann-panel" data-aos-delay="120">
          <div>
            <p>
              We welcome contact from people who want to investigate software
              quality, testing evidence, or workflow coverage using clearly
              defined, reproducible methods.
            </p>
            <Link className="dev-button dev-button-solid" href="/contact">
              Discuss a research collaboration <span>→</span>
            </Link>
          </div>
          <div className="research-collaborate-list">
            {collaborators.map(([title, copy]) => (
              <div key={title}>
                <b>{title}</b>
                <p>{copy}</p>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* Research updates */}
      <section className="dev-section research-newsletter" id="updates">
        <div className="dev-shell-narrow">
          <p className="dev-kicker" data-aos="fade-up">
            Follow the questions as the evidence develops
          </p>
          <h2 data-aos="fade-up" data-aos-delay="60">
            Receive new research publications, methodology notes, and selected
            technical findings from Tellann.
          </h2>
          <div data-aos="fade-up" data-aos-delay="120">
            <ResearchNewsletterForm />
          </div>
        </div>
      </section>

      {/* Related resources */}
      <Section surface eyebrow="Continue exploring" title="Explore related Tellann resources.">
        <div className="dev-shell dev-related-grid" data-aos="tellann-panel" data-aos-delay="120">
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
            From questions to evidence
          </p>
          <h2 data-aos="fade-up" data-aos-delay="60">
            Turn questions about software behavior into evidence you can
            inspect.
          </h2>
          <p data-aos="fade-up" data-aos-delay="120">
            Discover how Tellann connects declared workflows, guided
            demonstrations, observed behavior, reconciliation, and QA reports.
          </p>
          <div className="dev-actions" data-aos="fade-up" data-aos-delay="180">
            <Link className="dev-button dev-button-solid" href="/product">
              Explore Tellann <span>→</span>
            </Link>
            <a className="dev-button" href={appUrl}>
              Start free <span>↗</span>
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
