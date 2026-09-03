/**
 * Desktop notification client (Phase 1).
 *
 * While Tellann Desktop is running it:
 *   - registers a stable per-installation device with the cloud,
 *   - holds an authenticated SSE stream of the user's notification feed,
 *   - shows a native OS notification when the main window is not focused, and
 *     forwards to the renderer for an in-app alert when it is,
 *   - heartbeats presence so the orchestrator only routes desktop deliveries to
 *     a device that is actually here.
 *
 * Closed-process delivery (WNS/APNs/background agent) is explicitly out of scope
 * for Phase 1 — see docs/notification_implementation_plan.md.
 */
import { BrowserWindow, Notification } from 'electron';
import { IPC } from '@tellann/desktop-contracts';
import { loadDesktopSession } from './secure-store';
import { readLocalState, writeLocalState } from './local-store';
import crypto from 'node:crypto';

const INSTALLATION_KEY = 'notifications:installation-id';
const HEARTBEAT_MS = 60_000;
const RECONNECT_BASE_MS = 2_000;
const RECONNECT_MAX_MS = 30_000;

export interface DesktopNotificationRow {
  id: string;
  notificationId: string;
  type: string;
  category: string;
  severity: 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  title: string;
  body: string;
  deepLink: string | null;
  createdAt: string;
  readAt: string | null;
  dismissedAt: string | null;
}

function platform(): 'WINDOWS' | 'MACOS' | 'LINUX' {
  if (process.platform === 'win32') return 'WINDOWS';
  if (process.platform === 'darwin') return 'MACOS';
  return 'LINUX';
}

/** A stable id for this installation, created once and kept in the local store. */
function installationId(): string {
  const stored = readLocalState<{ id: string }>(INSTALLATION_KEY);
  if (stored?.id) return stored.id;
  const id = crypto.randomUUID();
  writeLocalState(INSTALLATION_KEY, { id });
  return id;
}

function safePath(raw: unknown): string {
  if (typeof raw !== 'string' || !raw.startsWith('/')) return '/';
  if (raw.startsWith('//') || raw.startsWith('/\\')) return '/';
  return raw;
}

export class DesktopNotificationClient {
  private readonly apiUrl: string;
  private readonly getWindow: () => BrowserWindow | null;
  private readonly appVersion: string;
  private readonly installationId = installationId();

  private organizationId: string | null = null;
  private abort: AbortController | null = null;
  private heartbeat: NodeJS.Timeout | null = null;
  private cursor: string | null = null;
  private running = false;

  constructor(deps: {
    apiUrl: string;
    appVersion: string;
    getWindow: () => BrowserWindow | null;
  }) {
    this.apiUrl = deps.apiUrl.replace(/\/$/, '');
    this.appVersion = deps.appVersion;
    this.getWindow = deps.getWindow;
  }

  /** Point the client at an organisation (or null to detach). Idempotent. */
  async setActiveOrganization(organizationId: string | null): Promise<void> {
    if (organizationId === this.organizationId && this.running) return;
    await this.stop();
    this.organizationId = organizationId;
    if (!organizationId) return;
    if (!this.token()) return; // not signed in yet; a later call re-arms
    this.running = true;
    await this.registerDevice().catch((err) => console.error('[Notifications] device register failed', err));
    this.heartbeat = setInterval(() => void this.sendHeartbeat(), HEARTBEAT_MS);
    void this.streamLoop();
  }

  /** Revoke the device and tear down the stream. Call on sign-out / quit. */
  async stop(): Promise<void> {
    this.running = false;
    this.abort?.abort();
    this.abort = null;
    if (this.heartbeat) {
      clearInterval(this.heartbeat);
      this.heartbeat = null;
    }
    if (this.organizationId && this.token()) {
      await this.api(`/notification-devices/${this.installationId}`, { method: 'DELETE' }).catch(() => undefined);
    }
  }

  // ── Renderer-facing operations ──────────────────────────────────────────────

  async fetchFeed(input: { cursor?: string; filter?: string } = {}): Promise<{
    notifications: DesktopNotificationRow[];
    unreadCount: number;
    nextCursor: string | null;
  }> {
    const params = new URLSearchParams({ limit: '20', filter: input.filter ?? 'all' });
    if (input.cursor) params.set('cursor', input.cursor);
    return this.api(`/notifications?${params.toString()}`);
  }

