import assert from 'node:assert/strict';
import test from 'node:test';
import { BillingCurrency, PlanType } from '@sots/db';
import { currencyForCountry, proratedDifference, validateProviderPayment } from './billing-policy';

test('currencyForCountry resolves only Nigerian organizations to NGN', () => {
  assert.equal(currencyForCountry('NG'), BillingCurrency.NGN);
  assert.equal(currencyForCountry('ng'), BillingCurrency.NGN);
  assert.equal(currencyForCountry('US'), BillingCurrency.USD);
  assert.equal(currencyForCountry(null), BillingCurrency.USD);
});

test('proratedDifference charges the remaining positive difference in minor units', () => {
  const periodStart = new Date('2026-07-01T00:00:00.000Z');
  const periodEnd = new Date('2026-07-31T00:00:00.000Z');
  const result = proratedDifference({
    currentPrice: 2_900,
    targetPrice: 9_900,
    periodStart,
    periodEnd,
    at: new Date('2026-07-16T00:00:00.000Z'),
  });
  assert.deepEqual(result, { amountDue: 3_500, creditAmount: 0 });
});

test('proratedDifference returns credit for a downgrade and clamps expired periods', () => {
  assert.deepEqual(proratedDifference({
    currentPrice: 9_900,
    targetPrice: 2_900,
    periodStart: new Date('2026-07-01T00:00:00.000Z'),
    periodEnd: new Date('2026-07-31T00:00:00.000Z'),
    at: new Date('2026-07-16T00:00:00.000Z'),
  }), { amountDue: 0, creditAmount: 3_500 });
  assert.deepEqual(proratedDifference({
    currentPrice: 2_900,
    targetPrice: 9_900,
    periodStart: new Date('2026-07-01T00:00:00.000Z'),
    periodEnd: new Date('2026-07-31T00:00:00.000Z'),
    at: new Date('2026-08-01T00:00:00.000Z'),
  }), { amountDue: 0, creditAmount: 0 });
});

test('provider payment validation rejects amount, currency, and plan substitution', () => {
  const valid = {
    eventCurrency: BillingCurrency.NGN,
    invoiceCurrency: BillingCurrency.NGN,
    eventAmountMinor: 50_000,
    invoiceTotal: 50_000,
    eventPlanType: PlanType.SOLO,
    invoicePlanType: PlanType.SOLO,
  };
  assert.doesNotThrow(() => validateProviderPayment(valid));
  assert.throws(() => validateProviderPayment({ ...valid, eventAmountMinor: 49_999 }), /PAYMENT_AMOUNT_MISMATCH/);
  assert.throws(() => validateProviderPayment({ ...valid, eventCurrency: BillingCurrency.USD }), /PAYMENT_CURRENCY_MISMATCH/);
  assert.throws(() => validateProviderPayment({ ...valid, eventPlanType: PlanType.TEAM }), /PAYMENT_PLAN_MISMATCH/);
});
