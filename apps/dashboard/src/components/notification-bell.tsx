'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Bell, Check, CheckCheck, Settings, X } from 'lucide-react';
import {
  useNotifications,
  type InAppNotification,
  type NotificationFilter,
} from '@/components/notifications-provider';
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

const FILTERS: { key: NotificationFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'critical', label: 'Critical' },
];

const STREAM_COPY: Record<string, { dot: string; label: string }> = {
  live: { dot: 'bg-emerald-500', label: 'Live' },
  connecting: { dot: 'bg-neutral-500', label: 'Connecting…' },
  reconnecting: { dot: 'bg-amber-500', label: 'Reconnecting…' },
  polling: { dot: 'bg-amber-500', label: 'Updating periodically' },
  offline: { dot: 'bg-red-500', label: 'Offline' },
};

export function NotificationBell({
  align = 'right',
}: {
  /** Which edge the dropdown panel anchors to. Use "left" when the bell sits
   *  near the left edge of the viewport (e.g. the sidebar). */
  align?: 'left' | 'right';
}) {
  const {
    notifications,
    unreadCount,
    filter,
    setFilter,
    streamState,
    status,
    hasMore,
    loadMore,
    loadingMore,
    markRead,
    markAllRead,
    dismiss,
    openAction,
  } = useNotifications();
  const router = useRouter();
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

  async function onOpenItem(item: InAppNotification) {
    const link = (await openAction(item.id)) ?? item.deepLink;
    if (link) {
      setIsOpen(false);
      router.push(link);
    }
  }

  const stream = STREAM_COPY[streamState] ?? STREAM_COPY.connecting;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
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
        <div
          className={cn(
            'absolute z-[1000] mt-2 flex max-h-[32rem] w-96 flex-col overflow-hidden rounded border border-[#262626] bg-[#131313] shadow-lg',
            align === 'left' ? 'left-0' : 'right-0',
          )}
        >
          <div className="flex items-center justify-between border-b border-[#262626] px-3 py-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-white">Notifications</span>
              {/* <span
                className="flex items-center gap-1 text-[10px] text-[#8e9192]"
                title={stream.label}
              >
                <span className={cn('h-1.5 w-1.5 rounded-full', stream.dot)} aria-hidden="true" />
                {stream.label}
              </span> */}
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={markAllRead}
                disabled={unreadCount === 0}
                className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-[#8e9192] hover:bg-[#1e1e1e] hover:text-white disabled:opacity-40"
              >
                <CheckCheck className="h-3 w-3" />
                Mark all read
              </button>
              <Link
                href="/settings/notifications"
                onClick={() => setIsOpen(false)}
                className="rounded p-1 text-[#8e9192] hover:bg-[#1e1e1e] hover:text-white"
                aria-label="Notification settings"
              >
                <Settings className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>

          <div className="flex gap-1 border-b border-[#262626] px-2 py-1.5">
            {FILTERS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setFilter(tab.key)}
                className={cn(
                  'rounded px-2 py-0.5 text-[11px] transition-colors',
                  filter === tab.key
                    ? 'bg-[#262626] text-white'
                    : 'text-[#8e9192] hover:text-white',
                )}
              >
                {tab.label}
                {tab.key === 'unread' && unreadCount > 0 ? ` (${unreadCount})` : ''}
              </button>
            ))}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {status === 'loading' ? (
              <p className="px-3 py-6 text-center text-xs text-[#8e9192]">Loading…</p>
            ) : status === 'error' ? (
              <p className="px-3 py-6 text-center text-xs text-red-400">
                Couldn’t load notifications. They’ll retry automatically.
              </p>
            ) : notifications.length === 0 ? (
              <p className="px-3 py-6 text-center text-xs text-[#8e9192]">
                {filter === 'all'
                  ? 'Nothing yet. Activity in this organisation will show up here.'
                  : `No ${filter} notifications.`}
              </p>
            ) : (
              <ul>
                {notifications.map((item) => (
                  <li
                    key={item.id}
                    className={cn(
                      'group relative border-b border-[#262626] px-3 py-2.5 last:border-b-0',
                      !item.readAt && 'bg-[#161616]',
                      item.severity === 'HIGH' && 'border-l-2 border-l-amber-500',
                      item.severity === 'CRITICAL' && 'border-l-2 border-l-red-500',
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => onOpenItem(item)}
                      className="block w-full text-left"
                    >
                      <span className="flex items-start gap-2">
                        {!item.readAt ? (
                          <span
                            className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-400"
                            aria-label="Unread"
                          />
                        ) : (
                          <span className="mt-1 h-1.5 w-1.5 shrink-0" />
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="block text-xs font-medium text-neutral-200">
                            {item.title}
                          </span>
                          {item.body ? (
                            <span className="mt-0.5 block text-[11px] leading-4 text-[#8e9192]">
                              {item.body}
                            </span>
                          ) : null}
                          <span className="mt-1 block text-[10px] uppercase tracking-wide text-neutral-600">
                            {item.category.toLowerCase().replaceAll('_', ' ')} · {relativeTime(item.createdAt)}
                          </span>
                        </span>
                      </span>
                    </button>

                    <span className="absolute right-2 top-2 flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                      {!item.readAt ? (
                        <button
                          type="button"
                          onClick={() => markRead(item.id)}
                          className="rounded p-1 text-[#8e9192] hover:bg-[#262626] hover:text-white"
                          aria-label="Mark read"
                        >
                          <Check className="h-3 w-3" />
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => dismiss(item.id)}
                        className="rounded p-1 text-[#8e9192] hover:bg-[#262626] hover:text-white"
                        aria-label="Dismiss"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {hasMore ? (
              <button
                type="button"
                onClick={loadMore}
                disabled={loadingMore}
                className="w-full border-t border-[#262626] py-2 text-[11px] text-[#8e9192] hover:bg-[#1a1a1a] hover:text-white disabled:opacity-40"
              >
                {loadingMore ? 'Loading…' : 'Load older'}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