  markRead(id: string) {
    return this.api(`/notifications/${id}/read`, { method: 'PATCH' });
  }
  markAllRead() {
    return this.api('/notifications/read-all', { method: 'POST' });
  }
  dismiss(id: string) {
    return this.api(`/notifications/${id}/dismiss`, { method: 'PATCH' });
  }
  async open(id: string): Promise<string> {
    const body = await this.api<{ deepLink: string | null }>(`/notifications/${id}/action`, { method: 'POST' });
    const target = safePath(body?.deepLink);
    this.focusAndRoute(target);
    return target;
  }

  // ── Internals ──────────────────────────────────────────────────────────────

  private token(): string | null {
    return loadDesktopSession()?.accessToken ?? null;
  }

  private async api<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
    const token = this.token();
    if (!token || !this.organizationId) throw new Error('NOT_READY');
    const res = await fetch(`${this.apiUrl}/organizations/${this.organizationId}${path}`, {
      ...init,
      headers: {
        ...(init.headers ?? {}),
        authorization: `Bearer ${token}`,
        ...(init.body ? { 'content-type': 'application/json' } : {}),
      },
    });
    if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { status: res.status });
    return (res.status === 204 ? null : await res.json()) as T;
  }

  private async registerDevice(): Promise<void> {
    await this.api('/notification-devices', {
      method: 'POST',
      body: JSON.stringify({
        installationId: this.installationId,
        platform: platform(),
        appVersion: this.appVersion,
        label: `Tellann Desktop (${platform().toLowerCase()})`,
      }),
    });
  }

  private async sendHeartbeat(): Promise<void> {
    if (!this.running) return;
    await this.api(`/notification-devices/${this.installationId}`, {
      method: 'PATCH',
      body: JSON.stringify({ present: true }),
    }).catch(() => undefined);
  }

  private async streamLoop(): Promise<void> {
    let attempt = 0;
    while (this.running) {
      const token = this.token();
      if (!token || !this.organizationId) return;
      this.abort = new AbortController();
      try {
        const url = new URL(`${this.apiUrl}/organizations/${this.organizationId}/notification-stream`);
        if (this.cursor) url.searchParams.set('cursor', this.cursor);
        const res = await fetch(url, {
          headers: { authorization: `Bearer ${token}`, accept: 'text/event-stream' },
          signal: this.abort.signal,
        });
        if (!res.ok || !res.body) {
          attempt += 1;
          await this.backoff(attempt);
          continue;
        }
        attempt = 0;
        await this.consume(res.body);
      } catch (err) {
        if (this.abort?.signal.aborted) return;
        attempt += 1;
        await this.backoff(attempt);
      }
    }
  }

  private async consume(body: ReadableStream<Uint8Array>): Promise<void> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let eventName = 'message';
    let lastId: string | null = null;

    while (this.running) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const chunks = buffer.split('\n\n');
      buffer = chunks.pop() ?? '';
      for (const chunk of chunks) {
        eventName = 'message';
        let data = '';
        for (const line of chunk.split('\n')) {
          if (line.startsWith('event:')) eventName = line.slice(6).trim();
          else if (line.startsWith('data:')) data += line.slice(5).trim();
          else if (line.startsWith('id:')) lastId = line.slice(3).trim();
        }
        if (eventName !== 'notification' || !data) continue;
        try {
          const row = JSON.parse(data) as DesktopNotificationRow;
          if (lastId) this.cursor = lastId;
          this.handleNotification(row);
        } catch {
          /* skip malformed frame */
        }
      }
    }
  }

  private handleNotification(row: DesktopNotificationRow): void {
    const window = this.getWindow();
    // A read/dismiss synced from another device: just refresh the renderer.
    const isActionable = !row.readAt && !row.dismissedAt;

    if (window && !window.isDestroyed()) {
      window.webContents.send(IPC.notificationReceived, row);
    }
    if (!isActionable) return;

    const focused = !!window && !window.isDestroyed() && window.isFocused();
    if (focused) return; // the renderer shows an in-app alert instead

    if (!Notification.isSupported()) return;
    const native = new Notification({
      title: row.title,
      body: row.body,
      silent: row.severity === 'INFO' || row.severity === 'LOW',
    });
    native.on('click', () => {
      void this.open(row.id);
    });
    native.show();
  }

  private focusAndRoute(target: string): void {
    const window = this.getWindow();
    if (!window || window.isDestroyed()) return;
    if (window.isMinimized()) window.restore();
    window.show();
    window.focus();
    window.webContents.send(IPC.notificationOpen, { deepLink: target });
  }

  private backoff(attempt: number): Promise<void> {
    const ms = Math.min(RECONNECT_BASE_MS * 2 ** (attempt - 1), RECONNECT_MAX_MS);
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
