import {
  EmailCategory,
  EmailDeliveryStatus,
  EmailProvider,
  MemberRole,
  NotificationChannel,
  NotificationDeliveryStatus,
  NotificationEventStatus,
  NotificationFrequency,
  PrismaClient,
} from '@tellann/db';
import { builtinTemplates, BuiltinEmailTemplate, EmailTemplateKey, getBuiltinTemplate, SenderKey } from './templates';
import {
  ALWAYS_ON_CATEGORIES as ALWAYS_ON,
  contactFieldFor,
  isDigestFrequency,
  normalizeFrequency,
} from './notification-categories';
import { coerceSeverity } from './orchestrator';

export { builtinTemplates, EmailTemplateKey };
export * from './orchestrator';
export * from './web-push';
export {
  ALWAYS_ON_CATEGORIES,
  BATCHABLE_CATEGORIES,
  CATEGORY_CONTACT_FIELD,
  capabilityFor,
  contactFieldFor,
  isDigestFrequency,
  listCapabilities,
  normalizeFrequency,
  type CategoryCapability,
  type OrganizationContactField,
} from './notification-categories';

type TemplateVariables = Record<string, unknown>;

export interface EmailRecipient {
  email: string;
  userId?: string | null;
}

/** A file delivered with the message, e.g. an invoice or receipt PDF. */
export interface EmailAttachment {
  filename: string;
  content: Buffer;
  contentType?: string;
}

export interface SendTemplateEmailInput {
  templateKey: EmailTemplateKey;
  to: string;
  userId?: string | null;
  organizationId?: string | null;
  applicationId?: string | null;
  eventType: string;
  severity?: string;
  variables?: TemplateVariables;
  idempotencyKey?: string;
  replyTo?: string;
  attachments?: EmailAttachment[];
  /** A relative deep link to attach to the in-app notification, if any. */
  deepLink?: string | null;
  /**
   * Internal: set by the notification orchestrator when it already owns the
   * central Notification for this message, so the compatibility shim below does
   * not create a second one.
   */
  _skipCentralNotification?: boolean;
}

export interface SendTemplateEmailResult {
  deliveryId?: string;
  status: EmailDeliveryStatus;
  providerMessageId?: string | null;
  skippedReason?: string;
}

const categoryDefaults: Record<EmailCategory, NotificationFrequency> = {
  [EmailCategory.SECURITY]: NotificationFrequency.IMMEDIATE,
  [EmailCategory.ACCOUNT]: NotificationFrequency.IMMEDIATE,
  [EmailCategory.ONBOARDING]: NotificationFrequency.IMMEDIATE,
  [EmailCategory.REPORTS]: NotificationFrequency.IMMEDIATE,
  [EmailCategory.ALERTS]: NotificationFrequency.IMMEDIATE,
  [EmailCategory.BILLING]: NotificationFrequency.IMMEDIATE,
  [EmailCategory.TEAM]: NotificationFrequency.IMMEDIATE,
  [EmailCategory.DIGEST]: NotificationFrequency.WEEKLY_DIGEST,
  [EmailCategory.PRODUCT_EDUCATION]: NotificationFrequency.IMMEDIATE,
  [EmailCategory.COMPLIANCE]: NotificationFrequency.IMMEDIATE,
};

/**
 * Marks an EmailDelivery that was held back for a digest. The digest workers
 * select on this exact string, so it is shared rather than written inline.
 */
export const DEFERRED_TO_DIGEST_REASON = 'Deferred to digest';

function env(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : undefined;
}

