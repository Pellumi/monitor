'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { ClipboardList, ArrowRight, SkipForward } from 'lucide-react';
import Link from 'next/link';
import { Suspense } from 'react';

function OnboardingDeclareContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const appId = searchParams.get('appId') ?? '';

  if (!appId) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="text-red-400">Error: Application context is missing. Please restart onboarding.</div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4">
      <div className="w-full max-w-lg space-y-8 rounded-2xl border border-neutral-800 bg-neutral-900/50 p-8 backdrop-blur-xl shadow-2xl">
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400">
            <ClipboardList className="h-6 w-6" />
          </div>
          <h2 className="mt-6 text-3xl font-extrabold tracking-tight text-white">Declare Intended Flows</h2>
          <p className="mt-2 text-sm text-neutral-400">
            Tell SOTS what your application is supposed to do — before you run it.
          </p>
        </div>

        <div className="space-y-6">
          <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-6 space-y-4">
            <h3 className="text-sm font-semibold text-white">Why declare flows?</h3>
            <ul className="text-xs text-neutral-400 space-y-2 list-disc list-inside">
              <li>Compare top-down QA intent with bottom-up observed telemetry.</li>
              <li>Get immediate ranked suggestions for failure states and edge cases.</li>
              <li>Track State & Transition Coverage scores as key metrics.</li>
              <li>Reconcile behavior drift across application versions.</li>
            </ul>
          </div>

          <div className="flex flex-col space-y-3 pt-2">
            <Link
              href={`/declare?appId=${appId}`}
              className="w-full flex items-center justify-center space-x-2 rounded-xl bg-blue-600 hover:bg-blue-500 py-3.5 text-sm font-medium text-white transition-all shadow-lg shadow-blue-600/15"
            >
              <span>Open Flow Declaration</span>
              <ArrowRight className="h-4 w-4" />
            </Link>

            <Link
              href={`/?appId=${appId}`}
              className="w-full flex items-center justify-center space-x-2 rounded-xl border border-neutral-800 bg-neutral-900/40 hover:bg-neutral-900 hover:text-white py-3 text-sm font-medium text-neutral-400 transition-colors"
            >
              <SkipForward className="h-4 w-4" />
              <span>Skip, do this later</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function OnboardingDeclarePage() {
  return (
    <Suspense fallback={<div className="text-neutral-400 animate-pulse">Loading…</div>}>
      <OnboardingDeclareContent />
    </Suspense>
  );
}
