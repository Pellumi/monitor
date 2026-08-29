import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import Script from 'next/script';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { logoIconSvg } from '@/lib/image';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://domain-name.com';

const themeScript = `
  (() => {
    try {
      const storedTheme = localStorage.getItem('tellann-theme');
      const theme = storedTheme === 'light' ? 'light' : 'dark';
      const root = document.documentElement;
      root.classList.toggle('dark', theme === 'dark');
      root.classList.toggle('light', theme === 'light');
      root.dataset.theme = theme;
      root.style.colorScheme = theme;
    } catch {
      document.documentElement.classList.add('dark');
      document.documentElement.dataset.theme = 'dark';
    }
  })();
`;

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
  icons: {
    icon: logoIconSvg.src,
    shortcut: logoIconSvg.src,
    apple: logoIconSvg.src,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" data-theme="dark" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <Script id="tellann-theme-bootstrap" strategy="beforeInteractive">
          {themeScript}
        </Script>
      </head>
      <body className={inter.className}>
        <SiteHeader />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
