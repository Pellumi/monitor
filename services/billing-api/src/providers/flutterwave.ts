import axios, { AxiosInstance } from 'axios';
import crypto from 'crypto';

let http: AxiosInstance | null = null;

function client(): AxiosInstance {
  if (!http) {
    const key = process.env.FLUTTERWAVE_SECRET_KEY?.trim();
    if (!key) throw new Error('FLUTTERWAVE_SECRET_KEY is not configured');
    http = axios.create({
      baseURL: 'https://api.flutterwave.com/v3',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      timeout: 15_000,
    });
  }
  return http;
}

export interface FlutterwaveCheckoutParams {
  txRef: string;
  amount: number;
  currency: string;
  customerEmail: string;
  customerName?: string | null;
  organizationId: string;
  planCode: string;
  redirectUrl?: string;
  metadata?: Record<string, unknown>;
}

export async function createFlutterwaveCheckout(params: FlutterwaveCheckoutParams) {
  const { data } = await client().post('/payments', {
    tx_ref: params.txRef,
    amount: (params.amount / 100).toFixed(2),
    currency: params.currency,
    redirect_url: params.redirectUrl ?? process.env.FLUTTERWAVE_SUCCESS_URL,
    payment_plan: params.planCode,
    payment_options: 'card,googlepay,applepay',
    customer: { email: params.customerEmail, name: params.customerName || undefined },
    meta: { organizationId: params.organizationId, ...(params.metadata ?? {}) },
    customizations: { title: 'Tellann subscription', description: 'Tellann recurring subscription' },
  });
  if (data?.status !== 'success' || !data?.data?.link) {
    throw new Error(`Flutterwave checkout initialization failed: ${data?.message ?? 'unknown response'}`);
  }
  return { checkoutUrl: String(data.data.link), reference: params.txRef };
}

export async function verifyFlutterwaveTransaction(transactionId: string) {
  const { data } = await client().get(`/transactions/${encodeURIComponent(transactionId)}/verify`);
  if (data?.status !== 'success' || !data?.data) throw new Error(`Flutterwave verification failed: ${data?.message ?? 'unknown response'}`);
  const tx = data.data;
  return {
    id: String(tx.id),
    reference: String(tx.tx_ref ?? ''),
    status: String(tx.status ?? '').toLowerCase(),
    amountMinor: Math.round(Number(tx.amount ?? tx.charged_amount ?? 0) * 100),
    currency: String(tx.currency ?? '').toUpperCase(),
    customerId: tx.customer?.id ? String(tx.customer.id) : null,
    customerEmail: String(tx.customer?.email ?? ''),
    paymentType: String(tx.payment_type ?? ''),
    card: tx.card ? {
      brand: String(tx.card.type ?? ''), last4: String(tx.card.last_4digits ?? ''),
      expMonth: String(tx.card.expiry?.split('/')?.[0] ?? ''), expYear: String(tx.card.expiry?.split('/')?.[1] ?? ''),
    } : null,
    meta: (tx.meta ?? {}) as Record<string, unknown>,
  };
}

export function verifyFlutterwaveWebhook(rawBody: Buffer, headers: Record<string, unknown>): boolean {
  const secretHash = process.env.FLUTTERWAVE_SECRET_HASH?.trim();
  if (!secretHash) return false;
  const legacy = String(headers['verif-hash'] ?? '');
  if (legacy) {
    const a = Buffer.from(legacy); const b = Buffer.from(secretHash);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }
  const signature = String(headers['flutterwave-signature'] ?? '');
  if (!signature) return false;
  const expected = crypto.createHmac('sha256', secretHash).update(rawBody).digest('base64');
  const a = Buffer.from(signature); const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function cancelFlutterwaveSubscription(subscriptionId: string): Promise<void> {
  const { data } = await client().put(`/subscriptions/${encodeURIComponent(subscriptionId)}/cancel`);
  if (data?.status !== 'success') throw new Error(`Flutterwave cancellation failed: ${data?.message ?? 'unknown response'}`);
}

export async function activateFlutterwaveSubscription(subscriptionId: string): Promise<void> {
  const { data } = await client().put(`/subscriptions/${encodeURIComponent(subscriptionId)}/activate`);
  if (data?.status !== 'success') throw new Error(`Flutterwave resumption failed: ${data?.message ?? 'unknown response'}`);
}
