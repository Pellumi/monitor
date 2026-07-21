import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Contact',
  description: 'Contact the Tellann team for product, launch, and deployment questions.',
};

export default function ContactPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <Link href="/" className="text-sm font-semibold text-blue-700">Back to Tellann</Link>
      <h1 className="mt-10 text-5xl font-semibold tracking-tight text-slate-950">Contact</h1>
      <p className="mt-5 text-lg leading-8 text-slate-600">
        For MVP launch, route contact requests to your product or support inbox. Replace this page with a real form once the final brand domain and support workflow are selected.
      </p>
      <div className="mt-10 rounded-lg border border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
        support@domain-name.com
      </div>
    </main>
  );
}
