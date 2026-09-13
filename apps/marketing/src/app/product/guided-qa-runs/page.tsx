import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  CaptureTracks,
  GuidedMedia,
  GuidedRoles,
  GuidedRunHero,
  RunLifecycle,
  RunModes,
} from "./components";
import "./page.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://domain-name.com";
const path = "/product/guided-qa-runs";
const title =
  "Guided QA Runs — Turn Application Walkthroughs Into QA Evidence | Tellann";
const description =
  "Run real application workflows through Tellann Guided QA Runs. Capture frontend and backend behavior, track flow coverage, replay sessions, compare behavior with intent, and generate structured QA reports.";

/**
 * Stand-in for the VideoObject schema until the Guided QA Run explainer is
 * published. Every value is taken verbatim from YouTube (the watch page's
 * microformat and the oEmbed response) so nothing here is invented — replace
 * all of the fields together when the real video exists. Search engines expect
 * the video to be visible on the page, so swap the explainer drawer's
 * placeholder for the real embed at the same time.
 */
const sampleVideo = {
  id: "aqz-KE-bpKQ",
  name: "Big Buck Bunny 60fps 4K - Official Blender Foundation Short Film",
  description:
    "Big Buck Bunny, the open-licensed animated short film by the Blender Foundation.",
  uploadDate: "2014-11-10T06:05:55-08:00",
  duration: "PT10M35S",
  thumbnailUrl: "https://i.ytimg.com/vi/aqz-KE-bpKQ/hqdefault.jpg",
};

export const metadata: Metadata = {
  // Absolute, so the layout's "%s | Tellann" template doesn't append a second suffix.
  title: { absolute: title },
  description,
  alternates: { canonical: path },
  openGraph: { title, description, url: `${siteUrl}${path}`, type: "website" },
};

const faqs = [
  [
    "What is a Guided QA Run?",
    "A developer- or QA-led walkthrough of your application, performed in Tellann's managed browser while Tellann follows the declared workflow and records the evidence.",
  ],
  [
    "Does Tellann perform the workflow automatically?",
    "No. In Guided mode you perform the workflow. Tellann guides the run and observes what happens.",
  ],
  [
    "Do I have to declare a flow first?",
    "Guided mode is designed around a declared flow. Assisted mode exists for exploration and partially declared intent, and Observation Only records without any flow at all.",
  ],
  [
    "What does Tellann record?",
    "Depending on the capture tracks you enable: page visits, route changes, clicks, form submissions, state transitions, API requests and responses, errors, and browser findings.",
  ],
  [
    "Does logging in count toward workflow coverage?",
    "Not if it happens before the flow boundary. Pre-boundary activity is kept for context and replay, but excluded from coverage and reconciliation.",
  ],
  [
    "Can I pause a run?",
    "Yes. Pause and resume are part of the run lifecycle, and evidence captured before the pause is kept.",
  ],
  [
    "What if the browser closes before I finish?",
    "Tellann keeps the evidence gathered and marks the run COMPLETED_INCOMPLETE rather than treating it as complete or discarding it.",
  ],
  [
    "Do I get a report afterwards?",
    "Yes. The QA Run Report covers run context, evidence basis, coverage, reconciliation, missing states and flows, endpoint analysis, findings, annotations, and artifacts.",
  ],
  [
    "Does Tellann calculate a quality score from the run?",
    "No. The report opens with what was measured, not a composite quality score.",
  ],
  [
    "Which plans include Guided QA Runs?",
    "Every plan — Free, Local, Solo, Team, Business, and Enterprise.",
  ],
] as const;

const jumpLinks = [
  ["what", "What it is"],
  ["guide", "Guidance"],
  ["boundaries", "Boundaries"],
  ["evidence", "Evidence"],
  ["modes", "Run modes"],
  ["results", "Results"],
  ["roles", "By role"],
  ["faq", "FAQ"],
] as const;

const timeline = [
  ["00:01.231", "Route", "/cart → /checkout"],
  ["00:02.044", "State", "CART_REVIEW → CHECKOUT_STARTED"],
  ["00:03.815", "Click", "Pay"],
  ["00:03.923", "API", "POST /api/payment"],
  ["00:04.170", "Response", "201"],
  ["00:04.311", "State", "PAYMENT_SUBMITTED → ORDER_CONFIRMED"],
] as const;

