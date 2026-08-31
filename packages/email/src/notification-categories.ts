import { EmailCategory, NotificationFrequency } from '@tellann/db';
import { builtinTemplates } from './templates';

/**
 * What each notification category can actually do.
 *
 * The settings UI is rendered from this, so a user is never offered a control
 * that nothing acts on. Both the API (when validating a preference update) and
 * the digest workers read the same descriptors, so the three cannot drift.
 */
export interface CategoryCapability {
  category: EmailCategory;
  label: string;
  description: string;
  /** Has at least one email template, so the email toggle does something. */
  emailSupported: boolean;
  /**
   * Delivery is required and cannot be switched off. These are the messages a
   * user must receive to operate the account safely or lawfully.
   */
  emailLocked: boolean;
  /**
   * Surfaced in the in-app feed and as a browser notification. Every category
   * can be, and all are user-controllable: email remains the guaranteed channel
   * for the locked categories, so silencing their in-app copy is safe.
   */
  inAppSupported: boolean;
  /**
   * Whether batching into a digest is meaningful. Transactional messages —
   * a sign-in from a new device, an invite, a receipt — are only useful at the
   * moment they happen, so they are never batchable.
   */
  batchable: boolean;
  defaultFrequency: NotificationFrequency;
}

/**
 * Categories the user may never switch off: account security, anything with
 * money attached, and regulatory notices.
 */
export const ALWAYS_ON_CATEGORIES: ReadonlySet<EmailCategory> = new Set([
  EmailCategory.SECURITY,
  EmailCategory.BILLING,
  EmailCategory.COMPLIANCE,
]);

/**
 * Categories whose messages summarise a period rather than report a single
 * moment, so collecting them into a digest still makes sense.
 */
export const BATCHABLE_CATEGORIES: ReadonlySet<EmailCategory> = new Set([
  EmailCategory.ALERTS,
  EmailCategory.REPORTS,
  EmailCategory.DIGEST,
]);

const CATEGORY_COPY: Record<EmailCategory, { label: string; description: string }> = {
  [EmailCategory.SECURITY]: {
    label: 'Security',
    description: 'Sign-in codes and new device alerts. Always delivered.',
  },
  [EmailCategory.BILLING]: {
    label: 'Billing',
    description: 'Receipts, payment failures and plan changes. Always delivered.',
  },
  [EmailCategory.COMPLIANCE]: {
    label: 'Compliance',
    description: 'Privacy and data handling notices. Always delivered.',
  },
  [EmailCategory.ACCOUNT]: {
    label: 'Account',
    description: 'Changes to your account details.',
  },
  [EmailCategory.ONBOARDING]: {
    label: 'Onboarding',
    description: 'Setup guidance while you connect your first application.',
  },
  [EmailCategory.TEAM]: {
    label: 'Team',
    description: 'Invitations and API key activity in your organisation.',
  },
  [EmailCategory.REPORTS]: {
    label: 'Reports',
    description: 'Reconciliation reports and export downloads.',
  },
  [EmailCategory.ALERTS]: {
    label: 'Alerts',
    description: 'Coverage drops, missing critical flows and slow endpoints.',
  },
  [EmailCategory.DIGEST]: {
    label: 'Digest',
    description: 'A periodic summary of activity across your applications.',
  },
  [EmailCategory.PRODUCT_EDUCATION]: {
    label: 'Product education',
    description: 'Tips and new feature announcements.',
  },
};

/** Categories that have at least one registered template. */
const CATEGORIES_WITH_TEMPLATES: ReadonlySet<EmailCategory> = new Set(
  builtinTemplates.map((template) => template.category),
);

function defaultFrequencyFor(category: EmailCategory): NotificationFrequency {
  if (category === EmailCategory.DIGEST) return NotificationFrequency.WEEKLY_DIGEST;
  return NotificationFrequency.IMMEDIATE;
}

export function capabilityFor(category: EmailCategory): CategoryCapability {
  const copy = CATEGORY_COPY[category];
  return {
    category,
    label: copy.label,
    description: copy.description,
    // DIGEST is produced by the digest workers rather than a builtin template,
    // so it is supported even though no template declares that category.
    emailSupported:
      CATEGORIES_WITH_TEMPLATES.has(category) || category === EmailCategory.DIGEST,
    emailLocked: ALWAYS_ON_CATEGORIES.has(category),
    inAppSupported: true,
    batchable: BATCHABLE_CATEGORIES.has(category),
    defaultFrequency: defaultFrequencyFor(category),
  };
}

/** Every category the product actually delivers something for. */
export function listCapabilities(): CategoryCapability[] {
  return Object.values(EmailCategory)
    .map(capabilityFor)
    .filter((capability) => capability.emailSupported || capability.inAppSupported);
}

/**
 * Coerces a requested frequency to one the category can honour. A transactional
 * category is always IMMEDIATE — offering a digest there would silently delay
 * mail the user needs at once.
 */
export function normalizeFrequency(
  category: EmailCategory,
  requested: NotificationFrequency,
): NotificationFrequency {
  if (BATCHABLE_CATEGORIES.has(category)) return requested;
  return requested === NotificationFrequency.NEVER
    ? NotificationFrequency.NEVER
    : NotificationFrequency.IMMEDIATE;
}

/** True when the frequency defers delivery to a digest run rather than sending now. */
export function isDigestFrequency(frequency: NotificationFrequency): boolean {
  return (
    frequency === NotificationFrequency.DAILY_DIGEST ||
    frequency === NotificationFrequency.WEEKLY_DIGEST
  );
}

/**
 * The organisation contact address each category is delivered to, when one is
 * configured on OrganizationSettings.
 *
 * A category listed here stops fanning out to every member and goes to the one
 * mailbox the organisation nominated; a category absent from the map always
 * goes to the members themselves. Only organisation-level mail is routable —
 * an OTP, a new-device alert or an invitation is addressed to one person and is
 * sent directly rather than through the organisation broadcast, so nothing in
 * this map can redirect it away from them.
 */
export const CATEGORY_CONTACT_FIELD: Partial<Record<EmailCategory, OrganizationContactField>> = {
  [EmailCategory.BILLING]: 'billingContactEmail',
  [EmailCategory.ALERTS]: 'technicalContactEmail',
  [EmailCategory.SECURITY]: 'securityContactEmail',
  [EmailCategory.COMPLIANCE]: 'securityContactEmail',
};

/** The OrganizationSettings columns that hold a routable contact address. */
export type OrganizationContactField =
  | 'billingContactEmail'
  | 'technicalContactEmail'
  | 'securityContactEmail';

/** The contact column a category routes to, or null when it fans out to members. */
export function contactFieldFor(category: EmailCategory): OrganizationContactField | null {
  return CATEGORY_CONTACT_FIELD[category] ?? null;
}
