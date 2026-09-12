import type { Metadata } from "next";
import Link from "next/link";
import {
  CandidateReview,
  DocumentMedia,
  DocumentRoles,
} from "./components";
import "./page.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://domain-name.com";
const appUrl = `${(
  process.env.NEXT_PUBLIC_APP_URL || "https://app.domain-name.com"
).replace(/\/$/, "")}/auth/login`;
const title =
  "Document Flow Inference — Turn Requirements Into QA Flows | Tellann";
const description =
  "Turn product documentation into reviewable application flow drafts with Tellann. Edit inferred states and branches, then accept only the intent your team approves.";

export const metadata: Metadata = {
  title: { absolute: title },
  description,
  alternates: { canonical: "/product/document-flow-inference" },
  openGraph: {
    title,
    description,
    url: `${siteUrl}/product/document-flow-inference`,
    type: "website",
  },
};

const faqs = [
  [
    "What is Document Flow Inference?",
    "It turns customer-supplied product documentation into candidate application flows for human review.",
  ],
  [
    "Does Tellann automatically add inferred flows?",
    "No. Every result remains a proposal until someone explicitly accepts it as declared intent.",
  ],
  [
    "Can I correct or reject an inferred flow?",
    "Yes. You can edit or reject a draft, and regenerate a proposal from your correction.",
  ],
  [
    "Does it generate a Behavior Graph or coverage result?",
    "No. Behavior Graphs and coverage come from recorded demonstration evidence. Documents help state intent; they do not manufacture observed behavior.",
  ],
  [
    "Does Tellann judge whether a requirement is good or risky?",
    "No. Document Flow Inference structures possible intent. It does not produce quality scores, risk judgments, or proof that a workflow works.",
  ],
  [
    "Which plans include Document Flow Inference?",
    "It is available from Local, with Advanced entitlement from Solo upward. Manual Flow Declaration remains available without this assistance.",
  ],
] as const;

