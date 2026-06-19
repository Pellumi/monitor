import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Terms',
  description: 'SOTS terms placeholder for MVP launch preparation.',
};

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <Link href="/" className="text-sm font-semibold text-blue-700">Back to SOTS</Link>
      <h1 className="mt-10 text-5xl font-semibold tracking-tight text-slate-950">Terms</h1>
      <p className="mt-5 text-lg leading-8 text-slate-600">
        This MVP placeholder should be replaced with reviewed customer terms before launch. Include acceptable use, billing, service availability, data ownership, and limitation of liability.
      </p>
    </main>
  );
}
