import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

export interface ModalProps {
  /** Controls mounting. Callers that always render the component can pass `isOpen={false}`. */
  isOpen: boolean;
  onClose(): void;
  title: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
  /** Set when the backdrop/Escape should not close the modal (e.g. mid-submit, or a "must confirm" step). */
  dismissible?: boolean;
  className?: string;
}

/**
 * The shared backdrop/dialog/close-button/actions shell previously duplicated
 * across entitlement-modal.tsx, active-run-notice-modal.tsx,
 * upload-consent-modal.tsx, repository-mismatch-modal.tsx and
 * qa-run-start-error-modal.tsx. Keeps the same `desktop-modal-backdrop` /
 * `desktop-modal` CSS classes those already style.
 */
export function Modal({
  isOpen,
  onClose,
  title,
  children,
  actions,
  dismissible = true,
  className = "",
}: ModalProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && dismissible) onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    dialogRef.current?.focus();
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, dismissible, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="desktop-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (dismissible && event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className={`desktop-modal ${className}`.trimEnd()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        ref={dialogRef}
      >
        {dismissible ? (
          <button type="button" className="desktop-modal-close" aria-label="Close" onClick={onClose}>
            <X size={16} />
          </button>
        ) : null}

        <h2 id={titleId}>{title}</h2>

        {children}

        {actions ? <div className="desktop-modal-actions">{actions}</div> : null}
      </div>
    </div>
  );
}

/** A `<button className="button">`/`<button className="button primary">` pair, matching existing modal action markup. */
export function ModalActions({
  onCancel,
  cancelLabel = "Cancel",
  confirmLabel = "Confirm",
  onConfirm,
  confirmDisabled,
  danger,
}: {
  onCancel(): void;
  cancelLabel?: string;
  confirmLabel?: string;
  onConfirm(): void;
  confirmDisabled?: boolean;
  danger?: boolean;
}) {
  return (
    <>
      <button type="button" onClick={onCancel}>
        {cancelLabel}
      </button>
      <button
        type="button"
        className={danger ? "danger" : "confirm"}
        onClick={onConfirm}
        disabled={confirmDisabled}
      >
        {confirmLabel}
      </button>
    </>
  );
}
