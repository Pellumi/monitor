"use client";

import { RetryAction } from "@/components/service/retry-action";
import { ServiceIllustration, ServicePageShell } from "@/components/service/service-page-shell";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ServicePageShell code={500} label="INTERNAL_ERROR" title="Something didn't complete correctly." description="Tellann encountered an unexpected error while processing this request." retryAction={<RetryAction onRetry={reset} />} actions={[{ label: "Back to home", href: "/" }, { label: "Check system status", href: process.env.NEXT_PUBLIC_STATUS_URL || "https://status.tellann.co", external: true }]} reference="ERR-REQUEST"><ServiceIllustration label="Request → interrupted processing / service-state design" dimensions="760 × 320" /></ServicePageShell>;
}
