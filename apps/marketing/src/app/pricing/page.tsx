import type { Metadata } from 'next';
import Link from 'next/link';

const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.domain-name.com';

export const metadata: Metadata = {
  title: 'Pricing',
  description: 'SOTS pricing plans for QA teams, developers, and engineering organizations.',
};

const plans = [
  ['Free', 'Start with one application, SDK telemetry, and JSON exports.', '$0'],
  ['Team', 'Add reconciliation workflows, CSV/PDF exports, and team collaboration.', 'Launch pricing'],
  ['Enterprise', 'Governance, advanced retention, audit evidence, and custom deployment support.', 'Custom'],
];

export default function PricingPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-16">
      <Link href="/" className="text-sm font-semibold text-blue-700">Back to SOTS</Link>
      <h1 className="mt-10 text-5xl font-semibold tracking-tight text-slate-950">Pricing that follows product maturity</h1>
      <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
        Start with behavioral visibility, then expand into team reporting, governance, retention, and enterprise controls as the system becomes part of release readiness.
      </p>
      <div className="mt-12 grid gap-5 md:grid-cols-3">
        {plans.map(([name, body, price]) => (
          <article key={name} className="rounded-xl border border-slate-200 p-6">
            <h2 className="text-xl font-semibold text-slate-950">{name}</h2>
            <div className="mt-4 text-2xl font-semibold text-blue-700">{price}</div>
            <p className="mt-4 text-sm leading-6 text-slate-600">{body}</p>
          </article>
        ))}
      </div>
      <a href={`${appUrl}/auth/login`} className="mt-10 inline-flex rounded-md bg-blue-600 px-5 py-3 text-sm font-semibold text-white">Start reviewing your system</a>
    </main>
  );
}
