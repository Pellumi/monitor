import { PrismaClient } from '@prisma/client';

process.loadEnvFile?.('.env');
const prisma = new PrismaClient();
const key = process.env.PAYSTACK_SECRET_KEY ?? '';
const baseUrl = 'https://api.paystack.co';

function assert(value, message) {
  if (!value) throw new Error(`PAYSTACK_TEST_CATALOG_FAILED: ${message}`);
}

async function paystack(pathname, init = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    ...init,
    headers: {
      authorization: `Bearer ${key}`,
      'content-type': 'application/json',
      ...init.headers,
    },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || body?.status !== true) {
    throw new Error(`Paystack ${init.method ?? 'GET'} ${pathname} failed with ${response.status}: ${body?.message ?? 'unknown error'}`);
  }
  return body.data;
}

async function main() {
  assert(key.startsWith('sk_test_'), 'Refusing to synchronize catalog without a Paystack test secret key');
  const plans = await prisma.plan.findMany({
    where: { isPublic: true, type: { in: ['LOCAL', 'SOLO', 'TEAM', 'BUSINESS'] } },
    orderBy: { sortOrder: 'asc' },
  });
  const remote = await paystack('/plan?perPage=100');
  assert(Array.isArray(remote), 'Paystack plan listing was not an array');
  let created = 0;
  let reused = 0;
  let persisted = 0;
  for (const plan of plans) {
    for (const interval of ['MONTHLY', 'ANNUAL']) {
      const amount = interval === 'MONTHLY' ? plan.monthlyPriceNgn : plan.annualPriceNgn;
      if (!amount || amount <= 0) continue;
      const providerInterval = interval === 'MONTHLY' ? 'monthly' : 'annually';
      const name = `Tellann ${plan.type} ${interval} [test]`;
      let providerPlan = remote.find((item) =>
        item?.name === name
        && Number(item?.amount) === amount
        && item?.interval === providerInterval
        && item?.currency === 'NGN');
      if (!providerPlan) {
        providerPlan = await paystack('/plan', {
          method: 'POST',
          body: JSON.stringify({ name, amount, interval: providerInterval, currency: 'NGN' }),
        });
        remote.push(providerPlan);
        created += 1;
      } else {
        reused += 1;
      }
      assert(typeof providerPlan?.plan_code === 'string' && providerPlan.plan_code.startsWith('PLN_'), `${name} did not return a plan code`);
      await prisma.billingProviderPlan.upsert({
        where: {
          planType_billingInterval_currency_provider_environment_version: {
            planType: plan.type,
            billingInterval: interval,
            currency: 'NGN',
            provider: 'PAYSTACK',
            environment: 'test',
            version: 1,
          },
        },
        create: {
          planType: plan.type,
          billingInterval: interval,
          currency: 'NGN',
          provider: 'PAYSTACK',
          environment: 'test',
          providerPlanCode: providerPlan.plan_code,
          version: 1,
          active: true,
        },
        update: { providerPlanCode: providerPlan.plan_code, active: true, retiredAt: null },
      });
      persisted += 1;
    }
  }
  console.log(JSON.stringify({ success: true, environment: 'test', created, reused, persisted }, null, 2));
}

main().finally(() => prisma.$disconnect());

