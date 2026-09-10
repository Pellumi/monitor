"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ProductPlaceholder } from "@/components/product-tour";

type EventGroup =
  | "session"
  | "navigation"
  | "ui"
  | "form"
  | "state"
  | "workflow"
  | "api"
  | "error";

type ReplayEvent = {
  time: string;
  type: string;
  detail: string;
  group: EventGroup;
  failure?: boolean;
  meta: [string, string][];
};

const replayEvents: ReplayEvent[] = [
  {
    time: "00:00",
    type: "SESSION_STARTED",
    detail: "Storefront Demo",
    group: "session",
    meta: [
      ["Session", "SES-3817"],
      ["Session type", "DEMONSTRATION"],
      ["Environment", "demo"],
    ],
  },
  {
    time: "00:04",
    type: "PAGE_VISIT",
    detail: "/products",
    group: "navigation",
    meta: [
      ["Route", "/products"],
      ["State", "PRODUCT_VIEW"],
      ["Referrer", "/"],
    ],
  },
  {
    time: "00:08",
    type: "BUTTON_CLICK",
    detail: "checkout-button",
    group: "ui",
    meta: [
      ["Element", "checkout-button"],
      ["State", "CART_ACTIVE"],
      ["Workflow", "Checkout"],
    ],
  },
  {
    time: "00:09",
    type: "WORKFLOW_STARTED",
    detail: "Checkout",
    group: "workflow",
    meta: [
      ["Workflow", "Checkout"],
      ["Entry state", "CART_ACTIVE"],
      ["Trigger", "BUTTON_CLICK"],
    ],
  },
  {
    time: "00:11",
    type: "STATE_TRANSITION",
    detail: "CART_ACTIVE → CHECKOUT",
    group: "state",
    meta: [
      ["From", "CART_ACTIVE"],
      ["To", "CHECKOUT"],
      ["Duration", "180 ms"],
    ],
  },
  {
    time: "00:12",
    type: "API_REQUEST",
    detail: "POST /checkout",
    group: "api",
    meta: [
      ["Endpoint", "POST /checkout"],
      ["State", "CHECKOUT"],
      ["Workflow", "Checkout"],
    ],
  },
  {
    time: "00:13",
    type: "API_ERROR",
    detail: "503 · POST /payment",
    group: "api",
    failure: true,
    meta: [
      ["Endpoint", "POST /payment"],
      ["Status", "503"],
      ["Duration", "893 ms"],
      ["Workflow", "Checkout"],
      ["State", "PAYMENT_PENDING"],
    ],
  },
  {
    time: "00:14",
    type: "ERROR_OCCURRED",
    detail: "PaymentGatewayUnavailable",
    group: "error",
    failure: true,
    meta: [
      ["Error", "PaymentGatewayUnavailable"],
      ["Origin", "SERVER_ERROR"],
      ["State", "PAYMENT_PENDING"],
      ["Related event", "API_ERROR"],
    ],
  },
  {
    time: "00:19",
    type: "FORM_VALIDATION_FAILED",
    detail: "payment-form",
    group: "form",
    failure: true,
    meta: [
      ["Form", "payment-form"],
      ["Failed fields", "2 (masked)"],
      ["State", "PAYMENT_PENDING"],
    ],
  },
  {
    time: "00:24",
    type: "STATE_TRANSITION",
    detail: "PAYMENT_PENDING → CHECKOUT",
    group: "state",
    meta: [
      ["From", "PAYMENT_PENDING"],
      ["To", "CHECKOUT"],
      ["Path", "Recovery"],
    ],
  },
  {
    time: "00:28",
    type: "API_REQUEST",
    detail: "POST /payment",
    group: "api",
    meta: [
      ["Endpoint", "POST /payment"],
      ["Attempt", "2"],
      ["State", "PAYMENT_PENDING"],
    ],
  },
  {
    time: "00:29",
    type: "API_RESPONSE",
    detail: "200 · 412 ms",
    group: "api",
    meta: [
      ["Endpoint", "POST /payment"],
      ["Status", "200"],
      ["Duration", "412 ms"],
    ],
  },
  {
    time: "00:31",
    type: "WORKFLOW_COMPLETED",
    detail: "Checkout",
    group: "workflow",
    meta: [
      ["Workflow", "Checkout"],
      ["Exit state", "ORDER_COMPLETE"],
      ["Outcome", "Success after recovery"],
    ],
  },
];

const filters = [
  { key: "all", label: "All events" },
  { key: "errors", label: "Errors" },
  { key: "api", label: "API failures" },
  { key: "state", label: "State changes" },
  { key: "workflow", label: "Workflow events" },
] as const;

type FilterKey = (typeof filters)[number]["key"];

function matchesFilter(event: ReplayEvent, filter: FilterKey) {
  if (filter === "all") return true;
  if (filter === "errors") return Boolean(event.failure);
  if (filter === "api") return event.group === "api" && Boolean(event.failure);
  if (filter === "state") return event.group === "state";
  return event.group === "workflow";
}

const speeds = [1, 2, 5, 10] as const;

