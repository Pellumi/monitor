import { useEffect, useRef } from "react";
import { AlertTriangle, Pencil, X } from "lucide-react";

export type QaRunStartFailure = {
  title: string;
  summary: string;
  targetUrl: string;
  /** Short badge next to the URL, e.g. "Unreachable". Omit to hide the badge. */
  statusLabel?: string;
  statusTone?: "danger" | "warning";
  /** One-line preview shown next to the "Technical details" summary before it's expanded. */
  technicalSummary?: string;
  nextSteps: string[];
  technicalDetails: string;
  retryLabel?: string;
  secondaryLabel?: string;
};

function cleanTechnicalMessage(cause: unknown): string {
  const raw = cause instanceof Error ? cause.message : String(cause);
  return raw
    .replace(/[\u001B\u009B]\[[0-?]*[ -/]*[@-~]/g, "")
    .replace(/^Error invoking remote method '[^']+':\s*/i, "")
    .replace(/^Error:\s*/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 1_000);
}

export function describeQaRunStartFailure(
  cause: unknown,
  targetUrl: string,
  hasLaunchCommands: boolean,
): QaRunStartFailure {
  const technicalDetails = cleanTechnicalMessage(cause);

  if (/ERR_CONNECTION_REFUSED|ECONNREFUSED|connection refused/i.test(technicalDetails)) {
    return {
      title: "Unable to connect to your application",
      summary: "Tellann couldn't establish a connection to your app. Check that it's running and accessible.",
      targetUrl,
      statusLabel: "Unreachable",
      statusTone: "danger",
      technicalSummary: "Connection failed",
      nextSteps: [
        hasLaunchCommands
          ? 'Start the application yourself, or select a script under "Local application process" and approve it for this run.'
          : "Start the application from its project folder and leave it running.",
        "Verify the URL's host and port are correct, then retry.",
      ],
      technicalDetails,
      retryLabel: "Retry connection",
      secondaryLabel: "Edit URL",
    };
  }

  if (/Timeout|timed out|ERR_TIMED_OUT/i.test(technicalDetails)) {
    return {
      title: "Your application didn't respond in time",
      summary: "Tellann reached the URL, but the app didn't finish loading before the startup window ended.",
      targetUrl,
      statusLabel: "Not responding",
      statusTone: "warning",
      technicalSummary: "Timed out",
      nextSteps: [
        "Check the application terminal for startup or build errors.",
        "Confirm the URL uses the port printed by the development server, then retry.",
      ],
      technicalDetails,
      retryLabel: "Retry connection",
      secondaryLabel: "Edit URL",
    };
  }

  if (/Invalid URL|ERR_INVALID_URL|invalid.*target/i.test(technicalDetails)) {
    return {
      title: "The application URL isn't valid",
      summary: "Tellann needs a complete HTTP or HTTPS URL before it can open the QA browser.",
      targetUrl,
      statusLabel: "Invalid",
      statusTone: "warning",
      technicalSummary: "Invalid URL",
      nextSteps: [
        "Enter a complete URL, such as http://localhost:3000.",
        "Confirm the application is running at that address, then retry.",
      ],
      technicalDetails,
      retryLabel: "Try again",
      secondaryLabel: "Edit URL",
    };
  }

  if (/RUN_ALREADY_ACTIVE/i.test(technicalDetails)) {
    return {
      title: "A QA run is already recording",
      summary:
        "Tellann captures one local QA run at a time on this device, so this run was not started. The run already going is untouched and still recording.",
      targetUrl,
      technicalSummary: "Run already active",
      nextSteps: [
        'Open the active run from "QA run running" in the status bar.',
        "End that run before starting a new one.",
      ],
      technicalDetails,
      retryLabel: "Try again",
      secondaryLabel: "Review settings",
    };
  }

  if (/Initialize this published Flow|FLOW_.*INITIAL|INITIALIZATION/i.test(technicalDetails)) {
    return {
      title: "This Flow is not ready for QA",
      summary: "The selected Flow must be published and initialized in this application before capture can begin.",
      targetUrl,
      technicalSummary: "Flow not initialized",
      nextSteps: [
        "Open the Flow and complete its initialization for this application.",
        "Return to QA Runs, select the initialized Flow, and try again.",
      ],
      technicalDetails,
      retryLabel: "Try again",
      secondaryLabel: "Review settings",
    };
  }

  return {
    title: "The QA run couldn't start",
    summary: "Tellann stopped the run safely after encountering a startup error.",
    targetUrl,
    technicalSummary: "Startup failed",
    nextSteps: [
      "Review the technical details below and correct the application or run settings.",
      "Confirm that the application is available, then try again.",
    ],
    technicalDetails: technicalDetails || "Desktop operation failed",
    retryLabel: "Try again",
    secondaryLabel: "Review settings",
  };
}

export function QaRunStartErrorModal({
  failure,
  busy,
  onClose,
  onRetry,
}: {
  failure: QaRunStartFailure | null;
  busy: boolean;
  onClose(): void;
  onRetry(): void;
}) {
  const retryButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!failure) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    retryButtonRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onClose();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      previouslyFocused?.focus();
    };
  }, [failure, busy, onClose]);

  if (!failure) return null;

  return (
    <div
      className="desktop-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div
        className="desktop-modal qa-run-error-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="qa-run-error-title"
        aria-describedby="qa-run-error-summary"
      >
        <button
          type="button"
          className="desktop-modal-close"
          aria-label="Close QA run error"
          disabled={busy}
          onClick={onClose}
        >
          <X size={16} />
        </button>

        <div className="qa-run-error-heading">
          <span className="qa-run-error-icon" aria-hidden="true">
            <AlertTriangle size={18} />
          </span>
          <div>
            <h2 id="qa-run-error-title">{failure.title}</h2>
            <p id="qa-run-error-summary">{failure.summary}</p>
          </div>
        </div>

        <div className="qa-run-error-target">
          <div className="qa-run-error-target-head">
            <span>Application URL</span>
            {failure.statusLabel && (
              <span className="status-pill" data-tone={failure.statusTone ?? "danger"}>
                <span aria-hidden="true" />
                {failure.statusLabel}
              </span>
            )}
          </div>
          <div className="qa-run-error-target-row">
            <code>{failure.targetUrl}</code>
            <button
              type="button"
              className="qa-run-error-edit"
              disabled={busy}
              onClick={onClose}
              aria-label="Edit application URL"
            >
              <Pencil size={13} />
            </button>
          </div>
        </div>

        <div className="qa-run-error-steps">
          <strong>How to fix this</strong>
          <ol>
            {failure.nextSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </div>

        <details className="qa-run-error-details">
          <summary>
            <span>Technical details</span>
            {failure.technicalSummary && <span className="qa-run-error-details-tag">{failure.technicalSummary}</span>}
          </summary>
          <code>{failure.technicalDetails}</code>
        </details>

        <div className="confirm-modal-actions">
          <button
            type="button"
            className="button confirm-modal-btn-cancel"
            disabled={busy}
            onClick={onClose}
          >
            {failure.secondaryLabel ?? "Review settings"}
          </button>
          <button
            ref={retryButtonRef}
            type="button"
            className="button confirm-modal-btn-action"
            disabled={busy}
            onClick={onRetry}
          >
            {busy ? "Starting…" : failure.retryLabel ?? "Try again"}
          </button>
        </div>
      </div>
    </div>
  );
}
