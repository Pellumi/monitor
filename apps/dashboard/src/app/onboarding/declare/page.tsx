"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ClipboardList, ArrowRight, SkipForward } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

function OnboardingDeclareContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const appId = searchParams.get("appId") ?? "";

  if (!appId) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="text-red-400">
          Error: Application context is missing. Please restart onboarding.
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4">
      <div className="w-full max-w-lg space-y-8 rounded-md border border-[#262626] bg-[#131313] p-8 shadow-2xl">
        <div className="text-center">
          <div className="flex w-full justify-between items-center">
            <h2 className="text-2xl font-bold tracking-tight text-white">
              Declare Intended Flows
            </h2>
            <span className="text-left inline-block border border-[#444748] text-[#8e9192] px-2 py-0.5 text-[11px] font-mono tracking-wider uppercase rounded-sm">
              APP // INTENTS
            </span>
          </div>
          <div className="mt-4 w-full text-left">
            <p className="text-sm text-[#c4c7c8] leading-relaxed">
              Describe what your application is supposed to do to Tellann —
              before you run it.
            </p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-md border border-[#262626] bg-black p-6 space-y-4">
            <h3 className="text-sm font-semibold text-white">
              Why declare flows?
            </h3>
            <ul className="text-xs text-neutral-400 space-y-2 font-mono list-disc list-inside">
              <li>
                Compare top-down QA intent with bottom-up observed telemetry.
              </li>
              <li>
                Get immediate ranked suggestions for failure states and edge
                cases.
              </li>
              <li>Track State & Transition Coverage scores as key metrics.</li>
              <li>Reconcile behavior drift across application versions.</li>
            </ul>
          </div>

          <div className="flex flex-col space-y-3 pt-2">
            <Link
              href={`/declare?appId=${appId}`}
              className="w-full flex items-center justify-center space-x-2 rounded-md bg-white hover:bg-neutral-200 py-3.5 text-sm font-semibold text-black transition-colors cursor-pointer"
            >
              <span>Open Flow Declaration</span>
              <ArrowRight className="h-4 w-4" />
            </Link>

            <Link
              href={`/?appId=${appId}`}
              className="w-full flex items-center justify-center space-x-2 rounded-md border border-[#262626] bg-black hover:bg-neutral-800 py-3 text-sm font-semibold text-neutral-400 hover:text-white transition-colors cursor-pointer"
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
    <Suspense
      fallback={<div className="text-neutral-400 animate-pulse">Loading…</div>}
    >
      <OnboardingDeclareContent />
    </Suspense>
  );
}
