import assert from 'node:assert/strict';
import test from 'node:test';
import { BillingCurrency, PlanType } from '@tellann/db';
import { billingPolicy, checkoutProviders, currencyForCountry, eligibleProviders, proratedDifference, validateProviderPayment } from './billing-policy';

function withProviderKeys(keys: Record<string, string | undefined>, run: () => void) {
  const names = ['PAYSTACK_SECRET_KEY', 'FLUTTERWAVE_SECRET_KEY'];
  const previous = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  try {
    for (const name of names) {
      if (keys[name] === undefined) delete process.env[name];
      else process.env[name] = keys[name];
    }
    run();
  } finally {
    for (const name of names) {
      if (previous[name] === undefined) delete process.env[name];
      else process.env[name] = previous[name];
    }
  }
}

const ALL_KEYS = {
  PAYSTACK_SECRET_KEY: 'sk_test_paystack',
  FLUTTERWAVE_SECRET_KEY: 'FLWSECK_TEST-flutterwave',
};

test('NGN settles through both Nigerian processors (BSS §8)', () => {
  withProviderKeys(ALL_KEYS, () => {
    const providers = eligibleProviders(BillingCurrency.NGN);
    assert.ok(providers.includes('PAYSTACK'), 'Paystack must settle NGN');
    assert.ok(providers.includes('FLUTTERWAVE'), 'Flutterwave must settle NGN');
  });
});

test('USD settles through Flutterwave now that Stripe is retired', () => {
  withProviderKeys(ALL_KEYS, () => {
    const providers = eligibleProviders(BillingCurrency.USD);
    assert.deepEqual(providers, ['FLUTTERWAVE'], 'Flutterwave is the sole USD processor');
    assert.ok(!providers.includes('PAYSTACK' as never), 'Paystack USD stays off until certified');
  });
});

test('a processor with no credentials is never offered', () => {
  withProviderKeys({ ...ALL_KEYS, FLUTTERWAVE_SECRET_KEY: '' }, () => {
    assert.deepEqual(eligibleProviders(BillingCurrency.USD), [], 'USD has no processor without Flutterwave');
    assert.deepEqual(eligibleProviders(BillingCurrency.NGN), ['PAYSTACK'], 'NGN falls back to Paystack alone');
  });
});

test('checkout candidates lead with the primary processor and keep a failover', () => {
  withProviderKeys(ALL_KEYS, () => {
    const ordered = checkoutProviders(BillingCurrency.NGN);
    const eligible = eligibleProviders(BillingCurrency.NGN);
    assert.equal(ordered.length, 2, 'both NGN processors stay available, one as failover');
    if (eligible.includes(billingPolicy.primaryProvider)) {
      assert.equal(ordered[0], billingPolicy.primaryProvider, 'the primary processor leads when it settles this currency');
    }
    assert.deepEqual([...ordered].sort(), [...eligible].sort(), 'ordering never drops an eligible processor');
  });
});

test('currencyForCountry resolves only Nigerian payers to NGN', () => {
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
