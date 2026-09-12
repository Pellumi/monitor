"use client";

import { useState } from "react";

type View = "before" | "diff" | "after";

type DiffLine = { text: string; added?: boolean };

type PlanFile = {
  id: string;
  name: string;
  path: string;
  changes: number;
  summary: string;
  before: string[];
  diff: DiffLine[];
};

const files: PlanFile[] = [
  {
    id: "checkout",
    name: "Checkout.tsx",
    path: "src/checkout/Checkout.tsx",
    changes: 2,
    summary: "Opens the CHECKOUT workflow and records the first in-flow state.",
    before: [
      "export function Checkout() {",
      "  const start = () => {",
      "    setStep('payment')",
      "  }",
      "",
      "  return <CheckoutForm onStart={start} />",
      "}",
    ],
    diff: [
      { text: "export function Checkout() {" },
      { text: "  const start = () => {" },
      { text: '    tellann.startWorkflow("CHECKOUT")', added: true },
      { text: '    tellann.trackState("CHECKOUT_STARTED")', added: true },
      { text: "    setStep('payment')" },
      { text: "  }" },
      { text: "" },
      { text: "  return <CheckoutForm onStart={start} />" },
      { text: "}" },
    ],
  },
  {
    id: "payment",
    name: "payment.ts",
    path: "src/checkout/payment.ts",
    changes: 3,
    summary: "Records the submission, the failure branch, and the success branch.",
    before: [
      "export async function submitPayment(order) {",
      "  const res = await api.post('/payment', order)",
      "",
      "  if (!res.ok) throw new PaymentError(res)",
      "",
      "  return res.data",
      "}",
    ],
    diff: [
      { text: "export async function submitPayment(order) {" },
      { text: '  tellann.trackState("PAYMENT_SUBMITTED")', added: true },
      { text: "  const res = await api.post('/payment', order)" },
      { text: "" },
      { text: "  if (!res.ok) {" },
      { text: '    tellann.trackState("PAYMENT_FAILED")', added: true },
      { text: "    throw new PaymentError(res)" },
      { text: "  }" },
      { text: "" },
      { text: '  tellann.trackState("PAYMENT_SUCCEEDED")', added: true },
      { text: "  return res.data" },
      { text: "}" },
    ],
  },
  {
    id: "confirmation",
    name: "confirmation.ts",
    path: "src/checkout/confirmation.ts",
    changes: 1,
    summary: "Closes the workflow at the terminal state.",
    before: [
      "export function onOrderConfirmed(order) {",
      "  analytics.track('order_confirmed', order.id)",
      "  return order",
      "}",
    ],
    diff: [
      { text: "export function onOrderConfirmed(order) {" },
      { text: "  analytics.track('order_confirmed', order.id)" },
      { text: '  tellann.completeWorkflow("CHECKOUT")', added: true },
      { text: "  return order" },
      { text: "}" },
    ],
  },
];

const views: { key: View; label: string }[] = [
  { key: "before", label: "Before" },
  { key: "diff", label: "Diff" },
  { key: "after", label: "After" },
];

export function InstrumentationDiffReview() {
  const [fileId, setFileId] = useState("checkout");
  const [view, setView] = useState<View>("diff");
  const [decision, setDecision] = useState<"pending" | "approved" | "rejected">(
    "pending",
  );

  const file = files.find((item) => item.id === fileId)!;
  const index = files.findIndex((item) => item.id === fileId);

  const rendered: DiffLine[] =
    view === "before"
      ? file.before.map((text) => ({ text }))
      : view === "after"
        ? file.diff.map(({ text }) => ({ text }))
        : file.diff;

  return (
    <div className="instr-review">
      <header className="instr-review-header">
        <div>
          <p className="instr-panel-label">Instrumentation plan #IN-418</p>
          <b>CHECKOUT</b>
        </div>
        <dl>
          {[
            ["Affected files", "3"],
            ["Checkpoints", "6"],
          ].map(([term, value]) => (
            <div key={term}>
              <dt>{term}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </header>

      <div className="instr-review-files">
        <p className="instr-panel-label">Files</p>
        {files.map((item) => (
          <button
            key={item.id}
            type="button"
            className={item.id === fileId ? "is-current" : ""}
            aria-current={item.id === fileId ? "true" : undefined}
            onClick={() => setFileId(item.id)}
          >
            <b>{item.name}</b>
            <small>
              {item.changes} change{item.changes === 1 ? "" : "s"}
            </small>
          </button>
        ))}
        <p className="instr-redaction">Secrets redacted before display</p>
      </div>

      <div className="instr-review-body">
        <div className="instr-review-bar">
          <p className="instr-file-name">{file.path}</p>
          <div className="instr-view-toggle" role="tablist" aria-label="Diff view">
            {views.map((item) => (
              <button
                key={item.key}
                type="button"
                role="tab"
                aria-selected={view === item.key}
                className={view === item.key ? "is-active" : ""}
                onClick={() => setView(item.key)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
        <pre
          className="instr-review-code"
          aria-label={`${file.name}, ${view} view`}
          key={`${fileId}-${view}`}
        >
          {rendered.map((line, i) => (
            <span key={`${i}-${line.text}`} className={line.added ? "is-added" : ""}>
              <i aria-hidden="true">{line.added ? "+" : " "}</i>
              {line.text || " "}
            </span>
          ))}
        </pre>
        <p className="instr-review-summary">{file.summary}</p>
        {/* Mobile falls back to one file at a time rather than a shrunken viewer. */}
        <button
          type="button"
          className="instr-next-file"
          onClick={() => setFileId(files[(index + 1) % files.length].id)}
        >
          View next file <i aria-hidden="true">→</i>
        </button>
      </div>

      <footer className="instr-review-actions" aria-live="polite">
        {decision === "pending" ? (
          <>
            <p>Nothing is written to your working tree until this is approved.</p>
            <div>
              <button type="button" onClick={() => setDecision("rejected")}>
                Reject
              </button>
              <button
                type="button"
                className="is-primary"
                onClick={() => setDecision("approved")}
              >
                Approve plan
              </button>
            </div>
          </>
        ) : (
          <>
            <p>
              {decision === "approved"
                ? "Plan approved. Tellann applies the patch set locally, then validates it."
                : "Plan rejected. No files were modified."}
            </p>
            <div>
              <button type="button" onClick={() => setDecision("pending")}>
                Reset example
              </button>
            </div>
          </>
        )}
      </footer>
    </div>
  );
}
