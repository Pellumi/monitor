"use client";

import { useEffect, useRef, useState } from "react";

type Step = {
  id: string;
  label: string;
  detail: string;
  /** Only shown on the failing run. */
  failureOnly?: boolean;
  /** Only shown on the passing run. */
  successOnly?: boolean;
};

const steps: Step[] = [
  { id: "apply", label: "Apply", detail: "Patch set written to the bound workspace" },
  { id: "validate", label: "Validate", detail: "Build and tests checked" },
  {
    id: "pass",
    label: "Keep",
    detail: "Validation passed · rollback recorded",
    successOnly: true,
  },
  {
    id: "fail",
    label: "Build failed",
    detail: "Failure attributable to the plan",
    failureOnly: true,
  },
  {
    id: "rollback",
    label: "Roll back",
    detail: "Patch set reversed",
    failureOnly: true,
  },
  {
    id: "restored",
    label: "Restored",
    detail: "Original working tree back in place",
    failureOnly: true,
  },
];

/* Timings follow the plan's failure sequence: apply 500, validate 800,
   failure 350, rollback 700, restore 350. */
const passDelays = [500, 800, 700];
const failDelays = [500, 800, 350, 700, 350];

export function InstrumentationValidationDemo() {
  const [run, setRun] = useState<"idle" | "pass" | "fail">("idle");
  const [reached, setReached] = useState(0);
  const timers = useRef<number[]>([]);

  const clear = () => {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
  };

  useEffect(() => clear, []);

  const start = (mode: "pass" | "fail") => {
    clear();
    setRun(mode);
    setReached(0);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const delays = mode === "pass" ? passDelays : failDelays;
    if (reduced) {
      setReached(delays.length);
      return;
    }
    let elapsed = 0;
    delays.forEach((delay, index) => {
      elapsed += delay;
      timers.current.push(
        window.setTimeout(() => setReached(index + 1), elapsed),
      );
    });
  };

  const visible = steps.filter((step) =>
    run === "fail"
      ? !step.successOnly
      : run === "pass"
        ? !step.failureOnly
        : !step.failureOnly,
  );

  return (
    <div className="instr-validation">
      <div className="instr-validation-controls">
        <p className="instr-panel-label">Run the sequence</p>
        <div>
          <button
            type="button"
            className={run === "pass" ? "is-active" : ""}
            onClick={() => start("pass")}
          >
            Validation passes
          </button>
          <button
            type="button"
            className={run === "fail" ? "is-active" : ""}
            onClick={() => start("fail")}
          >
            Validation fails
          </button>
        </div>
      </div>

      <ol className="instr-validation-steps" aria-live="polite">
        {visible.map((step, index) => {
          const active = run !== "idle" && index < reached;
          return (
            <li
              key={step.id}
              className={`${active ? "is-active" : ""}${
                step.failureOnly ? " is-failure" : ""
              }`}
            >
              <i aria-hidden="true">
                {run === "idle"
                  ? "○"
                  : active
                    ? step.id === "fail"
                      ? "✕"
                      : "✓"
                    : "○"}
              </i>
              <b>{step.label}</b>
              <small>{step.detail}</small>
            </li>
          );
        })}
      </ol>

      <p className="instr-validation-result" aria-live="polite">
        {run === "idle"
          ? "Every applied plan is validated, and every applied plan keeps a rollback."
          : run === "pass" && reached >= passDelays.length
            ? "Kept. The rollback stays available if you change your mind later."
            : run === "fail" && reached >= failDelays.length
              ? "Rolled back. The working tree is exactly as it was before the plan was applied."
              : "Running…"}
      </p>
    </div>
  );
}
