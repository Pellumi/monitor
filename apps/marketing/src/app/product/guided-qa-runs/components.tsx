"use client";

import { useEffect, useId, useRef, useState } from "react";

/* ─────────────────────────────────────────────────────────────
   Media placeholder
   Renders at exactly `width × height` whenever the container has room, and
   reports the size it actually rendered at so the asset slot is unambiguous.
   ───────────────────────────────────────────────────────────── */

export function GuidedMedia({
  label,
  width,
  height,
  master,
  note,
}: {
  label: string;
  width: number;
  height: number;
  master?: string;
  note?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [rendered, setRendered] = useState(`${width} × ${height}`);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(() => {
      const box = element.getBoundingClientRect();
      setRendered(`${Math.round(box.width)} × ${Math.round(box.height)}`);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <figure className="guided-media-frame">
      <div
        ref={ref}
        className="guided-media"
        style={{
          width: `min(100%, ${width}px)`,
          aspectRatio: `${width} / ${height}`,
        }}
        role="img"
        aria-label={`${label} placeholder, displayed at ${width} × ${height} pixels${
          master ? `, ${master} pixel master` : ""
        }`}
      >
        <span>Visual placeholder</span>
        <strong>{label}</strong>
        <small>
          Display {width} × {height} px{master ? ` · Master ${master} px` : ""}
        </small>
        <small>Rendered {rendered} px</small>
      </div>
      {note ? <figcaption>{note}</figcaption> : null}
    </figure>
  );
}

/* ─────────────────────────────────────────────────────────────
   Hero — simulated guided run (720 × 470)
   Plays the eight-second sequence once, then stops. The visitor can pause,
   resume, or end the run at any point, and ending early shows the honest
   outcome for how far the run actually got.
   ───────────────────────────────────────────────────────────── */

const flowSteps = [
  { label: "Cart", state: "CART_REVIEW" },
  { label: "Checkout", state: "CHECKOUT_STARTED" },
  { label: "Payment", state: "PAYMENT_SUBMITTED" },
  { label: "Confirmation", state: "ORDER_CONFIRMED" },
];

type Page = "signin" | "product" | "checkout" | "payment" | "confirmation";

type Frame = {
  status: string;
  live: boolean;
  /** Steps confirmed so far. */
  reached: number;
  /** Step the run is currently on, if any. */
  current: number | null;
  expected: string;
  confirmed?: boolean;
  page: Page;
  events: number;
  clock: string;
};

const frames: Frame[] = [
  { status: "Armed", live: false, reached: 0, current: null, expected: "CART_REVIEW", page: "signin", events: 0, clock: "00:00" },
  { status: "Waiting for flow start…", live: false, reached: 0, current: null, expected: "CART_REVIEW", page: "product", events: 38, clock: "00:41" },
  { status: "Flow started", live: true, reached: 1, current: 1, expected: "CHECKOUT_STARTED", page: "checkout", events: 96, clock: "01:52" },
  { status: "Recording", live: true, reached: 2, current: 2, expected: "PAYMENT_SUBMITTED", page: "payment", events: 143, clock: "03:12" },
  { status: "Recording", live: true, reached: 3, current: null, expected: "PAYMENT_SUBMITTED", confirmed: true, page: "payment", events: 151, clock: "03:24" },
  { status: "Recording", live: true, reached: 3, current: 3, expected: "ORDER_CONFIRMED", page: "confirmation", events: 151, clock: "03:26" },
];

/** When each frame after the first appears, in ms — the plan's 8 s sequence. */
const frameDelays = [1500, 2500, 3500, 5000, 6000];
const captionDelay = 7000;

type Ending = "none" | "complete" | "incomplete" | "no-boundary";

function BrowserPage({ page, pressed }: { page: Page; pressed: boolean }) {
  switch (page) {
    case "signin":
      return (
        <>
          <b>Storefront</b>
          <small>Sign in</small>
          <span className="guided-field">QA account</span>
          <span className="guided-field">••••••••</span>
        </>
      );
    case "product":
      return (
        <>
          <b>Wireless headphones</b>
          <small>Setup navigation · context only</small>
          <span className="guided-mock-button">Add to cart</span>
        </>
      );
    case "checkout":
      return (
        <>
          <b>Checkout</b>
          <small>Order summary · 2 items</small>
          <span className="guided-mock-button">Continue to payment</span>
        </>
      );
    case "payment":
      return (
        <>
          <b>Payment details</b>
          <span className="guided-field">•••• •••• •••• ••••</span>
          <span className={`guided-mock-button${pressed ? " is-pressed" : ""}`}>
            Pay
          </span>
        </>
      );
    case "confirmation":
      return (
        <>
          <b>Order confirmed</b>
          <small>Thank you for your order</small>
        </>
      );
  }
}

export function GuidedRunHero() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [ending, setEnding] = useState<Ending>("none");
  const [captioned, setCaptioned] = useState(false);
  const timers = useRef<number[]>([]);

  const clearTimers = () => {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
  };

  /** Schedule every frame after `from`, `spacing` ms apart from now. */
  const scheduleFrom = (from: number, delays: number[], caption: number) => {
    delays.forEach((delay, i) => {
      const target = from + 1 + i;
      timers.current.push(window.setTimeout(() => setIndex(target), delay));
    });
    timers.current.push(window.setTimeout(() => setCaptioned(true), caption));
  };

  useEffect(() => {
    // Always scheduled, never set synchronously: the server renders the armed
    // state and the client either plays the sequence or resolves it next tick.
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      timers.current.push(window.setTimeout(() => setIndex(frames.length - 1), 0));
      timers.current.push(window.setTimeout(() => setCaptioned(true), 0));
    } else {
      scheduleFrom(0, frameDelays, captionDelay);
    }
    return clearTimers;
  }, []);

  const frame = frames[index];
  const ended = ending !== "none";

  const pause = () => {
    clearTimers();
    setPaused(true);
  };

  const resume = () => {
    setPaused(false);
    const remaining = frames.length - 1 - index;
    const delays = Array.from({ length: remaining }, (_, i) => (i + 1) * 1000);
    scheduleFrom(index, delays, (remaining + 1) * 1000);
  };

  const endRun = () => {
    clearTimers();
    setPaused(false);
    setCaptioned(false);
    // The honest outcome depends on how far the run really got.
    setEnding(index < 2 ? "no-boundary" : index >= 5 ? "complete" : "incomplete");
  };

  const replay = () => {
    clearTimers();
    setEnding("none");
    setPaused(false);
    setCaptioned(false);
    setIndex(0);
    scheduleFrom(0, frameDelays, captionDelay);
  };

  const reachedCount =
    ending === "complete" ? flowSteps.length : frame.reached;

  const statusLabel = ended
    ? ending === "complete"
      ? "Completed"
      : "Completed incomplete"
    : paused
      ? "Paused"
      : frame.status;

  return (
    <div className="guided-run-wrap">
      <div className="guided-run" data-live={frame.live && !paused && !ended}>
        <header className="guided-run-header">
          <p>
            <span>Tellann</span> · Guided run · Checkout
          </p>
          <span
            className={`guided-rec${frame.live && !paused && !ended ? " is-live" : ""}`}
            aria-live="polite"
          >
            <i aria-hidden="true" />
            {statusLabel}
          </span>
        </header>

        <div className="guided-run-body">
          <ol className="guided-run-rail" aria-label="Flow progress">
            {flowSteps.map((step, i) => {
              const done = i < reachedCount;
              const now = !ended && frame.current === i;
              return (
                <li key={step.state} className={done ? "is-done" : now ? "is-now" : ""}>
                  <i aria-hidden="true">{done ? "✓" : now ? "●" : "○"}</i>
                  <span>
                    {step.label}
                    <small>{step.state}</small>
                  </span>
                </li>
              );
            })}
          </ol>
          <div className="guided-run-browser">
            <div className="guided-browser-bar" aria-hidden="true">
              <i />
              <i />
              <i />
              <span>Managed browser</span>
            </div>
            <div className="guided-browser-page" key={frame.page}>
              <BrowserPage page={frame.page} pressed={index === 4} />
            </div>
          </div>
        </div>

        <dl className="guided-run-status">
          <div>
            <dt>{ended ? "Outcome" : "Expected"}</dt>
            <dd>
              {ended
                ? ending === "complete"
                  ? "COMPLETED"
                  : "COMPLETED_INCOMPLETE"
                : `${frame.confirmed ? "✓ " : ""}${frame.expected}`}
            </dd>
          </div>
          <div>
            <dt>Evidence</dt>
            <dd>
              {ending === "no-boundary"
                ? "No in-flow evidence"
                : `${frame.events} events`}
            </dd>
          </div>
          <div>
            <dt>Elapsed</dt>
            <dd>{frame.clock}</dd>
          </div>
        </dl>

        <footer className="guided-run-actions">
          {ended ? (
            <>
              <p aria-live="polite">
                {ending === "complete"
                  ? "Run complete. Processing into replay, coverage, and a report."
                  : ending === "incomplete"
                    ? "Evidence retained. The run is marked incomplete, not discarded."
                    : "Ended before the flow began. Coverage is not reported as 0%."}
              </p>
              <button type="button" onClick={replay}>
                Replay
              </button>
            </>
          ) : (
            <>
              <button type="button" onClick={paused ? resume : pause}>
                {paused ? "Resume" : "Pause"}
              </button>
              <button type="button" className="is-primary" onClick={endRun}>
                End run
              </button>
            </>
          )}
        </footer>
      </div>
      <p className={`guided-run-caption${captioned ? " is-visible" : ""}`}>
        You perform the workflow. Tellann records the evidence.
      </p>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Run modes
   ───────────────────────────────────────────────────────────── */

const modes = [
  {
    id: "guided",
    label: "Guided",
    tag: "Primary",
    header: "Guided run · Checkout",
    copy: "Tellann has a declared flow and helps you verify it — confirming the boundaries and showing the states it expects to see next.",
    best: ["Known workflow verification"],
    railTitle: "Expected next",
    rail: [
      ["✓", "CHECKOUT_STARTED"],
      ["●", "PAYMENT_SUBMITTED"],
      ["○", "ORDER_CONFIRMED"],
    ],
  },
  {
    id: "assisted",
    label: "Assisted",
    tag: "Flexible",
    header: "Assisted run",
    copy: "Navigate freely. Tellann relates the activity to the declared flow it most closely resembles and surfaces expectations without directing the run.",
    best: ["Exploration", "Partially declared intent"],
    railTitle: "Possible match",
    rail: [
      ["≈", "Checkout · 4 states observed"],
      ["○", "Registration · 1 state observed"],
    ],
  },
  {
    id: "observation",
    label: "Observation only",
    tag: "Specialized",
    header: "Observation only · Read-safe interaction",
    copy: "Tellann records without prompting or directing the session, and restricts itself to read-safe interactions.",
    best: ["Sensitive or shared targets"],
    railTitle: null,
    rail: [],
  },
] as const;

export function RunModes() {
  const [active, setActive] = useState(0);
  const mode = modes[active];

  return (
    <div className="guided-modes">
      <div className="guided-mode-tabs" role="tablist" aria-label="Run modes">
        {modes.map((item, i) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            id={`guided-mode-${item.id}`}
            aria-selected={active === i}
            aria-controls="guided-mode-panel"
            onClick={() => setActive(i)}
          >
            {item.label}
            <small>{item.tag}</small>
          </button>
        ))}
      </div>
      <div
        className="guided-mode-panel"
        id="guided-mode-panel"
        role="tabpanel"
        aria-labelledby={`guided-mode-${mode.id}`}
        key={mode.id}
      >
        <div className="guided-mode-screen">
          <p className="guided-mode-header">{mode.header}</p>
          {mode.railTitle ? (
            <>
              <p className="guided-label">{mode.railTitle}</p>
              <ul>
                {mode.rail.map(([glyph, text]) => (
                  <li key={text}>
                    <i aria-hidden="true">{glyph}</i>
                    {text}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="guided-mode-empty">
              No flow rail. Nothing is prompted or directed.
            </p>
          )}
        </div>
        <div className="guided-mode-copy">
          <p>{mode.copy}</p>
          <p className="guided-label">Best for</p>
          <div className="guided-chips">
            {mode.best.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Pause, resume, and incomplete runs
   ───────────────────────────────────────────────────────────── */

type Lifecycle = "running" | "paused" | "incomplete" | "no-boundary";

export function RunLifecycle() {
  const [state, setState] = useState<Lifecycle>("running");

  return (
    <div className={`guided-lifecycle is-${state}`} aria-live="polite">
      {state === "running" || state === "paused" ? (
        <>
          <p className="guided-lifecycle-state">
            <i aria-hidden="true" />
            {state === "running" ? "Running" : "Paused"}
          </p>
          <dl>
            <div>
              <dt>Elapsed</dt>
              <dd>03:41</dd>
            </div>
            <div>
              <dt>{state === "paused" ? "Evidence so far" : "Evidence"}</dt>
              <dd>151 events</dd>
            </div>
          </dl>
          <div className="guided-lifecycle-actions">
            {state === "running" ? (
              <>
                <button type="button" onClick={() => setState("paused")}>
                  Pause
                </button>
                <button type="button" onClick={() => setState("incomplete")}>
                  Close browser
                </button>
              </>
            ) : (
              <>
                <button type="button" className="is-primary" onClick={() => setState("running")}>
                  Resume
                </button>
                <button type="button" onClick={() => setState("incomplete")}>
                  End run
                </button>
              </>
            )}
          </div>
        </>
      ) : (
        <>
          <p className="guided-lifecycle-state is-ended">Run ended early</p>
          <dl>
            <div>
              <dt>Outcome</dt>
              <dd>COMPLETED_INCOMPLETE</dd>
            </div>
            {state === "incomplete" ? (
              <>
                <div>
                  <dt>Reached</dt>
                  <dd>PAYMENT_SUBMITTED</dd>
                </div>
                <div>
                  <dt>Not reached</dt>
                  <dd>ORDER_CONFIRMED</dd>
                </div>
                <div>
                  <dt>Evidence retained</dt>
                  <dd>151 events</dd>
                </div>
              </>
            ) : (
              <>
                <div>
                  <dt>In-flow evidence</dt>
                  <dd>None gathered</dd>
                </div>
                <div>
                  <dt>Coverage</dt>
                  <dd>Not reported — never 0%</dd>
                </div>
                <div>
                  <dt>Context retained</dt>
                  <dd>38 pre-boundary events</dd>
                </div>
              </>
            )}
          </dl>
          <div className="guided-lifecycle-actions">
            {state === "incomplete" ? (
              <button type="button" onClick={() => setState("no-boundary")}>
                What if it closed before the flow began?
              </button>
            ) : null}
            <button type="button" onClick={() => setState("running")}>
              Reset example
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Capture tracks — "not measured" is never reported as zero
   ───────────────────────────────────────────────────────────── */

export function CaptureTracks() {
  const [frontend, setFrontend] = useState(true);
  const [backend, setBackend] = useState(true);
  const [hint, setHint] = useState(false);

  const toggle = (track: "frontend" | "backend") => {
    const next = track === "frontend" ? !frontend : !backend;
    const other = track === "frontend" ? backend : frontend;
    // A run needs at least one track; refuse to turn off the last one.
    if (!next && !other) {
      setHint(true);
      return;
    }
    setHint(false);
    if (track === "frontend") setFrontend(next);
    else setBackend(next);
  };

  return (
    <div className="guided-tracks">
      <fieldset>
        <legend className="guided-label">Capture tracks</legend>
        <label>
          <input type="checkbox" checked={frontend} onChange={() => toggle("frontend")} />
          <span>
            Frontend <small>Browser behavior</small>
          </span>
        </label>
        <label>
          <input type="checkbox" checked={backend} onChange={() => toggle("backend")} />
          <span>
            Backend <small>API behavior</small>
          </span>
        </label>
        {hint ? <p className="guided-tracks-hint">A run needs at least one capture track.</p> : null}
      </fieldset>
      <dl aria-live="polite">
        <div>
          <dt>Browser behavior</dt>
          <dd className={frontend ? "" : "is-off"}>{frontend ? "Measured" : "Not measured"}</dd>
        </div>
        <div>
          <dt>Endpoint behavior</dt>
          <dd className={backend ? "" : "is-off"}>{backend ? "Measured" : "Not measured"}</dd>
        </div>
      </dl>
      <p className="guided-tracks-note">
        {backend
          ? "Both tracks correlate into the same run."
          : "Reported as not measured — never as zero endpoints or zero errors."}
      </p>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Benefits by role
   ───────────────────────────────────────────────────────────── */

const personas = [
  {
    id: "qa",
    tab: "QA engineer",
    headline: "Run exploratory QA without losing the evidence trail.",
    benefits: [
      "Start from a declared workflow and know which state you are verifying.",
      "Setup navigation stays separate from the flow being evaluated.",
      "Annotate unusual behavior during the run, and keep incomplete runs.",
      "Get coverage, reconciliation, and missing-flow results afterwards.",
    ],
    core: "Turn a walkthrough into repeatable QA evidence.",
  },
  {
    id: "developer",
    tab: "Developer",
    headline: "Show the behavior instead of spending the day explaining it.",
    benefits: [
      "Walk the actual application and get structured evidence back.",
      "See frontend and backend activity in the context of one run.",
      "Understand which states actually occurred.",
      "Leave with a replay and a report you can point to.",
    ],
    core: "Use the application normally. Let Tellann structure what happened.",
  },
  {
    id: "manager",
    tab: "Engineering manager",
    headline: "Get evidence behind the team's QA conclusions.",
    benefits: [
      "Run mode, capture tracks, and the evidence boundary are all recorded.",
      "Incomplete runs stay identifiable instead of passing quietly.",
      "Findings link back to the run that produced them.",
      "Reports show what was actually measured.",
    ],
    core: "Know what a conclusion was based on — not just that someone said the flow passed.",
  },
  {
    id: "product",
    tab: "Product manager",
    headline: "See whether the intended journey was actually demonstrated.",
    benefits: [
      "Compare the declared flow with what the demonstration showed.",
      "Spot undeclared behavior and missing states.",
      "Use the replay to understand what really occurred.",
      "Discuss concrete evidence with QA and engineering.",
    ],
    core: "Move from “I think it works” to “this is what we observed.”",
  },
] as const;

export function GuidedRoles() {
  const [active, setActive] = useState(0);
  const selectId = useId();
  const persona = personas[active];

  return (
    <div className="guided-roles">
      <div className="guided-role-tabs" role="tablist" aria-label="Benefits by role">
        {personas.map((item, i) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            id={`guided-role-${item.id}`}
            aria-selected={active === i}
            aria-controls="guided-role-panel"
            onClick={() => setActive(i)}
          >
            {item.tab}
          </button>
        ))}
      </div>
      <div className="guided-role-select">
        <label htmlFor={selectId}>Who are you?</label>
        <select
          id={selectId}
          value={active}
          onChange={(event) => setActive(Number(event.target.value))}
        >
          {personas.map((item, i) => (
            <option key={item.id} value={i}>
              {item.tab}
            </option>
          ))}
        </select>
      </div>
      <div
        className="guided-role-panel"
        id="guided-role-panel"
        role="tabpanel"
        aria-labelledby={`guided-role-${persona.id}`}
        key={persona.id}
      >
        <h3>{persona.headline}</h3>
        <ul>
          {persona.benefits.map((benefit) => (
            <li key={benefit}>{benefit}</li>
          ))}
        </ul>
        <p className="guided-role-core">{persona.core}</p>
      </div>
    </div>
  );
}
