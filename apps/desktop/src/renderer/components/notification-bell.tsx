import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, Check, CheckCheck } from "lucide-react";
import type { DesktopNotification } from "@tellann/desktop-contracts";
import { formatEnum, statusTone } from "./desktop-ui";

const SEVERITY_TONE: Record<DesktopNotification["severity"], ReturnType<typeof statusTone>> = {
  INFO: "neutral",
  LOW: "neutral",
  MEDIUM: "warning",
  HIGH: "warning",
  CRITICAL: "danger",
};

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

/**
 * Titlebar bell + unread badge + dropdown feed. All the plumbing it calls
 * (fetch/markRead/markAllRead/dismiss/open, the SSE stream, and now the
 * unread-count push) already runs end-to-end in the main process — this
 * component is the renderer half that was missing.
 */
export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<DesktopNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!window.tellann?.notifications) return;
    void window.tellann.notifications.unreadCount().then(setUnread).catch(() => undefined);
    return window.tellann.notifications.onUnreadCountChanged(setUnread);
  }, []);

  useEffect(() => {
    if (!window.tellann?.notifications) return;
    return window.tellann.notifications.onReceived((row) => {
      setItems((current) => [row, ...current.filter((item) => item.id !== row.id)].slice(0, 20));
    });
  }, []);

  const loadFeed = useCallback(() => {
    if (!window.tellann?.notifications) return;
    setLoading(true);
    window.tellann.notifications
      .fetch({ filter: "all" })
      .then((result) => setItems(result.notifications))
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (open) loadFeed();
  }, [open, loadFeed]);

  useEffect(() => {
    if (!open) return;
    const onClickAway = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickAway);
    return () => document.removeEventListener("mousedown", onClickAway);
  }, [open]);

  const markAllRead = () => {
    void window.tellann?.notifications.markAllRead();
    setItems((current) => current.map((item) => ({ ...item, readAt: item.readAt ?? new Date().toISOString() })));
    setUnread(0);
  };

  const markOneRead = (id: string) => {
    void window.tellann?.notifications.markRead(id);
    setItems((current) => current.map((item) => (item.id === id ? { ...item, readAt: new Date().toISOString() } : item)));
  };

  const openNotification = (row: DesktopNotification) => {
    void window.tellann?.notifications.open(row.id);
    setItems((current) => current.map((item) => (item.id === row.id ? { ...item, readAt: item.readAt ?? new Date().toISOString() } : item)));
    setOpen(false);
  };

  return (
    <div className="notification-bell" ref={rootRef}>
      <button
        type="button"
        className="titlebar-button"
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
        onClick={() => setOpen((v) => !v)}
      >
        <Bell size={16} />
        {unread > 0 ? <span className="notification-bell-badge">{unread > 99 ? "99+" : unread}</span> : null}
      </button>
      {open ? (
        <div className="notification-bell-dropdown" role="dialog" aria-label="Notifications">
          <header>
            <h3>Notifications</h3>
            <button type="button" className="button" onClick={markAllRead} disabled={!unread}>
              <CheckCheck size={14} /> Mark all read
            </button>
          </header>
          <div className="notification-bell-list">
            {loading ? (
              <div className="notification-bell-empty">Loading…</div>
            ) : items.length ? (
              items.map((row) => (
                <button
                  type="button"
                  key={row.id}
                  className="notification-bell-row"
                  data-tone={SEVERITY_TONE[row.severity]}
                  data-unread={!row.readAt}
                  onClick={() => openNotification(row)}
                >
                  <span className="notification-bell-row-dot" aria-hidden="true" />
                  <span className="notification-bell-row-body">
                    <strong>{row.title}</strong>
                    <span>{row.body}</span>
                    <small>
                      {formatEnum(row.category)} · {timeAgo(row.createdAt)}
                    </small>
                  </span>
                  {!row.readAt ? (
                    <span
                      role="button"
                      tabIndex={0}
                      className="notification-bell-row-read"
                      title="Mark as read"
                      onClick={(event) => {
                        event.stopPropagation();
                        markOneRead(row.id);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.stopPropagation();
                          markOneRead(row.id);
                        }
                      }}
                    >
                      <Check size={13} />
                    </span>
                  ) : null}
                </button>
              ))
            ) : (
              <div className="notification-bell-empty">You're all caught up.</div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
