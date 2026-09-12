"use client";

import { useEffect, useRef, useState } from "react";

export function DocumentMedia({
  label,
  width,
  height,
  master,
}: {
  label: string;
  width: number;
  height: number;
  master?: string;
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
    <div
      ref={ref}
      className="document-media"
      style={{
        width: `min(100%, ${width}px)`,
        aspectRatio: `${width} / ${height}`,
      }}
      role="img"
      aria-label={`${label} placeholder`}
    >
      <span>Media placeholder</span>
      <strong>{label}</strong>
      <small>Rendered: {rendered} px</small>
      <small>
        Display: {width} × {height} px
        {master ? ` · Master: ${master} px` : ""}
      </small>
    </div>
  );
}

const candidates = [
  {
    name: "Checkout",
    source: "Checkout requirements · v3 · lines 42–57",
    path: "CART REVIEW → PAYMENT → CONFIRMATION",
  },
  {
    name: "Password recovery",
    source: "Account access specification · v2 · lines 18–31",
    path: "REQUEST RESET → VERIFY → NEW PASSWORD",
  },
  {
    name: "Order cancellation",
    source: "Order management PRD · v5 · lines 71–84",
    path: "OPEN ORDER → CANCEL → CONFIRM",
  },
];

export function CandidateReview() {
  const [active, setActive] = useState(0);
  const [status, setStatus] = useState("Candidate draft");
  const candidate = candidates[active];
  const accepted = status === "Accepted as declared intent";
  const rejected = status === "Rejected proposal";

  function choose(index: number) {
    setActive(index);
    setStatus("Candidate draft");
  }

  return (
    <div className="candidate-review">
      <div className="candidate-list" role="tablist" aria-label="Candidate flows">
        <p>3 candidate flows found</p>
        {candidates.map((item, index) => (
          <button
            type="button"
            role="tab"
            aria-selected={active === index}
            key={item.name}
            onClick={() => choose(index)}
          >
            <span>0{index + 1}</span>
            {item.name}
          </button>
        ))}
      </div>
      <div className="candidate-panel" role="tabpanel" key={active}>
        <div className="candidate-status">
          <span>{status}</span>
          <small>
            {accepted
              ? "Decision recorded"
              : rejected
                ? "Not added to declared intent"
                : "Human review required"}
          </small>
        </div>
        <p className="document-label">{candidate.source}</p>
        <h3>{candidate.name}</h3>
        <div className="candidate-path">{candidate.path}</div>
        <p>
          {accepted
            ? "Your team accepted this candidate as declared intent. Its source remains attached for traceability."
            : rejected
              ? "Your team rejected this proposal. It has not been added to declared intent."
              : "Suggested from the cited document version. It is not part of declared intent until your team accepts it."}
        </p>
        <div className="candidate-actions">
          <button type="button" onClick={() => setStatus("Rejected proposal")}>
            Reject
          </button>
          <button type="button" onClick={() => setStatus("Draft ready to edit")}>
            Edit draft
          </button>
          <button
            className="is-primary"
            type="button"
            onClick={() => setStatus("Accepted as declared intent")}
          >
            Accept flow
          </button>
        </div>
      </div>
    </div>
  );
}

const roles = [
  [
    "Product manager",
    "Move from product language to structured intent.",
    "Review the workflow Tellann drafted and decide what the team officially means.",
  ],
  [
    "QA engineer",
    "Spend less time translating requirements.",
    "Start from reviewable states and branches, then refine them before planning demonstrations.",
  ],
  [
    "Developer",
    "See the intended path before mapping code.",
    "Use an accepted flow as the shared definition that codebase mapping and instrumentation can follow.",
  ],
  [
    "Engineering manager",
    "Keep the source and decision trail visible.",
    "Know which document version produced a draft and which proposals the team accepted or rejected.",
  ],
];

export function DocumentRoles() {
  const [active, setActive] = useState(0);
  return (
    <div className="document-roles">
      <div className="role-tabs" role="tablist" aria-label="Benefits by role">
        {roles.map(([name], index) => (
          <button
            type="button"
            role="tab"
            aria-selected={active === index}
            key={name}
            onClick={() => setActive(index)}
          >
            {name}
          </button>
        ))}
      </div>
      <div className="role-copy" role="tabpanel" key={active} aria-live="polite">
        <h3>{roles[active][1]}</h3>
        <p>{roles[active][2]}</p>
      </div>
    </div>
  );
}
