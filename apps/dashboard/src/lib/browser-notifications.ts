/**
 * Thin wrapper over the Web Notifications API.
 *
 * Browsers only grant permission in response to a user gesture, and a denied
 * permission can never be re-requested from script — the user has to change it
 * in site settings. Both facts are surfaced through `NotificationPermissionState`
 * so the settings screen can explain what is going on instead of silently doing
 * nothing.
 */

export type NotificationPermissionState =
  | 'unsupported'
  | 'default'
  | 'granted'
  | 'denied';

export function isSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function getPermissionState(): NotificationPermissionState {
  if (!isSupported()) return 'unsupported';
  return Notification.permission as NotificationPermissionState;
}

/**
 * Must be called from a user gesture (a click), or browsers reject it outright.
 * Returns the resulting state so the caller can render the outcome.
 */
export async function requestPermission(): Promise<NotificationPermissionState> {
  if (!isSupported()) return 'unsupported';
  if (Notification.permission !== 'default') {
    return Notification.permission as NotificationPermissionState;
  }
  try {
    return (await Notification.requestPermission()) as NotificationPermissionState;
  } catch {
    // Safari < 16 used a callback signature that rejects the promise form.
    return getPermissionState();
  }
}

export interface BrowserNotificationInput {
  id: string;
  title: string;
  body?: string;
  onClick?: () => void;
}

/**
 * Shows a desktop notification. `tag` is set to the event id so the same event
 * arriving twice (a re-poll, or a second open tab) collapses into one.
 */
export function showBrowserNotification(input: BrowserNotificationInput): boolean {
  if (getPermissionState() !== 'granted') return false;
  try {
    const notification = new Notification(input.title, {
      body: input.body,
      tag: input.id,
      icon: '/logo_icon.svg',
    });
    if (input.onClick) {
      notification.onclick = () => {
        window.focus();
        input.onClick?.();
        notification.close();
      };
    }
    return true;
  } catch {
    // Some browsers throw when constructing notifications outside a service
    // worker (notably Android Chrome); the in-app feed still shows the item.
    return false;
  }
}
