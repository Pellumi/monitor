import axios, { AxiosInstance } from 'axios';
import crypto from 'crypto';

let _paystackHttp: AxiosInstance | null = null;
function getPaystackHttp(): AxiosInstance {
  if (!_paystackHttp) {
    const key = process.env.PAYSTACK_SECRET_KEY;
    if (!key) {
      throw new Error(
        '[BillingAPI] PAYSTACK_SECRET_KEY is not set. ' +
        'Configure it in .env to use Paystack, or use provider=MOCK for local development.'
      );
    }
    _paystackHttp = axios.create({
      baseURL: 'https://api.paystack.co',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      timeout: 15_000,
    });
  }
  return _paystackHttp;
}

export interface PaystackInitParams {
  email: string;
  amountKobo: number; // Paystack always takes amount in lowest currency unit (kobo for NGN, cents for USD)
  currency: string;   // e.g. 'NGN', 'USD', 'GHS'
  reference: string;  // Your unique idempotency reference
  organizationId: string;
  planCode?: string;  // Paystack plan code for recurring billing
  metadata?: Record<string, unknown>;
  callbackUrl?: string;
}

export interface PaystackInitResult {
  authorizationUrl: string;
  accessCode: string;
  reference: string;
}

export interface PaystackVerifyResult {
  status: 'success' | 'failed' | 'abandoned';
  reference: string;
  amount: number;
  currency: string;
  paidAt: string | null;
  channel: string;
  customerEmail: string;
  customerCode: string;
  subscriptionCode: string | null;
  authorizationCode: string | null;
  metadata: Record<string, unknown>;
}

export interface PaystackSubscriptionResult {
  subscriptionCode: string;
  emailToken: string | null;
  nextPaymentDate: string | null;
}

export interface PaystackChargeResult {
  status: 'success' | 'failed' | 'pending';
  reference: string;
  authorizationUrl: string | null;
}

/**
 * Initializes a Paystack transaction.
 * Returns the authorization URL to redirect the customer to.
 */
export async function initializeTransaction(
  params: PaystackInitParams,
): Promise<PaystackInitResult> {
  const payload: Record<string, unknown> = {
    email: params.email,
    amount: params.amountKobo,
    currency: params.currency,
    reference: params.reference,
    callback_url:
      params.callbackUrl ??
      process.env.PAYSTACK_SUCCESS_URL ??
      'https://app.tellann.co/settings/billing?success=1',
    metadata: {
      organizationId: params.organizationId,
      ...(params.metadata ?? {}),
    },
  };
  if (params.planCode) {
    payload['plan'] = params.planCode;
  }

  const { data } = await getPaystackHttp().post('/transaction/initialize', payload);
  if (!data.status) {
    throw new Error(`Paystack initialization failed: ${data.message}`);
  }

  return {
    authorizationUrl: data.data.authorization_url,
    accessCode: data.data.access_code,
    reference: data.data.reference,
  };
}

/**
 * Verifies a Paystack transaction by reference.
 * Call this after the customer is redirected back or in a webhook handler.
 */
export async function verifyTransaction(reference: string): Promise<PaystackVerifyResult> {
  const { data } = await getPaystackHttp().get(`/transaction/verify/${encodeURIComponent(reference)}`);
  if (!data.status) {
    throw new Error(`Paystack verification failed: ${data.message}`);
  }

  const tx = data.data;
  return {
    status: tx.status,
    reference: tx.reference,
    amount: tx.amount,
    currency: tx.currency,
    paidAt: tx.paid_at ?? null,
    channel: tx.channel,
    customerEmail: tx.customer?.email ?? '',
    customerCode: tx.customer?.customer_code ?? '',
    subscriptionCode: tx.subscription?.subscription_code ?? null,
    authorizationCode: tx.authorization?.authorization_code ?? null,
    metadata: tx.metadata ?? {},
  };
}

/**
 * Verifies a Paystack webhook HMAC-SHA512 signature.
 * Call this BEFORE processing any webhook payload.
 * Returns true if the signature is valid, false otherwise.
 */
export function verifyPaystackWebhook(rawBody: Buffer, signature: string): boolean {
  const secret = process.env.PAYSTACK_WEBHOOK_SECRET ?? process.env.PAYSTACK_SECRET_KEY!;
  if (!secret) {
    console.error('[Paystack] PAYSTACK_WEBHOOK_SECRET or PAYSTACK_SECRET_KEY not configured');
    return false;
  }
  const expected = crypto
    .createHmac('sha512', secret)
    .update(rawBody)
    .digest('hex');
  const expectedBuffer = Buffer.from(expected, 'hex');
  const signatureBuffer = Buffer.from(signature, 'hex');
  if (expectedBuffer.length !== signatureBuffer.length) return false;
  return crypto.timingSafeEqual(expectedBuffer, signatureBuffer);
}

/**
 * Lists Paystack subscription details for a given customer.
 */
export async function getSubscription(subscriptionCode: string): Promise<Record<string, unknown>> {
  const { data } = await getPaystackHttp().get(`/subscription/${encodeURIComponent(subscriptionCode)}`);
  if (!data.status) {
    throw new Error(`Paystack getSubscription failed: ${data.message}`);
  }
  return data.data;
}

export async function createSubscription(params: {
  customer: string;
  planCode: string;
  authorizationCode?: string | null;
  startDate?: Date | null;
}): Promise<PaystackSubscriptionResult> {
  const payload: Record<string, unknown> = {
    customer: params.customer,
    plan: params.planCode,
  };
  if (params.authorizationCode) payload.authorization = params.authorizationCode;
  if (params.startDate) payload.start_date = params.startDate.toISOString();
  const { data } = await getPaystackHttp().post('/subscription', payload);
  if (!data.status) throw new Error(`Paystack create subscription failed: ${data.message}`);
  return {
    subscriptionCode: data.data.subscription_code,
    emailToken: data.data.email_token ?? null,
    nextPaymentDate: data.data.next_payment_date ?? null,
  };
}

export async function disableSubscription(subscriptionCode: string, emailToken: string): Promise<void> {
  const { data } = await getPaystackHttp().post('/subscription/disable', {
    code: subscriptionCode,
    token: emailToken,
  });
  if (!data.status) throw new Error(`Paystack disable subscription failed: ${data.message}`);
}

export async function enableSubscription(subscriptionCode: string, emailToken: string): Promise<void> {
  const { data } = await getPaystackHttp().post('/subscription/enable', {
    code: subscriptionCode,
    token: emailToken,
  });
  if (!data.status) throw new Error(`Paystack enable subscription failed: ${data.message}`);
}

export async function chargeAuthorization(params: {
  authorizationCode: string;
  email: string;
  amount: number;
  currency: string;
  reference: string;
  metadata?: Record<string, unknown>;
}): Promise<PaystackChargeResult> {
  const { data } = await getPaystackHttp().post('/transaction/charge_authorization', {
    authorization_code: params.authorizationCode,
    email: params.email,
    amount: params.amount,
    currency: params.currency,
    reference: params.reference,
    metadata: params.metadata,
  });
  if (!data.status) throw new Error(`Paystack authorization charge failed: ${data.message}`);
  return {
    status: data.data.status,
    reference: data.data.reference,
    authorizationUrl: data.data.authorization_url ?? null,
  };
}
