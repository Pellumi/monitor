import {
  EmailCategory,
  EmailDeliveryStatus,
  EmailProvider,
  MemberRole,
  NotificationEventStatus,
  NotificationFrequency,
  PrismaClient,
} from '@sots/db';
import { builtinTemplates, BuiltinEmailTemplate, EmailTemplateKey, getBuiltinTemplate, SenderKey } from './templates';

export { builtinTemplates, EmailTemplateKey };

type TemplateVariables = Record<string, unknown>;

export interface EmailRecipient {
  email: string;
  userId?: string | null;
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
}

export interface SendTemplateEmailResult {
  deliveryId?: string;
  status: EmailDeliveryStatus;
  providerMessageId?: string | null;
  skippedReason?: string;
}

const ALWAYS_ON_CATEGORIES = new Set<EmailCategory>([
  EmailCategory.SECURITY,
  EmailCategory.BILLING,
  EmailCategory.COMPLIANCE,
]);

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
  const sensitiveNames = new Set(['rawKey', 'token', 'apiKey', 'password', 'secret']);
  return Object.entries(variables).filter(([key, value]) => {
    if (value === undefined || value === null || value === '') return false;
    return !sensitiveNames.has(key);
  });
}

function renderHtml(template: BuiltinEmailTemplate, variables: TemplateVariables): string {
  const ctaUrl = template.primaryUrlVariable ? variables[template.primaryUrlVariable] : undefined;
  const facts = publicVariables(variables)
    .filter(([key]) => key !== template.primaryUrlVariable)
    .map(([key, value]) => `
      <tr>
        <td style="padding:8px 12px;color:#71717a;border-bottom:1px solid #e4e4e7;">${escapeHtml(key)}</td>
        <td style="padding:8px 12px;color:#18181b;border-bottom:1px solid #e4e4e7;">${escapeHtml(Array.isArray(value) ? value.join(', ') : value)}</td>
      </tr>
    `)
    .join('');

  const cta = typeof ctaUrl === 'string' && ctaUrl
    ? `<p style="margin:28px 0;"><a href="${escapeHtml(ctaUrl)}" style="background:#2563eb;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:700;">${escapeHtml(template.primaryCtaLabel)}</a></p>`
    : '';

  return `<!doctype html>
<html>
  <body style="margin:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b;">
    <div style="display:none;max-height:0;overflow:hidden;">${escapeHtml(template.preheader)}</div>
    <main style="max-width:640px;margin:0 auto;padding:32px 16px;">
      <section style="background:#ffffff;border:1px solid #e4e4e7;border-radius:10px;padding:28px;">
        <p style="margin:0 0 20px;color:#2563eb;font-weight:700;letter-spacing:.08em;text-transform:uppercase;font-size:12px;">Tellann ${escapeHtml(template.category)}</p>
        <h1 style="font-size:24px;line-height:1.25;margin:0 0 12px;">${escapeHtml(applyVariables(template.subject, variables))}</h1>
        <p style="font-size:16px;line-height:1.6;margin:0 0 18px;color:#3f3f46;">${escapeHtml(template.purpose)}</p>
        ${facts ? `<table style="width:100%;border-collapse:collapse;margin:18px 0;background:#fafafa;border:1px solid #e4e4e7;">${facts}</table>` : ''}
        ${cta}
        <p style="font-size:13px;line-height:1.5;color:#71717a;margin:24px 0 0;">You received this because of activity in Tellann. Critical security, billing, and compliance emails cannot be disabled.</p>
      </section>
    </main>
  </body>
</html>`;
}

function renderText(template: BuiltinEmailTemplate, variables: TemplateVariables): string {
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

    if (!(await this.emailAllowed(input.userId ?? null, input.organizationId ?? null, template.category))) {
      const delivery = await this.recordDelivery(input, notificationEvent.id, idempotencyKey, EmailDeliveryStatus.SKIPPED, EmailProvider.CONSOLE, 'Email preference disabled');
      await this.markEvent(notificationEvent.id, NotificationEventStatus.SKIPPED);
      return { deliveryId: delivery.id, status: delivery.status, skippedReason: 'Email preference disabled' };
    }

    const subject = applyVariables(template.subject, variables);
    const html = renderHtml(template, variables);
    const text = renderText(template, variables);
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
    const recipients = await this.getOrganizationRecipients(params.organizationId, params.roles);
    const uniqueRecipients = new Map(recipients.map((recipient) => [recipient.email.toLowerCase(), recipient]));
    const results: SendTemplateEmailResult[] = [];
    for (const recipient of uniqueRecipients.values()) {
      results.push(await this.sendTransactional({
        ...params,
        to: recipient.email,
        userId: recipient.userId,
        idempotencyKey: params.idempotencyKey
          ? buildIdempotencyKey([params.idempotencyKey, recipient.userId ?? recipient.email])
          : undefined,
      }));
    }
    return results;
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

  private async emailAllowed(userId: string | null, organizationId: string | null, category: EmailCategory): Promise<boolean> {
    if (ALWAYS_ON_CATEGORIES.has(category)) return true;
    if (!userId || !organizationId) return categoryDefaults[category] !== NotificationFrequency.NEVER;

    const preference = await this.prisma.notificationPreference.findUnique({
      where: {
        userId_organizationId_category: {
          userId,
          organizationId,
          category,
        },
      },
    });

    if (!preference) return categoryDefaults[category] !== NotificationFrequency.NEVER;
    return preference.emailEnabled && preference.frequency !== NotificationFrequency.NEVER;
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
