import { useCallback, useEffect, useState } from 'react';
import { Bell, X } from 'lucide-react';
import type { DesktopNotification } from '@tellann/desktop-contracts';

const TOAST_TTL_MS = 8_000;
const MAX_TOASTS = 3;

/**
 * In-app alert for notifications that arrive while this window is focused.
 *
 * The main process deliberately suppresses the native OS notification in that
 * case (see `notification-client.ts`), so without this component a focused
 * window would silently drop every notification — including the `app-created`
 * one raised when an application is created here or on the web dashboard.
 */
export function NotificationToaster() {
  const [toasts, setToasts] = useState<DesktopNotification[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  useEffect(() => {
    if (!window.tellann?.notifications?.onReceived) return;
    return window.tellann.notifications.onReceived((row) => {
      // Rows also arrive for reads and dismissals synced from another device;
      // those are feed updates, not new alerts.
      if (row.readAt || row.dismissedAt) {
        dismiss(row.id);
        return;
      }
      setToasts((current) =>
        [row, ...current.filter((toast) => toast.id !== row.id)].slice(0, MAX_TOASTS),
      );
    });
  }, [dismiss]);

  useEffect(() => {
    if (!toasts.length) return;
    const timers = toasts.map((toast) =>
      window.setTimeout(() => dismiss(toast.id), TOAST_TTL_MS),
    );
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [toasts, dismiss]);

  if (!toasts.length) return null;

  return (
    <div className="notification-toaster" role="region" aria-label="Notifications">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`notification-toast severity-${toast.severity.toLowerCase()}`}
          role="alert"
        >
          <Bell size={15} aria-hidden="true" />
          <div className="notification-toast-body">
            <strong>{toast.title}</strong>
            <span>{toast.body}</span>
            {toast.deepLink ? (
              <button
                className="notification-toast-action"
                onClick={() => {
                  void window.tellann?.notifications.open(toast.id).catch(() => undefined);
                  dismiss(toast.id);
                }}
              >
                View
              </button>
            ) : null}
          </div>
          <button
            className="notification-toast-close"
            aria-label="Dismiss notification"
            onClick={() => {
              void window.tellann?.notifications.markRead(toast.id).catch(() => undefined);
              dismiss(toast.id);
            }}
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
