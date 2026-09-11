import type { Metadata } from "next";
import Link from "next/link";
import { ProductPlaceholder } from "@/components/product-tour";
import { SessionReplayExplorer } from "@/components/session-replay-explorer";
import "./session-replay.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://domain-name.com";
const dashboardUrl =
  process.env.NEXT_PUBLIC_APP_URL || "https://app.domain-name.com";

export const metadata: Metadata = {
  title: "Session Replay | Reconstruct Application Behavior",
  description:
    "Reconstruct application sessions with Tellann and inspect chronological navigation, interactions, state transitions, workflows, API activity, and errors behind your behavioral QA insights.",
  alternates: { canonical: "/product/session-replay" },
  openGraph: {
    title: "Session Replay | Reconstruct Application Behavior",
    description:
      "Replay observed sessions as structured behavioral timelines instead of opaque screen footage.",
    url: `${siteUrl}/product/session-replay`,
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

const eventCategories: [string, string[]][] = [
  ["Navigation", ["PAGE_VISIT", "ROUTE_CHANGE", "PAGE_EXIT"]],
  [
    "UI",
    [
      "BUTTON_CLICK",
      "LINK_CLICK",
      "TAB_CHANGE",
      "DROPDOWN_SELECTION",
      "COMPONENT_INTERACTION",
    ],
  ],
  ["Forms", ["FORM_STARTED", "FORM_SUBMITTED", "FORM_VALIDATION_FAILED"]],
  ["State", ["STATE_ENTERED", "STATE_EXITED", "STATE_TRANSITION"]],
  [
    "Workflow",
    [
      "WORKFLOW_STARTED",
      "WORKFLOW_COMPLETED",
      "WORKFLOW_FAILED",
      "WORKFLOW_ABANDONED",
    ],
  ],
  ["API", ["API_REQUEST", "API_RESPONSE", "API_ERROR", "API_TIMEOUT"]],
  [
    "Errors",
    ["ERROR_OCCURRED", "CLIENT_ERROR", "SERVER_ERROR", "UNHANDLED_EXCEPTION"],
  ],
];

const comparisonRows: [string, string][] = [
  ["Primarily visual footage", "Reconstructed behavioral timeline"],
  ["Harder to query structurally", "Events remain structured"],
  ["UI-focused", "UI, states, workflows, APIs, and errors"],
  ["Limited relationship to the graph", "Linked to the behavioral model"],
  ["Mostly passive playback", "Investigable event timeline"],
  [
    "Sensitive content can appear visually",
    "Privacy controls operate before storage",
  ],
];

const investigationQuestions: [string, string][] = [
  ["What happened before checkout failed?", "Replay → jump to API_ERROR"],
  ["Which route led to this state?", "Replay → preceding navigation"],
  ["Was this path actually demonstrated?", "Coverage → supporting sessions"],
  ["Which API call was involved?", "Replay → API timeline"],
  ["Where did this graph edge come from?", "Behavior Graph → supporting replay"],
];

const supportingSessions: string[][] = [
  ["SES-3817", "06:42", "Checkout", "428", "3", "10:32 · Demo 04"],
  ["SES-3824", "05:18", "Checkout", "361", "0", "11:05 · Demo 04"],
  ["SES-3901", "07:56", "Checkout", "502", "5", "14:47 · Demo 05"],
  ["SES-4012", "04:39", "Checkout", "298", "0", "09:12 · Demo 06"],
  ["SES-4044", "06:03", "Checkout", "395", "2", "16:20 · Demo 06"],
];

const faqs: [string, string][] = [
  [
    "What is Tellann Session Replay?",
    "Session Replay reconstructs an observed session from captured telemetry into a chronological behavioral timeline you can inspect, seek through, and trace back to workflows, states, API activity, and errors.",
  ],
  [
    "Is Session Replay a screen recording?",
    "No. Tellann replay is an interpretation of recorded behavioral events rather than video footage of a user's screen.",
  ],
  [
    "What does Tellann replay?",
    "Navigation, interface interactions, form activity, state changes, workflow progression, API activity, errors, and session lifecycle events.",
  ],
  [
    "What data is not captured?",
    "Passwords, PINs and security answers, card numbers, CVV values, payment tokens, JWTs, access and refresh tokens, API secrets, private keys, and raw uploaded file contents.",
  ],
  [
    "Can I jump directly to an error?",
    "Yes. Filter the timeline to errors or API failures and select the moment you need—the replay position, application state, and event metadata follow the selection.",
  ],
  [
    "Can I inspect API activity?",
    "Yes. Requests, responses, timeouts, and errors sit on the same timeline as the interface behavior that surrounded them.",
  ],
  [
    "Can I view the workflow associated with a session?",
    "Yes. Workflow markers such as WORKFLOW_STARTED and WORKFLOW_COMPLETED are replayable, so a session reads as workflow progression rather than a list of clicks.",
  ],
  [
    "Can a Behavior Graph link back to a replay?",
    "Yes. Replay is designed as the supporting evidence behind graph structure, so a transition can lead to the sessions that produced it.",
  ],
  [
    "How is event ordering preserved?",
    "Reconstruction orders events by timestamp, then sequence number, then arrival order, so concurrent or delayed events still resolve into a stable chronology.",
  ],
  [
    "What happens when events are missing?",
    "Gaps are flagged in the timeline rather than hidden, and timeline completeness, ordering accuracy, and missing-event counts are reported alongside the replay.",
  ],
  [
    "Can I change playback speed?",
    "Yes. Playback supports 1×, 2×, 5×, and 10× alongside play, pause, seek, previous event, and next event.",
  ],
  [
    "Can I replay demonstration sessions?",
    "Yes. Replay generation is a Phase 1 output of Demonstration Mode, so a demonstration remains inspectable after analysis completes.",
  ],
  [
    "How long are replays retained?",
    "Replay retention depends on your plan and organization policy rather than a single universal window.",
  ],
  [
    "Does Tellann support production-user replay today?",
    "No. Production session replay is planned for a later phase. Current replay begins from controlled demonstration evidence.",
  ],
  [
    "Does replay include passwords or card details?",
    "No. Authentication, credential, financial, and token values are never captured, and privacy controls apply before data reaches storage or analytics.",
  ],
];

function FeatureSection({
  eyebrow,
  title,
  copy,
  visual,
  note,
  surface = false,
  id,
  children,
}: {
  eyebrow: string;
  title: string;
  copy: string;
  visual: Visual;
  note?: string;
  surface?: boolean;
  id?: string;
  children?: React.ReactNode;
}) {
  return (
    <section
      className={`replay-feature${surface ? " is-surface" : ""}`}
      id={id}
    >
      <div className="replay-shell replay-heading">
        <p className="replay-kicker" data-aos="fade-up">{eyebrow}</p>
        <h2 data-aos="fade-up" data-aos-delay="60">{title}</h2>
        <p data-aos="fade-up" data-aos-delay="120">{copy}</p>
      </div>
      {children ? (
        <div className="replay-shell replay-feature-detail">{children}</div>
      ) : null}
      <div className="replay-contained-media">
        <VisualPlaceholder {...visual} />
        {note ? <p>{note}</p> : null}
      </div>
    </section>
  );
}

export default function SessionReplayPage() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Tellann Session Replay",
    description: metadata.description,
    url: `${siteUrl}/product/session-replay`,
  };

  return (
    <main className="replay-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      <section className="replay-hero pt-20!">
        <div className="replay-shell replay-hero-copy">
          <p className="replay-kicker" data-aos="fade-up">Session replay</p>
          <h1 data-aos="fade-up" data-aos-delay="60">Replay the behavior behind the insight.</h1>
          <p data-aos="fade-up" data-aos-delay="120">
            Reconstruct observed sessions as chronological behavioral timelines.
            Inspect navigation, interface interactions, state changes, workflow
            activity, API calls, and errors without relying on incomplete
            reproduction steps.
          </p>
          <div className="replay-actions">
            <a className="is-primary" href="#explorer">
              Explore a replay <span>↓</span>
            </a>
            <a href="#construction">
              See how replay is built <span>↓</span>
            </a>
            <Link href="/product/behavior-graphs">
              Explore Behavior Graphs <span>→</span>
            </Link>
          </div>
        </div>
        <div className="replay-shell-wide replay-hero-media replay-desktop-media" data-aos="tellann-panel">
          <VisualPlaceholder
            label="Hero replay viewer / product recording"
            master="1920 × 1200"
            display="1280 × 800"
          />
          <p>
            Master: 1920 × 1200 px (16:10) · Intended desktop display: 1280 ×
            800 px · 12–15 second loop · 68% replay canvas / 32% event timeline
          </p>
        </div>
        <div className="replay-mobile-media">
          <VisualPlaceholder
            label="Mobile hero replay / stacked canvas, controls, current event, timeline"
            master="1080 × 1350"
            display="1080 × 1350"
          />
          <p>
            Mobile master: 1080 × 1350 px (4:5) · Displayed at calc(100vw −
            32px) · Timeline shows 4–6 events at a time
          </p>
        </div>
      </section>

      <section className="replay-definition">
        <div className="replay-shell replay-heading">
          <p className="replay-kicker" data-aos="fade-up">What replay actually is</p>
          <h2 data-aos="fade-up" data-aos-delay="60">A reconstruction of behavior, not another screen recording.</h2>
          <p data-aos="fade-up" data-aos-delay="120">
            Tellann Session Replay is a behavioral reconstruction generated from
            captured telemetry. The events stay structured, so a session remains
            something you can query, filter, and trace rather than footage you
            scrub through.
          </p>
        </div>
        <div
          className="replay-shell replay-compare"
          role="table"
          aria-label="Traditional screen recording compared with Tellann Session Replay"
        >
          <div role="row" className="is-head">
            <span role="columnheader">Traditional screen recording</span>
            <span role="columnheader">Tellann Session Replay</span>
          </div>
          {comparisonRows.map(([legacy, tellann]) => (
            <div role="row" key={legacy}>
              <span role="cell">{legacy}</span>
              <span role="cell">{tellann}</span>
            </div>
          ))}
        </div>
        <div className="replay-contained-media">
          <VisualPlaceholder
            label="Screen recording versus behavioral replay / SVG or HTML design"
            master="1600 × 800"
            display="1000 × 500"
          />
        </div>
      </section>

      <section className="replay-construction" id="construction">
        <div className="replay-shell replay-heading">
          <p className="replay-kicker" data-aos="fade-up">From events to replay</p>
          <h2 data-aos="fade-up" data-aos-delay="60">Replay begins with structured telemetry.</h2>
          <p data-aos="fade-up" data-aos-delay="120">
            Captured events are grouped into a session, ordered into a
            chronology, assembled into a timeline, and persisted as a replay
            model the viewer can play back.
          </p>
        </div>
        <div className="replay-shell replay-pipeline">
          {[
            "Capture events",
            "Build session",
            "Order chronology",
            "Generate timeline",
            "Create replay model",
            "Replay viewer",
          ].map((item, index) => (
            <div key={item}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <b>{item}</b>
              {index < 5 ? <i>→</i> : null}
            </div>
          ))}
        </div>
        <div className="replay-contained-media">
          <VisualPlaceholder
            label="Event to replay construction / animated SVG design"
            master="1800 × 1000"
            display="1100 × 611"
          />
        </div>
        <div className="replay-shell replay-ordering">
          <p className="replay-kicker" data-aos="fade-up">Session ordering</p>
          <div>
            {["Timestamp", "Sequence number", "Arrival order"].map(
              (item, index) => (
                <span key={item}>
                  <small>{String(index + 1).padStart(2, "0")}</small>
                  <b>{item}</b>
                </span>
              ),
            )}
          </div>
          <p>
            Ordering falls back through each signal in turn, so events that
            arrive late or share a timestamp still resolve into a stable,
            explainable chronology.
          </p>
        </div>
      </section>

      <section className="replay-explorer-section" id="explorer">
        <div className="replay-shell replay-heading">
          <p className="replay-kicker" data-aos="fade-up">The replay viewer</p>
          <h2 data-aos="fade-up" data-aos-delay="60">One place to inspect the full behavioral session.</h2>
          <p data-aos="fade-up" data-aos-delay="120">
            Play the session, filter to the evidence you need, select any event
            to move the replay position, and inspect the workflow, state, and
            API context attached to that moment. The canvas remains a
            dimension-accurate placeholder for the final replay renderer.
          </p>
        </div>
        <div className="replay-shell-wide" data-aos="tellann-panel">
          <SessionReplayExplorer />
        </div>
        <p className="replay-shell replay-note">
          <b>Keyboard and timeline-only access:</b> every event is reachable
          with previous and next controls, and the timeline-only mode keeps the
          session usable when the visual reconstruction is unnecessary or
          inaccessible. Playback never starts on its own.
        </p>
      </section>

      <section className="replay-events">
        <div className="replay-shell replay-heading">
          <p className="replay-kicker" data-aos="fade-up">Event timeline</p>
          <h2 data-aos="fade-up" data-aos-delay="60">Every important moment remains inspectable.</h2>
          <p data-aos="fade-up" data-aos-delay="120">
            The replay model keeps events grouped by type, so a session can be
            read as navigation, interface activity, form behavior, state
            movement, workflow progression, API traffic, or errors.
          </p>
        </div>
        <div className="replay-shell replay-event-groups">
          {eventCategories.map(([group, events]) => (
            <article key={group}>
              <span>{group}</span>
              <ul>
                {events.map((event) => (
                  <li key={event}>{event}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
        <div className="replay-shell replay-timeline-pair">
          <VisualPlaceholder
            label="Chronological event timeline / UI design"
            master="1440 × 1000"
            display="720 × 500"
          />
          <div className="replay-interaction">
            <p className="replay-kicker" data-aos="fade-up">Selecting an event</p>
            <ul className="replay-list" data-aos="tellann-panel">
              <li>Move the replay position</li>
              <li>Highlight the relevant application state</li>
              <li>Open the event metadata</li>
              <li>Highlight the associated workflow</li>
              <li>Show linked API and error context</li>
            </ul>
            <p>
              A passive video timeline can only take you to a point in time. A
              structured timeline can take you to a specific piece of evidence.
            </p>
          </div>
        </div>
      </section>

      <FeatureSection
        eyebrow="Workflow context"
        title="Replay the session as a workflow, not a list of clicks."
        copy="Event chronology and workflow progression stay synchronized, so the same session can be read as raw behavior or as the business process it belonged to."
        note="Master 1600 × 900 px · Display 1000 × 562 px · Event timeline 55% / workflow timeline 45% with synchronized highlighting"
        visual={{
          label: "Synchronized event and workflow timelines / animated UI design",
          master: "1600 × 900",
          display: "1000 × 562",
        }}
      >
        <div className="replay-track-pair">
          <div>
            <small>Events</small>
            {[
              "PAGE_VISIT",
              "BUTTON_CLICK",
              "STATE_TRANSITION",
              "API_REQUEST",
              "API_RESPONSE",
            ].map((item) => (
              <b key={item}>{item}</b>
            ))}
          </div>
          <div>
            <small>Workflow</small>
            {[
              "PRODUCT_VIEW",
              "CART_ACTIVE",
              "CHECKOUT",
              "PAYMENT_PENDING",
              "PAYMENT_SUCCESS",
            ].map((item) => (
              <b key={item}>{item}</b>
            ))}
          </div>
        </div>
        <div className="replay-chip-row" data-aos="tellann-panel">
          <span>WORKFLOW_STARTED · Checkout</span>
          <span>WORKFLOW_COMPLETED · Checkout</span>
          <span>WORKFLOW_FAILED · Checkout</span>
        </div>
      </FeatureSection>

      <FeatureSection
        surface
        eyebrow="API and error context"
        title="See what the application was doing behind the interface."
        copy="Requests, responses, timeouts, errors, and exceptions sit on the same chronology as the interface behavior around them, so backend and frontend evidence never split into unrelated views."
        visual={{
          label: "API and error context overlay / animated UI design",
          master: "1600 × 900",
          display: "900 × 506",
        }}
        note="Master 1600 × 900 px · Display 900 × 506 px · Synchronized overlay rather than a separate table"
      >
        <div className="replay-trace">
          {[
            ["State", "CHECKOUT"],
            ["Request", "POST /payment"],
            ["Duration", "893 ms"],
            ["Status", "503"],
            ["Event", "API_ERROR"],
            ["Outcome", "PAYMENT_FAILED"],
          ].map(([label, value], index, list) => (
            <span key={label}>
              <small>{label}</small>
              <b>{value}</b>
              {index < list.length - 1 ? <i>↓</i> : null}
            </span>
          ))}
        </div>
      </FeatureSection>

      <section className="replay-jump">
        <div className="replay-shell replay-heading">
          <p className="replay-kicker" data-aos="fade-up">Jump to evidence</p>
          <h2 data-aos="fade-up" data-aos-delay="60">Skip the hunt. Jump to the moment that matters.</h2>
          <p data-aos="fade-up" data-aos-delay="120">
            Filter a session down to the events you actually came for, then
            select one to seek the replay directly to it.
          </p>
        </div>
        <div className="replay-shell replay-jump-grid">
          <div className="replay-jump-panel" data-aos="tellann-panel">
            <div className="replay-filter-preview" aria-hidden="true">
              {[
                "All events",
                "Errors",
                "API failures",
                "State changes",
                "Workflow events",
              ].map((item, index) => (
                <span key={item} className={index === 1 ? "is-active" : ""}>
                  {item}
                </span>
              ))}
            </div>
            <p className="replay-jump-count">3 errors found</p>
            <div className="replay-hit-list">
              {[
                ["00:02:41", "API_ERROR", "POST /cart · 500"],
                ["00:04:13", "ERROR_OCCURRED", "PaymentGatewayUnavailable"],
                ["00:05:22", "FORM_SUBMISSION_FAILED", "payment-form"],
              ].map(([time, type, detail]) => (
                <span key={time}>
                  <small>{time}</small>
                  <b>{type}</b>
                  <i>{detail}</i>
                </span>
              ))}
            </div>
            <small className="replay-sample-note">Sample application data</small>
          </div>
          <div className="replay-jump-copy">
            <p className="replay-kicker" data-aos="fade-up">Selecting a result</p>
            <ul className="replay-list" data-aos="tellann-panel">
              <li>Seek the replay straight to the event</li>
              <li>Highlight the state the application was in</li>
              <li>Open the event metadata</li>
              <li>Reveal the workflow it belonged to</li>
            </ul>
            <p>
              An investigation usually starts with a symptom rather than a
              timestamp. Filtering turns the symptom into a position on the
              timeline.
            </p>
          </div>
        </div>
        <div className="replay-contained-media">
          <VisualPlaceholder
            label="Jump-to-error interaction / product recording"
            master="1920 × 1200"
            display="1000 × 625"
          />
          <p>
            Master 1920 × 1200 px · Display 1000 × 625 px · 7–9 second loop ·
            Filter, select, seek, highlight, inspect
          </p>
        </div>
      </section>

      <section className="replay-connections">
        <div className="replay-shell replay-connection-grid">
          <article>
            <div className="replay-connection-head">
              <div>
                <p className="replay-kicker" data-aos="fade-up">Replay + Behavior Graph</p>
                <h2 data-aos="fade-up" data-aos-delay="60">
                  Move between the behavioral map and the session that created
                  it.
                </h2>
                <p data-aos="fade-up" data-aos-delay="120">
                  Select a transition such as CHECKOUT → PAYMENT_FAILED, open
                  its supporting sessions, and land in the replay at the exact
                  timestamp that produced the edge.
                </p>
                <Link
                  href="/product/behavior-graphs"
                  className="replay-inline-link"
                >
                  Explore Behavior Graphs <span>→</span>
                </Link>
              </div>
              <div className="replay-evidence-chain">
                <span>CHECKOUT → PAYMENT_FAILED</span>
                <span>Observed in 38 sessions</span>
                <span>SES-3817 · 00:04:11</span>
                <span>Replay opens at the transition</span>
              </div>
            </div>
            <VisualPlaceholder
              label="Behavior Graph to replay / product recording"
              master="1920 × 1200"
              display="1000 × 625"
            />
            <p>
              Master 1920 × 1200 px · Display 1000 × 625 px · 8–10 second loop
            </p>
          </article>
          <article>
            <div className="replay-connection-head">
              <div>
                <p className="replay-kicker" data-aos="fade-up">Replay + coverage</p>
                <h2 data-aos="fade-up" data-aos-delay="60">Understand which paths produced your coverage.</h2>
                <p data-aos="fade-up" data-aos-delay="120">
                  A coverage result should be traceable to observed behavior
                  rather than an arbitrary percentage, so every measured path
                  can lead back to the sessions behind it.
                </p>
              </div>
              <div className="replay-coverage-block">
                <span>
                  <small>Workflow</small>
                  <b>Checkout</b>
                </span>
                <span>
                  <small>Coverage</small>
                  <b>72%</b>
                </span>
                <span>
                  <small>Observed path</small>
                  <b>Product → Cart → Checkout → Success</b>
                </span>
                <span>
                  <small>Supporting sessions</small>
                  <b>143</b>
                </span>
              </div>
            </div>
            <VisualPlaceholder
              label="Coverage to replay evidence / SVG or UI design"
              master="1500 × 800"
              display="960 × 512"
            />
            <p>Master 1500 × 800 px · Display 960 × 512 px</p>
          </article>
        </div>
      </section>

      <section className="replay-integrity">
        <div className="replay-shell replay-heading">
          <p className="replay-kicker" data-aos="fade-up">Replay integrity</p>
          <h2 data-aos="fade-up" data-aos-delay="60">A replay should tell you how complete its evidence is.</h2>
          <p data-aos="fade-up" data-aos-delay="120">
            Incomplete data is reported, not hidden. Timeline completeness,
            ordering accuracy, missing-event counts, and privacy filtering
            travel with the replay so you know how much weight the evidence can
            carry.
          </p>
        </div>
        <div className="replay-shell replay-integrity-grid">
          <div className="replay-integrity-card">
            <p>Replay integrity</p>
            <dl>
              <div>
                <dt>Timeline completeness</dt>
                <dd>98%</dd>
              </div>
              <div>
                <dt>Ordering accuracy</dt>
                <dd>100%</dd>
              </div>
              <div>
                <dt>Missing events</dt>
                <dd>3</dd>
              </div>
              <div>
                <dt>Privacy filtering</dt>
                <dd>Applied</dd>
              </div>
            </dl>
            <small>Sample application data</small>
          </div>
          <div className="replay-gap">
            <p className="replay-kicker" data-aos="fade-up">Missing event representation</p>
            <span>
              <small>00:03:08</small>
              <b>API_REQUEST</b>
            </span>
            <i>↓</i>
            <span className="is-gap">
              <small>Event gap</small>
              <b>~620 ms unaccounted</b>
            </span>
            <i>↓</i>
            <span>
              <small>00:03:09</small>
              <b>API_RESPONSE</b>
            </span>
            <p>
              A flagged gap is more useful than a timeline that pretends to be
              perfect.
            </p>
          </div>
        </div>
        <div className="replay-contained-media">
          <VisualPlaceholder
            label="Replay integrity card / product UI design"
            master="1400 × 800"
            display="760 × 434"
          />
        </div>
      </section>

      <section className="replay-privacy">
        <div className="replay-shell replay-heading">
          <p className="replay-kicker" data-aos="fade-up">Privacy by default</p>
          <h2 data-aos="fade-up" data-aos-delay="60">Replay behavior without replaying secrets.</h2>
          <p data-aos="fade-up" data-aos-delay="120">
            Privacy controls run before protected information enters storage or
            analytics, so authentication, financial, credential, and identity
            values never become part of a replay.
          </p>
        </div>
        <div className="replay-shell replay-privacy-grid" data-aos="tellann-panel">
          <article>
            <span>Recorded</span>
            <ul>
              {[
                "Navigation",
                "Clicks",
                "UI interactions",
                "State changes",
                "Workflow progression",
                "API metadata",
                "Errors",
              ].map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
          <article>
            <span>Masked</span>
            <ul>
              {[
                "Emails",
                "User identifiers",
                "Contact information",
                "Configured fields",
              ].map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
          <article className="is-excluded">
            <span>Never recorded</span>
            <ul>
              {[
                "Passwords",
                "PINs",
                "Security answers",
                "Card numbers",
                "CVV",
                "Payment tokens",
                "JWTs",
                "Access tokens",
                "Refresh tokens",
                "API secrets",
                "Private keys",
                "Raw uploaded files",
              ].map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
        </div>
        <div className="replay-shell replay-privacy-demo">
          <div>
            <p className="replay-kicker" data-aos="fade-up">Observed in the application</p>
            <span>
              <small>Email</small>
              <b>user@example.com</b>
            </span>
            <span>
              <small>Password</small>
              <b>••••••••</b>
            </span>
          </div>
          <i aria-hidden="true">→</i>
          <div>
            <p className="replay-kicker" data-aos="fade-up">Available in replay</p>
            <span>
              <small>Email</small>
              <b>***@example.com</b>
            </span>
            <span>
              <small>Password</small>
              <b>[NOT CAPTURED]</b>
            </span>
          </div>
        </div>
        <div className="replay-contained-media">
          <VisualPlaceholder
            label="Privacy filtering before storage / animated SVG or UI design"
            master="1400 × 800"
            display="900 × 514"
          />
          <p>
            Master 1400 × 800 px · Display 900 × 514 px · 4–5 second sequence ·
            Behavior, classification, filtering, protected value removed
          </p>
        </div>
      </section>

      <section className="replay-summary">
        <div className="replay-shell replay-heading">
          <p className="replay-kicker" data-aos="fade-up">Session summary</p>
          <h2 data-aos="fade-up" data-aos-delay="60">See the session before you press play.</h2>
          <p data-aos="fade-up" data-aos-delay="120">
            Duration, event volume, workflow count, error count, and API
            activity give a session shape before you commit to watching it.
          </p>
        </div>
        <div className="replay-shell replay-summary-grid" data-aos="tellann-panel">
          <div className="replay-summary-card">
            <p>Session SES-3817</p>
            <div>
              {[
                ["Duration", "06:42"],
                ["Events", "428"],
                ["Workflows", "6"],
                ["Errors", "3"],
                ["API requests", "48"],
              ].map(([label, value]) => (
                <span key={label}>
                  <small>{label}</small>
                  <b>{value}</b>
                </span>
              ))}
            </div>
            <small>Sample application data</small>
          </div>
          <dl className="replay-meta-list">
            {[
              ["Session type", "DEMONSTRATION"],
              ["Application", "Storefront Demo"],
              ["Started", "10:32:18"],
              ["Ended", "10:39:00"],
              ["Environment", "demo"],
            ].map(([term, value]) => (
              <div key={term}>
                <dt>{term}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <FeatureSection
        surface
        eyebrow="Demonstration replay"
        title="Your demonstration remains inspectable after analysis."
        copy="Replay is a Phase 1 output of Demonstration Mode. Record a workflow, let analysis run, and the session stays available as evidence rather than disappearing into a summary."
        note="Master 1920 × 1200 px · Display 1100 × 688 px · 10–12 second loop · Start, workflow, stop, analysis, open session, replay"
        visual={{
          label: "Demonstration to replay / product recording",
          master: "1920 × 1200",
          display: "1100 × 688",
        }}
      >
        <div className="replay-flow-list" data-aos="tellann-panel">
          {[
            "Start demonstration",
            "Perform workflow",
            "End session",
            "Behavior analysis",
            "Replay generated",
          ].map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
        <Link href="/product/demonstration-mode" className="replay-inline-link">
          Explore Demonstration Mode <span>→</span>
        </Link>
      </FeatureSection>

      <section className="replay-sessions">
        <div className="replay-shell replay-heading">
          <p className="replay-kicker" data-aos="fade-up">Multiple session investigation</p>
          <h2 data-aos="fade-up" data-aos-delay="60">One workflow can have many supporting sessions.</h2>
          <p data-aos="fade-up" data-aos-delay="120">
            Checkout is not one recording. Select and inspect the separate
            sessions behind it—successes, payment failures, and validation
            failures all belong to the same evidence set.
          </p>
        </div>
        <div className="replay-shell replay-session-table" data-aos="tellann-panel"
          role="table"
          aria-label="Supporting sessions for the Checkout workflow"
        >
          <div role="row" className="is-head">
            {["Session", "Duration", "Workflow", "Events", "Errors", "Recorded"].map(
              (heading) => (
                <span role="columnheader" key={heading}>
                  {heading}
                </span>
              ),
            )}
          </div>
          {supportingSessions.map((row) => (
            <div role="row" key={row[0]}>
              {row.map((cell, index) => (
                <span role="cell" key={`${row[0]}-${index}`}>
                  {cell}
                </span>
              ))}
            </div>
          ))}
        </div>
        <p className="replay-shell replay-note">
          <b>Phase 1 scope:</b> comparing evidence here means selecting and
          inspecting separate recorded sessions. Formal regression comparison
          belongs to a later phase.
        </p>
      </section>

      <section className="replay-structure">
        <div className="replay-shell replay-structure-grid">
          <article>
            <p className="replay-kicker" data-aos="fade-up">Replay asset structure</p>
            <h2 data-aos="fade-up" data-aos-delay="60">What a replay actually holds.</h2>
            <p data-aos="fade-up" data-aos-delay="120">
              A replay is a structured asset rather than a media file. Each part
              stays addressable, which is what makes filtering, seeking, and
              linking back to the behavioral model possible.
            </p>
            <details className="replay-details">
              <summary>
                Technical details
                <span>+</span>
              </summary>
              <p>
                Storage implementation, encoding, and retention mechanics are
                deliberately kept out of the product surface. What matters for
                investigation is that the timeline, workflow context, API
                activity, error context, and replay metadata remain separately
                addressable.
              </p>
            </details>
          </article>
          <div className="replay-asset-tree" aria-label="Replay asset structure">
            <b>Replay</b>
            {[
              "Timeline",
              "Workflow context",
              "Errors",
              "API activity",
              "Replay metadata",
            ].map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        </div>
        <div className="replay-shell replay-retention">
          <div>
            <p className="replay-kicker" data-aos="fade-up">Retention</p>
            <p>
              Replay retention depends on your plan and organization policy.
            </p>
          </div>
          <Link href="/pricing" className="replay-inline-link">
            View pricing <span>→</span>
          </Link>
        </div>
      </section>

      <section className="replay-exclusions">
        <div className="replay-shell replay-heading">
          <p className="replay-kicker" data-aos="fade-up">Boundaries</p>
          <h2 data-aos="fade-up" data-aos-delay="60">More data is not always better data.</h2>
          <p data-aos="fade-up" data-aos-delay="120">
            Some information should never reach a replay at all. Excluding it is
            a product decision, not a limitation—only appropriate metadata is
            retained for uploaded files.
          </p>
        </div>
        <div className="replay-shell replay-exclusion-grid" data-aos="tellann-panel">
          {[
            "Passwords",
            "OTP and PIN values",
            "Payment card information",
            "Authentication tokens",
            "Private keys",
            "Highly sensitive identity data",
            "Raw uploaded document contents",
            "Images",
            "Videos",
            "Audio contents",
          ].map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
      </section>

      <section className="replay-questions">
        <div className="replay-shell replay-heading">
          <p className="replay-kicker" data-aos="fade-up">Why this is useful</p>
          <h2 data-aos="fade-up" data-aos-delay="60">Investigation questions, answered with evidence.</h2>
          <p data-aos="fade-up" data-aos-delay="120">
            Replay earns its place when it shortens the distance between a
            question and the moment that answers it.
          </p>
        </div>
        <div className="replay-shell replay-question-grid" data-aos="tellann-panel">
          {investigationQuestions.map(([question, answer], index) => (
            <article key={question}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <h3>{question}</h3>
              <code>{answer}</code>
            </article>
          ))}
        </div>
      </section>

      <section className="replay-chain">
        <div className="replay-shell replay-heading">
          <p className="replay-kicker" data-aos="fade-up">The reasoning chain</p>
          <h2 data-aos="fade-up" data-aos-delay="60">
            The graph gives you structure. The replay gives you evidence.
          </h2>
          <p data-aos="fade-up" data-aos-delay="120">
            Each layer explains a little more about what happened, and every
            layer stays connected to the one beneath it.
          </p>
        </div>
        <div className="replay-shell replay-chain-grid" data-aos="tellann-panel">
          {[
            ["Event", "Something happened."],
            ["Session", "We know when it happened."],
            ["Workflow", "We know what process it belonged to."],
            ["State", "We know where the application was."],
            ["API / error", "We know what happened underneath."],
            ["Replay", "We can reconstruct the entire context."],
            ["Graph / coverage", "We can connect evidence back to the model."],
          ].map(([label, copy], index, list) => (
            <div key={label}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <b>{label}</b>
              <p>{copy}</p>
              {index < list.length - 1 ? <i>↓</i> : null}
            </div>
          ))}
        </div>
      </section>

      <section className="replay-future">
        <div className="replay-shell replay-heading">
          <p className="replay-kicker" data-aos="fade-up">Where replay goes next</p>
          <h2 data-aos="fade-up" data-aos-delay="60">Current capability stays separate from planned capability.</h2>
          <p data-aos="fade-up" data-aos-delay="120">
            Today Tellann replays controlled demonstration sessions. Production
            replay, error correlation, and regression investigation are labelled
            as planned rather than blended into the current product.
          </p>
        </div>
        <div className="replay-shell replay-phase-grid" data-aos="tellann-panel">
          <article>
            <span>Phase 01 · Behavioral QA</span>
            <p>
              Demonstration session replay · Chronological timeline · Workflow
              context · API context · Error context · Behavior Graph support ·
              Coverage support
            </p>
          </article>
          <article>
            <span>Phase 02 · Planned</span>
            <p>
              Production session replay · Journey intelligence context · Error
              correlation · Workflow health investigation · Friction and
              bottleneck context
            </p>
          </article>
          <article>
            <span>Phase 03 · Planned</span>
            <p>
              Regression investigation · Generated-test validation ·
              Failure-simulation analysis · Anomaly investigation ·
              Quality-intelligence explanations
            </p>
          </article>
        </div>
      </section>

      <section className="replay-faq">
        <div className="replay-shell replay-faq-grid">
          <div>
            <p className="replay-kicker" data-aos="fade-up">FAQ</p>
            <h2 data-aos="fade-up" data-aos-delay="60">Questions behind the evidence.</h2>
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

      <section className="replay-final">
        <div className="replay-shell">
          <p className="replay-kicker" data-aos="fade-up">Follow the evidence</p>
          <h2 data-aos="fade-up" data-aos-delay="60">See the session behind the behavior.</h2>
          <p data-aos="fade-up" data-aos-delay="120">
            Record a demonstration, reconstruct the session, and investigate the
            exact sequence of events, states, workflows, API activity, and
            errors behind what Tellann discovered.
          </p>
          <div className="replay-actions">
            <a className="is-primary" href={dashboardUrl}>
              Start free <span>↗</span>
            </a>
            <Link href="/product/demonstration-mode">
              Explore Demonstration Mode <span>→</span>
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