const outputs = [
  ["Session replay", "/product/session-replay"],
  ["Behavior graph", "/product/behavior-graphs"],
  ["Coverage", "/product/coverage"],
  ["Reconciliation", "/product/reconciliation"],
  ["Missing states", "/product/missing-states"],
  ["Missing flows", "/product/missing-flows"],
  ["Endpoint analysis", "/product/endpoint-intelligence"],
  ["QA run report", "/product/qa-reports"],
] as const;

const fitRows = [
  ["Flow Declaration", "What should happen?"],
  ["Guided QA Runs", "Can we demonstrate that behavior?"],
  ["Session Replay", "What happened during the walkthrough?"],
  ["Behavior Graphs", "What behavior did Tellann observe?"],
  ["Coverage", "How much of the intended behavior was demonstrated?"],
  ["Reconciliation", "Did observation match intent?"],
] as const;

const related = [
  ["Flow Declaration", "/product/flow-declaration", "Define the workflow Tellann should guide."],
  ["Automated Instrumentation", "/product/automated-instrumentation", "Prepare the checkpoints Tellann needs to observe."],
  ["Session Replay", "/product/session-replay", "Revisit exactly what happened during the run."],
  ["Reconciliation", "/product/reconciliation", "Compare the run against declared intent."],
  ["QA Reports", "/product/qa-reports", "Turn the run's evidence into something the team can review."],
] as const;

function Heading({
  kicker,
  title,
  children,
}: {
  kicker: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="guided-heading">
      <p className="guided-kicker" data-aos="fade-up">
        {kicker}
      </p>
      <h2 data-aos="fade-up" data-aos-delay="60">
        {title}
      </h2>
      {children ? (
        <p data-aos="fade-up" data-aos-delay="120">
          {children}
        </p>
      ) : null}
    </div>
  );
}

/** Secondary media stays collapsed so the page reads short. */
function Drawer({ summary, children }: { summary: string; children: ReactNode }) {
  return (
    <details className="guided-drawer">
      <summary>
        {summary} <span aria-hidden="true">+</span>
      </summary>
      <div className="guided-drawer-body">{children}</div>
    </details>
  );
}

