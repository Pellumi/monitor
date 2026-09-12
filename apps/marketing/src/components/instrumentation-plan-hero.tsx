"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The hero's simulated instrumentation plan.
 *
 * Runs one short, self-explanatory sequence on mount — uninstrumented code,
 * checkpoints located, proposed diff, approval, apply, validate — then stops.
 * It never loops, and it jumps straight to the resolved state when the visitor
 * prefers reduced motion. The visitor can drive it manually at any point.
 */
type Stage =
  | "plain"
  | "marked"
  | "proposed"
  | "focus"
  | "applying"
  | "validated"
  | "rejected";

type Line = {
  text: string;
  /** Proposed additions only appear once the plan reaches the diff stage. */
  added?: boolean;
  /** Marks where a checkpoint was located, before the diff is drawn. */
  marker?: string;
};

const lines: Line[] = [
  { text: "const checkout = async () => {" },
  { text: "", marker: "CHECKOUT_STARTED" },
  { text: '  tellann.trackState("CHECKOUT_STARTED")', added: true },
  { text: "" },
  { text: "  const result = await submitOrder()" },
  { text: "", marker: "ORDER_COMPLETE" },
  { text: "  tellann.trackTransition(", added: true },
  { text: '    "CHECKOUT_STARTED",', added: true },
  { text: '    "ORDER_COMPLETE"', added: true },
  { text: "  )", added: true },
  { text: "" },
  { text: "  return result" },
  { text: "}" },
];

const checks = [
  "No secrets detected",
  "Working tree checkpointed",
  "Rollback available",
];

const statusCopy: Record<Stage, string> = {
  plain: "Analyzing workspace",
  marked: "Checkpoints located",
  proposed: "Awaiting review",
  focus: "Awaiting review",
  applying: "Applying…",
  validated: "Applied · validated",
  rejected: "Plan rejected · nothing changed",
};

export function InstrumentationPlanHero() {
  const [stage, setStage] = useState<Stage>("plain");
  const timers = useRef<number[]>([]);

  const clearTimers = () => {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
  };

  useEffect(() => {
    // Scheduled rather than set synchronously: the server renders the
    // uninstrumented state, and the client either plays the sequence or jumps
    // straight to the resolved state on the next tick.
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const steps: [Stage, number][] = reduced
      ? [["validated", 0]]
      : [
          ["marked", 1000],
          ["proposed", 2200],
          ["focus", 3500],
          ["applying", 5200],
          ["validated", 6400],
        ];
    steps.forEach(([next, delay]) => {
      timers.current.push(window.setTimeout(() => setStage(next), delay));
    });
    return clearTimers;
  }, []);

  const showDiff = stage !== "plain" && stage !== "marked";
  const showMarkers = stage === "marked";
  const applied = stage === "validated";
  const decided = applied || stage === "rejected";

  const approve = () => {
    clearTimers();
    setStage("applying");
    timers.current.push(
      window.setTimeout(() => setStage("validated"), 1200),
    );
  };

  const reject = () => {
    clearTimers();
    setStage("rejected");
  };

  const reset = () => {
    clearTimers();
    setStage("proposed");
  };

  return (
    <div className="instr-plan" data-stage={stage}>
      <header className="instr-plan-header">
        <div>
          <p className="instr-panel-label">Instrumentation plan</p>
          <b>Checkout flow</b>
        </div>
        <span className={`instr-status${applied ? " is-done" : ""}`}>
          {statusCopy[stage]}
        </span>
      </header>

      <dl className="instr-plan-meta">
        {[
          ["Files", "3"],
          ["Checkpoints", "6"],
          [
            "Validation",
            applied ? "Passed" : stage === "applying" ? "Running" : "Pending",
          ],
        ].map(([term, value]) => (
          <div key={term}>
            <dt>{term}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>

      <div className="instr-plan-code">
        <p className="instr-file-name">src/checkout/Checkout.tsx</p>
        <pre aria-label="Proposed instrumentation diff for Checkout.tsx">
          {lines.map((line, index) => {
            if (line.marker) {
              return showMarkers ? (
                <span className="instr-code-marker" key={`m-${line.marker}`}>
                  <i aria-hidden="true">◦</i>
                  {line.marker}
                </span>
              ) : null;
            }
            if (line.added && !showDiff) return null;
            return (
              <span
                key={`${index}-${line.text}`}
                className={line.added ? "is-added" : ""}
              >
                <i aria-hidden="true">{line.added ? "+" : " "}</i>
                {line.text || " "}
              </span>
            );
          })}
        </pre>
      </div>

      <ul className="instr-plan-checks">
        {checks.map((check) => (
          <li key={check}>
            <i aria-hidden="true">✓</i>
            {check}
          </li>
        ))}
      </ul>

      <footer className="instr-plan-actions">
        {decided ? (
          <>
            <p aria-live="polite">
              {applied
                ? "✓ Validation passed · ✓ Rollback recorded"
                : "Plan rejected. The working tree is untouched."}
            </p>
            <button type="button" onClick={reset}>
              Replay
            </button>
          </>
        ) : (
          <>
            <button type="button" onClick={reject} disabled={stage === "applying"}>
              Reject plan
            </button>
            <button
              type="button"
              className={`is-primary${stage === "focus" ? " is-focus" : ""}`}
              onClick={approve}
              disabled={stage === "applying"}
            >
              {stage === "applying" ? "Applying…" : "Approve & apply"}
            </button>
          </>
        )}
      </footer>
    </div>
  );
}
