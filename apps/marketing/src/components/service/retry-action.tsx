"use client";

export function RetryAction({ label = "Try again", onRetry }: { label?: string; onRetry?: () => void }) {
  return (
    <button type="button" onClick={() => onRetry ? onRetry() : window.location.reload()}>
      {label}<span aria-hidden="true">↻</span>
    </button>
  );
}
