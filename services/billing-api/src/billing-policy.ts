import crypto from 'crypto';
import { BillingCurrency, BillingInterval, PlanType, PrismaClient } from '@tellann/db';

/**
 * Live payment processors. Stripe was retired on 2026-08-31: USD now settles
 * through Flutterwave, which covers the same card networks plus Google Pay and
 * Apple Pay, and avoids maintaining a second recurring-billing integration for
 * a single currency.
 */
export type LiveBillingProvider = 'PAYSTACK' | 'FLUTTERWAVE';

function enabled(name: string, fallback: boolean): boolean {
  const value = process.env[name];
  if (value == null) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

/**
 * Whether the configured provider credentials are live or test keys. Provider
 * plan codes are mode-scoped — a test-mode key can never charge against a
 * live-mode plan code — so the BillingProviderPlan catalog is partitioned the
 * same way and must be read with the matching environment.
 */
export function providerKeyMode(): 'production' | 'test' | 'unknown' {
  const keys = [
    process.env.PAYSTACK_SECRET_KEY,
    process.env.FLUTTERWAVE_SECRET_KEY,
  ].filter((key): key is string => Boolean(key?.trim()));
  if (!keys.length) return 'unknown';
  const anyTest = keys.some((key) => /(^sk_test_)|(_TEST)|(^FLWSECK_TEST)/i.test(key.trim()));
  return anyTest ? 'test' : 'production';
}

function resolveCatalogEnvironment(): string {
  const explicit = process.env.BILLING_CATALOG_ENV?.trim();
  const keyMode = providerKeyMode();
  if (explicit) {
    if (keyMode !== 'unknown' && explicit !== keyMode) {
      // Loud, because the failure mode is otherwise a bare 503 at checkout.
      console.error(
        `[BillingAPI] BILLING_CATALOG_ENV="${explicit}" does not match the ${keyMode}-mode provider keys. ` +
        `Provider plan codes will not resolve and every checkout will fail with PROVIDER_PLAN_NOT_CONFIGURED. ` +
        `Set BILLING_CATALOG_ENV="${keyMode}" or swap the provider credentials.`,
      );
    }
    return explicit;
  }
  if (keyMode !== 'unknown') return keyMode;
  return process.env.NODE_ENV === 'production' ? 'production' : 'test';
}

export const billingPolicy = {
  primaryProvider: (process.env.BILLING_PRIMARY_PROVIDER || 'PAYSTACK').toUpperCase() as LiveBillingProvider,
  paystackUsdEnabled: enabled('BILLING_PAYSTACK_USD_ENABLED', false),
  environment: resolveCatalogEnvironment(),
};

export function currencyForCountry(countryCode?: string | null): BillingCurrency {
  return countryCode?.toUpperCase() === 'NG' ? BillingCurrency.NGN : BillingCurrency.USD;
}

/**
 * Processors permitted per settlement currency (BSS §8).
 *
 * NGN settles through either Nigerian processor — Paystack by default — which
 * between them cover cards, bank transfer, virtual accounts, USSD, and mobile
 * money. USD settles through Flutterwave, covering the international card
 * networks plus Google Pay and Apple Pay.
 *
 * Order within each list is the default preference; BILLING_PRIMARY_PROVIDER
 * promotes an eligible processor to the front. Paystack settles USD only after
 * the live USD certification checklist passes.
 */
const CURRENCY_PROVIDERS: Record<BillingCurrency, LiveBillingProvider[]> = {
  [BillingCurrency.NGN]: ['PAYSTACK', 'FLUTTERWAVE'],
  [BillingCurrency.USD]: ['FLUTTERWAVE'],
};

/** A processor with no credentials cannot be offered — it would fail at call time. */
export function providerConfigured(provider: LiveBillingProvider): boolean {
  const key = provider === 'PAYSTACK'
    ? process.env.PAYSTACK_SECRET_KEY
    : process.env.FLUTTERWAVE_SECRET_KEY;
  return Boolean(key?.trim());
}

export function eligibleProviders(currency: BillingCurrency): LiveBillingProvider[] {
  const providers = CURRENCY_PROVIDERS[currency].filter(
    (provider) => provider !== 'PAYSTACK' || currency === BillingCurrency.NGN || billingPolicy.paystackUsdEnabled,
  );
  if (currency === BillingCurrency.USD && billingPolicy.paystackUsdEnabled && !providers.includes('PAYSTACK')) {
    providers.push('PAYSTACK');
  }
  return providers.filter(providerConfigured);
}

/**
 * Ordered checkout candidates for a currency. The first entry is attempted and
 * the remainder are failover targets, so a processor outage degrades to another
 * processor that settles the same currency rather than failing the checkout.
 */
export function checkoutProviders(currency: BillingCurrency): LiveBillingProvider[] {
  const providers = eligibleProviders(currency);
  const preferred = billingPolicy.primaryProvider;
  return providers.includes(preferred)
    ? [preferred, ...providers.filter((provider) => provider !== preferred)]
    : providers;
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
  const prefix = provider === 'FLUTTERWAVE' ? 'FLUTTERWAVE_PLAN_CODE' : 'PAYSTACK_PLAN_CODE';
  const key = `${prefix}_${planType}_${interval}_${currency}`;
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
