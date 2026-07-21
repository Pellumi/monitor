import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://domain-name.com';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'Tellann - Self-observing QA intelligence',
    template: '%s | Tellann',
  },
  description:
    'Tellann helps QA and engineering teams declare expected behavior, observe real application usage, reconcile gaps, and generate release-ready QA intelligence.',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'Tellann - Self-observing QA intelligence',
    description:
      'Discover workflows, measure behavioral coverage, identify missing states, and generate QA reports from real application usage.',
    url: siteUrl,
    siteName: 'Tellann',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tellann - Self-observing QA intelligence',
    description:
      'Declare, observe, reconcile, and report on real software behavior.',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
