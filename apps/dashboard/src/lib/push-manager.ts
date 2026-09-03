'use client';

/**
 * Web Push enrolment for the dashboard.
 *
 * Standards-based Web Push (service worker + Push API + VAPID), distinct from
 * the foreground `Notification` toasts the provider raises. Permission is only
 * ever requested from an explicit user gesture (the settings "Enable" button).
 */
import { authenticatedFetch } from '@/lib/authenticated-fetch';

export type PushState =
  | 'unsupported'
  | 'denied'
  | 'default'
  | 'subscribed'
  | 'unsubscribed';

export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

async function registration(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration('/sw.js');
  return existing ?? navigator.serviceWorker.register('/sw.js', { scope: '/' });
}

function urlBase64ToArrayBuffer(base64: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(normalized);
  const buffer = new ArrayBuffer(raw.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i += 1) view[i] = raw.charCodeAt(i);
  return buffer;
}

export async function getPushState(): Promise<PushState> {
  if (!isPushSupported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  if (Notification.permission === 'default') return 'default';
  try {
    const reg = await navigator.serviceWorker.getRegistration('/sw.js');
    const sub = await reg?.pushManager.getSubscription();
    return sub ? 'subscribed' : 'unsubscribed';
  } catch {
    return 'unsubscribed';
  }
}

async function fetchPushConfig(
  orgId: string,
): Promise<{ vapidPublicKey: string | null; webPushConfigured: boolean }> {
  const response = await authenticatedFetch(
    `/api-gateway/organizations/${orgId}/push-config`,
  );
  if (!response.ok) return { vapidPublicKey: null, webPushConfigured: false };
  return response.json();
}

/**
 * Requests permission (if still default), subscribes this browser and persists
 * the subscription server-side. Returns the resulting state, or throws with a
 * user-presentable message.
 */
export async function enablePush(orgId: string): Promise<PushState> {
  if (!isPushSupported()) return 'unsupported';

  const config = await fetchPushConfig(orgId);
  if (!config.webPushConfigured || !config.vapidPublicKey) {
    throw new Error('Browser push is not configured on this server yet.');
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'default';

  const reg = await registration();
  await navigator.serviceWorker.ready;

  const subscription =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToArrayBuffer(config.vapidPublicKey),
    }));

  const raw = subscription.toJSON();
  const response = await authenticatedFetch(
    `/api-gateway/organizations/${orgId}/push-subscriptions`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: subscription.endpoint,
        keys: raw.keys,
        deviceLabel: navigator.userAgent.slice(0, 100),
      }),
    },
  );
  if (!response.ok) {
    throw new Error('Could not save the subscription. Please try again.');
  }

  // Hand the SW what it needs to re-subscribe on its own later.
  reg.active?.postMessage({
    type: 'tellann-push-config',
    vapidPublicKey: config.vapidPublicKey,
    subscribeUrl: `/api-gateway/organizations/${orgId}/push-subscriptions`,
  });

  return 'subscribed';
}

/** Unsubscribes this browser and removes the server row. Keeps read history. */
export async function disablePush(orgId: string): Promise<PushState> {
  if (!isPushSupported()) return 'unsupported';
  const reg = await navigator.serviceWorker.getRegistration('/sw.js');
  const subscription = await reg?.pushManager.getSubscription();
  if (subscription) {
    await authenticatedFetch(
      `/api-gateway/organizations/${orgId}/push-subscriptions/unregister`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      },
    ).catch(() => void 0);
    await subscription.unsubscribe().catch(() => void 0);
  }
  return 'unsubscribed';
}

/** Fires the server's test-notification path for this user's subscriptions. */
export async function sendTestPush(orgId: string): Promise<{ sent: number; total: number }> {
  const response = await authenticatedFetch(
    `/api-gateway/organizations/${orgId}/push-subscriptions/test`,
    { method: 'POST' },
  );
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error === 'NO_SUBSCRIPTIONS' ? 'This browser is not subscribed.' : 'Test failed.');
  }
  return response.json();
}
