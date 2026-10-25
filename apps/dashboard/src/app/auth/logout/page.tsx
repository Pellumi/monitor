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
    <div className="w-full max-w-md p-6 md:p-8 bg-[#131313] border border-[#262626] rounded-md shadow-2xl animate-fade-in text-[#e2e2e2]">
      {/* Header bar matching auth-otp.html & LoginPage */}
      <div className="flex items-center justify-between border-b border-[#262626] pb-4 mb-6">
        <h1 className="text-xl font-extrabold tracking-tighter text-white uppercase font-sans">
          TELLANN
        </h1>
        <span className="inline-block border border-[#444748] text-[#8e9192] px-2 py-0.5 text-[11px] font-mono tracking-wider uppercase rounded-sm">
          AUTH // LOGOUT
        </span>
      </div>

      {/* Title & Description */}
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-white tracking-tight">
          Signing out
        </h2>
        <p className="text-sm text-[#c4c7c8] mt-1.5 leading-relaxed">
          Clearing your credentials and ending your active session securely.
        </p>
      </div>

      {/* Status & Spinner Box */}
      <div className="rounded-md border border-[#262626] bg-black p-6 flex flex-col items-center justify-center gap-4 text-center">
        <span className="w-7 h-7 border-2 border-white/20 border-t-white rounded-full animate-spin" />
        <div className="space-y-1">
          <p className="text-xs font-mono font-medium tracking-wider uppercase text-[#8e9192]">
            SESSION STATUS // TERMINATING
          </p>
          <p className="text-xs text-neutral-400">
            Please wait while we invalidate your session...
          </p>
        </div>
      </div>

      {/* Footer Navigation */}
      <div className="flex items-center justify-between border-t border-[#262626] pt-4 mt-6 text-xs text-[#8e9192] font-mono">
        <span>REDIRECTING TO LOGIN</span>
        <button
          type="button"
          onClick={() => router.push('/auth/login')}
          className="text-white hover:underline transition underline-offset-2 cursor-pointer"
        >
          Continue manually &rarr;
        </button>
      </div>
    </div>
  );
}

