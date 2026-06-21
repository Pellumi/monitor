'use client';

import { usePathname } from 'next/navigation';
import { Sidebar } from '@/components/sidebar';
import React from 'react';

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
    <>
      <Sidebar />
      <main className="flex-1 overflow-auto p-8">
        {children}
      </main>
    </>
  );
}
