import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Header } from '@/components/header';
import { logoIconSvg } from '@/lib/image';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://docs.tellann.co';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'Tellann Documentation',
    template: '%s | Tellann Docs',
  },
  description:
    'Task-oriented Tellann documentation for integrations, demonstrations, behavior graphs, coverage, sessions, reports, administration, security, billing, and deployment.',
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
  icons: {
    icon: logoIconSvg.src,
    shortcut: logoIconSvg.src,
    apple: logoIconSvg.src,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" data-theme="dark" data-scroll-behavior="smooth" suppressHydrationWarning>
      <body className={inter.className}>
        <div className="docs-site-frame">
          <Header />
          {children}
        </div>
      </body>
    </html>
  );
}
