'use client';

import { usePathname } from 'next/navigation';
import { Sidebar } from '@/components/sidebar';
import { SidebarModeProvider } from '@/components/sidebar-mode';
import React from 'react';
import Link from 'next/link';
import { NotificationBell } from '@/components/notification-bell';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuth = pathname?.startsWith('/auth');

  if (isAuth) {
    return (
      <main className="flex-1 overflow-auto flex items-center justify-center bg-neutral-950">
        {children}
      </main>
    );
  }

  return (
    <SidebarModeProvider>
      <div className="flex h-full w-full min-w-0 flex-col md:flex-row">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-[#262626] bg-[#0a0a0a] px-4 md:hidden">
          <Link href="/" className="text-lg font-extrabold tracking-tight text-white">
            Tellann
          </Link>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <Link
              href="/onboarding"
              className="rounded-md border border-[#303030] bg-black px-3 py-1.5 text-xs font-semibold text-neutral-300"
            >
              Setup
            </Link>
          </div>
        </header>
        <Sidebar />
        <main className="min-w-0 flex-1 overflow-auto p-4 sm:p-6 md:p-8">
          {children}
        </main>
      </div>
    </SidebarModeProvider>
  );
}