export function SessionReplayExplorer() {
  const [index, setIndex] = useState(0);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [speed, setSpeed] = useState<(typeof speeds)[number]>(1);
  const [playing, setPlaying] = useState(false);
  const [timelineOnly, setTimelineOnly] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const current = replayEvents[index];
  const visibleEvents = useMemo(
    () =>
      replayEvents
        .map((event, position) => ({ event, position }))
        .filter(({ event }) => matchesFilter(event, filter)),
    [filter],
  );

  const step = useCallback((direction: -1 | 1) => {
    setPlaying(false);
    setIndex((value) =>
      Math.min(replayEvents.length - 1, Math.max(0, value + direction)),
    );
  }, []);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      setIndex((value) => {
        if (value >= replayEvents.length - 1) {
          setPlaying(false);
          return value;
        }
        return value + 1;
      });
    }, 1600 / speed);
    return () => window.clearInterval(timer);
  }, [playing, speed]);

  useEffect(() => {
    if (!fullscreen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFullscreen(false);
    };
    const previousOverflow = document.body.style.overflow;
    document.addEventListener("keydown", closeOnEscape);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.body.style.overflow = previousOverflow;
    };
  }, [fullscreen]);

  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(".is-current")
      ?.scrollIntoView({ block: "nearest" });
  }, [index, filter]);

  return (
    <div
      className={`replay-explorer${timelineOnly ? " is-timeline-only" : ""}${
        fullscreen ? " is-fullscreen" : ""
      }`}
    >
      <header className="replay-explorer-header">
        <div className="replay-explorer-identity">
          <p>Session replay</p>
          <b>SES-3817</b>
          <span>Workflow · Checkout</span>
        </div>
        <div className="replay-explorer-modes">
          <button
            type="button"
            className={timelineOnly ? "" : "is-active"}
            aria-pressed={!timelineOnly}
            onClick={() => setTimelineOnly(false)}
          >
            Replay
          </button>
          <button
            type="button"
            className={timelineOnly ? "is-active" : ""}
            aria-pressed={timelineOnly}
            onClick={() => setTimelineOnly(true)}
          >
            Timeline only
          </button>
          <span className="replay-explorer-clock">00:31 · 428 events</span>
        </div>
      </header>

      <div className="replay-explorer-canvas">
        <ProductPlaceholder
          label="Reconstructed session canvas / behavioral replay renderer"
          dimensions="1728 × 1328"
          displayDimensions="864 × 664"
        />
        <span className="replay-canvas-badge">
          {current.time} · {current.type}
        </span>
      </div>

      <div className="replay-explorer-controls">
        <div className="replay-transport">
          <button
            type="button"
            aria-label="Previous event"
            onClick={() => step(-1)}
            disabled={index === 0}
          >
            |◀
          </button>
          <button
            type="button"
            className="is-primary"
            aria-label={playing ? "Pause replay" : "Play replay"}
            onClick={() => setPlaying((value) => !value)}
          >
            {playing ? "❚❚" : "▶"}
          </button>
          <button
            type="button"
            aria-label="Next event"
            onClick={() => step(1)}
            disabled={index === replayEvents.length - 1}
          >
            ▶|
          </button>
        </div>
        <label className="replay-seek">
          <span>Seek</span>
          <input
            type="range"
            min={0}
            max={replayEvents.length - 1}
            value={index}
            aria-label="Seek to event"
            aria-valuetext={`${current.time} ${current.type}`}
            onChange={(event) => {
              setPlaying(false);
              setIndex(Number(event.target.value));
            }}
          />
          <b>{current.time}</b>
        </label>
        <div className="replay-speed" aria-label="Playback speed">
          {speeds.map((value) => (
            <button
              key={value}
              type="button"
              className={speed === value ? "is-active" : ""}
              aria-pressed={speed === value}
              onClick={() => setSpeed(value)}
            >
              {value}×
            </button>
          ))}
        </div>
        <button
          type="button"
          className="replay-fullscreen-toggle"
          onClick={() => setFullscreen((value) => !value)}
        >
          {fullscreen ? "Close fullscreen" : "Open replay fullscreen"}
        </button>
      </div>

      <div className="replay-explorer-current">
        <p>Current event</p>
        <b>
          {current.time} · {current.type}
        </b>
        <span>{current.detail}</span>
      </div>

      <div className="replay-explorer-timeline">
        <div className="replay-filter-row" aria-label="Jump to evidence">
          {filters.map((item) => (
            <button
              key={item.key}
              type="button"
              className={filter === item.key ? "is-active" : ""}
              aria-pressed={filter === item.key}
              onClick={() => setFilter(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="replay-event-list" ref={listRef}>
          <p className="replay-event-count" aria-live="polite">
            {visibleEvents.length} of {replayEvents.length} events
          </p>
          {visibleEvents.map(({ event, position }) => (
            <button
              key={`${event.time}-${event.type}`}
              type="button"
              className={`${position === index ? "is-current " : ""}${
                event.failure ? "is-failure" : ""
              }`}
              aria-current={position === index ? "true" : undefined}
              onClick={() => {
                setPlaying(false);
                setIndex(position);
              }}
            >
              <span>{event.time}</span>
              <b>{event.type}</b>
              <small>{event.detail}</small>
            </button>
          ))}
        </div>
        <div className="replay-inspector" aria-live="polite">
          <p>Event inspector</p>
          <h3>{current.type}</h3>
          <dl>
            {current.meta.map(([term, value]) => (
              <div key={term}>
                <dt>{term}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <small>Sample application data</small>
        </div>
      </div>
    </div>
  );
}
