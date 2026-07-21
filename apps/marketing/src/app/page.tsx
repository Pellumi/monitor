import Link from 'next/link';

const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.domain-name.com';
const docsUrl = process.env.NEXT_PUBLIC_DOCS_URL || 'https://docs.domain-name.com';
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://domain-name.com';

const loop = [
  ['Declare', 'Model the states, transitions, and critical journeys your product is expected to support.'],
  ['Observe', 'Install the SDKs and let Tellann capture frontend sessions, backend APIs, errors, and workflows.'],
  ['Reconcile', 'Compare declared behavior with observed behavior to separate confirmed paths from true gaps.'],
  ['Report', 'Export coverage, missing states, missing flows, endpoint findings, and release evidence.'],
];

const audiences = [
  ['QA teams', 'Turn exploratory and automated test runs into concrete behavioral coverage evidence.'],
  ['Developers', 'Find hidden flows, broken transitions, missing telemetry, and endpoint regressions faster.'],
  ['Project managers', 'Review expected coverage and release readiness without reading raw test logs.'],
  ['Engineering leaders', 'Use one source of truth for behavioral quality, gaps, and product risk.'],
];

const features = [
  ['Behavioral graph', 'Visualize how users and tests actually move through the application.'],
  ['Flow declaration', 'Capture expected product behavior without forcing QA to write brittle rule packs.'],
  ['SDK telemetry', 'Collect frontend and backend evidence through environment-scoped API keys.'],
  ['Reconciliation', 'Classify confirmed behavior, true gaps, and undeclared states or transitions.'],
  ['Endpoint analysis', 'Review route latency, error rates, request volume, and performance recommendations.'],
  ['Report exports', 'Share JSON, CSV, HTML, or PDF evidence according to plan entitlements.'],
];

