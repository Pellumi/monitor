# Local real-provider billing

Local development uses provider test mode and hosted checkout. It never activates a paid plan merely because `NODE_ENV` is not production.

1. Set `BILLING_CATALOG_ENV=test` and a strong `BILLING_ENCRYPTION_KEY`. The catalog environment must match the mode of your provider keys — test keys only ever return test-mode plan codes, and a mismatch makes every checkout fail with `PROVIDER_PLAN_NOT_CONFIGURED`.
2. Add Paystack test keys and Flutterwave test keys plus secret hash. Keep return URLs on `http://localhost:3010/settings/billing`.
3. Set `BILLING_INTERNAL_SECRET` to the same value in both billing-api and background-workers. Renewals, trial conversions, and grace-period expiry do not run without it.
4. Provision the provider plan catalog with `pnpm billing:sync-catalog`. It creates any missing plan at each processor and records it in `BillingProviderPlan`; `--dry-run` shows what it would do. NGN is covered by Paystack and Flutterwave, USD by Flutterwave.
5. Start the dashboard (`3010`), API gateway (`3000`), billing API (`3009`), and background workers.
6. Expose `http://localhost:3009/billing/webhooks/paystack` and `/flutterwave` through ngrok or Cloudflare Tunnel. Configure the resulting HTTPS URLs in both provider dashboards.
7. Run `pnpm --filter @tellann/billing-api billing:verify-local` before checkout.

Stripe was fully retired on 2026-08-31. USD settles through Flutterwave, which covers the same card networks plus Google Pay and Apple Pay.

Set `BILLING_ALLOW_TEST_PROVIDER_OVERRIDE=true` only to reach the deterministic `MOCK` processor in automated tests. Choosing between real processors needs no override — the billing page offers every processor eligible for the payer's currency. Production ignores all overrides.

After provider return, the dashboard polls `/api-gateway/billing/checkouts/:invoiceId/status`. Flutterwave local returns may include `transaction_id`; the billing service verifies it against Flutterwave, validates reference/amount/currency, and reconciles idempotently. Signed webhooks remain authoritative and safe if they arrive later.

Card details, CVV, Google Pay and Apple Pay credentials are entered only on hosted provider pages. Wallet buttons depend on provider merchant configuration, currency, device and browser support.

## Exercising the lifecycle locally

Recurring billing is driven by Tellann, not by processor-side subscriptions, so trials, renewals, and grace periods can all be stepped through locally.

- `pnpm verify:billing:scope` — user-scoped billing identity, catalog localization, checkout per processor.
- `pnpm verify:billing:lifecycle` — Stripe retirement, tax, invoice documents, the 14-day trial, the 7-day grace period, and plan changes in both currencies.
- `pnpm verify:billing` — the full webhook lifecycle against the `MOCK` processor. Requires `BILLING_ALLOW_TEST_PROVIDER_OVERRIDE=true`.

To advance a subscription by hand, move `nextBillingAt`, `trialEndsAt`, or `graceEndsAt` into the past and trigger a cycle:

```bash
curl -X POST http://127.0.0.1:3009/billing/internal/billing-cycle -H "x-tellann-internal-secret: $BILLING_INTERNAL_SECRET"
```
