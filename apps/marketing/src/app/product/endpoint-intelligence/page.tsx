import type { Metadata } from "next";
import Link from "next/link";
import type { CSSProperties } from "react";
import { EndpointExplorer } from "@/components/endpoint-explorer";
import { EndpointRankings } from "@/components/endpoint-rankings";
import { ProductPlaceholder } from "@/components/product-tour";
import "./endpoint-intelligence.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://domain-name.com";
const dashboardUrl =
  process.env.NEXT_PUBLIC_APP_URL || "https://app.domain-name.com";

export const metadata: Metadata = {
  title:
    "Endpoint Intelligence — Connect API Performance to Application Behavior | Tellann",
  description:
    "See how Tellann connects API requests, responses, latency, errors, and endpoint activity to application workflows, behavioral states, sessions, coverage, and QA reports.",
  alternates: { canonical: "/product/endpoint-intelligence" },
  openGraph: {
    title:
      "Endpoint Intelligence — Connect API Performance to Application Behavior | Tellann",
    description:
      "Backend behavior captured alongside the session, connected to the workflows and states it supported.",
    url: `${siteUrl}/product/endpoint-intelligence`,
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

const inventoryRows: [string, string, string, string, string, string][] = [
  ["GET", "/products", "42", "184 ms", "0%", "2"],
  ["POST", "/cart", "28", "143 ms", "0%", "1"],
  ["POST", "/checkout", "18", "418 ms", "0%", "1"],
  ["POST", "/payment", "15", "891 ms", "13.3%", "1"],
];

const capturedMetadata: [string, boolean][] = [
  ["HTTP method", true],
  ["Endpoint route", true],
  ["Response status", true],
  ["Response time", true],
  ["Error metadata", true],
  ["Session correlation", true],
];

const notCaptured: string[] = [
  "Full request body",
  "Authorization headers",
  "Authentication secrets",
  "Payment data",
  "Private tokens",
];

const isList: string[] = [
  "Endpoint metadata capture",
  "Request and response observation",
  "Response-time analysis",
  "Error-rate analysis",
  "Request-frequency analysis",
  "Session correlation",
  "Workflow correlation",
  "Endpoint coverage",
  "Endpoint reports",
];

const isNotList: string[] = [
  "Full distributed tracing platform",
  "Log aggregation",
  "Database query intelligence",
  "Production APM",
  "Continuous production monitoring",
  "Automatic root-cause analysis",
  "AI optimization",
  "Infrastructure monitoring",
];

const recommendations: [string, string, string][] = [
  [
    "Elevated latency observed",
    "Review endpoint processing",
    "Endpoint response-time rule",
  ],
  [
    "Elevated error rate observed",
    "Investigate error responses",
    "Endpoint error-rate rule",
  ],
  [
    "High request frequency observed",
    "Review repeated request behavior",
    "Request-frequency rule",
  ],
  [
    "Large workflow dependency",
    "Review endpoint criticality",
    "Workflow-correlation rule",
  ],
  [
    "Not exercised during demonstration",
    "Demonstrate endpoint path",
    "Endpoint coverage rule",
  ],
];

const faqs: [string, string][] = [
  [
    "What is Endpoint Intelligence?",
    "Endpoint Intelligence captures backend activity during observed application sessions and connects requests, responses, latency, and errors back to the workflows and states they supported.",
  ],
  [
    "What endpoint data does Tellann capture?",
    "The HTTP method, endpoint route, response status, response time, error metadata, and the session correlation that ties the request to the observed behavior.",
  ],
  [
    "How does Tellann associate API calls with workflows?",
    "The frontend and backend SDKs share session context. Backend activity is correlated to the session, the session reconstructs into a workflow, and the request lands on the transition it supported.",
  ],
  [
    "Does Tellann capture request bodies?",
    "No. Phase 1 captures endpoint metadata rather than payloads, so full request and response bodies, credentials, tokens, and payment data are not collected.",
  ],
  [
    "Can I see which endpoint caused a state transition?",
    "You can see which endpoint was observed on a transition and what it returned. Tellann presents that as contextual correlation, not as automatic causal proof.",
  ],
  [
    "How does Tellann identify slow endpoints?",
    "Average response time is calculated from the requests observed during demonstrations, and endpoints above the configured threshold are surfaced as slow.",
  ],
  [
    "How is endpoint error rate calculated?",
    "It is the proportion of observed requests to that endpoint which returned an error response, within the selected demonstrations.",
  ],
  [
    'What does "most observed" mean?',
    "It counts the requests captured during the selected demonstrations. It is not production traffic, and Phase 1 deliberately avoids traffic-style wording.",
  ],
  [
    "What is endpoint coverage?",
    "Endpoint coverage is one of the five Phase 1 coverage dimensions. It describes which workflow-related endpoints were exercised during the observed sessions.",
  ],
  [
    "Can I see sessions that called an endpoint?",
    "Yes. Backend activity is associated with the session where it occurred, so an endpoint observation leads back to its supporting sessions.",
  ],
  [
    "Can I open Session Replay from an endpoint?",
    "Yes. Selecting a session opens the reconstructed timeline, and the replay can seek to the API event itself.",
  ],
  [
    "Does Tellann support backend errors?",
    "Yes. Error responses, status codes, and error metadata are captured and connected to the application state that followed them.",
  ],
  [
    "Does Endpoint Intelligence monitor production APIs?",
    "Not in Phase 1. Endpoint activity is captured during controlled demonstrations. Continuous production monitoring is planned for a later phase.",
  ],
  [
    "Is Tellann an APM platform?",
    "No. Tellann cares about the API because of the behavior it enabled or disrupted. Infrastructure, host, and container metrics are out of scope.",
  ],
  [
    "Does Tellann collect logs?",
    "No. Log aggregation is not part of Phase 1.",
  ],
  [
    "Does Tellann analyze database queries?",
    "No. Database intelligence—query analysis, index recommendations, and field-utilization analysis—belongs to a later phase.",
  ],
  [
    "Does Tellann provide distributed tracing?",
    "No. Tellann correlates endpoint activity to sessions and workflows rather than providing a full distributed tracing platform.",
  ],
  [
    "Are optimization recommendations AI-generated?",
    "No. Phase 1 recommendations are rule-based, and each one states the rule that produced it.",
  ],
  [
    "Can I export an Endpoint Intelligence Report?",
    "Yes. The report uses the shared reporting infrastructure and exports as PDF, CSV, JSON, or HTML.",
  ],
];

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
  children?: React.ReactNode;
}) {
  return (
    <section
      className={`endpoint-media-section${surface ? " is-surface" : ""}`}
      id={id}
    >
      <div className="endpoint-shell endpoint-heading">
        <p className="endpoint-kicker">{eyebrow}</p>
        <h2>{title}</h2>
        <p>{copy}</p>
      </div>
      {children ? (
        <div className="endpoint-shell endpoint-section-detail">{children}</div>
      ) : null}
      <div className="endpoint-contained-media">
        <VisualPlaceholder {...visual} />
        {note ? <p>{note}</p> : null}
      </div>
    </section>
  );
}

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
  children?: React.ReactNode;
}) {
  return (
    <section
      className={`endpoint-aside-section${reverse ? " is-reverse" : ""}${
        surface ? " is-surface" : ""
      }`}
      id={id}
    >
      <div className="endpoint-shell endpoint-heading">
        <p className="endpoint-kicker">{eyebrow}</p>
        <h2>{title}</h2>
        <p>{copy}</p>
      </div>
      <div
        className="endpoint-shell endpoint-aside-grid"
        style={{ "--media-w": `${mediaWidth}px` } as CSSProperties}
      >
        <VisualPlaceholder {...visual} />
        <div className="endpoint-aside-panel">{children}</div>
      </div>
    </section>
  );
}