export function appUrl(path = ''): string {
  const base = env('APP_URL') || env('NEXT_PUBLIC_APP_URL') || 'http://localhost:3000';
  return `${base.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
}

export function docsUrl(path = ''): string {
  const base = env('DOCS_URL') || env('NEXT_PUBLIC_DOCS_URL') || 'http://localhost:3002';
  return `${base.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
}

export function buildIdempotencyKey(parts: Array<string | number | null | undefined>): string {
  return parts
    .filter((part) => part !== null && part !== undefined && `${part}`.length > 0)
    .map((part) => `${part}`.replace(/\s+/g, '-'))
    .join(':')
    .slice(0, 255);
}

function senderFor(key: SenderKey): string {
  const defaults: Record<SenderKey, string> = {
    hello: 'Tellann <hello@tellann.co>',
    security: 'Tellann Security <security@tellann.co>',
    reports: 'Tellann Reports <reports@tellann.co>',
    alerts: 'Tellann Alerts <alerts@tellann.co>',
    billing: 'Tellann Billing <billing@tellann.co>',
    support: 'Tellann Support <support@tellann.co>',
  };

  const envName = `EMAIL_FROM_${key.toUpperCase()}`;
  return env(envName) || defaults[key];
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function applyVariables(template: string, variables: TemplateVariables): string {
  return template.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (_match, key) => {
    const value = variables[key];
    return value === undefined || value === null ? '' : String(value);
  });
}

function publicVariables(variables: TemplateVariables): Array<[string, unknown]> {
  const sensitiveNames = new Set(['rawkey', 'token', 'apikey', 'password', 'secret']);
  return Object.entries(variables).filter(([key, value]) => {
    if (value === undefined || value === null || value === '') return false;
    return !sensitiveNames.has(key.toLowerCase());
  });
}

export function validateTemplateVariables(template: BuiltinEmailTemplate, variables: TemplateVariables): void {
  const missing = template.requiredVariables.filter((key) => {
    const value = variables[key];
    return value === undefined || value === null || value === '';
  });
  if (missing.length > 0) {
    throw new Error(`Missing required variables for ${template.key}: ${missing.join(', ')}`);
  }
}

function humanizeKey(key: string): string {
  return key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').toUpperCase();
}

function isUrlVariable(key: string): boolean {
  return /url$/i.test(key);
}

function isUserAgentVariable(key: string): boolean {
  return /^useragent$/i.test(key.replace(/[_-]/g, ''));
}

function isIpVariable(key: string): boolean {
  return /(^|[_-])ip([_-]|$)/i.test(key) || /ipaddress/i.test(key.replace(/[_-]/g, ''));
}

/**
 * Turns a raw `User-Agent` header into something a person can actually act on
 * ("Chrome 152 · Windows · Desktop") while keeping the original string as a
 * secondary line. A value that is already human-friendly is returned untouched.
 */
export function describeUserAgent(raw: unknown): string {
  const ua = String(raw ?? '').trim();
  if (!ua || /^unknown/i.test(ua)) return 'Unknown device';
  // No UA-style tokens means it was already written for humans.
  if (!/[()/]/.test(ua)) return ua;

  const major = (re: RegExp): string => {
    const match = re.exec(ua);
    return match ? match[1].split('.')[0] : '';
  };
  const join = (label: string, version: string) => (version ? `${label} ${version}` : label);

  let browser = 'Unknown browser';
  if (/\bEdg(?:e|A|iOS)?\//.test(ua)) browser = join('Edge', major(/Edg(?:e|A|iOS)?\/([\d.]+)/));
  else if (/\b(?:OPR|Opera)\//.test(ua)) browser = join('Opera', major(/(?:OPR|Opera)\/([\d.]+)/));
  else if (/\bFirefox\//.test(ua)) browser = join('Firefox', major(/Firefox\/([\d.]+)/));
  else if (/\bChrome\//.test(ua)) browser = join('Chrome', major(/Chrome\/([\d.]+)/));
  else if (/\bVersion\/[\d.]+ (?:Mobile\/\S+ )?Safari/.test(ua)) browser = join('Safari', major(/Version\/([\d.]+)/));
  else if (/\bSafari\//.test(ua)) browser = 'Safari';

  let os = '';
  if (/Windows NT/.test(ua)) os = 'Windows';
  else if (/iPhone|iPad|iPod/.test(ua)) os = 'iOS';
  else if (/Android/.test(ua)) os = join('Android', major(/Android ([\d.]+)/));
  else if (/Mac OS X ([\d_]+)/.test(ua)) os = `macOS ${(/Mac OS X ([\d_]+)/.exec(ua) as RegExpExecArray)[1].replace(/_/g, '.')}`;
  else if (/CrOS/.test(ua)) os = 'ChromeOS';
  else if (/Linux/.test(ua)) os = 'Linux';

  const device = /Mobi|iPhone|iPod|Android.*Mobile/.test(ua)
    ? 'Mobile'
    : /iPad|Tablet/.test(ua)
    ? 'Tablet'
    : 'Desktop';

  return [browser, os, device].filter(Boolean).join(' · ');
}

function renderFactRows(template: BuiltinEmailTemplate, variables: TemplateVariables): string {
  return publicVariables(variables)
    .filter(([key]) => !isUrlVariable(key) && key !== template.emphasisVariable)
    .map(([key, rawValue]) => {
      const value = Array.isArray(rawValue) ? rawValue.join(', ') : String(rawValue);
      const isUa = isUserAgentVariable(key);
      const primary = isUa ? describeUserAgent(value) : value;
      const secondary = isUa && primary !== value ? value : '';
      const wrap = isUa || isIpVariable(key) ? 'break-all' : 'break-word';
      return `<tr><td class="tl-fact" style="padding:12px 14px;border-bottom:1px solid #262626;">
        <div style="color:#8e9192;font:11px 'JetBrains Mono','Courier New',monospace;letter-spacing:.08em;text-transform:uppercase;">${escapeHtml(humanizeKey(key))}</div>
        <div style="margin-top:5px;color:#ffffff;font:13px 'JetBrains Mono','Courier New',monospace;line-height:1.5;word-break:${wrap};overflow-wrap:anywhere;">${escapeHtml(primary)}</div>
        ${secondary ? `<div style="margin-top:4px;color:#8e9192;font:11px 'JetBrains Mono','Courier New',monospace;line-height:1.5;word-break:break-all;overflow-wrap:anywhere;">${escapeHtml(secondary)}</div>` : ''}
      </td></tr>`;
    })
    .join('');
}

export function renderTemplateHtml(template: BuiltinEmailTemplate, variables: TemplateVariables): string {
  validateTemplateVariables(template, variables);
  const ctaUrl = template.primaryUrlVariable ? variables[template.primaryUrlVariable] : undefined;
  const secondaryUrl = template.secondaryUrlVariable ? variables[template.secondaryUrlVariable] : undefined;
  const facts = renderFactRows(template, variables);
  const emphasis = template.emphasisVariable ? variables[template.emphasisVariable] : undefined;
  const headline = applyVariables(template.headline || template.subject, variables);

  const cta = typeof ctaUrl === 'string' && ctaUrl
    ? `<a class="tl-btn" href="${escapeHtml(ctaUrl)}" style="display:inline-block;background:#ffffff;color:#000000;text-decoration:none;padding:14px 20px;margin:0 10px 10px 0;border-radius:4px;font:600 13px Poppins,Arial,sans-serif;letter-spacing:.08em;text-transform:uppercase;">${escapeHtml(template.primaryCtaLabel)}</a>`
    : '';
  const secondaryCta = typeof secondaryUrl === 'string' && secondaryUrl
    ? `<a class="tl-btn" href="${escapeHtml(secondaryUrl)}" style="display:inline-block;color:#ffffff;text-decoration:none;padding:13px 19px;margin:0 10px 10px 0;border:1px solid #444748;border-radius:4px;font:500 13px Poppins,Arial,sans-serif;letter-spacing:.06em;text-transform:uppercase;">${escapeHtml(template.secondaryCtaLabel || 'Learn more')}</a>`
    : '';
  const footnote = template.footnote
    ? `<p class="tl-footnote" style="font-size:13px;line-height:1.6;margin:24px 0 0;color:#c4c7c8;border-left:2px solid #444748;padding-left:12px;">${escapeHtml(applyVariables(template.footnote, variables))}</p>`
    : '';

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta name="color-scheme" content="dark">
    <meta name="supported-color-schemes" content="dark">
    <style>
      body { margin:0; padding:0; width:100% !important; -webkit-text-size-adjust:100%; }
      a { color:#ffffff; }
      @media only screen and (max-width:600px) {
        .tl-main { padding:20px 0 !important; }
        .tl-card { padding:20px 16px !important; border-left:0 !important; border-right:0 !important; border-radius:0 !important; }
        .tl-brand { margin-bottom:24px !important; }
        .tl-badge { font-size:10px !important; padding:4px 6px !important; letter-spacing:.06em !important; }
        .tl-h1 { font-size:22px !important; line-height:1.25 !important; }
        .tl-purpose { font-size:15px !important; }
        .tl-emphasis { font-size:22px !important; padding:22px 12px !important; }
        .tl-btnrow { margin-top:24px !important; }
        .tl-btn { display:block !important; width:100% !important; text-align:center !important; margin:0 0 10px 0 !important; box-sizing:border-box !important; }
      }
    </style>
  </head>
  <body style="margin:0;background:#000000;font-family:Poppins,Arial,Helvetica,sans-serif;color:#e2e2e2;">
    <div style="display:none;max-height:0;overflow:hidden;">${escapeHtml(template.preheader)}</div>
    <main class="tl-main" style="max-width:600px;margin:0 auto;padding:40px 16px;">
      <section class="tl-card" style="background:#131313;border:1px solid #262626;border-radius:4px;padding:24px;">
        <table role="presentation" class="tl-brand" style="width:100%;border-collapse:collapse;margin:0 0 40px;"><tr>
          <td style="color:#ffffff;font-size:22px;font-weight:800;letter-spacing:-.04em;">TELLANN</td>
          <td style="text-align:right;"><span class="tl-badge" style="display:inline-block;border:1px solid #444748;color:#8e9192;padding:5px 7px;font:11px 'JetBrains Mono','Courier New',monospace;letter-spacing:.08em;text-transform:uppercase;">${escapeHtml(template.designLabel || `${template.category} // Notification`)}</span></td>
        </tr></table>
        <h1 class="tl-h1" style="font-size:30px;line-height:1.2;margin:0 0 16px;color:#ffffff;font-weight:600;letter-spacing:-.01em;">${escapeHtml(headline)}</h1>
        <p class="tl-purpose" style="font-size:16px;line-height:1.6;margin:0 0 24px;color:#c4c7c8;">${escapeHtml(template.purpose)}</p>
        ${emphasis !== undefined && emphasis !== null && emphasis !== '' ? `<div class="tl-emphasis" style="background:#000000;border:1px solid #262626;padding:28px 16px;margin:0 0 24px;text-align:center;color:#ffffff;font:500 28px 'JetBrains Mono','Courier New',monospace;letter-spacing:${template.key === 'auth-otp' ? '.22em' : '.02em'};overflow-wrap:anywhere;word-break:break-word;">${escapeHtml(emphasis)}</div>` : ''}
        ${facts ? `<table role="presentation" style="width:100%;border-collapse:collapse;margin:0 0 24px;background:#000000;border:1px solid #262626;table-layout:fixed;">${facts}</table>` : ''}
        ${(cta || secondaryCta) ? `<div class="tl-btnrow" style="margin:32px 0 0;">${cta}${secondaryCta}</div>` : ''}
        ${footnote}
        <div style="border-top:1px solid #262626;margin-top:40px;padding-top:20px;color:#8e9192;font-size:12px;line-height:1.6;">
          ${variables.organizationName ? `${escapeHtml(variables.organizationName)}${variables.applicationName ? ' &middot; ' : ''}` : ''}${variables.applicationName ? escapeHtml(variables.applicationName) : ''}
          <br>You received this because of activity in Tellann. <a href="${escapeHtml(appUrl('/settings/profile'))}" style="color:#c4c7c8;">Notification preferences</a><br>Tellann, Abuja, Nigeria
        </div>
      </section>
    </main>
  </body>
</html>`;
}

export function renderTemplateText(template: BuiltinEmailTemplate, variables: TemplateVariables): string {
  validateTemplateVariables(template, variables);
  const lines = [
    applyVariables(template.subject, variables),
    '',
    template.purpose,
    '',
    ...publicVariables(variables).map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : String(value)}`),
  ];
  const ctaUrl = template.primaryUrlVariable ? variables[template.primaryUrlVariable] : undefined;
  if (typeof ctaUrl === 'string' && ctaUrl) {
    lines.push('', `${template.primaryCtaLabel}: ${ctaUrl}`);
  }
  return lines.join('\n');
}

async function parseResendResponse(response: Response): Promise<{ id?: string; error?: string }> {
  const text = await response.text();
  if (!text) return {};
  try {
    const json = JSON.parse(text);
    return { id: json.id, error: json.message || json.error || text };
  } catch {
    return { error: text };
  }
}

/**
 * Turns a stored NotificationEvent payload back into something displayable.
 *
 * Events record the template key and its variables, so the same subject line the
 * email would have used is reused for the in-app feed rather than maintaining a
 * second set of copy.
 */
export function summarizeNotification(
  templateKey: string,
  variables: TemplateVariables = {},
): { title: string; preheader: string; category: EmailCategory } | null {
  const template = getBuiltinTemplate(templateKey as EmailTemplateKey);
  if (!template) return null;
  return {
    title: applyVariables(template.subject, variables),
    preheader: applyVariables(template.preheader ?? '', variables),
    category: template.category,
  };
}

export class NotificationEmailService {
  constructor(private readonly prisma: PrismaClient) {}

  async syncBuiltinTemplates(): Promise<void> {
    await Promise.all(builtinTemplates.map((template) => this.prisma.emailTemplate.upsert({
      where: { key: template.key },
      update: {
        category: template.category,
        subject: template.subject,
        preheader: template.preheader,
        htmlPath: `builtin:${template.key}:html`,
        textPath: `builtin:${template.key}:text`,
        requiredVariables: template.requiredVariables,
        defaultFrom: senderFor(template.defaultFrom),
        isActive: true,
      },
      create: {
        key: template.key,
        category: template.category,
        subject: template.subject,
        preheader: template.preheader,
        htmlPath: `builtin:${template.key}:html`,
        textPath: `builtin:${template.key}:text`,
        requiredVariables: template.requiredVariables,
        defaultFrom: senderFor(template.defaultFrom),
      },
    })));
  }

  async sendTransactional(input: SendTemplateEmailInput): Promise<SendTemplateEmailResult> {
    const template = getBuiltinTemplate(input.templateKey);
    if (!template) {
      throw new Error(`Unknown email template: ${input.templateKey}`);
    }

    const variables = input.variables ?? {};
    const notificationEvent = await this.prisma.notificationEvent.create({
      data: {
        organizationId: input.organizationId ?? null,
        applicationId: input.applicationId ?? null,
        eventType: input.eventType,
        severity: input.severity ?? 'INFO',
        payload: { templateKey: input.templateKey, to: input.to, variables } as any,
        status: NotificationEventStatus.PROCESSING,
      },
    });

    const idempotencyKey = input.idempotencyKey ?? buildIdempotencyKey([
      input.organizationId,
      input.applicationId,
      input.eventType,
      input.userId,
      input.to,
      input.templateKey,
    ]);

    // Compatibility shim: every account-bound transactional email also becomes a
    // central Notification + per-recipient feed row, so existing producers gain
    // in-app delivery without a call-site change. Best-effort — a failure here
    // must never block the email.
    if (!input._skipCentralNotification) {
      await this.ensureCentralNotification(input, template, idempotencyKey).catch((err) => {
        console.error('[Email] central notification shim failed', err);
      });
    }

    const existing = idempotencyKey
      ? await this.prisma.emailDelivery.findUnique({ where: { idempotencyKey } })
      : null;
    if (existing) {
      await this.prisma.notificationEvent.update({
        where: { id: notificationEvent.id },
        data: { status: NotificationEventStatus.SKIPPED },
      });
      return { deliveryId: existing.id, status: existing.status, providerMessageId: existing.providerMessageId };
    }

    const suppression = await this.prisma.emailSuppression.findFirst({
      where: {
        email: input.to.toLowerCase(),
        OR: [{ category: null }, { category: template.category }],
      },
    });
    if (suppression) {
      const delivery = await this.recordDelivery(input, notificationEvent.id, idempotencyKey, EmailDeliveryStatus.SUPPRESSED, EmailProvider.CONSOLE, suppression.reason);
      await this.markEvent(notificationEvent.id, NotificationEventStatus.SKIPPED);
      return { deliveryId: delivery.id, status: delivery.status, skippedReason: suppression.reason };
    }

    const disposition = await this.emailDisposition(
      input.userId ?? null,
      input.organizationId ?? null,
      template.category,
    );

    if (disposition !== 'send') {
      // Deferred events stay CREATED so the digest worker can pick them up;
      // skipped ones are terminal.
      const reason = disposition === 'defer'
        ? DEFERRED_TO_DIGEST_REASON
        : 'Email preference disabled';
      const delivery = await this.recordDelivery(input, notificationEvent.id, idempotencyKey, EmailDeliveryStatus.SKIPPED, EmailProvider.CONSOLE, reason);
      await this.markEvent(
        notificationEvent.id,
        disposition === 'defer' ? NotificationEventStatus.CREATED : NotificationEventStatus.SKIPPED,
      );
      return { deliveryId: delivery.id, status: delivery.status, skippedReason: reason };
    }

    const subject = applyVariables(template.subject, variables);
    const html = renderTemplateHtml(template, variables);
    const text = renderTemplateText(template, variables);
    const apiKey = env('RESEND_API_KEY');
    const disabled = env('EMAIL_SEND_DISABLED') === 'true';

    if (!apiKey || disabled) {
      console.log(`[Email:console] ${input.templateKey} to ${input.to}\nSubject: ${subject}\n${text}`);
      const delivery = await this.recordDelivery(input, notificationEvent.id, idempotencyKey, EmailDeliveryStatus.SKIPPED, EmailProvider.CONSOLE, !apiKey ? 'RESEND_API_KEY not configured' : 'EMAIL_SEND_DISABLED=true');
      await this.markEvent(notificationEvent.id, NotificationEventStatus.SKIPPED);
      return { deliveryId: delivery.id, status: delivery.status, skippedReason: delivery.error ?? undefined };
    }

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify({
          from: senderFor(template.defaultFrom),
          to: input.to,
          subject,
          html,
          text,
          reply_to: input.replyTo,
          ...(input.attachments?.length
            ? {
                attachments: input.attachments.map((attachment) => ({
                  filename: attachment.filename,
                  content: attachment.content.toString('base64'),
                  ...(attachment.contentType ? { content_type: attachment.contentType } : {}),
                })),
              }
            : {}),
          headers: {
            'X-Tellann-Notification': 'true',
            'X-Tellann-Template': input.templateKey,
          },
        }),
      });

      const parsed = await parseResendResponse(response);
      if (!response.ok) {
        const delivery = await this.recordDelivery(input, notificationEvent.id, idempotencyKey, EmailDeliveryStatus.FAILED, EmailProvider.RESEND, parsed.error || `Resend returned ${response.status}`);
        await this.markEvent(notificationEvent.id, NotificationEventStatus.FAILED);
        return { deliveryId: delivery.id, status: delivery.status, skippedReason: delivery.error ?? undefined };
      }

      const delivery = await this.prisma.emailDelivery.create({
        data: {
          notificationEventId: notificationEvent.id,
          userId: input.userId ?? null,
          toEmail: input.to.toLowerCase(),
          templateKey: input.templateKey,
          provider: EmailProvider.RESEND,
          providerMessageId: parsed.id ?? null,
          idempotencyKey,
          status: EmailDeliveryStatus.SENT,
          sentAt: new Date(),
        },
      });
      await this.markEvent(notificationEvent.id, NotificationEventStatus.SENT);
      return { deliveryId: delivery.id, status: delivery.status, providerMessageId: delivery.providerMessageId };
    } catch (err: any) {
      const delivery = await this.recordDelivery(input, notificationEvent.id, idempotencyKey, EmailDeliveryStatus.FAILED, EmailProvider.RESEND, err?.message || 'Email send failed');
      await this.markEvent(notificationEvent.id, NotificationEventStatus.FAILED);
      return { deliveryId: delivery.id, status: delivery.status, skippedReason: delivery.error ?? undefined };
    }
  }

  async sendToOrganizationMembers(params: Omit<SendTemplateEmailInput, 'to' | 'userId'> & {
    organizationId: string;
    roles?: MemberRole[];
  }): Promise<SendTemplateEmailResult[]> {
    const template = getBuiltinTemplate(params.templateKey);
    if (!template) {
      throw new Error(`Unknown email template: ${params.templateKey}`);
    }
    const recipients = await this.resolveOrganizationRecipients(
      params.organizationId,
      template.category,
      params.roles,
    );
    const uniqueRecipients = new Map(recipients.map((recipient) => [recipient.email.toLowerCase(), recipient]));

    // One logical notification for the whole fan-out — multiple email recipients
    // must not create multiple central Notification rows.
    const baseKey =
      params.idempotencyKey ??
      buildIdempotencyKey([
        params.organizationId,
        params.applicationId,
        params.eventType,
        params.templateKey,
      ]);
    await this.persistCentralNotification({
      organizationId: params.organizationId,
      applicationId: params.applicationId ?? null,
      eventType: params.eventType,
      category: template.category,
      severity: params.severity,
      templateKey: params.templateKey,
      variables: params.variables ?? {},
      deepLink: params.deepLink ?? null,
      sourceEventId: baseKey,
      recipientUserIds: [...uniqueRecipients.values()]
        .map((r) => r.userId)
        .filter((id): id is string => !!id),
    }).catch((err) => console.error('[Email] central notification (members) shim failed', err));

    const results: SendTemplateEmailResult[] = [];
    for (const recipient of uniqueRecipients.values()) {
      results.push(await this.sendTransactional({
        ...params,
        to: recipient.email,
        userId: recipient.userId,
        // The fan-out notification is already persisted above.
        _skipCentralNotification: true,
        idempotencyKey: params.idempotencyKey
          ? buildIdempotencyKey([params.idempotencyKey, recipient.userId ?? recipient.email])
          : undefined,
      }));
    }
    return results;
  }

  /**
   * Upserts the central Notification for a transactional email and attaches a
   * feed row per account-bound recipient. Idempotent on
   * (eventType, sourceEventId); safe to call from the retry path.
   */
  private async ensureCentralNotification(
    input: SendTemplateEmailInput,
    template: BuiltinEmailTemplate,
    idempotencyKey: string,
  ): Promise<void> {
    if (!input.userId || !input.organizationId) return; // no account => email only
    await this.persistCentralNotification({
      organizationId: input.organizationId,
      applicationId: input.applicationId ?? null,
      eventType: input.eventType,
      category: template.category,
      severity: input.severity,
      templateKey: input.templateKey,
      variables: input.variables ?? {},
      deepLink: input.deepLink ?? null,
      sourceEventId: idempotencyKey,
      recipientUserIds: [input.userId],
    });
  }

  private async persistCentralNotification(opts: {
    organizationId: string;
    applicationId: string | null;
    eventType: string;
    category: EmailCategory;
    severity?: string;
    templateKey: EmailTemplateKey;
    variables: TemplateVariables;
    deepLink: string | null;
    sourceEventId: string;
    recipientUserIds: string[];
  }): Promise<void> {
    if (opts.recipientUserIds.length === 0) return;
    const summary = summarizeNotification(opts.templateKey, opts.variables);
    const template = getBuiltinTemplate(opts.templateKey);
    const title = (summary?.title ?? template?.subject ?? opts.eventType).slice(0, 300);
    const body = (summary?.preheader ?? template?.preheader ?? '').slice(0, 2000);

    const notification = await this.prisma.notification.upsert({
      where: {
        sourceEventType_sourceEventId: {
          sourceEventType: opts.eventType,
          sourceEventId: opts.sourceEventId,
        },
      },
      create: {
        organizationId: opts.organizationId,
        applicationId: opts.applicationId,
        type: opts.eventType,
        category: opts.category,
        severity: coerceSeverity(opts.severity),
        title,
        body,
        deepLink: opts.deepLink,
        sourceEventType: opts.eventType,
        sourceEventId: opts.sourceEventId,
        metadata: { via: 'email-shim', templateKey: opts.templateKey },
      },
      update: {},
      select: { id: true },
    });

    const uniqueUserIds = [...new Set(opts.recipientUserIds)];
    const prefs = await this.prisma.notificationPreference.findMany({
      where: {
        organizationId: opts.organizationId,
        userId: { in: uniqueUserIds },
        category: opts.category,
      },
      select: { userId: true, inAppEnabled: true },
    });
    const inAppByUser = new Map(prefs.map((p) => [p.userId, p.inAppEnabled]));
    const locked = ALWAYS_ON.has(opts.category);

    for (const userId of uniqueUserIds) {
      const deliveredToFeed = locked ? true : inAppByUser.get(userId) ?? true;
      await this.prisma.userNotification.upsert({
        where: { notificationId_userId: { notificationId: notification.id, userId } },
        create: {
          notificationId: notification.id,
          userId,
          organizationId: opts.organizationId,
          deliveredToFeed,
        },
        update: {},
      });
      if (deliveredToFeed) {
        await this.prisma.notificationDelivery.upsert({
          where: {
            notificationId_userId_channel: {
              notificationId: notification.id,
              userId,
              channel: NotificationChannel.IN_APP,
            },
          },
          create: {
            notificationId: notification.id,
            userId,
            channel: NotificationChannel.IN_APP,
            status: NotificationDeliveryStatus.DELIVERED,
            sentAt: new Date(),
            deliveredAt: new Date(),
          },
          update: {},
        });
      }
    }
  }

  /**
   * Who an organisation-level message in `category` is addressed to.
   *
   * When the organisation nominated a contact address for the category — a
   * billing mailbox, an on-call alias, a security inbox — that address receives
   * the mail *instead of* every member, which is the point of setting one. With
   * no contact configured the message fans out to the members as before.
   *
   * The address is matched back to a member where one exists so notification
   * preferences, digest batching and delivery history stay attached to the right
   * user; an external alias simply carries no user id, which `emailDisposition`
   * already handles by falling back to the category default.
   *
   * `roles` still narrows the member fan-out, but is not applied to a configured
   * contact: an organisation that named a billing mailbox meant that mailbox,
   * whether or not it belongs to an owner.
   */
  async resolveOrganizationRecipients(
    organizationId: string,
    category: EmailCategory,
    roles?: MemberRole[],
  ): Promise<EmailRecipient[]> {
    const field = contactFieldFor(category);
    if (field) {
      const settings = await this.prisma.organizationSettings.findUnique({
        where: { organizationId },
        select: { billingContactEmail: true, technicalContactEmail: true, securityContactEmail: true },
      });
      const contact = settings?.[field]?.trim();
      if (contact) {
        const member = await this.prisma.organizationMembership.findFirst({
          where: { organizationId, user: { email: { equals: contact, mode: 'insensitive' } } },
          select: { userId: true },
        });
        return [{ email: contact, userId: member?.userId ?? null }];
      }
    }

    return this.getOrganizationRecipients(organizationId, roles);
  }

  async getOrganizationRecipients(organizationId: string, roles?: MemberRole[]): Promise<EmailRecipient[]> {
    const memberships = await this.prisma.organizationMembership.findMany({
      where: {
        organizationId,
        ...(roles?.length ? { role: { in: roles } } : {}),
      },
      include: { user: true },
    });

    return memberships
      .filter((membership) => membership.user?.email)
      .map((membership) => ({ email: membership.user.email, userId: membership.userId }));
  }

  async applyResendWebhook(event: any): Promise<void> {
    const providerMessageId = event?.data?.email_id || event?.data?.id || event?.email_id || event?.id;
    if (!providerMessageId) return;

    const type = String(event?.type || event?.event || '').toLowerCase();
    const status = type.includes('delivered') ? EmailDeliveryStatus.DELIVERED
      : type.includes('opened') ? EmailDeliveryStatus.OPENED
      : type.includes('clicked') ? EmailDeliveryStatus.CLICKED
      : type.includes('bounced') ? EmailDeliveryStatus.BOUNCED
      : type.includes('complained') ? EmailDeliveryStatus.COMPLAINED
      : type.includes('failed') ? EmailDeliveryStatus.FAILED
      : null;

    if (!status) return;

    const timestamp = new Date();
    await this.prisma.emailDelivery.updateMany({
      where: { providerMessageId },
      data: {
        status,
        deliveredAt: status === EmailDeliveryStatus.DELIVERED ? timestamp : undefined,
        openedAt: status === EmailDeliveryStatus.OPENED ? timestamp : undefined,
        clickedAt: status === EmailDeliveryStatus.CLICKED ? timestamp : undefined,
        bouncedAt: status === EmailDeliveryStatus.BOUNCED || status === EmailDeliveryStatus.COMPLAINED ? timestamp : undefined,
      },
    });
  }

  /**
   * Decides what to do with an email for `category`:
   *
   * - `send`   deliver now
   * - `defer`  hold for the digest run the user asked for
   * - `skip`   the user switched this category off
   *
   * Always-on categories send unconditionally. Without a user and organisation
   * there is no preference to consult — an OTP or an invite to someone who has
   * no account yet — so those fall back to the category default.
   */
  private async emailDisposition(
    userId: string | null,
    organizationId: string | null,
    category: EmailCategory,
  ): Promise<'send' | 'defer' | 'skip'> {
    if (ALWAYS_ON.has(category)) return 'send';
    if (!userId || !organizationId) {
      return categoryDefaults[category] === NotificationFrequency.NEVER ? 'skip' : 'send';
    }

    const preference = await this.prisma.notificationPreference.findUnique({
      where: {
        userId_organizationId_category: {
          userId,
          organizationId,
          category,
        },
      },
    });

    if (!preference) {
      return categoryDefaults[category] === NotificationFrequency.NEVER ? 'skip' : 'send';
    }
    if (!preference.emailEnabled) return 'skip';

    // A digest frequency on a transactional category would silently delay mail
    // the user needs immediately, so it is coerced back to IMMEDIATE here as
    // well as at the API boundary.
    const frequency = normalizeFrequency(category, preference.frequency);
    if (frequency === NotificationFrequency.NEVER) return 'skip';
    return isDigestFrequency(frequency) ? 'defer' : 'send';
  }

  private async recordDelivery(
    input: SendTemplateEmailInput,
    notificationEventId: string,
    idempotencyKey: string,
    status: EmailDeliveryStatus,
    provider: EmailProvider,
    error?: string,
  ) {
    return this.prisma.emailDelivery.create({
      data: {
        notificationEventId,
        userId: input.userId ?? null,
        toEmail: input.to.toLowerCase(),
        templateKey: input.templateKey,
        provider,
        idempotencyKey,
        status,
        error: error ?? null,
        sentAt: status === EmailDeliveryStatus.SENT ? new Date() : null,
      },
    });
  }

  private async markEvent(id: string, status: NotificationEventStatus): Promise<void> {
    await this.prisma.notificationEvent.update({
      where: { id },
      data: { status },
    });
  }
}
