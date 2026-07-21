import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Header } from '@/components/header';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://docs.domain-name.com';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'Tellann Documentation',
    template: '%s | Tellann Docs',
  },
  description:
    'Complete Tellann documentation for QA teams, developers, project managers, administrators, SDK integration, reconciliation, reports, billing, and security.',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'Tellann Documentation',
    description: 'Guides and API reference for reviewing software behavior with Tellann.',
    url: siteUrl,
    siteName: 'Tellann Docs',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} min-h-screen bg-neutral-950 text-neutral-100 antialiased`}>
        <div className="relative flex flex-col min-h-screen">
          <Header />
          <div className="flex-1">
            {children}
          </div>
        </div>
      </body>
    </html>
  );
}