export default function EndpointIntelligencePage() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Tellann Endpoint Intelligence",
    description: metadata.description,
    url: `${siteUrl}/product/endpoint-intelligence`,
  };

  return (
    <main className="endpoint-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      <section className="endpoint-hero pt-20!">
        <div className="endpoint-shell endpoint-hero-copy">
          <p className="endpoint-kicker">Endpoint intelligence</p>
          <h1>See the backend behavior behind every workflow.</h1>
          <p>
            Tellann captures endpoint activity during observed application
            sessions and connects requests, responses, latency, and errors back
            to the workflows and states they supported.
          </p>
          <div className="endpoint-actions">
            <a className="is-primary" href="#explorer">
              Explore endpoint intelligence <span>↓</span>
            </a>
            <a href="#correlation">
              See how correlation works <span>↓</span>
            </a>
            <Link href="/product/session-replay">
              Explore Session Replay <span>→</span>
            </Link>
          </div>
        </div>
        <div className="endpoint-shell-wide endpoint-hero-media endpoint-desktop-media">
          <VisualPlaceholder
            label="Hero workflow and endpoint graph / requests attached to each state transition"
            master="1920 × 1120"
            display="1320 × 760"
          />
          <p>
            Master 1920 × 1120 px · Desktop display 1320 × 760 px · 9–11 second
            reveal, then interactive · Workflow draws, endpoints attach,
            response resolves, resulting state appears
          </p>
        </div>
        <div className="endpoint-mobile-media">
          <VisualPlaceholder
            label="Mobile workflow and endpoint graph / checkout, payment request, resulting state"
            master="1080 × 1350"
            display="1080 × 1350"
          />
          <p>
            Mobile master 1080 × 1350 px · Rendered as native HTML rather than a
            separate raster asset
          </p>
        </div>
      </section>

      <MediaSection
        eyebrow="Why endpoint context matters"
        title="API metrics tell you what happened. Behavioral context tells you why it mattered."
        copy="An endpoint is more useful when you know what the application was trying to do when it ran. Tellann presents that as contextual correlation—not as automatic causal proof."
        note="Master 1600 × 850 px · Display 1000 × 531 px · Isolated metric beside the same request inside its workflow"
        visual={{
          label: "Isolated API metric versus behavioral context / SVG design",
          master: "1600 × 850",
          display: "1000 × 531",
        }}
      >
        <div className="endpoint-contrast">
          <article>
            <span>Without workflow context</span>
            <div className="endpoint-metric-stack">
              <b>POST /payment</b>
              <b>891 ms</b>
              <b>503</b>
            </div>
          </article>
          <article className="is-primary">
            <span>With Tellann context</span>
            <div className="endpoint-chain">
              <b>Checkout</b>
              <b>PAYMENT_PENDING</b>
              <b>POST /payment · 891 ms · 503</b>
              <b>PAYMENT_FAILURE</b>
            </div>
          </article>
        </div>
      </MediaSection>

      <MediaSection
        surface
        eyebrow="How backend capture works"
        title="Backend behavior is captured alongside the session."
        copy="The frontend and backend SDKs share session context, so server-side execution can be associated with the user workflow that triggered it."
        note="Master 1800 × 1000 px · Display 1100 × 611 px · 7–9 second sequence · Click, frontend event, backend request, response, shared session context, workflow view"
        visual={{
          label: "Backend capture and session correlation / animated SVG design",
          master: "1800 × 1000",
          display: "1100 × 611",
        }}
      >
        <div className="endpoint-capture">
          <div>
            <p className="endpoint-panel-label">Frontend SDK</p>
            <ul className="endpoint-plain-list">
              <li>Session context</li>
              <li>Interface behavior</li>
            </ul>
          </div>
          <div>
            <p className="endpoint-panel-label">Backend SDK</p>
            <ul className="endpoint-plain-list">
              {[
                "Request capture",
                "Response capture",
                "Response time",
                "Error capture",
                "Endpoint metadata",
                "Session correlation",
              ].map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      </MediaSection>

      <MediaSection
        eyebrow="Workflow to endpoint correlation"
        title="See which endpoints participate in each workflow."
        copy="Every request lands on the transition it supported, so a workflow reads as interface behavior and backend execution together rather than as two disconnected views."
        note="Master 1800 × 1100 px · Display 1100 × 672 px · Workflow graph with an endpoint activity panel; selecting an endpoint isolates its path"
        id="correlation"
        visual={{
          label:
            "Workflow graph with endpoint activity on each transition / interactive SVG design",
          master: "1800 × 1100",
          display: "1100 × 672",
        }}
      >
        <div className="endpoint-chain">
          {[
            ["PRODUCT_VIEW", "GET /products/:id"],
            ["PRODUCT_READY", "POST /cart"],
            ["CART_ACTIVE", "POST /checkout"],
            ["CHECKOUT", "POST /payment"],
            ["PAYMENT_SUCCESS", ""],
          ].map(([state, endpoint]) => (
            <b key={state}>
              {state}
              {endpoint ? <i>{endpoint}</i> : null}
            </b>
          ))}
        </div>
        <div>
          <p className="endpoint-panel-label">Observed summary</p>
          <div className="endpoint-summary-grid">
            {[
              ["Endpoints observed", "4"],
              ["Requests", "6"],
              ["Cumulative duration", "842 ms"],
              ["API errors", "1"],
            ].map(([term, value]) => (
              <span key={term}>
                <small>{term}</small>
                <b>{value}</b>
              </span>
            ))}
          </div>
          <small className="endpoint-sample-note">Sample application data</small>
        </div>
      </MediaSection>

      <section className="endpoint-inventory">
        <div className="endpoint-shell endpoint-heading">
          <p className="endpoint-kicker">Endpoint inventory</p>
          <h2>Turn observed API activity into an endpoint inventory.</h2>
          <p>
            The inventory is built from what was actually captured. Frequency,
            average response, error rate, and workflow participation all come
            from observed requests rather than a declared route list.
          </p>
        </div>
        <div
          className="endpoint-shell endpoint-inventory-table"
          role="table"
          aria-label="Observed endpoint inventory"
        >
          <div role="row" className="is-head">
            {[
              "Endpoint",
              "Method",
              "Requests",
              "Avg. response",
              "Error rate",
              "Workflows",
            ].map((heading) => (
              <span role="columnheader" key={heading}>
                {heading}
              </span>
            ))}
          </div>
          {inventoryRows.map(
            ([method, route, requests, average, rate, flows]) => (
              <div role="row" key={route}>
                <span role="cell">{route}</span>
                <span role="cell">
                  <i className="endpoint-method">{method}</i>
                </span>
                <span role="cell">{requests}</span>
                <span role="cell">{average}</span>
                <span role="cell">{rate}</span>
                <span role="cell">{flows}</span>
              </div>
            ),
          )}
        </div>
        <small className="endpoint-shell endpoint-sample-note">
          Sample application data
        </small>
      </section>

      <AsideSection
        surface
        eyebrow="Response time analysis"
        title="Measure how long backend operations took during observed behavior."
        copy="Average response time is calculated across the requests captured during demonstrations. Tellann reports what it measured rather than percentiles it does not compute."
        mediaWidth={850}
        visual={{
          label: "Response time distribution / product UI design",
          master: "1500 × 850",
          display: "850 × 482",
        }}
      >
        <div className="endpoint-metric-block">
          <span>
            <small>Endpoint</small>
            <b>POST /payment</b>
          </span>
          <span>
            <small>Average</small>
            <b>891 ms</b>
          </span>
          <span>
            <small>Observed requests</small>
            <b>15</b>
          </span>
        </div>
        <p className="endpoint-panel-label">Observed durations</p>
        <div className="endpoint-duration-list">
          {["742 ms", "801 ms", "856 ms", "890 ms", "912 ms", "1,043 ms"].map(
            (value) => (
              <span key={value}>{value}</span>
            ),
          )}
        </div>
        <p className="endpoint-panel-copy">
          Minimum and maximum appear only where the implementation supports
          them. Average response time is the metric Phase 1 formally requires.
        </p>
      </AsideSection>

      <AsideSection
        eyebrow="Slow endpoint detection"
        title="Find backend calls that slow down the demonstrated workflow."
        copy="Slow is a configured threshold applied to observed averages, not a judgement. Each entry keeps its workflow and session count attached."
        mediaWidth={800}
        visual={{
          label: "Slowest observed endpoints ranking / product UI design",
          master: "1440 × 900",
          display: "800 × 500",
        }}
      >
        <div className="endpoint-rank-list">
          {[
            ["1", "POST /payment", "891 ms", "Checkout"],
            ["2", "POST /checkout", "418 ms", "Checkout"],
            ["3", "GET /search", "371 ms", "Search"],
            ["4", "GET /products", "184 ms", "Checkout · Search"],
          ].map(([rank, endpoint, value, workflow]) => (
            <span key={endpoint}>
              <small>{rank}</small>
              <b>{endpoint}</b>
              <i>{value}</i>
              <em>{workflow}</em>
            </span>
          ))}
        </div>
        <small className="endpoint-sample-note">Sample application data</small>
      </AsideSection>

      <AsideSection
        reverse
        surface
        eyebrow="Request volume"
        title="See which APIs your demonstrated workflows rely on most."
        copy="These are observed requests from controlled demonstrations, not production traffic—so the page says observed rather than traffic throughout."
        mediaWidth={800}
        visual={{
          label: "Most observed endpoints ranking / product UI design",
          master: "1440 × 900",
          display: "800 × 500",
        }}
      >
        <div className="endpoint-rank-list">
          {[
            ["1", "GET /products", "48", "Checkout · Search"],
            ["2", "GET /search", "31", "Search"],
            ["3", "POST /cart", "28", "Checkout"],
            ["4", "POST /checkout", "18", "Checkout"],
            ["5", "POST /payment", "15", "Checkout"],
          ].map(([rank, endpoint, value, workflow]) => (
            <span key={endpoint}>
              <small>{rank}</small>
              <b>{endpoint}</b>
              <i>{value} observed</i>
              <em>{workflow}</em>
            </span>
          ))}
        </div>
      </AsideSection>

      <AsideSection
        eyebrow="Error rate analysis"
        title="Find endpoints that produced errors during the workflow."
        copy="An error rate is more useful beside the states around it. Tellann keeps the application state and resulting state attached to every error observation."
        mediaWidth={900}
        visual={{
          label: "Endpoint error statistics with workflow mini-map / SVG design",
          master: "1600 × 900",
          display: "900 × 506",
        }}
      >
        <div className="endpoint-metric-block">
          <span>
            <small>Requests</small>
            <b>15</b>
          </span>
          <span>
            <small>Errors</small>
            <b>2</b>
          </span>
          <span>
            <small>Observed error rate</small>
            <b>13.3%</b>
          </span>
        </div>
        <div className="endpoint-error-card">
          <p className="endpoint-kicker">API error</p>
          <dl>
            {[
              ["Endpoint", "POST /payment"],
              ["Status", "503"],
              ["Duration", "893 ms"],
              ["Session", "SES-3817"],
              ["Workflow", "Checkout"],
              ["Application state", "PAYMENT_PENDING"],
              ["Resulting state", "PAYMENT_FAILURE"],
            ].map(([term, value]) => (
              <div key={term}>
                <dt>{term}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <span>View session →</span>
        </div>
      </AsideSection>

      <AsideSection
        reverse
        surface
        eyebrow="Endpoint health"
        title="Summarize endpoint behavior without losing the evidence beneath it."
        copy="Health is a deterministic status derived from configured thresholds—not an invented score. The numbers behind it stay visible."
        mediaWidth={760}
        visual={{
          label: "Endpoint health summary card / product UI design",
          master: "1400 × 800",
          display: "760 × 434",
        }}
      >
        <div className="endpoint-health-card">
          <p className="endpoint-kicker">POST /payment</p>
          <b>Slow · elevated errors</b>
          <dl>
            {[
              ["Response time", "891 ms"],
              ["Observed errors", "2 / 15"],
              ["Workflows", "Checkout"],
            ].map(([term, value]) => (
              <div key={term}>
                <dt>{term}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </div>
        <p className="endpoint-panel-label">Status vocabulary</p>
        <div className="endpoint-health-chips">
          {["Observed normally", "Slow", "Elevated errors", "Attention"].map(
            (status) => (
              <span key={status}>{status}</span>
            ),
          )}
        </div>
        <p className="endpoint-panel-copy">
          Tellann does not publish an endpoint health score out of 100. Until a
          scoring model is formalized, health is a configured, explainable
          status.
        </p>
      </AsideSection>

      <section className="endpoint-explorer-section" id="explorer">
        <div className="endpoint-shell endpoint-heading">
          <p className="endpoint-kicker">Interactive endpoint explorer</p>
          <h2>Move from endpoint metrics to behavioral context.</h2>
          <p>
            Choose a workflow, filter by category and method, and select an
            endpoint to see its observed activity, the states it touched, and
            the sessions behind it. The graph canvas remains a
            dimension-accurate placeholder for the final renderer.
          </p>
        </div>
        <div className="endpoint-shell-wide">
          <EndpointExplorer />
        </div>
        <p className="endpoint-shell endpoint-note">
          <b>Graph or table:</b> all endpoint context is available without
          interacting with a graph, and slow, error, and selected states carry
          text labels rather than relying on colour.
        </p>
      </section>

      <MediaSection
        eyebrow="Endpoint + Behavior Graph"
        title="See exactly where an endpoint participates in application behavior."
        copy="Turning on API context adds endpoints to the transitions of the same Behavior Graph. There is no second graph language to learn."
        note="Master 1920 × 1200 px · Display 1000 × 625 px · 8–10 second loop · Open graph, enable API context, select an endpoint, isolate its path, open the inspector"
        visual={{
          label: "Behavior Graph API context overlay / product recording",
          master: "1920 × 1200",
          display: "1000 × 625",
        }}
      >
        <div className="endpoint-chain">
          {[
            ["CART_ACTIVE", "POST /checkout"],
            ["CHECKOUT", "POST /payment"],
            ["PAYMENT_SUCCESS", ""],
          ].map(([state, endpoint]) => (
            <b key={state}>
              {state}
              {endpoint ? <i>{endpoint}</i> : null}
            </b>
          ))}
        </div>
        <div>
          <p className="endpoint-panel-copy">
            The overlay reuses the Behavior Graph renderer, so an endpoint
            appears exactly where it participated rather than in a detached
            inventory beside it.
          </p>
          <Link href="/product/behavior-graphs" className="endpoint-inline-link">
            Explore Behavior Graphs <span>→</span>
          </Link>
        </div>
      </MediaSection>

      <MediaSection
        surface
        eyebrow="Endpoint + workflow discovery"
        title="Understand APIs as parts of workflows—not an unrelated inventory."
        copy="This lets a team ask which endpoints Checkout depends on, rather than only which endpoints exist."
        note="Master 1600 × 900 px · Display 1000 × 562 px · Workflow cards expanding into their endpoint maps"
        visual={{
          label: "Workflow to endpoint map / SVG or product UI design",
          master: "1600 × 900",
          display: "1000 × 562",
        }}
      >
        <div className="endpoint-workflow-cards">
          {[
            [
              "Checkout",
              "4 endpoints",
              ["GET /products/:id", "POST /cart", "POST /checkout", "POST /payment"],
            ],
            ["Authentication", "2 endpoints", ["POST /auth/login", "GET /profile"]],
            ["Search", "2 endpoints", ["GET /search", "GET /products"]],
          ].map(([name, count, endpoints]) => (
            <article key={name as string}>
              <span>{name as string}</span>
              <b>{count as string}</b>
              <ul>
                {(endpoints as string[]).map((endpoint) => (
                  <li key={endpoint}>{endpoint}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
        <div>
          <p className="endpoint-panel-copy">
            The same endpoint can participate in several workflows. Keeping that
            relationship visible is what separates an endpoint inventory from an
            endpoint dependency map.
          </p>
          <Link
            href="/product/workflow-discovery"
            className="endpoint-inline-link"
          >
            Explore Workflow Discovery <span>→</span>
          </Link>
        </div>
      </MediaSection>

      <MediaSection
        eyebrow="Endpoint + session replay"
        title="Trace an endpoint observation back to the session where it happened."
        copy="Backend activity is associated with the session it occurred in, so an error observation leads to the exact moment in the reconstructed timeline."
        note="Master 1920 × 1200 px · Display 1000 × 625 px · 8–10 second loop · Select endpoint, open errors, select session, replay seeks to the API event"
        visual={{
          label: "Endpoint to Session Replay / product recording",
          master: "1920 × 1200",
          display: "1000 × 625",
        }}
      >
        <div>
          <p className="endpoint-panel-label">POST /payment</p>
          <p className="endpoint-panel-copy">
            2 error observations across the selected demonstrations.
          </p>
          <div className="endpoint-session-chips">
            {["SES-3817", "SES-4021"].map((session) => (
              <span key={session}>{session}</span>
            ))}
          </div>
        </div>
        <div>
          <p className="endpoint-panel-label">What replay shows</p>
          <ul className="endpoint-plain-list">
            {[
              "API_REQUEST at the captured timestamp",
              "API_ERROR with the response status",
              "The state the application was in",
              "The state that followed",
            ].map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <Link href="/product/session-replay" className="endpoint-inline-link">
            Explore Session Replay <span>→</span>
          </Link>
        </div>
      </MediaSection>

      <AsideSection
        surface
        eyebrow="Endpoint + coverage"
        title="Know which backend paths your demonstrations actually exercised."
        copy="Endpoint coverage is one of the five Phase 1 coverage dimensions. It describes which workflow-related endpoints were exercised during the observed sessions."
        mediaWidth={900}
        visual={{
          label: "Endpoint coverage beside the workflow map / SVG or UI design",
          master: "1600 × 900",
          display: "900 × 506",
        }}
      >
        <div className="endpoint-metric-block">
          <span>
            <small>Endpoint coverage</small>
            <b>87%</b>
          </span>
          <span>
            <small>Observed</small>
            <b>4</b>
          </span>
          <span>
            <small>Unobserved</small>
            <b>1</b>
          </span>
        </div>
        <p className="endpoint-panel-label">Observed</p>
        <ul className="endpoint-status-list">
          {["POST /cart", "POST /checkout", "POST /payment"].map((item) => (
            <li key={item}>
              <i aria-hidden="true">✓</i> {item}
            </li>
          ))}
        </ul>
        <p className="endpoint-panel-label">
          Not observed in selected demonstrations
        </p>
        <ul className="endpoint-status-list is-unobserved">
          {["POST /payment/retry", "DELETE /cart/item"].map((item) => (
            <li key={item}>
              <i aria-hidden="true">○</i> {item}
            </li>
          ))}
        </ul>
        <p className="endpoint-panel-copy">
          Absence of telemetry does not prove an endpoint exists and is unused,
          so Tellann says <b>not observed in selected demonstrations</b> rather
          than calling an endpoint unused.
        </p>
        <Link href="/product/coverage" className="endpoint-inline-link">
          View Coverage <span>→</span>
        </Link>
      </AsideSection>

      <section className="endpoint-gaps">
        <div className="endpoint-shell endpoint-heading">
          <p className="endpoint-kicker">Endpoint + missing states and flows</p>
          <h2>Backend outcomes can explain where behavior may be missing.</h2>
          <p>
            A consistently successful response is itself a signal. Rule-based
            analysis proposes the states and paths around it—as questions worth
            demonstrating, not as proof that the failed branch exists.
          </p>
        </div>
        <div className="endpoint-shell endpoint-gap-grid">
          <article>
            <p className="endpoint-kicker">Potential missing state</p>
            <div className="endpoint-chain">
              <b>
                POST /payment<i>200</i>
              </b>
              <b>PAYMENT_SUCCESS</b>
            </div>
            <div className="endpoint-chain is-gap">
              <b>
                POST /payment<i>4xx · 5xx</i>
              </b>
              <b>PAYMENT_FAILURE</b>
            </div>
            <Link
              href="/product/missing-states"
              className="endpoint-inline-link"
            >
              Explore Missing States <span>→</span>
            </Link>
          </article>
          <article>
            <p className="endpoint-kicker">Potential missing flow</p>
            <div className="endpoint-chain is-gap">
              <b>PAYMENT_FAILURE</b>
              <b>RETRY_PAYMENT</b>
              <b>
                POST /payment<i>retry</i>
              </b>
            </div>
            <p className="endpoint-panel-copy">
              If only successful payment was observed, both the failure state
              and the retry path remain unobserved.
            </p>
            <Link href="/product/missing-flows" className="endpoint-inline-link">
              Explore Missing Flows <span>→</span>
            </Link>
          </article>
        </div>
        <div className="endpoint-dual-media">
          <div>
            <VisualPlaceholder
              label="Endpoint outcome to potential missing state / SVG design"
              master="1500 × 850"
              display="900 × 510"
            />
            <p>Master 1500 × 850 px · Display 900 × 510 px</p>
          </div>
          <div>
            <VisualPlaceholder
              label="Endpoint outcome to potential missing flow / SVG design"
              master="1500 × 850"
              display="900 × 510"
            />
            <p>Master 1500 × 850 px · Display 900 × 510 px</p>
          </div>
        </div>
      </section>

      <section className="endpoint-rankings-section">
        <div className="endpoint-shell endpoint-heading">
          <p className="endpoint-kicker">Endpoint rankings</p>
          <h2>Find the endpoints that deserve attention first.</h2>
          <p>
            Three orderings over the same observed data—slowest, most observed,
            and highest error rate—each keeping the workflow attached.
          </p>
        </div>
        <div className="endpoint-shell endpoint-rankings-wrap">
          <EndpointRankings />
        </div>
      </section>

      <AsideSection
        surface
        eyebrow="Recommendations"
        title="Turn endpoint observations into practical next steps."
        copy="Every suggestion states the rule that produced it. Phase 1 recommendations are rule-based and stay inside what the captured evidence supports."
        mediaWidth={800}
        visual={{
          label: "Rule-based endpoint recommendation panel / product UI design",
          master: "1400 × 850",
          display: "800 × 486",
        }}
      >
        <div className="endpoint-recommendation">
          <p className="endpoint-kicker">Rule-based recommendation</p>
          <b>GET /products</b>
          <dl>
            <div>
              <dt>Observed average</dt>
              <dd>480 ms</dd>
            </div>
            <div>
              <dt>Suggestion</dt>
              <dd>
                Consider pagination where large response collections contribute
                to request cost.
              </dd>
            </div>
            <div>
              <dt>Basis</dt>
              <dd>Endpoint response-time rule</dd>
            </div>
          </dl>
        </div>
        <p className="endpoint-panel-label">Phase 1 suggestion types</p>
        <div className="endpoint-suggestion-list">
          {recommendations.map(([observation, action, basis]) => (
            <span key={observation}>
              <b>{observation}</b>
              <i>{action}</i>
              <small>{basis}</small>
            </span>
          ))}
        </div>
        <p className="endpoint-panel-copy">
          Recommendations are not AI-generated, and Tellann avoids suggesting
          query or index changes it has no database visibility to support.
        </p>
      </AsideSection>

      <AsideSection
        reverse
        eyebrow="Endpoint intelligence report"
        title="Turn backend observations into a QA artifact."
        copy="The report packages observed endpoint behavior—averages, request counts, error rates, rankings, and rule-based recommendations—into something a team can circulate."
        mediaWidth={600}
        visual={{
          label: "Endpoint Intelligence Report / portrait report UI design",
          master: "1000 × 1280",
          display: "600 × 768",
        }}
      >
        <div className="endpoint-report-summary">
          {[
            ["Application", "Storefront Demo"],
            ["Demonstration", "DEM-3817"],
            ["Endpoints observed", "12"],
            ["Slow endpoints", "2"],
            ["Elevated-error endpoints", "1"],
          ].map(([term, value]) => (
            <span key={term}>
              <small>{term}</small>
              <b>{value}</b>
            </span>
          ))}
        </div>
        <div className="endpoint-report-group">
          <small>Slowest</small>
          <span>
            <b>POST /payment</b>
            <i>891 ms</i>
          </span>
          <span>
            <b>POST /checkout</b>
            <i>418 ms</i>
          </span>
        </div>
        <div className="endpoint-report-group">
          <small>Highest error</small>
          <span>
            <b>POST /payment</b>
            <i>13.3%</i>
          </span>
        </div>
        <div className="endpoint-report-group">
          <small>Most observed</small>
          <span>
            <b>GET /products</b>
            <i>48 requests</i>
          </span>
        </div>
        <div className="endpoint-export-strip">
          <small>Export</small>
          {["PDF", "CSV", "JSON", "HTML"].map((format) => (
            <span key={format}>{format}</span>
          ))}
        </div>
        <Link href="/product/qa-reports" className="endpoint-inline-link">
          View QA Reports <span>→</span>
        </Link>
      </AsideSection>

      <AsideSection
        surface
        eyebrow="Privacy &amp; captured metadata"
        title="Analyze backend behavior without turning telemetry into payload surveillance."
        copy="Phase 1 captures endpoint metadata, not payloads. What a request was, how long it took, and what it returned is enough to connect it to behavior."
        mediaWidth={900}
        visual={{
          label: "Captured metadata versus excluded payload / SVG design",
          master: "1400 × 800",
          display: "900 × 514",
        }}
      >
        <p className="endpoint-panel-label">Captured</p>
        <ul className="endpoint-status-list">
          {capturedMetadata.map(([item]) => (
            <li key={item}>
              <i aria-hidden="true">✓</i> {item}
            </li>
          ))}
        </ul>
        <p className="endpoint-panel-label">Not captured</p>
        <ul className="endpoint-status-list is-unobserved">
          {notCaptured.map((item) => (
            <li key={item}>
              <i aria-hidden="true">✕</i> {item}
            </li>
          ))}
        </ul>
        <Link href="/security/data-collection" className="endpoint-inline-link">
          What Tellann collects <span>→</span>
        </Link>
      </AsideSection>

      <section className="endpoint-boundaries">
        <div className="endpoint-shell endpoint-heading">
          <p className="endpoint-kicker">What endpoint intelligence is not</p>
          <h2>
            Backend context without pretending to be an entire observability
            stack.
          </h2>
          <p>
            Tellann cares about the API because of the behavior it enabled or
            disrupted. That keeps this feature part of the behavioral QA model
            rather than a generic monitoring product.
          </p>
        </div>
        <div className="endpoint-shell endpoint-boundary-grid">
          <article>
            <span>Phase 1 is</span>
            <ul>
              {isList.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
          <article className="is-excluded">
            <span>Phase 1 is not</span>
            <ul>
              {isNotList.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
        </div>
      </section>

      <section className="endpoint-pipeline-section">
        <div className="endpoint-shell endpoint-heading">
          <p className="endpoint-kicker">Phase 1 implementation</p>
          <h2>From a click to a QA report.</h2>
          <p>
            The complete Phase 1 path, from the interface action through backend
            capture and correlation to every surface the endpoint appears on.
          </p>
        </div>
        <div className="endpoint-shell endpoint-pipeline">
          {[
            "Developer demonstration",
            "Frontend action",
            "Backend endpoint executes",
            "Backend SDK captures metadata",
            "Activity correlates with session",
            "Session reconstructs the workflow",
            "Response time, frequency, and error rate analyzed",
            "Endpoint appears in workflow, graph, coverage, replay, and report",
          ].map((step, index, list) => (
            <span key={step}>
              <small>{String(index + 1).padStart(2, "0")}</small>
              <b>{step}</b>
              {index < list.length - 1 ? <i aria-hidden="true">↓</i> : null}
            </span>
          ))}
        </div>
      </section>

      <section className="endpoint-future">
        <div className="endpoint-shell endpoint-heading">
          <p className="endpoint-kicker">
            Where endpoint intelligence goes next
          </p>
          <h2>Observed behavior first. Production and intelligence later.</h2>
          <p>
            Phase 1 works from controlled demonstrations. Continuous monitoring,
            database intelligence, and autonomous analysis stay named as
            planned.
          </p>
        </div>
        <div className="endpoint-shell endpoint-phase-grid">
          <article>
            <span>Phase 01 · Behavioral QA</span>
            <p>
              Captured endpoint activity · Latency analysis · Observed request
              volume · Error-rate analysis · Slow endpoints · Frequently
              observed endpoints · Workflow correlation · Session correlation ·
              Endpoint coverage · Endpoint reports
            </p>
          </article>
          <article>
            <span>Phase 02 · Planned</span>
            <p>
              Continuous production endpoint monitoring · Workflow-health
              correlation · Production trends · Error-investigation context ·
              Database intelligence · Logs and trace correlation
            </p>
          </article>
          <article>
            <span>Phase 03 · Planned</span>
            <p>
              Regression detection · Automated failure validation · Failure
              simulation · Optimization intelligence · Anomaly detection ·
              Autonomous quality recommendations
            </p>
          </article>
        </div>
      </section>

      <section className="endpoint-faq">
        <div className="endpoint-shell endpoint-faq-grid">
          <div>
            <p className="endpoint-kicker">FAQ</p>
            <h2>Questions behind the requests.</h2>
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

      <section className="endpoint-final">
        <div className="endpoint-shell">
          <p className="endpoint-kicker">Connect behavior to the backend</p>
          <h2>See what your APIs were doing when the workflow changed.</h2>
          <p>
            Connect Tellann&apos;s backend SDK, demonstrate a workflow, and
            inspect the requests, responses, latency, errors, and endpoint
            activity behind the behavior you observed.
          </p>
          <div className="endpoint-actions">
            <a className="is-primary" href={dashboardUrl}>
              Start free <span>↗</span>
            </a>
            <Link href="/developers/sdk">
              View SDK documentation <span>→</span>
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
