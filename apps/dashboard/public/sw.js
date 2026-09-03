/* Tellann dashboard service worker — Web Push receiver.
 *
 * Deliberately tiny: it renders minimal, PII-free payloads produced by the
 * notification orchestrator, suppresses the OS notification when a Tellann tab
 * is already visible, and routes clicks to a validated in-app path.
 */

const VAPID_CACHE = 'tellann-push-config';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

// The page hands us the VAPID key + subscribe URL so pushsubscriptionchange can
// re-subscribe without a live page.
self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'tellann-push-config' && data.vapidPublicKey && data.subscribeUrl) {
    event.waitUntil(
      caches.open(VAPID_CACHE).then((cache) =>
        cache.put(
          '/__tellann_push_config',
          new Response(JSON.stringify({ vapidPublicKey: data.vapidPublicKey, subscribeUrl: data.subscribeUrl })),
        ),
      ),
    );
  }
});

function safePath(raw) {
  if (typeof raw !== 'string' || !raw.startsWith('/')) return '/';
  if (raw.startsWith('//') || raw.startsWith('/\\')) return '/';
  return raw;
}

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: 'Tellann', body: event.data ? event.data.text() : '' };
  }

  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const hasVisible = clientList.some(
        (client) => client.visibilityState === 'visible' || client.focused,
      );
      // A visible dashboard already showed the in-app toast for this event.
      if (hasVisible) return;

      await self.registration.showNotification(payload.title || 'Tellann', {
        body: payload.body || '',
        tag: payload.tag || payload.id || 'tellann',
        icon: '/logo_icon.png',
        badge: '/logo_icon.png',
        data: { deepLink: safePath(payload.deepLink), id: payload.id || null },
        requireInteraction: payload.severity === 'CRITICAL',
      });
    })(),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = safePath(event.notification.data && event.notification.data.deepLink);

  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of clientList) {
        // Reuse an existing Tellann tab rather than opening another.
        if ('focus' in client) {
          await client.focus();
          if ('navigate' in client && target !== '/') {
            try {
              await client.navigate(target);
            } catch {
              /* cross-origin navigate is refused; focus is enough */
            }
          }
          return;
        }
      }
      await self.clients.openWindow(target);
    })(),
  );
});

self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(VAPID_CACHE);
      const res = await cache.match('/__tellann_push_config');
      if (!res) return;
      const { vapidPublicKey, subscribeUrl } = await res.json();
      const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);
      const subscription = await self.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });
      const raw = subscription.toJSON();
      await fetch(subscribeUrl, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: subscription.endpoint, keys: raw.keys }),
      });
    })(),
  );
});

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) output[i] = rawData.charCodeAt(i);
  return output;
}
