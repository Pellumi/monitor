/**
 * Provisions provider-side subscription plans and records them in the
 * BillingProviderPlan catalog.
 *
 * Checkout resolves a provider plan code for every (planType, interval,
 * currency, provider, environment) tuple it is asked to charge. With no catalog
 * row and no matching *_PLAN_CODE_* environment variable, checkout fails with
 * PROVIDER_PLAN_NOT_CONFIGURED — so this must run once per environment before
 * anyone can subscribe.
 *
 * Coverage follows BSS §8:
 *   NGN → Paystack, Flutterwave
 *   USD → Flutterwave
 *
 * The script is idempotent: it reuses a provider plan whose name, amount,
 * interval, and currency already match, and only creates what is missing.
 *
 *   node scripts/sync-billing-catalog.mjs                  # all providers
 *   node scripts/sync-billing-catalog.mjs --provider=PAYSTACK
 *   node scripts/sync-billing-catalog.mjs --dry-run
 */
import { PrismaClient } from '@prisma/client';

// Container deployments inject the environment directly and ship no .env file.
// loadEnvFile throws ENOENT rather than no-opping, so its absence must be tolerated.
try { process.loadEnvFile?.('.env'); } catch { /* environment already populated by the platform */ }

const prisma = new PrismaClient();

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const ONLY_PROVIDER = args.find((arg) => arg.startsWith('--provider='))?.split('=')[1]?.toUpperCase() ?? null;

const PAYSTACK_KEY = process.env.PAYSTACK_SECRET_KEY?.trim() ?? '';
const FLUTTERWAVE_KEY = process.env.FLUTTERWAVE_SECRET_KEY?.trim() ?? '';

/** Plan codes are mode-scoped, so the catalog partition must match the keys. */
function environmentFor(key) {
  return /(^sk_test_)|(_TEST)|(^FLWSECK_TEST)/i.test(key) ? 'test' : 'production';
}

/** Paid, self-serve plans. Free needs no checkout; Enterprise is contracted. */
const BILLABLE_PLAN_TYPES = ['LOCAL', 'SOLO', 'TEAM', 'BUSINESS'];
const INTERVALS = ['MONTHLY', 'ANNUAL'];

function amountMinor(plan, interval, currency) {
  if (currency === 'NGN') return interval === 'MONTHLY' ? plan.monthlyPriceNgn : plan.annualPriceNgn;
  return interval === 'MONTHLY' ? plan.monthlyPriceUsd : plan.annualPriceUsd;
}

/** Local is NGN-only (PPS §5), so it must never be provisioned in USD. */
function currenciesFor(planType) {
  return planType === 'LOCAL' ? ['NGN'] : ['NGN', 'USD'];
}

function planName(planType, interval, environment) {
  return `Tellann ${planType} ${interval}${environment === 'test' ? ' [test]' : ''}`;
}

// ── Providers ───────────────────────────────────────────────────────────────

