"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function LegacySdkSetupRedirect() {
  const router = useRouter();
  const params = useSearchParams();
  const appId = params.get("appId");

  useEffect(() => {
    router.replace(appId ? `/applications/${encodeURIComponent(appId)}/connect` : "/");
  }, [appId, router]);

  return <div className="flex min-h-[60vh] items-center justify-center text-sm text-neutral-400">Opening application connection…</div>;
}
