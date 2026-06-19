import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy',
  description: 'SOTS privacy placeholder for MVP launch preparation.',
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <Link href="/" className="text-sm font-semibold text-blue-700">Back to SOTS</Link>
      <h1 className="mt-10 text-5xl font-semibold tracking-tight text-slate-950">Privacy</h1>
      <p className="mt-5 text-lg leading-8 text-slate-600">
        This MVP placeholder should be replaced with a reviewed privacy policy before public launch. It should describe telemetry collection, account data, retention, subprocessors, and customer controls.
      </p>
    </main>
  );
}