async function paystackApi(pathname, init = {}) {
  const response = await fetch(`https://api.paystack.co${pathname}`, {
    ...init,
    headers: { authorization: `Bearer ${PAYSTACK_KEY}`, 'content-type': 'application/json', ...init.headers },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || body?.status !== true) {
    throw new Error(`Paystack ${init.method ?? 'GET'} ${pathname} failed (${response.status}): ${body?.message ?? 'unknown error'}`);
  }
  return body.data;
}

async function flutterwaveApi(pathname, init = {}) {
  const response = await fetch(`https://api.flutterwave.com/v3${pathname}`, {
    ...init,
    headers: { authorization: `Bearer ${FLUTTERWAVE_KEY}`, 'content-type': 'application/json', ...init.headers },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || body?.status !== 'success') {
    throw new Error(`Flutterwave ${init.method ?? 'GET'} ${pathname} failed (${response.status}): ${body?.message ?? 'unknown error'}`);
  }
  return body.data;
}

const providers = {
  PAYSTACK: {
    currencies: ['NGN'],
    configured: () => Boolean(PAYSTACK_KEY),
    environment: () => environmentFor(PAYSTACK_KEY),
    async load() {
      const remote = await paystackApi('/plan?perPage=200');
      return Array.isArray(remote) ? remote : [];
    },
    find(remote, { name, amount, interval, currency }) {
      const providerInterval = interval === 'MONTHLY' ? 'monthly' : 'annually';
      const match = remote.find((item) => item?.name === name
        && Number(item?.amount) === amount
        && item?.interval === providerInterval
        && item?.currency === currency);
      return match?.plan_code ?? null;
    },
    async create(remote, { name, amount, interval, currency }) {
      const created = await paystackApi('/plan', {
        method: 'POST',
        body: JSON.stringify({
          name,
          amount,
          interval: interval === 'MONTHLY' ? 'monthly' : 'annually',
          currency,
        }),
      });
      remote.push(created);
      if (typeof created?.plan_code !== 'string' || !created.plan_code.startsWith('PLN_')) {
        throw new Error(`${name} did not return a Paystack plan code`);
      }
      return created.plan_code;
    },
  },

  FLUTTERWAVE: {
    currencies: ['NGN', 'USD'],
    configured: () => Boolean(FLUTTERWAVE_KEY),
    environment: () => environmentFor(FLUTTERWAVE_KEY),
    async load() {
      const all = [];
      for (let page = 1; page <= 20; page += 1) {
        const batch = await flutterwaveApi(`/payment-plans?status=active&page=${page}`);
        if (!Array.isArray(batch) || batch.length === 0) break;
        all.push(...batch);
        if (batch.length < 10) break;
      }
      return all;
    },
    find(remote, { name, amount, interval, currency }) {
      // Flutterwave payment plans carry the amount in major units.
      const major = amount / 100;
      const providerInterval = interval === 'MONTHLY' ? 'monthly' : 'yearly';
      const match = remote.find((item) => item?.name === name
        && Number(item?.amount) === major
        && item?.interval === providerInterval
        && String(item?.currency ?? '').toUpperCase() === currency);
      return match?.id != null ? String(match.id) : null;
    },
    async create(remote, { name, amount, interval, currency }) {
      const created = await flutterwaveApi('/payment-plans', {
        method: 'POST',
        body: JSON.stringify({
          name,
          amount: amount / 100,
          interval: interval === 'MONTHLY' ? 'monthly' : 'yearly',
          currency,
        }),
      });
      remote.push(created);
      if (created?.id == null) throw new Error(`${name} did not return a Flutterwave plan id`);
      return String(created.id);
    },
  },

};

// ── Sync ────────────────────────────────────────────────────────────────────

async function syncProvider(providerName, plans) {
  const provider = providers[providerName];
  if (!provider.configured()) {
    return { provider: providerName, skipped: 'no credentials configured' };
  }

  const environment = provider.environment();
  const remote = await provider.load();
  const recorded = new Map(
    (await prisma.billingProviderPlan.findMany({ where: { provider: providerName, environment, active: true } }))
      .map((row) => [`${row.planType}:${row.billingInterval}:${row.currency}`, row.providerPlanCode]),
  );
  const result = { provider: providerName, environment, created: 0, reused: 0, persisted: 0, entries: [] };

  for (const plan of plans) {
    for (const currency of currenciesFor(plan.type)) {
      if (!provider.currencies.includes(currency)) continue;
      for (const interval of INTERVALS) {
        const amount = amountMinor(plan, interval, currency);
        if (!amount || amount <= 0) continue;

        const name = planName(plan.type, interval, environment);
        const spec = { name, amount, interval, currency, planType: plan.type };

        let planCode = recorded.get(`${plan.type}:${interval}:${currency}`)
          ?? provider.find(remote, spec);
        if (planCode) {
          result.reused += 1;
        } else if (DRY_RUN) {
          result.entries.push(`WOULD CREATE ${providerName} ${plan.type}/${interval}/${currency} @ ${amount}`);
          continue;
        } else {
          planCode = await provider.create(remote, spec);
          result.created += 1;
        }

        if (!DRY_RUN) {
          await prisma.billingProviderPlan.upsert({
            where: {
              planType_billingInterval_currency_provider_environment_version: {
                planType: plan.type,
                billingInterval: interval,
                currency,
                provider: providerName,
                environment,
                version: 1,
              },
            },
            create: {
              planType: plan.type,
              billingInterval: interval,
              currency,
              provider: providerName,
              environment,
              providerPlanCode: planCode,
              version: 1,
              active: true,
            },
            update: { providerPlanCode: planCode, active: true, retiredAt: null },
          });
          result.persisted += 1;
        }
        result.entries.push(`${providerName} ${plan.type}/${interval}/${currency} → ${planCode}`);
      }
    }
  }

  return result;
}

async function main() {
  const plans = await prisma.plan.findMany({
    where: { isPublic: true, type: { in: BILLABLE_PLAN_TYPES } },
    orderBy: { sortOrder: 'asc' },
  });
  if (!plans.length) {
    throw new Error('No billable plans found. Run `pnpm billing:seed-plans` first.');
  }

  const targets = ONLY_PROVIDER ? [ONLY_PROVIDER] : Object.keys(providers);
  for (const name of targets) {
    if (!providers[name]) throw new Error(`Unknown provider ${name}`);
  }

  const results = [];
  for (const name of targets) {
    try {
      results.push(await syncProvider(name, plans));
    } catch (err) {
      results.push({ provider: name, failed: err.message });
    }
  }

  for (const result of results) {
    if (result.skipped) {
      console.log(`\n${result.provider}: skipped — ${result.skipped}`);
      continue;
    }
    if (result.failed) {
      console.log(`\n${result.provider}: FAILED — ${result.failed}`);
      continue;
    }
    console.log(`\n${result.provider} (${result.environment}): created ${result.created}, reused ${result.reused}, persisted ${result.persisted}`);
    result.entries.forEach((entry) => console.log(`  ${entry}`));
  }

  const failed = results.filter((result) => result.failed);
  if (failed.length) process.exitCode = 1;
}

main().finally(() => prisma.$disconnect());
