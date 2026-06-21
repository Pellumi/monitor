'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LogoutPage() {
  const router = useRouter();

  useEffect(() => {
    fetch('/api-gateway/auth/logout', { method: 'POST' })
      .finally(() => {
        router.push('/auth/login');
      });
  }, [router]);

  return (
    <div className="flex flex-col items-center justify-center gap-4 text-neutral-400">
      <span className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
      <p className="text-sm">Logging you out securely...</p>
    </div>
  );
}
