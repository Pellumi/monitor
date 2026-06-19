import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import Link from 'next/link';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://docs.domain-name.com';
const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.domain-name.com';
const marketingUrl = process.env.NEXT_PUBLIC_MARKETING_URL || 'https://domain-name.com';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'SOTS Documentation',
    template: '%s | SOTS Docs',
  },
  description:
    'Complete SOTS documentation for QA teams, developers, project managers, administrators, SDK integration, reconciliation, reports, billing, and security.',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'SOTS Documentation',
    description: 'Guides and API reference for reviewing software behavior with SOTS.',
    url: siteUrl,
    siteName: 'SOTS Docs',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 lg:px-10">
            <Link href="/" className="text-lg font-semibold tracking-tight text-slate-950">SOTS Docs</Link>
            <nav className="hidden items-center gap-7 text-sm font-medium text-slate-600 md:flex">
              <Link href="/getting-started">Guides</Link>
              <Link href="/api-reference">API Reference</Link>
              <Link href="/sdk/frontend">SDKs</Link>
              <a href={marketingUrl}>Marketing</a>
            </nav>
            <a href={`${appUrl}/auth/login`} className="rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white">
              Open App
            </a>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
