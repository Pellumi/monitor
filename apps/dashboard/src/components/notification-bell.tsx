'use client';

import { useEffect, useRef, useState } from 'react';
import { Bell } from 'lucide-react';
import { useNotifications } from '@/components/notifications-provider';
import { cn } from '@/components/ui/utils';

/** Relative time, coarse enough that it never needs a ticking re-render. */
function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function NotificationBell() {
  const { notifications, unreadCount, markAllRead } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    function onPointerDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function onEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onEscape);
    };
  }, [isOpen]);

  function toggle() {
    const next = !isOpen;
    setIsOpen(next);
    if (next && unreadCount > 0) markAllRead();
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-label={
          unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'
        }
        aria-expanded={isOpen}
        className="relative flex h-8 w-8 items-center justify-center rounded border border-[#262626] bg-black text-neutral-400 transition-colors hover:border-neutral-600 hover:text-white"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 ? (
          <span
            className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white"
            aria-hidden="true"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        ) : null}
      </button>

      {isOpen ? (
        <div className="absolute right-0 z-[1000] mt-2 w-80 overflow-hidden rounded border border-[#262626] bg-[#131313] shadow-lg">
          <div className="border-b border-[#262626] px-3 py-2">
            <span className="text-xs font-semibold text-white">Notifications</span>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="px-3 py-6 text-center text-xs text-[#8e9192]">
                Nothing yet. Activity in this organisation will show up here.
              </p>
            ) : (
              notifications.map((item) => (
                <div
                  key={item.id}
                  className={cn(
                    'border-b border-[#262626] px-3 py-2.5 last:border-b-0',
                    item.severity === 'HIGH' && 'border-l-2 border-l-amber-500',
                  )}
                >
                  <p className="text-xs font-medium text-neutral-200">{item.title}</p>
                  {item.body ? (
                    <p className="mt-0.5 text-[11px] leading-4 text-[#8e9192]">{item.body}</p>
                  ) : null}
                  <p className="mt-1 text-[10px] uppercase tracking-wide text-neutral-600">
                    {item.category.toLowerCase().replaceAll('_', ' ')} · {relativeTime(item.createdAt)}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
