import assert from 'node:assert/strict';
import test from 'node:test';
import { BillingCurrency } from '@sots/db';
import { currencyForCountry, proratedDifference } from './billing-policy';

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