export default function MarketingHome() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Tellann',
    applicationCategory: 'DeveloperApplication',
    operatingSystem: 'Web',
    url: siteUrl,
    description:
      'Self-observing testing system for behavioral QA intelligence, workflow coverage, reconciliation, and release reporting.',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
  };

  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Header />
      <section className="mx-auto grid min-h-[760px] max-w-7xl grid-cols-1 items-center gap-14 px-6 pb-20 pt-16 lg:grid-cols-[1fr_0.95fr] lg:px-10">
        <div>
          <h1 className="max-w-3xl text-5xl font-semibold tracking-tight text-slate-950 sm:text-6xl lg:text-7xl">
            Self-observing QA intelligence for modern software teams
          </h1>
          <p className="mt-7 max-w-2xl text-lg leading-8 text-slate-600">
            Tellann watches how your application behaves during real QA runs, reconciles that behavior against expected flows, and turns the gaps into release-ready evidence.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link href={`${appUrl}/auth/login`} className="rounded-md bg-blue-600 px-5 py-3 text-center text-sm font-semibold text-white shadow-sm shadow-blue-200 transition hover:bg-blue-700">
              Start reviewing your system
            </Link>
            <Link href={docsUrl} className="rounded-md border border-slate-300 px-5 py-3 text-center text-sm font-semibold text-slate-800 transition hover:border-slate-400 hover:bg-slate-50">
              Read the docs
            </Link>
          </div>
          <div className="mt-10 grid max-w-xl grid-cols-3 gap-5 border-t border-slate-200 pt-7 text-sm">
            <Metric value="4-step" label="review loop" />
            <Metric value="SDK" label="frontend + backend" />
            <Metric value="QA" label="evidence exports" />
          </div>
        </div>
        <ProductMockup />
      </section>

      <section id="product" className="border-y border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-7xl px-6 py-20 lg:px-10">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-semibold tracking-tight text-slate-950">The review loop</h2>
            <p className="mt-4 text-base leading-7 text-slate-600">
              Tellann connects product expectations to observed behavior so QA, development, and delivery teams can discuss the same evidence.
            </p>
          </div>
          <div className="mt-12 grid gap-4 md:grid-cols-4">
            {loop.map(([title, body], index) => (
              <article key={title} className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-blue-50 text-sm font-semibold text-blue-700">
                  {index + 1}
                </div>
                <h3 className="mt-6 text-lg font-semibold text-slate-950">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-20 lg:px-10">
        <div className="grid gap-12 lg:grid-cols-[0.8fr_1fr]">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight text-slate-950">Built for the people responsible for quality</h2>
            <p className="mt-4 text-base leading-7 text-slate-600">
              The system is designed around the handoff between test evidence, implementation behavior, and release decisions.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {audiences.map(([title, body]) => (
              <article key={title} className="rounded-lg border border-slate-200 p-6">
                <h3 className="font-semibold text-slate-950">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-slate-950 text-white">
        <div className="mx-auto max-w-7xl px-6 py-20 lg:px-10">
          <h2 className="max-w-2xl text-3xl font-semibold tracking-tight">From raw telemetry to useful QA findings</h2>
          <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {features.map(([title, body]) => (
              <article key={title} className="rounded-lg border border-white/10 bg-white/[0.03] p-6">
                <h3 className="font-semibold">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-300">{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-20 lg:px-10">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 md:flex md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-slate-950">Ready to review a real system?</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Create an app, install the SDK, declare your first flow, then run reconciliation against real usage.
            </p>
          </div>
          <Link href={`${appUrl}/auth/login`} className="mt-6 inline-flex rounded-md bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 md:mt-0">
            Open Tellann
          </Link>
        </div>
      </section>
      <Footer />
    </main>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 lg:px-10">
        <Link href="/" className="text-lg font-semibold tracking-tight text-slate-950">Tellann</Link>
        <nav className="hidden items-center gap-8 text-sm font-medium text-slate-600 md:flex">
          <a href="#product">Product</a>
          <Link href="/pricing">Pricing</Link>
          <Link href="/security">Security</Link>
          <a href={docsUrl}>Docs</a>
        </nav>
        <div className="flex items-center gap-3 text-sm font-semibold">
          <a href={`${appUrl}/auth/login`} className="hidden text-slate-700 sm:inline">Login</a>
          <a href={`${appUrl}/auth/login`} className="rounded-md bg-slate-950 px-4 py-2 text-white">Get started</a>
        </div>
      </div>
    </header>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="font-semibold text-slate-950">{value}</div>
      <div className="mt-1 text-slate-500">{label}</div>
    </div>
  );
}

function ProductMockup() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xl shadow-slate-200">
      <div className="rounded-lg border border-slate-200 bg-slate-950 p-4 text-white">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div>
            <div className="text-sm font-semibold">Reconciliation report</div>
            <div className="mt-1 text-xs text-slate-400">Acme Checkout / staging</div>
          </div>
          <div className="rounded-md bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-300">82.4% expected coverage</div>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-[1fr_0.9fr]">
          <div className="rounded-lg bg-white/[0.04] p-4">
            <div className="mb-5 text-xs font-semibold uppercase tracking-wide text-slate-400">Behavioral graph</div>
            <div className="space-y-4">
              {['Home', 'Product detail', 'Cart', 'Checkout', 'Payment success'].map((node, index) => (
                <div key={node} className="flex items-center gap-3">
                  <div className="h-3 w-3 rounded-full bg-blue-400" />
                  <div className="flex-1 rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-sm">{node}</div>
                  {index < 4 && <div className="text-slate-500">-&gt;</div>}
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-3">
            {[
              ['Confirmed', '18 states', 'text-emerald-300'],
              ['True gaps', '3 states', 'text-amber-300'],
              ['Undeclared', '2 states', 'text-sky-300'],
              ['Endpoint risk', '1 route', 'text-rose-300'],
            ].map(([label, value, color]) => (
              <div key={label} className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
                <div className="text-xs text-slate-400">{label}</div>
                <div className={`mt-2 text-xl font-semibold ${color}`}>{value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Footer() {
  return (
    <footer className="border-t border-slate-200">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-8 text-sm text-slate-500 md:flex-row md:items-center md:justify-between lg:px-10">
        <div>(c) {new Date().getFullYear()} Tellann. Domain name pending.</div>
        <div className="flex gap-5">
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/contact">Contact</Link>
        </div>
      </div>
    </footer>
  );
}
