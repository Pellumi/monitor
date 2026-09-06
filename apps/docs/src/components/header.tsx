'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { logoIconText, logoIconTextBlack } from '@/lib/image';
import { ThemeToggle } from '@/components/theme-toggle';

export function Header() {
  const dashboardUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.tellann.co';
  const marketingUrl = process.env.NEXT_PUBLIC_MARKETING_URL || 'https://tellann.co';
  return <header className="docs-header">
    <div className="docs-header-inner">
      <Link href="/" className="docs-brand" aria-label="Tellann documentation home">
        <Image src={logoIconText} alt="Tellann" width={116} className="docs-logo docs-logo-dark" priority />
        <Image src={logoIconTextBlack} alt="Tellann" width={116} className="docs-logo docs-logo-light" priority />
        <span>Docs</span>
      </Link>
      <nav className="docs-primary-nav" aria-label="Primary">
        <Link href="/get-started/quickstart">Guides</Link>
        <Link href="/sdk-reference/overview">SDKs</Link>
        <Link href="/api-reference/overview">API Reference</Link>
      </nav>
      <div className="docs-header-actions">
        <ThemeToggle />
        <a href={marketingUrl}>Tellann.com <ArrowUpRight aria-hidden="true" /></a>
        <a href={dashboardUrl} className="docs-dashboard-link">Open Dashboard</a>
      </div>
    </div>
  </header>;
}
