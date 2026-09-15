"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/**
 * Onboarding no longer stops here: new applications go straight to SDK
 * connection, and declaring Flows is offered once the SDK is connected. This
 * route stays only so old links still reach the Flow declaration they pointed to.
 */
function LegacyOnboardingDeclareRedirect() {
  const router = useRouter();
  const params = useSearchParams();
  const appId = params.get("appId");

  useEffect(() => {
    router.replace(appId ? `/declare?appId=${encodeURIComponent(appId)}` : "/");
  }, [appId, router]);

  return <div className="flex min-h-[60vh] items-center justify-center text-sm text-neutral-400">Opening Flow declaration…</div>;
}

export default function OnboardingDeclarePage() {
  return (
    <Suspense fallback={<div className="text-neutral-400 animate-pulse">Loading…</div>}>
      <LegacyOnboardingDeclareRedirect />
    </Suspense>
  );
}
