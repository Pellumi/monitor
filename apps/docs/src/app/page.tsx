import Link from 'next/link';
import { docs } from '@/lib/docs';

const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.domain-name.com';

const featured = ['getting-started', 'qa-guide', 'developer-guide', 'project-manager-guide'];

export default function DocsHome() {
  return (
    <main>
      <section className="border-b border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-7xl px-6 py-16 lg:px-10">
          <h1 className="max-w-3xl text-5xl font-semibold tracking-tight text-slate-950">
            Documentation for reviewing real software behavior with SOTS
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
            Guides for QA teams, developers, project managers, and admins covering setup, SDK instrumentation, reconciliation, reports, billing, and security.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/getting-started" className="rounded-md bg-blue-600 px-5 py-3 text-center text-sm font-semibold text-white">
              Start with setup
            </Link>
            <a href={`${appUrl}/auth/login`} className="rounded-md border border-slate-300 px-5 py-3 text-center text-sm font-semibold text-slate-800">
              Open the app
            </a>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-10 px-6 py-14 lg:grid-cols-[270px_1fr] lg:px-10">
        <aside className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="text-sm font-semibold text-slate-950">Docs navigation</div>
          <nav className="mt-4 grid gap-2 text-sm text-slate-600">
            {docs.map((doc) => (
              <Link key={doc.slug} href={`/${doc.slug}`} className="rounded-md px-2 py-1.5 hover:bg-slate-50 hover:text-slate-950">
                {doc.title}
              </Link>
            ))}
          </nav>
        </aside>
        <div>
          <div className="grid gap-4 md:grid-cols-2">
            {featured.map((slug) => {
              const doc = docs.find((item) => item.slug === slug)!;
              return (
                <Link key={doc.slug} href={`/${doc.slug}`} className="rounded-lg border border-slate-200 p-6 transition hover:border-blue-300 hover:shadow-sm">
                  <div className="text-xs font-semibold uppercase tracking-wide text-blue-700">{doc.audience}</div>
                  <h2 className="mt-3 text-xl font-semibold text-slate-950">{doc.title}</h2>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{doc.description}</p>
                </Link>
              );
            })}
          </div>

          <section className="mt-12 rounded-xl border border-slate-200 bg-slate-950 p-6 text-white">
            <div className="text-sm font-semibold text-blue-300">SDK quickstart</div>
            <h2 className="mt-3 text-2xl font-semibold">Send the onboarding test event</h2>
            <pre className="mt-5 rounded-lg bg-black/40 p-4 text-sm leading-6 text-slate-200">
              <code>{`import { SOTS } from '@sots/frontend-sdk';\n\nSOTS.initialize({\n  endpoint: 'https://api.domain-name.com',\n  apiKey: 'SOTS_API_KEY',\n  applicationId: 'APP_ID',\n  environmentId: 'ENVIRONMENT_ID'\n});\n\nSOTS.trackEvent('SOTS_ONBOARDING_TEST');`}</code>
            </pre>
          </section>
        </div>
      </section>
    </main>
  );
}
