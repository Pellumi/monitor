# Paystack USD recurring billing certification

Keep `BILLING_PAYSTACK_USD_ENABLED=false` until every blocking item below has
been verified against the production merchant account. Never include card
numbers, authorization codes, webhook secrets, or customer personal data in
this record.

## Merchant capability

- [ ] International payments are enabled.
- [ ] USD collection and the intended USD settlement account are enabled.
- [ ] Production webhook URL and signature verification are healthy.
- [ ] Merchant fees, settlement timing, refund behavior, and statement
      descriptor have been recorded for support and finance.

## Recurring lifecycle

- [ ] Create immutable monthly and annual USD plans for every public paid tier.
- [ ] Complete USD checkout with a Nigerian-issued card.
- [ ] Complete USD checkout with an international card.
- [ ] Confirm that the returned card authorization is reusable.
- [ ] Complete a subsequent USD authorization charge.
- [ ] Create a subscription with a future `start_date`.
- [ ] Disable and re-enable a subscription.
- [ ] Observe successful renewal, failed renewal, cancellation, and
      non-renewing webhooks.
- [ ] Reconcile provider amount, currency, customer, plan, subscription,
      transaction, invoice, and organization metadata.
- [ ] Complete a refund and verify ledger/invoice behavior.

## Evidence

For each test, record the date, sanitized provider reference suffix, expected
result, actual result, webhook event types, settlement result, and reviewer.
Enable the feature flag only after a billing owner and finance reviewer approve
the completed report.
