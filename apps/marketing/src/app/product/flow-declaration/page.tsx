import type { Metadata } from "next";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { FlowBuilderDemo } from "@/components/flow-builder-demo";
import { IntentObservationToggle } from "@/components/intent-observation-toggle";
import { ProductPlaceholder } from "@/components/product-tour";
import { ReconciliationExplorer } from "@/components/reconciliation-explorer";
import { SuggestionReview } from "@/components/suggestion-review";
import "./flow-declaration.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://domain-name.com";
const dashboardUrl =
  process.env.NEXT_PUBLIC_APP_URL || "https://app.domain-name.com";

export const metadata: Metadata = {
  title:
    "Flow Declaration — Define Intended Application Workflows | Tellann",
  description:
    "Define the workflows your application is intended to support, review suggested failure and edge-case branches, and let Tellann reconcile declared intent against demonstrated behavior.",
  alternates: { canonical: "/product/flow-declaration" },
  openGraph: {
    title:
      "Flow Declaration — Define Intended Application Workflows | Tellann",
    description:
      "Declare what should happen, then let Tellann compare it with what actually happened.",
    url: `${siteUrl}/product/flow-declaration`,
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

/** Full-width section: heading, optional detail columns, then contained media. */
function MediaSection({
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
  children?: ReactNode;
}) {
  return (
    <section
      className={`decl-media-section${surface ? " is-surface" : ""}`}
      id={id}
    >
      <div className="decl-shell decl-heading">
        <p className="decl-kicker" data-aos="fade-up">
          {eyebrow}
        </p>
        <h2 data-aos="fade-up" data-aos-delay="60">
          {title}
        </h2>
        <p data-aos="fade-up" data-aos-delay="120">
          {copy}
        </p>
      </div>
      {children ? (
        <div className="decl-shell decl-section-detail">{children}</div>
      ) : null}
      <div className="decl-contained-media">
        <VisualPlaceholder {...visual} />
        {note ? <p>{note}</p> : null}
      </div>
    </section>
  );
}

/** Media beside a panel of supporting product detail. */
function AsideSection({
  eyebrow,
  title,
  copy,
  visual,
  mediaWidth,
  reverse = false,
  surface = false,
  id,
  children,
}: {
  eyebrow: string;
  title: string;
  copy: string;
  visual: Visual;
  mediaWidth: number;
  reverse?: boolean;
  surface?: boolean;
  id?: string;
  children?: ReactNode;
}) {
  return (
    <section
      className={`decl-aside-section${reverse ? " is-reverse" : ""}${
        surface ? " is-surface" : ""
      }`}
      id={id}
    >
      <div className="decl-shell decl-heading">
        <p className="decl-kicker" data-aos="fade-up">
          {eyebrow}
        </p>
        <h2 data-aos="fade-up" data-aos-delay="60">
          {title}
        </h2>
        <p data-aos="fade-up" data-aos-delay="120">
          {copy}
        </p>
      </div>
      <div
        className="decl-shell decl-aside-grid"
        data-aos="tellann-panel"
        style={{ "--media-w": `${mediaWidth}px` } as CSSProperties}
      >
        <VisualPlaceholder {...visual} />
        <div className="decl-aside-panel">{children}</div>
      </div>
    </section>
  );
}

function Chain({
  items,
  gap = false,
}: {
  items: string[];
  gap?: boolean;
}) {
  return (
    <div className={`decl-chain${gap ? " is-gap" : ""}`}>
      {items.map((item) => (
        <b key={item}>{item}</b>
      ))}
    </div>
  );
}

const lifecycle = [
  "Add state",
  "Analyze state",
  "Generate suggestions",
  "Review",
  "Accept / reject",
  "Add next state",
  "Mark flow complete",
  "Compile ruleset",
];

const suggestionSources: [string, string, string, string][] = [
  [
    "Pattern library",
    "INTERNAL_LIBRARY",
    "Curated QA patterns maintained by Tellann.",
    "LOGIN → Login failure · Account locked · Session timeout",
  ],
  [
    "Cross-application pattern",
    "CROSS_TENANT",
    "Anonymized, aggregated structural shape data — never another organization's identity, metadata, or payloads.",
    "Aggregate structure frequently branches here.",
  ],
  [
    "Assistive enrichment",
    "ASSISTIVE_ENRICHMENT",
    "Bounded assistance for novel state names, normalized and schema-validated before it is ever shown.",
    "Used only when internal sources are insufficient.",
  ],
];

const runModes: [string, string][] = [
  ["Guided", "A declared flow directs the walkthrough, boundary to boundary."],
  [
    "Assisted",
    "The developer navigates freely while Tellann relates the activity to declared intent.",
  ],
  [
    "Observation only",
    "Record behavior without prompting or directing the session.",
  ],
];

const reconciliationStates: [string, string, string, string][] = [
  [
    "Confirmed",
    "Declared + observed",
    "PAYMENT_SUCCESS",
    "A state or transition existed in the declared flow and was observed during demonstration.",
  ],
  [
    "True gap",
    "Declared + not observed",
    "PAYMENT_FAILURE",
    "A state or transition was explicitly declared but never observed. Stronger than an inferred absence.",
  ],
  [
    "Undeclared",
    "Observed + not declared",
    "PROMO_CODE_REJECTED",
    "Tellann observed behavior that was not in the declared flow. Surfaced for review, not treated as an error.",
  ],
];

const undeclaredMeanings = [
  "the declaration is incomplete",
  "a legitimate flow nobody wrote down",
  "unintended behavior",
  "new behavior that deserves review",
];

const permitted = [
  "Suggest branches",
  "Draft candidate intent",
  "Choose an appropriate rule pack",
];

const notPermitted = [
  "Auto-add to declared intent",
  "Generate evidence",
  "Generate behavioral findings",
  "Decide quality",
  "Assign risk autonomously",
];

const isNot = [
  "a requirement to manually map the whole application",
  "a BPMN replacement",
  "a generic whiteboard",
  "an automatic truth generator",
  "proof that declared behavior exists",
  "a test result",
  "an AI-generated workflow applied without review",
  "a replacement for observed behavior",
];

const faqs: [string, string][] = [
  [
    "What is Flow Declaration?",
    "Flow Declaration is how a team describes the workflows an application is intended to support. Declared states and transitions form a Declared Intent Graph that Tellann can later compare against demonstrated behavior.",
  ],
  [
    "Do I have to declare flows?",
    "No. Declaration is optional at the application level. An application with no declared flows still gets observation, workflow discovery, coverage, missing-state analysis, and every other behavioral surface.",
  ],
  [
    "What is the Declared Intent Graph?",
    "It is the combined set of declared states and transitions across an application's declared flows — what the team says should happen, kept separate from telemetry.",
  ],
  [
    "How is it different from the Behavior Graph?",
    "The Declared Intent Graph expresses intent. The Demonstrated Behavior Graph expresses evidence. Tellann keeps them independently queryable and derives reconciliation as a comparison rather than merging them.",
  ],
  [
    "How do I create a flow?",
    "Add one meaningful state at a time. Each addition is analyzed, suggestions are generated, you review and accept or reject them, and the flow is marked complete when the team says it is ready.",
  ],
  [
    "What is a state?",
    "A state is one meaningful application condition — a navigation, UI, business, error, or system condition such as CART_ACTIVE or PAYMENT_FAILURE.",
  ],
  [
    "What is a transition?",
    "A transition connects two declared states and can optionally describe the trigger that moves between them, such as PAYMENT_REJECTED.",
  ],
  [
    "What is an entry state?",
    "An entry state marks where meaningful behavior for the flow begins. Activity before it — login, setup, navigation — is kept as context rather than counted as flow evidence.",
  ],
  [
    "What is a terminal state?",
    "A terminal state marks where the flow ends. Together with the entry state it gives demonstrations and reconciliation a precise evidence scope.",
  ],
  [
    "Can Tellann suggest branches?",
    "Yes. As each state is added, the derivation engine can propose failure paths, edge states, recovery states, and category-appropriate variants.",
  ],
  [
    "Where do those suggestions come from?",
    "Three sources, each labelled on the suggestion: the curated pattern library, anonymized cross-application structural patterns, and bounded assistive enrichment for novel state names.",
  ],
  [
    "Are suggestions added automatically?",
    "No. A suggestion never becomes declared intent until a human accepts it. Automatic addition to the Declared Intent Graph is explicitly prohibited.",
  ],
  [
    "Can I accept only some suggestions?",
    "Yes. In a whole-flow review you preview the full effect of the proposed changes and apply only the subset you choose.",
  ],
  [
    "Can I reject suggestions?",
    "Yes, and rejections are retained so an unchanged suggestion is not repeatedly resurfaced.",
  ],
  [
    "Can Tellann draft a whole flow?",
    "Tellann can draft candidate intent from supplied materials such as a requirement or process document. The result stays a suggestion until the team reviews, corrects, and accepts it.",
  ],
  [
    "What happens when a flow is complete?",
    "The declared graph is snapshotted and the flow begins contributing to the application's compiled ruleset and to reconciliation reporting. Draft flows do neither.",
  ],
  [
    "What is the application ruleset?",
    "A versioned composition of generic QA rules, declared flow rules, and accepted suggestion rules. It is what Tellann evaluates demonstrated behavior against.",
  ],
  [
    "How does declaration affect Demonstration Mode?",
    "A declared flow turns a demonstration into a guided validation walkthrough: Tellann knows the intended boundaries and expected states while the developer demonstrates.",
  ],
  [
    "How are declared and observed states compared?",
    "The reconciliation engine compares the Declared Intent Graph with the Observed Behavior Graph without assuming either is automatically correct.",
  ],
  [
    "What is CONFIRMED?",
    "A state or transition that was declared and observed. It represents evidence-backed coverage.",
  ],
  [
    "What is TRUE_GAP?",
    "A state or transition that was explicitly declared and never observed. It is stronger than an inferred missing state because a person stated the behavior should exist.",
  ],
  [
    "What is UNDECLARED?",
    "Behavior that was observed but not declared. It is surfaced for review and never treated as an error by default.",
  ],
  [
    "Can I edit a declaration later?",
    "Yes. A completed flow can be reopened, edited, and completed again as a new version. Tellann does not overwrite a user-authored declaration because later evidence conflicts with it.",
  ],
  [
    "How does Tellann preserve authorship and provenance?",
    "Every declared node records how it entered intent — USER_AUTHORED, SUGGESTED_ACCEPTED, or DEMONSTRATION_PROMOTED — while observed nodes carry telemetry provenance separately.",
  ],
  [
    "Does this use AI?",
    "Assistance can propose branches, draft candidate intent, and select a rule pack. It cannot add to declared intent, generate evidence, generate findings, decide quality, or assign risk.",
  ],
  [
    "Can Tellann work without declaring anything?",
    "Yes. Observation alone still produces a behavior graph, discovered workflows, coverage, and gap analysis. Declaration adds an explicit, human-approved baseline on top of that.",
  ],
];

export default function FlowDeclarationPage() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Tellann Flow Declaration",
    description: metadata.description,
    url: `${siteUrl}/product/flow-declaration`,
  };

  return (
    <main className="decl-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      {/* 02 Hero */}
      <section className="decl-hero pt-20!">
        <div className="decl-shell decl-hero-copy">
          <p className="decl-kicker" data-aos="fade-up">
            Flow declaration
          </p>
          <h1 data-aos="fade-up" data-aos-delay="60">
            Define what should happen before you measure what did.
          </h1>
          <p data-aos="fade-up" data-aos-delay="120">
            Declare the workflows your application is intended to support,
            review suggested failure and edge-case branches, and give Tellann a
            human-approved baseline to compare against demonstrated behavior.
          </p>
          <div className="decl-actions">
            <a className="is-primary" href="#builder">
              Declare a sample flow <span>↓</span>
            </a>
            <a href="#intent-vs-observation">
              See intent vs observation <span>↓</span>
            </a>
            <Link href="/product/demonstration-mode">
              Explore Demonstration Mode <span>→</span>
            </Link>
          </div>
        </div>
        <div
          className="decl-shell-wide decl-hero-media decl-desktop-media"
          data-aos="tellann-panel"
        >
          <VisualPlaceholder
            label="Hero declared vs demonstrated reconciliation / interactive SVG or canvas design"
            master="1920 × 1180"
            display="1360 × 800"
          />
          <p>
            Master 1920 × 1180 px · Desktop display 1360 × 800 px · 10–12 second
            build, then interactive · Declared checkout flow, demonstrated graph
            beside it, matching nodes connect, then Confirmed, True gap, and
            Undeclared resolve · Does not loop
          </p>
        </div>
        <div className="decl-mobile-media">
          <VisualPlaceholder
            label="Mobile hero / vertical declared, demonstrated and result comparison"
            master="1080 × 1440"
            display="1080 × 1440"
          />
          <p>
            Mobile master 1080 × 1440 px (3:4) · Displayed at calc(100vw − 32px)
            · Declared above demonstrated, result summary underneath
          </p>
        </div>
      </section>

      {/* 03 Intent vs observation */}
      <section className="decl-definition" id="intent-vs-observation">
        <div className="decl-shell decl-heading">
          <p className="decl-kicker" data-aos="fade-up">
            Intent vs observation
          </p>
          <h2 data-aos="fade-up" data-aos-delay="60">
            Tellann keeps intent and evidence separate.
          </h2>
          <p data-aos="fade-up" data-aos-delay="120">
            The declared graph is not a replacement for automatic discovery. It
            exists alongside it, and reconciliation is derived by comparing the
            two rather than by merging them into a single source of truth.
          </p>
        </div>
        <div className="decl-shell decl-split" data-aos="tellann-panel">
          <article>
            <span>Declared graph</span>
            <b>What people say should happen.</b>
            <ul>
              {[
                "USER_AUTHORED",
                "SUGGESTED_ACCEPTED",
                "DEMONSTRATION_PROMOTED",
              ].map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
          <article>
            <span>Observed graph</span>
            <b>What telemetry proves happened.</b>
            <ul>
              <li>TELEMETRY_OBSERVED</li>
            </ul>
          </article>
        </div>
        <div className="decl-shell decl-why-grid">
          {[
            ["Declared only", "Potential true gap"],
            ["Observed only", "Unspecified behavior"],
            ["Declared + observed", "Confirmed behavior"],
          ].map(([left, right], index) => (
            <span
              key={left}
              data-aos="fade-up"
              data-aos-delay={String((index + 1) * 60)}
            >
              <small>{String(index + 1).padStart(2, "0")}</small>
              <b>{left}</b>
              <i aria-hidden="true">↓</i>
              <em>{right}</em>
            </span>
          ))}
        </div>
        <p className="decl-shell decl-note">
          <b>Why the distinction matters:</b> a system that can only say
          &ldquo;not observed&rdquo; is weaker than one that can say &ldquo;you
          specifically said this should happen, and we never saw it.&rdquo; That
          is the difference between an inferred absence and a true gap.
        </p>
        <div className="decl-shell-wide decl-toggle-wrap" data-aos="tellann-panel">
          <IntentObservationToggle />
          <p className="decl-media-note">
            Master 1600 × 900 px · Display 1000 × 562 px · Interactive toggle
            across Declared, Demonstrated, and Reconciled
          </p>
        </div>
      </section>

      {/* 04 What is a declared flow */}
      <MediaSection
        surface
        eyebrow="What a declared flow is"
        title="A declared flow describes behavior the team expects the application to support."
        copy="It contains intended states and transitions — not captured evidence. Nothing in a declared flow claims that the behavior exists yet."
        note="Master 1600 × 900 px · Display 1000 × 562 px · Checkout branching into success and failure, failure continuing into retry"
        visual={{
          label: "Declared checkout flow / SVG design",
          master: "1600 × 900",
          display: "1000 × 562",
        }}
      >
        <div>
          <p className="decl-panel-label">Checkout · declared</p>
          <Chain
            items={["PRODUCT_VIEW", "CART_ACTIVE", "CHECKOUT", "PAYMENT_PENDING"]}
          />
        </div>
        <div>
          <p className="decl-panel-label">Declared branches</p>
          <div className="decl-branch">
            <span>
              <b>PAYMENT_SUCCESS</b>
              <small>Terminal</small>
            </span>
            <span>
              <b>PAYMENT_FAILURE</b>
              <small>Continues into RETRY</small>
            </span>
          </div>
          <p className="decl-panel-copy">
            A declared flow is deliberately small. It names the states that
            matter to the team, and it stays a draft until someone says it is
            ready.
          </p>
        </div>
      </MediaSection>

      {/* 05 Declared Intent Graph */}
      <MediaSection
        eyebrow="Declared intent graph"
        title="Multiple declared flows become the application's intent map."
        copy="Each completed or in-progress declared workflow contributes to one application-level intent graph. It carries no session counts or telemetry metrics, because it represents intent rather than evidence."
        note="Master 1800 × 1100 px · Display 1100 × 672 px · Controls: workflow filter, Fit, Zoom +, Zoom − · No observed metrics on this graph"
        visual={{
          label: "Declared intent graph / SVG or canvas design",
          master: "1800 × 1100",
          display: "1100 × 672",
        }}
      >
        <div>
          <p className="decl-panel-label">Declared workflows</p>
          <Chain
            items={[
              "Registration",
              "Authentication",
              "Product browsing",
              "Checkout",
              "Payment",
            ]}
          />
        </div>
        <div>
          <p className="decl-panel-label">Graph controls</p>
          <div className="decl-control-strip">
            {["Workflow · All", "Fit", "Zoom +", "Zoom −"].map((control) => (
              <span key={control}>{control}</span>
            ))}
          </div>
          <p className="decl-panel-copy">
            Authentication branches to Profile as well as to Product browsing.
            The intent map is a graph, not a single line, and a state can be
            shared by more than one declared workflow.
          </p>
        </div>
      </MediaSection>

      {/* 06 How flow declaration works */}
      <MediaSection
        surface
        eyebrow="How flow declaration works"
        title="Build the flow one meaningful state at a time."
        copy="Each state you add is analyzed, suggestions are generated around it, and nothing enters the declaration until you review and decide. The loop repeats until the flow is marked complete."
        note="Master 1800 × 1000 px · Display 1100 × 611 px · 8–10 second sequence · Add LOGIN, Tellann proposes LOGIN_FAILURE, user accepts, add AUTHENTICATED, connect transition, mark complete"
        id="lifecycle"
        visual={{
          label: "Declaration lifecycle / animated SVG design",
          master: "1800 × 1000",
          display: "1100 × 611",
        }}
      >
        <ol className="decl-pipeline">
          {lifecycle.map((item, index) => (
            <li key={item}>
              <small>{String(index + 1).padStart(2, "0")}</small>
              <b>{item}</b>
            </li>
          ))}
        </ol>
        <div>
          <p className="decl-panel-copy">
            The editor is a focused flow editor rather than a general-purpose
            diagramming tool. Declaring intent should take minutes, not an
            afternoon of box-drawing.
          </p>
          <div className="decl-mini-ui">
            <header>
              <b>Checkout</b>
              <span>DRAFT</span>
            </header>
            <div>
              <ul>
                {["Product view", "Cart", "Checkout", "Payment"].map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <p>Graph canvas</p>
            </div>
            <footer>
              <span>+ Add state</span>
              <span>Review suggestions</span>
            </footer>
          </div>
        </div>
      </MediaSection>

      {/* 07 Add states and transitions */}
      <AsideSection
        eyebrow="States &amp; transitions"
        title="Adding a state is a short, categorized decision."
        copy="A state carries a name and a category, because category-appropriate suggestions depend on knowing whether you just declared navigation, UI, business, error, or system behavior."
        mediaWidth={720}
        visual={{
          label: "Add-state drawer and transition creation / product UI design",
          master: "1200 × 760",
          display: "720 × 456",
        }}
      >
        <div className="decl-drawer-mock">
          <p className="decl-panel-label">State name</p>
          <b>Payment failure</b>
          <p className="decl-panel-label">Category</p>
          <ul>
            {["Navigation", "UI", "Business", "Error", "System"].map((item) => (
              <li key={item} className={item === "Error" ? "is-selected" : ""}>
                <i aria-hidden="true">{item === "Error" ? "●" : "○"}</i>
                {item}
              </li>
            ))}
          </ul>
          <span className="decl-mock-button">Add state</span>
        </div>
        <p className="decl-panel-label">Transition</p>
        <Chain items={["PAYMENT_PENDING", "PAYMENT_FAILED"]} />
        <div className="decl-trigger">
          <small>Trigger</small>
          <b>PAYMENT_REJECTED</b>
        </div>
        <p className="decl-panel-copy">
          Describing the trigger is optional. Connecting two states is the part
          that matters, and drag-and-drop is never the only way to do it.
        </p>
      </AsideSection>

      {/* 08 Entry and terminal states */}
      <MediaSection
        eyebrow="Entry &amp; terminal states"
        title="Tell Tellann where meaningful behavior begins and ends."
        copy="Boundaries are what make measurement precise. Setup activity before the entry state is retained for context and replay, while coverage and reconciliation are computed from in-flow evidence."
        note="Master 1500 × 700 px · Display 1000 × 467 px · Horizontal timeline: setup, flow start, flow evidence, end"
        visual={{
          label: "Demonstration boundary timeline / SVG design",
          master: "1500 × 700",
          display: "1000 × 467",
        }}
      >
        <div>
          <p className="decl-panel-label">Declared boundaries</p>
          <div className="decl-boundary-chain">
            <span className="is-entry">
              <small>Entry</small>
              <b>PRODUCT_VIEW</b>
            </span>
            <span>
              <small>In flow</small>
              <b>CART</b>
            </span>
            <span>
              <small>In flow</small>
              <b>CHECKOUT</b>
            </span>
            <span className="is-exit">
              <small>Terminal</small>
              <b>ORDER_COMPLETE</b>
            </span>
          </div>
        </div>
        <div>
          <p className="decl-panel-label">In a demonstration run</p>
          <ul className="decl-status-list">
            {[
              ["Pre-boundary", "Login, setup, navigation — context only"],
              ["Initial flow boundary", "Evidence scope opens"],
              ["In-flow evidence", "Counted for coverage and reconciliation"],
              ["Terminal state", "Evidence scope closes"],
            ].map(([term, meaning]) => (
              <li key={term}>
                <b>{term}</b>
                <small>{meaning}</small>
              </li>
            ))}
          </ul>
          <p className="decl-panel-copy">
            This is why declaration improves measurement precision: Tellann
            stops guessing where the interesting part of the session started.
          </p>
        </div>
      </MediaSection>

      {/* 09-10 Suggestion engine and sources */}
      <section className="decl-suggestion-engine is-surface" id="suggestions">
        <div className="decl-shell decl-heading">
          <p className="decl-kicker" data-aos="fade-up">
            Suggestion engine
          </p>
          <h2 data-aos="fade-up" data-aos-delay="60">
            Declare the main path. Let Tellann help you think about the branches.
          </h2>
          <p data-aos="fade-up" data-aos-delay="120">
            As each state is added, the derivation engine can propose failure
            paths, edge states, recovery states, and category-appropriate
            variants. Every proposal names where it came from.
          </p>
        </div>
        <div className="decl-shell decl-section-detail">
          <div>
            <p className="decl-panel-label">You add</p>
            <Chain items={["LOGIN"]} />
            <p className="decl-panel-label">Tellann suggests</p>
            <Chain
              gap
              items={[
                "LOGIN_FAILURE",
                "ACCOUNT_LOCKED",
                "PASSWORD_RESET_REQUESTED",
                "SESSION_TIMEOUT",
              ]}
            />
          </div>
          <div>
            <p className="decl-panel-label">Suggestion source transparency</p>
            <div className="decl-source-list">
              {suggestionSources.map(([label, tier, copy, example]) => (
                <article key={tier}>
                  <b>{label}</b>
                  <small>{tier}</small>
                  <p>{copy}</p>
                  <i>{example}</i>
                </article>
              ))}
            </div>
            <details className="decl-details">
              <summary>
                How suggestions are sourced
                <span>+</span>
              </summary>
              <p>
                Tellann may use anonymized, aggregated structural patterns to
                suggest common branches, but the system does not expose another
                organization&apos;s application identity, metadata, or payload
                contents. The structural index is restricted to state,
                category, and transition shape data in aggregate form.
              </p>
            </details>
          </div>
        </div>
        <div className="decl-shell-mid decl-review-wrap" data-aos="tellann-panel">
          <SuggestionReview />
          <p className="decl-media-note">
            Suggestion card 360 × 280 px · Desktop rail shows 3 cards with a 20
            px gap · Mobile shows one card at a time with horizontal swipe ·
            Accept, reject, and open rationale are all keyboard reachable
          </p>
        </div>
      </section>

      {/* 11 Human control */}
      <MediaSection
        eyebrow="Human control"
        title="Suggestions never become intent without your approval."
        copy="A suggestion is a proposal on the canvas, drawn dashed and clearly separate from declared intent. Automatic addition to the Declared Intent Graph is prohibited by design."
        note="Master 1400 × 800 px · Display 900 × 514 px · 5–6 second sequence · LOGIN_FAILURE appears dashed, accept joins the declared graph, SESSION_TIMEOUT appears, reject removes it from the canvas while the rejected status is retained"
        visual={{
          label: "Accept and reject interaction / animated UI design",
          master: "1400 × 800",
          display: "900 × 514",
        }}
      >
        <div className="decl-gate">
          <span>Suggestion</span>
          <i aria-hidden="true">↓</i>
          <div>
            <b>Accept</b>
            <b>Reject</b>
          </div>
          <i aria-hidden="true">↓</i>
          <span className="is-strong">Only if accepted · Declared intent</span>
        </div>
        <div>
          <p className="decl-panel-copy">
            Rejected suggestions stay recorded rather than disappearing. An
            unchanged suggestion that you already declined is not put in front
            of you again.
          </p>
          <div className="decl-state-chips">
            {["PENDING", "ACCEPTED", "REJECTED"].map((state) => (
              <span key={state}>{state}</span>
            ))}
          </div>
        </div>
      </MediaSection>

      {/* 12 Whole-flow review */}
      <MediaSection
        surface
        eyebrow="Whole-flow review"
        title="Review the entire flow before applying changes."
        copy="A whole-flow review has to show the full effect before anything changes, and you can apply only the subset of proposed changes you actually want."
        note="Master 1700 × 950 px · Display 1100 × 615 px · Current flow beside proposed flow, with a selectable change list on the right"
        visual={{
          label: "Whole-flow review / interactive HTML design",
          master: "1700 × 950",
          display: "1100 × 615",
        }}
      >
        <div className="decl-review-compare">
          <div>
            <p className="decl-panel-label">Current flow</p>
            <Chain items={["LOGIN", "AUTHENTICATED"]} />
          </div>
          <div>
            <p className="decl-panel-label">Proposed</p>
            <Chain
              gap
              items={["Login failure", "Account locked", "Password reset"]}
            />
          </div>
        </div>
        <div>
          <p className="decl-panel-label">Proposed changes</p>
          <ul className="decl-checklist">
            {[
              ["Login failure", true],
              ["Account locked", true],
              ["Password reset", false],
              ["Session timeout", false],
            ].map(([label, checked]) => (
              <li key={String(label)} className={checked ? "is-checked" : ""}>
                <i aria-hidden="true">{checked ? "☑" : "☐"}</i>
                {label}
              </li>
            ))}
          </ul>
          <div className="decl-mock-actions">
            <span className="is-primary">Apply selected</span>
            <span>Decline review</span>
          </div>
          <p className="decl-panel-copy">
            Request review, preview the proposed changes, select what applies,
            then apply or decline. Nothing is written while you are still
            deciding.
          </p>
        </div>
      </MediaSection>

      {/* 13 Interactive flow builder */}
      <section className="decl-builder-section" id="builder">
        <div className="decl-shell decl-heading">
          <p className="decl-kicker" data-aos="fade-up">
            Interactive flow builder
          </p>
          <h2 data-aos="fade-up" data-aos-delay="60">
            Build intended behavior without turning Tellann into a diagramming
            chore.
          </h2>
          <p data-aos="fade-up" data-aos-delay="120">
            Add a state, review what Tellann proposes around it, accept the
            branches that apply, and mark the flow complete. The graph canvas
            stays a dimension-accurate placeholder for the final renderer; every
            control around it is live.
          </p>
        </div>
        <div className="decl-shell-wide" data-aos="tellann-panel">
          <FlowBuilderDemo />
        </div>
        <p className="decl-shell decl-media-note">
          Builder 1280 × 820 px inside a 1400 px container · Tablet 960 × ~780
          px · Mobile stacks to flow header, canvas, selected state,
          suggestions, actions · Inner graph canvas placeholder 940 × 540 px
        </p>
        <p className="decl-shell decl-note">
          <b>Graph or list:</b> every flow builder offers both. Declared,
          suggested, entry, and terminal are carried by label as well as shape,
          and drag-and-drop is never the only way to create flow ordering.
        </p>
      </section>

      {/* 14 Draft vs complete */}
      <AsideSection
        surface
        reverse
        eyebrow="Draft &amp; completion"
        title="Intent stays a draft until the team says it is ready."
        copy="Draft flows remain visible and editable, but they do not participate in ruleset compilation or reconciliation reporting. Completion is a deliberate act, not a side effect of editing."
        mediaWidth={900}
        visual={{
          label: "Draft to complete sequence / animated UI design",
          master: "1500 × 850",
          display: "900 × 510",
        }}
      >
        <div className="decl-lifecycle-card">
          <header>
            <b>CHECKOUT</b>
            <span className="decl-status-pill is-draft">DRAFT</span>
          </header>
          <small>Last edited 4 minutes ago</small>
          <div className="decl-mock-actions">
            <span>Save draft</span>
            <span className="is-primary">Mark flow complete</span>
          </div>
        </div>
        <div className="decl-lifecycle-card is-complete">
          <header>
            <b>CHECKOUT</b>
            <span className="decl-status-pill is-complete">COMPLETE</span>
          </header>
          <small>Ruleset updated</small>
          <div className="decl-mock-actions">
            <span>Reopen for editing</span>
          </div>
        </div>
        <p className="decl-panel-label">Completion sequence</p>
        <ol className="decl-step-list">
          {[
            "Review complete",
            "Mark flow complete",
            "Graph snapshot freezes",
            "Ruleset compilation",
            "COMPLETE",
          ].map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        <p className="decl-panel-copy">
          A purposeful progress sequence, 5–6 seconds, rather than a generic
          spinner — the steps are real work, so they are worth naming.
        </p>
      </AsideSection>

      {/* 15 Ruleset compilation */}
      <MediaSection
        eyebrow="Ruleset compilation"
        title="Completed intent becomes something Tellann can evaluate against."
        copy="A completed declared flow contributes to a versioned application ruleset. Change a source flow and the ruleset recompiles; prior versions are retained so historical reconciliation still makes sense."
        note="Master 1600 × 900 px · Display 1000 × 562 px · Generic QA rules plus declared flow rules plus accepted suggestion rules composing into the application ruleset"
        visual={{
          label: "Ruleset composition / animated SVG design",
          master: "1600 × 900",
          display: "1000 × 562",
        }}
      >
        <div>
          <p className="decl-panel-label">Composition</p>
          <div className="decl-compose">
            {[
              "Generic QA rules",
              "Declared flow rules",
              "Accepted suggestion rules",
            ].map((item) => (
              <span key={item}>{item}</span>
            ))}
            <i aria-hidden="true">↓</i>
            <b>Application ruleset</b>
          </div>
        </div>
        <div>
          <p className="decl-panel-label">Application ruleset</p>
          <dl className="decl-stat-list">
            {[
              ["Version", "1.4"],
              ["Sources", "Checkout · Registration · Authentication"],
              ["Rules", "47"],
              ["Compiled", "Just now"],
            ].map(([term, value]) => (
              <div key={term}>
                <dt>{term}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <p className="decl-sample-note">Illustrative figures</p>
        </div>
      </MediaSection>

      {/* 16 Guided demonstration */}
      <MediaSection
        surface
        eyebrow="Guided demonstration"
        title="Declared intent turns Demonstration Mode into a guided validation walkthrough."
        copy="When a declared flow exists, Tellann already knows the intended boundaries and expected states. The developer demonstrates; Tellann checks the expected states off against real evidence."
        note="Master 1920 × 1200 px · Display 1100 × 688 px · 12–15 second product recording · Open the Checkout declaration, start a guided demonstration, expected state shown, developer performs checkout, expected state confirmed, flow completes, reconciliation appears"
        visual={{
          label: "Declare to guided demonstration / product video",
          master: "1920 × 1200",
          display: "1100 × 688",
        }}
      >
        <ol className="decl-pipeline">
          {[
            "Checkout declaration",
            "Start guided run",
            "Tellann knows the intended flow",
            "Developer demonstrates behavior",
            "Expected states checked",
            "Evidence reconciled",
          ].map((item, index) => (
            <li key={item}>
              <small>{String(index + 1).padStart(2, "0")}</small>
              <b>{item}</b>
            </li>
          ))}
        </ol>
        <div>
          <p className="decl-panel-label">Run modes</p>
          <div className="decl-mode-cards">
            {runModes.map(([name, copy]) => (
              <article key={name}>
                <b>{name}</b>
                <p>{copy}</p>
              </article>
            ))}
          </div>
          <p className="decl-panel-copy">
            Guided mode is not mandatory. Declaration influences the first two
            modes and leaves observation-only recording exactly as it was.
          </p>
          <Link href="/product/demonstration-mode" className="decl-inline-link">
            Explore Demonstration Mode <span>→</span>
          </Link>
        </div>
      </MediaSection>

      {/* 17 Declared vs demonstrated */}
      <MediaSection
        eyebrow="Declared vs demonstrated"
        title="Intent becomes meaningful when it meets evidence."
        copy="Side by side, the declaration and the demonstration are simply two graphs. What Tellann adds is the comparison between them — and the vocabulary to talk about the difference."
        note="Master 1600 × 900 px · Display 1000 × 562 px · Declared branch set beside the single demonstrated path"
        visual={{
          label: "Declared beside demonstrated / SVG design",
          master: "1600 × 900",
          display: "1000 × 562",
        }}
      >
        <div>
          <p className="decl-panel-label">Declared</p>
          <Chain items={["Checkout", "Success", "Failure", "Retry"]} />
        </div>
        <div>
          <p className="decl-panel-label">Demonstrated</p>
          <Chain items={["Checkout", "Success"]} />
          <p className="decl-panel-copy">
            Neither graph silently overwrites the other. The declared graph
            expresses intent; the demonstrated graph expresses evidence.
          </p>
          <Link href="/product/behavior-graphs" className="decl-inline-link">
            Explore Behavior Graphs <span>→</span>
          </Link>
        </div>
      </MediaSection>

      {/* 18-19 Reconciliation */}
      <section className="decl-reconciliation is-surface" id="reconciliation">
        <div className="decl-shell decl-heading">
          <p className="decl-kicker" data-aos="fade-up">
            Reconciliation
          </p>
          <h2 data-aos="fade-up" data-aos-delay="60">
            Tellann compares what should happen with what actually happened.
          </h2>
          <p data-aos="fade-up" data-aos-delay="120">
            The reconciliation engine compares the Declared Intent Graph with
            the Observed Behavior Graph without assuming either one is
            automatically correct.
          </p>
        </div>

        <div className="decl-shell decl-matrix" role="table" aria-label="Reconciliation matrix">
          <div role="row" className="is-head">
            <span role="columnheader" />
            <span role="columnheader">Observed</span>
            <span role="columnheader">Not observed</span>
          </div>
          <div role="row">
            <span role="rowheader">Declared</span>
            <span role="cell">CONFIRMED</span>
            <span role="cell">TRUE GAP</span>
          </div>
          <div role="row">
            <span role="rowheader">Not declared</span>
            <span role="cell">UNDECLARED</span>
            <span role="cell">—</span>
          </div>
        </div>

        <div className="decl-contained-media">
          <VisualPlaceholder
            label="Reconciliation matrix resolving one case at a time / animated SVG design"
            master="1500 × 850"
            display="960 × 544"
          />
          <p>
            Master 1500 × 850 px · Display 960 × 544 px · 6–7 second sequence ·
            Confirmed, then True gap, then Undeclared
          </p>
        </div>

        <div className="decl-shell decl-class-cards">
          {reconciliationStates.map(([name, rule, example, copy], index) => (
            <article
              key={name}
              data-aos="fade-up"
              data-aos-delay={String((index + 1) * 60)}
            >
              <span>{name}</span>
              <small>{rule}</small>
              <b>{example}</b>
              <p>{copy}</p>
            </article>
          ))}
        </div>

        <div className="decl-shell decl-undeclared-note">
          <p className="decl-panel-label">Undeclared does not mean wrong</p>
          <ul>
            {undeclaredMeanings.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p className="decl-panel-copy">
            Undeclared behavior is surfaced for review rather than treated as an
            error by default. Deciding which of those four it is stays a human
            judgement.
          </p>
        </div>
      </section>

      {/* 20 Reconciliation explorer */}
      <section className="decl-explorer-section" id="explorer">
        <div className="decl-shell decl-heading">
          <p className="decl-kicker" data-aos="fade-up">
            Reconciliation explorer
          </p>
          <h2 data-aos="fade-up" data-aos-delay="60">
            Inspect every node against the declaration that predicted it.
          </h2>
          <p data-aos="fade-up" data-aos-delay="120">
            Filter by classification, open any node, and see whether it was
            declared, whether it was observed, how it entered intent, which flow
            version declared it, and which run provided the evidence.
          </p>
        </div>
        <div className="decl-shell-wide" data-aos="tellann-panel">
          <ReconciliationExplorer />
        </div>
        <p className="decl-shell decl-media-note">
          Explorer 1280 × 800 px · Inner graph canvas placeholder 920 × 530 px ·
          Classification is carried by label and glyph, never by colour alone
        </p>
      </section>

      {/* 21 Demonstration-time promotion */}
      <MediaSection
        surface
        eyebrow="Demonstration-time promotion"
        title="Observed something you forgot to declare? Add it—with confirmation."
        copy="When a demonstration reaches behavior that no declared flow predicted, Tellann asks rather than assumes. Accepting records the node as DEMONSTRATION_PROMOTED and triggers a ruleset recompilation."
        note="Master 1500 × 850 px · Display 900 × 510 px · 6 second sequence · Observed graph shows a new node, Undeclared badge, prompt, accept, node appears in the declared graph with DEMONSTRATION_PROMOTED provenance"
        visual={{
          label: "Undeclared to promoted interaction / animated UI design",
          master: "1500 × 850",
          display: "900 × 510",
        }}
      >
        <div className="decl-prompt-card">
          <span>Undeclared</span>
          <b>PROMO_CODE_REJECTED</b>
          <p>This state wasn&apos;t in your declared flow. Is it expected?</p>
          <div className="decl-mock-actions">
            <span className="is-primary">Add to declared flow</span>
            <span>Leave undeclared</span>
          </div>
        </div>
        <div>
          <p className="decl-panel-label">If accepted</p>
          <Chain items={["DEMONSTRATION_PROMOTED", "Ruleset recompiled"]} />
          <p className="decl-panel-copy">
            Promotion always requires explicit human confirmation. Tellann never
            edits your declaration because it saw something interesting.
          </p>
        </div>
      </MediaSection>

      {/* Reconciliation product video */}
      <section className="decl-video-section">
        <div className="decl-shell decl-heading">
          <p className="decl-kicker" data-aos="fade-up">
            Demonstration to reconciliation
          </p>
          <h2 data-aos="fade-up" data-aos-delay="60">
            From a finished run to a reviewed declaration.
          </h2>
          <p data-aos="fade-up" data-aos-delay="120">
            The second product recording follows a completed run into
            reconciliation: select a true gap, select an undeclared node, and
            promote the one that turns out to be expected.
          </p>
        </div>
        <div className="decl-contained-media">
          <VisualPlaceholder
            label="Demonstration to reconciliation / product video"
            master="1920 × 1200"
            display="1000 × 625"
          />
          <p>
            Master 1920 × 1200 px · Display 1000 × 625 px · 8–10 seconds ·
            Completed run, reconciliation, select True Gap, select Undeclared,
            promote the expected node · Does not autoplay under reduced motion
          </p>
        </div>
      </section>

      {/* 22 Provenance */}
      <AsideSection
        surface
        reverse
        eyebrow="Provenance"
        title="Tellann remembers where declared intent came from."
        copy="Every declared node records how it entered intent. Observed nodes carry telemetry provenance separately, so a true gap can still say whether a person wrote it or accepted it as a suggestion."
        mediaWidth={720}
        visual={{
          label: "Provenance inspector / product UI design",
          master: "1200 × 770",
          display: "720 × 460",
        }}
      >
        <div className="decl-provenance-card">
          <b>PAYMENT_FAILURE</b>
          <dl>
            {[
              ["Declared by", "QA lead"],
              ["Origin", "USER_AUTHORED"],
              ["Created", "Sep 12, 2026"],
              ["Flow version", "v3"],
            ].map(([term, value]) => (
              <div key={term}>
                <dt>{term}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="decl-provenance-card">
          <b>SESSION_TIMEOUT</b>
          <dl>
            {[
              ["Origin", "SUGGESTED_ACCEPTED"],
              ["Suggestion source", "Pattern library"],
              ["Accepted by", "Platform engineer"],
              ["Flow version", "v3"],
            ].map(([term, value]) => (
              <div key={term}>
                <dt>{term}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="decl-state-chips">
          {[
            "USER_AUTHORED",
            "SUGGESTED_ACCEPTED",
            "DEMONSTRATION_PROMOTED",
            "TELEMETRY_OBSERVED",
          ].map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
        <p className="decl-sample-note">
          Fictitious team roles · Illustrative application data
        </p>
      </AsideSection>

      {/* 23 Editing and versioning */}
      <MediaSection
        eyebrow="Editing &amp; versioning"
        title="Intent changes. The declared model can change with it."
        copy="A completed flow can be reopened, edited, and completed again as a new version. Tellann never overwrites a user-authored declaration because later observed evidence disagrees with it — the conflict surfaces through reconciliation and a person decides."
        note="Master 1500 × 700 px · Display 1000 × 467 px · Three mini graphs showing v1, v2, and v3 of the same flow"
        visual={{
          label: "Flow versioning / SVG design",
          master: "1500 × 700",
          display: "1000 × 467",
        }}
      >
        <div className="decl-version-list">
          {[
            ["v1", "Product → Cart → Checkout"],
            ["v2", "+ Payment"],
            ["v3", "+ Failure, + Retry"],
          ].map(([version, change]) => (
            <span key={version}>
              <small>{version}</small>
              <b>{change}</b>
            </span>
          ))}
        </div>
        <div>
          <p className="decl-panel-label">Reopening a completed flow</p>
          <Chain items={["Checkout v3 · COMPLETE", "Reopen for editing", "Draft v4"]} />
          <p className="decl-panel-copy">
            Ruleset recompilation follows the source flow. Prior ruleset
            versions are retained so a historical reconciliation report still
            means what it meant when it was produced.
          </p>
        </div>
      </MediaSection>

      {/* 24 Optional by design */}
      <MediaSection
        surface
        eyebrow="Optional by design"
        title="Declare what matters—or let Tellann begin with observation alone."
        copy="Flow Declaration is optional at the application level. Both paths below are valid, and an application with no declared flows loses nothing it had before."
        note="Master 1600 × 800 px · Display 1000 × 500 px · Two parallel paths: declared and observation-only"
        visual={{
          label: "Declared path beside observation-only path / SVG design",
          master: "1600 × 800",
          display: "1000 × 500",
        }}
      >
        <div>
          <p className="decl-panel-label">Path A — declared</p>
          <Chain
            items={["Declare flow", "Demonstrate", "Reconcile against intent"]}
          />
        </div>
        <div>
          <p className="decl-panel-label">Path B — observation only</p>
          <Chain
            items={["Demonstrate", "Build observed graph", "Coverage + gap analysis"]}
          />
          <p className="decl-panel-copy">
            You don&apos;t have to manually model your application to use
            Tellann. But when explicit intent matters, Flow Declaration gives
            Tellann a human-approved baseline to evaluate against.
          </p>
        </div>
      </MediaSection>

      {/* 25 Document-assisted drafting */}
      <MediaSection
        eyebrow="Document-assisted drafting"
        title="Already documented the flow somewhere else? Start from that intent."
        copy="Tellann can draft candidate intent from supplied materials — a requirement, a user story, a process document — but the team reviews, corrects, and accepts the result before it becomes declared behavior."
        note="Master 1600 × 900 px · Display 1000 × 562 px · Document, candidate flow, review changes, declared intent"
        visual={{
          label: "Document to intent draft / animated SVG design",
          master: "1600 × 900",
          display: "1000 × 562",
        }}
      >
        <div>
          <p className="decl-panel-label">Sources</p>
          <ul className="decl-example-list">
            {["Product requirement", "User story", "Process document"].map(
              (item) => (
                <li key={item}>{item}</li>
              ),
            )}
          </ul>
        </div>
        <div>
          <p className="decl-panel-label">Path to declared intent</p>
          <Chain
            items={["Intent draft", "Review", "Correct", "Accept", "Declared flow"]}
          />
          <p className="decl-panel-copy">
            Intent drafts are asynchronous, cancellable work. A draft becomes
            declared intent only through review — never by upload alone.
          </p>
        </div>
      </MediaSection>

      {/* 26 Assistive intelligence boundary */}
      <section className="decl-boundary-section is-surface">
        <div className="decl-shell decl-heading">
          <p className="decl-kicker" data-aos="fade-up">
            Assistive intelligence boundary
          </p>
          <h2 data-aos="fade-up" data-aos-delay="60">
            Assistance can propose. Evidence and humans decide.
          </h2>
          <p data-aos="fade-up" data-aos-delay="120">
            This boundary is part of the design rather than a policy bolted on
            afterwards. It is what makes a declared baseline worth trusting.
          </p>
        </div>
        <div className="decl-shell decl-permission-grid" data-aos="tellann-panel">
          <article>
            <span>Permitted</span>
            <ul>
              {permitted.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
          <article className="is-negative">
            <span>Not permitted</span>
            <ul>
              {notPermitted.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
        </div>
        <p className="decl-shell decl-note">
          <b>On suggestion-source privacy:</b> Tellann may use anonymized,
          aggregated structural patterns to suggest common branches, but the
          system does not expose another organization&apos;s application
          identity, metadata, or payload contents.
        </p>
      </section>

      {/* 27 What flow declaration is not */}
      <section className="decl-caveats">
        <div className="decl-shell decl-heading">
          <p className="decl-kicker" data-aos="fade-up">
            What flow declaration is not
          </p>
          <h2 data-aos="fade-up" data-aos-delay="60">
            Intent without turning your QA process into diagram maintenance.
          </h2>
          <p data-aos="fade-up" data-aos-delay="120">
            The declared graph expresses intent. The demonstrated graph
            expresses evidence. Neither should silently overwrite the other.
          </p>
        </div>
        <div className="decl-shell decl-not-list" data-aos="tellann-panel">
          <p>Flow Declaration is not:</p>
          <ul>
            {isNot.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <div className="decl-shell decl-copy-compare">
          <article>
            <span>Avoid</span>
            <b>Tellann requires no workflow definition</b>
            <b>Upload a PRD and Tellann decides your intended behavior</b>
            <b>Tellann automatically updates your declared flow</b>
          </article>
          <article className="is-primary">
            <span>Use</span>
            <b>
              Tellann can discover behavior without a manually modeled workflow
            </b>
            <b>
              Tellann assists with drafting candidate intent; the team accepts it
            </b>
            <b>
              A suggestion becomes declared intent only when a human accepts it
            </b>
          </article>
        </div>
      </section>

      {/* 28 Relationships and reporting */}
      <AsideSection
        eyebrow="Flow reconciliation report"
        title="Reconciliation becomes a QA artifact of its own."
        copy="The Flow Reconciliation Report is a sibling to the coverage and missing-flow reports. It states what was declared, what was observed, and how the two compared."
        mediaWidth={600}
        visual={{
          label: "Flow reconciliation report / portrait report UI design",
          master: "1000 × 1280",
          display: "600 × 768",
        }}
      >
        <div className="decl-report-summary">
          {[
            ["Workflow", "Checkout"],
            ["Declared states", "14"],
            ["Observed states", "12"],
            ["Confirmed", "11"],
            ["True gaps", "3"],
            ["Undeclared", "2"],
          ].map(([term, value]) => (
            <span key={term}>
              <small>{term}</small>
              <b>{value}</b>
            </span>
          ))}
        </div>
        <p className="decl-panel-label">True gaps</p>
        <ul className="decl-status-list">
          {[
            ["PAYMENT_FAILED", "USER_AUTHORED"],
            ["SESSION_TIMEOUT", "USER_AUTHORED"],
            ["GIFT_CARD_APPLIED", "SUGGESTED_ACCEPTED"],
          ].map(([name, origin]) => (
            <li key={name}>
              <b>{name}</b>
              <small>{origin}</small>
            </li>
          ))}
        </ul>
        <p className="decl-sample-note">Illustrative figures</p>
        <div className="decl-related-links">
          {[
            ["/product/coverage", "Coverage"],
            ["/product/missing-states", "Missing states"],
            ["/product/missing-flows", "Missing flows"],
            ["/product/behavior-graphs", "Behavior graphs"],
          ].map(([href, label]) => (
            <Link key={href} href={href} className="decl-inline-link">
              Explore {label} <span>→</span>
            </Link>
          ))}
        </div>
      </AsideSection>

      {/* Relationship with coverage and gap analysis */}
      <section className="decl-relationship is-surface">
        <div className="decl-shell decl-heading">
          <p className="decl-kicker" data-aos="fade-up">
            Stronger coverage semantics
          </p>
          <h2 data-aos="fade-up" data-aos-delay="60">
            A declared baseline changes what &ldquo;not observed&rdquo; means.
          </h2>
          <p data-aos="fade-up" data-aos-delay="120">
            Where a declaration exists, expected paths can provide the coverage
            denominator. Where none exists, generic compiled rules provide the
            baseline instead — both remain valid.
          </p>
        </div>
        <div className="decl-shell decl-relationship-grid" data-aos="tellann-panel">
          <article>
            <span>Inferred absence</span>
            <b>Missing state · Missing flow</b>
            <p>
              A rule-derived candidate. Tellann expected a complementary
              condition from the structure around observed behavior.
            </p>
          </article>
          <article className="is-primary">
            <span>Declared absence</span>
            <b>True gap</b>
            <p>
              A human explicitly said the behavior should exist, and the
              evidence never confirmed it. A stronger class of absence.
            </p>
          </article>
        </div>
      </section>

      {/* 28 FAQ */}
      <section className="decl-faq">
        <div className="decl-shell decl-faq-grid">
          <div>
            <p className="decl-kicker" data-aos="fade-up">
              FAQ
            </p>
            <h2 data-aos="fade-up" data-aos-delay="60">
              Questions behind declared intent.
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

      {/* 29 Final CTA */}
      <section className="decl-final">
        <div className="decl-shell">
          <p className="decl-kicker" data-aos="fade-up">
            Define the intent
          </p>
          <h2 data-aos="fade-up" data-aos-delay="60">
            Tell Tellann what should happen. Then prove it with behavior.
          </h2>
          <p data-aos="fade-up" data-aos-delay="120">
            Declare the workflows that matter, review the branches worth
            validating, and use your next demonstration to see what was
            confirmed, what was never reached, and what happened that nobody
            declared.
          </p>
          <div className="decl-actions">
            <a className="is-primary" href={dashboardUrl}>
              Start free <span>↗</span>
            </a>
            <Link href="/product/demonstration-mode">
              Explore Demonstration Mode <span>→</span>
            </Link>
            <Link href="/product/behavior-graphs">
              Explore Behavior Graphs <span>→</span>
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
