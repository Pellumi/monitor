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

## Testing a real payment from your browser

The signed webhook is the authoritative confirmation, and a processor cannot
reach `localhost`. Two ways to get a complete round trip:

**Without a tunnel.** After the processor redirects you back, the dashboard
polls `/billing/checkouts/:invoiceId/status` and the server verifies the
transaction directly with the processor using the reference in the return URL.
This activates the plan and stores the card exactly as the webhook would. It is
the fallback path, not the primary one — the return only fires if the customer
actually lands back on the page, so a customer who closes the tab mid-redirect
still depends on the webhook.

**With a tunnel (do this before trusting the flow).** Expose billing-api and
register the public URL in both processor dashboards:

```bash
cloudflared tunnel --url http://localhost:3009
# then register https://<tunnel>/billing/webhooks/paystack and /flutterwave
```

Only a tunnel exercises what production actually does: renewal charges, failed
payments, and subscription events all arrive by webhook and never touch a
browser return.

### Paystack test cards

Use these on the hosted checkout page with any future expiry and any CVV:

| Card | Outcome |
| --- | --- |
| `4084 0840 8408 4081` | Succeeds |
| `5060 6666 6666 6666 666` | Succeeds (verve) |
| `5060 6666 6666 6666 667` | Declined — use this to exercise the grace period |

Paystack test mode also offers a bank-transfer and USSD simulator on the same
page, which is worth trying since those are the channels most Nigerian
customers use.

### What a complete test covers

1. **Subscribe from Free** — pick a plan, pay, confirm the plan activates and a
   receipt PDF arrives by email.
2. **Check the card was stored.** `Subscription.paymentMethodReference` must be
   set, and `nextBillingAt` must hold a date. Without both, the subscription
   activated but will never renew.
3. **Upgrade** — the prorated difference is charged to that stored card with no
   second trip to checkout.
4. **Downgrade** — schedules for renewal and charges nothing today.
5. **Renewal** — move `nextBillingAt` into the past and run a cycle.
6. **Failed renewal** — swap in the declining card first, then run a cycle, and
   confirm a 7-day grace period rather than an immediate downgrade.

## Exercising the lifecycle locally

Recurring billing is driven by Tellann, not by processor-side subscriptions, so trials, renewals, and grace periods can all be stepped through locally.

- `pnpm verify:billing:scope` — user-scoped billing identity, catalog localization, checkout per processor.
- `pnpm verify:billing:lifecycle` — Stripe retirement, tax, invoice documents, the 14-day trial, the 7-day grace period, and plan changes in both currencies.
- `pnpm verify:billing` — the full webhook lifecycle against the `MOCK` processor. Requires `BILLING_ALLOW_TEST_PROVIDER_OVERRIDE=true`.

To advance a subscription by hand, move `nextBillingAt`, `trialEndsAt`, or `graceEndsAt` into the past and trigger a cycle:

```bash
curl -X POST http://127.0.0.1:3009/billing/internal/billing-cycle -H "x-tellann-internal-secret: $BILLING_INTERNAL_SECRET"
```
