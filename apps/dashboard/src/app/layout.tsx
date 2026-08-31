import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Providers from '@/components/providers';
import AppLayout from '@/components/app-layout';
import { THEME_INIT_SCRIPT } from '@/lib/theme';
import { DISPLAY_INIT_SCRIPT } from '@/lib/preferences';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Tellann',
  description: 'Behavioral QA Platform',
  icons: {
    icon: '/logo_icon.svg',
    shortcut: '/logo_icon.svg',
    apple: '/logo_icon.svg',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // `suppressHydrationWarning`: the inline script below rewrites the class,
    // `data-theme` and `color-scheme` on <html> before React hydrates.
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        {/*
          Applies the saved theme, density, motion and contrast synchronously
          during HTML parsing, before the first paint. A `useEffect` would run
          after paint and flash the wrong values.
          See src/lib/theme.ts and src/lib/preferences.ts.
        */}
        <script
          dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT + DISPLAY_INIT_SCRIPT }}
        />
      </head>
      <body className={`${inter.className} flex h-screen bg-neutral-950 text-neutral-50`}>
        <Providers>
          <AppLayout>{children}</AppLayout>
        </Providers>
      </body>
    </html>
  );
}
