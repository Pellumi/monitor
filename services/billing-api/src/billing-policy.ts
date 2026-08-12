import crypto from 'crypto';
import { BillingCurrency, BillingInterval, PlanType, PrismaClient } from '@sots/db';

export type LiveBillingProvider = 'PAYSTACK' | 'STRIPE';

function enabled(name: string, fallback: boolean): boolean {
  const value = process.env[name];
  if (value == null) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

export const billingPolicy = {
  primaryProvider: (process.env.BILLING_PRIMARY_PROVIDER || 'PAYSTACK').toUpperCase() as LiveBillingProvider,
  stripeCheckoutFallbackEnabled: enabled('BILLING_STRIPE_CHECKOUT_FALLBACK_ENABLED', false),
  stripeRenewalFallbackEnabled: false,
  paystackUsdEnabled: enabled('BILLING_PAYSTACK_USD_ENABLED', false),
  environment: process.env.BILLING_CATALOG_ENV || (process.env.NODE_ENV === 'production' ? 'production' : 'test'),
};

export function currencyForCountry(countryCode?: string | null): BillingCurrency {
  return countryCode?.toUpperCase() === 'NG' ? BillingCurrency.NGN : BillingCurrency.USD;
}

export function checkoutProviders(currency: BillingCurrency): LiveBillingProvider[] {
  if (currency === BillingCurrency.USD && !billingPolicy.paystackUsdEnabled) return ['STRIPE'];
  const providers: LiveBillingProvider[] = [billingPolicy.primaryProvider];
  if (billingPolicy.stripeCheckoutFallbackEnabled && !providers.includes('STRIPE')) providers.push('STRIPE');
  return providers;
}

export async function providerPlanCode(
  prisma: PrismaClient,
  provider: LiveBillingProvider,
  planType: PlanType,
  interval: BillingInterval,
  currency: BillingCurrency,
): Promise<string | null> {
  const row = await prisma.billingProviderPlan.findFirst({
    where: {
      provider,
      planType,
      billingInterval: interval,
      currency,
      environment: billingPolicy.environment,
      active: true,
    },
    orderBy: { version: 'desc' },
  });
  if (row) return row.providerPlanCode;
  const key = `${provider === 'STRIPE' ? 'STRIPE_PRICE_ID' : 'PAYSTACK_PLAN_CODE'}_${planType}_${interval}_${currency}`;
  return process.env[key]?.trim() || null;
}

export function previewExpiry(from = new Date()): Date {
  return new Date(from.getTime() + 15 * 60_000);
}

export function proratedDifference(params: {
  currentPrice: number;
  targetPrice: number;
  periodStart: Date;
  periodEnd: Date;
  at: Date;
}): { amountDue: number; creditAmount: number } {
  const duration = Math.max(1, params.periodEnd.getTime() - params.periodStart.getTime());
  const remaining = Math.max(0, Math.min(1, (params.periodEnd.getTime() - params.at.getTime()) / duration));
  const difference = Math.round((params.targetPrice - params.currentPrice) * remaining);
  return {
    amountDue: Math.max(0, difference),
    creditAmount: Math.max(0, -difference),
  };
}

export function validateProviderPayment(params: {
  eventCurrency: BillingCurrency | null;
  invoiceCurrency: BillingCurrency;
  eventAmountMinor: number | null;
  invoiceTotal: number;
  eventPlanType: PlanType | null;
  invoicePlanType: PlanType;
}): void {
  if (params.eventCurrency && params.eventCurrency !== params.invoiceCurrency) {
    throw new Error(`PAYMENT_CURRENCY_MISMATCH:${params.eventCurrency}:${params.invoiceCurrency}`);
  }
  if (params.eventAmountMinor !== null && params.eventAmountMinor !== params.invoiceTotal) {
    throw new Error(`PAYMENT_AMOUNT_MISMATCH:${params.eventAmountMinor}:${params.invoiceTotal}`);
  }
  if (params.eventPlanType && params.eventPlanType !== params.invoicePlanType) {
    throw new Error(`PAYMENT_PLAN_MISMATCH:${params.eventPlanType}:${params.invoicePlanType}`);
  }
}

export function sealPaymentReference(value: string): string {
  const keyMaterial = process.env.BILLING_ENCRYPTION_KEY;
  if (!keyMaterial) throw new Error('BILLING_ENCRYPTION_KEY is required to store recurring payment authorization');
  const key = crypto.createHash('sha256').update(keyMaterial).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), encrypted.toString('base64url')].join('.');
}

export function openPaymentReference(value: string): string {
  const keyMaterial = process.env.BILLING_ENCRYPTION_KEY;
  if (!keyMaterial) throw new Error('BILLING_ENCRYPTION_KEY is required to use recurring payment authorization');
  const [version, iv, tag, encrypted] = value.split('.');
  if (version !== 'v1' || !iv || !tag || !encrypted) throw new Error('Invalid payment authorization envelope');
  const key = crypto.createHash('sha256').update(keyMaterial).digest();
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(encrypted, 'base64url')), decipher.final()]).toString('utf8');
}
