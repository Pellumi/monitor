'use client';

import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { useNotifications } from '@/components/notifications-provider';
import { cn } from '@/components/ui/utils';

/**
 * Foreground toasts for notifications that arrive while the dashboard is open.
 *
 * These are announced to assistive tech via an aria-live region and are never
 * treated as "read" — reading still requires opening the item or the bell.
 */
export function NotificationToaster() {
  const { toasts, dismissToast, openAction } = useNotifications();
  const router = useRouter();

  return (
    <div
      aria-live="polite"
      aria-relevant="additions"
      className="pointer-events-none fixed bottom-4 right-4 z-[1100] flex w-80 flex-col gap-2"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="status"
          className={cn(
            'pointer-events-auto overflow-hidden rounded border bg-[#131313] shadow-lg',
            toast.severity === 'CRITICAL'
              ? 'border-red-600/60'
              : toast.severity === 'HIGH'
                ? 'border-amber-600/60'
                : 'border-[#262626]',
          )}
        >
          <div className="flex items-start gap-2 p-3">
            <button
              type="button"
              className="min-w-0 flex-1 text-left"
              onClick={async () => {
                const link = (await openAction(toast.id)) ?? toast.deepLink;
                dismissToast(toast.id);
                if (link) router.push(link);
              }}
            >
              <p className="text-xs font-medium text-neutral-100">{toast.title}</p>
              {toast.body ? (
                <p className="mt-0.5 text-[11px] leading-4 text-[#8e9192]">{toast.body}</p>
              ) : null}
            </button>
            <button
              type="button"
              onClick={() => dismissToast(toast.id)}
              aria-label="Dismiss notification"
              className="rounded p-0.5 text-[#8e9192] hover:bg-[#262626] hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
