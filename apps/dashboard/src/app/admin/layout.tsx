'use client';

import { useSession } from '@/components/providers';
import { AlertTriangle, Loader2 } from 'lucide-react';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useSession();

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center min-h-[50vh]">
        <div className="flex items-center gap-3 text-neutral-400">
          <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
          <span className="text-sm">Verifying administration access...</span>
        </div>
      </div>
    );
  }

  const isSystemAdmin = (user as any)?.isSystemAdmin === true;

  if (!isSystemAdmin) {
    return (
      <div className="flex h-full items-center justify-center min-h-[50vh]">
        <div className="text-center space-y-4 max-w-md p-6 bg-neutral-900 border border-neutral-800 rounded-xl shadow-xl">
          <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto text-amber-500">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div className="space-y-2">
            <h2 className="text-lg font-bold text-white tracking-tight">Access Denied</h2>
            <p className="text-neutral-400 text-sm leading-relaxed">
              This area is restricted to system administrators. If you believe this is an error, please contact support or run the bootstrap process.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
