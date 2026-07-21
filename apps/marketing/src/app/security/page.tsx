import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Security',
  description: 'How Tellann separates tenants, protects API keys, scopes authentication, and records sensitive actions.',
};

export default function SecurityPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <Link href="/" className="text-sm font-semibold text-blue-700">Back to Tellann</Link>
      <h1 className="mt-10 text-5xl font-semibold tracking-tight text-slate-950">Security and operating boundaries</h1>
      <p className="mt-5 text-lg leading-8 text-slate-600">
        Tellann keeps the public marketing site, authenticated application, and documentation system separate. Product access is isolated on the app subdomain, with API keys scoped to organizations, applications, and environments.
      </p>
      <div className="mt-10 grid gap-4">
        {[
          ['Subdomain isolation', 'Marketing and docs remain public. Authentication cookies are scoped to the application subdomain.'],
          ['Environment API keys', 'SDK ingestion uses API keys tied to environments so development, staging, and production telemetry can be separated.'],
          ['Entitlement enforcement', 'Feature access is checked by services before protected capabilities such as exports, endpoint intelligence, and demonstrations run.'],
          ['Audit evidence', 'Sensitive activity such as auth, billing, API keys, role changes, and exports should be recorded for review.'],
        ].map(([title, body]) => (
          <section key={title} className="rounded-lg border border-slate-200 p-6">
            <h2 className="font-semibold text-slate-950">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
          </section>
        ))}
      </div>
    </main>
  );
}