export default function GuidedQaRunsPage() {
  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "WebPage", name: title, description, url: `${siteUrl}${path}` },
      {
        "@type": "SoftwareApplication",
        name: "Tellann Desktop",
        applicationCategory: "DeveloperApplication",
        operatingSystem: "Windows, macOS, Linux",
        description:
          "Tellann Desktop launches Guided QA Runs in a managed browser and records the walkthrough as structured behavioral evidence.",
        url: `${siteUrl}/desktop`,
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          ["Home", ""],
          ["Product", "/product"],
          ["Guided QA Runs", path],
        ].map(([name, href], i) => ({
          "@type": "ListItem",
          position: i + 1,
          name,
          item: `${siteUrl}${href}`,
        })),
      },
      {
        "@type": "VideoObject",
        name: sampleVideo.name,
        description: sampleVideo.description,
        thumbnailUrl: sampleVideo.thumbnailUrl,
        uploadDate: sampleVideo.uploadDate,
        duration: sampleVideo.duration,
        embedUrl: `https://www.youtube.com/embed/${sampleVideo.id}`,
        url: `https://www.youtube.com/watch?v=${sampleVideo.id}`,
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
    <main className="guided-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(schema).replace(/</g, "\\u003c"),
        }}
      />

      {/* Hero */}
      <section className="guided-hero guided-shell">
        <div className="guided-hero-copy">
          <p className="guided-kicker" data-aos="fade-up">
            Guided QA runs · Tellann Desktop
          </p>
          <h1 data-aos="fade-up" data-aos-delay="120">
            Walk through a workflow. Let Tellann turn it into evidence.
          </h1>
          <p data-aos="fade-up" data-aos-delay="180">
            Start a Guided QA Run from Tellann Desktop, perform the real workflow
            in a managed browser, and let Tellann track the states, transitions,
            APIs, errors, and findings along the way.
          </p>
          <div className="guided-actions" data-aos="fade-up" data-aos-delay="240">
            <Link className="is-primary" href="/desktop/download">
              Start a Guided Run <span>→</span>
            </Link>
            <a href="#what">
              See a Guided Run <span>↓</span>
            </a>
          </div>
          <Link className="guided-text-link" href="/desktop">
            Explore Tellann Desktop →
          </Link>
        </div>
        <div className="guided-hero-media" data-aos="fade-up" data-aos-delay="120">
          <GuidedRunHero />
          <p className="guided-note">
            Interactive HTML · Displayed 720 × 470 px · Static fallback master
            1600 × 1050 px · Plays once, then stops
          </p>
        </div>
      </section>

      <nav className="guided-jumps" aria-label="On this page">
        <div className="guided-shell">
          {jumpLinks.map(([id, label]) => (
            <a key={id} href={`#${id}`}>
              {label}
            </a>
          ))}
        </div>
      </nav>

      {/* What it is + not a test script */}
      <section id="what" className="guided-section">
        <div className="guided-shell">
          <Heading kicker="01 / Human-led. Evidence-driven." title="A Guided QA Run is a controlled application walkthrough.">
            Choose a declared flow, launch its run from Tellann Desktop, and
            perform the workflow in the managed browser. Tellann keeps the
            walkthrough aligned with the expected states while recording what
            the application actually does.
          </Heading>
          <div className="guided-principles">
            {[
              ["Human-led", "You click, type, navigate, and submit — in the real application."],
              ["Tellann-guided", "The run knows the flow and the states it expects next."],
              ["Evidence-driven", "States, transitions, APIs, errors, and findings become QA evidence."],
            ].map(([name, copy], i) => (
              <article key={name} data-aos="fade-up" data-aos-delay={String((i + 1) * 60)}>
                <span>0{i + 1}</span>
                <h3>{name}</h3>
                <p>{copy}</p>
              </article>
            ))}
          </div>
          <GuidedMedia
            label="You → real application → Tellann observes → QA evidence"
            width={1050}
            height={490}
            master="1200 × 560"
          />

          <div className="guided-compare" data-aos="fade-up">
            <div>
              <p className="guided-kicker">Traditional setup</p>
              <ol>
                {["Write test setup", "Write selectors", "Write actions", "Write assertions", "Maintain and debug the script"].map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ol>
            </div>
            <div className="is-primary">
              <p className="guided-kicker">Guided QA run</p>
              <ol>
                {["Choose the workflow", "Start the run", "Use the application normally", "Finish the workflow", "Review the evidence"].map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ol>
            </div>
          </div>
          <p className="guided-callout">
            <b>Demonstrate the behavior instead of describing every action as a test.</b>{" "}
            This isn&apos;t a case against scripted automation — it&apos;s a way to
            get useful QA evidence before you build automation around every
            workflow.
          </p>
        </div>
      </section>

      {/* Choose the flow + guidance */}
      <section id="guide" className="guided-section guided-surface">
        <div className="guided-shell">
          <Heading kicker="02 / Guidance, not a script" title="Know what the run expects without turning it into a script.">
            Start with the behavior you want to verify. Tellann shows where you
            are and which state it expects next — not a click-by-click macro.
          </Heading>
          <div className="guided-flow-grid" data-aos="fade-up">
            <div className="guided-flow-card">
              <p className="guided-kicker">Declared flow · Checkout</p>
              <dl>
                <div>
                  <dt>Start</dt>
                  <dd>CART_REVIEW</dd>
                </div>
                <div>
                  <dt>Expected</dt>
                  <dd>CHECKOUT_STARTED · PAYMENT_SUBMITTED · ORDER_CONFIRMED</dd>
                </div>
                <div>
                  <dt>Alternatives</dt>
                  <dd>PAYMENT_FAILED · RETRY_PAYMENT</dd>
                </div>
                <div>
                  <dt>Terminal</dt>
                  <dd>ORDER_CONFIRMED · CHECKOUT_CANCELLED</dd>
                </div>
              </dl>
            </div>
            <div className="guided-flow-card">
              <p className="guided-kicker">During the run</p>
              <dl>
                <div>
                  <dt>Current position</dt>
                  <dd>CHECKOUT_STARTED</dd>
                </div>
                <div>
                  <dt>Expected next</dt>
                  <dd>PAYMENT_SUBMITTED</dd>
                </div>
                <div>
                  <dt>Alternative expected</dt>
                  <dd>CHECKOUT_CANCELLED</dd>
                </div>
              </dl>
              <p className="guided-not">
                <s>1. Click #checkout · 2. Type card number · 3. Click #submitPayment</s>
                <span>Tellann prompts for states, not keystrokes.</span>
              </p>
            </div>
          </div>
          <GuidedMedia
            label="Guided run split view — flow progress beside the managed browser"
            width={1150}
            height={720}
            master="1600 × 1000"
          />
          <Drawer summary="See the new-run configuration">
            <p>
              Pick the application, environment, flow, run mode, and capture
              tracks before the managed browser opens.
            </p>
            <GuidedMedia
              label="New QA run configuration"
              width={1000}
              height={650}
              master="1500 × 980"
            />
          </Drawer>
        </div>
      </section>

      {/* Boundaries */}
      <section id="boundaries" className="guided-section">
        <div className="guided-shell">
          <Heading kicker="03 / Flow boundaries" title="Tellann knows when the workflow actually begins.">
            Logging in before a checkout test shouldn&apos;t make checkout look
            more complete. Setup activity is kept for context and replay;
            coverage and reconciliation use only in-flow evidence.
          </Heading>
          <div className="guided-boundary" data-aos="guided-boundary">
            <div className="guided-boundary-zone is-context">
              <p className="guided-label">Context only</p>
              <ol>
                {["Login", "Dashboard", "Product page"].map((node) => (
                  <li key={node}>{node}</li>
                ))}
              </ol>
            </div>
            <div className="guided-boundary-line" aria-hidden="true">
              <span>Flow start</span>
            </div>
            <div className="guided-boundary-zone is-flow">
              <p className="guided-label">Measured workflow · coverage measured here</p>
              <ol>
                {["Cart", "Checkout", "Payment", "Confirmation"].map((node) => (
                  <li key={node}>{node}</li>
                ))}
              </ol>
            </div>
            <div className="guided-boundary-line is-end" aria-hidden="true">
              <span>Flow end</span>
            </div>
          </div>
          <GuidedMedia
            label="Flow boundary — context activity vs measured workflow"
            width={1050}
            height={490}
            master="1400 × 650"
            note="900–1200 ms reveal on scroll · first three nodes stay muted, the boundary line draws, workflow nodes brighten"
          />
        </div>
      </section>

      {/* Evidence */}
      <section id="evidence" className="guided-section guided-surface">
        <div className="guided-shell">
          <Heading kicker="04 / What Tellann captures" title="One walkthrough. Multiple layers of evidence.">
            Every action becomes a timestamped event on the same run — browser
            behavior, state changes, API activity, errors, and findings.
          </Heading>
          <ol className="guided-timeline" data-aos="guided-timeline">
            {timeline.map(([time, kind, detail]) => (
              <li key={time}>
                <time>{time}</time>
                <b>{kind}</b>
                <span>{detail}</span>
              </li>
            ))}
          </ol>
          <GuidedMedia
            label="Session evidence timeline"
            width={1000}
            height={570}
            master="1500 × 850"
          />
          <Drawer summary="See the workflow from the browser and the server">
            <p>
              Frontend and backend capture are separate tracks, and a run can
              enable either or both. Turn one off and see how Tellann reports it.
            </p>
            <CaptureTracks />
            <GuidedMedia
              label="Frontend and backend activity correlated into one run"
              width={1050}
              height={570}
              master="1400 × 760"
            />
          </Drawer>
        </div>
      </section>

      {/* Interruptions */}
      <section className="guided-section">
        <div className="guided-shell">
          <Heading kicker="05 / Real QA isn't linear" title="Pause when the real world interrupts. Keep what you gathered.">
            A run can pause and resume. If it ends before a terminal state,
            Tellann retains the evidence and marks the outcome — instead of
            discarding the run or quietly calling it complete.
          </Heading>
          <div className="guided-lifecycle-grid" data-aos="fade-up">
            <RunLifecycle />
            <GuidedMedia
              label="Paused and incomplete run states"
              width={800}
              height={500}
              master="1200 × 760"
            />
          </div>
          <Drawer summary="Capture what you notice while the evidence is still fresh">
            <div className="guided-annotation">
              <div>
                <p className="guided-kicker">02:43 · Payment</p>
                <blockquote>
                  “Spinner remained visible for almost four seconds.”
                </blockquote>
                <p>
                  Annotations, screenshots, and artifacts attach to the moment
                  they describe, alongside the browser findings for that run.
                </p>
              </div>
              <GuidedMedia
                label="Annotation beside the session timeline"
                width={950}
                height={575}
                master="1400 × 850"
              />
            </div>
          </Drawer>
        </div>
      </section>

      {/* Modes */}
      <section id="modes" className="guided-section guided-surface">
        <div className="guided-shell">
          <Heading kicker="06 / Run modes" title="Guided when you know the flow. Flexible when you don't." />
          <div data-aos="fade-up">
            <RunModes />
          </div>
        </div>
      </section>

      {/* Results */}
      <section id="results" className="guided-section">
        <div className="guided-shell">
          <Heading kicker="07 / After the run" title="The run ends. The evidence keeps working.">
            Events become a session, states, transitions, a workflow, and a
            behavior graph — and every analysis Tellann runs starts from there.
          </Heading>
          <ol className="guided-chain" data-aos="fade-up">
            {["Guided run", "Events", "Session", "States", "Transitions", "Workflow", "Behavior graph"].map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>

          <div className="guided-results" data-aos="fade-up">
            <div className="guided-results-panel">
              <p className="guided-kicker">Checkout QA run · RUN-4471</p>
              <dl>
                {[
                  ["Outcome", "COMPLETED"],
                  ["Evidence", "418 in-flow events"],
                  ["Coverage", "72% of the declared flow"],
                  ["Reconciliation", "11 confirmed · 3 true gaps · 2 undeclared"],
                  ["Missing", "Payment failure · Session timeout"],
                  ["Endpoints", "2 slow · 1 error-prone"],
                ].map(([term, value]) => (
                  <div key={term}>
                    <dt>{term}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
              <p className="guided-note">
                No composite quality score — the report opens with what was
                measured. Illustrative figures.
              </p>
            </div>
            <div className="guided-outputs">
              <p className="guided-kicker">What the run produces</p>
              <ul>
                {outputs.map(([name, href]) => (
                  <li key={name}>
                    {href ? <Link href={href}>{name} →</Link> : <span>{name}</span>}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <Heading kicker="QA run report" title="Every run leaves behind a structured explanation of what was measured." />
          <GuidedMedia
            label="QA run report — evidence basis first"
            width={1100}
            height={755}
            master="1600 × 1100"
          />
          <div className="guided-drawers">
            <Drawer summary="See the run result dashboard">
              <GuidedMedia
                label="Run result dashboard"
                width={1050}
                height={665}
                master="1500 × 950"
              />
            </Drawer>
            <Drawer summary="See how the run becomes a behavior graph">
              <GuidedMedia
                label="Run to behavior graph processing"
                width={1050}
                height={450}
                master="1400 × 600"
                note="700–1000 ms transformation · events collapse into session, states, workflow, graph"
              />
            </Drawer>
            <Drawer summary="Replay the run with the evidence beside it">
              <GuidedMedia
                label="Session replay beside the evidence timeline"
                width={1100}
                height={650}
                master="1600 × 950"
              />
              <Link className="guided-text-link" href="/product/session-replay">
                Explore Session Replay →
              </Link>
            </Drawer>
          </div>
        </div>
      </section>

      {/* Roles */}
      <section id="roles" className="guided-section guided-surface">
        <div className="guided-shell">
          <Heading kicker="08 / By role" title="Guided QA Runs for your role." />
          <div data-aos="fade-up">
            <GuidedRoles />
          </div>
        </div>
      </section>

      {/* Trust */}
      <section className="guided-section">
        <div className="guided-shell">
          <Heading kicker="09 / Controlled observation" title="The run observes your application without treating everything as collectable." />
          <div className="guided-trust">
            {[
              ["Protected values", "Sensitive values like passwords and card numbers are classified and shown as ••••••••."],
              ["Scoped evidence", "Only in-flow evidence drives coverage and reconciliation."],
              ["Local source", "Raw source stays on the developer's machine unless you give explicit, named-purpose consent."],
              ["Read-safe mode", "Observation Only restricts itself to read-safe interactions."],
            ].map(([name, copy], i) => (
              <article key={name} data-aos="fade-up" data-aos-delay={String((i + 1) * 60)}>
                <h3>{name}</h3>
                <p>{copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* How it fits + plans */}
      <section className="guided-section guided-surface">
        <div className="guided-shell">
          <Heading kicker="10 / Where this sits" title="Guided runs are where declared intent meets real behavior." />
          <ol className="guided-chain is-fit" data-aos="fade-up">
            {[
              ["Declare flow", "What should happen"],
              ["Prepare workspace", ""],
              ["Guided QA run", "You are here"],
              ["Observed behavior", "What happened"],
              ["Analysis", "Coverage · reconciliation · gaps"],
              ["QA report", ""],
            ].map(([step, sub]) => (
              <li key={step} className={sub === "You are here" ? "is-here" : ""}>
                {step}
                {sub ? <small>{sub}</small> : null}
              </li>
            ))}
          </ol>
          <div className="guided-table" role="table" aria-label="What each capability answers">
            {fitRows.map(([name, question]) => (
              <div role="row" key={name} className={name === "Guided QA Runs" ? "is-primary" : ""}>
                <span role="rowheader">{name}</span>
                <span role="cell">{question}</span>
              </div>
            ))}
          </div>

          <div className="guided-plans" data-aos="fade-up">
            <div>
              <p className="guided-kicker">Plan availability</p>
              <h3>Try the core Tellann workflow for free.</h3>
              <p>
                Guided QA Runs are included on every plan. Start with one
                application before deciding whether you need paid capabilities
                like Automated Instrumentation.
              </p>
              <Link className="guided-text-link" href="/pricing">
                Compare plans →
              </Link>
            </div>
            <ul aria-label="Plans that include Guided QA Runs">
              {["Free", "Local", "Solo", "Team", "Business", "Enterprise"].map((plan) => (
                <li key={plan}>
                  <i aria-hidden="true">✓</i>
                  {plan}
                </li>
              ))}
            </ul>
          </div>

          <div className="guided-related">
            {related.map(([name, href, copy], i) => (
              <Link key={href} href={href} data-aos="fade-up" data-aos-delay={String((i + 1) * 60)}>
                <b>{name}</b>
                <span>{copy}</span>
                <i aria-hidden="true">→</i>
              </Link>
            ))}
          </div>

          <Drawer summary="Watch a Guided QA Run in about a minute">
            <GuidedMedia
              label="Guided QA Run explainer video"
              width={960}
              height={540}
              master="1920 × 1080"
              note="65–80 seconds · poster 1600 × 900 px · WebM with MP4 H.264 fallback · captions required · never autoplays with sound"
            />
          </Drawer>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="guided-section">
        <div className="guided-shell guided-faq-grid">
          <div>
            <p className="guided-kicker">FAQ</p>
            <h2>Frequently asked questions.</h2>
          </div>
          <div className="guided-faq">
            {faqs.map(([question, answer]) => (
              <details key={question}>
                <summary>
                  {question} <span aria-hidden="true">+</span>
                </summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="guided-final guided-shell" data-aos="fade-up">
        <p className="guided-kicker">Guided QA runs turn a walkthrough into evidence</p>
        <h2>Show Tellann the workflow. Keep the evidence.</h2>
        <p>
          Start a Guided QA Run, walk through the real application, and turn
          what happened into replay, coverage, reconciliation, and a structured
          QA report.
        </p>
        <div className="guided-actions">
          <Link className="is-primary" href="/desktop/download">
            Start with Tellann Desktop <span>→</span>
          </Link>
          <Link href="/product/flow-declaration">
            Explore Flow Declaration <span>→</span>
          </Link>
        </div>
        <small>Guided QA Runs are included on every Tellann plan.</small>
      </section>
    </main>
  );
}
