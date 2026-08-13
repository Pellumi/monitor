# Local real-provider billing

Local development uses provider test mode and hosted checkout. It never activates a paid plan merely because `NODE_ENV` is not production.

1. Set `BILLING_CATALOG_ENV=test` and a strong `BILLING_ENCRYPTION_KEY`.
2. Add Paystack test keys, Flutterwave test keys and secret hash, and Stripe test keys. Keep return URLs on `http://localhost:3010/settings/billing`.
3. Seed one `BillingProviderPlan` row for every enabled public plan/interval/currency. NGN rows use `PAYSTACK`; USD rows use `FLUTTERWAVE`, with optional `STRIPE` fallback rows.
4. Start the dashboard (`3010`), API gateway (`3000`), and billing API (`3009`).
5. Expose `http://localhost:3009/billing/webhooks/paystack` and `/flutterwave` through ngrok or Cloudflare Tunnel. Configure the resulting HTTPS URLs in both provider dashboards.
6. For Stripe, run `stripe listen --forward-to localhost:3009/billing/webhooks/stripe` and copy its signing secret to `STRIPE_WEBHOOK_SECRET`.
7. Run `pnpm --filter @sots/billing-api billing:verify-local` before checkout.

Set `BILLING_ALLOW_TEST_PROVIDER_OVERRIDE=true` only when deliberately comparing providers locally. The API constrains overrides by currency: Paystack for NGN, Flutterwave/Stripe for USD, while `MOCK` remains only for deterministic automated tests. Production ignores all overrides.

After provider return, the dashboard polls `/api-gateway/billing/checkouts/:invoiceId/status`. Flutterwave local returns may include `transaction_id`; the billing service verifies it against Flutterwave, validates reference/amount/currency, and reconciles idempotently. Signed webhooks remain authoritative and safe if they arrive later.

Card details, CVV, Google Pay and Apple Pay credentials are entered only on hosted provider pages. Wallet buttons depend on provider merchant configuration, currency, device and browser support.
