import { useEffect, useRef } from "react";
import { AlertTriangle, X } from "lucide-react";

export type QaRunStartFailure = {
  title: string;
  summary: string;
  targetUrl: string;
  nextSteps: string[];
  technicalDetails: string;
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
      title: "Tellann couldn't reach your application",
      summary:
        "The QA browser could not connect to the application URL, so the run was stopped before capture began.",
      targetUrl,
      nextSteps: [
        hasLaunchCommands
          ? 'Start the application yourself, or select a script under "Local application process" and approve it for this run.'
          : "Start the application from its project folder and leave it running.",
        "Open the application URL and confirm that its host and port are correct.",
        'Return here and choose "Try again".',
      ],
      technicalDetails,
    };
  }

  if (/Timeout|timed out|ERR_TIMED_OUT/i.test(technicalDetails)) {
    return {
      title: "The application did not become ready",
      summary:
        "Tellann waited for the application to load, but it did not respond before the startup window ended.",
      targetUrl,
      nextSteps: [
        "Check the application terminal for startup or build errors.",
        "Confirm that the application URL uses the port printed by the development server.",
        'Once the page loads normally, return here and choose "Try again".',
      ],
      technicalDetails,
    };
  }

  if (/Invalid URL|ERR_INVALID_URL|invalid.*target/i.test(technicalDetails)) {
    return {
      title: "The application URL is not valid",
      summary: "Tellann needs a complete HTTP or HTTPS URL before it can open the QA browser.",
      targetUrl,
      nextSteps: [
        'Choose "Review settings" and enter a URL such as http://localhost:3000.',
        "Confirm that the application is running at that address, then try again.",
      ],
      technicalDetails,
    };
  }

  if (/RUN_ALREADY_ACTIVE/i.test(technicalDetails)) {
    return {
      title: "Another QA run is already active",
      summary: "Tellann can capture one local QA run at a time on this device.",
      targetUrl,
      nextSteps: [
        "Open the active run and end it, or wait for it to finish.",
        "Return to this page and try again.",
      ],
      technicalDetails,
    };
  }

  if (/Initialize this published Flow|FLOW_.*INITIAL|INITIALIZATION/i.test(technicalDetails)) {
    return {
      title: "This Flow is not ready for QA",
      summary: "The selected Flow must be published and initialized in this application before capture can begin.",
      targetUrl,
      nextSteps: [
        "Open the Flow and complete its initialization for this application.",
        "Return to QA Runs, select the initialized Flow, and try again.",
      ],
      technicalDetails,
    };
  }

  return {
    title: "The QA run couldn't start",
    summary: "Tellann stopped the run safely after encountering a startup error.",
    targetUrl,
    nextSteps: [
      "Review the technical details below and correct the application or run settings.",
      "Confirm that the application is available, then try again.",
    ],
    technicalDetails: technicalDetails || "Desktop operation failed",
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

        <div className="confirm-modal-topbar">
          <span className="confirm-modal-brand">TELLANN</span>
          <span className="confirm-modal-tag">QA RUN // ACTION REQUIRED</span>
        </div>

        <div className="qa-run-error-heading">
          <span className="qa-run-error-icon" aria-hidden="true">
            <AlertTriangle size={20} />
          </span>
          <div>
            <h2 id="qa-run-error-title">{failure.title}</h2>
            <p id="qa-run-error-summary">{failure.summary}</p>
          </div>
        </div>

        <div className="qa-run-error-target">
          <span>Application URL</span>
          <code>{failure.targetUrl}</code>
        </div>

        <div className="qa-run-error-steps">
          <strong>What to do next</strong>
          <ol>
            {failure.nextSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </div>

        <details className="qa-run-error-details">
          <summary>Technical details</summary>
          <code>{failure.technicalDetails}</code>
        </details>

        <div className="confirm-modal-actions">
          <button
            type="button"
            className="button confirm-modal-btn-cancel"
            disabled={busy}
            onClick={onClose}
          >
            Review settings
          </button>
          <button
            ref={retryButtonRef}
            type="button"
            className="button confirm-modal-btn-action"
            disabled={busy}
            onClick={onRetry}
          >
            {busy ? "Starting…" : "Try again"}
          </button>
        </div>
      </div>
    </div>
  );
}
