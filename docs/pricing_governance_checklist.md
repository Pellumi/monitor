# Pricing governance checklist

Every pricing or packaging change must update and verify all of the following:

- `PLAN_DEFINITIONS`, its catalog contract tests, and the ordered six-plan progression.
- Prisma plan fields, feature flags, migrations, and idempotent plan seeding.
- Pricing & Packaging, Pricing Strategy, Billing, and Entitlement specifications.
- `/billing/plans`, checkout eligibility, invoices, receipts, trials, upgrades, and downgrades.
- Server-side feature and resource enforcement, including direct API requests.
- Marketing, documentation, dashboard billing/profile, email, and admin surfaces.
- USD/Stripe, NGN/Paystack, Nigeria-only Local, and Enterprise sales workflows.
- Usage warnings at 80%, blocking at 100%, retention dry runs, and audit evidence.
- Shared, database, entitlement, billing, onboarding, reporting, frontend, and end-to-end tests.

No Phase 1 plan may introduce event allowances, event overages, hidden credits, or undocumented fees.
