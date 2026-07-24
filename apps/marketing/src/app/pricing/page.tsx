import type { Metadata } from 'next';
import Link from 'next/link';
import { getOrderedPlans, type PlanDefinition } from '@sots/shared';

const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.domain-name.com';

export const metadata: Metadata = {
  title: 'Pricing',
  description: 'Tellann pricing plans for QA teams, developers, and engineering organizations.',
};

function money(cents: number | null, currency: 'USD' | 'NGN') {
  if (cents === null) return 'Custom';
  return new Intl.NumberFormat(currency === 'USD' ? 'en-US' : 'en-NG', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function limit(value: number, unit: string) {
  return value >= 9999 ? 'Custom' : `${value} ${unit}`;
}

function PlanCard({ plan }: { plan: PlanDefinition }) {
  const isLocal = plan.type === 'LOCAL';
  const isEnterprise = plan.type === 'ENTERPRISE';
  const monthly = isLocal ? money(plan.pricing.monthlyNgn, 'NGN') : money(plan.pricing.monthlyUsd, 'USD');
  const annual = isLocal ? money(plan.pricing.annualNgn, 'NGN') : money(plan.pricing.annualUsd, 'USD');
  return (
    <article className={`flex h-full flex-col rounded-2xl border p-6 ${plan.type === 'TEAM' ? 'border-blue-400 bg-blue-50/70 shadow-lg shadow-blue-100' : 'border-slate-200 bg-white'}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-950">{plan.name}</h2>
          <p className="mt-1 text-sm text-slate-500">{plan.audience.slice(0, 2).join(' · ')}</p>
        </div>
        {isLocal ? <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-800">Nigeria only</span> : null}
      </div>
      <div className="mt-6">
        <span className="text-3xl font-bold tracking-tight text-slate-950">{monthly}</span>
        {!isEnterprise ? <span className="text-sm text-slate-500"> / month</span> : null}
        {plan.type === 'FREE'
          ? <p className="mt-1 text-xs text-slate-500">Free forever</p>
          : annual !== 'Custom'
            ? <p className="mt-1 text-xs text-slate-500">{annual} annually · two months free</p>
            : <p className="mt-1 text-xs text-slate-500">Annual agreement</p>}
      </div>
      <p className="mt-5 text-sm leading-6 text-slate-600">{plan.description}</p>
      <dl className="mt-5 grid grid-cols-2 gap-3 border-y border-slate-100 py-4 text-sm">
        <div><dt className="text-slate-500">Applications</dt><dd className="font-semibold text-slate-900">{limit(plan.limits.applications, '')}</dd></div>
        <div><dt className="text-slate-500">Users</dt><dd className="font-semibold text-slate-900">{limit(plan.limits.users, '')}</dd></div>
        <div><dt className="text-slate-500">Storage</dt><dd className="font-semibold text-slate-900">{limit(plan.limits.storageGb, 'GB')}</dd></div>
        <div><dt className="text-slate-500">Retention</dt><dd className="font-semibold text-slate-900">{limit(plan.limits.retentionDays, 'days')}</dd></div>
      </dl>
      <ul className="mt-5 flex-1 space-y-2 text-sm text-slate-700">
        {plan.highlights.map((feature) => <li key={feature} className="flex gap-2"><span className="text-blue-600">✓</span>{feature}</li>)}
        <li className="flex gap-2"><span className="text-blue-600">✓</span>{plan.exportFormats.join(', ')} exports</li>
        <li className="flex gap-2"><span className="text-blue-600">✓</span>{plan.limits.demoSessions === null ? 'Unlimited demonstrations' : `${plan.limits.demoSessions} demonstrations / month`}</li>
      </ul>
      <a href={isEnterprise ? 'mailto:sales@tellann.com?subject=Enterprise%20plan' : `${appUrl}/auth/login`} className="mt-6 inline-flex justify-center rounded-lg bg-slate-950 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700">
        {isEnterprise ? 'Contact sales' : plan.type === 'FREE' ? 'Start free' : 'Start 14-day trial'}
      </a>
      {isLocal ? <p className="mt-3 text-center text-xs text-slate-500">Billed in NGN through Paystack. Nigerian billing address required.</p> : null}
    </article>
  );
}

export default function PricingPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-16">
      <Link href="/" className="text-sm font-semibold text-blue-700">Back to Tellann</Link>
      <h1 className="mt-10 text-5xl font-semibold tracking-tight text-slate-950">Behavioral confidence at every stage</h1>
      <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
        Six transparent plans based on applications, team size, storage, and retention. Phase 1 never charges by event volume.
      </p>
      <div className="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {getOrderedPlans().map((plan) => <PlanCard key={plan.type} plan={plan} />)}
      </div>
      <p className="mt-10 text-sm text-slate-500">Annual paid plans include approximately two months free. Enterprise capabilities are activated only after contract and provisioning approval.</p>
    </main>
  );
}
