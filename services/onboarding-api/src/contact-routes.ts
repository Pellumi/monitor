import crypto from 'node:crypto';
import { Router, type Request, type Response } from 'express';
import { ContactSubmissionType, type PrismaClient } from '@tellann/db';
import { buildIdempotencyKey, type NotificationEmailService } from '@tellann/email';

/**
 * Public contact form intake.
 *
 * Unauthenticated by design — it is the form on the marketing site — so every
 * guard here is about keeping the table useful rather than about identity:
 * a fixed field whitelist, hard length caps, a honeypot, and a per-IP window.
 */

/** Where submission notifications are sent when nothing is configured. */
const DEFAULT_NOTIFICATION_EMAIL = 'tellann.technologies@gmail.com';

/** Where submission notifications are sent. */
function notificationRecipient(): string | null {
  const configured = process.env.CONTACT_NOTIFICATION_EMAIL?.trim() || DEFAULT_NOTIFICATION_EMAIL;
  return configured.includes('@') ? configured : null;
}

/** Longest value accepted per field, so one paste cannot fill the column. */
const LIMITS = {
  name: 100,
  email: 254,
  organization: 200,
  subject: 200,
  message: 5_000,
  detail: 500,
} as const;

const MIN_MESSAGE_LENGTH = 20;

/**
 * The route-specific answers each contact type may carry. Anything not named
 * here is dropped rather than stored, so a crafted payload cannot turn
 * `details` into arbitrary attacker-controlled storage.
 */
const DETAIL_FIELDS = [
  // sales
  'role',
  'teamSize',
  'plan',
  // enterprise
  'organizationSize',
  'applications',
  'requirement',
  // support
  'workspace',
  'application',
  'issueCategory',
  'requestId',
  // partnership — `website` is a real answer here, not the honeypot
  'partnershipType',
  'website',
  // press
  'publication',
  'enquiryType',
  'deadline',
  // security
  'component',
  'impact',
  // privacy
  'requestType',
] as const;

/** Submissions accepted from one address per window before further ones are refused. */
const RATE_LIMIT_MAX = Number(process.env.CONTACT_RATE_LIMIT_MAX || 5);
const RATE_LIMIT_WINDOW_MS = Number(process.env.CONTACT_RATE_LIMIT_WINDOW_MS || 15 * 60 * 1_000);

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function text(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function parseType(value: unknown): ContactSubmissionType | null {
  const candidate = String(value ?? '').toUpperCase();
  return (Object.values(ContactSubmissionType) as string[]).includes(candidate)
    ? (candidate as ContactSubmissionType)
    : null;
}

/**
 * A submission the form itself would have rejected is almost always a bot, and
 * the reasons are returned per field so a legitimate sender with JavaScript
 * disabled still learns what to fix.
 */
function validate(body: Record<string, unknown>) {
  const errors: Record<string, string> = {};
  const firstName = text(body.firstName, LIMITS.name);
  const lastName = text(body.lastName, LIMITS.name);
  const email = text(body.email, LIMITS.email).toLowerCase();
  const message = text(body.message, LIMITS.message);

  if (!firstName) errors.firstName = 'This field is required.';
  if (!lastName) errors.lastName = 'This field is required.';
  if (!email) errors.email = 'This field is required.';
  else if (!EMAIL_PATTERN.test(email)) errors.email = 'Enter a valid email address.';
  if (!message) errors.message = 'Tell us briefly what you need help with.';
  else if (message.length < MIN_MESSAGE_LENGTH) {
    errors.message = 'Add a little more detail so we can route this correctly.';
  }

  return { errors, firstName, lastName, email, message };
}

export function createContactRouter(deps: {
  prisma: PrismaClient;
  emailService: NotificationEmailService;
}): Router {
  const router = Router();
  const { prisma, emailService } = deps;

  router.post('/contact', async (req: Request, res: Response) => {
    const body = (req.body ?? {}) as Record<string, unknown>;

    // Honeypot. Answered with the same success shape a real submission gets so
    // a bot cannot learn which field gave it away. Named to match the form's
    // hidden input, which deliberately avoids `website` — the partnership route
    // asks for that one for real.
    if (text(body.referralCode, LIMITS.detail)) {
      return res.status(202).json({ status: 'RECEIVED' });
    }

    const type = parseType(body.type);
    if (!type) {
      return res.status(400).json({ error: 'CONTACT_TYPE_INVALID', message: 'Choose what your message is about.' });
    }

    const { errors, firstName, lastName, email, message } = validate(body);
    if (Object.keys(errors).length) {
      return res.status(400).json({ error: 'CONTACT_VALIDATION_FAILED', fields: errors });
    }

    const ipHash = req.ip ? sha256(req.ip) : null;
    if (ipHash) {
      const recent = await prisma.contactSubmission.count({
        where: { ipHash, createdAt: { gt: new Date(Date.now() - RATE_LIMIT_WINDOW_MS) } },
      });
      if (recent >= RATE_LIMIT_MAX) {
        return res.status(429).json({
          error: 'CONTACT_RATE_LIMITED',
          message: 'You have sent several messages already. Give us a moment to reply to those first.',
        });
      }
    }

    const details: Record<string, string> = {};
    for (const field of DETAIL_FIELDS) {
      const value = text(body[field], LIMITS.detail);
      if (value) details[field] = value;
    }

    try {
      const submission = await prisma.contactSubmission.create({
        data: {
          type,
          firstName,
          lastName,
          email,
          organization: text(body.organization, LIMITS.organization) || null,
          subject: text(body.subject, LIMITS.subject) || null,
          message,
          details,
          ipHash,
          userAgent: String(req.headers['user-agent'] ?? '').slice(0, 500) || null,
        },
      });

      const recipient = notificationRecipient();
      if (recipient) {
        // Delivery is not part of the sender's success: the message is already
        // stored, and failing their submission because our own mail provider
        // is down would lose it for no reason.
        void emailService
          .sendTransactional({
            templateKey: 'contact-submission',
            to: recipient,
            eventType: 'CONTACT_SUBMISSION',
            severity: 'INFO',
            // Replies go to the person who wrote in, not to Tellann.
            replyTo: email,
            variables: {
              contactType: type,
              senderName: `${firstName} ${lastName}`,
              senderEmail: email,
              organization: submission.organization ?? 'Not given',
              subject: submission.subject ?? 'Not given',
              messageBody: message,
              details: Object.entries(details).map(([key, value]) => `${key}: ${value}`).join('\n') || 'None',
              replyUrl: `mailto:${email}`,
            },
            idempotencyKey: buildIdempotencyKey(['contact-submission', submission.id]),
          })
          .then((result) => {
            if (result.status === 'SENT') {
              return prisma.contactSubmission.update({
                where: { id: submission.id },
                data: { notifiedAt: new Date() },
              });
            }
            console.warn(`[Contact] Notification not sent for ${submission.id}: ${result.skippedReason ?? result.status}`);
            return null;
          })
          .catch((err) => console.error('[Contact] Notification failed', err));
      } else {
        console.warn('[Contact] CONTACT_NOTIFICATION_EMAIL is not set — submission stored without notifying anyone.');
      }

      return res.status(201).json({ status: 'RECEIVED', id: submission.id });
    } catch (err) {
      console.error('[Contact] Failed to store submission', err);
      return res.status(500).json({
        error: 'CONTACT_STORE_FAILED',
        message: 'We could not record your message. Please try again shortly.',
      });
    }
  });

  return router;
}
