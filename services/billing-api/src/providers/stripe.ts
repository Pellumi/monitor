import Stripe from 'stripe';

// Lazy-initialise: do NOT call `new Stripe()` at module load time because it
// throws if STRIPE_SECRET_KEY is absent, crashing the entire billing-api even
// when all billing flows use MOCK or PAYSTACK.
let _stripe: Stripe | null = null;
function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error(
        '[BillingAPI] STRIPE_SECRET_KEY is not set. ' +
        'Configure it in .env to use Stripe, or use provider=MOCK for local development.',
      );
    }
    _stripe = new Stripe(key, {
      apiVersion: '2026-05-27.dahlia' as any,
      telemetry: false,
    });
  }
  return _stripe;
}

export interface StripeCheckoutParams {
  planStripeProductId: string;
  planStripePriceId: string;
  interval: 'MONTHLY' | 'ANNUAL';
  currency: string;
  organizationId: string;
  customerEmail: string;
  existingStripeCustomerId?: string | null;
  metadata?: Record<string, string>;
  successUrl?: string;
  cancelUrl?: string;
}

export interface StripeCheckoutResult {
  checkoutUrl: string;
  sessionId: string;
  customerId: string;
}

/**
 * Creates a Stripe Checkout Session.
 * Returns the hosted checkout URL.
 * The org is billed only after webhook confirmation (invoice.payment_succeeded).
 */
export async function createCheckoutSession(
  params: StripeCheckoutParams,
): Promise<StripeCheckoutResult> {
  // Upsert the Stripe customer to avoid duplicates
  let customerId = params.existingStripeCustomerId ?? undefined;
  if (!customerId) {
    const customer = await getStripe().customers.create({
      email: params.customerEmail,
      metadata: { organizationId: params.organizationId },
    });
    customerId = customer.id;
  }

  const session = await getStripe().checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [
      {
        price: params.planStripePriceId,
        quantity: 1,
      },
    ],
    success_url:
      params.successUrl ??
      process.env.STRIPE_SUCCESS_URL ??
      'https://app.tellann.co/settings/billing?success=1',
    cancel_url:
      params.cancelUrl ??
      process.env.STRIPE_CANCEL_URL ??
      'https://app.tellann.co/settings/billing?cancelled=1',
    subscription_data: {
      metadata: {
        organizationId: params.organizationId,
        ...(params.metadata ?? {}),
      },
    },
    metadata: {
      organizationId: params.organizationId,
      ...(params.metadata ?? {}),
    },
    allow_promotion_codes: true,
    billing_address_collection: 'auto',
  });

  if (!session.url) {
    throw new Error('Stripe checkout session has no URL');
  }

  return {
    checkoutUrl: session.url,
    sessionId: session.id,
    customerId,
  };
}

/**
 * Verifies a Stripe webhook signature and returns the parsed event.
 * Throws if the signature is invalid or the raw body is missing.
 */
export function verifyStripeWebhook(
  rawBody: Buffer,
  signature: string,
): Stripe.Event {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;
  if (!webhookSecret) {
    throw new Error('STRIPE_WEBHOOK_SECRET is not configured');
  }
  // constructEvent throws if the signature is invalid
  return getStripe().webhooks.constructEvent(rawBody, signature, webhookSecret);
}

/**
 * Creates or retrieves a Stripe customer for an organization.
 * Use when a subscription needs updating without a checkout session.
 */
export async function ensureStripeCustomer(
  organizationId: string,
  email: string,
  existingCustomerId?: string | null,
): Promise<string> {
  if (existingCustomerId) return existingCustomerId;
  const customer = await getStripe().customers.create({
    email,
    metadata: { organizationId },
  });
  return customer.id;
}

/**
 * Retrieves a Stripe invoice object (for receipt generation).
 */
export async function getStripeInvoice(invoiceId: string): Promise<Stripe.Invoice> {
  return getStripe().invoices.retrieve(invoiceId);
}
