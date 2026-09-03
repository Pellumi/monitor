/**
 * Standards-based Web Push (RFC 8030 / VAPID) wrapper.
 *
 * Degrades the same way the email sender does when RESEND_API_KEY is absent:
 * with no VAPID keys configured the sender is simply unavailable and callers
 * record a SKIPPED delivery rather than failing. Only the VAPID *public* key is
 * ever exposed to clients; the private key stays here.
 */
import webpush from 'web-push';

export interface WebPushConfig {
  publicKey: string;
  privateKey: string;
  /** `mailto:` or `https:` contact per the VAPID spec. */
  subject: string;
}

export interface WebPushSubscriptionRecord {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/** Minimal, PII-free shape the service worker renders. */
export interface WebPushPayload {
  id: string;
  title: string;
  body: string;
  severity: string;
  deepLink?: string | null;
  /** Collapses repeat deliveries of the same notification into one OS entry. */
  tag: string;
}

export interface WebPushSendResult {
  ok: boolean;
  statusCode?: number;
  /** The subscription is permanently invalid and should be disabled. */
  gone: boolean;
  /** Sanitized, length-capped — never surfaced to end users. */
  error?: string;
}

/**
 * Reads VAPID configuration from the environment. Returns null when either key
 * is missing so the caller can carry on without push rather than crash.
 */
export function loadWebPushConfig(env: NodeJS.ProcessEnv = process.env): WebPushConfig | null {
  const publicKey = env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = env.VAPID_PRIVATE_KEY?.trim();
  const subject = env.VAPID_SUBJECT?.trim() || 'mailto:alerts@tellann.co';
  if (!publicKey || !privateKey) return null;
  return { publicKey, privateKey, subject };
}

export class WebPushSender {
  constructor(private readonly config: WebPushConfig) {
    webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey);
  }

  get publicKey(): string {
    return this.config.publicKey;
  }

  async send(
    subscription: WebPushSubscriptionRecord,
    payload: WebPushPayload,
    ttlSeconds = 60 * 60,
  ): Promise<WebPushSendResult> {
    try {
      const res = await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        },
        JSON.stringify(payload),
        { TTL: ttlSeconds },
      );
      return { ok: true, statusCode: res.statusCode, gone: false };
    } catch (err: unknown) {
      const statusCode =
        typeof err === 'object' && err !== null && 'statusCode' in err
          ? Number((err as { statusCode?: number }).statusCode)
          : undefined;
      const raw =
        typeof err === 'object' && err !== null
          ? String((err as { body?: string; message?: string }).body ??
              (err as { message?: string }).message ??
              'push failed')
          : 'push failed';
      return {
        ok: false,
        statusCode,
        // 404 Not Found / 410 Gone: the push service has dropped this endpoint.
        gone: statusCode === 404 || statusCode === 410,
        error: raw.slice(0, 200),
      };
    }
  }
}

/** Convenience: build a sender from the environment, or null when unconfigured. */
export function createWebPushSenderFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): WebPushSender | null {
  const config = loadWebPushConfig(env);
  return config ? new WebPushSender(config) : null;
}

/**
 * Boot-time diagnostic for VAPID / notification-worker configuration. Returns a
 * human-readable status plus any problems; callers log it rather than crash, in
 * keeping with how the rest of the platform treats optional integrations.
 */
export function describeWebPushConfig(env: NodeJS.ProcessEnv = process.env): {
  configured: boolean;
  problems: string[];
  summary: string;
} {
  const publicKey = env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = env.VAPID_PRIVATE_KEY?.trim();
  const subject = env.VAPID_SUBJECT?.trim();
  const problems: string[] = [];

  if (!publicKey && !privateKey) {
    return {
      configured: false,
      problems: [],
      summary: 'Web Push disabled (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY unset).',
    };
  }
  if (!publicKey) problems.push('VAPID_PUBLIC_KEY is missing while VAPID_PRIVATE_KEY is set.');
  if (!privateKey) problems.push('VAPID_PRIVATE_KEY is missing while VAPID_PUBLIC_KEY is set.');
  // A P-256 public key is 65 bytes → 87 base64url chars; the private key 32 → 43.
  if (publicKey && publicKey.length < 80) problems.push('VAPID_PUBLIC_KEY does not look like a base64url P-256 key.');
  if (privateKey && privateKey.length < 40) problems.push('VAPID_PRIVATE_KEY does not look like a base64url P-256 key.');
  if (subject && !/^(mailto:|https:\/\/)/.test(subject)) {
    problems.push('VAPID_SUBJECT must be a mailto: or https: URL.');
  }

  const configured = problems.length === 0 && !!publicKey && !!privateKey;
  return {
    configured,
    problems,
    summary: configured
      ? `Web Push enabled (subject ${subject || 'mailto:alerts@tellann.co (default)'}).`
      : `Web Push misconfigured: ${problems.join(' ')}`,
  };
}
