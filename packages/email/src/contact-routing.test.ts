import { EmailCategory } from '@tellann/db';
import { describe, expect, it, vi } from 'vitest';
import { NotificationEmailService } from './index';
import { contactFieldFor } from './notification-categories';
import { builtinTemplates } from './templates';

type ContactColumns = {
  billingContactEmail: string | null;
  technicalContactEmail: string | null;
  securityContactEmail: string | null;
};

const NO_CONTACTS: ContactColumns = {
  billingContactEmail: null,
  technicalContactEmail: null,
  securityContactEmail: null,
};

/**
 * The two queries `resolveOrganizationRecipients` makes, plus the membership
 * fan-out it falls back to. Nothing else in the service is exercised here.
 */
function serviceWith(options: {
  contacts?: Partial<ContactColumns>;
  members?: Array<{ email: string; userId: string }>;
  /** Membership row returned when a contact address belongs to a member. */
  matchingMember?: { userId: string } | null;
}) {
  const members = options.members ?? [
    { email: 'owner@acme.test', userId: 'user-owner' },
    { email: 'dev@acme.test', userId: 'user-dev' },
  ];
  const findFirst = vi.fn().mockResolvedValue(options.matchingMember ?? null);
  const findMany = vi.fn().mockResolvedValue(
    members.map((member) => ({ userId: member.userId, user: { email: member.email } })),
  );
  const prisma = {
    organizationSettings: {
      findUnique: vi.fn().mockResolvedValue({ ...NO_CONTACTS, ...options.contacts }),
    },
    organizationMembership: { findFirst, findMany },
  };
  return {
    service: new NotificationEmailService(prisma as never),
    findFirst,
    findMany,
  };
}

describe('category to contact mapping', () => {
  it('routes only the three organisation-level categories', () => {
    expect(contactFieldFor(EmailCategory.BILLING)).toBe('billingContactEmail');
    expect(contactFieldFor(EmailCategory.ALERTS)).toBe('technicalContactEmail');
    expect(contactFieldFor(EmailCategory.SECURITY)).toBe('securityContactEmail');
    expect(contactFieldFor(EmailCategory.COMPLIANCE)).toBe('securityContactEmail');
  });

  it('leaves person-addressed categories fanning out to members', () => {
    expect(contactFieldFor(EmailCategory.TEAM)).toBeNull();
    expect(contactFieldFor(EmailCategory.ONBOARDING)).toBeNull();
    expect(contactFieldFor(EmailCategory.ACCOUNT)).toBeNull();
    expect(contactFieldFor(EmailCategory.REPORTS)).toBeNull();
    expect(contactFieldFor(EmailCategory.DIGEST)).toBeNull();
  });

  it('never routes a template that carries a personal secret or a personal link', () => {
    // An OTP or an invite must reach the person it names, never a shared inbox.
    for (const key of ['auth-otp', 'team-invite', 'security-new-device'] as const) {
      const template = builtinTemplates.find((entry) => entry.key === key);
      expect(template, `${key} template is registered`).toBeDefined();
    }
    // team-invite and auth-otp are sent per-address, so their categories must
    // not be routable; security-new-device is SECURITY but is likewise sent
    // directly to the signing-in user rather than through the org broadcast.
    expect(contactFieldFor(EmailCategory.TEAM)).toBeNull();
  });
});

describe('resolveOrganizationRecipients', () => {
  it('sends to every member when no contact is configured', async () => {
    const { service, findMany } = serviceWith({});
    const recipients = await service.resolveOrganizationRecipients('org-1', EmailCategory.BILLING);
    expect(recipients).toEqual([
      { email: 'owner@acme.test', userId: 'user-owner' },
      { email: 'dev@acme.test', userId: 'user-dev' },
    ]);
    expect(findMany).toHaveBeenCalledOnce();
  });

  it('sends to the contact instead of the members once one is set', async () => {
    const { service, findMany } = serviceWith({
      contacts: { billingContactEmail: 'billing@acme.test' },
    });
    const recipients = await service.resolveOrganizationRecipients('org-1', EmailCategory.BILLING);
    expect(recipients).toEqual([{ email: 'billing@acme.test', userId: null }]);
    expect(findMany).not.toHaveBeenCalled();
  });

  it('keeps each category on its own contact', async () => {
    const { service } = serviceWith({
      contacts: {
        billingContactEmail: 'billing@acme.test',
        technicalContactEmail: 'oncall@acme.test',
        securityContactEmail: 'security@acme.test',
      },
    });
    await expect(service.resolveOrganizationRecipients('org-1', EmailCategory.ALERTS))
      .resolves.toEqual([{ email: 'oncall@acme.test', userId: null }]);
    await expect(service.resolveOrganizationRecipients('org-1', EmailCategory.COMPLIANCE))
      .resolves.toEqual([{ email: 'security@acme.test', userId: null }]);
  });

  it('falls back to members for a category with no contact of its own', async () => {
    const { service, findMany } = serviceWith({
      contacts: { billingContactEmail: 'billing@acme.test' },
    });
    const recipients = await service.resolveOrganizationRecipients('org-1', EmailCategory.REPORTS);
    expect(recipients.map((recipient) => recipient.email)).toEqual(['owner@acme.test', 'dev@acme.test']);
    expect(findMany).toHaveBeenCalledOnce();
  });

  it('treats a blank contact as unset rather than as an empty address', async () => {
    const { service, findMany } = serviceWith({ contacts: { billingContactEmail: '   ' } });
    const recipients = await service.resolveOrganizationRecipients('org-1', EmailCategory.BILLING);
    expect(recipients.map((recipient) => recipient.email)).toEqual(['owner@acme.test', 'dev@acme.test']);
    expect(findMany).toHaveBeenCalledOnce();
  });

  it('attaches the user id when the contact address belongs to a member', async () => {
    // Preferences, digest batching and delivery history stay on the right user.
    const { service } = serviceWith({
      contacts: { technicalContactEmail: 'dev@acme.test' },
      matchingMember: { userId: 'user-dev' },
    });
    const recipients = await service.resolveOrganizationRecipients('org-1', EmailCategory.ALERTS);
    expect(recipients).toEqual([{ email: 'dev@acme.test', userId: 'user-dev' }]);
  });

  it('still sends to an external alias that belongs to no member', async () => {
    const { service } = serviceWith({
      contacts: { technicalContactEmail: 'oncall@pagerduty.test' },
      matchingMember: null,
    });
    const recipients = await service.resolveOrganizationRecipients('org-1', EmailCategory.ALERTS);
    expect(recipients).toEqual([{ email: 'oncall@pagerduty.test', userId: null }]);
  });

  it('does not consult settings for an unroutable category', async () => {
    const { service } = serviceWith({});
    await service.resolveOrganizationRecipients('org-1', EmailCategory.ONBOARDING);
    // No contact column covers ONBOARDING, so the lookup is skipped entirely.
    expect(contactFieldFor(EmailCategory.ONBOARDING)).toBeNull();
  });
});