export default function DocumentFlowInferencePage() {
  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        name: title,
        description,
        url: `${siteUrl}/product/document-flow-inference`,
      },
      {
        "@type": "SoftwareApplication",
        name: "Tellann Document Flow Inference",
        applicationCategory: "DeveloperApplication",
        operatingSystem: "Web",
        description,
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          ["Home", ""],
          ["Product", "/product"],
          ["Document Flow Inference", "/product/document-flow-inference"],
        ].map(([name, path], index) => ({
          "@type": "ListItem",
          position: index + 1,
          name,
          item: `${siteUrl}${path}`,
        })),
      },
      {
        "@type": "FAQPage",
        mainEntity: faqs.map(([name, text]) => ({
          "@type": "Question",
          name,
          acceptedAnswer: { "@type": "Answer", text },
        })),
      },
    ],
  };

  return (
    <main className="document-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(schema).replace(/</g, "\\u003c"),
        }}
      />

      <section className="document-hero document-shell">
        <div className="document-hero-copy" data-aos="fade-up">
          <p className="document-kicker">Document Flow Inference</p>
          <h1>
            Turn product documentation into reviewable application <em>flows.</em>
          </h1>
          <p>
            Let Tellann draft the workflows your documents describe. Review the
            states and branches, correct what is wrong, and accept only the intent
            your team means.
          </p>
          <div className="document-actions">
            <a className="is-primary" href={appUrl}>
              Create flows from a document <span>↗</span>
            </a>
            <a href="#process">
              See how it works <span>↓</span>
            </a>
          </div>
          <Link className="document-text-link" href="/product/flow-declaration">
            Prefer to declare flows manually? Explore Flow Declaration →
          </Link>
        </div>
        <div className="document-hero-media" data-aos="fade-up" data-aos-delay="100">
          <div className="document-caption">
            <span>PRODUCT DOCUMENT</span>
            <span>→</span>
            <span>CANDIDATE FLOW</span>
          </div>
          <DocumentMedia
            label="Document → candidate flow"
            width={720}
            height={475}
            master="1600 × 1050"
          />
          <p>Tellann drafts. Your team decides.</p>
        </div>
      </section>

      <nav className="document-jumps" aria-label="On this page">
        <div className="document-shell">
          {[
            ["purpose", "What it does"],
            ["process", "How it works"],
            ["review", "Review drafts"],
            ["workflow", "Product workflow"],
            ["plans", "Plans"],
            ["faq", "FAQ"],
          ].map(([id, label]) => (
            <a href={`#${id}`} key={id}>
              {label} <span>↗</span>
            </a>
          ))}
        </div>
      </nav>

      <section id="purpose" className="document-section document-shell">
        <div className="document-heading" data-aos="fade-up">
          <p className="document-kicker">01 / From documents to intent</p>
          <h2>Stop rewriting requirements as workflows by hand.</h2>
          <p>
            Product requirements already contain users, states, actions, branches,
            and outcomes. Tellann helps structure those details into drafts your
            team can review.
          </p>
        </div>
        <div className="document-capabilities">
          {[
            ["Extract", "Workflow intent", "Draft candidate states and transitions from product language."],
            ["Branch", "Alternative paths", "Surface success, failure, retry, and other implied routes."],
            ["Structure", "Complete drafts", "Group related states into one reviewable application flow."],
            ["Decide", "Human control", "Keep every result outside declared intent until it is accepted."],
          ].map(([number, name, copy], index) => (
            <article key={name} data-aos="fade-up" data-aos-delay={index * 50}>
              <span>0{index + 1} / {number}</span>
              <h3>{name}</h3>
              <p>{copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="process" className="document-section document-surface">
        <div className="document-shell">
          <div className="document-heading" data-aos="fade-up">
            <p className="document-kicker">02 / Document to draft</p>
            <h2>From a paragraph to something your QA process can use.</h2>
          </div>
          <ol className="document-process">
            {[
              ["Import", "Supply product documentation."],
              ["Process", "Create a traceable source version."],
              ["Draft", "Identify candidate flows and branches."],
              ["Review", "Edit, accept, or reject the proposal."],
              ["Declare", "Apply only the intent your team approves."],
            ].map(([name, copy], index) => (
              <li key={name} data-aos="fade-up" data-aos-delay={index * 55}>
                <span>0{index + 1}</span>
                <h3>{name}</h3>
                <p>{copy}</p>
              </li>
            ))}
          </ol>
          <DocumentMedia
            label="Document processing pipeline"
            width={1180}
            height={510}
            master="1500 × 650"
          />
        </div>
      </section>

      <section id="review" className="document-section document-shell">
        <div className="document-heading" data-aos="fade-up">
          <p className="document-kicker">03 / Proposal, not product truth</p>
          <h2>A useful starting point. A decision your team still owns.</h2>
          <p>
            Review candidate workflows individually, see the source behind them,
            and choose whether to accept, edit, or reject each draft.
          </p>
        </div>
        <CandidateReview />
        <div className="document-drawers">
          <details>
            <summary>
              Trace every draft to its source <span>+</span>
            </summary>
            <p>
              Source-document versions keep a proposal connected to the exact
              material it came from. Hover and review states can point back to the
              relevant source passage.
            </p>
            <DocumentMedia
              label="Source-to-flow trace"
              width={1000}
              height={615}
              master="1400 × 860"
            />
          </details>
          <details>
            <summary>
              Review the complete flow before applying it <span>+</span>
            </summary>
            <p>
              Inspect entry, states, branches, and terminal outcomes together so
              you never approve an isolated suggestion without its context.
            </p>
            <DocumentMedia
              label="Full flow review"
              width={1100}
              height={720}
              master="1600 × 1050"
            />
          </details>
          <details>
            <summary>
              Correct and regenerate a proposal <span>+</span>
            </summary>
            <p>
              Fix a label or branch, then regenerate the surrounding draft from
              your correction. The result remains an updated proposal that needs
              review.
            </p>
            <DocumentMedia
              label="Correction and regeneration"
              width={950}
              height={575}
              master="1400 × 850"
            />
          </details>
          <details>
            <summary>
              Review multiple candidate flows <span>+</span>
            </summary>
            <p>
              A document can produce several candidates. Review each workflow on
              its own terms without implying that every possible flow was found.
            </p>
            <DocumentMedia
              label="Candidate-flow dashboard"
              width={1100}
              height={720}
              master="1600 × 1050"
            />
          </details>
        </div>
      </section>

      <section id="workflow" className="document-section document-surface">
        <div className="document-shell">
          <div className="document-split">
            <div data-aos="fade-up">
              <p className="document-kicker">04 / Intent meets evidence</p>
              <h2>Start with what should happen. Then show Tellann what does.</h2>
              <p>
                Accepted drafts become declared intent. Demonstrations produce
                observed behavior. Reconciliation compares the two — keeping the
                document and the evidence in their proper roles.
              </p>
              <Link href="/product/reconciliation">Explore Reconciliation →</Link>
            </div>
            <DocumentMedia
              label="Declared intent vs. observed behavior"
              width={1050}
              height={600}
              master="1400 × 800"
            />
          </div>
          <div className="document-boundary">
            <div>
              <p className="document-kicker">Documents help state intent</p>
              <h3>What should happen</h3>
              <p>Candidate states, branches, outcomes, and accepted flows.</p>
            </div>
            <span aria-hidden="true">≠</span>
            <div>
              <p className="document-kicker">Demonstrations provide evidence</p>
              <h3>What did happen</h3>
              <p>Behavior Graphs, coverage, findings, and reconciliation.</p>
            </div>
          </div>
          <details className="document-trust">
            <summary>
              How assistance is bounded <span>Technical trust details +</span>
            </summary>
            <div className="document-trust-copy">
              <ul>
                <li>Generated flows start as proposals.</li>
                <li>People explicitly accept declared intent.</li>
                <li>Inputs are sanitized and outputs are schema-validated.</li>
                <li>Malformed outputs are repaired or rejected.</li>
                <li>Analytical engines stay evidence-based.</li>
                <li>Manual declaration remains available.</li>
              </ul>
              <DocumentMedia
                label="Assistance trust boundary"
                width={900}
                height={465}
                master="1200 × 620"
              />
            </div>
          </details>
        </div>
      </section>

      <section id="plans" className="document-section document-shell">
        <div className="document-heading" data-aos="fade-up">
          <p className="document-kicker">05 / Built for shared review</p>
          <h2>Turn existing product language into a clearer starting point.</h2>
        </div>
        <DocumentRoles />
        <div className="document-plan-row">
          <div>
            <p className="document-kicker">Plan availability</p>
            <h3>Available from Local.</h3>
            <p>Advanced entitlement is available from Solo upward.</p>
          </div>
          <div>
            <p className="document-kicker">Manual fallback</p>
            <h3>Flow Declaration still works without assistance.</h3>
            <p>Free users can define and review flows manually.</p>
          </div>
          <Link href="/pricing">Compare plans →</Link>
        </div>
        <details className="document-video">
          <summary>
            Turn a product document into a flow in 60 seconds
            <span>Video preview placeholder +</span>
          </summary>
          <DocumentMedia
            label="Document Flow Inference explainer video"
            width={960}
            height={540}
            master="1920 × 1080"
          />
        </details>
      </section>

      <section id="faq" className="document-section document-surface">
        <div className="document-shell">
          <div className="document-heading">
            <p className="document-kicker">A few useful answers</p>
            <h2>Before you infer a flow.</h2>
          </div>
          <div className="document-faq">
            {faqs.map(([question, answer]) => (
              <details key={question}>
                <summary>
                  {question} <span>+</span>
                </summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
          <div className="document-related">
            {[
              ["Flow Declaration", "/product/flow-declaration", "What should happen?"],
              ["Developer Demonstration", "/product/demonstration-mode", "What did you show?"],
              ["Reconciliation", "/product/reconciliation", "What is different?"],
              ["Behavior Graphs", "/product/behavior-graphs", "What was observed?"],
            ].map(([name, href, copy]) => (
              <Link href={href} key={href}>
                <span>{name} ↗</span>
                <small>{copy}</small>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="document-final document-shell" data-aos="fade-up">
        <p className="document-kicker">Your documentation already contains the intent</p>
        <h2>
          Put it to work.<br />
          <em>Keep your team in control.</em>
        </h2>
        <p>
          Turn existing product requirements into workflow drafts your team can
          review, correct, and declare.
        </p>
        <div className="document-actions">
          <a className="is-primary" href={appUrl}>
            Start with Tellann <span>↗</span>
          </a>
          <Link href="/product/flow-declaration">
            Explore Flow Declaration <span>→</span>
          </Link>
        </div>
      </section>
    </main>
  );
}
